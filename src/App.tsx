import { useState, useEffect } from 'react';
import { AppProvider, useApp } from '@/store/AppContext';
import { ToastProvider } from '@/store/ToastContext';
import { AppLayout } from '@/components/Layout';
import { AuthPage } from '@/pages/AuthPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { FinancePage } from '@/pages/FinancePage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { TasksPage } from '@/pages/TasksPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { SpecialistsPage } from '@/pages/SpecialistsPage';
import { SubscriptionPage } from '@/pages/SubscriptionPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { Lock } from 'lucide-react';
import type { Page } from '@/types';

// Защитный компонент-заглушка для платных разделов
function Guard({ children, onNavigate }: { children: React.ReactNode; onNavigate: (p: Page) => void }) {
  const { state } = useApp();
  const userPlan = state.user?.plan || 'free';

  if (userPlan === 'free') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-4 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Доступ ограничен</h2>
        <p className="text-gray-500 max-w-md mb-6">
          Этот раздел доступен только на тарифе <strong>PRO</strong>. Оформите подписку или примените промокод, чтобы разблокировать все возможности.
        </p>
        <button
          onClick={() => onNavigate('subscription')}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition shadow-md"
        >
          Улучшить тариф
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

function AppContent() {
  const { auth, state } = useApp();
  const [page, setPage] = useState<Page>('dashboard');

  useEffect(() => {
    if (!auth.email) setPage('dashboard');
  }, [auth.email]);

  if (!auth.email) return <AuthPage />;

  if (auth.isNew && !state.onboardingComplete) return <OnboardingPage />;

  const handleNavigate = (p: Page) => setPage(p);

  return (
    <AppLayout current={page} onNavigate={handleNavigate}>
      {page === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
      {page === 'finance' && <FinancePage />}
      
      {/* Закрытые страницы (обернуты в Guard) */}
      {page === 'documents' && (
        <Guard onNavigate={handleNavigate}>
          <DocumentsPage />
        </Guard>
      )}
      {page === 'specialists' && (
        <Guard onNavigate={handleNavigate}>
          <SpecialistsPage />
        </Guard>
      )}
      {page === 'employees' && (
        <Guard onNavigate={handleNavigate}>
          <EmployeesPage />
        </Guard>
      )}

      {/* Открытые страницы */}
      {page === 'clients' && <ClientsPage />}
      {page === 'tasks' && <TasksPage />}
      {page === 'calendar' && <CalendarPage />}
      {page === 'subscription' && <SubscriptionPage />}
      {page === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ToastProvider>
  );
}
