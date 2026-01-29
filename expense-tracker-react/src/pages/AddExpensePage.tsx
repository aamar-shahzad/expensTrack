import { useNavigate } from 'react-router-dom';
import { ExpenseForm } from '@/components/expenses';

export function AddExpensePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-[var(--bg)] safe-top">
      {/* Header */}
      <div className="sticky top-0 bg-[var(--bg)] z-10 px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
        <button
          onClick={() => navigate(-1)}
          className="text-[var(--teal-green)] text-[17px] px-2 py-1 -mx-2 rounded-lg active:bg-[var(--teal-green)]/10"
        >
          Cancel
        </button>
        <span className="text-[17px] font-semibold">Add Expense</span>
        <div className="w-[60px]" />
      </div>

      {/* Form */}
      <ExpenseForm />
    </div>
  );
}
