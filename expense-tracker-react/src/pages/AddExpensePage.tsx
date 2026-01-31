import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExpenseForm } from '@/components/expenses';
import { LoadingSpinner } from '@/components/ui';
import type { Expense } from '@/types';
import { useExpenseStore } from '@/stores/expenseStore';
import { useSyncStore } from '@/stores/syncStore';
import * as db from '@/db/operations';

export function AddExpensePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const allExpenses = useExpenseStore(s => s.allExpenses);
  const isSynced = useSyncStore(s => s.isSynced);
  
  // Prefer store (Yjs source of truth); fallback to DB for legacy or before sync
  const expenseFromStore = id ? allExpenses.find(e => e.id === id) ?? undefined : undefined;
  const [expenseFromDb, setExpenseFromDb] = useState<Expense | undefined>(undefined);
  const [dbFetched, setDbFetched] = useState(false);
  const effectiveExpense = expenseFromStore ?? expenseFromDb;
  
  const isEditing = !!id;

  // Fallback: load from IndexedDB for editing (e.g. before Yjs has synced or legacy data)
  useEffect(() => {
    if (!id) return;
    
    const loadFromDb = async () => {
      try {
        const exp = await db.getExpense(id);
        setExpenseFromDb(exp);
      } catch (e) {
        console.error('Failed to load expense:', e);
      } finally {
        setDbFetched(true);
      }
    };
    
    loadFromDb();
  }, [id]);

  // Loading: wait for either expense (store or DB) or for sync + DB result
  const loading = Boolean(
    id && effectiveExpense === undefined && (!dbFetched || !isSynced)
  );

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
          <LoadingSpinner />
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
        <ExpenseForm expense={effectiveExpense} />
      </div>
    </div>
  );
}
