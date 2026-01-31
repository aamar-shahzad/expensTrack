import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '@/types';
import { CURRENCIES } from '@/types';

interface SettingsState extends Settings {
  debugMode: boolean;
  
  // Actions
  setCurrency: (currency: string) => void;
  setMonthlyBudget: (budget: number) => void;
  setDarkMode: (enabled: boolean) => void;
  setDebugMode: (enabled: boolean) => void;
  setCategoryBudget: (category: string, amount: number) => void;
  removeCategoryBudget: (category: string) => void;
  formatAmount: (amount: number) => string;
  getBudgetStatus: (spent: number) => { percent: number; remaining: number; status: 'ok' | 'warning' | 'over' } | null;
  getCurrencyInfo: () => typeof CURRENCIES[0] | undefined;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      currency: '$',
      monthlyBudget: 0,
      darkMode: false,
      debugMode: false,
      categoryBudgets: {},

      setCurrency: (currency) => {
        set({ currency });
      },

      setMonthlyBudget: (monthlyBudget) => {
        set({ monthlyBudget });
      },

      setDarkMode: (darkMode) => {
        set({ darkMode });
        // Apply to document
        if (darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },

      setDebugMode: (debugMode) => {
        set({ debugMode });
        if (debugMode) {
          console.log('[Sync] Debug mode enabled - sync events will be logged');
        }
      },

      setCategoryBudget: (category, amount) => {
        set(state => ({
          categoryBudgets: { ...state.categoryBudgets, [category]: amount }
        }));
      },

      removeCategoryBudget: (category) => {
        set(state => {
          const { [category]: _, ...rest } = state.categoryBudgets;
          return { categoryBudgets: rest };
        });
      },

      formatAmount: (amount) => {
        const { currency } = get();
        return `${currency}${amount.toFixed(2)}`;
      },

      getBudgetStatus: (spent) => {
        const { monthlyBudget } = get();
        if (!monthlyBudget || monthlyBudget <= 0) return null;
        
        const percent = Math.min((spent / monthlyBudget) * 100, 100);
        const remaining = monthlyBudget - spent;
        
        let status: 'ok' | 'warning' | 'over' = 'ok';
        if (percent >= 100) status = 'over';
        else if (percent >= 80) status = 'warning';
        
        return { percent, remaining, status };
      },

      getCurrencyInfo: () => {
        const { currency } = get();
        return CURRENCIES.find(c => c.symbol === currency);
      }
    }),
    {
      name: 'expense-tracker-settings',
      onRehydrateStorage: () => (state) => {
        // Apply dark mode on rehydration
        if (state?.darkMode) {
          document.documentElement.classList.add('dark');
        }
      }
    }
  )
);
