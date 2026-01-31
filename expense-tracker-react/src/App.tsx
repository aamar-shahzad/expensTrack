import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider, BottomNav, FAB } from '@/components/ui';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useExpenseStore, setYjsExpenseOperations } from '@/stores/expenseStore';
import { usePeopleStore, setYjsPeopleOperations } from '@/stores/peopleStore';
import { usePaymentStore, setYjsPaymentOperations } from '@/stores/paymentStore';
import { useSyncStore } from '@/stores/syncStore';
import { useOffline } from '@/hooks/useOffline';
import { initDB, isDBInitialized } from '@/db/schema';
import { YjsProvider, useYjs, migrateToYjs, isMigrationComplete } from '@/sync';
import type { Expense, Person, Payment } from '@/types';
import { generateId, getYearMonth } from '@/types';
import {
  HomePage,
  AddExpensePage,
  ExpenseDetailPage,
  PeoplePage,
  StatsPage,
  SettlePage,
  SyncPage,
  SettingsPage,
  OnboardingPage,
  JoinFromLinkHandler
} from '@/pages';
import { CameraCapture } from '@/components/camera/CameraCapture';

// Component to sync Yjs data with Zustand stores
function YjsStoreSync() {
  const { ydoc, isConnected, isSynced, connectedPeers, connect, setAwareness } = useYjs();
  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const selfPersonId = useAccountStore(s => s.selfPersonId);
  const people = usePeopleStore(s => s.people);
  const deviceId = useSyncStore(s => s.deviceId);
  
  const setAllExpenses = useExpenseStore(s => s.setAllExpenses);
  const setPeople = usePeopleStore(s => s.setPeople);
  const setPayments = usePaymentStore(s => s.setPayments);
  const setConnected = useSyncStore(s => s.setConnected);
  const setSynced = useSyncStore(s => s.setSynced);
  const setConnectedPeers = useSyncStore(s => s.setConnectedPeers);
  
  // Set up Yjs operations for stores
  useEffect(() => {
    const yExpenses = ydoc.getArray<Expense>('expenses');
    const yPeople = ydoc.getArray<Person>('people');
    const yPayments = ydoc.getArray<Payment>('payments');
    
    // Wire up expense operations
    setYjsExpenseOperations({
      addExpense: (expense) => {
        const newExpense: Expense = {
          ...expense,
          id: generateId(),
          syncId: generateId(),
          syncStatus: 'synced',
          yearMonth: getYearMonth(expense.date),
          createdAt: Date.now()
        };
        ydoc.transact(() => {
          yExpenses.push([newExpense]);
        });
        return newExpense;
      },
      updateExpense: (id, updates) => {
        ydoc.transact(() => {
          const arr = yExpenses.toArray();
          const index = arr.findIndex(e => e.id === id);
          if (index !== -1) {
            const existing = arr[index];
            const updated = { ...existing, ...updates, updatedAt: Date.now() };
            yExpenses.delete(index, 1);
            yExpenses.insert(index, [updated]);
          }
        });
      },
      deleteExpense: (id) => {
        ydoc.transact(() => {
          const arr = yExpenses.toArray();
          const index = arr.findIndex(e => e.id === id);
          if (index !== -1) {
            yExpenses.delete(index, 1);
          }
        });
      }
    });
    
    // Wire up people operations
    setYjsPeopleOperations({
      addPerson: (name, claimedBy) => {
        const newPerson: Person = {
          id: generateId(),
          name,
          syncId: generateId(),
          createdAt: Date.now(),
          claimedBy
        };
        ydoc.transact(() => {
          yPeople.push([newPerson]);
        });
        return newPerson;
      },
      updatePerson: (id, updates) => {
        ydoc.transact(() => {
          const arr = yPeople.toArray();
          const index = arr.findIndex(p => p.id === id);
          if (index !== -1) {
            const existing = arr[index];
            const updated = { ...existing, ...updates, updatedAt: Date.now() };
            yPeople.delete(index, 1);
            yPeople.insert(index, [updated]);
          }
        });
      },
      deletePerson: (id) => {
        ydoc.transact(() => {
          const arr = yPeople.toArray();
          const index = arr.findIndex(p => p.id === id);
          if (index !== -1) {
            yPeople.delete(index, 1);
          }
        });
      },
      claimPerson: (id, deviceId) => {
        ydoc.transact(() => {
          const arr = yPeople.toArray();
          const index = arr.findIndex(p => p.id === id);
          if (index !== -1) {
            const existing = arr[index];
            const updated = { ...existing, claimedBy: deviceId, updatedAt: Date.now() };
            yPeople.delete(index, 1);
            yPeople.insert(index, [updated]);
          }
        });
      }
    });
    
    // Wire up payment operations
    setYjsPaymentOperations({
      addPayment: (payment) => {
        const newPayment: Payment = {
          ...payment,
          id: generateId(),
          syncId: generateId(),
          createdAt: Date.now()
        };
        ydoc.transact(() => {
          yPayments.push([newPayment]);
        });
        return newPayment;
      },
      deletePayment: (id) => {
        ydoc.transact(() => {
          const arr = yPayments.toArray();
          const index = arr.findIndex(p => p.id === id);
          if (index !== -1) {
            yPayments.delete(index, 1);
          }
        });
      }
    });
    
    return () => {
      // Clear operations on unmount
      setYjsExpenseOperations({});
      setYjsPeopleOperations({});
      setYjsPaymentOperations({});
    };
  }, [ydoc]);
  
  // Sync Yjs arrays to Zustand stores
  useEffect(() => {
    const yExpenses = ydoc.getArray<Expense>('expenses');
    const yPeople = ydoc.getArray<Person>('people');
    const yPayments = ydoc.getArray<Payment>('payments');
    
    // Initial sync
    setAllExpenses(yExpenses.toArray());
    setPeople(yPeople.toArray());
    setPayments(yPayments.toArray());
    
    // Set up observers
    const expenseObserver = () => setAllExpenses(yExpenses.toArray());
    const peopleObserver = () => setPeople(yPeople.toArray());
    const paymentObserver = () => setPayments(yPayments.toArray());
    
    yExpenses.observe(expenseObserver);
    yPeople.observe(peopleObserver);
    yPayments.observe(paymentObserver);
    
    return () => {
      yExpenses.unobserve(expenseObserver);
      yPeople.unobserve(peopleObserver);
      yPayments.unobserve(paymentObserver);
    };
  }, [ydoc, setAllExpenses, setPeople, setPayments]);
  
  // Sync connection state
  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected, setConnected]);
  
  useEffect(() => {
    setSynced(isSynced);
  }, [isSynced, setSynced]);
  
  useEffect(() => {
    setConnectedPeers(connectedPeers);
  }, [connectedPeers, setConnectedPeers]);
  
  // Run migration on first load
  useEffect(() => {
    if (!isMigrationComplete()) {
      migrateToYjs(ydoc).then(result => {
        if (result.success) {
          console.log(`[App] Migration complete: ${result.migratedExpenses} expenses, ${result.migratedPeople} people, ${result.migratedPayments} payments`);
        } else {
          console.error('[App] Migration failed:', result.error);
        }
      });
    }
  }, [ydoc]);
  
  // Auto-connect to Yjs room for shared accounts (keeps creator discoverable for joiners)
  useEffect(() => {
    if (currentAccount?.mode === 'shared' && currentAccount.id) {
      const roomName = `expense-tracker-${currentAccount.id}`;
      connect(roomName);
      const selfPerson = people.find(p => p.id === selfPersonId);
      setAwareness({
        id: deviceId,
        name: selfPerson?.name || 'Unknown'
      });
    }
  }, [currentAccount?.mode, currentAccount?.id, connect, deviceId, selfPersonId, people, setAwareness]);
  
  return null;
}

function AppRoutes() {
  const isOnboarded = useAccountStore(s => s.isOnboarded);
  const currentAccountId = useAccountStore(s => s.currentAccountId);
  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const selfPersonId = useAccountStore(s => s.selfPersonId);

  // Initialize database when account changes
  useEffect(() => {
    if (currentAccountId && !isDBInitialized()) {
      initDB(currentAccountId);
    }
  }, [currentAccountId]);

  // If not onboarded, show onboarding
  if (!isOnboarded) {
    return (
      <>
        {/* Always render YjsStoreSync so Yjs operations work during onboarding */}
        <YjsStoreSync />
        <Routes>
          <Route path="*" element={<OnboardingPage />} />
        </Routes>
      </>
    );
  }

  // If shared account but no selfPersonId, force back to onboarding to select name
  // This handles edge cases where the app state is inconsistent
  if (currentAccount?.mode === 'shared' && !selfPersonId) {
    return (
      <>
        <YjsStoreSync />
        <Routes>
          <Route path="*" element={<OnboardingPage />} />
        </Routes>
      </>
    );
  }

  return (
    <>
      <YjsStoreSync />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/join" element={<JoinFromLinkHandler />} />
        <Route path="/add" element={<AddExpensePage />} />
        <Route path="/expense/:id" element={<ExpenseDetailPage />} />
        <Route path="/expense/:id/edit" element={<AddExpensePage />} />
        <Route path="/camera" element={<CameraCapture />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settle" element={<SettlePage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FAB />
      <BottomNav />
    </>
  );
}

function AppContent() {
  const currentAccountId = useAccountStore(s => s.currentAccountId);
  const dbName = currentAccountId ? `expense-tracker-yjs-${currentAccountId}` : 'expense-tracker-yjs-default';
  
  return (
    <YjsProvider dbName={dbName}>
      <AppRoutes />
    </YjsProvider>
  );
}

function App() {
  const darkMode = useSettingsStore(s => s.darkMode);

  // Apply dark mode on mount
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const isOffline = useOffline();

  // Subpath for GitHub Pages (e.g. /expensTrack); no trailing slash for React Router
  const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/'

  return (
    <BrowserRouter basename={basename}>
      <ToastProvider>
        <div className="h-full flex flex-col bg-[var(--bg)]">
          {isOffline && (
            <div className="bg-amber-500 text-white text-center py-2 text-sm font-medium safe-top">
              Offline
            </div>
          )}
          <AppContent />
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
