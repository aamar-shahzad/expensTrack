import { useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { useSyncStore, generateShortId } from '@/stores/syncStore';
import { useAccountStore } from '@/stores/accountStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useSettingsStore } from '@/stores/settingsStore';
import * as db from '@/db/operations';
import type { SyncMessage, SyncData, Expense, Person, Payment } from '@/types';

// Configurable timeouts for different network conditions
const TIMEOUTS = {
  peerInit: 15000,      // Time to wait for peer to initialize
  connection: 20000,    // Time to wait for connection to open
  sync: 30000,          // Overall sync timeout
  reconnect: {
    initial: 1000,      // Initial reconnect delay
    max: 30000,         // Maximum reconnect delay
    maxAttempts: 5      // Maximum reconnect attempts
  }
};

const PEER_CONFIG = {
  host: '0.peerjs.com',
  port: 443,
  secure: true,
  debug: 1
};

// Debug logging helper
function debugLog(message: string, ...args: unknown[]) {
  const debugMode = useSettingsStore.getState().debugMode;
  if (debugMode) {
    console.log(`[Sync ${new Date().toISOString()}] ${message}`, ...args);
  }
}

// Map technical errors to user-friendly messages
function getReadableError(error: Error | string): string {
  const message = typeof error === 'string' ? error : error.message;
  
  if (message.includes('timeout') || message.includes('Timeout')) {
    return 'Could not reach the other device. Make sure they have the app open.';
  }
  if (message.includes('unavailable') || message.includes('Could not connect')) {
    return 'The other device is not available. Ask them to open the app.';
  }
  if (message.includes('Account mismatch')) {
    return 'This QR code is for a different group.';
  }
  if (message.includes('Peer ID is taken')) {
    return 'Connection conflict. Please try again in a moment.';
  }
  if (message.includes('Lost connection')) {
    return 'Connection lost. Please try again.';
  }
  if (message.includes('Device ID not set')) {
    return 'App not ready. Please restart and try again.';
  }
  if (message.includes('network') || message.includes('Network')) {
    return 'Network error. Check your internet connection.';
  }
  
  // Generic fallback
  return 'Connection failed. Please try again.';
}

// Sleep helper for backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Validate synced data integrity
function validateSyncData(data: SyncData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate expenses
  for (const expense of data.expenses) {
    if (!expense.syncId) errors.push(`Expense missing syncId: ${expense.id}`);
    if (!expense.description) errors.push(`Expense missing description: ${expense.id}`);
    if (typeof expense.amount !== 'number' || isNaN(expense.amount)) {
      errors.push(`Expense has invalid amount: ${expense.id}`);
    }
    // payerId is optional in single mode, so we just check if it's a valid string when present
    if (expense.payerId !== undefined && typeof expense.payerId !== 'string') {
      errors.push(`Expense has invalid payerId: ${expense.id}`);
    }
  }
  
  // Validate people
  for (const person of data.people) {
    if (!person.syncId) errors.push(`Person missing syncId: ${person.id}`);
    if (!person.name) errors.push(`Person missing name: ${person.id}`);
  }
  
  // Validate payments reference existing people
  if (data.payments) {
    for (const payment of data.payments) {
      if (!payment.syncId) errors.push(`Payment missing syncId: ${payment.id}`);
      if (typeof payment.amount !== 'number' || isNaN(payment.amount)) {
        errors.push(`Payment has invalid amount: ${payment.id}`);
      }
      // Note: We can't validate person references here since they might be in our local DB
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function useSync() {
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map());
  
  // Use refs for values needed in callbacks to avoid stale closures
  const deviceIdRef = useRef<string | null>(null);
  const currentAccountRef = useRef<{ id: string; name: string; mode: string } | null>(null);
  
  // Callback ref for sync complete notification
  const onSyncCompleteRef = useRef<((itemsSynced: number, peerId: string) => void) | null>(null);
  
  const {
    deviceId,
    setConnected,
    setConnecting,
    addConnectedPeer,
    removeConnectedPeer,
    setLastSyncTime,
    setSyncProgress,
    setPeerStatus,
    addSavedConnection,
    addSyncHistoryEntry
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

  // Reconnect with exponential backoff
  const reconnectWithBackoff = useCallback(async (targetId: string) => {
    const attempts = reconnectAttemptsRef.current.get(targetId) || 0;
    
    if (attempts >= TIMEOUTS.reconnect.maxAttempts) {
      debugLog(`Max reconnect attempts reached for ${targetId}`);
      reconnectAttemptsRef.current.delete(targetId);
      return;
    }
    
    const delay = Math.min(
      TIMEOUTS.reconnect.initial * Math.pow(2, attempts),
      TIMEOUTS.reconnect.max
    );
    
    debugLog(`Reconnecting to ${targetId} in ${delay}ms (attempt ${attempts + 1})`);
    reconnectAttemptsRef.current.set(targetId, attempts + 1);
    
    await sleep(delay);
    
    try {
      await connectToPeer(targetId);
      reconnectAttemptsRef.current.delete(targetId);
      debugLog(`Reconnected to ${targetId} successfully`);
    } catch (err) {
      debugLog(`Reconnect failed for ${targetId}:`, err);
      // Will retry on next attempt
      reconnectWithBackoff(targetId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize peer
  const initPeer = useCallback(() => {
    if (peerRef.current && !peerRef.current.destroyed) return;
    
    const currentDeviceId = deviceIdRef.current;
    const account = currentAccountRef.current;
    
    if (!currentDeviceId) {
      debugLog('No device ID, cannot initialize peer');
      return;
    }

    const peerId = `et-${account?.id || 'default'}-${currentDeviceId}`;
    debugLog('Initializing peer with ID:', peerId);
    
    const peer = new Peer(peerId, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', () => {
      debugLog('Peer connected with ID:', peer.id);
      setConnected(true);
      
      // Auto-connect to saved connections
      const { savedConnections: currentSaved } = useSyncStore.getState();
      currentSaved.forEach(savedId => {
        setPeerStatus(savedId, 'connecting');
        connectToPeer(savedId).catch(err => {
          debugLog('Auto-connect failed for', savedId, err);
          setPeerStatus(savedId, 'offline');
          // Try reconnecting with backoff
          reconnectWithBackoff(savedId);
        });
      });
    });

    peer.on('connection', (conn) => {
      debugLog('Incoming connection from:', conn.peer);
      setupConnectionHandlers(conn);
    });

    peer.on('disconnected', () => {
      debugLog('Peer disconnected, attempting reconnect...');
      setConnected(false);
      // Try to reconnect
      setTimeout(() => {
        if (peerRef.current && !peerRef.current.destroyed) {
          peerRef.current.reconnect();
        }
      }, 3000);
    });

    peer.on('error', (err) => {
      debugLog('Peer error:', err);
      setConnected(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setConnected, setPeerStatus, reconnectWithBackoff]);

  // Setup connection event handlers
  const setupConnectionHandlers = useCallback((conn: DataConnection) => {
    conn.on('open', () => {
      debugLog('Connection opened with:', conn.peer);
      connectionsRef.current.set(conn.peer, conn);
      addConnectedPeer(conn.peer);
      setPeerStatus(conn.peer, 'online');
      reconnectAttemptsRef.current.delete(conn.peer);
    });

    conn.on('data', async (data) => {
      await handleMessage(data as SyncMessage, conn);
    });

    conn.on('close', () => {
      debugLog('Connection closed with:', conn.peer);
      connectionsRef.current.delete(conn.peer);
      removeConnectedPeer(conn.peer);
      setPeerStatus(conn.peer, 'offline');
      
      // Try to reconnect if this was a saved connection
      const { savedConnections } = useSyncStore.getState();
      if (savedConnections.includes(conn.peer)) {
        reconnectWithBackoff(conn.peer);
      }
    });

    conn.on('error', (err) => {
      debugLog('Connection error with', conn.peer, ':', err);
      connectionsRef.current.delete(conn.peer);
      removeConnectedPeer(conn.peer);
      setPeerStatus(conn.peer, 'offline');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addConnectedPeer, removeConnectedPeer, setPeerStatus, reconnectWithBackoff]);

  // Handle incoming messages
  const handleMessage = async (message: SyncMessage, conn: DataConnection) => {
    debugLog('Received message:', message.type, 'from:', conn.peer);
    const account = currentAccountRef.current;

    switch (message.type) {
      case 'sync_request': {
        // Verify account match
        if (message.accountId !== account?.id) {
          debugLog('Account mismatch, rejecting sync');
          conn.send({ type: 'sync_rejected', reason: 'Account mismatch' });
          return;
        }
        
        let itemsMerged = 0;
        
        // First, merge the requester's data if they sent any
        if (message.data) {
          // Validate incoming data
          const validation = validateSyncData(message.data);
          if (!validation.valid) {
            debugLog('Invalid sync data received:', validation.errors);
            // Continue anyway, but log the issues
          }
          
          itemsMerged = await mergeData(message.data);
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
        
        // Record sync history
        addSyncHistoryEntry(conn.peer, itemsMerged);
        
        // Notify about sync completion
        if (itemsMerged > 0 && onSyncCompleteRef.current) {
          onSyncCompleteRef.current(itemsMerged, conn.peer);
        }
        break;
      }

      case 'sync_response':
        if (message.data) {
          // Validate incoming data
          const validation = validateSyncData(message.data);
          if (!validation.valid) {
            debugLog('Invalid sync data received:', validation.errors);
          }
          
          const itemsMerged = await mergeData(message.data);
          setLastSyncTime();
          loadExpenses();
          loadAllExpenses();
          loadPeople();
          
          // Record sync history
          addSyncHistoryEntry(conn.peer, itemsMerged);
          
          // Notify about sync completion
          if (itemsMerged > 0 && onSyncCompleteRef.current) {
            onSyncCompleteRef.current(itemsMerged, conn.peer);
          }
        }
        break;

      case 'sync_rejected':
        debugLog('Sync rejected:', message.reason);
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
  // Returns the number of items merged
  const mergeData = async (data: SyncData): Promise<number> => {
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
    let itemsMerged = 0;

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
        itemsMerged++;
        debugLog('Added new expense:', expense.description);
      } else if (expense.updatedAt && existing.updatedAt && expense.updatedAt > existing.updatedAt) {
        // Remote is newer - update
        await db.putExpense(expense);
        itemsMerged++;
        debugLog('Updated expense:', expense.description);
      } else if (!existing.updatedAt && expense.createdAt > existing.createdAt) {
        // No updatedAt, use createdAt for conflict resolution
        await db.putExpense(expense);
        itemsMerged++;
        debugLog('Updated expense (by createdAt):', expense.description);
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
        itemsMerged++;
        debugLog('Added new person:', person.name);
      }
      // People don't have updatedAt, so we keep the first one
      
      progress++;
      setSyncProgress((progress / total) * 100, 'Syncing people...');
    }

    // Merge payments
    if (data.payments && data.payments.length > 0) {
      for (const payment of data.payments) {
        if (deletedSyncIds.has(payment.syncId)) {
          progress++;
          continue;
        }
        
        const existing = paymentsBySyncId.get(payment.syncId);
        if (!existing) {
          // New payment - add it
          try {
            await db.addPayment({
              fromId: payment.fromId,
              toId: payment.toId,
              amount: payment.amount,
              date: payment.date
            });
            itemsMerged++;
            debugLog('Added new payment');
          } catch {
            // If addPayment fails (e.g., duplicate), ignore
          }
        }
        
        progress++;
        setSyncProgress((progress / total) * 100, 'Syncing payments...');
      }
    }

    setSyncProgress(100, 'Complete');
    debugLog(`Merge complete: ${itemsMerged} items merged`);
    return itemsMerged;
  };

  // Internal connect function that uses refs
  const connectToPeer = async (targetId: string): Promise<void> => {
    debugLog('Connecting to peer:', targetId);
    
    if (!peerRef.current || peerRef.current.destroyed) {
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
        }, TIMEOUTS.peerInit);
      });
    }

    if (!peerRef.current) {
      throw new Error('Peer not initialized');
    }

    const account = currentAccountRef.current;
    const peerId = `et-${account?.id || 'default'}-${targetId}`;
    
    // Check if already connected
    if (connectionsRef.current.has(peerId)) {
      debugLog('Already connected to:', peerId);
      return;
    }
    
    setPeerStatus(targetId, 'connecting');
    const conn = peerRef.current.connect(peerId);
    
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        setPeerStatus(targetId, 'offline');
        reject(new Error('Connection timeout'));
      }, TIMEOUTS.connection);

      conn.on('open', () => {
        clearTimeout(timeout);
        setupConnectionHandlers(conn);
        resolve();
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        setPeerStatus(targetId, 'offline');
        reject(err);
      });
    });
  };

  // Public connect function with UI state management
  const connect = useCallback(async (targetId: string) => {
    setConnecting(true);
    try {
      await connectToPeer(targetId);
    } catch (err) {
      throw new Error(getReadableError(err as Error));
    } finally {
      setConnecting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setConnecting]);

  // Disconnect from a peer
  const disconnect = useCallback((peerId: string) => {
    debugLog('Disconnecting from:', peerId);
    const conn = connectionsRef.current.get(peerId);
    if (conn) {
      conn.close();
      connectionsRef.current.delete(peerId);
      removeConnectedPeer(peerId);
      setPeerStatus(peerId, 'offline');
    }
  }, [removeConnectedPeer, setPeerStatus]);

  // Request sync from all connected peers (bidirectional - send our data too)
  const requestSync = useCallback(async () => {
    debugLog('Requesting sync from all peers');
    const account = currentAccountRef.current;
    
    if (connectionsRef.current.size === 0) {
      debugLog('No connected peers to sync with');
      return;
    }
    
    // Prepare our data to send along with the request
    const syncData = await prepareSyncData();
    
    connectionsRef.current.forEach(conn => {
      conn.send({
        type: 'sync_request',
        accountId: account?.id,
        accountName: account?.name,
        data: syncData
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
    debugLog('Starting connectAndSync to:', targetDeviceId, 'for account:', accountId);
    setSyncProgress(0, 'Connecting...');
    
    // 1. Ensure device ID exists
    let currentDeviceId = deviceIdRef.current;
    if (!currentDeviceId) {
      currentDeviceId = generateShortId();
      useSyncStore.getState().setDeviceId(currentDeviceId);
      deviceIdRef.current = currentDeviceId;
      debugLog('Generated new device ID:', currentDeviceId);
    }
    
    // 2. Destroy existing peer if it exists (might have wrong account ID)
    if (peerRef.current && !peerRef.current.destroyed) {
      debugLog('Destroying existing peer');
      peerRef.current.destroy();
      peerRef.current = null;
    }
    
    // 3. Create peer with correct account ID
    const peerId = `et-${accountId}-${currentDeviceId}`;
    debugLog('Creating peer with ID:', peerId);
    
    const peer = new Peer(peerId, PEER_CONFIG);
    peerRef.current = peer;
    
    // Wait for peer to open
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Peer initialization timeout'));
      }, TIMEOUTS.peerInit);
      
      peer.on('open', () => {
        clearTimeout(timeout);
        setConnected(true);
        debugLog('Peer opened successfully');
        resolve();
      });
      
      peer.on('error', (err) => {
        clearTimeout(timeout);
        debugLog('Peer error during init:', err);
        reject(err);
      });
    });
    
    setSyncProgress(10, 'Connecting to device...');
    
    // Connect to target peer
    const targetPeerId = `et-${accountId}-${targetDeviceId}`;
    debugLog('Connecting to target peer:', targetPeerId);
    
    setPeerStatus(targetDeviceId, 'connecting');
    const conn = peerRef.current!.connect(targetPeerId);
    
    // Wait for connection and sync response
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        setPeerStatus(targetDeviceId, 'offline');
        reject(new Error(getReadableError('Connection timeout')));
      }, TIMEOUTS.sync);
      
      conn.on('open', async () => {
        debugLog('Connection opened to target');
        setSyncProgress(30, 'Connected! Requesting data...');
        connectionsRef.current.set(conn.peer, conn);
        addConnectedPeer(conn.peer);
        setPeerStatus(targetDeviceId, 'online');
        
        // Set up one-time handler for sync response
        const handleSyncResponse = async (data: unknown) => {
          const message = data as SyncMessage;
          if (message.type === 'sync_response' && message.data) {
            clearTimeout(timeout);
            debugLog('Received sync response');
            setSyncProgress(50, 'Syncing data...');
            
            try {
              // Validate data before merging
              const validation = validateSyncData(message.data);
              if (!validation.valid) {
                debugLog('Sync data validation warnings:', validation.errors);
              }
              
              const itemsMerged = await mergeData(message.data);
              setLastSyncTime();
              loadExpenses();
              loadAllExpenses();
              loadPeople();
              
              // 4. Save connection for auto-reconnect
              addSavedConnection(targetDeviceId);
              addSyncHistoryEntry(targetDeviceId, itemsMerged);
              
              setSyncProgress(100, 'Complete!');
              debugLog('Sync complete, items merged:', itemsMerged);
              resolve();
            } catch (err) {
              debugLog('Error during merge:', err);
              reject(err);
            }
          } else if (message.type === 'sync_rejected') {
            clearTimeout(timeout);
            debugLog('Sync rejected:', message.reason);
            reject(new Error(getReadableError(message.reason || 'Sync rejected')));
          }
        };
        
        conn.on('data', handleSyncResponse);
        
        // Send sync request
        debugLog('Sending sync request');
        conn.send({
          type: 'sync_request',
          accountId: accountId,
          accountName: ''
        });
      });
      
      conn.on('error', (err) => {
        clearTimeout(timeout);
        debugLog('Connection error:', err);
        setPeerStatus(targetDeviceId, 'offline');
        reject(new Error(getReadableError(err)));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setConnected, addConnectedPeer, setLastSyncTime, setSyncProgress, setPeerStatus, addSavedConnection, addSyncHistoryEntry, loadExpenses, loadAllExpenses, loadPeople]);

  // Set callback for sync complete notification
  const setOnSyncComplete = useCallback((callback: ((itemsSynced: number, peerId: string) => void) | null) => {
    onSyncCompleteRef.current = callback;
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (currentAccount?.mode === 'shared') {
      initPeer();
    }

    return () => {
      // Capture current values at cleanup time
      const connections = connectionsRef.current;
      const peer = peerRef.current;

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
      if (peer && !peer.destroyed) {
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
    initPeer,
    setOnSyncComplete,
    getReadableError
  };
}
