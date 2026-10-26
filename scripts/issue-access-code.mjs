#!/usr/bin/env node
// Owner-only offline tool. Check the actual payment before issuing a code.
// Never place the private PEM in the repository, frontend, or Telegram messages.
import { readFileSync } from 'node:fs';
import { createPrivateKey, createPublicKey, randomUUID, sign } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DEFAULT_KEY_FILE = fileURLToPath(new URL('../.secrets/subscription-private.pem', import.meta.url));
const EXPECTED_PUBLIC_KEY = {
  kty: 'EC', crv: 'P-256',
  x: 'xme6FBm6LjPUBoxQnaVRfenTFAI0nIXohr5MwykMyvc',
  y: '6zUE5NLkT-fpqtzXpA7alKDv0rrhl8i_AJkB2VkCOCA',
};
const DAY_MS = 86_400_000;

function usage() {
  return `Выдать код доступа BizBox после ручной проверки оплаты.

Использование:
  node scripts/issue-access-code.mjs --user <TelegramID> --plan business|pro --days 30
  node scripts/issue-access-code.mjs --help

--user   Положительный числовой Telegram ID получателя, без @ и пробелов.
--plan   business или pro.
--days   Целое число от 1 до 366; срок начинается в момент выдачи.

Ключ по умолчанию: .secrets/subscription-private.pem рядом с проектом.
Переменная BIZBOX_SIGNING_KEY_FILE задаёт путь к существующей копии этого ключа.
Новый ключ автоматически не создаётся. Сохраните резервную копию приватного ключа.
Команда печатает только код доступа. Передайте его получателю вручную.
Повторная выдача создаёт другой код; предыдущий действует до своего срока.
Для продления до окончания текущего срока согласуйте дату выдачи с клиентом.
Это локальный доступ к интерфейсу, а не подтверждение платежа или серверная авторизация.`;
}

function parseArgs(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) return null;
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!['--user', '--plan', '--days'].includes(flag) || !value || Object.hasOwn(options, flag)) {
      throw new Error('Неверные аргументы. Используйте --help.');
    }
    options[flag] = value;
  }
  if (!/^[1-9]\d{0,15}$/.test(options['--user'] || '') || !Number.isSafeInteger(Number(options['--user']))) {
    throw new Error('--user должен содержать положительный числовой Telegram ID.');
  }
  if (!['business', 'pro'].includes(options['--plan'])) throw new Error('--plan: укажите business или pro.');
  if (!/^[1-9]\d{0,2}$/.test(options['--days'] || '') || Number(options['--days']) > 366) {
    throw new Error('--days: укажите целое число от 1 до 366.');
  }
  return { userId: options['--user'], plan: options['--plan'], days: Number(options['--days']) };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options) { process.stdout.write(`${usage()}\n`); return; }
  let keyBytes;
  try {
    keyBytes = readFileSync(process.env.BIZBOX_SIGNING_KEY_FILE || DEFAULT_KEY_FILE);
  } catch {
    throw new Error('Приватный ключ недоступен. Восстановите .secrets/subscription-private.pem из резервной копии или задайте BIZBOX_SIGNING_KEY_FILE. Новый ключ автоматически не создаётся.');
  }
  let privateKey;
  try {
    privateKey = createPrivateKey(keyBytes);
  } catch {
    throw new Error('Не удалось прочитать приватный ключ. Нужен существующий PEM-ключ BizBox без пароля.');
  } finally {
    keyBytes.fill(0);
  }
  const publicKey = createPublicKey(privateKey).export({ format: 'jwk' });
  if (Object.entries(EXPECTED_PUBLIC_KEY).some(([key, value]) => publicKey[key] !== value)) {
    throw new Error('Этот ключ не соответствует опубликованному ключу BizBox. Используйте исходный приватный ключ.');
  }
  const issuedAt = Date.now();
  const payload = {
    v: 1, id: randomUUID(), userId: options.userId, plan: options.plan,
    issuedAt, expiresAt: issuedAt + options.days * DAY_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const message = `bb1.${encoded}`;
  const signature = sign('sha256', Buffer.from(message, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  process.stdout.write(`${message}.${signature.toString('base64url')}\n`);
}

try { main(); } catch (error) {
  // Never print crypto/parser stacks or key material.
  process.stderr.write(`${error instanceof Error ? error.message : 'Не удалось выдать код доступа.'}\n`);
  process.exitCode = 1;
}
