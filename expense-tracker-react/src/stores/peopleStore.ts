import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person } from '@/types';

interface PeopleState {
  people: Person[];
  loading: boolean;
  lastPayerId: string | null;
  
  // Actions
  setPeople: (people: Person[]) => void;
  setLoading: (loading: boolean) => void;
  addPersonToStore: (person: Person) => void;
  updatePersonInStore: (id: string, updates: Partial<Person>) => void;
  deletePersonFromStore: (id: string) => void;
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

      // Set people from Yjs observer
      setPeople: (people) => {
        set({ people, loading: false });
      },

      setLoading: (loading) => {
        set({ loading });
      },

      // Add person to local store (called after Yjs add)
      addPersonToStore: (person) => {
        set(state => ({
          people: [...state.people, person]
        }));
      },

      // Update person in local store (called after Yjs update)
      updatePersonInStore: (id, updates) => {
        set(state => ({
          people: state.people.map(p => 
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          )
        }));
      },

      // Delete person from local store (called after Yjs delete)
      deletePersonFromStore: (id) => {
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
