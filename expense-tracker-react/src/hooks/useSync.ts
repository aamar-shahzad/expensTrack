import { useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { useSyncStore } from '@/stores/syncStore';
import { useAccountStore } from '@/stores/accountStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import * as db from '@/db/operations';
import type { SyncMessage, SyncData } from '@/types';

const PEER_CONFIG = {
  host: '0.peerjs.com',
  port: 443,
  secure: true,
  debug: 1
};

export function useSync() {
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  
  const {
    deviceId,
    setConnected,
    setConnecting,
    addConnectedPeer,
    removeConnectedPeer,
    savedConnections,
    setLastSyncTime,
    setSyncProgress
  } = useSyncStore();
  
  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const loadExpenses = useExpenseStore(s => s.loadExpenses);
  const loadPeople = usePeopleStore(s => s.loadPeople);

  // Initialize peer
  const initPeer = useCallback(() => {
    if (peerRef.current) return;
    if (!deviceId) return;

    const peerId = `et-${currentAccount?.id || 'default'}-${deviceId}`;
    
    const peer = new Peer(peerId, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', () => {
      console.log('Peer connected with ID:', peer.id);
      setConnected(true);
      
      // Auto-connect to saved connections
      savedConnections.forEach(savedId => {
        connect(savedId);
      });
    });

    peer.on('connection', (conn) => {
      handleConnection(conn);
    });

    peer.on('disconnected', () => {
      setConnected(false);
      // Try to reconnect
      setTimeout(() => peer.reconnect(), 3000);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      setConnected(false);
    });
  }, [deviceId, currentAccount?.id, savedConnections]);

  // Handle incoming connection
  const handleConnection = useCallback((conn: DataConnection) => {
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
  }, [addConnectedPeer, removeConnectedPeer]);

  // Handle incoming messages
  const handleMessage = async (message: SyncMessage, conn: DataConnection) => {
    console.log('Received message:', message.type);

    switch (message.type) {
      case 'sync_request':
        // Verify account match
        if (message.accountId !== currentAccount?.id) {
          conn.send({ type: 'sync_rejected', reason: 'Account mismatch' });
          return;
        }
        
        // Send our data
        const syncData = await prepareSyncData();
        conn.send({ 
          type: 'sync_response', 
          accountId: currentAccount?.id,
          data: syncData 
        });
        break;

      case 'sync_response':
        if (message.data) {
          await mergeData(message.data);
          setLastSyncTime();
          loadExpenses();
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

  // Merge incoming data
  const mergeData = async (data: SyncData) => {
    setSyncProgress(0, 'Merging data...');
    
    const existingExpenses = await db.getAllExpenses();
    const existingPeople = await db.getAllPeople();
    const existingSyncIds = new Set([
      ...existingExpenses.map(e => e.syncId),
      ...existingPeople.map(p => p.syncId)
    ]);

    // Process tombstones first
    const deletedSyncIds = new Set(data.tombstones.map(t => t.syncId));

    // Merge expenses
    let progress = 0;
    const total = data.expenses.length + data.people.length;
    
    for (const expense of data.expenses) {
      if (deletedSyncIds.has(expense.syncId)) continue;
      if (!existingSyncIds.has(expense.syncId)) {
        await db.putExpense(expense);
      }
      progress++;
      setSyncProgress((progress / total) * 100, 'Syncing expenses...');
    }

    // Merge people
    for (const person of data.people) {
      if (deletedSyncIds.has(person.syncId)) continue;
      if (!existingSyncIds.has(person.syncId)) {
        await db.putPerson(person);
      }
      progress++;
      setSyncProgress((progress / total) * 100, 'Syncing people...');
    }

    setSyncProgress(100, 'Complete');
  };

  // Connect to a peer
  const connect = useCallback(async (targetId: string) => {
    if (!peerRef.current) {
      initPeer();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!peerRef.current) {
      throw new Error('Peer not initialized');
    }

    setConnecting(true);
    
    const peerId = `et-${currentAccount?.id || 'default'}-${targetId}`;
    const conn = peerRef.current.connect(peerId);
    
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        setConnecting(false);
        reject(new Error('Connection timeout'));
      }, 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
        handleConnection(conn);
        setConnecting(false);
        resolve();
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        setConnecting(false);
        reject(err);
      });
    });
  }, [currentAccount?.id, initPeer, handleConnection, setConnecting]);

  // Disconnect from a peer
  const disconnect = useCallback((peerId: string) => {
    const conn = connectionsRef.current.get(peerId);
    if (conn) {
      conn.close();
      connectionsRef.current.delete(peerId);
      removeConnectedPeer(peerId);
    }
  }, [removeConnectedPeer]);

  // Request sync from all connected peers
  const requestSync = useCallback(() => {
    connectionsRef.current.forEach(conn => {
      conn.send({
        type: 'sync_request',
        accountId: currentAccount?.id,
        accountName: currentAccount?.name
      });
    });
  }, [currentAccount]);

  // Broadcast data to all peers
  const broadcast = useCallback((message: SyncMessage) => {
    connectionsRef.current.forEach(conn => {
      conn.send(message);
    });
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (currentAccount?.mode === 'shared') {
      initPeer();
    }

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, [currentAccount?.mode, initPeer]);

  return {
    connect,
    disconnect,
    requestSync,
    broadcast
  };
}
