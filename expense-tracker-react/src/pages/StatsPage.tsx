import { useEffect, useMemo } from 'react';
import { useExpenseStore } from '@/stores/expenseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { PageLoading } from '@/components/ui';
import { cn } from '@/lib/utils';
import { getCategoryKey, getCategoryLabel } from '@/types';

/** Round to 2 decimal places for currency to avoid float drift */
function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function StatsPage() {
  const { expenses, allExpenses, loadAllExpenses, loading } = useExpenseStore();
  const formatAmount = useSettingsStore(s => s.formatAmount);
  const monthlyBudget = useSettingsStore(s => s.monthlyBudget);
  const getBudgetStatus = useSettingsStore(s => s.getBudgetStatus);

  useEffect(() => {
    loadAllExpenses();
  }, [loadAllExpenses]);

  // Current calendar month (YYYY-MM) for budget comparison
  const currentYearMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // This month's total for budget: sum only expenses in current calendar month, rounded
  const thisMonthSpent = useMemo(() => {
    const sum = allExpenses
      .filter(e => (e.date && e.date.length >= 7) && e.date.substring(0, 7) === currentYearMonth)
      .reduce((acc, e) => acc + e.amount, 0);
    return roundCurrency(sum);
  }, [allExpenses, currentYearMonth]);

  const budgetStatus = monthlyBudget > 0 ? getBudgetStatus(thisMonthSpent) : null;

  // Calculate stats (use all expenses for overview; category/monthly use full set)
  const stats = useMemo(() => {
    if (expenses.length === 0 && allExpenses.length === 0) return null;
    const source = allExpenses.length > 0 ? allExpenses : expenses;

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    let totalAmount = 0;

    source.forEach(exp => {
      const key = getCategoryKey(exp.description ?? '');
      const amt = roundCurrency(exp.amount);
      categoryTotals[key] = roundCurrency((categoryTotals[key] || 0) + amt);
      totalAmount = roundCurrency(totalAmount + amt);
    });

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([key, amount]) => ({
        key,
        amount,
        percent: totalAmount > 0 ? roundCurrency((amount / totalAmount) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Monthly trend
    const monthlyTotals: Record<string, number> = {};
    source.forEach(exp => {
      const month = (exp.date ?? '').substring(0, 7);
      if (month.length === 7) {
        monthlyTotals[month] = roundCurrency((monthlyTotals[month] || 0) + exp.amount);
      }
    });

    const months = Object.entries(monthlyTotals)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6);

    const maxMonthly = months.length > 0 ? Math.max(...months.map(m => m[1])) : 0;

    // Average per day (guard against no valid dates)
    const dates = new Set(source.map(e => e.date).filter(Boolean));
    const avgPerDay = dates.size > 0 ? roundCurrency(totalAmount / dates.size) : 0;

    // Top expenses
    const topExpenses = [...source]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      totalAmount,
      expenseCount: source.length,
      categoryBreakdown,
      months,
      maxMonthly,
      avgPerDay,
      topExpenses
    };
  }, [expenses, allExpenses]);

  if (loading) {
    return <PageLoading message="Loading statistics..." />;
  }

  if (!stats) {
    return (
      <div className="h-full bg-[var(--bg)] safe-top">
        <div className="px-4 pt-4 pb-3">
          <h1 className="text-2xl font-bold mb-2">Statistics</h1>
        </div>
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-semibold mb-2">No data yet</h3>
          <p className="text-[var(--text-secondary)]">
            Add some expenses to see your stats
          </p>
        </div>
      </div>
    );
  }

  const budgetPercent = monthlyBudget > 0 ? Math.min(100, roundCurrency((thisMonthSpent / monthlyBudget) * 100)) : 0;

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 safe-top">
        <h1 className="text-2xl font-bold mb-2">Statistics</h1>
        <p className="text-[var(--text-secondary)] text-sm">
          Your spending insights
        </p>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(90px+env(safe-area-inset-bottom))]">

      {/* This month vs budget */}
      {monthlyBudget > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">This month vs budget</h2>
          <div className="bg-[var(--white)] rounded-xl p-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-[var(--text-secondary)] text-sm">Spent</span>
              <span className="font-semibold">{formatAmount(thisMonthSpent)} of {formatAmount(monthlyBudget)}</span>
            </div>
            <div className="h-2.5 bg-[var(--bg)] rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  budgetStatus?.status === 'over' && 'bg-[var(--danger)]',
                  budgetStatus?.status === 'warning' && 'bg-orange-400',
                  (budgetStatus?.status === 'ok' || !budgetStatus) && 'bg-[var(--teal-green)]'
                )}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
            <div className="text-[13px] text-[var(--text-secondary)] mt-1.5">
              {budgetStatus?.status === 'over'
                ? `Over by ${formatAmount(roundCurrency(thisMonthSpent - monthlyBudget))}`
                : budgetStatus ? `${formatAmount(roundCurrency(monthlyBudget - thisMonthSpent))} left` : null}
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[var(--white)] rounded-xl p-4">
          <div className="text-[13px] text-[var(--text-secondary)] mb-1">Total Spent</div>
          <div className="text-2xl font-bold">{formatAmount(stats.totalAmount)}</div>
        </div>
        <div className="bg-[var(--white)] rounded-xl p-4">
          <div className="text-[13px] text-[var(--text-secondary)] mb-1">Avg per Day</div>
          <div className="text-2xl font-bold">{formatAmount(stats.avgPerDay)}</div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">By Category</h2>
        <div className="bg-[var(--white)] rounded-xl p-4 space-y-3">
          {stats.categoryBreakdown.map(cat => (
            <div key={cat.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{getCategoryLabel(cat.key)}</span>
                <span className="text-sm font-medium">{formatAmount(cat.amount)}</span>
              </div>
              <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--teal-green)] rounded-full transition-all"
                  style={{ width: `${cat.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Monthly Trend</h2>
        <div className="bg-[var(--white)] rounded-xl p-4">
          <div className="flex items-end gap-2 h-32">
            {stats.months.map(([month, amount]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-[var(--teal-green)] rounded-t-md transition-all"
                  style={{ height: `${(amount / stats.maxMonthly) * 100}%`, minHeight: 4 }}
                />
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {month.split('-')[1]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Expenses */}
      <div className="px-4">
        <h2 className="text-lg font-semibold mb-3">Top Expenses</h2>
        <div className="bg-[var(--white)] rounded-xl divide-y divide-[var(--border)]">
          {stats.topExpenses.map((exp, i) => (
            <div key={exp.id} className="flex items-center gap-3 p-4">
              <span className="text-lg font-bold text-[var(--text-secondary)] w-6">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{exp.description}</div>
                <div className="text-sm text-[var(--text-secondary)]">{exp.date}</div>
              </div>
              <span className="font-semibold">{formatAmount(exp.amount)}</span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
