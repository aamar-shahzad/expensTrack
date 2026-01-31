import { createContext, useContext, useCallback } from 'react';
import { useYjs } from '@/sync';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { usePaymentStore } from '@/stores/paymentStore';
import type { Expense, Person, Payment } from '@/types';

/** Manual refresh: re-read from Yjs doc into stores (e.g. if other peer's list feels stale) */
const SyncActionsContext = createContext<{ refreshStores: () => void } | null>(null);

export function useSyncActions() {
  return useContext(SyncActionsContext);
}

export function SyncActionsProvider({ children }: { children: React.ReactNode }) {
  const { ydoc } = useYjs();
  const setAllExpenses = useExpenseStore(s => s.setAllExpenses);
  const setPeople = usePeopleStore(s => s.setPeople);
  const setPayments = usePaymentStore(s => s.setPayments);

  const refreshStores = useCallback(() => {
    const yExpenses = ydoc.getArray<Expense>('expenses');
    const yPeople = ydoc.getArray<Person>('people');
    const yPayments = ydoc.getArray<Payment>('payments');
    setAllExpenses(yExpenses.toArray());
    setPeople(yPeople.toArray());
    setPayments(yPayments.toArray());
  }, [ydoc, setAllExpenses, setPeople, setPayments]);

  return (
    <SyncActionsContext.Provider value={{ refreshStores }}>
      {children}
    </SyncActionsContext.Provider>
  );
}
