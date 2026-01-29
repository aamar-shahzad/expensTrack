import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SyncState {
  deviceId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectedPeers: string[];
  savedConnections: string[];
  lastSyncTime: string | null;
  syncProgress: number;
  syncStatus: string;
  
  // Actions
  setDeviceId: (id: string) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  addConnectedPeer: (peerId: string) => void;
  removeConnectedPeer: (peerId: string) => void;
  addSavedConnection: (peerId: string) => void;
  removeSavedConnection: (peerId: string) => void;
  setLastSyncTime: () => void;
  getLastSyncTimeFormatted: () => string;
  setSyncProgress: (progress: number, status: string) => void;
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
      deviceId: null,
      isConnected: false,
      isConnecting: false,
      connectedPeers: [],
      savedConnections: [],
      lastSyncTime: null,
      syncProgress: 0,
      syncStatus: '',

      setDeviceId: (id) => {
        set({ deviceId: id });
      },

      setConnected: (isConnected) => {
        set({ isConnected });
      },

      setConnecting: (isConnecting) => {
        set({ isConnecting });
      },

      addConnectedPeer: (peerId) => {
        set(state => ({
          connectedPeers: [...new Set([...state.connectedPeers, peerId])]
        }));
      },

      removeConnectedPeer: (peerId) => {
        set(state => ({
          connectedPeers: state.connectedPeers.filter(p => p !== peerId)
        }));
      },

      addSavedConnection: (peerId) => {
        set(state => ({
          savedConnections: [...new Set([...state.savedConnections, peerId])]
        }));
      },

      removeSavedConnection: (peerId) => {
        set(state => ({
          savedConnections: state.savedConnections.filter(p => p !== peerId)
        }));
      },

      setLastSyncTime: () => {
        set({ lastSyncTime: new Date().toISOString() });
      },

      getLastSyncTimeFormatted: () => {
        const { lastSyncTime } = get();
        if (!lastSyncTime) return 'Never';
        
        const date = new Date(lastSyncTime);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
      },

      setSyncProgress: (progress, status) => {
        set({ syncProgress: progress, syncStatus: status });
      },

      resetSync: () => {
        set({
          isConnected: false,
          isConnecting: false,
          connectedPeers: [],
          syncProgress: 0,
          syncStatus: ''
        });
      }
    }),
    {
      name: 'expense-tracker-sync',
      partialize: (state) => ({
        deviceId: state.deviceId || generateShortId(),
        savedConnections: state.savedConnections,
        lastSyncTime: state.lastSyncTime
      }),
      onRehydrateStorage: () => (state) => {
        // Generate device ID on first load if not rehydrated
        if (state && !state.deviceId) {
          useSyncStore.getState().setDeviceId(generateShortId());
        }
      }
    }
  )
);
