import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, useToast } from '@/components/ui';
import { useAccountStore } from '@/stores/accountStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { CURRENCIES } from '@/types';
import { haptic } from '@/lib/utils';

type Step = 'welcome' | 'mode' | 'name' | 'currency' | 'join';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSuccess, showError } = useToast();
  
  const createAccount = useAccountStore(s => s.createAccount);
  const setCurrentAccount = useAccountStore(s => s.setCurrentAccount);
  const setOnboarded = useAccountStore(s => s.setOnboarded);
  const addPerson = usePeopleStore(s => s.addPerson);
  const setCurrency = useSettingsStore(s => s.setCurrency);
  
  const connectCode = searchParams.get('connect');
  const [step, setStep] = useState<Step>(connectCode ? 'join' : 'welcome');
  const [mode, setMode] = useState<'single' | 'shared'>('single');
  const [accountName, setAccountName] = useState('');
  const [userName, setUserName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('$');
  const [loading, setLoading] = useState(false);

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

  const handleComplete = async () => {
    setLoading(true);
    haptic('light');
    
    try {
      // Create account
      const account = createAccount(
        accountName.trim() || 'My Expenses',
        mode,
        selectedCurrency
      );
      
      // Set currency
      setCurrency(selectedCurrency);
      
      // Initialize DB and set current account
      await setCurrentAccount(account.id);
      
      // Add self as person in shared mode
      if (mode === 'shared' && userName.trim()) {
        await addPerson(userName.trim());
      }
      
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

  const handleJoin = async () => {
    if (!userName.trim()) {
      showError('Enter your name');
      return;
    }
    
    setLoading(true);
    haptic('light');
    
    try {
      // Create a shared account for joining
      const account = createAccount(
        'Shared Expenses',
        'shared',
        '$'
      );
      
      await setCurrentAccount(account.id);
      await addPerson(userName.trim());
      
      // TODO: Connect to peer and sync
      
      setOnboarded(true);
      haptic('success');
      showSuccess('Joined!');
      navigate('/sync');
    } catch (error) {
      console.error('Join failed:', error);
      showError('Failed to join');
    } finally {
      setLoading(false);
    }
  };

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
          <Button onClick={() => setStep('mode')} className="w-full max-w-xs">
            Get Started
          </Button>
        </div>
      )}

      {/* Mode Selection */}
      {step === 'mode' && (
        <div className="flex-1 flex flex-col p-6">
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
            <Button onClick={handleComplete} loading={loading} className="w-full">
              Complete Setup
            </Button>
          </div>
        </div>
      )}

      {/* Join Step */}
      {step === 'join' && (
        <div className="flex-1 flex flex-col p-6">
          <h1 className="text-2xl font-bold mb-2">Join Group</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            You're joining an existing expense group
          </p>
          
          <div className="bg-[var(--white)] rounded-xl p-4 mb-6">
            <div className="text-sm text-[var(--text-secondary)] mb-1">Connection Code</div>
            <div className="font-mono text-xl font-bold">{connectCode}</div>
          </div>
          
          <Input
            label="Your Name"
            value={userName}
            onChange={e => setUserName(e.target.value)}
            placeholder="What should we call you?"
            autoFocus
          />
          
          <div className="mt-auto pt-6">
            <Button onClick={handleJoin} loading={loading} className="w-full">
              Join Group
            </Button>
            <button
              onClick={() => { setStep('welcome'); }}
              className="w-full mt-3 text-[var(--text-secondary)] text-sm"
            >
              Create new account instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
