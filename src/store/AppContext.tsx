import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type {
  AppState, Transaction, DocumentItem, Client, Task, Employee,
  AppNotification, CalendarEvent, BusinessProfile, UserProfile,
  PaymentRequest, PaymentStatus,
} from '@/types';
import { createSeedState, createNewUserState } from '@/lib/seed';
import { uid } from '@/lib/format';

const STORAGE_KEY = 'bizbox_state_v1';
const AUTH_KEY = 'bizbox_auth_v1';
const REF_KEY = 'bizbox_ref_stats_v1';

interface AuthState {
  email: string | null;
  isNew: boolean;
}

interface ReferralStats {
  code: string;
  invitedCount: number;
  bonusEarned: number; // Например, бонусы или скидка в %
}

interface AppContextValue {
  state: AppState;
  auth: AuthState;
  referral: ReferralStats;
  login: (email: string) => { ok: boolean; isNew: boolean };
  logout: () => void;
  completeOnboarding: (business: BusinessProfile) => void;
  updateUser: (patch: Partial<UserProfile>) => void;
  updateBusiness: (patch: Partial<BusinessProfile>) => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addDocument: (d: Omit<DocumentItem, 'id'>) => void;
  updateDocument: (id: string, patch: Partial<DocumentItem>) => void;
  deleteDocument: (id: string) => void;
  addClient: (c: Omit<Client, 'id' | 'notes' | 'activities'>) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addClientNote: (clientId: string, text: string) => void;
  addClientActivity: (clientId: string, type: Client['activities'][0]['type'], text: string) => void;
  addTask: (t: Omit<Task, 'id'>) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
  addEmployee: (e: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setPlan: (plan: UserProfile['plan']) => void;
  addPayment: (p: Omit<PaymentRequest, 'id' | 'createdAt' | 'status'>) => string;
  updatePaymentStatus: (id: string, status: PaymentStatus) => void;
  confirmPayment: (id: string) => void;
  rejectPayment: (id: string) => void;
  applyReferralCode: (code: string) => { ok: boolean; message: string };
}

const AppContext = createContext<AppContextValue | null>(null);

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch { /* ignore */ }
  return createSeedState();
}

function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw) as AuthState;
  } catch { /* ignore */ }
  return { email: null, isNew: false };
}

function loadReferral(): ReferralStats {
  try {
    const raw = localStorage.getItem(REF_KEY);
    if (raw) return JSON.parse(raw) as ReferralStats;
  } catch { /* ignore */ }
  return {
    code: 'BIZ-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
    invitedCount: 3,
    bonusEarned: 1500,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [auth, setAuth] = useState<AuthState>(loadAuth);
  const [referral, setReferral] = useState<ReferralStats>(loadReferral);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  }, [state]);

  useEffect(() => {
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); } catch { /* quota */ }
  }, [auth]);

  useEffect(() => {
    try { localStorage.setItem(REF_KEY, JSON.stringify(referral)); } catch { /* quota */ }
  }, [referral]);

  const login = useCallback((email: string): { ok: boolean; isNew: boolean } => {
    const existing = loadState();
    const isDemo = email === 'demo@bizbox.app';
    const isNewUser = !isDemo && (!existing.user || existing.user.email !== email);

    if (isNewUser) {
      const name = email.split('@')[0];
      const fresh = createNewUserState(email, name.charAt(0).toUpperCase() + name.slice(1));
      setState(fresh);
      setAuth({ email, isNew: true });
      return { ok: true, isNew: true };
    }

    setState(existing);
    setAuth({ email, isNew: false });
    return { ok: true, isNew: false };
  }, []);

  const logout = useCallback(() => {
    setAuth({ email: null, isNew: false });
  }, []);

  const completeOnboarding = useCallback((business: BusinessProfile) => {
    setState(s => ({ ...s, business, onboardingComplete: true }));
    setAuth(a => ({ ...a, isNew: false }));
  }, []);

  const updateUser = useCallback((patch: Partial<UserProfile>) => {
    setState(s => s.user ? { ...s, user: { ...s.user, ...patch } } : s);
  }, []);

  const updateBusiness = useCallback((patch: Partial<BusinessProfile>) => {
    setState(s => s.business ? { ...s, business: { ...s.business, ...patch } } : s);
  }, []);

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>) => {
    setState(s => ({ ...s, transactions: [{ ...t, id: uid('t') }, ...s.transactions] }));
  }, []);
  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setState(s => ({ ...s, transactions: s.transactions.map(t => t.id === id ? { ...t, ...patch } : t) }));
  }, []);
  const deleteTransaction = useCallback((id: string) => {
    setState(s => ({ ...s, transactions: s.transactions.filter(t => t.id !== id) }));
  }, []);

  const addDocument = useCallback((d: Omit<DocumentItem, 'id'>) => {
    setState(s => ({ ...s, documents: [{ ...d, id: uid('d') }, ...s.documents] }));
  }, []);
  const updateDocument = useCallback((id: string, patch: Partial<DocumentItem>) => {
    setState(s => ({ ...s, documents: s.documents.map(d => d.id === id ? { ...d, ...patch } : d) }));
  }, []);
  const deleteDocument = useCallback((id: string) => {
    setState(s => ({ ...s, documents: s.documents.filter(d => d.id !== id) }));
  }, []);

  const addClient = useCallback((c: Omit<Client, 'id' | 'notes' | 'activities'>) => {
    setState(s => ({ ...s, clients: [{ ...c, id: uid('c'), notes: [], activities: [] }, ...s.clients] }));
  }, []);
  const updateClient = useCallback((id: string, patch: Partial<Client>) => {
    setState(s => ({ ...s, clients: s.clients.map(c => c.id === id ? { ...c, ...patch } : c) }));
  }, []);
  const deleteClient = useCallback((id: string) => {
    setState(s => ({ ...s, clients: s.clients.filter(c => c.id !== id) }));
  }, []);
  const addClientNote = useCallback((clientId: string, text: string) => {
    setState(s => ({
      ...s,
      clients: s.clients.map(c => c.id === clientId
        ? { ...c, notes: [{ id: uid('n'), text, date: new Date().toISOString() }, ...c.notes] }
        : c),
    }));
  }, []);
  const addClientActivity = useCallback((clientId: string, type: Client['activities'][0]['type'], text: string) => {
    setState(s => ({
      ...s,
      clients: s.clients.map(c => c.id === clientId
        ? { ...c, activities: [{ id: uid('a'), type, text, date: new Date().toISOString() }, ...c.activities], lastActivity: new Date().toISOString() }
        : c),
    }));
  }, []);

  const addTask = useCallback((t: Omit<Task, 'id'>) => {
    setState(s => ({ ...s, tasks: [{ ...t, id: uid('tk') }, ...s.tasks] }));
  }, []);
  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) }));
  }, []);
  const deleteTask = useCallback((id: string) => {
    setState(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }));
  }, []);
  const toggleTask = useCallback((id: string) => {
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, completed: !t.completed, status: !t.completed ? 'done' : 'new' } : t) }));
  }, []);

  const addEmployee = useCallback((e: Omit<Employee, 'id'>) => {
    setState(s => ({ ...s, employees: [...s.employees, { ...e, id: uid('e') }] }));
  }, []);
  const updateEmployee = useCallback((id: string, patch: Partial<Employee>) => {
    setState(s => ({ ...s, employees: s.employees.map(e => e.id === id ? { ...e, ...patch } : e) }));
  }, []);
  const deleteEmployee = useCallback((id: string) => {
    setState(s => ({ ...s, employees: s.employees.filter(e => e.id !== id) }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setState(s => ({ ...s, notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) }));
  }, []);
  const markAllNotificationsRead = useCallback(() => {
    setState(s => ({ ...s, notifications: s.notifications.map(n => ({ ...n, read: true })) }));
  }, []);

  const setPlan = useCallback((plan: UserProfile['plan']) => {
    setState(s => s.user ? { ...s, user: { ...s.user, plan } } : s);
  }, []);

  const addPayment = useCallback((p: Omit<PaymentRequest, 'id' | 'createdAt' | 'status'>): string => {
    const id = uid('pay');
    setState(s => ({
      ...s,
      payments: [{ ...p, id, createdAt: new Date().toISOString(), status: 'awaiting_confirmation' }, ...s.payments],
    }));
    return id;
  }, []);

  const updatePaymentStatus = useCallback((id: string, status: PaymentStatus) => {
    setState(s => ({ ...s, payments: s.payments.map(p => p.id === id ? { ...p, status } : p) }));
  }, []);

  const confirmPayment = useCallback((id: string) => {
    setState(s => {
      const payment = s.payments.find(p => p.id === id);
      if (!payment) return s;
      return {
        ...s,
        payments: s.payments.map(p => p.id === id ? { ...p, status: 'confirmed' } : p),
        user: s.user ? { ...s.user, plan: payment.plan } : s.user,
      };
    });
  }, []);

  const rejectPayment = useCallback((id: string) => {
    setState(s => ({ ...s, payments: s.payments.map(p => p.id === id ? { ...p, status: 'rejected' } : p) }));
  }, []);

  const applyReferralCode = useCallback((code: string) => {
    if (!code || code.trim().length === 0) {
      return { ok: false, message: 'Введите промокод' };
    }
    // Если промокод правильный — активируем PRO и добавляем бонусы
    if (code.toUpperCase().startsWith('BIZ') || code.toUpperCase() === 'HACKALEM') {
      setPlan('pro');
      setReferral(r => ({ ...r, bonusEarned: r.bonusEarned + 500 }));
      return { ok: true, message: 'Промокод применен! Вам активирован тариф PRO и начислено +500 ₸' };
    }
    return { ok: false, message: 'Неверный реферальный код' };
  }, [setPlan]);

  const value: AppContextValue = {
    state, auth, referral, login, logout, completeOnboarding, updateUser, updateBusiness,
    addTransaction, updateTransaction, deleteTransaction,
    addDocument, updateDocument, deleteDocument,
    addClient, updateClient, deleteClient, addClientNote, addClientActivity,
    addTask, updateTask, deleteTask, toggleTask,
    addEmployee, updateEmployee, deleteEmployee,
    markNotificationRead, markAllNotificationsRead, setPlan,
    addPayment, updatePaymentStatus, confirmPayment, rejectPayment,
    applyReferralCode,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
