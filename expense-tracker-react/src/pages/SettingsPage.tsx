import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { Button, Input, Sheet, useToast } from '@/components/ui';
import { CURRENCIES } from '@/types';
import { haptic, downloadFile, cn } from '@/lib/utils';
import * as db from '@/db/operations';
import { clearAllData } from '@/db/schema';

export function SettingsPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const accounts = useAccountStore(s => s.accounts);
  const currentAccountId = useAccountStore(s => s.currentAccountId);
  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const createAccount = useAccountStore(s => s.createAccount);
  const deleteAccount = useAccountStore(s => s.deleteAccount);
  const setCurrentAccount = useAccountStore(s => s.setCurrentAccount);
  const setOnboarded = useAccountStore(s => s.setOnboarded);
  
  const { currency, monthlyBudget, darkMode, debugMode, setCurrency, setMonthlyBudget, setDarkMode, setDebugMode } = useSettingsStore();
  const deviceId = useSyncStore(s => s.deviceId);
  
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState(monthlyBudget.toString());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // New account form
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountMode, setNewAccountMode] = useState<'single' | 'shared'>('single');
  const [newAccountCurrency, setNewAccountCurrency] = useState('$');
  const [creatingAccount, setCreatingAccount] = useState(false);

  const handleCurrencyChange = (symbol: string) => {
    setCurrency(symbol);
    haptic('light');
    setShowCurrencyModal(false);
    showSuccess('Currency updated');
  };

  const handleBudgetSave = () => {
    const budget = parseFloat(budgetInput);
    if (isNaN(budget) || budget < 0) {
      showError('Enter a valid amount');
      return;
    }
    setMonthlyBudget(budget);
    haptic('success');
    setShowBudgetModal(false);
    showSuccess('Budget updated');
  };

  const handleDarkModeToggle = () => {
    setDarkMode(!darkMode);
    haptic('light');
  };

  const handleDebugModeToggle = () => {
    setDebugMode(!debugMode);
    haptic('light');
    if (!debugMode) {
      showSuccess('Debug mode enabled - check console for sync logs');
    }
  };

  const handleSwitchAccount = async (id: string) => {
    if (id === currentAccountId) return;
    
    haptic('light');
    try {
      await setCurrentAccount(id);
      setShowAccountsModal(false);
      showSuccess('Switched account');
      navigate('/');
    } catch {
      showError('Failed to switch');
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      showError('Enter account name');
      return;
    }
    
    setCreatingAccount(true);
    haptic('light');
    
    try {
      const account = createAccount(newAccountName.trim(), newAccountMode, newAccountCurrency);
      await setCurrentAccount(account.id);
      
      setNewAccountName('');
      setNewAccountMode('single');
      setNewAccountCurrency('$');
      setShowNewAccountModal(false);
      setShowAccountsModal(false);
      
      haptic('success');
      showSuccess('Account created');
      navigate('/');
    } catch {
      showError('Failed to create account');
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (accounts.length <= 1) {
      showError("Can't delete last account");
      return;
    }
    
    if (id === currentAccountId) {
      showError('Switch to another account first');
      return;
    }
    
    const account = accounts.find(a => a.id === id);
    if (!confirm(`Delete "${account?.name}"? This cannot be undone.`)) return;
    
    haptic('light');
    try {
      deleteAccount(id);
      showSuccess('Account deleted');
    } catch {
      showError('Failed to delete');
    }
  };

  const handleExportCSV = async () => {
    try {
      const data = await db.exportAllData();
      
      let csv = 'Date,Description,Amount,Payer,Tags,Notes\n';
      data.expenses.forEach(exp => {
        csv += `"${exp.date}","${exp.description}",${exp.amount},"${exp.payerId || ''}","${exp.tags || ''}","${exp.notes || ''}"\n`;
      });
      
      downloadFile(csv, `expenses-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      haptic('success');
      showSuccess('Exported to CSV');
    } catch {
      showError('Export failed');
    }
  };

  const handleExportJSON = async () => {
    try {
      const data = await db.exportAllData();
      downloadFile(JSON.stringify(data, null, 2), `expenses-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      haptic('success');
      showSuccess('Backup exported');
    } catch {
      showError('Export failed');
    }
  };

  const handleClearData = async () => {
    try {
      await clearAllData();
      setOnboarded(false);
      haptic('success');
      showSuccess('All data cleared');
      setShowDeleteConfirm(false);
      navigate('/');
    } catch {
      showError('Failed to clear data');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 safe-top">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(90px+env(safe-area-inset-bottom))]">

      {/* Account Section */}
      <div className="px-4 mb-6">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2 px-1">
          Account
        </h2>
        <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
          <button
            onClick={() => setShowAccountsModal(true)}
            className="flex items-center justify-between p-4 w-full text-left"
          >
            <div>
              <div className="font-medium">{currentAccount?.name || 'My Expenses'}</div>
              <div className="text-sm text-[var(--text-secondary)]">
                {currentAccount?.mode === 'shared' ? 'Shared' : 'Personal'} Account
              </div>
            </div>
            <div className="flex items-center gap-2">
              {accounts.length > 1 && (
                <span className="text-xs bg-[var(--teal-green)]/10 text-[var(--teal-green)] px-2 py-1 rounded-full">
                  {accounts.length} accounts
                </span>
              )}
              <span className="text-[var(--text-secondary)]">›</span>
            </div>
          </button>
          <div className="flex items-center justify-between p-4">
            <span>Device ID</span>
            <span className="font-mono text-sm text-[var(--text-secondary)]">{deviceId}</span>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="px-4 mb-6">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2 px-1">
          Preferences
        </h2>
        <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
          <button
            onClick={() => setShowCurrencyModal(true)}
            className="flex items-center justify-between p-4 w-full text-left"
          >
            <span>Currency</span>
            <span className="text-[var(--text-secondary)]">{currency}</span>
          </button>
          
          <button
            onClick={() => { setBudgetInput(monthlyBudget.toString()); setShowBudgetModal(true); }}
            className="flex items-center justify-between p-4 w-full text-left"
          >
            <span>Monthly Budget</span>
            <span className="text-[var(--text-secondary)]">
              {monthlyBudget > 0 ? `${currency}${monthlyBudget}` : 'Not set'}
            </span>
          </button>
          
          <div className="flex items-center justify-between p-4">
            <span>Dark Mode</span>
            <button
              onClick={handleDarkModeToggle}
              className={`w-12 h-7 rounded-full transition-colors ${darkMode ? 'bg-[var(--teal-green)]' : 'bg-[var(--border)]'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-1 ${darkMode ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          
          <div className="flex items-center justify-between p-4">
            <div>
              <span>Debug Mode</span>
              <div className="text-xs text-[var(--text-secondary)]">Log sync events to console</div>
            </div>
            <button
              onClick={handleDebugModeToggle}
              className={`w-12 h-7 rounded-full transition-colors ${debugMode ? 'bg-[var(--teal-green)]' : 'bg-[var(--border)]'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-1 ${debugMode ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Data Section */}
      <div className="px-4 mb-6">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2 px-1">
          Data
        </h2>
        <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-between p-4 w-full text-left"
          >
            <span>Export to CSV</span>
            <span className="text-[var(--teal-green)]">📄</span>
          </button>
          
          <button
            onClick={handleExportJSON}
            className="flex items-center justify-between p-4 w-full text-left"
          >
            <span>Backup Data</span>
            <span className="text-[var(--teal-green)]">💾</span>
          </button>
          
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center justify-between p-4 w-full text-left text-[var(--danger)]"
          >
            <span>Clear All Data</span>
            <span>🗑️</span>
          </button>
        </div>
      </div>

      {/* About Section */}
      <div className="px-4 mb-6">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2 px-1">
          About
        </h2>
        <div className="bg-[var(--white)] rounded-xl p-4">
          <div className="text-center">
            <div className="text-3xl mb-2">💰</div>
            <div className="font-semibold">Expense Tracker</div>
            <div className="text-sm text-[var(--text-secondary)]">Version 2.0 (React)</div>
          </div>
        </div>
      </div>

      </div>

      {/* Accounts Modal */}
      <Sheet
        isOpen={showAccountsModal}
        onClose={() => setShowAccountsModal(false)}
        title="Accounts"
        actions={
          <button
            onClick={() => setShowNewAccountModal(true)}
            className="text-[var(--teal-green)] text-[17px] font-semibold px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10"
          >
            + New
          </button>
        }
      >
        <div className="divide-y divide-[var(--border)]">
          {accounts.map(account => (
            <div
              key={account.id}
              className={cn(
                'flex items-center justify-between p-4',
                account.id === currentAccountId && 'bg-[var(--teal-green)]/5'
              )}
            >
              <button
                onClick={() => handleSwitchAccount(account.id)}
                className="flex-1 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg)] flex items-center justify-center text-xl">
                    {account.mode === 'shared' ? '👥' : '👤'}
                  </div>
                  <div>
                    <div className="font-medium">{account.name}</div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      {account.mode === 'shared' ? 'Shared' : 'Personal'} • {account.currency}
                    </div>
                  </div>
                </div>
              </button>
              
              {account.id === currentAccountId ? (
                <span className="text-[var(--teal-green)] text-sm font-medium">Active</span>
              ) : (
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="text-[var(--danger)] text-xl p-2"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
        
        {accounts.length === 0 && (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            No accounts yet
          </div>
        )}
      </Sheet>

      {/* New Account Modal */}
      <Sheet
        isOpen={showNewAccountModal}
        onClose={() => setShowNewAccountModal(false)}
        title="New Account"
        actions={
          <button
            onClick={handleCreateAccount}
            disabled={creatingAccount}
            className="text-[var(--teal-green)] text-[17px] font-semibold px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10 disabled:opacity-50"
          >
            {creatingAccount ? 'Creating...' : 'Create'}
          </button>
        }
      >
        <div className="p-4 space-y-4">
          <Input
            label="Account Name"
            value={newAccountName}
            onChange={e => setNewAccountName(e.target.value)}
            placeholder="e.g., Personal, Trip to Paris"
            autoFocus
          />
          
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
              Account Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewAccountMode('single')}
                className={cn(
                  'p-4 rounded-xl text-left transition-all',
                  newAccountMode === 'single'
                    ? 'bg-[var(--teal-green)] text-white'
                    : 'bg-[var(--bg)]'
                )}
              >
                <div className="text-2xl mb-1">👤</div>
                <div className="font-medium">Personal</div>
                <div className={cn('text-xs', newAccountMode === 'single' ? 'text-white/70' : 'text-[var(--text-secondary)]')}>
                  Just for you
                </div>
              </button>
              <button
                type="button"
                onClick={() => setNewAccountMode('shared')}
                className={cn(
                  'p-4 rounded-xl text-left transition-all',
                  newAccountMode === 'shared'
                    ? 'bg-[var(--teal-green)] text-white'
                    : 'bg-[var(--bg)]'
                )}
              >
                <div className="text-2xl mb-1">👥</div>
                <div className="font-medium">Shared</div>
                <div className={cn('text-xs', newAccountMode === 'shared' ? 'text-white/70' : 'text-[var(--text-secondary)]')}>
                  Split with others
                </div>
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
              Currency
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CURRENCIES.slice(0, 6).map(curr => (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() => setNewAccountCurrency(curr.symbol)}
                  className={cn(
                    'p-3 rounded-xl text-center transition-all',
                    newAccountCurrency === curr.symbol
                      ? 'bg-[var(--teal-green)] text-white'
                      : 'bg-[var(--bg)]'
                  )}
                >
                  <div className="text-xl">{curr.symbol}</div>
                  <div className="text-xs">{curr.code}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Sheet>

      {/* Currency Modal */}
      <Sheet
        isOpen={showCurrencyModal}
        onClose={() => setShowCurrencyModal(false)}
        title="Select Currency"
      >
        <div className="divide-y divide-[var(--border)]">
          {CURRENCIES.map(curr => (
            <button
              key={curr.code}
              onClick={() => handleCurrencyChange(curr.symbol)}
              className={`flex items-center justify-between p-4 w-full text-left ${
                currency === curr.symbol ? 'bg-[var(--teal-green)]/10' : ''
              }`}
            >
              <div>
                <div className="font-medium">{curr.name}</div>
                <div className="text-sm text-[var(--text-secondary)]">{curr.code}</div>
              </div>
              <span className="text-xl">{curr.symbol}</span>
            </button>
          ))}
        </div>
      </Sheet>

      {/* Budget Modal */}
      <Sheet
        isOpen={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        title="Monthly Budget"
        actions={
          <button
            onClick={handleBudgetSave}
            className="text-[var(--teal-green)] text-[17px] font-semibold px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10"
          >
            Save
          </button>
        }
      >
        <div className="p-4">
          <Input
            label="Budget Amount"
            type="number"
            value={budgetInput}
            onChange={e => setBudgetInput(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            Set to 0 to disable budget tracking
          </p>
        </div>
      </Sheet>

      {/* Delete Confirmation */}
      <Sheet
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Clear All Data"
      >
        <div className="p-4 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">Are you sure?</h3>
          <p className="text-[var(--text-secondary)] mb-6">
            This will permanently delete all your expenses, people, and settings. This action cannot be undone.
          </p>
          <div className="space-y-3">
            <Button onClick={handleExportJSON} variant="secondary" className="w-full">
              Export Backup First
            </Button>
            <Button onClick={handleClearData} variant="danger" className="w-full">
              Delete Everything
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
