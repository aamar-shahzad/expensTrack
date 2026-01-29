import { useNavigate } from 'react-router-dom';
import { ExpenseForm } from '@/components/expenses';

export function AddExpensePage() {
  const navigate = useNavigate();

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
        <span className="text-[17px] font-semibold">Add Expense</span>
        <div className="w-[60px]" />
      </div>

      {/* Form - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <ExpenseForm />
      </div>
    </div>
  );
}
