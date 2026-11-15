import { getTelegram } from '@/lib/telegram';
export type BizTheme = 'dark' | 'light';
const THEME_KEY = 'bizbox_ui_theme';
/** Preferences are cosmetic; business data must stay in Telegram CloudStorage. */
export function getSavedTheme(): BizTheme {
  try { return window.localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}
export function setBizTheme(theme: BizTheme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F6F6F6' : '#0A0A0A');
  try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* Optional UI preference. */ }
  const app = getTelegram();
  if (!app) return;
  const bg = theme === 'light' ? '#F6F6F6' : '#0A0A0A';
  try {
    if (app.isVersionAtLeast('6.9')) { app.setHeaderColor?.(bg); app.setBackgroundColor?.(bg); }
    if (app.isVersionAtLeast('7.10')) app.setBottomBarColor?.(bg);
  } catch { /* Native chrome is a cosmetic enhancement. */ }
}
