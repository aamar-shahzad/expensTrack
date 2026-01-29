import { create } from 'zustand';
import type { Expense } from '@/types';
import { getCategoryIcon } from '@/types';
import * as db from '@/db/operations';

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
  loadExpenses: () => Promise<void>;
  loadAllExpenses: () => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'syncId' | 'syncStatus' | 'yearMonth' | 'createdAt'>) => Promise<Expense>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  duplicateExpense: (id: string) => Promise<Expense | null>;
  setMonth: (month: number, year: number) => void;
  navigateMonth: (direction: number) => void;
  setCategoryFilter: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setNewExpenseId: (id: string | null) => void;
  getFilteredExpenses: () => Expense[];
  getTotalForMonth: () => number;
  getTodayTotal: () => number;
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

  loadExpenses: async () => {
    set({ loading: true });
    try {
      const { currentMonth, currentYear } = get();
      const expenses = await db.getExpensesByMonth(currentMonth, currentYear);
      set({ expenses, loading: false });
    } catch (error) {
      console.error('Failed to load expenses:', error);
      set({ loading: false });
    }
  },

  loadAllExpenses: async () => {
    set({ loading: true });
    try {
      const allExpenses = await db.getAllExpenses();
      set({ allExpenses, loading: false });
    } catch (error) {
      console.error('Failed to load all expenses:', error);
      set({ loading: false });
    }
  },

  addExpense: async (expense) => {
    const saved = await db.addExpense(expense);
    set(state => ({
      expenses: [saved, ...state.expenses],
      newExpenseId: saved.id
    }));
    return saved;
  },

  updateExpense: async (id, updates) => {
    await db.updateExpense(id, updates);
    set(state => ({
      expenses: state.expenses.map(e => 
        e.id === id ? { ...e, ...updates } : e
      )
    }));
  },

  deleteExpense: async (id) => {
    await db.deleteExpense(id);
    set(state => ({
      expenses: state.expenses.filter(e => e.id !== id)
    }));
  },

  duplicateExpense: async (id) => {
    const expense = get().expenses.find(e => e.id === id);
    if (!expense) return null;
    
    const { id: _, syncId: __, syncStatus: ___, createdAt: ____, ...rest } = expense;
    const newExpense = await db.addExpense({
      ...rest,
      date: new Date().toISOString().split('T')[0]
    });
    
    set(state => ({
      expenses: [newExpense, ...state.expenses]
    }));
    
    return newExpense;
  },

  setMonth: (month, year) => {
    set({ currentMonth: month, currentYear: year });
    get().loadExpenses();
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
