// Signed access for this user's personal workspace UI only. The client and its
// clock can be modified: future server features must verify identity, signatures,
// expiry and permissions on the server. This is not payment verification.
const PUBLIC_KEY: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: 'xme6FBm6LjPUBoxQnaVRfenTFAI0nIXohr5MwykMyvc',
  y: '6zUE5NLkT-fpqtzXpA7alKDv0rrhl8i_AJkB2VkCOCA',
  ext: true,
  key_ops: ['verify'],
};

const MAX_CODE_LENGTH = 4096;
const DAY_MS = 86_400_000;
const CLOCK_TOLERANCE_MS = 5 * 60_000;
const INVALID_CODE = 'Код доступа повреждён. Скопируйте его целиком из сообщения владельца.';

export interface SubscriptionAccess {
  plan: 'business' | 'pro';
  expiresAt: number;
  id: string;
}

interface AccessPayload extends SubscriptionAccess {
  v: 1;
  userId: string;
  issuedAt: number;
}

function validUserId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value)
    && Number.isSafeInteger(Number(value));
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new Error(INVALID_CODE);
  let binary: string;
  try {
    binary = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
  } catch {
    throw new Error(INVALID_CODE);
  }
  // Reject alternate encodings with nonzero unused padding bits.
  if (btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') !== value) {
    throw new Error(INVALID_CODE);
  }
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function readPayload(bytes: Uint8Array): AccessPayload {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error(INVALID_CODE);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(INVALID_CODE);
  const payload = value as Record<string, unknown>;
  const keys = ['v', 'id', 'userId', 'plan', 'issuedAt', 'expiresAt'];
  if (Object.keys(payload).length !== keys.length || !keys.every(key => Object.prototype.hasOwnProperty.call(payload, key))
    || payload.v !== 1
    || typeof payload.id !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(payload.id)
    || !validUserId(payload.userId)
    || (payload.plan !== 'business' && payload.plan !== 'pro')
    || typeof payload.issuedAt !== 'number' || !Number.isSafeInteger(payload.issuedAt) || payload.issuedAt <= 0
    || typeof payload.expiresAt !== 'number' || !Number.isSafeInteger(payload.expiresAt)
    || payload.expiresAt <= payload.issuedAt || payload.expiresAt - payload.issuedAt > 366 * DAY_MS) {
    throw new Error(INVALID_CODE);
  }
  return payload as unknown as AccessPayload;
}

/** Verify a manually issued bb1 code for the current Telegram account. */
export async function verifyAccessCode(code: string, userId: string, now = Date.now()): Promise<SubscriptionAccess> {
  if (!validUserId(userId)) {
    throw new Error('Не удалось определить ваш Telegram ID. Откройте BizBox через меню бота в Telegram.');
  }
  if (!Number.isSafeInteger(now) || now <= 0) throw new Error('Проверьте дату и время на устройстве.');
  if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH) throw new Error(INVALID_CODE);
  const normalized = code.trim();
  const parts = normalized.split('.');
  if (parts.length !== 3 || parts[0] !== 'bb1') throw new Error(INVALID_CODE);
  const payloadBytes = decodeBase64Url(parts[1]);
  const signature = decodeBase64Url(parts[2]);
  if (signature.length !== 64) throw new Error(INVALID_CODE);
  const payload = readPayload(payloadBytes);
  if (!globalThis.crypto?.subtle) {
    throw new Error('Проверка кода недоступна. Обновите Telegram и откройте приложение снова.');
  }
  let valid: boolean;
  try {
    const publicKey = await crypto.subtle.importKey('jwk', PUBLIC_KEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    // Node's ieee-p1363 signature is the 64-byte r || s format WebCrypto uses.
    valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature,
      new TextEncoder().encode(`bb1.${parts[1]}`),
    );
  } catch {
    throw new Error('Не удалось проверить код доступа. Обновите Telegram и попробуйте снова.');
  }
  if (!valid) throw new Error('Подпись кода недействительна. Запросите новый код у владельца BizBox.');
  if (payload.userId !== userId) throw new Error('Этот код выдан другому Telegram-аккаунту. Запросите код для вашего ID.');
  if (payload.issuedAt > now + CLOCK_TOLERANCE_MS) throw new Error('Код выдан в будущем. Проверьте дату и время на устройстве.');
  if (payload.expiresAt <= now) throw new Error('Срок действия кода закончился. Обратитесь к владельцу BizBox для продления.');
  return { plan: payload.plan, expiresAt: payload.expiresAt, id: payload.id };
}
