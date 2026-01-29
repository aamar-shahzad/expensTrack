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
  addPerson: (name: string) => Promise<Person>;
  updatePerson: (id: string, name: string) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  setLastPayer: (id: string) => void;
  getPersonName: (id: string) => string;
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

      addPerson: async (name) => {
        const person = await db.addPerson({ name });
        set(state => ({
          people: [...state.people, person]
        }));
        return person;
      },

      updatePerson: async (id, name) => {
        await db.updatePerson(id, { name });
        set(state => ({
          people: state.people.map(p => 
            p.id === id ? { ...p, name } : p
          )
        }));
      },

      deletePerson: async (id) => {
        await db.deletePerson(id);
        set(state => ({
          people: state.people.filter(p => p.id !== id),
          lastPayerId: state.lastPayerId === id ? null : state.lastPayerId
        }));
      },

      setLastPayer: (id) => {
        set({ lastPayerId: id });
      },

      getPersonName: (id) => {
        const person = get().people.find(p => p.id === id);
        return person?.name || 'Unknown';
      }
    }),
    {
      name: 'expense-tracker-people',
      partialize: (state) => ({ lastPayerId: state.lastPayerId })
    }
  )
);
