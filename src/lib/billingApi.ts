import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaidPlan } from './billing';
import type { SubscriptionAccess } from './subscriptionAccess';
import { getTelegram } from './telegram';

// Mirrored frontends share one authenticated billing backend.
const BILLING_API = 'https://biz-box-v3.vercel.app/api/bizbox';
const STATE_TIMEOUT_MS = 12_000;
const SUBMIT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 20_000;

export type BillingStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'auth_required';
export interface ServerPaymentRequest {
  id: string;
  plan: PaidPlan;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  receiptReceived: boolean;
}
export interface BillingResponse {
  subscription: SubscriptionAccess | null;
  request: ServerPaymentRequest | null;
  notificationDelivered?: boolean;
}

class BillingApiError extends Error {
  readonly kind: 'auth' | 'unavailable';
  constructor(message: string, kind: 'auth' | 'unavailable' = 'unavailable') {
    super(message);
    this.name = 'BillingApiError';
    this.kind = kind;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function paidPlan(value: unknown): value is PaidPlan { return value === 'business' || value === 'pro'; }
function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function parseResponse(value: unknown, action: 'state' | 'request'): BillingResponse {
  const invalid = () => new BillingApiError('Не удалось прочитать статус оплаты. Обнови его чуть позже.');
  if (!record(value) || !('subscription' in value) || !('request' in value)) throw invalid();
  let subscription: SubscriptionAccess | null = null;
  let request: ServerPaymentRequest | null = null;
  if (value.subscription !== null) {
    const s = value.subscription;
    if (!record(s) || !paidPlan(s.plan) || !positiveInteger(s.expiresAt) || !identifier(s.id)) throw invalid();
    subscription = { plan: s.plan, expiresAt: s.expiresAt, id: s.id };
  }
  if (value.request !== null) {
    const r = value.request;
    if (!record(r) || typeof r.id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)
      || !paidPlan(r.plan) || !positiveInteger(r.amount) || !positiveInteger(r.createdAt)
      || (r.status !== 'pending' && r.status !== 'approved' && r.status !== 'rejected') || typeof r.receiptReceived !== 'boolean') throw invalid();
    request = { id: r.id, plan: r.plan, amount: r.amount, status: r.status as ServerPaymentRequest['status'], createdAt: r.createdAt, receiptReceived: r.receiptReceived };
  }
  if (action === 'request' && (typeof value.notificationDelivered !== 'boolean' || !request)) throw invalid();
  return { subscription, request, notificationDelivered: typeof value.notificationDelivered === 'boolean' ? value.notificationDelivered : undefined };
}

async function fetchBilling(action: 'state' | 'request', initData: string, signal: AbortSignal, plan?: PaidPlan): Promise<BillingResponse> {
  if (!initData) throw new BillingApiError('Открой BizBox через профиль бота: для проверки оплаты нужны данные входа Telegram.', 'auth');
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) controller.abort();
  let timedOut = false;
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, action === 'request' ? SUBMIT_TIMEOUT_MS : STATE_TIMEOUT_MS);
  try {
    const response = await fetch(BILLING_API, {
      method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, initData, ...(plan ? { plan } : {}) }),
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      throw new BillingApiError('Данные входа Telegram устарели. Закрой приложение и открой снова через профиль бота.', 'auth');
    }
    if (response.status === 429) throw new BillingApiError('Слишком много запросов. Подожди немного и обнови статус.');
    if (!response.ok) throw new BillingApiError('Сервис подтверждения оплаты временно недоступен. Можно отправить чек Ержану напрямую.');
    let data: unknown;
    try { data = await response.json(); } catch { throw new BillingApiError('Сервис оплаты ещё не отвечает. Попробуй позже или напиши Ержану.'); }
    return parseResponse(data, action);
  } catch (error) {
    if (signal.aborted) throw new DOMException('Запрос отменён', 'AbortError');
    if (timedOut) throw new BillingApiError('Сервис оплаты отвечает дольше обычного. Обнови статус перед повторной заявкой.');
    if (error instanceof BillingApiError) throw error;
    throw new BillingApiError('Не удалось связаться с сервисом оплаты. Проверь интернет или отправь чек Ержану напрямую.');
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener('abort', onAbort);
  }
}

interface BillingSession { enabled: boolean; userId: string | null; epoch: number }
interface ScopedResult { key: string; data: BillingResponse }

/** Backend entitlements remain in memory and never become trusted CloudStorage data. */
export function useBilling(session: BillingSession) {
  const key = `${session.epoch}:${session.userId || ''}`;
  const current = useRef({ ...session, key });
  current.current = { ...session, key };
  const [result, setResult] = useState<ScopedResult | null>(null);
  const [status, setStatus] = useState<BillingStatus>('idle');
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const authFailed = useRef(false);
  const inFlight = useRef<{ action: 'state' | 'request'; controller: AbortController; promise: Promise<BillingResponse> } | null>(null);

  const cancel = useCallback(() => {
    sequence.current += 1;
    inFlight.current?.controller.abort();
    inFlight.current = null;
  }, []);

  const clearBilling = useCallback(() => {
    current.current = { ...current.current, enabled: false };
    cancel(); setResult(null); setStatus('idle'); setError('');
  }, [cancel]);

  const run = useCallback((action: 'state' | 'request', plan?: PaidPlan): Promise<BillingResponse> => {
    const snapshot = current.current;
    const initData = getTelegram()?.initData || '';
    if (snapshot.enabled && snapshot.userId && String(getTelegram()?.initDataUnsafe?.user?.id || '') !== snapshot.userId) {
      cancel(); setResult(null); authFailed.current = true;
      const problem = new BillingApiError('Telegram-аккаунт изменился. Закрой BizBox и открой его снова.', 'auth');
      setStatus('auth_required'); setError(problem.message);
      return Promise.reject(problem);
    }
    if (!snapshot.enabled || !snapshot.userId || !initData) {
      const problem = new BillingApiError('Открой BizBox через профиль бота: для проверки оплаты нужны данные входа Telegram.', 'auth');
      authFailed.current = true;
      setStatus('auth_required'); setError(problem.message);
      return Promise.reject(problem);
    }
    if (inFlight.current) {
      if (action === 'state') return inFlight.current.promise;
      if (inFlight.current.action === 'request') return Promise.reject(new Error('Заявка уже отправляется. Дождись ответа.'));
      cancel(); // A stale poll must never overwrite a newly submitted request.
    }
    const controller = new AbortController();
    const operation = ++sequence.current;
    const isCurrent = () => operation === sequence.current && current.current.enabled
      && snapshot.key === current.current.key && snapshot.userId === current.current.userId
      && String(getTelegram()?.initDataUnsafe?.user?.id || '') === snapshot.userId
      && getTelegram()?.initData === initData;
    setStatus(previous => previous === 'ready' && action === 'state' ? previous : 'loading');
    setError('');
    authFailed.current = false;
    const promise = (async () => {
      try {
        const data = await fetchBilling(action, initData, controller.signal, plan);
        if (!isCurrent()) throw new DOMException('Сеанс изменился', 'AbortError');
        setResult({ key: snapshot.key, data });
        setStatus('ready');
        return data;
      } catch (problem) {
        if (isCurrent() && !controller.signal.aborted) {
          const requiresAuth = problem instanceof BillingApiError && problem.kind === 'auth';
          authFailed.current = requiresAuth;
          setStatus(requiresAuth ? 'auth_required' : 'unavailable');
          setError(problem instanceof Error ? problem.message : 'Не удалось обновить оплату. Попробуй позже.');
        }
        throw problem;
      } finally {
        if (operation === sequence.current) inFlight.current = null;
      }
    })();
    inFlight.current = { action, controller, promise };
    return promise;
  }, [cancel]);

  const refreshBilling = useCallback(async () => { await run('state'); }, [run]);
  const submitPaymentRequest = useCallback(async (plan: PaidPlan) => {
    const data = await run('request', plan);
    return { notificationDelivered: data.notificationDelivered === true };
  }, [run]);

  useEffect(() => {
    cancel(); setResult(null); setError(''); setStatus('idle'); authFailed.current = false;
    if (!session.enabled) return;
    let stopped = false;
    let timer: number | undefined;
    let pollVersion = 0;
    const clearTimer = () => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
    const poll = async (version: number) => {
      if (stopped || document.visibilityState !== 'visible') return;
      try { await refreshBilling(); } catch { /* Exposed through billingStatus; retain valid legacy access. */ }
      if (!stopped && version === pollVersion && !authFailed.current && document.visibilityState === 'visible') {
        timer = window.setTimeout(() => { void poll(version); }, POLL_INTERVAL_MS);
      }
    };
    const onVisible = () => {
      clearTimer(); pollVersion += 1;
      if (document.visibilityState === 'visible') { void poll(pollVersion); }
      else cancel();
    };
    document.addEventListener('visibilitychange', onVisible);
    void poll(pollVersion);
    return () => {
      stopped = true; pollVersion += 1; clearTimer(); cancel();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session.enabled, session.userId, session.epoch, cancel, refreshBilling]);

  useEffect(() => {
    const expiresAt = result?.data.subscription?.expiresAt;
    if (!session.enabled || result?.key !== key || !expiresAt) return;
    let timer: number | undefined;
    const expire = () => {
      const remaining = expiresAt - Date.now();
      if (remaining > 0) {
        timer = window.setTimeout(expire, Math.min(remaining + 25, 2_147_000_000));
        return;
      }
      setResult(previous => previous?.key === key && previous.data.subscription?.expiresAt === expiresAt
        ? { ...previous, data: { ...previous.data, subscription: null } } : previous);
    };
    expire();
    return () => { if (timer !== undefined) window.clearTimeout(timer); };
  }, [session.enabled, key, result?.key, result?.data.subscription?.expiresAt]);

  const activeResult = session.enabled && result?.key === key ? result.data : null;
  return {
    serverSubscription: activeResult?.subscription || null,
    paymentRequest: activeResult?.request || null,
    billingStatus: session.enabled ? status : 'idle' as BillingStatus,
    billingError: session.enabled ? error : '',
    refreshBilling,
    submitPaymentRequest,
    clearBilling,
  };
}

export function botReceiptLink(requestId: string): string {
  return `https://t.me/Biznowbox_bot?start=receipt_${encodeURIComponent(requestId)}`;
}
