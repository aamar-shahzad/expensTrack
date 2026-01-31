import { Button } from '@/components/ui';
import { useSyncStore } from '@/stores/syncStore';

type PeerStatus = 'online' | 'offline' | 'connecting';

interface DeviceListProps {
  connectedPeers: string[];
  savedConnections: string[];
  isConnecting: boolean;
  onDisconnect: (peerId: string) => void;
  onConnect: (peerId: string) => void;
}

// Status indicator component
function StatusDot({ status }: { status: PeerStatus }) {
  const colors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    connecting: 'bg-yellow-500 animate-pulse'
  };
  
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />
  );
}

// Extract device ID from full peer ID (et-accountId-deviceId)
function extractDeviceId(peerId: string): string {
  const parts = peerId.split('-');
  return parts.length >= 3 ? parts[parts.length - 1] : peerId;
}

export function DeviceList({
  connectedPeers,
  savedConnections,
  isConnecting,
  onDisconnect,
  onConnect
}: DeviceListProps) {
  const peerStatuses = useSyncStore(s => s.peerStatuses);
  const getLastSyncForPeer = useSyncStore(s => s.getLastSyncForPeer);
  
  const savedNotConnected = savedConnections.filter(
    id => !connectedPeers.some(peer => peer.includes(id))
  );

  // Get status for a peer
  const getStatus = (peerId: string): PeerStatus => {
    return peerStatuses[peerId] || 'offline';
  };

  return (
    <>
      {connectedPeers.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Connected Devices</h2>
          <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
            {connectedPeers.map(peerId => {
              const deviceId = extractDeviceId(peerId);
              const status = getStatus(peerId);
              const lastSync = getLastSyncForPeer(peerId);
              
              return (
                <div
                  key={peerId}
                  className="flex items-center gap-3 p-4"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--teal-green)]/10 flex items-center justify-center relative">
                    📱
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white flex items-center justify-center">
                      <StatusDot status={status} />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-medium truncate">{deviceId}</div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--teal-green)]">Connected</span>
                      {lastSync !== 'Never' && (
                        <span className="text-[var(--text-secondary)]">
                          · Synced {lastSync}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDisconnect(peerId)}
                    className="text-[var(--danger)] text-sm font-medium"
                  >
                    Disconnect
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {savedNotConnected.length > 0 && (
        <div className="px-4">
          <h2 className="text-lg font-semibold mb-3">Saved Devices</h2>
          <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
            {savedNotConnected.map(deviceId => {
              const status = getStatus(deviceId);
              const lastSync = getLastSyncForPeer(deviceId);
              
              return (
                <div
                  key={deviceId}
                  className="flex items-center gap-3 p-4"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--bg)] flex items-center justify-center relative">
                    📱
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white flex items-center justify-center">
                      <StatusDot status={status} />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-medium truncate">{deviceId}</div>
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <span>{status === 'connecting' ? 'Connecting...' : 'Offline'}</span>
                      {lastSync !== 'Never' && (
                        <span>· Last synced {lastSync}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onConnect(deviceId)}
                    loading={isConnecting || status === 'connecting'}
                    disabled={status === 'connecting'}
                  >
                    Connect
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
