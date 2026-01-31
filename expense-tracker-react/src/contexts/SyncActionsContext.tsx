import { createContext, useContext, useCallback } from 'react';
import { useYjs } from '@/sync';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { useSyncStore } from '@/stores/syncStore';
import type { Expense, Person, Payment } from '@/types';

/** Manual refresh + connection retry */
const SyncActionsContext = createContext<{
  refreshStores: () => void;
  retryConnection: () => void;
} | null>(null);

export function useSyncActions() {
  return useContext(SyncActionsContext);
}

export function SyncActionsProvider({ children }: { children: React.ReactNode }) {
  const { ydoc, connect, disconnect } = useYjs();
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

  const retryConnection = useCallback(() => {
    const p = useSyncStore.getState().lastConnectParams;
    if (p) {
      disconnect();
      connect(p.roomName, { deviceId: p.deviceId, hostDeviceId: p.hostDeviceId });
    }
  }, [connect, disconnect]);

  return (
    <SyncActionsContext.Provider value={{ refreshStores, retryConnection }}>
      {children}
    </SyncActionsContext.Provider>
  );
}
