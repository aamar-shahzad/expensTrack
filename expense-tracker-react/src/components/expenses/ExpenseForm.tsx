import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Expense } from '@/types';
import { getToday } from '@/types';
import { Button, Input, useToast } from '@/components/ui';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { haptic } from '@/lib/utils';

interface ExpenseFormProps {
  expense?: Expense;
  onSuccess?: () => void;
}

const QUICK_CATEGORIES = [
  { icon: '🍔', name: 'Food' },
  { icon: '☕', name: 'Coffee' },
  { icon: '🛒', name: 'Shopping' },
  { icon: '🚗', name: 'Transport' },
  { icon: '🏠', name: 'Home' },
  { icon: '🎬', name: 'Entertainment' },
  { icon: '🏥', name: 'Health' },
  { icon: '💵', name: 'Other' },
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

  // Set default payer
  useEffect(() => {
    if (isSharedMode && !payerId && people.length > 0) {
      setPayerId(lastPayerId || people[0].id);
    }
  }, [isSharedMode, people, payerId, lastPayerId]);

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
      return;
    }
    if (!description.trim()) {
      showError('Enter a description');
      return;
    }
    if (isSharedMode && !payerId) {
      showError('Select who paid');
      return;
    }

    setLoading(true);
    haptic('light');

    try {
      if (expense) {
        // Update existing
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
        // Add new
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

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {/* Quick Category Picker */}
      <div>
        <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
          Category
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {QUICK_CATEGORIES.map(cat => (
            <button
              key={cat.icon}
              type="button"
              onClick={() => handleCategorySelect(cat.icon, cat.name)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                selectedCategory === cat.icon
                  ? 'bg-[var(--teal-green)] text-white'
                  : 'bg-[var(--bg)] text-[var(--text)]'
              }`}
            >
              <span className="text-xl">{cat.icon}</span>
              <span className="text-[11px] font-medium">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
          Amount
        </label>
        <div className="flex items-center gap-2 bg-[var(--white)] rounded-xl px-4">
          <span className="text-xl text-[var(--teal-green)] font-semibold">{currency}</span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            inputMode="decimal"
            className="flex-1 py-3 text-2xl font-semibold bg-transparent border-none outline-none"
            autoFocus
          />
        </div>
      </div>

      {/* Description */}
      <Input
        label="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="What was this for?"
      />

      {/* Date */}
      <Input
        label="Date"
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
      />

      {/* Payer (shared mode only) */}
      {isSharedMode && people.length > 0 && (
        <div>
          <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
            Paid By
          </label>
          <select
            value={payerId}
            onChange={e => setPayerId(e.target.value)}
            className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-[var(--white)] text-[var(--text)] text-[17px] border-none outline-none"
          >
            {people.map(person => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tags */}
      <Input
        label="Tags (optional)"
        value={tags}
        onChange={e => setTags(e.target.value)}
        placeholder="e.g., work, vacation"
      />

      {/* Notes */}
      <div>
        <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any additional details..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-[var(--white)] text-[var(--text)] text-[17px] border-none outline-none resize-none"
        />
      </div>

      {/* Submit */}
      <div className="pt-4">
        <Button
          type="submit"
          loading={loading}
          className="w-full"
        >
          {expense ? 'Update Expense' : 'Save Expense'}
        </Button>
      </div>
    </form>
  );
}
