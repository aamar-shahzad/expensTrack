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

  // Loading: wait for expense from store or DB when editing
  const loading = Boolean(id && effectiveExpense === undefined && !dbFetched);
  // Not found: editing but expense doesn't exist (store + DB both done)
  const notFound = Boolean(id && dbFetched && effectiveExpense === undefined);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg)]">
        <header className="flex-shrink-0 safe-top px-4 py-3 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]">
          <button
            onClick={() => navigate(-1)}
            className="text-[var(--teal-green)] text-[17px] font-medium min-h-[44px] flex items-center -ml-2 pl-2 rounded-lg active:bg-[var(--teal-green)]/10"
          >
            Cancel
          </button>
          <span className="text-[17px] font-semibold">Edit Expense</span>
          <div className="w-14" aria-hidden />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg)]">
        <header className="flex-shrink-0 safe-top px-4 py-3 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]">
          <button
            onClick={() => navigate(-1)}
            className="text-[var(--teal-green)] text-[17px] font-medium min-h-[44px] flex items-center -ml-2 pl-2 rounded-lg active:bg-[var(--teal-green)]/10"
          >
            Back
          </button>
          <span className="text-[17px] font-semibold">Edit Expense</span>
          <div className="w-14" aria-hidden />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-[var(--text-secondary)] mb-4">This expense could not be found. It may have been deleted.</p>
          <button
            onClick={() => navigate('/')}
            className="text-[var(--teal-green)] font-medium text-[17px] py-2 px-4 rounded-xl active:bg-[var(--teal-green)]/10"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      <header className="flex-shrink-0 safe-top px-4 py-3 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]">
        <button
          onClick={() => navigate(-1)}
          className="text-[var(--teal-green)] text-[17px] font-medium min-h-[44px] flex items-center -ml-2 pl-2 rounded-lg active:bg-[var(--teal-green)]/10"
        >
          Cancel
        </button>
        <span className="text-[17px] font-semibold">{isEditing ? 'Edit Expense' : 'Add Expense'}</span>
        <div className="w-14" aria-hidden />
      </header>

      <div className="flex-1 min-h-0 flex flex-col">
        <ExpenseForm expense={effectiveExpense} />
      </div>
    </div>
  );
}
