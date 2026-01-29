import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExpenseForm } from '@/components/expenses';
import type { Expense } from '@/types';
import * as db from '@/db/operations';

export function AddExpensePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [expense, setExpense] = useState<Expense | undefined>(undefined);
  const [loading, setLoading] = useState(!!id);
  
  const isEditing = !!id;

  // Load expense for editing
  useEffect(() => {
    if (!id) return;
    
    const loadExpense = async () => {
      try {
        const exp = await db.getExpense(id);
        if (exp) {
          setExpense(exp);
        }
      } catch (e) {
        console.error('Failed to load expense:', e);
      } finally {
        setLoading(false);
      }
    };
    
    loadExpense();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg)]">
        <div className="flex-shrink-0 bg-[var(--bg)] safe-top px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
          <button onClick={() => navigate(-1)} className="text-[var(--teal-green)] text-[17px] font-medium">
            Cancel
          </button>
          <span className="text-[17px] font-semibold">Edit Expense</span>
          <div className="w-[60px]" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--teal-green)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header */}
      <div className="flex-shrink-0 bg-[var(--bg)] safe-top px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
        <button
          onClick={() => navigate(-1)}
          className="text-[var(--teal-green)] text-[17px] font-medium px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10"
        >
          Cancel
        </button>
        <span className="text-[17px] font-semibold">{isEditing ? 'Edit Expense' : 'Add Expense'}</span>
        <div className="w-[60px]" />
      </div>

      {/* Form - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <ExpenseForm expense={expense} />
      </div>
    </div>
  );
}
