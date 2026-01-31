import { useState } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { useAccountStore } from '@/stores/accountStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { Button, useToast, Modal } from '@/components/ui';
import { QRCode, QRScanner } from '@/components/sync';
import { haptic, copyToClipboard } from '@/lib/utils';
import { useYjs } from '@/sync';
import type { Person } from '@/types';

export function SyncPage() {
  const { deviceId, isConnected, isSynced, connectedPeers, getLastSyncTimeFormatted } = useSyncStore();
  const { connect, setAwareness } = useYjs();

  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const selfPersonId = useAccountStore(s => s.selfPersonId);
  const setSelfPersonId = useAccountStore(s => s.setSelfPersonId);
  
  const people = usePeopleStore(s => s.people);
  
  const { showSuccess, showError } = useToast();

  const [showScanner, setShowScanner] = useState(false);
  const [showSelectName, setShowSelectName] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

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

  // QR Scanner handlers for new member joining
  const handleOpenScanner = () => {
    haptic('light');
    setShowScanner(true);
  };

  const handleQRScanned = async (data: { accountId: string; deviceId: string; accountName: string }) => {
    setShowScanner(false);
    setIsJoining(true);
    
    try {
      // Connect to the room (Yjs will automatically sync)
      const roomName = `expense-tracker-${data.accountId}`;
      connect(roomName);
      
      // Set awareness with our info
      const selfPerson = people.find(p => p.id === selfPersonId);
      setAwareness({
        id: deviceId,
        name: selfPerson?.name || 'Unknown'
      });
      
      // Wait a moment for sync to happen
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if user needs to select their name
      if (!selfPersonId) {
        const currentPeople = usePeopleStore.getState().people;
        if (currentPeople.length > 0) {
          setShowSelectName(true);
        } else {
          showError('No group members found. Ask the group creator to add you first.');
        }
      } else {
        showSuccess('Connected and synced!');
      }
    } catch (error) {
      console.error('Join failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to connect.';
      showError(message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleSelectName = async (person: Person) => {
    // Check if person is already claimed by someone else
    if (person.claimedBy && person.claimedBy !== deviceId) {
      showError('This name is already taken by another device');
      return;
    }
    
    haptic('success');
    
    // Update person with claim (Yjs will sync this automatically)
    // Note: This would need to be done through useYjsSync
    setSelfPersonId(person.id);
    setShowSelectName(false);
    
    // Update awareness with our name
    setAwareness({
      id: deviceId,
      name: person.name
    });
    
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
          Real-time sync with connected devices
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(90px+env(safe-area-inset-bottom))]">
        {/* Status Card */}
        <div className="px-4 mb-6">
          <div className="bg-[var(--white)] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="font-medium">
                {isConnected ? `Connected (${connectedPeers.length} peer${connectedPeers.length !== 1 ? 's' : ''})` : 'Not connected'}
              </span>
            </div>
            
            <div className="text-sm text-[var(--text-secondary)]">
              {isSynced ? (
                <span className="flex items-center gap-2">
                  <span className="text-green-600">Local data synced</span>
                </span>
              ) : (
                <span>Syncing local data...</span>
              )}
            </div>
            
            <div className="text-xs text-[var(--text-secondary)] mt-2">
              Status: {lastSync}
            </div>
            
            {/* Connected peers */}
            {connectedPeers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <div className="text-xs text-[var(--text-secondary)] mb-2">Connected peers:</div>
                <div className="flex flex-wrap gap-2">
                  {connectedPeers.map(peer => (
                    <div 
                      key={peer.id}
                      className="flex items-center gap-2 bg-[var(--bg)] rounded-full px-3 py-1"
                    >
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: peer.color || '#00A884' }}
                      />
                      <span className="text-sm">{peer.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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

        {/* Scan QR to Join */}
        <div className="px-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Join Another Device</h2>
          <div className="bg-[var(--white)] rounded-xl p-4">
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Scan a QR code from another device to connect and sync automatically
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

        {/* Info about automatic sync */}
        <div className="px-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-medium text-blue-800 mb-2">Automatic Sync</h3>
            <p className="text-sm text-blue-700">
              Changes sync automatically in real-time when connected. No manual sync needed!
            </p>
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
            <h3 className="font-semibold mb-2">Connecting...</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Syncing data automatically...
            </p>
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
            {people.map(person => {
              const isClaimed = !!(person.claimedBy && person.claimedBy !== deviceId);
              return (
                <button
                  key={person.id}
                  onClick={() => !isClaimed && handleSelectName(person)}
                  disabled={isClaimed}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-transform ${
                    isClaimed 
                      ? 'bg-gray-100 opacity-60 cursor-not-allowed'
                      : 'bg-[var(--bg)] active:scale-[0.98]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    isClaimed 
                      ? 'bg-gray-200 text-gray-400'
                      : 'bg-[var(--teal-green)]/10 text-[var(--teal-green)]'
                  }`}>
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <span className={`font-medium ${isClaimed ? 'text-gray-400' : ''}`}>
                      {person.name}
                    </span>
                    {isClaimed && (
                      <div className="text-xs text-gray-400">Already taken</div>
                    )}
                  </div>
                </button>
              );
            })}
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
