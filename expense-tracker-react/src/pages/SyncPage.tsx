import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useSyncStore } from '@/stores/syncStore';
import { useAccountStore } from '@/stores/accountStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { Button, Input, useToast, Modal } from '@/components/ui';
import { QRScanner } from '@/components/sync';
import { useSyncActions } from '@/contexts/SyncActionsContext';
import { haptic, copyToClipboard } from '@/lib/utils';
import { generateInviteUrl, parseInviteInput } from '@/lib/invite';
import { useYjs } from '@/sync';
import type { Person } from '@/types';

type InviteData = { accountId: string; deviceId: string; accountName: string };

export function SyncPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { deviceId, isConnected, isSynced, connectedPeers } = useSyncStore();
  const syncActions = useSyncActions();
  const { connect, setAwareness, people: yjsPeople } = useYjs();
  const connectRef = useRef(connect);
  const yjsPeopleRef = useRef(yjsPeople);
  connectRef.current = connect;
  yjsPeopleRef.current = yjsPeople;
  const createAccountWithId = useAccountStore(s => s.createAccountWithId);
  const setCurrentAccount = useAccountStore(s => s.setCurrentAccount);
  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const selfPersonId = useAccountStore(s => s.selfPersonId);
  const setSelfPersonId = useAccountStore(s => s.setSelfPersonId);
  const people = usePeopleStore(s => s.people);
  const { showSuccess, showError } = useToast();

  const [showScanner, setShowScanner] = useState(false);
  const [showSelectName, setShowSelectName] = useState(false);
  const [showPasteInvite, setShowPasteInvite] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Handle join from /join link (navigated with state.joinData)
  useEffect(() => {
    const joinData = (location.state as { joinData?: InviteData })?.joinData;
    if (joinData) {
      navigate(location.pathname, { replace: true, state: {} });
      const t = setTimeout(() => handleJoinWithInviteData(joinData), 100);
      return () => clearTimeout(t);
    }
  }, []);

  const inviteUrl = currentAccount
    ? generateInviteUrl(currentAccount.id, currentAccount.name, currentAccount.hostDeviceId ?? deviceId ?? undefined)
    : '';

  const handleCopyCode = async () => {
    if (deviceId) {
      const ok = await copyToClipboard(deviceId);
      if (ok) {
        haptic('success');
        showSuccess('Code copied!');
      }
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) return;
    const ok = await copyToClipboard(inviteUrl);
    if (ok) {
      haptic('success');
      showSuccess('Invite link copied!');
    } else {
      showError('Could not copy. Try selecting the link.');
    }
  };

  const handleRegenerateInviteLink = async () => {
    if (!currentAccount) return;
    const url = generateInviteUrl(currentAccount.id, currentAccount.name, currentAccount.hostDeviceId ?? deviceId ?? undefined);
    const ok = await copyToClipboard(url);
    if (ok) {
      haptic('success');
      showSuccess('Link copied!');
    } else {
      showError('Could not copy.');
    }
  };

  const handleJoinWithInviteData = async (data: InviteData) => {
    setIsJoining(true);
    try {
      const isSameAccount = currentAccount?.id === data.accountId;
      if (!isSameAccount) {
        createAccountWithId(data.accountId, data.accountName, 'shared', '$', data.deviceId);
        await setCurrentAccount(data.accountId);
        await new Promise(r => setTimeout(r, 400));
      }
      const roomName = `expense-tracker-${data.accountId}`;
      const hostDeviceId = data.deviceId || currentAccount?.hostDeviceId || deviceId;
      connectRef.current(roomName, { deviceId: deviceId ?? '', hostDeviceId });
      setAwareness({ id: deviceId, name: people.find(p => p.id === selfPersonId)?.name || 'Unknown' });
      let attempts = 0;
      while (attempts < 60) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
        const currentPeople = yjsPeopleRef.current.toArray();
        if (currentPeople.length > 0) {
          usePeopleStore.getState().setPeople(currentPeople);
          if (!selfPersonId) setShowSelectName(true);
          else showSuccess('Connected!');
          return;
        }
      }
      showError('No group members found. Keep the other device open on the Sync screen.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to connect.');
    } finally {
      setIsJoining(false);
    }
  };

  const handlePasteInvite = async () => {
    const parsed = parseInviteInput(pasteInput);
    if (!parsed) {
      showError('Invalid invite. Paste the link from the group creator.');
      return;
    }
    setShowPasteInvite(false);
    setPasteInput('');
    await handleJoinWithInviteData(parsed);
  };

  const handleOpenScanner = () => {
    haptic('light');
    setShowScanner(true);
  };

  const handleQRScanned = async (data: InviteData) => {
    setShowScanner(false);
    await handleJoinWithInviteData(data);
  };

  const handleSelectName = async (person: Person) => {
    if (person.claimedBy && person.claimedBy !== deviceId) {
      showError('This name is already taken.');
      return;
    }
    haptic('success');
    await usePeopleStore.getState().claimPerson(person.id, deviceId);
    setSelfPersonId(person.id);
    setShowSelectName(false);
    setAwareness({ id: deviceId, name: person.name });
    showSuccess(`Welcome, ${person.name}!`);
  };

  const needsNameSelection = currentAccount?.mode === 'shared' && !selfPersonId && people.length > 0;
  const isShared = currentAccount?.mode === 'shared';

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header – same compact style as Home */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 safe-top">
        <h1 className="text-[17px] font-semibold mb-0.5">Sync</h1>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {isShared ? 'Share or join a group' : 'Create a shared group to sync with others'}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(80px+env(safe-area-inset-bottom))]">
        {/* Status – one card, same style as Home summary */}
        <div className="px-4 mb-3">
          <div className="bg-[var(--white)] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isConnected ? 'bg-[var(--teal-green)] animate-pulse' : 'bg-[var(--text-secondary)]/50'
                  }`}
                />
                <span className="font-medium text-[15px]">
                  {isConnected ? `Connected (${connectedPeers.length} peer${connectedPeers.length !== 1 ? 's' : ''})` : 'Not connected'}
                </span>
              </div>
              {isShared && !isConnected && syncActions?.retryConnection && (
                <button
                  type="button"
                  onClick={() => syncActions.retryConnection()}
                  className="text-[13px] font-medium text-[var(--teal-green)] active:opacity-80"
                >
                  Retry
                </button>
              )}
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">
              {isSynced ? 'Local data synced' : 'Loading local data…'}
            </p>
            {connectedPeers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap gap-2">
                {connectedPeers.map(peer => (
                  <span
                    key={peer.id}
                    className="inline-flex items-center gap-1.5 bg-[var(--bg)] rounded-full px-2.5 py-1 text-[12px] text-[var(--text-secondary)]"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: peer.color || 'var(--teal-green)' }}
                    />
                    {peer.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Your code & invite – single card for shared */}
        <div className="px-4 mb-3">
          <div className="bg-[var(--white)] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[13px] text-[var(--text-secondary)]">Your code</span>
              <Button size="sm" variant="secondary" onClick={handleCopyCode}>
                Copy
              </Button>
            </div>
            <p className="text-2xl font-mono font-bold tracking-widest text-[var(--text)]">
              {deviceId}
            </p>
            {isShared && (
              <>
                <p className="text-[12px] text-[var(--text-secondary)] mt-3 mb-2">
                  Invite link for <strong className="text-[var(--text)]">{currentAccount?.name}</strong>
                </p>
                <Input
                  readOnly
                  value={inviteUrl}
                  className="text-[12px] font-mono text-[var(--text-secondary)]"
                  aria-label="Invite URL"
                />
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={handleCopyInviteLink}>
                    Copy link
                  </Button>
                  <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={handleRegenerateInviteLink}>
                    New link
                  </Button>
                </div>
                {/* Show QR for others to scan */}
                <div className="mt-4 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setShowQR(prev => !prev)}
                    className="text-[13px] font-medium text-[var(--teal-green)] active:opacity-80"
                  >
                    {showQR ? 'Hide QR code' : 'Show QR code'}
                  </button>
                  {showQR && currentAccount && (
                    <div className="mt-3 flex justify-center p-3 bg-[var(--bg)] rounded-xl">
                      <QRCodeSVG
                        value={`et:${currentAccount.id}:${deviceId}:${currentAccount.name}`}
                        size={180}
                        level="M"
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Join – one card */}
        <div className="px-4 mb-3">
          <div className="bg-[var(--white)] rounded-xl p-4 shadow-sm">
            <p className="text-[13px] text-[var(--text-secondary)] mb-3">
              Scan a QR code or paste an invite link to join a group
            </p>
            {showPasteInvite ? (
              <div className="flex flex-col gap-2">
                <Input
                  value={pasteInput}
                  onChange={e => setPasteInput(e.target.value)}
                  placeholder="Paste invite link"
                  className="text-[14px]"
                  onKeyDown={e => e.key === 'Enter' && handlePasteInvite()}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handlePasteInvite} disabled={!pasteInput.trim()}>
                    Join
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setShowPasteInvite(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={handleOpenScanner}
                  disabled={isJoining}
                >
                  Scan QR
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowPasteInvite(true)}
                  disabled={isJoining}
                >
                  Paste link
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Select name – only when needed */}
        {needsNameSelection && (
          <div className="px-4 mb-3">
            <div className="bg-[var(--white)] rounded-xl p-4 shadow-sm border border-[var(--teal-green)]/20">
              <p className="text-[13px] text-[var(--text-secondary)] mb-3">
                Choose which person you are in this group
              </p>
              <Button size="sm" className="w-full" onClick={() => setShowSelectName(true)}>
                Select my name
              </Button>
            </div>
          </div>
        )}
      </div>

      {showScanner && (
        <QRScanner
          onScan={handleQRScanned}
          onError={showError}
          onCancel={() => setShowScanner(false)}
        />
      )}

      {isJoining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 safe-area-inset">
          <div className="bg-[var(--white)] rounded-xl p-6 m-4 max-w-sm w-full text-center">
            <div className="w-10 h-10 border-2 border-[var(--teal-green)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="font-medium text-[15px]">Connecting…</p>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">Syncing with group</p>
          </div>
        </div>
      )}

      <Modal isOpen={showSelectName} onClose={() => setShowSelectName(false)} title="Select your name">
        <div className="p-4">
          <p className="text-[13px] text-[var(--text-secondary)] mb-4">
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
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-transform active:scale-[0.99] ${
                    isClaimed ? 'bg-[var(--border)]/50 opacity-60 cursor-not-allowed' : 'bg-[var(--bg)]'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[15px] ${
                      isClaimed ? 'bg-[var(--border)] text-[var(--text-secondary)]' : 'bg-[var(--teal-green)]/15 text-[var(--teal-green)]'
                    }`}
                  >
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <span className={`font-medium text-[15px] ${isClaimed ? 'text-[var(--text-secondary)]' : ''}`}>
                      {person.name}
                    </span>
                    {isClaimed && (
                      <p className="text-[12px] text-[var(--text-secondary)]">Already taken</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {people.length === 0 && (
            <p className="text-center text-[var(--text-secondary)] text-[13px] py-4">
              No members yet. Ask the creator to add people.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
