import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person } from '@/types';
import { generateId } from '@/types';

interface PeopleState {
  people: Person[];
  loading: boolean;
  lastPayerId: string | null;
  
  // Yjs integration
  setPeople: (people: Person[]) => void;
  setLoading: (loading: boolean) => void;
  
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

// Reference to Yjs operations (set by YjsStoreSync)
let yjsOperations: {
  addPerson?: (name: string, claimedBy?: string) => Person;
  updatePerson?: (id: string, updates: Partial<Person>) => void;
  deletePerson?: (id: string) => void;
  claimPerson?: (id: string, deviceId: string) => void;
} = {};

export function setYjsPeopleOperations(ops: typeof yjsOperations) {
  yjsOperations = ops;
}

export const usePeopleStore = create<PeopleState>()(
  persist(
    (set, get) => ({
      people: [],
      loading: false,
      lastPayerId: null,

      // Set people from Yjs observer (e.g. on account switch or sync)
      setPeople: (people) => {
        set(state => {
          const lastPayerId =
            state.lastPayerId && people.some(p => p.id === state.lastPayerId)
              ? state.lastPayerId
              : null;
          return { people, loading: false, lastPayerId };
        });
      },

      setLoading: (loading) => {
        set({ loading });
      },

      // Legacy load (data comes from Yjs now)
      loadPeople: async () => {
        set({ loading: false });
      },

      // Add person via Yjs
      addPerson: async (name, claimedBy) => {
        if (yjsOperations.addPerson) {
          const person = yjsOperations.addPerson(name, claimedBy);
          return person;
        }
        // Fallback: create locally
        const person: Person = {
          id: generateId(),
          name,
          syncId: generateId(),
          createdAt: Date.now(),
          claimedBy
        };
        set(state => ({
          people: [...state.people, person]
        }));
        return person;
      },

      // Update person via Yjs
      updatePerson: async (id, name) => {
        if (yjsOperations.updatePerson) {
          yjsOperations.updatePerson(id, { name });
          return;
        }
        // Fallback: update locally
        set(state => ({
          people: state.people.map(p => 
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
          )
        }));
      },

      // Delete person via Yjs
      deletePerson: async (id) => {
        // Check if person is referenced
        const { people } = get();
        const person = people.find(p => p.id === id);
        if (!person) return;
        
        if (yjsOperations.deletePerson) {
          yjsOperations.deletePerson(id);
          return;
        }
        // Fallback: delete locally
        set(state => ({
          people: state.people.filter(p => p.id !== id),
          lastPayerId: state.lastPayerId === id ? null : state.lastPayerId
        }));
      },

      // Claim person via Yjs
      claimPerson: async (id, deviceId) => {
        if (yjsOperations.claimPerson) {
          yjsOperations.claimPerson(id, deviceId);
          return;
        }
        // Fallback: update locally
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
