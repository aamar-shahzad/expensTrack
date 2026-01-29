import { Button } from '@/components/ui';

interface SyncStatusProps {
  isConnected: boolean;
  connectedCount: number;
  lastSync: string;
  onSyncNow: () => void;
}

export function SyncStatus({
  isConnected,
  connectedCount,
  lastSync,
  onSyncNow
}: SyncStatusProps) {
  return (
    <div className="bg-[var(--white)] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-[var(--teal-green)]' : 'bg-[var(--text-secondary)]'
          }`}
        />
        <span className="font-medium">
          {isConnected
            ? `Connected (${connectedCount} device${connectedCount !== 1 ? 's' : ''})`
            : 'Not connected'}
        </span>
      </div>

      <div className="text-sm text-[var(--text-secondary)] mb-4">
        Last sync: {lastSync}
      </div>

      {isConnected && (
        <Button onClick={onSyncNow} className="w-full">
          Sync Now
        </Button>
      )}
    </div>
  );
}
