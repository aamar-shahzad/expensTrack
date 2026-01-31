import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type PeerStatus = 'online' | 'offline' | 'connecting';

interface SyncHistoryEntry {
  timestamp: string;
  itemsSynced: number;
}

interface SyncState {
  deviceId: string;
  isConnected: boolean;
  isConnecting: boolean;
  connectedPeers: string[];
  savedConnections: string[];
  lastSyncTime: string | null;
  syncProgress: number;
  syncStatus: string;
  peerStatuses: Record<string, PeerStatus>;
  syncHistory: Record<string, SyncHistoryEntry[]>;
  
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
  setPeerStatus: (peerId: string, status: PeerStatus) => void;
  addSyncHistoryEntry: (peerId: string, itemsSynced: number) => void;
  getLastSyncForPeer: (peerId: string) => string;
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
      isConnecting: false,
      connectedPeers: [],
      savedConnections: [],
      lastSyncTime: null,
      syncProgress: 0,
      syncStatus: '',
      peerStatuses: {},
      syncHistory: {},

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
          connectedPeers: [...new Set([...state.connectedPeers, peerId])],
          peerStatuses: { ...state.peerStatuses, [peerId]: 'online' as PeerStatus }
        }));
      },

      removeConnectedPeer: (peerId) => {
        set(state => ({
          connectedPeers: state.connectedPeers.filter(p => p !== peerId),
          peerStatuses: { ...state.peerStatuses, [peerId]: 'offline' as PeerStatus }
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

      setPeerStatus: (peerId, status) => {
        set(state => ({
          peerStatuses: { ...state.peerStatuses, [peerId]: status }
        }));
      },

      addSyncHistoryEntry: (peerId, itemsSynced) => {
        set(state => {
          const history = state.syncHistory[peerId] || [];
          // Keep last 10 entries per peer
          const newHistory = [
            { timestamp: new Date().toISOString(), itemsSynced },
            ...history.slice(0, 9)
          ];
          return {
            syncHistory: { ...state.syncHistory, [peerId]: newHistory }
          };
        });
      },

      getLastSyncForPeer: (peerId) => {
        const { syncHistory } = get();
        const history = syncHistory[peerId];
        if (!history || history.length === 0) return 'Never';
        
        const date = new Date(history[0].timestamp);
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

      resetSync: () => {
        set({
          isConnected: false,
          isConnecting: false,
          connectedPeers: [],
          syncProgress: 0,
          syncStatus: '',
          peerStatuses: {}
        });
      }
    }),
    {
      name: 'expense-tracker-sync',
      partialize: (state) => ({
        // Device ID is now always a string, preserve it
        deviceId: state.deviceId,
        savedConnections: state.savedConnections,
        lastSyncTime: state.lastSyncTime,
        syncHistory: state.syncHistory
      })
    }
  )
);

// Export the generateShortId function for use in useSync
export { generateShortId };
