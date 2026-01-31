import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExpenseList } from '@/components/expenses';
import { useExpenseStore } from '@/stores/expenseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAccountStore } from '@/stores/accountStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useSyncActions } from '@/contexts/SyncActionsContext';
import { cn } from '@/lib/utils';

const PULL_THRESHOLD = 56;
const MAX_PULL_DISPLAY = 80;

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'food', label: 'Food' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'shop', label: 'Shop' },
  { key: 'travel', label: 'Travel' },
  { key: 'home', label: 'Home' },
  { key: 'fun', label: 'Fun' },
  { key: 'other', label: 'Other' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'];

export function HomePage() {
  const navigate = useNavigate();
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
  const isConnected = useSyncStore(s => s.isConnected);
  const isSharedMode = useAccountStore(s => s.isSharedMode());
  const selfPersonId = useAccountStore(s => s.selfPersonId);
  const people = usePeopleStore(s => s.people);
  const syncActions = useSyncActions();

  const needsWhoAreYou = isSharedMode && !selfPersonId && people.length > 0;

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

  const [refreshing, setRefreshing] = useState(false);
  const [pullDelta, setPullDelta] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  const doRefresh = useCallback(() => {
    setRefreshing(true);
    syncActions?.refreshStores();
    loadExpenses();
    window.setTimeout(() => setRefreshing(false), 400);
  }, [syncActions, loadExpenses]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current?.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullingRef.current || scrollRef.current?.scrollTop !== 0) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) setPullDelta(Math.min(delta, MAX_PULL_DISPLAY));
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pullDelta >= PULL_THRESHOLD) doRefresh();
    pullingRef.current = false;
    setPullDelta(0);
  }, [pullDelta, doRefresh]);

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
          {isSharedMode && (
            <span className="flex items-center gap-2">
              {isConnected && (
                <span className="flex items-center gap-1.5 text-[11px] text-[var(--teal-green)] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[var(--teal-green)] animate-pulse" />
                  Live
                </span>
              )}
              <button
                type="button"
                onClick={() => syncActions?.refreshStores()}
                className="w-8 h-8 rounded-full bg-[var(--white)] flex items-center justify-center text-[var(--teal-green)] text-sm shadow-sm active:scale-90 transition-transform"
                title="Refresh list from sync"
                aria-label="Refresh list"
              >
                ↻
              </button>
            </span>
          )}
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

        {/* Set who you are (shared account, switched and no identity yet) */}
        {needsWhoAreYou && (
          <button
            type="button"
            onClick={() => navigate('/sync')}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 mb-3 rounded-xl bg-[var(--teal-green)]/15 border border-[var(--teal-green)]/30 text-[var(--teal-green)] text-left"
          >
            <span className="text-[14px] font-medium">Set who you are in this group</span>
            <span className="text-[var(--teal-green)]">→</span>
          </button>
        )}

        {/* Search */}
        <div className="flex items-center gap-2.5 bg-[var(--bg)] rounded-xl px-3.5 py-2.5 mb-3">
          <span className="text-[15px] opacity-50">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search expenses..."
            className="flex-1 bg-transparent border-none outline-none text-[16px] min-w-0"
            aria-label="Search expenses"
          />
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--border)]/50 active:opacity-80"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key)}
              className={cn(
                'flex-shrink-0 px-3.5 py-2 rounded-full text-[14px] font-medium transition-all',
                'shadow-sm',
                categoryFilter === cat.key
                  ? 'bg-[var(--teal-green)] text-white'
                  : 'bg-[var(--white)] text-[var(--text)]'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content with pull-to-refresh */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(80px+env(safe-area-inset-bottom))]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex items-center justify-center shrink-0 transition-[height] duration-150 ease-out bg-[var(--bg)]"
          style={{ height: refreshing ? 52 : Math.min(pullDelta * 0.6, 52) }}
        >
          {refreshing ? (
            <span className="text-[13px] text-[var(--text-secondary)] flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-[var(--teal-green)] border-t-transparent rounded-full animate-spin" />
              Refreshing…
            </span>
          ) : pullDelta > 0 ? (
            <span className="text-[13px] text-[var(--text-secondary)]">
              {pullDelta >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          ) : null}
        </div>
        <ExpenseList
          expenses={expenses}
          loading={loading}
          newExpenseId={newExpenseId}
          isFilteredEmpty={expenses.length === 0 && (searchQuery.trim() !== '' || categoryFilter !== 'all')}
          onClearFilters={() => { setSearchQuery(''); setCategoryFilter('all'); }}
          onAddExpense={() => navigate('/add')}
        />
      </div>
    </div>
  );
}
