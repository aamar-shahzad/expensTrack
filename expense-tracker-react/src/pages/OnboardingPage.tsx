import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Input, useToast } from '@/components/ui';
import { QRScanner } from '@/components/sync';
import { useAccountStore } from '@/stores/accountStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useSync } from '@/hooks/useSync';
import { CURRENCIES } from '@/types';
import { haptic } from '@/lib/utils';
import type { Person } from '@/types';

type Step = 
  | 'welcome' 
  | 'mode' 
  | 'name' 
  | 'currency' 
  | 'addPeople'
  | 'invite'
  | 'scan'
  | 'connecting'
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
  const loadPeople = usePeopleStore(s => s.loadPeople);
  
  // Settings store
  const setCurrency = useSettingsStore(s => s.setCurrency);
  
  // Sync store
  const deviceId = useSyncStore(s => s.deviceId);
  const syncProgress = useSyncStore(s => s.syncProgress);
  const syncStatus = useSyncStore(s => s.syncStatus);
  
  // Sync hook
  const { connectAndSync } = useSync();
  
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

  // Load people when we reach selectName step
  useEffect(() => {
    if (step === 'selectName') {
      loadPeople().then(() => {
        setSyncedPeople(usePeopleStore.getState().people);
      });
    }
  }, [step, loadPeople]);

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
        // Create account first
        const account = createAccount(
          accountName.trim(),
          'shared',
          selectedCurrency
        );
        setCurrency(selectedCurrency);
        await setCurrentAccount(account.id);
        
        // Add self as first person
        const selfPerson = await addPerson(userName.trim());
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
    setStep('scan');
  };

  const handleQRScanned = async (data: { accountId: string; deviceId: string; accountName: string }) => {
    haptic('success');
    setJoinAccountName(data.accountName);
    setJoinError(null);
    setStep('connecting');
    
    try {
      // Create account with the same ID as the group
      const account = createAccountWithId(
        data.accountId,
        data.accountName,
        'shared',
        '$' // Will be updated from synced data
      );
      await setCurrentAccount(account.id);
      
      // Connect and sync
      await connectAndSync(data.deviceId, data.accountId);
      
      // Load synced people
      await loadPeople();
      const syncedPeopleList = usePeopleStore.getState().people;
      setSyncedPeople(syncedPeopleList);
      
      if (syncedPeopleList.length === 0) {
        setJoinError('No group members found. Ask the group creator to add you first.');
        setStep('scan');
        return;
      }
      
      setStep('selectName');
    } catch (error) {
      console.error('Join failed:', error);
      setJoinError(error instanceof Error ? error.message : 'Failed to connect');
      setStep('scan');
    }
  };

  const handleQRError = (error: string) => {
    setJoinError(error);
  };

  const handleSelectName = (person: Person) => {
    haptic('success');
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
    <div className="min-h-screen bg-[var(--bg)] flex flex-col safe-top safe-bottom">
      {/* Welcome Step */}
      {step === 'welcome' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-6xl mb-6">💰</div>
          <h1 className="text-3xl font-bold mb-3">Expense Tracker</h1>
          <p className="text-[var(--text-secondary)] mb-8 max-w-xs">
            Track spending, split bills, and sync with friends - all offline-first
          </p>
          
          <div className="w-full max-w-xs space-y-3">
            <Button onClick={() => setStep('mode')} className="w-full">
              Create Account
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleStartJoin} 
              className="w-full"
            >
              Join Existing Group
            </Button>
          </div>
        </div>
      )}

      {/* Mode Selection */}
      {step === 'mode' && (
        <div className="flex-1 flex flex-col p-6">
          <button
            onClick={() => setStep('welcome')}
            className="text-[var(--teal-green)] mb-4 self-start"
          >
            ← Back
          </button>
          
          <h1 className="text-2xl font-bold mb-2">How will you use this?</h1>
          <p className="text-[var(--text-secondary)] mb-8">
            You can change this later
          </p>
          
          <div className="space-y-4">
            <button
              onClick={() => handleModeSelect('single')}
              className="w-full p-6 bg-[var(--white)] rounded-xl text-left active:scale-[0.98] transition-transform"
            >
              <div className="text-3xl mb-2">👤</div>
              <div className="font-semibold text-lg mb-1">Personal</div>
              <div className="text-[var(--text-secondary)] text-sm">
                Track your own expenses
              </div>
            </button>
            
            <button
              onClick={() => handleModeSelect('shared')}
              className="w-full p-6 bg-[var(--white)] rounded-xl text-left active:scale-[0.98] transition-transform"
            >
              <div className="text-3xl mb-2">👥</div>
              <div className="font-semibold text-lg mb-1">Shared</div>
              <div className="text-[var(--text-secondary)] text-sm">
                Split expenses with roommates, partners, or groups
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Name Step */}
      {step === 'name' && (
        <div className="flex-1 flex flex-col p-6">
          <button
            onClick={() => setStep('mode')}
            className="text-[var(--teal-green)] mb-4 self-start"
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
          
          <div className="mt-auto pt-6">
            <Button onClick={handleNameNext} className="w-full">
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Currency Step */}
      {step === 'currency' && (
        <div className="flex-1 flex flex-col p-6">
          <button
            onClick={() => setStep('name')}
            className="text-[var(--teal-green)] mb-4 self-start"
          >
            ← Back
          </button>
          
          <h1 className="text-2xl font-bold mb-2">Choose your currency</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            You can change this later in settings
          </p>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            {CURRENCIES.slice(0, 6).map(curr => (
              <button
                key={curr.code}
                onClick={() => { haptic('light'); setSelectedCurrency(curr.symbol); }}
                className={`p-4 rounded-xl text-left transition-all ${
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
          
          <div className="mt-auto">
            <Button onClick={handleCurrencyNext} loading={loading} className="w-full">
              {mode === 'shared' ? 'Continue' : 'Complete Setup'}
            </Button>
          </div>
        </div>
      )}

      {/* Add People Step (Shared mode only) */}
      {step === 'addPeople' && (
        <div className="flex-1 flex flex-col p-6">
          <button
            onClick={() => setStep('currency')}
            className="text-[var(--teal-green)] mb-4 self-start"
          >
            ← Back
          </button>
          
          <h1 className="text-2xl font-bold mb-2">Add group members</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            Add everyone who will share expenses. They can join later by scanning a QR code.
          </p>
          
          {/* Added people list */}
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
          
          {/* Add new person */}
          <div className="flex gap-2 mb-6">
            <Input
              value={newPersonName}
              onChange={e => setNewPersonName(e.target.value)}
              placeholder="Enter name"
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && handleAddPerson()}
            />
            <Button onClick={handleAddPerson} variant="secondary">
              Add
            </Button>
          </div>
          
          <div className="mt-auto">
            <Button 
              onClick={handleFinishAddingPeople} 
              className="w-full"
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
        </div>
      )}

      {/* Invite Step (Show QR code) */}
      {step === 'invite' && (
        <div className="flex-1 flex flex-col p-6">
          <h1 className="text-2xl font-bold mb-2">Invite your group</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            Others can scan this QR code to join and sync expenses
          </p>
          
          {/* QR Code */}
          <div className="bg-[var(--white)] rounded-xl p-6 mb-6">
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
          
          <div className="bg-[var(--teal-green)]/10 rounded-xl p-4 mb-6">
            <div className="text-sm">
              <strong>How to join:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-[var(--text-secondary)]">
                <li>Open the app on another device</li>
                <li>Tap "Join Existing Group"</li>
                <li>Scan this QR code</li>
                <li>Select their name from the list</li>
              </ol>
            </div>
          </div>
          
          <div className="mt-auto">
            <Button onClick={handleCompleteShared} className="w-full">
              Done
            </Button>
            <p className="text-center text-sm text-[var(--text-secondary)] mt-2">
              You can invite more people later from the Sync page
            </p>
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
              setStep('welcome');
            }}
          />
        </>
      )}

      {/* Connecting Step */}
      {step === 'connecting' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 border-4 border-[var(--teal-green)] border-t-transparent rounded-full animate-spin mb-6" />
          <h1 className="text-2xl font-bold mb-2">
            {syncProgress < 30 ? 'Connecting...' : 'Syncing...'}
          </h1>
          <p className="text-[var(--text-secondary)] mb-4">
            {syncStatus || `Joining ${joinAccountName}`}
          </p>
          {syncProgress > 0 && (
            <div className="w-full max-w-xs bg-[var(--bg)] rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-[var(--teal-green)] transition-all duration-300"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Select Name Step */}
      {step === 'selectName' && (
        <div className="flex-1 flex flex-col p-6">
          <h1 className="text-2xl font-bold mb-2">Select your name</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            {syncedPeople.length > 0 
              ? "Tap your name to complete joining the group"
              : "No members found. Ask the group creator to add you first."}
          </p>
          
          {syncedPeople.length > 0 ? (
            <div className="space-y-3">
              {syncedPeople.map(person => (
                <button
                  key={person.id}
                  onClick={() => handleSelectName(person)}
                  className="w-full flex items-center gap-3 p-4 bg-[var(--white)] rounded-xl active:scale-[0.98] transition-transform"
                >
                  <div className="w-12 h-12 rounded-full bg-[var(--teal-green)]/10 text-[var(--teal-green)] flex items-center justify-center font-bold text-lg">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-lg">{person.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-5xl mb-4">🤷</div>
              <p className="text-[var(--text-secondary)] text-center mb-6">
                Your name isn't in the group yet.<br />
                Ask the group creator to add you.
              </p>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setStep('welcome');
                  setJoinError(null);
                }}
              >
                Go Back
              </Button>
            </div>
          )}
          
          {syncedPeople.length > 0 && (
            <div className="mt-auto pt-6">
              <p className="text-center text-sm text-[var(--text-secondary)]">
                Don't see your name? Ask the group creator to add you.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
