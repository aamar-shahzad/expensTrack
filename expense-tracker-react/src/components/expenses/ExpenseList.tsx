import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Expense } from '@/types';
import { ExpenseItem } from './ExpenseItem';
import { ExpenseListSkeleton } from '@/components/ui';
import { useExpenseStore } from '@/stores/expenseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useToast } from '@/components/ui';

interface ExpenseListProps {
  expenses: Expense[];
  loading?: boolean;
  newExpenseId?: string | null;
  /** When true, empty state is due to search/category filter (show "No matches" + clear) */
  isFilteredEmpty?: boolean;
  onClearFilters?: () => void;
  onAddExpense?: () => void;
}

export function ExpenseList({ expenses, loading, newExpenseId, isFilteredEmpty, onClearFilters, onAddExpense }: ExpenseListProps) {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const deleteExpense = useExpenseStore(s => s.deleteExpense);
  const duplicateExpense = useExpenseStore(s => s.duplicateExpense);
  const formatAmount = useSettingsStore(s => s.formatAmount);
  const isConnected = useSyncStore(s => s.isConnected);

  // Group expenses by date category
  const groupedExpenses = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: { label: string; expenses: Expense[]; total: number }[] = [];
    
    const todayExpenses: Expense[] = [];
    const yesterdayExpenses: Expense[] = [];
    const thisWeekExpenses: Expense[] = [];
    const earlierExpenses: Expense[] = [];

    expenses.forEach(exp => {
      const expDate = new Date(exp.date);
      expDate.setHours(0, 0, 0, 0);
      
      if (expDate.getTime() === today.getTime()) {
        todayExpenses.push(exp);
      } else if (expDate.getTime() === yesterday.getTime()) {
        yesterdayExpenses.push(exp);
      } else if (expDate > weekAgo) {
        thisWeekExpenses.push(exp);
      } else {
        earlierExpenses.push(exp);
      }
    });

    if (todayExpenses.length > 0) {
      groups.push({
        label: 'Today',
        expenses: todayExpenses,
        total: todayExpenses.reduce((sum, e) => sum + e.amount, 0)
      });
    }
    if (yesterdayExpenses.length > 0) {
      groups.push({
        label: 'Yesterday',
        expenses: yesterdayExpenses,
        total: yesterdayExpenses.reduce((sum, e) => sum + e.amount, 0)
      });
    }
    if (thisWeekExpenses.length > 0) {
      groups.push({
        label: 'This Week',
        expenses: thisWeekExpenses,
        total: thisWeekExpenses.reduce((sum, e) => sum + e.amount, 0)
      });
    }
    if (earlierExpenses.length > 0) {
      groups.push({
        label: 'Earlier',
        expenses: earlierExpenses,
        total: earlierExpenses.reduce((sum, e) => sum + e.amount, 0)
      });
    }

    return groups;
  }, [expenses]);

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      showSuccess(isConnected ? 'Deleted · synced' : 'Deleted');
    } catch {
      showError('Failed to delete');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateExpense(id);
      showSuccess(isConnected ? 'Duplicated · synced' : 'Duplicated');
    } catch {
      showError('Failed to duplicate');
    }
  };

  if (loading) {
    return <ExpenseListSkeleton />;
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 bg-[var(--white)]">
        {isFilteredEmpty ? (
          <>
            <div className="text-4xl mb-4 opacity-80">🔍</div>
            <h3 className="text-lg font-semibold mb-2">No expenses match</h3>
            <p className="text-[var(--text-secondary)] text-center mb-6">
              Try a different search or category
            </p>
            {onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="px-5 py-2.5 rounded-full text-[15px] font-medium bg-[var(--teal-green)] text-white active:scale-[0.98]"
              >
                Clear filters
              </button>
            )}
          </>
        ) : (
          <>
            <div className="text-5xl mb-4 opacity-90">💰</div>
            <h3 className="text-lg font-semibold mb-2">No expenses yet</h3>
            <p className="text-[var(--text-secondary)] text-center mb-6">
              Track your spending by adding your first expense
            </p>
            <div className="space-y-2 text-sm text-[var(--text-secondary)] mb-6">
              <div>📷 Snap a receipt to auto-fill</div>
              <div>👥 Split costs with others</div>
            </div>
            {onAddExpense && (
              <button
                type="button"
                onClick={onAddExpense}
                className="px-5 py-3 rounded-full text-[15px] font-semibold bg-[var(--teal-green)] text-white active:scale-[0.98]"
              >
                Add expense
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[var(--white)]">
      {groupedExpenses.map(group => (
        <div key={group.label}>
          {/* Date separator */}
          <div className="flex justify-center items-center py-3 bg-[var(--white)]">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg)] rounded-lg shadow-sm">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                {group.label}
              </span>
              <span className="text-[11px] font-semibold text-[var(--teal-green)]">
                {formatAmount(group.total)}
              </span>
            </div>
          </div>
          
          {/* Expenses */}
          {group.expenses.map(expense => (
            <ExpenseItem
              key={expense.id}
              expense={expense}
              isNew={expense.id === newExpenseId}
              onTap={() => navigate(`/expense/${expense.id}`)}
              onDoubleTap={() => navigate(`/expense/${expense.id}/edit`)}
              onLongPress={() => {/* Show context menu */}}
              onDelete={() => handleDelete(expense.id)}
              onDuplicate={() => handleDuplicate(expense.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
