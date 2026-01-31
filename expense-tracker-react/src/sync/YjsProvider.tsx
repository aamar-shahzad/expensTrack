import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo, type ReactNode, type MutableRefObject } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import Peer, { type DataConnection } from 'peerjs';
import type { Expense, Person, Payment } from '@/types';

// Awareness state for each user (peer id only when using simple sync)
export interface AwarenessUser {
  name: string;
  id: string;
  color?: string;
}

export interface ConnectOptions {
  deviceId: string;
  /** When joining: creator's device id (host). When creating: same as deviceId (we are host). */
  hostDeviceId?: string;
}

// Context value type
interface YjsContextValue {
  ydoc: Y.Doc;
  persistence: IndexeddbPersistence | null;
  expenses: Y.Array<Expense>;
  people: Y.Array<Person>;
  payments: Y.Array<Payment>;
  isConnected: boolean;
  isSynced: boolean;
  connectedPeers: AwarenessUser[];
  connect: (roomName: string, options: ConnectOptions) => void;
  disconnect: () => void;
  setAwareness: (user: AwarenessUser) => void;
}

const YjsContext = createContext<YjsContextValue | null>(null);

export function useYjs() {
  const context = useContext(YjsContext);
  if (!context) throw new Error('useYjs must be used within a YjsProvider');
  return context;
}

export function useYjsOptional() {
  return useContext(YjsContext);
}

interface YjsProviderProps {
  children: ReactNode;
  dbName: string;
}

/**
 * Sync Yjs over PeerJS DataChannels (no y-webrtc).
 * 1. Send full state on new connection: Y.encodeStateAsUpdate(ydoc)
 * 2. On data: Y.applyUpdate(ydoc, data, conn) so we don't echo back
 * 3. On ydoc update: broadcast to all conns except origin
 */
function setupYjsSync(
  ydoc: Y.Doc,
  conn: DataConnection,
  connectionsRef: MutableRefObject<Set<DataConnection>>,
  setConnectedPeers: (peers: AwarenessUser[]) => void,
  setIsConnected: (v: boolean) => void
): () => void {
  const connections = connectionsRef.current;
  connections.add(conn);

  // 1. Send local state to new peer
  const state = Y.encodeStateAsUpdate(ydoc);
  if (state.byteLength > 0) {
    try {
      conn.send(state.buffer.slice(state.byteOffset, state.byteOffset + state.byteLength));
    } catch {
      // ignore
    }
  }

  // 2. Receive updates from peer (origin = conn so we don't re-broadcast to sender)
  const onData = (data: unknown) => {
    try {
      const buf = data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : data instanceof Uint8Array
          ? data
          : null;
      if (buf && buf.byteLength > 0) {
        Y.applyUpdate(ydoc, buf, conn);
      }
    } catch (e) {
      console.error('[Yjs] applyUpdate error', e);
    }
  };

  // 3. Broadcast local updates to all peers except the one that sent the update
  const onUpdate = (update: Uint8Array, origin: unknown) => {
    const payload = update.buffer.slice(update.byteOffset, update.byteOffset + update.byteLength);
    for (const c of connections) {
      if (c !== origin && (c as DataConnection & { open?: boolean }).open !== false) {
        try {
          c.send(payload);
        } catch {
          // ignore
        }
      }
    }
  };

  conn.on('data', onData);
  ydoc.on('update', onUpdate);

  const updatePeerList = () => {
    setIsConnected(connections.size > 0);
    setConnectedPeers(
      Array.from(connections).map((c) => ({ id: c.peer, name: 'Peer' }))
    );
  };
  updatePeerList();

  const onClose = () => {
    connections.delete(conn);
    ydoc.off('update', onUpdate);
    updatePeerList();
  };
  conn.on('close', onClose);

  return () => {
    connections.delete(conn);
    ydoc.off('update', onUpdate);
    updatePeerList();
  };
}

export function YjsProvider({ children, dbName }: YjsProviderProps) {
  const [ydoc, setYdoc] = useState<Y.Doc>(() => new Y.Doc());
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Set<DataConnection>>(new Set());
  const cleanupFnsRef = useRef<(() => void)[]>([]);
  const prevDbNameRef = useRef<string>(dbName);
  const currentRoomRef = useRef<string | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<AwarenessUser[]>([]);

  // Recreate Yjs document when dbName changes
  useEffect(() => {
    if (prevDbNameRef.current !== dbName) {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      connectionsRef.current.forEach((c) => c.close());
      connectionsRef.current.clear();
      cleanupFnsRef.current.forEach((fn) => fn());
      cleanupFnsRef.current = [];
      persistenceRef.current?.destroy();
      persistenceRef.current = null;
      ydoc.destroy();
      setYdoc(new Y.Doc());
      setIsConnected(false);
      setIsSynced(false);
      setConnectedPeers([]);
      currentRoomRef.current = null;
      prevDbNameRef.current = dbName;
    }
  }, [dbName, ydoc]);

  const expenses = useMemo(() => ydoc.getArray<Expense>('expenses'), [ydoc]);
  const people = useMemo(() => ydoc.getArray<Person>('people'), [ydoc]);
  const payments = useMemo(() => ydoc.getArray<Payment>('payments'), [ydoc]);

  // IndexedDB persistence
  useEffect(() => {
    if (!dbName) return;
    const persistence = new IndexeddbPersistence(dbName, ydoc);
    persistenceRef.current = persistence;
    persistence.on('synced', () => setIsSynced(true));
    return () => {
      persistence.destroy();
      persistenceRef.current = null;
    };
  }, [dbName, ydoc]);

  const connect = useCallback(
    (roomName: string, options: ConnectOptions) => {
      const { deviceId, hostDeviceId } = options;
      const isHost = !hostDeviceId || hostDeviceId === deviceId;

      if (currentRoomRef.current === roomName && peerRef.current) {
        return;
      }

      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      connectionsRef.current.forEach((c) => c.close());
      connectionsRef.current.clear();
      cleanupFnsRef.current.forEach((fn) => fn());
      cleanupFnsRef.current = [];
      currentRoomRef.current = roomName;

      if (isHost) {
        // We are the host: others connect to us
        const peer = new Peer(deviceId, {
          host: '0.peerjs.com',
          path: '/',
          secure: true
        });
        peerRef.current = peer;

        peer.on('open', () => {
          console.log('[Yjs] PeerJS host open, id:', deviceId);
        });

        peer.on('connection', (conn: DataConnection) => {
          conn.on('open', () => {
            const cleanup = setupYjsSync(
              ydoc,
              conn,
              connectionsRef,
              setConnectedPeers,
              setIsConnected
            );
            cleanupFnsRef.current.push(cleanup);
          });
        });
      } else {
        // We are the joiner: connect to host (we still need our own peer id)
        const peer = new Peer(deviceId, {
          host: '0.peerjs.com',
          path: '/',
          secure: true
        });
        peerRef.current = peer;

        peer.on('open', () => {
          const conn = peer.connect(hostDeviceId!, { reliable: true });
          conn.on('open', () => {
            const cleanup = setupYjsSync(
              ydoc,
              conn,
              connectionsRef,
              setConnectedPeers,
              setIsConnected
            );
            cleanupFnsRef.current.push(cleanup);
          });
          conn.on('error', (err) => console.error('[Yjs] PeerJS conn error', err));
        });
      }

      peerRef.current.on('error', (err) => console.error('[Yjs] PeerJS error', err));
      peerRef.current.on('disconnected', () => {
        setIsConnected(connectionsRef.current.size > 0);
      });
    },
    [ydoc]
  );

  const disconnect = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    connectionsRef.current.forEach((c) => c.close());
    connectionsRef.current.clear();
    cleanupFnsRef.current.forEach((fn) => fn());
    cleanupFnsRef.current = [];
    currentRoomRef.current = null;
    setIsConnected(false);
    setConnectedPeers([]);
  }, []);

  const setAwareness = useCallback((_user: AwarenessUser) => {
    // No awareness protocol with simple sync; no-op so callers don't break
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
      persistenceRef.current?.destroy();
      ydoc.destroy();
    };
  }, [ydoc, disconnect]);

  const value: YjsContextValue = {
    ydoc,
    persistence: persistenceRef.current,
    expenses,
    people,
    payments,
    isConnected,
    isSynced,
    connectedPeers,
    connect,
    disconnect,
    setAwareness
  };

  return (
    <YjsContext.Provider value={value}>
      {children}
    </YjsContext.Provider>
  );
}

export function useYArray<T>(yarray: Y.Array<T>): T[] {
  const [items, setItems] = useState<T[]>(() => yarray.toArray());
  useEffect(() => {
    const observer = () => setItems(yarray.toArray());
    yarray.observe(observer);
    setItems(yarray.toArray());
    return () => yarray.unobserve(observer);
  }, [yarray]);
  return items;
}

export function useYMap<T>(ymap: Y.Map<T>): Map<string, T> {
  const [map, setMap] = useState<Map<string, T>>(() => new Map(ymap.entries()));
  useEffect(() => {
    const observer = () => setMap(new Map(ymap.entries()));
    ymap.observe(observer);
    setMap(new Map(ymap.entries()));
    return () => ymap.unobserve(observer);
  }, [ymap]);
  return map;
}
