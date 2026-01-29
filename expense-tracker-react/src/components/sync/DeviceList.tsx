import { Button } from '@/components/ui';

interface DeviceListProps {
  connectedPeers: string[];
  savedConnections: string[];
  isConnecting: boolean;
  onDisconnect: (peerId: string) => void;
  onConnect: (peerId: string) => void;
}

export function DeviceList({
  connectedPeers,
  savedConnections,
  isConnecting,
  onDisconnect,
  onConnect
}: DeviceListProps) {
  const savedNotConnected = savedConnections.filter(
    id => !connectedPeers.includes(id)
  );

  return (
    <>
      {connectedPeers.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Connected Devices</h2>
          <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
            {connectedPeers.map(peerId => (
              <div
                key={peerId}
                className="flex items-center gap-3 p-4"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--teal-green)]/10 flex items-center justify-center">
                  📱
                </div>
                <div className="flex-1">
                  <div className="font-mono font-medium">{peerId}</div>
                  <div className="text-sm text-[var(--teal-green)]">
                    Connected
                  </div>
                </div>
                <button
                  onClick={() => onDisconnect(peerId)}
                  className="text-[var(--danger)] text-sm font-medium"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {savedNotConnected.length > 0 && (
        <div className="px-4">
          <h2 className="text-lg font-semibold mb-3">Saved Devices</h2>
          <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
            {savedNotConnected.map(peerId => (
              <div
                key={peerId}
                className="flex items-center gap-3 p-4"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--bg)] flex items-center justify-center">
                  📱
                </div>
                <div className="flex-1">
                  <div className="font-mono font-medium">{peerId}</div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    Saved
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onConnect(peerId)}
                  loading={isConnecting}
                >
                  Connect
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
