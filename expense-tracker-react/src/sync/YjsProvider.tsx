import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo, type ReactNode } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Expense, Person, Payment } from '@/types';

// Awareness state for each user
export interface AwarenessUser {
  name: string;
  id: string;
  color?: string;
}

// Context value type
interface YjsContextValue {
  // Core Yjs objects
  ydoc: Y.Doc;
  provider: WebrtcProvider | null;
  persistence: IndexeddbPersistence | null;
  
  // Shared data arrays
  expenses: Y.Array<Expense>;
  people: Y.Array<Person>;
  payments: Y.Array<Payment>;
  
  // Connection state
  isConnected: boolean;
  isSynced: boolean;
  connectedPeers: AwarenessUser[];
  
  // Actions
  connect: (roomName: string, password?: string) => void;
  disconnect: () => void;
  setAwareness: (user: AwarenessUser) => void;
}

const YjsContext = createContext<YjsContextValue | null>(null);

// Hook to use Yjs context
export function useYjs() {
  const context = useContext(YjsContext);
  if (!context) {
    throw new Error('useYjs must be used within a YjsProvider');
  }
  return context;
}

// Hook to check if Yjs is available (for optional usage)
export function useYjsOptional() {
  return useContext(YjsContext);
}

interface YjsProviderProps {
  children: ReactNode;
  dbName: string; // Database name for IndexedDB persistence
}

export function YjsProvider({ children, dbName }: YjsProviderProps) {
  // Create Yjs document - recreate when dbName changes
  const [ydoc, setYdoc] = useState<Y.Doc>(() => new Y.Doc());
  const providerRef = useRef<WebrtcProvider | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const prevDbNameRef = useRef<string>(dbName);
  const currentRoomRef = useRef<string | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<AwarenessUser[]>([]);
  
  // Recreate Yjs document when dbName changes
  useEffect(() => {
    if (prevDbNameRef.current !== dbName) {
      console.log('[Yjs] Database name changed, recreating document:', dbName);
      
      // Cleanup old resources
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
        currentRoomRef.current = null;
      }
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
        persistenceRef.current = null;
      }
      
      // Destroy old document
      ydoc.destroy();
      
      // Create new document
      const newDoc = new Y.Doc();
      setYdoc(newDoc);
      setIsConnected(false);
      setIsSynced(false);
      setConnectedPeers([]);
      
      prevDbNameRef.current = dbName;
    }
  }, [dbName, ydoc]);
  
  // Get shared types (memoized to prevent unnecessary re-renders)
  const expenses = useMemo(() => ydoc.getArray<Expense>('expenses'), [ydoc]);
  const people = useMemo(() => ydoc.getArray<Person>('people'), [ydoc]);
  const payments = useMemo(() => ydoc.getArray<Payment>('payments'), [ydoc]);
  
  // Setup IndexedDB persistence
  useEffect(() => {
    if (!dbName) return;
    
    console.log('[Yjs] Setting up IndexedDB persistence:', dbName);
    
    const persistence = new IndexeddbPersistence(dbName, ydoc);
    persistenceRef.current = persistence;
    
    persistence.on('synced', () => {
      console.log('[Yjs] IndexedDB synced');
      setIsSynced(true);
    });
    
    return () => {
      persistence.destroy();
      persistenceRef.current = null;
    };
  }, [dbName, ydoc]);
  
  // Connect to WebRTC room
  const connect = useCallback((roomName: string, password?: string) => {
    // Skip if already connected to same room (avoids dropping connection when auto-connect runs)
    if (currentRoomRef.current === roomName && providerRef.current) {
      return;
    }
    
    // Disconnect existing provider if any
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    
    currentRoomRef.current = roomName;
    console.log('[Yjs] Connecting to room:', roomName);
    
    // Multiple signaling servers for resilience - if one fails (e.g. signaling.yjs.dev down),
    // others may work. Override via VITE_YJS_SIGNALING (comma-separated wss URLs).
    const envSignaling = import.meta.env.VITE_YJS_SIGNALING as string | undefined;
    const signalingServers = envSignaling
      ? envSignaling.split(',').map(s => s.trim()).filter(Boolean)
      : [
          'wss://signaling.yjs.dev',
          'wss://y-webrtc-signaling-eu.herokuapp.com',
          'wss://y-webrtc-signaling-us.herokuapp.com'
        ];

    const provider = new WebrtcProvider(roomName, ydoc, {
      signaling: signalingServers,
      // Encrypt communication if password provided
      password: password || undefined,
      // Max connections (with random factor to prevent clusters)
      maxConns: 20 + Math.floor(Math.random() * 15),
      // Filter browser tab connections (use BroadcastChannel instead)
      filterBcConns: true,
      // WebRTC config - multiple STUN servers for better NAT traversal
      peerOpts: {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' }
          ]
        }
      }
    });
    
    providerRef.current = provider;
    
    // Track connection status
    provider.on('status', (event: { connected: boolean }) => {
      console.log('[Yjs] Connection status:', event.connected);
      setIsConnected(event.connected);
    });
    
    // Track peers via awareness
    provider.awareness.on('change', () => {
      const states = provider.awareness.getStates();
      const peers: AwarenessUser[] = [];
      
      states.forEach((state, clientId) => {
        if (clientId !== ydoc.clientID && state.user) {
          peers.push(state.user as AwarenessUser);
        }
      });
      
      setConnectedPeers(peers);
    });
    
    // Set initial connected state
    setIsConnected(provider.connected);
  }, [ydoc]);
  
  // Disconnect from WebRTC
  const disconnect = useCallback(() => {
    if (providerRef.current) {
      console.log('[Yjs] Disconnecting');
      providerRef.current.destroy();
      providerRef.current = null;
      currentRoomRef.current = null;
      setIsConnected(false);
      setConnectedPeers([]);
    }
  }, []);
  
  // Set awareness (user presence)
  const setAwareness = useCallback((user: AwarenessUser) => {
    if (providerRef.current) {
      providerRef.current.awareness.setLocalState({ user });
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
      }
      ydoc.destroy();
    };
  }, [ydoc]);
  
  const value: YjsContextValue = {
    ydoc,
    provider: providerRef.current,
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

// Helper hook to observe a Y.Array and get its contents as React state
export function useYArray<T>(yarray: Y.Array<T>): T[] {
  const [items, setItems] = useState<T[]>(() => yarray.toArray());
  
  useEffect(() => {
    const observer = () => {
      setItems(yarray.toArray());
    };
    
    yarray.observe(observer);
    
    // Initial sync
    setItems(yarray.toArray());
    
    return () => {
      yarray.unobserve(observer);
    };
  }, [yarray]);
  
  return items;
}

// Helper hook to observe a Y.Map and get its contents as React state
export function useYMap<T>(ymap: Y.Map<T>): Map<string, T> {
  const [map, setMap] = useState<Map<string, T>>(() => new Map(ymap.entries()));
  
  useEffect(() => {
    const observer = () => {
      setMap(new Map(ymap.entries()));
    };
    
    ymap.observe(observer);
    
    // Initial sync
    setMap(new Map(ymap.entries()));
    
    return () => {
      ymap.unobserve(observer);
    };
  }, [ymap]);
  
  return map;
}
