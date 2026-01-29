import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { Button, Input, Sheet, useToast } from '@/components/ui';
import { CURRENCIES } from '@/types';
import { haptic, downloadFile } from '@/lib/utils';
import * as db from '@/db/operations';
import { clearAllData } from '@/db/schema';

export function SettingsPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const setOnboarded = useAccountStore(s => s.setOnboarded);
  
  const { currency, monthlyBudget, darkMode, setCurrency, setMonthlyBudget, setDarkMode } = useSettingsStore();
  const deviceId = useSyncStore(s => s.deviceId);
  
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState(monthlyBudget.toString());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    <div className="min-h-full bg-[var(--bg)] safe-top pb-[calc(90px+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
      </div>

      {/* Account Section */}
      <div className="px-4 mb-6">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2 px-1">
          Account
        </h2>
        <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
          <div className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium">{currentAccount?.name || 'My Expenses'}</div>
              <div className="text-sm text-[var(--text-secondary)]">
                {currentAccount?.mode === 'shared' ? 'Shared' : 'Personal'} Account
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-4">
            <span>Device ID</span>
            <span className="font-mono text-[var(--text-secondary)]">{deviceId}</span>
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
