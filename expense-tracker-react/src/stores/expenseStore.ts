import { create } from 'zustand';
import type { Expense } from '@/types';
import { getCategoryKey, generateId, getYearMonth } from '@/types';

interface ExpenseState {
  expenses: Expense[];
  allExpenses: Expense[];
  loading: boolean;
  currentMonth: number;
  currentYear: number;
  categoryFilter: string;
  searchQuery: string;
  newExpenseId: string | null;
  
  // Yjs integration - these are called by YjsStoreSync
  setExpenses: (expenses: Expense[]) => void;
  setAllExpenses: (expenses: Expense[]) => void;
  setLoading: (loading: boolean) => void;
  
  // Navigation
  setMonth: (month: number, year: number) => void;
  navigateMonth: (direction: number) => void;
  
  // Filters
  setCategoryFilter: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setNewExpenseId: (id: string | null) => void;
  
  // Getters
  getFilteredExpenses: () => Expense[];
  getTotalForMonth: () => number;
  getTodayTotal: () => number;
  getExpensesByMonth: (month: number, year: number) => Expense[];
  
  // Legacy actions (for backward compatibility during migration)
  loadExpenses: () => void;
  loadAllExpenses: () => void;
  addExpense: (expense: Omit<Expense, 'id' | 'syncId' | 'syncStatus' | 'yearMonth' | 'createdAt'>) => Promise<Expense>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  duplicateExpense: (id: string) => Promise<Expense | null>;
}

// Reference to Yjs operations (set by YjsStoreSync)
let yjsOperations: {
  addExpense?: (expense: Omit<Expense, 'id' | 'syncId' | 'syncStatus' | 'yearMonth' | 'createdAt'>) => Expense;
  updateExpense?: (id: string, updates: Partial<Expense>) => void;
  deleteExpense?: (id: string) => void;
} = {};

export function setYjsExpenseOperations(ops: typeof yjsOperations) {
  yjsOperations = ops;
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
    // Also update current month expenses
    const { currentMonth, currentYear } = get();
    const yearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthExpenses = allExpenses
      .filter(e => e.yearMonth === yearMonth)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    set({ allExpenses, expenses: monthExpenses, loading: false });
  },

  setLoading: (loading) => {
    set({ loading });
  },

  // Legacy load methods (now just trigger month filter)
  loadExpenses: () => {
    const { currentMonth, currentYear, allExpenses } = get();
    const yearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthExpenses = allExpenses
      .filter(e => e.yearMonth === yearMonth)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    set({ expenses: monthExpenses });
  },

  loadAllExpenses: () => {
    // Data is already loaded via Yjs, just ensure loading is false
    set({ loading: false });
  },

  // Add expense via Yjs
  addExpense: async (expense) => {
    if (yjsOperations.addExpense) {
      const newExpense = yjsOperations.addExpense(expense);
      // Only update store if the Yjs observer hasn't already (avoids duplicate: observer often runs sync)
      set(state => {
        const alreadyThere = state.allExpenses.some(e => e.id === newExpense.id);
        const newAll = alreadyThere
          ? state.allExpenses
          : [newExpense, ...state.allExpenses];
        const yearMonth = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}`;
        const monthExpenses = newAll
          .filter(e => e.yearMonth === yearMonth)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return { allExpenses: newAll, expenses: monthExpenses, newExpenseId: newExpense.id };
      });
      return newExpense;
    }
    // Fallback: create locally
    const newExpense: Expense = {
      ...expense,
      id: generateId(),
      syncId: generateId(),
      syncStatus: 'pending',
      yearMonth: getYearMonth(expense.date),
      createdAt: Date.now()
    };
    set(state => ({
      expenses: [newExpense, ...state.expenses],
      allExpenses: [newExpense, ...state.allExpenses],
      newExpenseId: newExpense.id
    }));
    return newExpense;
  },

  // Update expense via Yjs
  updateExpense: async (id, updates) => {
    if (yjsOperations.updateExpense) {
      yjsOperations.updateExpense(id, updates);
      return;
    }
    // Fallback: update locally
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

  // Delete expense via Yjs
  deleteExpense: async (id) => {
    if (yjsOperations.deleteExpense) {
      yjsOperations.deleteExpense(id);
      return;
    }
    // Fallback: delete locally
    set(state => ({
      expenses: state.expenses.filter(e => e.id !== id),
      allExpenses: state.allExpenses.filter(e => e.id !== id)
    }));
  },

  // Duplicate expense
  duplicateExpense: async (id) => {
    const expense = get().expenses.find(e => e.id === id) || get().allExpenses.find(e => e.id === id);
    if (!expense) return null;
    
    const { id: _, syncId: __, syncStatus: ___, createdAt: ____, ...rest } = expense;
    return get().addExpense({
      ...rest,
      date: new Date().toISOString().split('T')[0]
    });
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
      filtered = filtered.filter(e => getCategoryKey(e.description ?? '') === categoryFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        (e.description ?? '').toLowerCase().includes(query) ||
        (e.tags ?? '').toLowerCase().includes(query) ||
        (e.notes ?? '').toLowerCase().includes(query)
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
