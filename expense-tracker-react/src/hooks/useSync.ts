import { useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { useSyncStore } from '@/stores/syncStore';
import { useAccountStore } from '@/stores/accountStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import * as db from '@/db/operations';
import type { SyncMessage, SyncData, Expense, Person, Payment } from '@/types';

const PEER_CONFIG = {
  host: '0.peerjs.com',
  port: 443,
  secure: true,
  debug: 1
};

export function useSync() {
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  
  // Use refs for values needed in callbacks to avoid stale closures
  const deviceIdRef = useRef<string | null>(null);
  const currentAccountRef = useRef<{ id: string; name: string; mode: string } | null>(null);
  
  const {
    deviceId,
    setConnected,
    setConnecting,
    addConnectedPeer,
    removeConnectedPeer,
    setLastSyncTime,
    setSyncProgress
  } = useSyncStore();
  
  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const loadExpenses = useExpenseStore(s => s.loadExpenses);
  const loadAllExpenses = useExpenseStore(s => s.loadAllExpenses);
  const loadPeople = usePeopleStore(s => s.loadPeople);

  // Keep refs in sync
  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  useEffect(() => {
    currentAccountRef.current = currentAccount ?? null;
  }, [currentAccount]);

  // Initialize peer
  const initPeer = useCallback(() => {
    if (peerRef.current) return;
    
    const currentDeviceId = deviceIdRef.current;
    const account = currentAccountRef.current;
    
    if (!currentDeviceId) return;

    const peerId = `et-${account?.id || 'default'}-${currentDeviceId}`;
    
    const peer = new Peer(peerId, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', () => {
      console.log('Peer connected with ID:', peer.id);
      setConnected(true);
      
      // Auto-connect to saved connections (use store directly to get current value)
      const { savedConnections: currentSaved } = useSyncStore.getState();
      currentSaved.forEach(savedId => {
        // Don't await, let connections happen in background
        connectToPeer(savedId).catch(err => {
          console.warn('Auto-connect failed for', savedId, err);
        });
      });
    });

    peer.on('connection', (conn) => {
      setupConnectionHandlers(conn);
    });

    peer.on('disconnected', () => {
      setConnected(false);
      // Try to reconnect
      setTimeout(() => {
        if (peerRef.current && !peerRef.current.destroyed) {
          peerRef.current.reconnect();
        }
      }, 3000);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      setConnected(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setConnected]); // connectToPeer and setupConnectionHandlers are stable refs

  // Setup connection event handlers
  const setupConnectionHandlers = useCallback((conn: DataConnection) => {
    conn.on('open', () => {
      console.log('Connection opened with:', conn.peer);
      connectionsRef.current.set(conn.peer, conn);
      addConnectedPeer(conn.peer);
    });

    conn.on('data', async (data) => {
      await handleMessage(data as SyncMessage, conn);
    });

    conn.on('close', () => {
      connectionsRef.current.delete(conn.peer);
      removeConnectedPeer(conn.peer);
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      connectionsRef.current.delete(conn.peer);
      removeConnectedPeer(conn.peer);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addConnectedPeer, removeConnectedPeer]); // handleMessage is stable

  // Handle incoming messages
  const handleMessage = async (message: SyncMessage, conn: DataConnection) => {
    console.log('Received message:', message.type);
    const account = currentAccountRef.current;

    switch (message.type) {
      case 'sync_request': {
        // Verify account match
        if (message.accountId !== account?.id) {
          conn.send({ type: 'sync_rejected', reason: 'Account mismatch' });
          return;
        }
        
        // First, merge the requester's data if they sent any
        if (message.data) {
          await mergeData(message.data);
        }
        
        // Send our data back
        const syncData = await prepareSyncData();
        conn.send({ 
          type: 'sync_response', 
          accountId: account?.id,
          data: syncData 
        });
        
        // Reload data after merge
        setLastSyncTime();
        loadExpenses();
        loadAllExpenses();
        loadPeople();
        break;
      }

      case 'sync_response':
        if (message.data) {
          await mergeData(message.data);
          setLastSyncTime();
          loadExpenses();
          loadAllExpenses();
          loadPeople();
        }
        break;

      case 'sync_rejected':
        console.error('Sync rejected:', message.reason);
        break;
    }
  };

  // Prepare data for sync
  const prepareSyncData = async (): Promise<SyncData> => {
    const [expenses, people, tombstones, payments] = await Promise.all([
      db.getAllExpenses(),
      db.getAllPeople(),
      db.getTombstones(),
      db.getPayments()
    ]);

    // Get images (just metadata, not full data for initial sync)
    const images = await db.getAllImages();
    const imageRefs = images.map(img => ({
      id: img.id,
      syncId: img.syncId
    }));

    return {
      expenses,
      people,
      images: imageRefs,
      tombstones,
      payments
    };
  };

  // Merge incoming data with conflict resolution
  const mergeData = async (data: SyncData) => {
    setSyncProgress(0, 'Merging data...');
    
    const existingExpenses = await db.getAllExpenses();
    const existingPeople = await db.getAllPeople();
    const existingPayments = await db.getPayments();
    
    // Create maps for quick lookup by syncId
    const expensesBySyncId = new Map<string, Expense>(
      existingExpenses.map(e => [e.syncId, e])
    );
    const peopleBySyncId = new Map<string, Person>(
      existingPeople.map(p => [p.syncId, p])
    );
    const paymentsBySyncId = new Map<string, Payment>(
      existingPayments.map(p => [p.syncId, p])
    );

    // Process tombstones first - these represent deletions
    const deletedSyncIds = new Set(data.tombstones.map(t => t.syncId));

    // Calculate total items for progress
    const total = data.expenses.length + data.people.length + (data.payments?.length || 0);
    let progress = 0;

    // Merge expenses
    for (const expense of data.expenses) {
      // Skip if deleted
      if (deletedSyncIds.has(expense.syncId)) {
        progress++;
        continue;
      }
      
      const existing = expensesBySyncId.get(expense.syncId);
      if (!existing) {
        // New expense - add it
        await db.putExpense(expense);
      } else if (expense.updatedAt && existing.updatedAt && expense.updatedAt > existing.updatedAt) {
        // Remote is newer - update
        await db.putExpense(expense);
      } else if (!existing.updatedAt && expense.createdAt > existing.createdAt) {
        // No updatedAt, use createdAt for conflict resolution
        await db.putExpense(expense);
      }
      // Otherwise keep local version (it's newer or same)
      
      progress++;
      setSyncProgress((progress / total) * 100, 'Syncing expenses...');
    }

    // Merge people
    for (const person of data.people) {
      if (deletedSyncIds.has(person.syncId)) {
        progress++;
        continue;
      }
      
      const existing = peopleBySyncId.get(person.syncId);
      if (!existing) {
        // New person - add
        await db.putPerson(person);
      }
      // People don't have updatedAt, so we keep the first one (no conflict resolution needed)
      
      progress++;
      setSyncProgress((progress / total) * 100, 'Syncing people...');
    }

    // Merge payments (was missing before!)
    if (data.payments && data.payments.length > 0) {
      for (const payment of data.payments) {
        if (deletedSyncIds.has(payment.syncId)) {
          progress++;
          continue;
        }
        
        const existing = paymentsBySyncId.get(payment.syncId);
        if (!existing) {
          // New payment - add it
          // Use putPayment if available, otherwise we need to add it
          await db.addPayment({
            fromId: payment.fromId,
            toId: payment.toId,
            amount: payment.amount,
            date: payment.date
          }).catch(() => {
            // If addPayment fails (e.g., duplicate), ignore
          });
        }
        
        progress++;
        setSyncProgress((progress / total) * 100, 'Syncing payments...');
      }
    }

    setSyncProgress(100, 'Complete');
  };

  // Internal connect function that uses refs
  const connectToPeer = async (targetId: string): Promise<void> => {
    if (!peerRef.current) {
      initPeer();
      // Wait for peer to be ready
      await new Promise<void>((resolve, reject) => {
        const checkPeer = setInterval(() => {
          if (peerRef.current?.open) {
            clearInterval(checkPeer);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkPeer);
          reject(new Error('Peer initialization timeout'));
        }, 5000);
      });
    }

    if (!peerRef.current) {
      throw new Error('Peer not initialized');
    }

    const account = currentAccountRef.current;
    const peerId = `et-${account?.id || 'default'}-${targetId}`;
    
    // Check if already connected
    if (connectionsRef.current.has(peerId)) {
      return;
    }
    
    const conn = peerRef.current.connect(peerId);
    
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
        setupConnectionHandlers(conn);
        resolve();
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  };

  // Public connect function with UI state management
  const connect = useCallback(async (targetId: string) => {
    setConnecting(true);
    try {
      await connectToPeer(targetId);
    } finally {
      setConnecting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setConnecting]); // connectToPeer is stable

  // Disconnect from a peer
  const disconnect = useCallback((peerId: string) => {
    const conn = connectionsRef.current.get(peerId);
    if (conn) {
      conn.close();
      connectionsRef.current.delete(peerId);
      removeConnectedPeer(peerId);
    }
  }, [removeConnectedPeer]);

  // Request sync from all connected peers (bidirectional - send our data too)
  const requestSync = useCallback(async () => {
    const account = currentAccountRef.current;
    
    // Prepare our data to send along with the request
    const syncData = await prepareSyncData();
    
    connectionsRef.current.forEach(conn => {
      conn.send({
        type: 'sync_request',
        accountId: account?.id,
        accountName: account?.name,
        data: syncData  // Include our data so sync is bidirectional
      });
    });
  }, []);

  // Broadcast data to all peers
  const broadcast = useCallback((message: SyncMessage) => {
    connectionsRef.current.forEach(conn => {
      conn.send(message);
    });
  }, []);

  // Connect and sync - used for join flow
  // Returns a promise that resolves when sync is complete
  const connectAndSync = useCallback(async (
    targetDeviceId: string,
    accountId: string
  ): Promise<void> => {
    setSyncProgress(0, 'Connecting...');
    
    // Initialize peer if not already
    if (!peerRef.current || peerRef.current.destroyed) {
      const currentDeviceId = deviceIdRef.current;
      if (!currentDeviceId) {
        throw new Error('Device ID not set');
      }
      
      const peerId = `et-${accountId}-${currentDeviceId}`;
      const peer = new Peer(peerId, PEER_CONFIG);
      peerRef.current = peer;
      
      // Wait for peer to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Peer initialization timeout'));
        }, 10000);
        
        peer.on('open', () => {
          clearTimeout(timeout);
          setConnected(true);
          resolve();
        });
        
        peer.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }
    
    setSyncProgress(10, 'Connecting to device...');
    
    // Connect to target peer
    const targetPeerId = `et-${accountId}-${targetDeviceId}`;
    const conn = peerRef.current!.connect(targetPeerId);
    
    // Wait for connection and sync response
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout. Make sure the other device has the app open.'));
      }, 15000);
      
      conn.on('open', async () => {
        setSyncProgress(30, 'Connected! Requesting data...');
        connectionsRef.current.set(conn.peer, conn);
        addConnectedPeer(conn.peer);
        
        // Set up one-time handler for sync response
        const handleSyncResponse = async (data: unknown) => {
          const message = data as SyncMessage;
          if (message.type === 'sync_response' && message.data) {
            clearTimeout(timeout);
            setSyncProgress(50, 'Syncing data...');
            
            try {
              await mergeData(message.data);
              setLastSyncTime();
              loadExpenses();
              loadAllExpenses();
              loadPeople();
              setSyncProgress(100, 'Complete!');
              resolve();
            } catch (err) {
              reject(err);
            }
          } else if (message.type === 'sync_rejected') {
            clearTimeout(timeout);
            reject(new Error(message.reason || 'Sync rejected'));
          }
        };
        
        conn.on('data', handleSyncResponse);
        
        // Send sync request
        conn.send({
          type: 'sync_request',
          accountId: accountId,
          accountName: ''
        });
      });
      
      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setConnected, addConnectedPeer, setLastSyncTime, setSyncProgress, loadExpenses, loadAllExpenses, loadPeople]);

  // Initialize on mount
  useEffect(() => {
    if (currentAccount?.mode === 'shared') {
      initPeer();
    }

    // Capture ref values for cleanup
    const connections = connectionsRef.current;
    const peer = peerRef.current;

    return () => {
      // Close all connections first
      connections.forEach(conn => {
        try {
          conn.close();
        } catch {
          // Ignore errors during cleanup
        }
      });
      connections.clear();
      
      // Then destroy the peer
      if (peer) {
        peer.destroy();
      }
      peerRef.current = null;
    };
  }, [currentAccount?.mode, initPeer]);

  return {
    connect,
    disconnect,
    requestSync,
    broadcast,
    connectAndSync,
    initPeer
  };
}
