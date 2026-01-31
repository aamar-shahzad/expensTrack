import type { AwarenessUser } from '@/sync';

interface DeviceListProps {
  connectedPeers: AwarenessUser[];
}

export function DeviceList({ connectedPeers }: DeviceListProps) {
  if (connectedPeers.length === 0) {
    return null;
  }

  return (
    <div className="px-4 mb-6">
      <h2 className="text-lg font-semibold mb-3">Connected Peers</h2>
      <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
        {connectedPeers.map(peer => (
          <div
            key={peer.id}
            className="flex items-center gap-3 p-4"
          >
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: peer.color || '#00A884' }}
            >
              {peer.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{peer.name}</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-[var(--text-secondary)]">Online</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
