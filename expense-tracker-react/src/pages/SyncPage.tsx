import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSyncStore } from '@/stores/syncStore';
import { useAccountStore } from '@/stores/accountStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { Button, Input, useToast, Modal } from '@/components/ui';
import { QRCode, QRScanner } from '@/components/sync';
import { haptic, copyToClipboard } from '@/lib/utils';
import { generateInviteUrl, parseInviteInput } from '@/lib/invite';
import { useYjs } from '@/sync';
import type { Person } from '@/types';

type InviteData = { accountId: string; deviceId: string; accountName: string };

export function SyncPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { deviceId, isConnected, isSynced, connectedPeers, getLastSyncTimeFormatted } = useSyncStore();
  const { connect, setAwareness, people: yjsPeople } = useYjs();
  const connectRef = useRef(connect);
  const yjsPeopleRef = useRef(yjsPeople);
  connectRef.current = connect;
  yjsPeopleRef.current = yjsPeople;
  const createAccountWithId = useAccountStore(s => s.createAccountWithId);
  const setCurrentAccount = useAccountStore(s => s.setCurrentAccount);

  const currentAccount = useAccountStore(s => s.getCurrentAccount());

  // Handle join from /join link (navigated with state.joinData)
  useEffect(() => {
    const joinData = (location.state as { joinData?: InviteData })?.joinData;
    if (joinData) {
      navigate(location.pathname, { replace: true, state: {} }); // Clear state
      // Brief delay so SyncPage is mounted with correct Yjs context (account was just switched)
      const t = setTimeout(() => handleJoinWithInviteData(joinData), 100);
      return () => clearTimeout(t);
    }
  }, []);
  const selfPersonId = useAccountStore(s => s.selfPersonId);
  const setSelfPersonId = useAccountStore(s => s.setSelfPersonId);
  
  const people = usePeopleStore(s => s.people);
  
  const { showSuccess, showError } = useToast();

  const [showScanner, setShowScanner] = useState(false);
  const [showSelectName, setShowSelectName] = useState(false);
  const [showPasteInvite, setShowPasteInvite] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
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

  const handleCopyInviteLink = async () => {
    if (currentAccount) {
      const url = generateInviteUrl(currentAccount.id, currentAccount.name);
      const success = await copyToClipboard(url);
      if (success) {
        haptic('success');
        showSuccess('Invite link copied! Share via message or email.');
      }
    }
  };

  const handleJoinWithInviteData = async (data: InviteData) => {
    setIsJoining(true);
    try {
      const isSameAccount = currentAccount?.id === data.accountId;
      if (!isSameAccount) {
        createAccountWithId(data.accountId, data.accountName, 'shared', '$');
        await setCurrentAccount(data.accountId);
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      const roomName = `expense-tracker-${data.accountId}`;
      connectRef.current(roomName);
      setAwareness({ id: deviceId, name: people.find(p => p.id === selfPersonId)?.name || 'Unknown' });
      let attempts = 0;
      while (attempts < 60) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
        const currentPeople = yjsPeopleRef.current.toArray();
        if (currentPeople.length > 0) {
          usePeopleStore.getState().setPeople(currentPeople);
          if (!selfPersonId) setShowSelectName(true);
          else showSuccess('Connected and synced!');
          return;
        }
      }
      showError('No group members found. Make sure the other device has the app open and is showing the QR code.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to connect.');
    } finally {
      setIsJoining(false);
    }
  };

  const handlePasteInvite = async () => {
    const parsed = parseInviteInput(pasteInput);
    if (!parsed) {
      showError('Invalid invite. Paste the link shared by the group creator.');
      return;
    }
    setShowPasteInvite(false);
    setPasteInput('');
    await handleJoinWithInviteData(parsed);
  };

  // QR Scanner handlers for new member joining
  const handleOpenScanner = () => {
    haptic('light');
    setShowScanner(true);
  };

  const handleQRScanned = async (data: InviteData) => {
    setShowScanner(false);
    await handleJoinWithInviteData(data);
  };

  const handleSelectName = async (person: Person) => {
    // Check if person is already claimed by someone else
    if (person.claimedBy && person.claimedBy !== deviceId) {
      showError('This name is already taken by another device');
      return;
    }
    
    haptic('success');
    
    // Claim this person for our device (syncs to Yjs)
    await usePeopleStore.getState().claimPerson(person.id, deviceId);
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
          {currentAccount?.mode === 'shared' && (
            <Button
              variant="secondary"
              className="w-full mt-3"
              onClick={handleCopyInviteLink}
            >
              Copy invite link
            </Button>
          )}
        </div>

        {/* Join Another Device */}
        <div className="px-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Join Another Device or Group</h2>
          <div className="bg-[var(--white)] rounded-xl p-4 space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Scan a QR code or paste an invite link to connect
            </p>
            {showPasteInvite ? (
              <div className="flex gap-2">
                <Input
                  value={pasteInput}
                  onChange={e => setPasteInput(e.target.value)}
                  placeholder="Paste invite link"
                  className="flex-1"
                  onKeyDown={e => e.key === 'Enter' && handlePasteInvite()}
                />
                <Button onClick={handlePasteInvite} disabled={!pasteInput.trim()}>
                  Join
                </Button>
                <Button variant="secondary" onClick={() => setShowPasteInvite(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleOpenScanner}
                  variant="secondary"
                  className="flex-1"
                  loading={isJoining}
                >
                  Scan QR Code
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowPasteInvite(true)}
                  disabled={isJoining}
                >
                  Paste invite link
                </Button>
              </div>
            )}
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
