import { useState } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { useAccountStore } from '@/stores/accountStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { Button, Input, useToast, Modal } from '@/components/ui';
import { SyncStatus, QRCode, DeviceList, QRScanner } from '@/components/sync';
import { haptic, copyToClipboard } from '@/lib/utils';
import { useSync } from '@/hooks/useSync';
import type { Person } from '@/types';

export function SyncPage() {
  const {
    deviceId,
    isConnected,
    isConnecting,
    connectedPeers,
    savedConnections,
    getLastSyncTimeFormatted,
    addSavedConnection,
    removeSavedConnection,
    syncProgress,
    syncStatus
  } = useSyncStore();

  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const selfPersonId = useAccountStore(s => s.selfPersonId);
  const setSelfPersonId = useAccountStore(s => s.setSelfPersonId);
  
  const people = usePeopleStore(s => s.people);
  const loadPeople = usePeopleStore(s => s.loadPeople);
  
  const { showSuccess, showError } = useToast();

  const { connect, disconnect, requestSync, connectAndSync } = useSync();

  const [connectCode, setConnectCode] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showSelectName, setShowSelectName] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

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

  // QR Scanner handlers for new member joining
  const handleOpenScanner = () => {
    haptic('light');
    setJoinError(null);
    setShowScanner(true);
  };

  const handleQRScanned = async (data: { accountId: string; deviceId: string; accountName: string }) => {
    setShowScanner(false);
    setIsJoining(true);
    setJoinError(null);
    
    try {
      // Connect and sync with the scanned device
      await connectAndSync(data.deviceId, data.accountId);
      
      // Reload people after sync
      await loadPeople();
      
      // Check if user needs to select their name
      if (!selfPersonId) {
        const currentPeople = usePeopleStore.getState().people;
        if (currentPeople.length > 0) {
          setShowSelectName(true);
        } else {
          showError('No group members found. Ask the group creator to add you first.');
        }
      } else {
        showSuccess('Synced successfully!');
      }
    } catch (error) {
      console.error('Join failed:', error);
      setJoinError(error instanceof Error ? error.message : 'Failed to connect');
      showError('Failed to connect. Make sure the other device has the app open.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSelectName = (person: Person) => {
    haptic('success');
    setSelfPersonId(person.id);
    setShowSelectName(false);
    showSuccess(`Welcome, ${person.name}!`);
  };

  // Check if current user hasn't selected their name yet
  const needsNameSelection = currentAccount?.mode === 'shared' && !selfPersonId && people.length > 0;

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 safe-top">
        <h1 className="text-2xl font-bold mb-2">Sync</h1>
        <p className="text-[var(--text-secondary)] text-sm">
          Connect devices to sync expenses in real-time
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(90px+env(safe-area-inset-bottom))]">
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
            accountId={currentAccount?.id ?? ''}
            accountName={currentAccount?.name ?? ''}
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

        {/* Scan QR to Join */}
        <div className="px-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Join Another Device</h2>
          <div className="bg-[var(--white)] rounded-xl p-4">
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Scan a QR code from another device to connect and sync
            </p>
            <Button 
              onClick={handleOpenScanner} 
              variant="secondary" 
              className="w-full"
              loading={isJoining}
            >
              Scan QR Code
            </Button>
          </div>
        </div>

        {/* Prompt to select name if needed */}
        {needsNameSelection && (
          <div className="px-4 mb-6">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <h3 className="font-semibold text-amber-700 mb-2">Select Your Name</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                You haven't selected which person you are in this group yet.
              </p>
              <Button 
                onClick={() => setShowSelectName(true)} 
                size="sm"
                className="w-full"
              >
                Select My Name
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScanned}
          onError={(error) => {
            setJoinError(error);
            showError(error);
          }}
          onCancel={() => setShowScanner(false)}
        />
      )}

      {/* Joining Progress Modal */}
      {isJoining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--white)] rounded-xl p-6 m-4 max-w-sm w-full text-center">
            <div className="w-12 h-12 border-4 border-[var(--teal-green)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="font-semibold mb-2">
              {syncProgress < 30 ? 'Connecting...' : 'Syncing...'}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {syncStatus || 'Please wait...'}
            </p>
            {syncProgress > 0 && (
              <div className="mt-4 bg-[var(--bg)] rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-[var(--teal-green)] transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Select Name Modal */}
      <Modal
        isOpen={showSelectName}
        onClose={() => setShowSelectName(false)}
        title="Select Your Name"
      >
        <div className="p-4">
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Which person are you in this group?
          </p>
          <div className="space-y-2">
            {people.map(person => (
              <button
                key={person.id}
                onClick={() => handleSelectName(person)}
                className="w-full flex items-center gap-3 p-3 bg-[var(--bg)] rounded-xl active:scale-[0.98] transition-transform"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--teal-green)]/10 text-[var(--teal-green)] flex items-center justify-center font-bold">
                  {person.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium">{person.name}</span>
              </button>
            ))}
          </div>
          {people.length === 0 && (
            <p className="text-center text-[var(--text-secondary)] py-4">
              No members found. Ask the group creator to add you.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
