import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider, BottomNav, FAB } from '@/components/ui';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useOffline } from '@/hooks/useOffline';
import { initDB, isDBInitialized } from '@/db/schema';
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

function AppRoutes() {
  const isOnboarded = useAccountStore(s => s.isOnboarded);
  const currentAccountId = useAccountStore(s => s.currentAccountId);

  // Initialize database when account changes
  useEffect(() => {
    if (currentAccountId && !isDBInitialized()) {
      initDB(currentAccountId);
    }
  }, [currentAccountId]);

  if (!isOnboarded) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    );
  }

  return (
    <>
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
              📴 Offline
            </div>
          )}
          <AppRoutes />
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
