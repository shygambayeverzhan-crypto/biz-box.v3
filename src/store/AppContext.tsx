import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode, type SetStateAction } from 'react';
import type {
  AppState, Transaction, DocumentItem, Client, Task, Employee,
  BusinessProfile, UserProfile, PaymentRequest, PaymentStatus,
} from '@/types';
import { createSeedState, createNewUserState } from '@/lib/seed';
import { uid } from '@/lib/format';
import { loadWorkspace, saveWorkspace, isWorkspaceState, isWorkspaceCommitResolved, WorkspaceStorageError, type CloudStorage } from '@/lib/cloudWorkspace';
import { readWorkspaceRecovery, writeWorkspaceRecovery, writeWorkspaceCheckpoint, archiveWorkspaceVersion, clearWorkspaceRecovery, reconcileWorkspaceRecovery, sameWorkspaceState, type WorkspaceRecovery } from '@/lib/workspaceRecovery';
import { getTelegram, isTelegramLaunch, telegramDisplayName } from '@/lib/telegram';
import { verifyAccessCode, type SubscriptionAccess } from '@/lib/subscriptionAccess';
import { useBilling, type BillingStatus, type ServerPaymentRequest } from '@/lib/billingApi';
import type { PaidPlan } from '@/lib/billing';

interface AuthState { mode: 'telegram' | 'demo' | null }
interface ReferralStats { code: string; invitedCount: number; bonusEarned: number }
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';
interface AppContextValue {
  state: AppState;
  auth: AuthState;
  referral: ReferralStats;
  subscriptionAccess: SubscriptionAccess | null;
  activateAccessCode: (code: string) => Promise<void>;
  paymentRequest: ServerPaymentRequest | null;
  billingStatus: BillingStatus;
  billingError: string;
  submitPaymentRequest: (plan: PaidPlan) => Promise<{ notificationDelivered: boolean }>;
  refreshBilling: () => Promise<void>;
  bootStatus: 'loading' | 'ready' | 'error';
  bootError: string;
  syncStatus: SyncStatus;
  syncError: string;
  syncLocallySaved: boolean;
  syncConflict: boolean;
  legacyState: AppState | null;
  startDemo: () => void;
  logout: () => void;
  reloadWorkspace: () => Promise<void>;
  resolveWorkspaceConflict: (choice: 'local' | 'cloud') => Promise<void>;
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

function downloadWorkspace(state: AppState, filename = 'bizbox-backup.json'): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function currentTelegramUserId(): string | null {
  const id = getTelegram()?.initDataUnsafe?.user?.id;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? String(id) : null;
}

function withPlan(value: AppState, plan: UserProfile['plan']): AppState {
  return value.user && value.user.plan !== plan ? { ...value, user: { ...value.user, plan } } : value;
}

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
  const [syncLocallySaved, setSyncLocallySaved] = useState(false);
  const [syncConflict, setSyncConflict] = useState(false);
  const [legacyState, setLegacyState] = useState<AppState | null>(null);
  const [subscriptionAccess, setSubscriptionAccess] = useState<SubscriptionAccess | null>(null);
  const accessRef = useRef<SubscriptionAccess | null>(null);
  const accessEpoch = useRef(0);
  const activatingAccess = useRef(false);
  const accessSuspended = useRef(true);
  const telegramUserIdRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  const modeRef = useRef<AuthState['mode']>(null);
  const storageRef = useRef<CloudStorage | null>(null);
  const revisionRef = useRef<string | null>(null);
  const pendingRef = useRef<AppState | null>(null);
  const savingRef = useRef<Promise<void> | null>(null);
  const completingRef = useRef(false);
  const bootRun = useRef(0);
  const recoveryBaseRef = useRef<string | null | undefined>(null);
  const attemptedRef = useRef<AppState | null>(null);
  const uncertainCommitRef = useRef<string | null>(null);
  const offlineCheckpointRef = useRef(false);
  const reconcileRef = useRef(false);
  const durableRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const billing = useBilling({
    enabled: auth.mode === 'telegram' && bootStatus === 'ready' && !accessSuspended.current,
    userId: currentTelegramUserId(),
    epoch: bootRun.current,
  });
  const { clearBilling } = billing;

  const rememberAccess = useCallback((access: SubscriptionAccess | null) => {
    accessRef.current = access;
    setSubscriptionAccess(access);
  }, []);

  const clearAccess = useCallback(() => {
    accessEpoch.current += 1;
    rememberAccess(null);
  }, [rememberAccess]);

  const replaceState = useCallback((next: AppState) => {
    stateRef.current = next;
    setReactState(next);
  }, []);

  const updateCloseGuard = useCallback(() => {
    const app = getTelegram();
    if ((pendingRef.current || attemptedRef.current) && !durableRef.current) app?.enableClosingConfirmation?.();
    else app?.disableClosingConfirmation?.();
  }, []);

  const cacheLocalCopy = useCallback((next: AppState) => {
    const userId = telegramUserIdRef.current;
    durableRef.current = Boolean(userId && writeWorkspaceRecovery({
      version: 1, userId, baseRevision: recoveryBaseRef.current, state: next,
      ...(attemptedRef.current ? { attempted: attemptedRef.current } : {}),
      ...(uncertainCommitRef.current ? { commitUncertain: uncertainCommitRef.current } : {}),
    }));
    setSyncLocallySaved(durableRef.current);
    updateCloseGuard();
  }, [updateCloseGuard]);

  const flush = useCallback((): Promise<void> => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (savingRef.current) return savingRef.current;
    if (!pendingRef.current || !storageRef.current) return Promise.resolve();
    let succeeded = false;
    const task = (async () => {
      setSyncStatus('saving');
      setSyncError('');
      try {
        if (currentTelegramUserId() !== telegramUserIdRef.current) throw new Error('Telegram-аккаунт изменился. Откройте приложение снова.');
        if (reconcileRef.current) {
          if (uncertainCommitRef.current) {
            if (!await isWorkspaceCommitResolved(storageRef.current!, uncertainCommitRef.current)) {
              throw new WorkspaceStorageError('commit_unknown', 'Telegram ещё не завершил предыдущую отправку. Проверьте облако чуть позже; новые изменения пока сохранены отдельно.', uncertainCommitRef.current);
            }
            uncertainCommitRef.current = null;
          }
          const loaded = await loadWorkspace(storageRef.current!);
          const recovery: WorkspaceRecovery = { version: 1, userId: telegramUserIdRef.current ?? '', baseRevision: recoveryBaseRef.current, state: pendingRef.current!, ...(attemptedRef.current ? { attempted: attemptedRef.current } : {}) };
          const resolution = reconcileWorkspaceRecovery(recovery, loaded);
          if (resolution === 'conflict') throw new WorkspaceStorageError('conflict', 'В облаке есть изменения из другого окна. Ваша версия сохранена отдельно; скачайте её копию перед объединением данных.');
          revisionRef.current = loaded.revision;
          recoveryBaseRef.current = loaded.revision;
          attemptedRef.current = null;
          reconcileRef.current = false;
          if (resolution === 'saved') {
            if (telegramUserIdRef.current && loaded.state) writeWorkspaceCheckpoint(telegramUserIdRef.current, loaded.state, loaded.revision);
            if (pendingRef.current?.onboardingComplete && !stateRef.current.onboardingComplete) replaceState(pendingRef.current);
            pendingRef.current = null;
          }
        }
        while (pendingRef.current) {
          if (currentTelegramUserId() !== telegramUserIdRef.current) throw new Error('Telegram-аккаунт изменился. Откройте приложение снова.');
          const next = pendingRef.current;
          pendingRef.current = null;
          attemptedRef.current = next;
          cacheLocalCopy(next);
          revisionRef.current = await saveWorkspace(storageRef.current!, next, revisionRef.current, {
            onCommitStarted: revision => {
              uncertainCommitRef.current = revision;
              cacheLocalCopy(pendingRef.current || next);
            },
            onCommitSettled: revision => {
              if (uncertainCommitRef.current !== revision) return;
              uncertainCommitRef.current = null;
              cacheLocalCopy(pendingRef.current || attemptedRef.current || next);
            },
          });
          if (telegramUserIdRef.current) writeWorkspaceCheckpoint(telegramUserIdRef.current, next, revisionRef.current);
          recoveryBaseRef.current = revisionRef.current;
          attemptedRef.current = null;
          uncertainCommitRef.current = null;
          if (pendingRef.current && sameWorkspaceState(pendingRef.current, next)) pendingRef.current = null;
          if (pendingRef.current) cacheLocalCopy(pendingRef.current);
          if (next.onboardingComplete && !stateRef.current.onboardingComplete) {
            replaceState(next);
            setLegacyState(null);
          }
        }
        if (telegramUserIdRef.current) clearWorkspaceRecovery(telegramUserIdRef.current);
        durableRef.current = false;
        setSyncLocallySaved(false);
        setSyncStatus('saved');
        setSyncConflict(false);
        succeeded = true;
      } catch (error) {
        if (error instanceof WorkspaceStorageError && error.uncertainRevision) uncertainCommitRef.current = error.uncertainRevision;
        pendingRef.current = pendingRef.current || attemptedRef.current;
        reconcileRef.current = true;
        if (pendingRef.current) cacheLocalCopy(pendingRef.current);
        setSyncStatus('error');
        setSyncConflict(error instanceof WorkspaceStorageError && error.code === 'conflict');
        setSyncError(error instanceof WorkspaceStorageError && (error.code === 'timeout' || error.code === 'unavailable')
          ? durableRef.current ? 'Облако временно недоступно. Изменения сохранены на этом устройстве и отправятся при восстановлении связи.' : 'Облако временно недоступно. Оставьте приложение открытым и повторите сохранение.'
          : error instanceof WorkspaceStorageError && error.code === 'commit_unknown'
            ? durableRef.current ? 'Telegram ещё не подтвердил отправку. Новые изменения сохранены на этом устройстве; повторите проверку облака.' : 'Telegram ещё не подтвердил отправку. Оставьте приложение открытым и повторите проверку облака.'
          : errorMessage(error));
        throw error;
      } finally {
        updateCloseGuard();
      }
    })();
    savingRef.current = task.finally(() => {
      savingRef.current = null;
      if (succeeded && pendingRef.current) return flush();
    });
    return savingRef.current;
  }, [cacheLocalCopy, replaceState, updateCloseGuard]);

  const setState = useCallback((update: SetStateAction<AppState>) => {
    const next = typeof update === 'function' ? update(stateRef.current) : update;
    if (modeRef.current === 'telegram' ? sameWorkspaceState(next, stateRef.current) : JSON.stringify(next) === JSON.stringify(stateRef.current)) return;
    replaceState(next);
    if (modeRef.current === 'telegram') {
      if (!pendingRef.current && !attemptedRef.current) recoveryBaseRef.current = revisionRef.current;
      pendingRef.current = next;
      cacheLocalCopy(next);
      setSyncStatus('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { saveTimer.current = null; void flush().catch(() => {}); }, 350);
    }
  }, [replaceState, cacheLocalCopy, flush]);

  const reloadWorkspace = useCallback(async () => {
    // Wait for any in-flight write before a user-requested reload.
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (savingRef.current) await savingRef.current.catch(() => {});
    const previousUserId = telegramUserIdRef.current;
    const inMemoryRecovery: WorkspaceRecovery | null = modeRef.current === 'telegram' && pendingRef.current ? {
      version: 1, userId: previousUserId ?? '', baseRevision: recoveryBaseRef.current, state: pendingRef.current,
      ...(attemptedRef.current ? { attempted: attemptedRef.current } : {}),
      ...(uncertainCommitRef.current ? { commitUncertain: uncertainCommitRef.current } : {}),
    } : null;
    const run = ++bootRun.current;
    accessSuspended.current = true;
    clearBilling();
    clearAccess();
    telegramUserIdRef.current = null;
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
      const userId = currentTelegramUserId();
      const recovery = inMemoryRecovery?.userId === (userId ?? '') ? inMemoryRecovery : userId ? readWorkspaceRecovery(userId) : null;
      let loaded: Awaited<ReturnType<typeof loadWorkspace>> | null = null;
      let loadError: unknown;
      try { loaded = await loadWorkspace(app.CloudStorage); } catch (error) {
        loadError = error;
        if (!recovery) throw error;
      }
      if (run !== bootRun.current) return;
      const resolution = recovery && loaded ? reconcileWorkspaceRecovery(recovery, loaded) : null;
      const restored = recovery && resolution !== 'saved' ? recovery : null;
      const storedState = restored?.state || loaded?.state || createNewUserState('', telegramDisplayName(app));
      let access: SubscriptionAccess | null = null;
      // Local recovery never grants an access code that has not reached the cloud.
      if (loaded?.state?.accessCode && userId) {
        try { access = await verifyAccessCode(loaded.state.accessCode, userId); } catch { /* Invalid/expired codes never grant access. */ }
      }
      if (run !== bootRun.current) return;
      if (userId !== currentTelegramUserId()) throw new Error('Telegram-аккаунт изменился. Откройте приложение снова.');
      revisionRef.current = loaded?.revision ?? restored?.baseRevision ?? null;
      pendingRef.current = restored && !restored.synced ? restored.state : null;
      attemptedRef.current = resolution === 'resume' ? null : restored?.attempted ?? null;
      uncertainCommitRef.current = restored?.commitUncertain ?? null;
      offlineCheckpointRef.current = Boolean(restored?.synced && !loaded);
      recoveryBaseRef.current = resolution === 'resume' ? loaded!.revision : restored ? restored.baseRevision : loaded!.revision;
      reconcileRef.current = Boolean(restored && resolution !== 'resume');
      modeRef.current = 'telegram';
      telegramUserIdRef.current = userId;
      const next = withPlan(storedState, access?.plan || 'free');
      accessSuspended.current = false;
      rememberAccess(access);
      replaceState(next);
      setAuth({ mode: 'telegram' });
      setLegacyState(loaded?.state || restored ? null : readLegacy());
      if (restored) {
        if (!restored.synced) cacheLocalCopy(restored.state);
        else { durableRef.current = true; setSyncLocallySaved(true); }
        setSyncStatus(resolution === 'resume' ? 'saving' : 'error');
        setSyncConflict(resolution === 'conflict');
        setSyncError(resolution === 'conflict'
          ? 'В облаке есть изменения из другого окна. Ваша версия сохранена отдельно; скачайте её копию перед объединением данных.'
          : resolution === 'waiting' ? 'Telegram ещё не завершил предыдущую отправку. Проверьте облако чуть позже; новые изменения пока сохранены отдельно.'
          : loadError ? 'Облако временно недоступно. Открыта сохранённая копия с этого устройства.' : '');
      } else {
        if (userId) clearWorkspaceRecovery(userId);
        durableRef.current = false;
        setSyncLocallySaved(false);
        setSyncStatus(loaded?.state ? 'saved' : 'idle');
        setSyncConflict(false);
        setSyncError('');
      }
      if (userId && loaded?.state) writeWorkspaceCheckpoint(userId, loaded.state, loaded.revision);
      updateCloseGuard();
      setBootStatus('ready');
      if (restored && resolution === 'resume') void flush().catch(() => {});
    } catch (error) {
      if (run !== bootRun.current) return;
      setBootError(errorMessage(error));
      setBootStatus('error');
    }
  }, [replaceState, clearAccess, rememberAccess, clearBilling, cacheLocalCopy, updateCloseGuard, flush]);

  useEffect(() => { void reloadWorkspace(); }, [reloadWorkspace]);

  // Called only after the user explicitly chooses which conflicting copy to keep.
  const resolveWorkspaceConflict = useCallback(async (choice: 'local' | 'cloud') => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (savingRef.current) await savingRef.current.catch(() => {});
    const storage = storageRef.current;
    const userId = telegramUserIdRef.current;
    if (!storage || modeRef.current !== 'telegram' || currentTelegramUserId() !== userId) throw new Error('Откройте BizBox снова через Telegram.');
    if (uncertainCommitRef.current && !await isWorkspaceCommitResolved(storage, uncertainCommitRef.current)) {
      throw new Error('Telegram ещё не завершил предыдущую отправку. Дождитесь подтверждения перед выбором версии.');
    }
    const loaded = await loadWorkspace(storage);
    if (currentTelegramUserId() !== userId) throw new Error('Telegram-аккаунт изменился. Откройте приложение снова.');
    const local = pendingRef.current || stateRef.current;
    const backup = choice === 'local' ? loaded.state : local;
    if (backup && !(userId && archiveWorkspaceVersion(userId, backup, choice === 'local' ? loaded.revision : revisionRef.current))) {
      downloadWorkspace(backup, choice === 'local' ? 'bizbox-cloud-backup.json' : 'bizbox-local-backup.json');
    }
    revisionRef.current = loaded.revision;
    recoveryBaseRef.current = loaded.revision;
    attemptedRef.current = null;
    uncertainCommitRef.current = null;
    reconcileRef.current = false;
    offlineCheckpointRef.current = false;
    if (choice === 'local') {
      pendingRef.current = local;
      cacheLocalCopy(local);
      await flush();
      return;
    }
    pendingRef.current = null;
    if (userId) {
      clearWorkspaceRecovery(userId);
      if (loaded.state) writeWorkspaceCheckpoint(userId, loaded.state, loaded.revision);
    }
    durableRef.current = false;
    setSyncLocallySaved(false);
    clearAccess();
    replaceState(withPlan(loaded.state || createNewUserState('', telegramDisplayName(getTelegram()!)), 'free'));
    setSyncStatus(loaded.state ? 'saved' : 'idle');
    setSyncConflict(false);
    setSyncError('');
    updateCloseGuard();
  }, [cacheLocalCopy, flush, clearAccess, replaceState, updateCloseGuard]);
  // A retried save may commit an earlier activation after its original promise
  // rejected. Verify again only after CloudStorage acknowledges the saved code.
  useEffect(() => {
    if (auth.mode !== 'telegram' || bootStatus !== 'ready' || syncStatus !== 'saved' || accessSuspended.current) return;
    const epoch = accessEpoch.current;
    const code = state.accessCode;
    const userId = currentTelegramUserId();
    let cancelled = false;
    const refresh = async () => {
      let access: SubscriptionAccess | null = null;
      if (code && userId && userId === telegramUserIdRef.current) {
        try { access = await verifyAccessCode(code, userId); } catch { /* Keep workspace data and fall back to FREE. */ }
      }
      if (cancelled || epoch !== accessEpoch.current || modeRef.current !== 'telegram' || accessSuspended.current
        || code !== stateRef.current.accessCode || userId !== currentTelegramUserId()
        || pendingRef.current || savingRef.current) return;
      rememberAccess(access);
      replaceState(withPlan(stateRef.current, access?.plan || 'free'));
    };
    void refresh();
    return () => { cancelled = true; };
  }, [auth.mode, bootStatus, syncStatus, state.accessCode, rememberAccess, replaceState]);

  useEffect(() => {
    if (auth.mode !== 'telegram') return;
    const expire = () => {
      if (currentTelegramUserId() !== telegramUserIdRef.current) {
        accessSuspended.current = true;
        clearBilling();
        clearAccess();
        setBootError('Telegram-аккаунт изменился. Откройте приложение снова.');
        setBootStatus('error');
        return;
      }
      const access = accessRef.current;
      if (!access || access.expiresAt > Date.now()) return;
      rememberAccess(null);
      setState(s => withPlan(s, 'free'));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') expire(); };
    const timer = window.setInterval(expire, 15_000);
    window.addEventListener('focus', expire);
    document.addEventListener('visibilitychange', onVisible);
    expire();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', expire);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [auth.mode, clearAccess, rememberAccess, setState, clearBilling]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if ((pendingRef.current || attemptedRef.current) && !durableRef.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => {
    const resume = () => {
      if (document.visibilityState !== 'hidden' && modeRef.current === 'telegram' && !savingRef.current) {
        if (pendingRef.current) void flush().catch(() => {});
        else if (offlineCheckpointRef.current) void reloadWorkspace();
      }
    };
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('online', resume);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [flush, reloadWorkspace]);

  const startDemo = useCallback(() => {
    if (getTelegram()) return; // Real Telegram sessions always use their cloud workspace.
    accessSuspended.current = true;
    clearBilling();
    clearAccess();
    telegramUserIdRef.current = null;
    modeRef.current = 'demo';
    replaceState(createSeedState());
    setAuth({ mode: 'demo' });
    setSyncStatus('idle');
  }, [replaceState, clearAccess, clearBilling]);

  const logout = useCallback(() => {
    accessSuspended.current = true;
    clearBilling();
    clearAccess();
    if (modeRef.current === 'telegram') {
      void flush().then(() => getTelegram()?.close()).catch(() => { if (durableRef.current) getTelegram()?.close(); });
      return;
    }
    modeRef.current = null;
    replaceState(emptyState());
    setAuth({ mode: null });
  }, [flush, replaceState, clearAccess, clearBilling]);

  const activateAccessCode = useCallback(async (code: string) => {
    const userId = currentTelegramUserId();
    if (modeRef.current !== 'telegram' || accessSuspended.current || !storageRef.current || !userId || userId !== telegramUserIdRef.current) {
      throw new Error('Откройте BizBox через меню бота в Telegram, чтобы активировать код для своего аккаунта.');
    }
    if (activatingAccess.current) throw new Error('Предыдущий код ещё сохраняется. Дождитесь завершения.');
    if (!stateRef.current.user) throw new Error('Профиль ещё не загружен. Откройте приложение снова.');
    activatingAccess.current = true;
    const run = bootRun.current;
    const epoch = accessEpoch.current;
    try {
      const access = await verifyAccessCode(code, userId);
      if (run !== bootRun.current || epoch !== accessEpoch.current || modeRef.current !== 'telegram' || userId !== currentTelegramUserId()) {
        throw new Error('Аккаунт изменился. Откройте приложение снова и повторите активацию.');
      }
      const normalized = code.trim();
      // Raw state can be optimistic; the public user.plan below remains based on
      // confirmed subscriptionAccess until the save promise succeeds.
      setState(s => withPlan({ ...s, accessCode: normalized }, access.plan));
      await flush();
      if (run !== bootRun.current || epoch !== accessEpoch.current || modeRef.current !== 'telegram'
        || normalized !== stateRef.current.accessCode || userId !== currentTelegramUserId()) {
        throw new Error('Сеанс изменился во время сохранения. Откройте приложение снова.');
      }
      const committedAccess = await verifyAccessCode(normalized, userId);
      if (run !== bootRun.current || epoch !== accessEpoch.current || accessSuspended.current
        || modeRef.current !== 'telegram' || normalized !== stateRef.current.accessCode || userId !== currentTelegramUserId()) {
        throw new Error('Сеанс изменился во время проверки. Откройте приложение снова.');
      }
      rememberAccess(committedAccess);
    } finally {
      activatingAccess.current = false;
    }
  }, [setState, flush, rememberAccess]);

  const completeOnboarding = useCallback(async (business: BusinessProfile) => {
    const next = { ...stateRef.current, business, onboardingComplete: true, onboardingStep: 2 };
    if (modeRef.current !== 'telegram' || !storageRef.current) throw new Error('Откройте BizBox в Telegram.');
    completingRef.current = true;
    if (!pendingRef.current && !attemptedRef.current) recoveryBaseRef.current = revisionRef.current;
    pendingRef.current = next;
    cacheLocalCopy(next);
    try {
      await flush(); // Do not leave onboarding until Telegram acknowledges the committed snapshot.
    } finally {
      completingRef.current = false;
    }
  }, [flush, cacheLocalCopy]);

  const saveOnboardingDraft = useCallback((business: BusinessProfile, step: number) => {
    if (stateRef.current.onboardingComplete || completingRef.current || pendingRef.current?.onboardingComplete) return;
    setState(previous => ({ ...previous, business, onboardingStep: step }));
  }, [setState]);

  const retrySave = useCallback(async () => {
    if (!pendingRef.current && offlineCheckpointRef.current) { await reloadWorkspace(); return; }
    const retryingCompletion = Boolean(pendingRef.current?.onboardingComplete && !stateRef.current.onboardingComplete);
    if (retryingCompletion) completingRef.current = true;
    try { await flush(); } finally {
      if (retryingCompletion) completingRef.current = false;
    }
  }, [flush, reloadWorkspace]);
  const dismissLegacy = useCallback(() => setLegacyState(null), []);
  const importLegacy = useCallback(async () => {
    if (!legacyState || modeRef.current !== 'telegram') return;
    const { accessCode: _untrustedCode, ...legacyData } = legacyState;
    const next = { ...legacyData, user: { ...legacyData.user!, plan: 'free' as const } };
    clearAccess();
    if (!pendingRef.current && !attemptedRef.current) recoveryBaseRef.current = revisionRef.current;
    pendingRef.current = next;
    cacheLocalCopy(next);
    await flush();
    replaceState(next);
    setLegacyState(null);
  }, [legacyState, flush, replaceState, clearAccess, cacheLocalCopy]);

  const exportWorkspace = useCallback(() => {
    downloadWorkspace(pendingRef.current || stateRef.current);
  }, []);

  const updateUser = useCallback((patch: Partial<UserProfile>) => {
    const { plan: _untrustedPlan, ...profilePatch } = patch;
    const allowedPatch = modeRef.current === 'demo' ? patch : profilePatch;
    setState(s => s.user ? { ...s, user: { ...s.user, ...allowedPatch } } : s);
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
    if (modeRef.current !== 'demo') return;
    setState(s => s.user ? { ...s, user: { ...s.user, plan } } : s);
  }, [setState]);

  const addPayment = useCallback((p: Omit<PaymentRequest, 'id' | 'createdAt' | 'status'>): string => {
    const id = uid('pay');
    setState(s => ({
      ...s,
      payments: [{ ...p, id, createdAt: new Date().toISOString(), status: 'awaiting_payment' as const }, ...s.payments].slice(0, 50),
    }));
    return id;
  }, [setState]);

  const updatePaymentStatus = useCallback((id: string, status: PaymentStatus) => {
    if (modeRef.current !== 'demo' && status !== 'navigated_to_kaspi' && status !== 'awaiting_confirmation') return;
    setState(s => ({ ...s, payments: s.payments.map(p => {
      if (p.id !== id || p.status === 'confirmed' || p.status === 'rejected') return p;
      if (status === 'navigated_to_kaspi' && p.status !== 'awaiting_payment') return p;
      return { ...p, status };
    }) }));
  }, [setState]);

  const confirmPayment = useCallback((id: string) => {
    if (modeRef.current !== 'demo') return;
    setState(s => {
      const payment = s.payments.find(p => p.id === id);
      if (!payment || payment.status === 'confirmed' || payment.status === 'rejected') return s;
      return {
        ...s,
        payments: s.payments.map(p => p.id === id ? { ...p, status: 'confirmed' } : p),
        user: s.user ? { ...s.user, plan: payment.plan } : s.user,
      };
    });
  }, [setState]);

  const rejectPayment = useCallback((id: string) => {
    if (modeRef.current !== 'demo') return;
    setState(s => ({ ...s, payments: s.payments.map(p => p.id === id && p.status !== 'confirmed' && p.status !== 'rejected' ? { ...p, status: 'rejected' } : p) }));
  }, [setState]);

  const applyReferralCode = useCallback((code: string) => {
    if (modeRef.current !== 'demo') return { ok: false, message: 'Используйте персональный код доступа, выданный владельцем BizBox после проверки оплаты.' };
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



  const hasCurrentSession = auth.mode === 'telegram' && !accessSuspended.current
    && currentTelegramUserId() === telegramUserIdRef.current;
  const serverAccess = hasCurrentSession && billing.serverSubscription && billing.serverSubscription.expiresAt > Date.now()
    ? billing.serverSubscription : null;
  const legacyAccess = hasCurrentSession && subscriptionAccess && subscriptionAccess.expiresAt > Date.now()
    ? subscriptionAccess : null;
  const effectiveAccess = serverAccess || legacyAccess;
  const value: AppContextValue = {
    state: auth.mode === 'telegram' ? withPlan(state, effectiveAccess?.plan || 'free') : state,
    auth, referral, subscriptionAccess: effectiveAccess, activateAccessCode, bootStatus, bootError, syncStatus, syncError, syncLocallySaved, syncConflict, legacyState,
    paymentRequest: billing.paymentRequest, billingStatus: billing.billingStatus, billingError: billing.billingError,
    submitPaymentRequest: billing.submitPaymentRequest, refreshBilling: billing.refreshBilling,
    startDemo, logout, reloadWorkspace, resolveWorkspaceConflict, retrySave, importLegacy, dismissLegacy, exportWorkspace,
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
