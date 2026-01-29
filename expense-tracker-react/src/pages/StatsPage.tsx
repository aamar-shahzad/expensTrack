import { useEffect, useMemo } from 'react';
import { useExpenseStore } from '@/stores/expenseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getCategoryIcon } from '@/types';

export function StatsPage() {
  const { expenses, loadAllExpenses, loading } = useExpenseStore();
  const formatAmount = useSettingsStore(s => s.formatAmount);

  useEffect(() => {
    loadAllExpenses();
  }, [loadAllExpenses]);

  // Calculate stats
  const stats = useMemo(() => {
    if (expenses.length === 0) return null;

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    let totalAmount = 0;

    expenses.forEach(exp => {
      const icon = getCategoryIcon(exp.description);
      categoryTotals[icon] = (categoryTotals[icon] || 0) + exp.amount;
      totalAmount += exp.amount;
    });

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([icon, amount]) => ({
        icon,
        amount,
        percent: (amount / totalAmount) * 100
      }))
      .sort((a, b) => b.amount - a.amount);

    // Monthly trend
    const monthlyTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      const month = exp.date.substring(0, 7);
      monthlyTotals[month] = (monthlyTotals[month] || 0) + exp.amount;
    });

    const months = Object.entries(monthlyTotals)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6);

    const maxMonthly = Math.max(...months.map(m => m[1]));

    // Average per day
    const dates = new Set(expenses.map(e => e.date));
    const avgPerDay = totalAmount / dates.size;

    // Top expenses
    const topExpenses = [...expenses]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      totalAmount,
      expenseCount: expenses.length,
      categoryBreakdown,
      months,
      maxMonthly,
      avgPerDay,
      topExpenses
    };
  }, [expenses]);

  if (loading) {
    return (
      <div className="h-full bg-[var(--bg)] safe-top flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--teal-green)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
            <div key={cat.icon}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">{cat.icon}</span>
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
              <span className="text-xl">{getCategoryIcon(exp.description)}</span>
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
