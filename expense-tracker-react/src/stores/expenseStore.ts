import { create } from 'zustand';
import type { Expense } from '@/types';
import { getCategoryIcon, generateId, getYearMonth } from '@/types';

interface ExpenseState {
  expenses: Expense[];
  allExpenses: Expense[];
  loading: boolean;
  currentMonth: number;
  currentYear: number;
  categoryFilter: string;
  searchQuery: string;
  newExpenseId: string | null;
  
  // Actions
  setExpenses: (expenses: Expense[]) => void;
  setAllExpenses: (expenses: Expense[]) => void;
  setLoading: (loading: boolean) => void;
  setMonth: (month: number, year: number) => void;
  navigateMonth: (direction: number) => void;
  setCategoryFilter: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setNewExpenseId: (id: string | null) => void;
  getFilteredExpenses: () => Expense[];
  getTotalForMonth: () => number;
  getTodayTotal: () => number;
  getExpensesByMonth: (month: number, year: number) => Expense[];
  
  // Legacy methods that now work with Yjs (called from useYjsSync)
  addExpenseToStore: (expense: Expense) => void;
  updateExpenseInStore: (id: string, updates: Partial<Expense>) => void;
  deleteExpenseFromStore: (id: string) => void;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  allExpenses: [],
  loading: false,
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  categoryFilter: 'all',
  searchQuery: '',
  newExpenseId: null,

  // Set expenses from Yjs observer
  setExpenses: (expenses) => {
    set({ expenses });
  },

  // Set all expenses from Yjs observer
  setAllExpenses: (allExpenses) => {
    set({ allExpenses, loading: false });
  },

  setLoading: (loading) => {
    set({ loading });
  },

  // Add expense to local store (called after Yjs add)
  addExpenseToStore: (expense) => {
    set(state => ({
      expenses: [expense, ...state.expenses],
      allExpenses: [expense, ...state.allExpenses],
      newExpenseId: expense.id
    }));
  },

  // Update expense in local store (called after Yjs update)
  updateExpenseInStore: (id, updates) => {
    const updatedExpense = { ...updates, updatedAt: Date.now() };
    set(state => ({
      expenses: state.expenses.map(e => 
        e.id === id ? { ...e, ...updatedExpense } : e
      ),
      allExpenses: state.allExpenses.map(e => 
        e.id === id ? { ...e, ...updatedExpense } : e
      )
    }));
  },

  // Delete expense from local store (called after Yjs delete)
  deleteExpenseFromStore: (id) => {
    set(state => ({
      expenses: state.expenses.filter(e => e.id !== id),
      allExpenses: state.allExpenses.filter(e => e.id !== id)
    }));
  },

  setMonth: (month, year) => {
    set({ currentMonth: month, currentYear: year });
    // Filter expenses for the new month from allExpenses
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const { allExpenses } = get();
    const monthExpenses = allExpenses
      .filter(e => e.yearMonth === yearMonth)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    set({ expenses: monthExpenses });
  },

  navigateMonth: (direction) => {
    const { currentMonth, currentYear } = get();
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    
    get().setMonth(newMonth, newYear);
  },

  setCategoryFilter: (category) => {
    set({ categoryFilter: category });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setNewExpenseId: (id) => {
    set({ newExpenseId: id });
  },

  getFilteredExpenses: () => {
    const { expenses, categoryFilter, searchQuery } = get();
    
    let filtered = expenses;
    
    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(e => getCategoryIcon(e.description) === categoryFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.description.toLowerCase().includes(query) ||
        e.tags?.toLowerCase().includes(query) ||
        e.notes?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  },

  getExpensesByMonth: (month, year) => {
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const { allExpenses } = get();
    return allExpenses
      .filter(e => e.yearMonth === yearMonth)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getTotalForMonth: () => {
    return get().expenses.reduce((sum, e) => sum + e.amount, 0);
  },

  getTodayTotal: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().expenses
      .filter(e => e.date === today)
      .reduce((sum, e) => sum + e.amount, 0);
  }
}));
