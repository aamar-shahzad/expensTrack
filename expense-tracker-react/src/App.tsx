import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider, BottomNav, FAB } from '@/components/ui';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { useSyncStore } from '@/stores/syncStore';
import { useOffline } from '@/hooks/useOffline';
import { initDB, isDBInitialized } from '@/db/schema';
import { YjsProvider, useYjs, migrateToYjs, isMigrationComplete } from '@/sync';
import {
  HomePage,
  AddExpensePage,
  ExpenseDetailPage,
  PeoplePage,
  StatsPage,
  SettlePage,
  SyncPage,
  SettingsPage,
  OnboardingPage
} from '@/pages';
import { CameraCapture } from '@/components/camera/CameraCapture';

// Component to sync Yjs data with Zustand stores
function YjsStoreSync() {
  const { ydoc, expenses, people, payments, isConnected, isSynced, connectedPeers } = useYjs();
  
  const setAllExpenses = useExpenseStore(s => s.setAllExpenses);
  const setPeople = usePeopleStore(s => s.setPeople);
  const setPayments = usePaymentStore(s => s.setPayments);
  const setConnected = useSyncStore(s => s.setConnected);
  const setSynced = useSyncStore(s => s.setSynced);
  const setConnectedPeers = useSyncStore(s => s.setConnectedPeers);
  
  // Sync Yjs arrays to Zustand stores
  useEffect(() => {
    const yExpenses = ydoc.getArray('expenses');
    const yPeople = ydoc.getArray('people');
    const yPayments = ydoc.getArray('payments');
    
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
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    );
  }

  // If shared account but no selfPersonId, force back to onboarding to select name
  // This handles edge cases where the app state is inconsistent
  if (currentAccount?.mode === 'shared' && !selfPersonId) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    );
  }

  return (
    <>
      <YjsStoreSync />
      <Routes>
        <Route path="/" element={<HomePage />} />
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
