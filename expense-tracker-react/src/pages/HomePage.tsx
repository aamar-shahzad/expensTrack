import { useEffect } from 'react';
import { ExpenseList } from '@/components/expenses';
import { useExpenseStore } from '@/stores/expenseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { icon: 'all', label: 'All' },
  { icon: '🍔', label: 'Food' },
  { icon: '☕', label: 'Coffee' },
  { icon: '🛒', label: 'Shop' },
  { icon: '🚗', label: 'Travel' },
  { icon: '🏠', label: 'Home' },
  { icon: '🎬', label: 'Fun' },
  { icon: '💵', label: 'Other' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'];

export function HomePage() {
  const {
    loading,
    currentMonth,
    currentYear,
    categoryFilter,
    searchQuery,
    loadExpenses,
    navigateMonth,
    setCategoryFilter,
    setSearchQuery,
    getFilteredExpenses,
    getTotalForMonth,
    getTodayTotal,
    newExpenseId,
    setNewExpenseId
  } = useExpenseStore();
  
  const formatAmount = useSettingsStore(s => s.formatAmount);
  const getBudgetStatus = useSettingsStore(s => s.getBudgetStatus);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Clear new expense highlight after animation
  useEffect(() => {
    if (!newExpenseId) return;
    const t = setTimeout(() => setNewExpenseId(null), 2500);
    return () => clearTimeout(t);
  }, [newExpenseId, setNewExpenseId]);

  const expenses = getFilteredExpenses();
  const monthTotal = getTotalForMonth();
  const todayTotal = getTodayTotal();
  const budgetStatus = getBudgetStatus(monthTotal);

  return (
    <div className="flex flex-col h-full">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-[var(--bg)] px-4 pt-3 pb-2 safe-top">
        {/* Month Navigation */}
        <div className="flex items-center justify-center gap-4 py-2 mb-3">
          <button
            onClick={() => navigateMonth(-1)}
            className="w-9 h-9 rounded-full bg-[var(--white)] flex items-center justify-center text-[var(--teal-green)] text-lg shadow-sm active:scale-90 transition-transform"
          >
            ‹
          </button>
          <span className="font-semibold text-[15px] min-w-[140px] text-center">
            {MONTHS[currentMonth]} {currentYear}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="w-9 h-9 rounded-full bg-[var(--white)] flex items-center justify-center text-[var(--teal-green)] text-lg shadow-sm active:scale-90 transition-transform"
          >
            ›
          </button>
        </div>

        {/* Summary Box */}
        <div className="bg-[var(--white)] rounded-xl p-4 mb-3 shadow-sm">
          <div className="flex justify-between items-center gap-4">
            <div>
              <div className="text-[13px] text-[var(--text-secondary)]">Total Spent</div>
              <div className="text-[32px] font-bold tracking-tight">{formatAmount(monthTotal)}</div>
              <div className="text-[13px] text-[var(--text-secondary)]">
                {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="text-center px-4 py-3 bg-[var(--bg)] rounded-xl min-w-[90px]">
              <div className="text-[12px] text-[var(--text-secondary)] mb-1">Today</div>
              <div className="text-xl font-bold">{formatAmount(todayTotal)}</div>
            </div>
          </div>
          
          {/* Budget Progress */}
          {budgetStatus && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full transition-all',
                    budgetStatus.status === 'ok' && 'bg-[var(--teal-green)]',
                    budgetStatus.status === 'warning' && 'bg-orange-400',
                    budgetStatus.status === 'over' && 'bg-[var(--danger)]'
                  )}
                  style={{ width: `${Math.min(budgetStatus.percent, 100)}%` }}
                />
              </div>
              <div className="text-[12px] text-[var(--text-secondary)] mt-1">
                {budgetStatus.status === 'over' 
                  ? `Over budget by ${formatAmount(-budgetStatus.remaining)}`
                  : `${formatAmount(budgetStatus.remaining)} left`
                }
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2.5 bg-[var(--bg)] rounded-xl px-3.5 py-2.5 mb-3">
          <span className="text-[15px] opacity-50">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search expenses..."
            className="flex-1 bg-transparent border-none outline-none text-[16px]"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.icon}
              onClick={() => setCategoryFilter(cat.icon)}
              className={cn(
                'flex-shrink-0 px-3.5 py-2 rounded-full text-[14px] font-medium transition-all',
                'shadow-sm',
                categoryFilter === cat.icon
                  ? 'bg-[var(--teal-green)] text-white'
                  : 'bg-[var(--white)] text-[var(--text)]'
              )}
            >
              {cat.icon !== 'all' && <span className="mr-1">{cat.icon}</span>}
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(80px+env(safe-area-inset-bottom))]">
        <ExpenseList 
          expenses={expenses} 
          loading={loading}
          newExpenseId={newExpenseId}
        />
      </div>
    </div>
  );
}
