import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode, type SetStateAction } from 'react';
import type {
  AppState, Transaction, DocumentItem, Client, Task, Employee,
  BusinessProfile, UserProfile, PaymentRequest, PaymentStatus,
} from '@/types';
import { createSeedState, createNewUserState } from '@/lib/seed';
import { uid } from '@/lib/format';
import { loadWorkspace, saveWorkspace, isWorkspaceState, type CloudStorage } from '@/lib/cloudWorkspace';
import { getTelegram, isTelegramLaunch, telegramDisplayName } from '@/lib/telegram';

interface AuthState { mode: 'telegram' | 'demo' | null }
interface ReferralStats { code: string; invitedCount: number; bonusEarned: number }
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';
interface AppContextValue {
  state: AppState;
  auth: AuthState;
  referral: ReferralStats;
  bootStatus: 'loading' | 'ready' | 'error';
  bootError: string;
  syncStatus: SyncStatus;
  syncError: string;
  legacyState: AppState | null;
  startDemo: () => void;
  logout: () => void;
  reloadWorkspace: () => Promise<void>;
  retrySave: () => Promise<void>;
  importLegacy: () => Promise<void>;
  dismissLegacy: () => void;
  exportWorkspace: () => void;
  saveOnboardingDraft: (business: BusinessProfile, step: number) => void;
  completeOnboarding: (business: BusinessProfile) => Promise<void>;
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
const emptyState = () => ({ ...createNewUserState('', ''), user: null });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Не удалось связаться с Telegram. Попробуйте ещё раз.';

function readLegacy(): AppState | null {
  try {
    const value = JSON.parse(localStorage.getItem('bizbox_state_v1') || 'null');
    // Old email login wasn't verified. Import is always an explicit user choice.
    if (isWorkspaceState(value) && value.user?.email && value.user.email !== 'demo@bizbox.app' && value.onboardingComplete && value.business?.name) return value;
  } catch { /* Legacy browser storage may be unavailable. */ }
  return null;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setReactState] = useState<AppState>(emptyState);
  const [auth, setAuth] = useState<AuthState>({ mode: null });
  const [referral, setReferral] = useState<ReferralStats>({ code: '', invitedCount: 0, bonusEarned: 0 });
  const [bootStatus, setBootStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState('');
  const [legacyState, setLegacyState] = useState<AppState | null>(null);
  const stateRef = useRef(state);
  const modeRef = useRef<AuthState['mode']>(null);
  const storageRef = useRef<CloudStorage | null>(null);
  const revisionRef = useRef<string | null>(null);
  const pendingRef = useRef<AppState | null>(null);
  const savingRef = useRef<Promise<void> | null>(null);
  const bootRun = useRef(0);
  const cacheKey = useRef<string | null>(null);

  const replaceState = useCallback((next: AppState) => {
    stateRef.current = next;
    setReactState(next);
  }, []);

  const cacheLocalCopy = useCallback((next: AppState) => {
    if (!cacheKey.current) return;
    try { localStorage.setItem(cacheKey.current, JSON.stringify(next)); } catch { /* Cloud is authoritative. */ }
  }, []);

  const flush = useCallback((): Promise<void> => {
    if (savingRef.current) return savingRef.current;
    if (!pendingRef.current || !storageRef.current) return Promise.resolve();
    const task = (async () => {
      setSyncStatus('saving');
      setSyncError('');
      getTelegram()?.enableClosingConfirmation?.();
      while (pendingRef.current) {
        const next = pendingRef.current;
        pendingRef.current = null;
        try {
          revisionRef.current = await saveWorkspace(storageRef.current!, next, revisionRef.current);
          cacheLocalCopy(next);
        } catch (error) {
          pendingRef.current = pendingRef.current || next;
          setSyncStatus('error');
          setSyncError(errorMessage(error));
          throw error;
        }
      }
      setSyncStatus('saved');
      getTelegram()?.disableClosingConfirmation?.();
    })();
    savingRef.current = task.finally(() => { savingRef.current = null; });
    return savingRef.current;
  }, [cacheLocalCopy]);

  const setState = useCallback((update: SetStateAction<AppState>) => {
    const next = typeof update === 'function' ? update(stateRef.current) : update;
    if (next === stateRef.current) return;
    replaceState(next);
    if (modeRef.current === 'telegram') {
      cacheLocalCopy(next);
      pendingRef.current = next;
      void flush().catch(() => { /* Visible sync error + explicit retry. */ });
    }
  }, [replaceState, cacheLocalCopy, flush]);

  const reloadWorkspace = useCallback(async () => {
    // Wait for any in-flight write before a user-requested reload.
    if (savingRef.current) await savingRef.current.catch(() => {});
    const run = ++bootRun.current;
    setBootStatus('loading');
    setBootError('');
    try {
      const app = getTelegram();
      if (!app) {
        if (isTelegramLaunch()) throw new Error('Telegram не передал данные входа. Обновите Telegram и откройте приложение снова через профиль бота.');
        modeRef.current = null;
        setAuth({ mode: null });
        setBootStatus('ready');
        return;
      }
      app.ready();
      app.expand();
      if (!app.isVersionAtLeast('6.9') || !app.CloudStorage) {
        throw new Error('Для сохранения нужен свежий Telegram. Обновите его и откройте BizBox снова.');
      }
      storageRef.current = app.CloudStorage;
      const loaded = await loadWorkspace(app.CloudStorage);
      if (run !== bootRun.current) return;
      revisionRef.current = loaded.revision;
      pendingRef.current = null;
      modeRef.current = 'telegram';
      const id = app.initDataUnsafe?.user?.id;
      cacheKey.current = Number.isSafeInteger(id) ? 'bizbox_cache_v2_' + id : null;
      const next = loaded.state || createNewUserState('', telegramDisplayName(app));
      replaceState(next);
      setAuth({ mode: 'telegram' });
      setLegacyState(loaded.state ? null : readLegacy());
      setSyncStatus(loaded.state ? 'saved' : 'idle');
      setSyncError('');
      app.disableClosingConfirmation?.();
      setBootStatus('ready');
    } catch (error) {
      if (run !== bootRun.current) return;
      setBootError(errorMessage(error));
      setBootStatus('error');
    }
  }, [replaceState]);

  useEffect(() => { void reloadWorkspace(); }, [reloadWorkspace]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pendingRef.current || savingRef.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const startDemo = useCallback(() => {
    if (getTelegram()) return; // Real Telegram sessions always use their cloud workspace.
    modeRef.current = 'demo';
    replaceState(createSeedState());
    setAuth({ mode: 'demo' });
    setSyncStatus('idle');
  }, [replaceState]);

  const logout = useCallback(() => {
    if (modeRef.current === 'telegram') {
      void flush().then(() => getTelegram()?.close()).catch(() => {});
      return;
    }
    modeRef.current = null;
    replaceState(emptyState());
    setAuth({ mode: null });
  }, [flush, replaceState]);

  const completeOnboarding = useCallback(async (business: BusinessProfile) => {
    const next = { ...stateRef.current, business, onboardingComplete: true, onboardingStep: 2 };
    if (modeRef.current !== 'telegram' || !storageRef.current) throw new Error('Откройте BizBox в Telegram.');
    pendingRef.current = next;
    await flush(); // Do not leave onboarding until Telegram acknowledges the committed snapshot.
    replaceState(next);
    setLegacyState(null);
  }, [flush, replaceState]);

  const saveOnboardingDraft = useCallback((business: BusinessProfile, step: number) => {
    if (stateRef.current.onboardingComplete) return;
    setState(previous => ({ ...previous, business, onboardingStep: step }));
  }, [setState]);

  const retrySave = useCallback(async () => { await flush(); }, [flush]);
  const dismissLegacy = useCallback(() => setLegacyState(null), []);
  const importLegacy = useCallback(async () => {
    if (!legacyState || modeRef.current !== 'telegram') return;
    const next = { ...legacyState, user: { ...legacyState.user!, plan: 'free' as const } };
    pendingRef.current = next;
    await flush();
    replaceState(next);
    setLegacyState(null);
  }, [legacyState, flush, replaceState]);

  const exportWorkspace = useCallback(() => {
    const blob = new Blob([JSON.stringify(pendingRef.current || stateRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bizbox-backup.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const updateUser = useCallback((patch: Partial<UserProfile>) => {
    setState(s => s.user ? { ...s, user: { ...s.user, ...patch } } : s);
  }, [setState]);

  const updateBusiness = useCallback((patch: Partial<BusinessProfile>) => {
    setState(s => s.business ? { ...s, business: { ...s.business, ...patch } } : s);
  }, [setState]);

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>) => {
    setState(s => ({ ...s, transactions: [{ ...t, id: uid('t') }, ...s.transactions] }));
  }, [setState]);
  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setState(s => ({ ...s, transactions: s.transactions.map(t => t.id === id ? { ...t, ...patch } : t) }));
  }, [setState]);
  const deleteTransaction = useCallback((id: string) => {
    setState(s => ({ ...s, transactions: s.transactions.filter(t => t.id !== id) }));
  }, [setState]);

  const addDocument = useCallback((d: Omit<DocumentItem, 'id'>) => {
    setState(s => ({ ...s, documents: [{ ...d, id: uid('d') }, ...s.documents] }));
  }, [setState]);
  const updateDocument = useCallback((id: string, patch: Partial<DocumentItem>) => {
    setState(s => ({ ...s, documents: s.documents.map(d => d.id === id ? { ...d, ...patch } : d) }));
  }, [setState]);
  const deleteDocument = useCallback((id: string) => {
    setState(s => ({ ...s, documents: s.documents.filter(d => d.id !== id) }));
  }, [setState]);

  const addClient = useCallback((c: Omit<Client, 'id' | 'notes' | 'activities'>) => {
    setState(s => ({ ...s, clients: [{ ...c, id: uid('c'), notes: [], activities: [] }, ...s.clients] }));
  }, [setState]);
  const updateClient = useCallback((id: string, patch: Partial<Client>) => {
    setState(s => ({ ...s, clients: s.clients.map(c => c.id === id ? { ...c, ...patch } : c) }));
  }, [setState]);
  const deleteClient = useCallback((id: string) => {
    setState(s => ({ ...s, clients: s.clients.filter(c => c.id !== id) }));
  }, [setState]);
  const addClientNote = useCallback((clientId: string, text: string) => {
    setState(s => ({
      ...s,
      clients: s.clients.map(c => c.id === clientId
        ? { ...c, notes: [{ id: uid('n'), text, date: new Date().toISOString() }, ...c.notes] }
        : c),
    }));
  }, [setState]);
  const addClientActivity = useCallback((clientId: string, type: Client['activities'][0]['type'], text: string) => {
    setState(s => ({
      ...s,
      clients: s.clients.map(c => c.id === clientId
        ? { ...c, activities: [{ id: uid('a'), type, text, date: new Date().toISOString() }, ...c.activities], lastActivity: new Date().toISOString() }
        : c),
    }));
  }, [setState]);

  const addTask = useCallback((t: Omit<Task, 'id'>) => {
    setState(s => ({ ...s, tasks: [{ ...t, id: uid('tk') }, ...s.tasks] }));
  }, [setState]);
  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) }));
  }, [setState]);
  const deleteTask = useCallback((id: string) => {
    setState(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }));
  }, [setState]);
  const toggleTask = useCallback((id: string) => {
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, completed: !t.completed, status: !t.completed ? 'done' : 'new' } : t) }));
  }, [setState]);

  const addEmployee = useCallback((e: Omit<Employee, 'id'>) => {
    setState(s => ({ ...s, employees: [...s.employees, { ...e, id: uid('e') }] }));
  }, [setState]);
  const updateEmployee = useCallback((id: string, patch: Partial<Employee>) => {
    setState(s => ({ ...s, employees: s.employees.map(e => e.id === id ? { ...e, ...patch } : e) }));
  }, [setState]);
  const deleteEmployee = useCallback((id: string) => {
    setState(s => ({ ...s, employees: s.employees.filter(e => e.id !== id) }));
  }, [setState]);

  const markNotificationRead = useCallback((id: string) => {
    setState(s => ({ ...s, notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) }));
  }, [setState]);
  const markAllNotificationsRead = useCallback(() => {
    setState(s => ({ ...s, notifications: s.notifications.map(n => ({ ...n, read: true })) }));
  }, [setState]);

  const setPlan = useCallback((plan: UserProfile['plan']) => {
    setState(s => s.user ? { ...s, user: { ...s.user, plan } } : s);
  }, [setState]);

  const addPayment = useCallback((p: Omit<PaymentRequest, 'id' | 'createdAt' | 'status'>): string => {
    const id = uid('pay');
    setState(s => ({
      ...s,
      payments: [{ ...p, id, createdAt: new Date().toISOString(), status: 'awaiting_confirmation' }, ...s.payments],
    }));
    return id;
  }, [setState]);

  const updatePaymentStatus = useCallback((id: string, status: PaymentStatus) => {
    setState(s => ({ ...s, payments: s.payments.map(p => p.id === id ? { ...p, status } : p) }));
  }, [setState]);

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
  }, [setState]);

  const rejectPayment = useCallback((id: string) => {
    setState(s => ({ ...s, payments: s.payments.map(p => p.id === id ? { ...p, status: 'rejected' } : p) }));
  }, [setState]);

  const applyReferralCode = useCallback((code: string) => {
    if (!code || code.trim().length === 0) {
      return { ok: false, message: 'Введите промокод' };
    }
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.startsWith('BIZ') || cleanCode === 'HACKALEM') {
      setPlan('pro');
      setReferral(r => ({ ...r, bonusEarned: r.bonusEarned + 500 }));
      return { ok: true, message: 'Промокод применен! Тариф PRO активирован!' };
    }
    return { ok: false, message: 'Неверный промокод' };
  }, [setPlan]);



  const value: AppContextValue = {
    state, auth, referral, bootStatus, bootError, syncStatus, syncError, legacyState,
    startDemo, logout, reloadWorkspace, retrySave, importLegacy, dismissLegacy, exportWorkspace,
    saveOnboardingDraft, completeOnboarding, updateUser, updateBusiness,
    addTransaction, updateTransaction, deleteTransaction,
    addDocument, updateDocument, deleteDocument,
    addClient, updateClient, deleteClient, addClientNote, addClientActivity,
    addTask, updateTask, deleteTask, toggleTask,
    addEmployee, updateEmployee, deleteEmployee,
    markNotificationRead, markAllNotificationsRead, setPlan,
    addPayment, updatePaymentStatus, confirmPayment, rejectPayment, applyReferralCode,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
