import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Official contracts:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// https://core.telegram.org/bots/api#making-requests
// https://core.telegram.org/bots/api#setwebhook
// This module is server-only. Never return initData, bot tokens, or Telegram URLs
// containing a bot token to the client or to application logs.

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

const MAX_INIT_DATA_BYTES = 16_384;
const MAX_INIT_AGE_SECONDS = 24 * 60 * 60;
const MAX_FUTURE_SECONDS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9]{5,20}:[A-Za-z0-9_-]{20,128}$/;
const WEBHOOK_SECRET = /^[A-Za-z0-9_-]{1,256}$/;
const STATUS_LABELS = {
  pending: 'Ожидает твоего решения',
  approved: 'Доступ одобрен владельцем',
  rejected: 'Заявка отклонена владельцем',
};

function invalidSession() {
  return new HttpError(401, 'telegram_auth_invalid', 'Не удалось проверить вход. Закрой BizBox и открой его снова через Telegram.');
}

function requireBotToken(token) {
  if (typeof token !== 'string' || !TOKEN.test(token)) {
    throw new HttpError(503, 'bot_not_configured', 'Подключение бота ещё не настроено. Попробуй позже.');
  }
}

/** Only accept the unmodified Telegram.WebApp.initData from the request body. */
export function verifyInitData(initData, botToken, now = Date.now()) {
  requireBotToken(botToken);
  if (typeof initData !== 'string' || !initData || initData.length > MAX_INIT_DATA_BYTES
    || Buffer.byteLength(initData, 'utf8') > MAX_INIT_DATA_BYTES || !Number.isFinite(now)
    || /%(?![0-9a-f]{2})/i.test(initData)) {
    throw invalidSession();
  }

  const fields = new Map();
  const params = new URLSearchParams(initData);
  for (const [key, value] of params) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)
      || ['__proto__', 'prototype', 'constructor'].includes(key)
      || fields.has(key) || fields.size >= 32 || /[\u0000\r\n]/.test(value)
      || Buffer.byteLength(value, 'utf8') > 8_192) {
      throw invalidSession();
    }
    fields.set(key, value);
  }

  const receivedHash = fields.get('hash');
  if (typeof receivedHash !== 'string' || !/^[0-9a-f]{64}$/i.test(receivedHash)) {
    throw invalidSession();
  }
  fields.delete('hash');
  // The bot-token HMAC includes every received field except hash, including
  // signature if Telegram supplied it. The third-party Ed25519 scheme differs.
  const dataCheckString = [...fields.entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
  if (!timingSafeEqual(expectedHash, Buffer.from(receivedHash, 'hex'))) {
    throw invalidSession();
  }

  const authDate = fields.get('auth_date');
  if (typeof authDate !== 'string' || !/^[0-9]{1,12}$/.test(authDate)) {
    throw invalidSession();
  }
  const authSeconds = Number(authDate);
  const ageSeconds = now / 1_000 - authSeconds;
  if (!Number.isSafeInteger(authSeconds) || authSeconds <= 0 || ageSeconds < -MAX_FUTURE_SECONDS) {
    throw invalidSession();
  }
  if (ageSeconds > MAX_INIT_AGE_SECONDS) {
    throw new HttpError(401, 'telegram_auth_expired', 'Сессия Telegram истекла. Закрой BizBox и открой его заново.');
  }

  let user;
  try {
    user = JSON.parse(fields.get('user') || 'null');
  } catch {
    throw invalidSession();
  }
  if (!user || typeof user !== 'object' || Array.isArray(user)
    || !Number.isSafeInteger(user.id) || user.id <= 0
    || typeof user.first_name !== 'string' || user.first_name.length > 256
    || (user.last_name !== undefined && (typeof user.last_name !== 'string' || user.last_name.length > 256))
    || (user.username !== undefined && (typeof user.username !== 'string' || !/^[A-Za-z0-9_]{1,32}$/.test(user.username)))) {
    throw invalidSession();
  }

  return {
    id: String(user.id),
    name: safeLine([user.first_name, user.last_name].filter(Boolean).join(' '), 64) || 'Пользователь',
    username: user.username || '',
  };
}

/** Compare the X-Telegram-Bot-Api-Secret-Token header without exposing secrets. */
export function verifyWebhookSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string'
    || !WEBHOOK_SECRET.test(actual) || !WEBHOOK_SECRET.test(expected)) return false;
  return timingSafeEqual(
    createHash('sha256').update(actual).digest(),
    createHash('sha256').update(expected).digest(),
  );
}

/**
 * One bounded Bot API request. No automatic retries: repeating a sendMessage
 * after an uncertain timeout can create duplicates. The caller owns delivery
 * persistence and retries. Never preserve network error causes: they may carry
 * the request URL, including the bot token.
 */
export async function botApi(method, payload, token) {
  requireBotToken(token);
  if (typeof method !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(method)
    || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(500, 'telegram_request_invalid', 'Не удалось подготовить сообщение бота.');
  }
  let body;
  try {
    body = JSON.stringify(payload);
  } catch {
    throw new HttpError(500, 'telegram_request_invalid', 'Не удалось подготовить сообщение бота.');
  }
  if (!body || Buffer.byteLength(body, 'utf8') > 131_072) {
    throw new HttpError(500, 'telegram_request_too_large', 'Сообщение для бота слишком большое.');
  }

  let response;
  let result;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(8_000),
      redirect: 'error',
    });
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > 1_048_576) {
      throw new HttpError(502, 'telegram_response_invalid', 'Telegram вернул некорректный ответ.');
    }
    try {
      result = JSON.parse(text);
    } catch {
      throw new HttpError(502, 'telegram_response_invalid', 'Telegram вернул некорректный ответ.');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new HttpError(504, 'telegram_timeout', 'Telegram не ответил вовремя. Попробуй чуть позже.');
    }
    throw new HttpError(502, 'telegram_unavailable', 'Не удалось связаться с Telegram. Попробуй позже.');
  }

  if (!response.ok || !result || typeof result !== 'object' || result.ok !== true) {
    const apiCode = Number.isSafeInteger(result?.error_code) ? result.error_code : response.status;
    const message = apiCode === 429
      ? 'Telegram просит немного подождать. Повтори попытку позже.'
      : apiCode === 403
        ? 'Бот не может написать в чат. Открой BizBox в Telegram и нажми «Старт».'
        : 'Telegram не принял запрос. Попробуй позже.';
    const error = new HttpError(apiCode === 429 ? 429 : 502, `telegram_api_${apiCode}`, message);
    error.telegramCode = apiCode;
    const retryAfter = result?.parameters?.retry_after;
    if (Number.isSafeInteger(retryAfter) && retryAfter > 0) error.retryAfter = retryAfter;
    throw error;
  }
  return result.result;
}

function safeLine(value, maxLength = 64) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function requireRequest(request) {
  if (!request || typeof request !== 'object' || !UUID.test(request.id || '')
    || !['business', 'pro'].includes(request.plan)
    || !Object.hasOwn(STATUS_LABELS, request.status)) {
    throw new HttpError(500, 'payment_request_invalid', 'Не удалось прочитать заявку.');
  }
}

/** Plain text only: pass to sendMessage without parse_mode. */
export function formatRequestMessage(request) {
  requireRequest(request);
  const name = safeLine(request.name, 64) || 'Пользователь';
  const username = typeof request.username === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(request.username)
    ? ` (@${request.username})` : '';
  const amount = Number.isSafeInteger(request.amount) && request.amount >= 0
    ? new Intl.NumberFormat('ru-RU').format(request.amount) : '—';
  const days = Number.isSafeInteger(request.days) && request.days > 0 && request.days <= 366
    ? request.days : 30;
  const created = new Date(request.created_at);
  const dateLabel = Number.isFinite(created.getTime())
    ? new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Asia/Almaty', dateStyle: 'short', timeStyle: 'short',
    }).format(created) : '—';
  const lines = [
    request.status === 'pending' ? 'Новая заявка BizBox' : 'Заявка BizBox',
    '',
    `Клиент: ${name}${username}`,
    `Telegram ID: ${safeLine(request.user_id, 20)}`,
    `Тариф: ${request.plan.toUpperCase()} · ${days} дней`,
    `Сумма по заявке: ${amount} ₸`,
    `Создана: ${dateLabel} (Алматы)`,
    `Чек: ${request.receipt?.file_id ? 'прикреплён к заявке' : 'пока не прикреплён'}`,
    `Статус: ${STATUS_LABELS[request.status]}`,
    `Заявка: ${request.id}`,
  ];
  if (request.status === 'pending') {
    lines.push('', 'Проверь поступление в Kaspi. Подтверждение откроет доступ к тарифу.');
  }
  return lines.join('\n');
}

/** Telegram callback_data stays below its 64-byte limit (47 bytes for UUIDs). */
export function requestKeyboard(request) {
  requireRequest(request);
  if (request.status !== 'pending') return { inline_keyboard: [] };
  return {
    inline_keyboard: [[
      { text: '✅ Подтвердить', callback_data: `bb:approve:${request.id}` },
      { text: '❌ Отклонить', callback_data: `bb:reject:${request.id}` },
    ]],
  };
}
