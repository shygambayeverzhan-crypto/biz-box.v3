import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
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
import SpecialistsPage from '@/pages/SpecialistsPage';
import SubscriptionPageComponent from '@/pages/SubscriptionPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AssistantPage } from '@/pages/AssistantPage';
import { ReferralsPage } from '@/pages/ReferralsPage';
import { Lock } from 'lucide-react';
import type { Page } from '@/types';
import { WorkspaceLoading, SyncBanner, LegacyImport } from '@/components/WorkspaceStatus';
import { getTelegram } from '@/lib/telegram';

function Guard({ children, onNavigate, minimumPlan = 'pro' }: { children: ReactNode; onNavigate: (p: Page) => void; minimumPlan?: 'business' | 'pro' }) {
  const { state } = useApp();
  const userPlan = state.user?.plan || 'free';
  const hasAccess = userPlan === 'pro' || (minimumPlan === 'business' && userPlan === 'business');

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center bg-bg-card rounded-2xl border border-border">
        <div className="w-16 h-16 bg-accent-500/10 text-accent-400 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-white">Больше возможностей для бизнеса</h2>
        <p className="text-white/60 max-w-md mb-6">
          Этот раздел доступен на тарифе <strong>{minimumPlan === 'business' ? 'BUSINESS или PRO' : 'PRO'}</strong>. Выбери подходящий тариф, чтобы подключить его.
        </p>
        <button type="button" onClick={() => onNavigate('subscription')} className="px-6 py-3 bg-accent-500 text-white rounded-xl font-semibold hover:bg-accent-600 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400">
          Посмотреть тарифы
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

function AppContent() {
  const { auth, state, bootStatus, legacyState } = useApp();
  const [page, setPage] = useState<Page>('dashboard');

  useEffect(() => {
    if (!auth.mode) setPage('dashboard');
  }, [auth.mode]);
  useEffect(() => {
    const app = getTelegram();
    if (!app) return;
    try {
      if (app.isVersionAtLeast('6.9')) {
        app.setHeaderColor?.('#080e1b');
        app.setBackgroundColor?.('#080e1b');
      }
      if (app.isVersionAtLeast('7.10')) app.setBottomBarColor?.('#080e1b');
    } catch { /* Cosmetic native chrome must not block the workspace. */ }
  }, []);

  if (bootStatus !== 'ready') return <WorkspaceLoading />;
  if (!auth.mode) return <AuthPage />;
  if (legacyState) return <LegacyImport />;
  if (!state.onboardingComplete) return <><SyncBanner /><OnboardingPage /></>;

  const handleNavigate = (p: Page) => setPage(p);

  return (
    <AppLayout current={page} onNavigate={handleNavigate}>
      {page === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
      {page === 'finance' && <FinancePage />}
      {page === 'documents' && <Guard onNavigate={handleNavigate} minimumPlan="business"><DocumentsPage /></Guard>}
      {page === 'specialists' && <Guard onNavigate={handleNavigate}><SpecialistsPage /></Guard>}
      {page === 'employees' && <Guard onNavigate={handleNavigate}><EmployeesPage /></Guard>}
      {page === 'clients' && <ClientsPage />}
      {page === 'tasks' && <TasksPage />}
      {page === 'calendar' && <CalendarPage />}
      {page === 'subscription' && <SubscriptionPageComponent />}
      {page === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
      {page === 'assistant' && <AssistantPage key={getTelegram()?.initDataUnsafe?.user?.id || auth.mode} />}
      {page === 'referrals' && <ReferralsPage key={getTelegram()?.initDataUnsafe?.user?.id || auth.mode} />}
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
