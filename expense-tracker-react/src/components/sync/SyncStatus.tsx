interface SyncStatusProps {
  isConnected: boolean;
  connectedCount: number;
  lastSync: string;
}

export function SyncStatus({
  isConnected,
  connectedCount,
  lastSync
}: SyncStatusProps) {
  return (
    <div className="bg-[var(--white)] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-[var(--teal-green)] animate-pulse' : 'bg-[var(--text-secondary)]'
          }`}
        />
        <span className="font-medium">
          {isConnected
            ? `Connected (${connectedCount} peer${connectedCount !== 1 ? 's' : ''})`
            : 'Not connected'}
        </span>
      </div>

      <div className="text-sm text-[var(--text-secondary)] mb-2">
        Status: {lastSync}
      </div>
      
      {isConnected && (
        <div className="text-xs text-[var(--teal-green)]">
          Changes sync automatically in real-time
        </div>
      )}
      
      {!isConnected && (
        <p className="text-xs text-[var(--text-secondary)]">
          Scan a QR code or enter a device code to connect
        </p>
      )}
    </div>
  );
}
