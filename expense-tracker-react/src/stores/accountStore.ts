import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account } from '@/types';
import { generateId } from '@/types';
import { initDB, closeDB } from '@/db/schema';

interface AccountState {
  accounts: Account[];
  currentAccountId: string | null;
  isOnboarded: boolean;
  
  // Actions
  createAccount: (name: string, mode: 'single' | 'shared', currency: string) => Account;
  deleteAccount: (id: string) => void;
  setCurrentAccount: (id: string) => Promise<void>;
  getCurrentAccount: () => Account | undefined;
  isSharedMode: () => boolean;
  setOnboarded: (value: boolean) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      accounts: [],
      currentAccountId: null,
      isOnboarded: false,

      createAccount: (name, mode, currency) => {
        const account: Account = {
          id: generateId(),
          name,
          mode,
          currency,
          createdAt: Date.now()
        };
        
        set(state => ({
          accounts: [...state.accounts, account]
        }));
        
        return account;
      },

      deleteAccount: (id) => {
        set(state => ({
          accounts: state.accounts.filter(a => a.id !== id),
          currentAccountId: state.currentAccountId === id 
            ? state.accounts.find(a => a.id !== id)?.id || null 
            : state.currentAccountId
        }));
      },

      setCurrentAccount: async (id) => {
        const account = get().accounts.find(a => a.id === id);
        if (account) {
          closeDB();
          await initDB(id);
          set({ currentAccountId: id });
        }
      },

      getCurrentAccount: () => {
        const { accounts, currentAccountId } = get();
        return accounts.find(a => a.id === currentAccountId);
      },

      isSharedMode: () => {
        const account = get().getCurrentAccount();
        return account?.mode === 'shared';
      },

      setOnboarded: (value) => {
        set({ isOnboarded: value });
      }
    }),
    {
      name: 'expense-tracker-accounts'
    }
  )
);
