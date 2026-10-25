import test from 'node:test';
import assert from 'node:assert/strict';
import { getTelegram, isTelegramLaunch } from '../src/lib/telegram.ts';

function installWindow(t, { app, hash = '' } = {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { ...(app ? { Telegram: { WebApp: app } } : {}), location: { hash } },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else delete globalThis.window;
  });
}

test('normal Telegram launch exposes the SDK bridge', t => {
  const app = { initData: 'test-init-data', platform: 'android' };
  installWindow(t, { app });
  assert.equal(getTelegram(), app);
  assert.equal(isTelegramLaunch(), true);
});

test('keyboard launch keeps working with legitimately empty initData', t => {
  const app = { initData: '', platform: 'web' };
  installWindow(t, { app });
  assert.equal(getTelegram(), app);
  assert.equal(isTelegramLaunch(), true);
});

test('missing SDK with Telegram platform still identifies a failed Telegram launch', t => {
  installWindow(t, { hash: '#tgWebAppPlatform=ios&tgWebAppVersion=9.0' });
  assert.equal(getTelegram(), null);
  assert.equal(isTelegramLaunch(), true);
});

test('missing SDK with initData still identifies a failed Telegram launch', t => {
  installWindow(t, { hash: '#tgWebAppData=' });
  assert.equal(getTelegram(), null);
  assert.equal(isTelegramLaunch(), true);
});

test('standalone official SDK with unknown platform does not enter Telegram workspace', t => {
  installWindow(t, { app: { initData: '', platform: 'unknown' } });
  assert.equal(getTelegram(), null);
  assert.equal(isTelegramLaunch(), false);
});

test('ordinary standalone browser without SDK stays outside Telegram workspace', t => {
  installWindow(t);
  assert.equal(getTelegram(), null);
  assert.equal(isTelegramLaunch(), false);
});
