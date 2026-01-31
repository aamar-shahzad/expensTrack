import { Button } from '@/components/ui';
import { useSyncStore } from '@/stores/syncStore';

interface SyncStatusProps {
  isConnected: boolean;
  connectedCount: number;
  lastSync: string;
  onSyncNow: () => void;
  isSyncing?: boolean;
}

export function SyncStatus({
  isConnected,
  connectedCount,
  lastSync,
  onSyncNow,
  isSyncing = false
}: SyncStatusProps) {
  const syncProgress = useSyncStore(s => s.syncProgress);
  const syncStatus = useSyncStore(s => s.syncStatus);
  
  return (
    <div className="bg-[var(--white)] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-[var(--teal-green)]' : 'bg-[var(--text-secondary)]'
          } ${isSyncing ? 'animate-pulse' : ''}`}
        />
        <span className="font-medium">
          {isSyncing 
            ? 'Syncing...'
            : isConnected
              ? `Connected (${connectedCount} device${connectedCount !== 1 ? 's' : ''})`
              : 'Not connected'}
        </span>
      </div>

      {/* Sync progress bar */}
      {isSyncing && syncProgress > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
            <span>{syncStatus || 'Syncing...'}</span>
            <span>{Math.round(syncProgress)}%</span>
          </div>
          <div className="bg-[var(--bg)] rounded-full h-1.5 overflow-hidden">
            <div 
              className="h-full bg-[var(--teal-green)] transition-all duration-300"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="text-sm text-[var(--text-secondary)] mb-4">
        Last sync: {lastSync}
      </div>

      {connectedCount > 0 && (
        <Button 
          onClick={onSyncNow} 
          className="w-full"
          loading={isSyncing}
          disabled={isSyncing}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      )}
      
      {!isConnected && connectedCount === 0 && (
        <p className="text-xs text-[var(--text-secondary)] text-center">
          Connect to a device to enable sync
        </p>
      )}
    </div>
  );
}
