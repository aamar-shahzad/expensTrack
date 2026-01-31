import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Input, useToast } from '@/components/ui';
import { QRScanner } from '@/components/sync';
import { useAccountStore } from '@/stores/accountStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useYjs } from '@/sync';
import { CURRENCIES } from '@/types';
import { haptic, copyToClipboard } from '@/lib/utils';
import { parseInviteInput, generateInviteUrl } from '@/lib/invite';
import type { Person } from '@/types';

type Step = 
  | 'welcome' 
  | 'mode' 
  | 'name' 
  | 'currency' 
  | 'addPeople'
  | 'invite'
  | 'joinOptions'
  | 'scan'
  | 'connecting'
  | 'connectionFailed'
  | 'selectName';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  // Account store
  const createAccount = useAccountStore(s => s.createAccount);
  const createAccountWithId = useAccountStore(s => s.createAccountWithId);
  const setCurrentAccount = useAccountStore(s => s.setCurrentAccount);
  const setOnboarded = useAccountStore(s => s.setOnboarded);
  const setSelfPersonId = useAccountStore(s => s.setSelfPersonId);
  
  // People store
  const addPerson = usePeopleStore(s => s.addPerson);
  const claimPerson = usePeopleStore(s => s.claimPerson);
  
  // Settings store
  const setCurrency = useSettingsStore(s => s.setCurrency);
  
  // Sync store
  const deviceId = useSyncStore(s => s.deviceId);
  
  // Yjs hook - use refs so async attemptConnection uses latest values after account switch
  const { connect, setAwareness, isConnected, people: yjsPeople } = useYjs();
  const connectRef = useRef(connect);
  const yjsPeopleRef = useRef(yjsPeople);
  connectRef.current = connect;
  yjsPeopleRef.current = yjsPeople;
  
  // Form state
  const [step, setStep] = useState<Step>('welcome');
  const [mode, setMode] = useState<'single' | 'shared'>('single');
  const [accountName, setAccountName] = useState('');
  const [userName, setUserName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('$');
  const [loading, setLoading] = useState(false);
  
  // Add people state
  const [newPersonName, setNewPersonName] = useState('');
  const [addedPeople, setAddedPeople] = useState<string[]>([]);
  
  // Join state
  const [joinAccountName, setJoinAccountName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [syncedPeople, setSyncedPeople] = useState<Person[]>([]);
  const [lastScannedData, setLastScannedData] = useState<{ accountId: string; deviceId: string; accountName: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Load people when we reach selectName step - use Yjs data
  useEffect(() => {
    if (step === 'selectName') {
      // Get people from Yjs
      const currentPeople = yjsPeople.toArray();
      if (currentPeople.length > 0) {
        setSyncedPeople(currentPeople);
      } else {
        // Fallback to store
        setSyncedPeople(usePeopleStore.getState().people);
      }
    }
  }, [step, yjsPeople]);

  // Handle /join?account=xxx&name=yyy URL (e.g. from shared invite link)
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const account = searchParams.get('account');
    const name = searchParams.get('name');
    if (account && step === 'welcome') {
      const parsed = parseInviteInput(`?account=${account}&name=${name || 'Shared Group'}`);
      if (parsed) {
        setJoinAccountName(parsed.accountName);
        setStep('connecting');
        attemptConnection(parsed);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when URL has join params
  }, [searchParams.toString()]);

  const handleModeSelect = (selectedMode: 'single' | 'shared') => {
    haptic('light');
    setMode(selectedMode);
    setStep('name');
  };

  const handleNameNext = () => {
    if (mode === 'shared' && !userName.trim()) {
      showError('Enter your name');
      return;
    }
    if (!accountName.trim()) {
      showError('Enter a name for your account');
      return;
    }
    haptic('light');
    setStep('currency');
  };

  const handleCurrencyNext = async () => {
    haptic('light');
    
    if (mode === 'shared') {
      // For shared mode, go to add people step
      setLoading(true);
      try {
        // Create account first (we are host; hostDeviceId = our deviceId)
        const account = createAccount(
          accountName.trim(),
          'shared',
          selectedCurrency,
          deviceId ?? undefined
        );
        setCurrency(selectedCurrency);
        await setCurrentAccount(account.id);
        
        // Wait for React to re-render and YjsProvider to create the account-specific document
        await new Promise(resolve => setTimeout(resolve, 400));
        
        const roomName = `expense-tracker-${account.id}`;
        const hostDeviceId = account.hostDeviceId ?? deviceId;
        connect(roomName, { deviceId: deviceId ?? '', hostDeviceId });
        
        // Set awareness with our info
        setAwareness({
          id: deviceId,
          name: userName.trim()
        });
        
        // Brief wait for WebRTC connection to establish
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Add self as first person and claim it with our deviceId
        const selfPerson = await addPerson(userName.trim(), deviceId ?? undefined);
        setSelfPersonId(selfPerson.id);
        setAddedPeople([userName.trim()]);
        
        setStep('addPeople');
      } catch (error) {
        console.error('Setup failed:', error);
        showError('Something went wrong');
      } finally {
        setLoading(false);
      }
    } else {
      // For personal mode, complete setup
      await handleCompletePersonal();
    }
  };

  const handleCompletePersonal = async () => {
    setLoading(true);
    haptic('light');
    
    try {
      const account = createAccount(
        accountName.trim() || 'My Expenses',
        'single',
        selectedCurrency
      );
      setCurrency(selectedCurrency);
      await setCurrentAccount(account.id);
      
      setOnboarded(true);
      haptic('success');
      showSuccess('All set!');
      navigate('/');
    } catch (error) {
      console.error('Onboarding failed:', error);
      showError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPerson = async () => {
    const name = newPersonName.trim();
    if (!name) {
      showError('Enter a name');
      return;
    }
    if (addedPeople.includes(name)) {
      showError('This person is already added');
      return;
    }
    
    haptic('light');
    try {
      await addPerson(name);
      setAddedPeople([...addedPeople, name]);
      setNewPersonName('');
    } catch (error) {
      showError('Failed to add person');
    }
  };

  const handleFinishAddingPeople = () => {
    haptic('light');
    setStep('invite');
  };

  const handleCompleteShared = () => {
    setOnboarded(true);
    haptic('success');
    showSuccess('All set!');
    navigate('/');
  };

  // Join flow handlers
  const handleStartJoin = () => {
    haptic('light');
    setStep('joinOptions');
  };

  const [pasteInput, setPasteInput] = useState('');

  const handlePasteInvite = async () => {
    const parsed = parseInviteInput(pasteInput);
    if (!parsed) {
      showError('Invalid invite. Paste the link or code shared by the group creator.');
      return;
    }
    haptic('light');
    setPasteInput('');
    setJoinAccountName(parsed.accountName);
    await attemptConnection(parsed);
  };

  const handleQRScanned = async (data: { accountId: string; deviceId: string; accountName: string }) => {
    haptic('success');
    setLastScannedData(data);
    setJoinAccountName(data.accountName);
    setJoinError(null);
    await attemptConnection(data);
  };

  const attemptConnection = async (data: { accountId: string; deviceId: string; accountName: string }) => {
    setStep('connecting');
    
    try {
      // Create account with the same ID as the group (hostDeviceId = creator so we connect to them)
      createAccountWithId(
        data.accountId,
        data.accountName,
        'shared',
        '$',
        data.deviceId
      );
      await setCurrentAccount(data.accountId);
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const roomName = `expense-tracker-${data.accountId}`;
      connectRef.current(roomName, { deviceId: deviceId ?? '', hostDeviceId: data.deviceId });
      
      // Set awareness
      setAwareness({
        id: deviceId,
        name: 'New User'
      });
      
      // Wait for WebRTC connection and CRDT sync - poll for people data
      // Use ref to read from the correct (new) document's people array
      let attempts = 0;
      const maxAttempts = 60; // ~30 seconds max (WebRTC can be slow on mobile/cross-network)
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
        
        // Check if we have people data from Yjs (synced from creator)
        const currentPeople = yjsPeopleRef.current.toArray();
        if (currentPeople.length > 0) {
          setSyncedPeople(currentPeople);
          setRetryCount(0);
          setStep('selectName');
          return;
        }
      }
      
      // If we get here, no people were synced
      setJoinError('No group members found. Make sure the other device has the app open and is showing the QR code.');
      setStep('connectionFailed');
    } catch (error) {
      console.error('Join failed:', error);
      setJoinError(error instanceof Error ? error.message : 'Failed to connect');
      setRetryCount(prev => prev + 1);
      setStep('connectionFailed');
    }
  };

  const handleRetry = async () => {
    if (!lastScannedData) {
      setStep('scan');
      return;
    }
    haptic('light');
    setJoinError(null);
    await attemptConnection(lastScannedData);
  };

  const handleScanAgain = () => {
    haptic('light');
    setLastScannedData(null);
    setJoinError(null);
    setRetryCount(0);
    setStep('scan');
  };

  const handleQRError = (error: string) => {
    setJoinError(error);
  };

  const handleSelectName = async (person: Person) => {
    // Check if person is already claimed by someone else
    if (person.claimedBy && person.claimedBy !== deviceId) {
      showError('This name is already taken by another device');
      return;
    }
    
    haptic('success');
    
    // Claim this person for our device
    if (deviceId) {
      await claimPerson(person.id, deviceId);
    }
    
    setSelfPersonId(person.id);
    setOnboarded(true);
    showSuccess(`Welcome, ${person.name}!`);
    navigate('/');
  };

  // Generate QR data for invite
  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const qrData = currentAccount && deviceId 
    ? `et:${currentAccount.id}:${deviceId}:${currentAccount.name}`
    : '';

  return (
    <div className="min-h-screen h-full bg-[var(--bg)] flex flex-col safe-top safe-bottom">
      {/* Welcome Step */}
      {step === 'welcome' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-0 overflow-y-auto">
            <div className="text-6xl mb-6">💰</div>
            <h1 className="text-3xl font-bold mb-3">Expense Tracker</h1>
            <p className="text-[var(--text-secondary)] mb-6 max-w-xs">
              Track spending, split bills, and sync with friends - all offline-first
            </p>
          </div>
          <div className="flex-shrink-0 p-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] bg-[var(--bg)] w-full max-w-xs mx-auto self-center">
            <div className="space-y-3">
              <Button onClick={() => setStep('mode')} className="w-full min-h-[48px] text-base">
                Create Account
              </Button>
              <Button
                variant="secondary"
                onClick={handleStartJoin}
                className="w-full min-h-[48px] text-base"
              >
                Join Existing Group
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mode Selection */}
      {step === 'mode' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <button
            onClick={() => setStep('welcome')}
            className="text-[var(--teal-green)] mb-4 self-start py-2 -my-2 min-h-[44px] flex items-center"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold mb-2">How will you use this?</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            You can change this later
          </p>
          <div className="space-y-4">
            <button
              onClick={() => handleModeSelect('single')}
              className="w-full p-5 min-h-[80px] bg-[var(--white)] rounded-xl text-left active:scale-[0.98] transition-transform flex items-center gap-4"
            >
              <span className="text-3xl">👤</span>
              <div>
                <div className="font-semibold text-lg mb-0.5">Personal</div>
                <div className="text-[var(--text-secondary)] text-sm">
                  Track your own expenses
                </div>
              </div>
            </button>
            <button
              onClick={() => handleModeSelect('shared')}
              className="w-full p-5 min-h-[80px] bg-[var(--white)] rounded-xl text-left active:scale-[0.98] transition-transform flex items-center gap-4"
            >
              <span className="text-3xl">👥</span>
              <div>
                <div className="font-semibold text-lg mb-0.5">Shared</div>
                <div className="text-[var(--text-secondary)] text-sm">
                  Split expenses with roommates, partners, or groups
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Name Step */}
      {step === 'name' && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6">
            <button
              onClick={() => setStep('mode')}
              className="text-[var(--teal-green)] mb-4 self-start py-2 -my-2 min-h-[44px] flex items-center"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold mb-6">
              {mode === 'shared' ? 'Set up your group' : 'Name your account'}
            </h1>
            <div className="space-y-4">
              {mode === 'shared' && (
                <Input
                  label="Your Name"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  placeholder="What should we call you?"
                  autoFocus
                />
              )}
              <Input
                label={mode === 'shared' ? 'Group Name' : 'Account Name'}
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                placeholder={mode === 'shared' ? 'e.g., Apartment, Trip to Paris' : 'e.g., My Expenses'}
                autoFocus={mode === 'single'}
              />
            </div>
          </div>
          <div className="flex-shrink-0 p-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] bg-[var(--bg)]">
            <Button onClick={handleNameNext} className="w-full min-h-[48px] text-base">
              Continue
            </Button>
          </div>
        </>
      )}

      {/* Currency Step */}
      {step === 'currency' && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6">
            <button
              onClick={() => setStep('name')}
              className="text-[var(--teal-green)] mb-4 self-start py-2 -my-2 min-h-[44px] flex items-center"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold mb-2">Choose your currency</h1>
            <p className="text-[var(--text-secondary)] mb-6">
              You can change this later in settings
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {CURRENCIES.slice(0, 6).map(curr => (
                <button
                  key={curr.code}
                  onClick={() => { haptic('light'); setSelectedCurrency(curr.symbol); }}
                  className={`p-4 min-h-[72px] rounded-xl text-left transition-all active:scale-[0.98] ${
                    selectedCurrency === curr.symbol
                      ? 'bg-[var(--teal-green)] text-white'
                      : 'bg-[var(--white)]'
                  }`}
                >
                  <div className="text-2xl mb-1">{curr.symbol}</div>
                  <div className="text-sm font-medium">{curr.code}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 p-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] bg-[var(--bg)]">
            <Button onClick={handleCurrencyNext} loading={loading} className="w-full min-h-[48px] text-base">
              {mode === 'shared' ? 'Continue' : 'Complete Setup'}
            </Button>
          </div>
        </>
      )}

      {/* Add People Step (Shared mode only) */}
      {step === 'addPeople' && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6">
            <button
              onClick={() => setStep('currency')}
              className="text-[var(--teal-green)] mb-4 self-start py-2 -my-2 min-h-[44px] flex items-center"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold mb-2">Add group members</h1>
            <p className="text-[var(--text-secondary)] mb-6">
              Add everyone who will share expenses. They can join later by scanning a QR code.
            </p>
            <div className="mb-4">
              <div className="text-sm text-[var(--text-secondary)] mb-2">Members ({addedPeople.length})</div>
              <div className="space-y-2">
                {addedPeople.map((name, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-[var(--white)] rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-[var(--teal-green)]/10 text-[var(--teal-green)] flex items-center justify-center font-bold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{name}</span>
                    {i === 0 && (
                      <span className="ml-auto text-xs text-[var(--teal-green)] bg-[var(--teal-green)]/10 px-2 py-1 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <Input
                value={newPersonName}
                onChange={e => setNewPersonName(e.target.value)}
                placeholder="Enter name"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && handleAddPerson()}
              />
              <Button onClick={handleAddPerson} variant="secondary" className="min-h-[48px]">
                Add
              </Button>
            </div>
          </div>
          <div className="flex-shrink-0 p-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] bg-[var(--bg)]">
            <Button
              onClick={handleFinishAddingPeople}
              className="w-full min-h-[48px] text-base"
              disabled={addedPeople.length < 2}
            >
              Continue
            </Button>
            {addedPeople.length < 2 && (
              <p className="text-center text-sm text-[var(--text-secondary)] mt-2">
                Add at least one more person
              </p>
            )}
          </div>
        </>
      )}

      {/* Invite Step (Show QR code) */}
      {step === 'invite' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6">
            <h1 className="text-2xl font-bold mb-2">Invite your group</h1>
            <p className="text-[var(--text-secondary)] mb-6">
              Others can scan the QR code or use the invite link to join
            </p>
            <div className="bg-[var(--white)] rounded-xl p-6 mb-4">
              <div className="flex justify-center mb-4">
                {qrData && (
                  <div className="p-4 bg-white rounded-xl">
                    <QRCodeSVG value={qrData} size={200} />
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-sm text-[var(--text-secondary)] mb-1">Your device code</div>
                <div className="text-2xl font-mono font-bold tracking-widest">{deviceId}</div>
              </div>
            </div>
            {currentAccount && (
              <div className="mb-6 space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  Invite link for <strong>{currentAccount.name}</strong>
                </p>
                <Input
                  readOnly
                  value={generateInviteUrl(currentAccount.id, currentAccount.name, currentAccount.hostDeviceId ?? deviceId ?? undefined)}
                  className="text-sm font-mono"
                  aria-label="Invite URL for this account"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1 min-h-[44px]"
                    onClick={async () => {
                      const url = generateInviteUrl(currentAccount.id, currentAccount.name, currentAccount.hostDeviceId ?? deviceId ?? undefined);
                      const success = await copyToClipboard(url);
                      if (success) {
                        haptic('success');
                        showSuccess('Invite link copied! Share it via message or email.');
                      } else {
                        showError('Could not copy. Try selecting and copying the link above.');
                      }
                    }}
                  >
                    Copy link
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1 min-h-[44px]"
                    onClick={async () => {
                      try {
                        const url = generateInviteUrl(currentAccount.id, currentAccount.name, currentAccount.hostDeviceId ?? deviceId ?? undefined);
                        const success = await copyToClipboard(url);
                        if (success) {
                          haptic('success');
                          showSuccess('Link regenerated and copied. Share the new link.');
                        } else {
                          haptic('error');
                          showError('Could not copy. Try selecting and copying the link above.');
                        }
                      } catch {
                        haptic('error');
                        showError('Could not copy link.');
                      }
                    }}
                  >
                    Regenerate link
                  </Button>
                </div>
              </div>
            )}
            <div className="bg-[var(--teal-green)]/10 rounded-xl p-4 mb-4">
              <div className="text-sm">
                <strong>How to join:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1 text-[var(--text-secondary)]">
                  <li>Open the app on another device</li>
                  <li>Tap "Join Existing Group"</li>
                  <li>Scan the QR code or paste the invite link</li>
                  <li>Select their name from the list</li>
                </ol>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 p-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] bg-[var(--bg)] border-t border-[var(--border)]/50">
            <Button onClick={handleCompleteShared} className="w-full min-h-[48px] text-base">
              Done
            </Button>
            <p className="text-center text-sm text-[var(--text-secondary)] mt-2">
              You can invite more people later from the Sync page
            </p>
          </div>
        </div>
      )}

      {/* Join options: paste link or scan QR */}
      {step === 'joinOptions' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <button
              onClick={() => { setStep('welcome'); setJoinError(null); }}
              className="text-[var(--teal-green)] mb-4 self-start py-2 -my-2 min-h-[44px] flex items-center"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold mb-2">Join a group</h1>
            <p className="text-[var(--text-secondary)] mb-6">
              Paste the invite link shared by the group creator, or scan their QR code
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                  Paste invite link or code
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={pasteInput}
                    onChange={e => setPasteInput(e.target.value)}
                    placeholder="Paste link or et:... code"
                    className="flex-1 min-h-[48px]"
                    onKeyDown={e => e.key === 'Enter' && handlePasteInvite()}
                  />
                  <Button
                    onClick={handlePasteInvite}
                    disabled={!pasteInput.trim()}
                    className="min-h-[48px] text-base sm:flex-shrink-0"
                  >
                    Join
                  </Button>
                </div>
              </div>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--border)]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[var(--bg)] px-4 text-sm text-[var(--text-secondary)]">or</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 p-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] bg-[var(--bg)] border-t border-[var(--border)]/50">
            <Button
              variant="secondary"
              className="w-full min-h-[48px] text-base"
              onClick={() => { setJoinError(null); setStep('scan'); }}
            >
              Scan QR Code
            </Button>
          </div>
        </div>
      )}

      {/* QR Scanner Step */}
      {step === 'scan' && (
        <>
          {joinError && (
            <div className="fixed top-0 left-0 right-0 bg-[var(--danger)] text-white p-4 text-center z-40 safe-top">
              {joinError}
            </div>
          )}
          <QRScanner
            onScan={handleQRScanned}
            onError={handleQRError}
            onCancel={() => {
              setJoinError(null);
              setStep('joinOptions');
            }}
          />
        </>
      )}

      {/* Connecting Step */}
      {step === 'connecting' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 border-4 border-[var(--teal-green)] border-t-transparent rounded-full animate-spin mb-6" />
          <h1 className="text-2xl font-bold mb-2">
            {isConnected ? 'Syncing...' : 'Connecting...'}
          </h1>
          <p className="text-[var(--text-secondary)] mb-4">
            {`Joining ${joinAccountName}`}
          </p>
          {isConnected && (
            <div className="text-sm text-[var(--teal-green)]">
              Connected! Syncing data...
            </div>
          )}
        </div>
      )}

      {/* Connection Failed Step */}
      {step === 'connectionFailed' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-0 overflow-y-auto">
            <div className="text-6xl mb-6">😕</div>
            <h1 className="text-2xl font-bold mb-2">Connection Failed</h1>
            <p className="text-[var(--text-secondary)] mb-2 max-w-xs">
              {joinError || 'Could not connect to the other device.'}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-xs">
              Make sure the other device has the app open and is showing the QR code.
            </p>
            {retryCount >= 3 && (
              <p className="text-sm text-[var(--text-secondary)] max-w-xs">
                Multiple connection attempts failed. Try scanning a new QR code or check your internet connection.
              </p>
            )}
          </div>
          <div className="flex-shrink-0 p-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] bg-[var(--bg)] w-full max-w-xs mx-auto">
            <div className="space-y-3">
              {lastScannedData && retryCount < 3 && (
                <Button onClick={handleRetry} className="w-full min-h-[48px] text-base">
                  Try Again
                </Button>
              )}
              <Button
                variant={lastScannedData && retryCount < 3 ? 'secondary' : 'primary'}
                onClick={handleScanAgain}
                className="w-full min-h-[48px] text-base"
              >
                Scan QR Code Again
              </Button>
              <button
                onClick={() => {
                  setLastScannedData(null);
                  setJoinError(null);
                  setRetryCount(0);
                  setStep('welcome');
                }}
                className="w-full block py-3 text-[var(--text-secondary)] text-base min-h-[44px] active:opacity-80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Name Step */}
      {step === 'selectName' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6">
            <h1 className="text-2xl font-bold mb-2">Select your name</h1>
            <p className="text-[var(--text-secondary)] mb-4">
              {syncedPeople.length > 0
                ? 'You must select your name to complete joining the group'
                : 'No members found. Ask the group creator to add you first.'}
            </p>
            {syncedPeople.length > 0 ? (
              <>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400 text-center">
                    Select your name from the list below to continue
                  </p>
                </div>
                <div className="space-y-3 pb-4">
                  {syncedPeople.map(person => {
                    const isClaimed = !!(person.claimedBy && person.claimedBy !== deviceId);
                    return (
                      <button
                        key={person.id}
                        onClick={() => !isClaimed && handleSelectName(person)}
                        disabled={isClaimed}
                        className={`w-full flex items-center gap-3 p-4 min-h-[64px] rounded-xl transition-transform border-2 ${
                          isClaimed
                            ? 'bg-[var(--border)]/50 border-transparent opacity-60 cursor-not-allowed'
                            : 'bg-[var(--white)] border-transparent hover:border-[var(--teal-green)] active:scale-[0.98]'
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${
                            isClaimed
                              ? 'bg-[var(--border)] text-[var(--text-secondary)]'
                              : 'bg-[var(--teal-green)]/10 text-[var(--teal-green)]'
                          }`}
                        >
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left">
                          <span className={`font-medium text-lg ${isClaimed ? 'text-[var(--text-secondary)]' : ''}`}>
                            {person.name}
                          </span>
                          {isClaimed && (
                            <div className="text-xs text-[var(--text-secondary)]">Already taken</div>
                          )}
                        </div>
                        {!isClaimed && (
                          <span className="text-[var(--teal-green)] text-sm shrink-0">Tap to select</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <div className="text-5xl mb-4">🤷</div>
                <p className="text-[var(--text-secondary)] text-center mb-6">
                  Your name isn't in the group yet.<br />
                  Ask the group creator to add you.
                </p>
                <Button
                  variant="secondary"
                  className="min-h-[48px] text-base"
                  onClick={() => {
                    setStep('welcome');
                    setJoinError(null);
                  }}
                >
                  Go Back
                </Button>
              </div>
            )}
          </div>
          {syncedPeople.length > 0 && (
            <div className="flex-shrink-0 p-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] bg-[var(--bg)] border-t border-[var(--border)]/50">
              <p className="text-center text-sm text-[var(--text-secondary)] mb-3">
                Don't see your name? Ask the group creator to add you, then scan again.
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setStep('scan');
                  setJoinError(null);
                }}
                className="w-full min-h-[48px] text-base"
              >
                Scan Again
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
