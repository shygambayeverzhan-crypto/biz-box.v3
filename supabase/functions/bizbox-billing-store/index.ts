// Internal broker-to-storage endpoint, never called directly by the browser.
// Deploy with verify_jwt=false: this handler checks its own high-entropy token.
// Root substitutes the SHA-256 HASH only. Never embed the token or service key.
const STORAGE_TOKEN_SHA256 = 'c3844724bbb0193cda1d2b42550309c815aa07055ca631b4aaa8e18fa03a1f47';
const ACTIONS = new Set([
  'create_request', 'get_state', 'attach_receipt', 'list_pending', 'decide',
  'claim_notification', 'mark_notification', 'release_notification', 'get_request', 'mark_customer_notified',
]);
const MAX_BODY_BYTES = 16_384;
const GROWTH_ACTIONS = new Set(['referral_register','referral_state','wallet_redeem','assistant_reserve']);

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

function fail(code: string, message: string, status: number): Response {
  return response({ error: { code, message } }, status);
}

async function authorized(request: Request): Promise<boolean> {
  const token = request.headers.get('x-bizbox-storage-token') || '';
  if (token.length < 32 || token.length > 512) return false;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  const expected = Uint8Array.from(STORAGE_TOKEN_SHA256.match(/.{2}/g) || [], pair => parseInt(pair, 16));
  // Fixed-length digest comparison; no early return based on individual bytes.
  let difference = digest.length ^ expected.length;
  for (let i = 0; i < digest.length; i++) difference |= digest[i] ^ (expected[i] ?? 0);
  return difference === 0;
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error('INVALID_BODY');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('BODY_TIMEOUT')), 3_000); });
  try {
    while (true) {
      const part = await Promise.race([reader.read(), deadline]);
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function credentials(): { url: string; headers: Record<string, string> } | null {
  const value = Deno.env.get('SUPABASE_URL');
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const headers: Record<string, string> = { 'content-type': 'application/json', 'content-profile': 'public', 'accept-profile': 'public' };
  let secret: unknown;
  try { secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default; } catch { /* Legacy fallback below. */ }
  if (typeof secret === 'string' && secret.startsWith('sb_secret_')) {
    // New secret keys are not JWTs and must never be put in a Bearer header.
    headers.apikey = secret;
  } else {
    const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!legacy) return null;
    headers.apikey = legacy;
    headers.authorization = `Bearer ${legacy}`;
  }
  return { url: new URL('/rest/v1/rpc/bizbox_billing_action', url).href, headers };
}

function databaseError(body: unknown): Response {
  const error = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const known: Record<string, [number, string]> = {
    INVALID_ARGUMENT: [400, 'Некорректные данные запроса.'],
    INVALID_ACTION: [400, 'Неизвестное действие.'],
    INVALID_STATE: [409, 'Это действие недоступно для текущего состояния заявки.'],
    FORBIDDEN: [403, 'Нет доступа к этому действию.'],
    REQUEST_NOT_FOUND: [404, 'Заявка не найдена.'],
    NO_PENDING_REQUEST: [409, 'Сначала выберите тариф и создайте заявку.'],
    RATE_LIMIT: [429, 'За последние 24 часа уже создано 5 заявок. Попробуйте позже.'],
    AI_RATE_LIMIT: [429, 'Подождите несколько секунд. Доступно до 30 вопросов в сутки.'],
    AI_DAILY_LIMIT: [429, 'Дневной лимит ИИ исчерпан. Попробуйте завтра.'],
    INSUFFICIENT_BALANCE: [409, 'На бонусном балансе недостаточно средств.'],
    PAYMENT_PENDING: [409, 'Сначала дождитесь решения по текущей заявке на оплату.'],
    ACTIVE_PRO: [409, 'Сначала дождитесь окончания действующего PRO.'],
  };
  if (typeof error.message === 'string' && Object.hasOwn(known, error.message)) {
    const [status, message] = known[error.message];
    return fail(error.message, message, status);
  }
  if (error.code === '55P03' || error.code === '57014') return fail('STORAGE_BUSY', 'Сервис занят. Повторите попытку через несколько секунд.', 503);
  return fail('STORAGE_UNAVAILABLE', 'Не удалось обратиться к хранилищу. Попробуйте позже.', 503);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'Используйте POST.', 405);
  if (!/^[a-f0-9]{64}$/i.test(STORAGE_TOKEN_SHA256)) return fail('NOT_CONFIGURED', 'Сервис ещё не настроен.', 503);
  try {
    if (!await authorized(request)) return fail('UNAUTHORIZED', 'Нет доступа.', 401);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return fail('INVALID_BODY', 'Ожидается JSON.', 415);
    }
    const declaredLength = request.headers.get('content-length');
    if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) return fail('BODY_TOO_LARGE', 'Запрос слишком большой.', 413);
    let input: unknown;
    try { input = await readJson(request); } catch (error) {
      if (error instanceof Error && error.message === 'BODY_TOO_LARGE') return fail('BODY_TOO_LARGE', 'Запрос слишком большой.', 413);
      if (error instanceof Error && error.message === 'BODY_TIMEOUT') return fail('TIMEOUT', 'Истекло время ожидания запроса.', 408);
      return fail('INVALID_BODY', 'Некорректный JSON.', 400);
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('INVALID_BODY', 'Некорректный запрос.', 400);
    const body = input as Record<string, unknown>;
    if (typeof body.action !== 'string' || (!ACTIONS.has(body.action) && !GROWTH_ACTIONS.has(body.action))) return fail('INVALID_ACTION', 'Неизвестное действие.', 400);
    if (!body.args || typeof body.args !== 'object' || Array.isArray(body.args)) return fail('INVALID_ARGUMENT', 'Некорректные аргументы.', 400);
    const config = credentials();
    if (!config) return fail('NOT_CONFIGURED', 'Сервис ещё не настроен.', 503);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const result = await fetch(GROWTH_ACTIONS.has(body.action) ? config.url.replace('bizbox_billing_action','bizbox_growth_action') : config.url, {
        method: 'POST', headers: config.headers, signal: controller.signal, redirect: 'error',
        body: JSON.stringify({ p_action: body.action, p_args: body.args }),
      });
      const data: unknown = await result.json();
      if (!result.ok) return databaseError(data);
      return response(data);
    } catch {
      return controller.signal.aborted
        ? fail('TIMEOUT', 'Хранилище долго отвечает. Повторите запрос.', 504)
        : fail('STORAGE_UNAVAILABLE', 'Не удалось обратиться к хранилищу. Попробуйте позже.', 503);
    } finally { clearTimeout(timer); }
  } catch {
    // Deliberately exclude headers, request bodies, database errors and secrets.
    return fail('INTERNAL_ERROR', 'Временная ошибка сервиса. Попробуйте позже.', 500);
  }
});
