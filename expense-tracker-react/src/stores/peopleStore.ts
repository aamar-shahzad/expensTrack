import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person } from '@/types';
import * as db from '@/db/operations';

interface PeopleState {
  people: Person[];
  loading: boolean;
  lastPayerId: string | null;
  
  // Actions
  loadPeople: () => Promise<void>;
  addPerson: (name: string, claimedBy?: string) => Promise<Person>;
  updatePerson: (id: string, name: string) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  claimPerson: (id: string, deviceId: string) => Promise<void>;
  setLastPayer: (id: string) => void;
  getPersonName: (id: string) => string;
  isPersonClaimed: (id: string, currentDeviceId: string) => boolean;
}

export const usePeopleStore = create<PeopleState>()(
  persist(
    (set, get) => ({
      people: [],
      loading: false,
      lastPayerId: null,

      loadPeople: async () => {
        set({ loading: true });
        try {
          const people = await db.getAllPeople();
          set({ people, loading: false });
        } catch (error) {
          console.error('Failed to load people:', error);
          set({ loading: false });
        }
      },

      addPerson: async (name, claimedBy) => {
        const person = await db.addPerson({ name, claimedBy });
        set(state => ({
          people: [...state.people, person]
        }));
        return person;
      },

      updatePerson: async (id, name) => {
        await db.updatePerson(id, { name });
        set(state => ({
          people: state.people.map(p => 
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
          )
        }));
      },

      deletePerson: async (id) => {
        // Check if person is referenced before deleting
        const { referenced, expenseCount, paymentCount } = await db.isPersonReferenced(id);
        if (referenced) {
          throw new Error(
            `Cannot delete: This person is referenced by ${expenseCount} expense(s) and ${paymentCount} payment(s). ` +
            `Please reassign or delete those first.`
          );
        }
        
        await db.deletePerson(id);
        set(state => ({
          people: state.people.filter(p => p.id !== id),
          lastPayerId: state.lastPayerId === id ? null : state.lastPayerId
        }));
      },

      claimPerson: async (id, deviceId) => {
        await db.claimPerson(id, deviceId);
        set(state => ({
          people: state.people.map(p => 
            p.id === id ? { ...p, claimedBy: deviceId, updatedAt: Date.now() } : p
          )
        }));
      },

      setLastPayer: (id) => {
        set({ lastPayerId: id });
      },

      getPersonName: (id) => {
        const person = get().people.find(p => p.id === id);
        return person?.name || 'Unknown';
      },

      // Check if a person is claimed by someone else (not current device)
      isPersonClaimed: (id, currentDeviceId) => {
        const person = get().people.find(p => p.id === id);
        return person?.claimedBy !== undefined && person.claimedBy !== currentDeviceId;
      }
    }),
    {
      name: 'expense-tracker-people',
      partialize: (state) => ({ lastPayerId: state.lastPayerId })
    }
  )
);
