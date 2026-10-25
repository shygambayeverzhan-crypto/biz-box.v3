import type { CloudStorage } from './cloudWorkspace';

export const BOT_URL = 'https://t.me/Biznowbox_bot?startapp';
export const APP_VERSION = '2.0-cloud';

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string; last_name?: string; username?: string } };
  platform: string;
  CloudStorage?: CloudStorage;
  ready: () => void;
  expand: () => void;
  close: () => void;
  isVersionAtLeast: (version: string) => boolean;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
}

declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp } }
}

export function getTelegram(): TelegramWebApp | null {
  const app = window.Telegram?.WebApp;
  return app?.initData && app.platform !== 'unknown' ? app : null;
}

export function isTelegramLaunch(): boolean {
  return Boolean(getTelegram()) || new URLSearchParams(window.location.hash.slice(1)).has('tgWebAppData');
}

// Display hints only. CloudStorage itself is isolated by Telegram per bot/user.
// No server authorization decision may use initDataUnsafe.
export function telegramDisplayName(app: TelegramWebApp): string {
  return [app.initDataUnsafe?.user?.first_name, app.initDataUnsafe?.user?.last_name]
    .filter(Boolean).join(' ').slice(0, 120) || 'Предприниматель';
}
