import { HttpError } from './telegram.mjs';

export async function billingStore(action, args) {
  const url = process.env.BIZBOX_STORAGE_URL;
  const token = process.env.BIZBOX_STORAGE_TOKEN;
  if (!url || !token || !/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/bizbox-billing-store$/.test(url)) {
    throw new HttpError(503, 'billing_unavailable', 'Заявки пока недоступны. Попробуй позже или напиши владельцу.');
  }
  let response, data;
  try {
    response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bizbox-storage-token': token },
      body: JSON.stringify({ action, args }), signal: AbortSignal.timeout(12_000), redirect: 'error',
    });
    data = await response.json();
  } catch { throw new HttpError(503, 'billing_unavailable', 'Не удалось связаться с хранилищем заявок. Попробуй ещё раз.'); }
  if (!response.ok) {
    const rawCode = typeof data?.code === 'string' ? data.code : data?.error?.code;
    const code = typeof rawCode === 'string' ? rawCode.toLowerCase() : '';
    const messages = {
      rate_limit: 'Слишком много заявок. Попробуй позже.',
      no_pending_request: 'Нет заявки, ожидающей решения. Сначала нажми «Я оплатил» в тарифах.',
      request_not_found: 'Заявка не найдена.',
    };
    if (code && Object.hasOwn(messages, code)) throw new HttpError(code === 'rate_limit' ? 429 : 400, code, messages[code]);
    throw new HttpError(503, 'billing_unavailable', 'Не удалось обработать заявку. Попробуй ещё раз.');
  }
  return data;
}

export function clientState(state) {
  const sub = state.subscription;
  const req = state.request;
  return {
    subscription: sub && Date.parse(sub.expires_at) > Date.now()
      ? { plan: sub.plan, expiresAt: Date.parse(sub.expires_at), id: sub.last_request_id } : null,
    request: req ? {
      id: req.id, plan: req.plan, amount: req.amount, status: req.status,
      createdAt: Date.parse(req.created_at), receiptReceived: Boolean(req.receipt?.file_id),
    } : null,
  };
}
