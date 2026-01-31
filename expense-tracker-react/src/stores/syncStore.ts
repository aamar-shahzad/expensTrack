import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AwarenessUser } from '@/sync/YjsProvider';

export interface LastConnectParams {
  roomName: string;
  deviceId: string;
  hostDeviceId?: string;
}

interface SyncState {
  deviceId: string;
  isConnected: boolean;
  isSynced: boolean; // IndexedDB sync status
  connectedPeers: AwarenessUser[];
  roomName: string | null;
  /** User-facing connection error (PeerJS error). Cleared when connection opens. */
  connectionError: string | null;
  /** Last connect params used for retry. */
  lastConnectParams: LastConnectParams | null;

  // Actions
  setDeviceId: (id: string) => void;
  setConnected: (connected: boolean) => void;
  setSynced: (synced: boolean) => void;
  setConnectedPeers: (peers: AwarenessUser[]) => void;
  addConnectedPeer: (peerId: string) => void;
  removeConnectedPeer: (peerId: string) => void;
  setRoomName: (roomName: string | null) => void;
  setConnectionError: (error: string | null) => void;
  setLastConnectParams: (params: LastConnectParams | null) => void;
  getLastSyncTimeFormatted: () => string;
  resetSync: () => void;
}

// Generate short device ID
function generateShortId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      // Initialize device ID immediately - never null
      deviceId: generateShortId(),
      isConnected: false,
      isSynced: false,
      connectedPeers: [],
      roomName: null,
      connectionError: null,
      lastConnectParams: null,

      setDeviceId: (id) => {
        set({ deviceId: id });
      },

      setConnected: (isConnected) => {
        set({ isConnected });
      },

      setSynced: (isSynced) => {
        set({ isSynced });
      },

      setConnectedPeers: (peers) => {
        set({ connectedPeers: peers });
      },

      addConnectedPeer: (peerId) => {
        set(state => {
          // Check if peer already exists
          if (state.connectedPeers.some(p => p.id === peerId)) {
            return state;
          }
          return {
            connectedPeers: [...state.connectedPeers, { id: peerId, name: 'Unknown' }]
          };
        });
      },

      removeConnectedPeer: (peerId) => {
        set(state => ({
          connectedPeers: state.connectedPeers.filter(p => p.id !== peerId)
        }));
      },

      setRoomName: (roomName) => {
        set({ roomName });
      },

      setConnectionError: (connectionError) => {
        set({ connectionError });
      },

      setLastConnectParams: (lastConnectParams) => {
        set({ lastConnectParams });
      },

      getLastSyncTimeFormatted: () => {
        // With Yjs, sync is continuous - just return connection status
        const { isConnected, isSynced } = get();
        if (isConnected) return 'Live';
        if (isSynced) return 'Offline (synced)';
        return 'Not synced';
      },

      resetSync: () => {
        set({
          isConnected: false,
          isSynced: false,
          connectedPeers: [],
          roomName: null,
          connectionError: null,
          lastConnectParams: null
        });
      }
    }),
    {
      name: 'expense-tracker-sync',
      partialize: (state) => ({
        deviceId: state.deviceId
      })
    }
  )
);

// Export the generateShortId function
export { generateShortId };
