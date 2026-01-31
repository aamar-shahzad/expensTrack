import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account } from '@/types';
import { generateId } from '@/types';
import { initDB, closeDB } from '@/db/schema';

interface AccountState {
  accounts: Account[];
  currentAccountId: string | null;
  selfPersonId: string | null; // Which person in the people list is "me" on this device
  isOnboarded: boolean;
  
  // Actions
  createAccount: (name: string, mode: 'single' | 'shared', currency: string, hostDeviceId?: string) => Account;
  createAccountWithId: (id: string, name: string, mode: 'single' | 'shared', currency: string, hostDeviceId?: string) => Account;
  deleteAccount: (id: string) => void;
  setCurrentAccount: (id: string) => Promise<void>;
  getCurrentAccount: () => Account | undefined;
  isSharedMode: () => boolean;
  setOnboarded: (value: boolean) => void;
  setSelfPersonId: (personId: string | null) => void;
  getSelfPersonId: () => string | null;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      accounts: [],
      currentAccountId: null,
      selfPersonId: null,
      isOnboarded: false,

      createAccount: (name, mode, currency, hostDeviceId) => {
        const account: Account = {
          id: generateId(),
          name,
          mode,
          currency,
          createdAt: Date.now(),
          ...(mode === 'shared' && hostDeviceId != null && { hostDeviceId })
        };

        set(state => ({
          accounts: [...state.accounts, account]
        }));

        return account;
      },

      // Create account with a specific ID (used when joining an existing group)
      createAccountWithId: (id, name, mode, currency, hostDeviceId) => {
        const existing = get().accounts.find(a => a.id === id);
        if (existing) {
          if (hostDeviceId != null) {
            set(state => ({
              accounts: state.accounts.map(a =>
                a.id === id ? { ...a, hostDeviceId } : a
              )
            }));
          }
          return existing;
        }

        const account: Account = {
          id,
          name,
          mode,
          currency,
          createdAt: Date.now(),
          ...(hostDeviceId != null && { hostDeviceId })
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
            : state.currentAccountId,
          selfPersonId: state.currentAccountId === id ? null : state.selfPersonId
        }));
      },

      setCurrentAccount: async (id) => {
        const state = get();
        const account = state.accounts.find(a => a.id === id);
        if (!account) return;
        const isSwitch = state.currentAccountId !== null && state.currentAccountId !== id;
        closeDB();
        await initDB(id);
        set({
          currentAccountId: id,
          // Clear per-account identity when switching so we don't show wrong "you" on the new account
          ...(isSwitch && { selfPersonId: null }),
        });
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
      },

      setSelfPersonId: (personId) => {
        set({ selfPersonId: personId });
      },

      getSelfPersonId: () => {
        return get().selfPersonId;
      }
    }),
    {
      name: 'expense-tracker-accounts'
    }
  )
);
