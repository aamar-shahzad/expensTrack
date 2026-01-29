import { useState } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { useAccountStore } from '@/stores/accountStore';
import { Button, Input, useToast } from '@/components/ui';
import { SyncStatus, QRCode, DeviceList } from '@/components/sync';
import { haptic, copyToClipboard } from '@/lib/utils';
import { useSync } from '@/hooks/useSync';

export function SyncPage() {
  const {
    deviceId,
    isConnected,
    isConnecting,
    connectedPeers,
    savedConnections,
    getLastSyncTimeFormatted,
    addSavedConnection,
    removeSavedConnection
  } = useSyncStore();

  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const { showSuccess, showError } = useToast();

  const { connect, disconnect, requestSync } = useSync();

  const [connectCode, setConnectCode] = useState('');

  // Include base path for GitHub Pages (e.g. /expensTrack)
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const appRoot =
    basePath && basePath !== '/' ? `${window.location.origin}${basePath}` : window.location.origin;
  const syncUrl = `${appRoot}?connect=${deviceId}&account=${currentAccount?.id}`;
  const lastSync = getLastSyncTimeFormatted();

  const handleCopyCode = async () => {
    if (deviceId) {
      const success = await copyToClipboard(deviceId);
      if (success) {
        haptic('success');
        showSuccess('Code copied!');
      }
    }
  };

  const handleConnect = async () => {
    const code = connectCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      showError('Enter a valid code');
      return;
    }

    haptic('light');
    try {
      await connect(code);
      addSavedConnection(code);
      setConnectCode('');
      showSuccess('Connected!');
    } catch {
      showError('Failed to connect');
    }
  };

  const handleSync = () => {
    haptic('light');
    requestSync();
    showSuccess('Syncing...');
  };

  const handleDisconnect = (peerId: string) => {
    disconnect(peerId);
    removeSavedConnection(peerId);
    showSuccess('Disconnected');
  };

  return (
    <div className="min-h-full bg-[var(--bg)] safe-top pb-[calc(90px+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold mb-2">Sync</h1>
        <p className="text-[var(--text-secondary)] text-sm">
          Connect devices to sync expenses in real-time
        </p>
      </div>

      {/* Status Card */}
      <div className="px-4 mb-6">
        <SyncStatus
          isConnected={isConnected}
          connectedCount={connectedPeers.length}
          lastSync={lastSync}
          onSyncNow={handleSync}
        />
      </div>

      {/* Your Code */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Your Code</h2>
        <QRCode
          deviceId={deviceId ?? ''}
          syncUrl={syncUrl}
          onCopyCode={handleCopyCode}
        />
      </div>

      {/* Connect to Device */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Connect to Device</h2>
        <div className="bg-[var(--white)] rounded-xl p-4">
          <div className="flex gap-2">
            <Input
              value={connectCode}
              onChange={e => setConnectCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="flex-1 font-mono text-center text-lg tracking-widest"
              maxLength={6}
            />
            <Button onClick={handleConnect} loading={isConnecting}>
              Connect
            </Button>
          </div>
        </div>
      </div>

      <DeviceList
        connectedPeers={connectedPeers}
        savedConnections={savedConnections}
        isConnecting={isConnecting}
        onDisconnect={handleDisconnect}
        onConnect={connect}
      />
    </div>
  );
}
