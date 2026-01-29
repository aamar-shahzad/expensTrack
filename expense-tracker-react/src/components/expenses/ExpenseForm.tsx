import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Expense } from '@/types';
import { getToday } from '@/types';
import { Button, useToast } from '@/components/ui';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { haptic, cn } from '@/lib/utils';

interface ExpenseFormProps {
  expense?: Expense;
  onSuccess?: () => void;
}

const QUICK_CATEGORIES = [
  { icon: '🍔', name: 'Food', color: 'bg-orange-100' },
  { icon: '☕', name: 'Coffee', color: 'bg-amber-100' },
  { icon: '🛒', name: 'Shopping', color: 'bg-blue-100' },
  { icon: '🚗', name: 'Transport', color: 'bg-green-100' },
  { icon: '🏠', name: 'Home', color: 'bg-purple-100' },
  { icon: '🎬', name: 'Fun', color: 'bg-pink-100' },
  { icon: '🏥', name: 'Health', color: 'bg-red-100' },
  { icon: '💵', name: 'Other', color: 'bg-gray-100' },
];

export function ExpenseForm({ expense, onSuccess }: ExpenseFormProps) {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const addExpense = useExpenseStore(s => s.addExpense);
  const updateExpense = useExpenseStore(s => s.updateExpense);
  const people = usePeopleStore(s => s.people);
  const lastPayerId = usePeopleStore(s => s.lastPayerId);
  const setLastPayer = usePeopleStore(s => s.setLastPayer);
  const isSharedMode = useAccountStore(s => s.isSharedMode());
  const currency = useSettingsStore(s => s.currency);

  const [description, setDescription] = useState(expense?.description || '');
  const [amount, setAmount] = useState(expense?.amount?.toString() || '');
  const [date, setDate] = useState(expense?.date || getToday());
  const [payerId, setPayerId] = useState(expense?.payerId || lastPayerId || '');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [tags, setTags] = useState(expense?.tags || '');
  const [loading, setLoading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Set default payer
  useEffect(() => {
    if (isSharedMode && !payerId && people.length > 0) {
      setPayerId(lastPayerId || people[0].id);
    }
  }, [isSharedMode, people, payerId, lastPayerId]);

  // Focus amount input on mount
  useEffect(() => {
    setTimeout(() => amountInputRef.current?.focus(), 100);
  }, []);

  const handleCategorySelect = (icon: string, name: string) => {
    haptic('light');
    setSelectedCategory(icon);
    if (!description) {
      setDescription(name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    
    // Validation
    if (!amountNum || amountNum <= 0) {
      showError('Enter a valid amount');
      haptic('error');
      return;
    }
    if (!description.trim()) {
      showError('Enter a description');
      haptic('error');
      return;
    }
    if (isSharedMode && !payerId) {
      showError('Select who paid');
      haptic('error');
      return;
    }

    setLoading(true);
    haptic('light');

    try {
      if (expense) {
        await updateExpense(expense.id, {
          description: description.trim(),
          amount: amountNum,
          date,
          payerId: isSharedMode ? payerId : undefined,
          notes: notes.trim() || undefined,
          tags: tags.trim() || undefined
        });
        showSuccess('Updated!');
      } else {
        await addExpense({
          description: description.trim(),
          amount: amountNum,
          date,
          payerId: isSharedMode ? payerId : undefined,
          splitType: 'equal',
          notes: notes.trim() || undefined,
          tags: tags.trim() || undefined
        });
        
        if (payerId) {
          setLastPayer(payerId);
        }
        
        showSuccess('Saved!');
      }
      
      haptic('success');
      onSuccess?.();
      navigate('/');
    } catch (error) {
      console.error('Failed to save:', error);
      showError('Failed to save');
      haptic('error');
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayAmount = (val: string) => {
    if (!val) return '0';
    const num = parseFloat(val);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  return (
    <form onSubmit={handleSubmit} className="pb-8">
      {/* Amount Section - Hero */}
      <div className="bg-gradient-to-br from-[var(--teal-green)] to-[var(--primary)] text-white px-6 py-8 text-center">
        <div className="text-sm opacity-80 mb-2">Amount</div>
        <div className="flex items-center justify-center gap-1">
          <span className="text-4xl font-light">{currency}</span>
          <input
            ref={amountInputRef}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              // Only allow one decimal point
              const parts = val.split('.');
              if (parts.length > 2) return;
              if (parts[1]?.length > 2) return;
              setAmount(val);
            }}
            placeholder="0"
            className="bg-transparent border-none outline-none text-5xl font-bold text-center w-40 placeholder:text-white/40"
          />
        </div>
        {amount && parseFloat(amount) > 0 && (
          <div className="text-sm opacity-70 mt-2">
            {currency}{formatDisplayAmount(amount)}
          </div>
        )}
      </div>

      {/* Quick Categories */}
      <div className="px-4 py-4 bg-[var(--white)] border-b border-[var(--border)]">
        <div className="grid grid-cols-4 gap-2">
          {QUICK_CATEGORIES.map(cat => (
            <button
              key={cat.icon}
              type="button"
              onClick={() => handleCategorySelect(cat.icon, cat.name)}
              className={cn(
                'flex flex-col items-center gap-1 py-3 rounded-xl transition-all active:scale-95',
                selectedCategory === cat.icon
                  ? 'bg-[var(--teal-green)] text-white shadow-lg shadow-[var(--teal-green)]/30'
                  : 'bg-[var(--bg)]'
              )}
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-[10px] font-medium">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="bg-[var(--white)] divide-y divide-[var(--border)]">
        {/* Description */}
        <div className="flex items-center px-4 py-3 gap-3">
          <span className="text-xl w-8 text-center">📝</span>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What was this for?"
            className="flex-1 bg-transparent border-none outline-none text-[16px] placeholder:text-[var(--text-secondary)]"
          />
        </div>

        {/* Date */}
        <div className="flex items-center px-4 py-3 gap-3">
          <span className="text-xl w-8 text-center">📅</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[16px]"
          />
        </div>

        {/* Payer (shared mode only) */}
        {isSharedMode && people.length > 0 && (
          <div className="flex items-center px-4 py-3 gap-3">
            <span className="text-xl w-8 text-center">👤</span>
            <select
              value={payerId}
              onChange={e => setPayerId(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[16px] appearance-none"
            >
              <option value="" disabled>Who paid?</option>
              {people.map(person => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            <span className="text-[var(--text-secondary)]">▾</span>
          </div>
        )}
      </div>

      {/* More Options Toggle */}
      <button
        type="button"
        onClick={() => setShowMoreOptions(!showMoreOptions)}
        className="w-full px-4 py-3 flex items-center justify-between text-[var(--text-secondary)] text-sm bg-[var(--bg)]"
      >
        <span>More options</span>
        <span className={cn('transition-transform', showMoreOptions && 'rotate-180')}>▾</span>
      </button>

      {/* Additional Options */}
      {showMoreOptions && (
        <div className="bg-[var(--white)] divide-y divide-[var(--border)] animate-fadeIn">
          {/* Tags */}
          <div className="flex items-center px-4 py-3 gap-3">
            <span className="text-xl w-8 text-center">🏷️</span>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Tags (e.g., work, vacation)"
              className="flex-1 bg-transparent border-none outline-none text-[16px] placeholder:text-[var(--text-secondary)]"
            />
          </div>

          {/* Notes */}
          <div className="flex items-start px-4 py-3 gap-3">
            <span className="text-xl w-8 text-center mt-1">📋</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
              className="flex-1 bg-transparent border-none outline-none text-[16px] placeholder:text-[var(--text-secondary)] resize-none"
            />
          </div>
        </div>
      )}

      {/* Camera Option */}
      <div className="px-4 py-4">
        <button
          type="button"
          onClick={() => navigate('/camera')}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--white)] rounded-xl text-[var(--text-secondary)] active:bg-[var(--bg)] transition-colors"
        >
          <span className="text-xl">📷</span>
          <span className="text-[15px]">Scan receipt instead</span>
        </button>
      </div>

      {/* Submit Button */}
      <div className="px-4 pt-2 pb-safe">
        <Button
          type="submit"
          loading={loading}
          className="w-full h-14 text-lg font-semibold rounded-2xl shadow-lg shadow-[var(--teal-green)]/30"
        >
          {expense ? 'Update Expense' : 'Save Expense'}
        </Button>
      </div>
    </form>
  );
}
