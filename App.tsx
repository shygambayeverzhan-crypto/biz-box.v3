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
import type { Page } from '@/types';

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
      {page === 'documents' && <DocumentsPage />}
      {page === 'clients' && <ClientsPage />}
      {page === 'tasks' && <TasksPage />}
      {page === 'employees' && <EmployeesPage />}
      {page === 'calendar' && <CalendarPage />}
      {page === 'specialists' && <SpecialistsPage />}
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
