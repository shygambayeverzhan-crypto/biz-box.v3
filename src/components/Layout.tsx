import { useLayoutEffect, useState, type ReactNode } from 'react';
import { Bell, LogOut, User, Settings, CreditCard, ChevronDown, Menu, X, Wallet, FileText, Users, CheckSquare, UserCog, Calendar, Briefcase, Sparkles, Gift } from 'lucide-react';
import type { Page, AppNotification } from '@/types';
import { useApp } from '@/store/AppContext';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem } from '@/components/ui/Misc';
import { Sidebar, BottomNav } from '@/components/Navigation';
import { SyncBanner } from '@/components/WorkspaceStatus';
import { relativeDate } from '@/lib/format';
import { getVisibleNotifications } from '@/lib/notificationPreferences';
import { cn } from '@/lib/cn';

interface TopbarProps {
  onNavigate: (p: Page) => void;
  businessName?: string;
  userName?: string;
}

const notifIcons: Record<AppNotification['type'], typeof Bell> = {
  payment: Wallet,
  task: CheckSquare,
  client: Users,
  document: FileText,
  system: Bell,
};

const notifColors: Record<AppNotification['type'], string> = {
  payment: 'text-success-400 bg-success-500/10',
  task: 'text-accent-400 bg-accent-500/10',
  client: 'text-warning-400 bg-warning-500/10',
  document: 'text-accent-300 bg-accent-500/10',
  system: 'text-white/50 bg-white/5',
};

export function Topbar({ onNavigate, businessName, userName }: TopbarProps) {
  const { state, logout, markNotificationRead } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notifications = getVisibleNotifications(state.notifications, state.user?.notificationPreferences);
  const unread = notifications.filter(n => !n.read).length;

  const moreItems: { page: Page; label: string; icon: typeof Wallet }[] = [
    { page: 'assistant', label: 'ИИ-помощник', icon: Sparkles },
    { page: 'referrals', label: 'Приглашения и бонусы', icon: Gift },
    { page: 'documents', label: 'Документы', icon: FileText },
    { page: 'employees', label: 'Сотрудники', icon: UserCog },
    { page: 'calendar', label: 'Календарь', icon: Calendar },
    { page: 'specialists', label: 'Специалисты', icon: Briefcase },
    { page: 'subscription', label: 'Тарифы', icon: CreditCard },
    { page: 'settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <>
      <header className="app-topbar sticky z-30 glass mx-3 mt-3 sm:mx-6 rounded-[24px]">
        <div className="flex items-center justify-between gap-3 px-3 sm:px-4 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" aria-label="Открыть меню" aria-expanded={mobileMenuOpen} className="liquid-control lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-white/55">BIZBOX</p>
              <p className="text-sm font-medium text-white truncate max-w-[36vw] sm:max-w-sm">{businessName || 'Мой бизнес'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Dropdown
              trigger={
                <button type="button" aria-label={unread > 0 ? `Уведомления: ${unread} непрочитанных` : 'Уведомления'} className="relative w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors">
                  <Bell className="w-[18px] h-[18px]" />
                  {unread > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-danger-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
              }
              className="w-80 max-w-[calc(100vw-7rem)] sm:max-w-[calc(100vw-2rem)]"
            >
              {() => (
                <div>
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
                    <span className="text-sm font-semibold text-white">Уведомления</span>
                    {unread > 0 && (
                      <button onClick={() => notifications.filter(n => !n.read).forEach(n => markNotificationRead(n.id))} className="text-2xs text-accent-400 hover:text-accent-300">
                        Прочитать все
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-sm text-white/40">Нет уведомлений</div>
                    ) : (
                      notifications.slice(0, 8).map(n => {
                        const Icon = notifIcons[n.type];
                        return (
                          <button
                            key={n.id}
                            onClick={() => markNotificationRead(n.id)}
                            className={cn('w-full flex gap-3 px-3.5 py-3 hover:bg-bg-hover transition-colors text-left', !n.read && 'bg-accent-500/5')}
                          >
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', notifColors[n.type])}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{n.title}</p>
                              <p className="text-2xs text-white/50 mt-0.5 line-clamp-2">{n.body}</p>
                              <p className="text-2xs text-white/30 mt-1">{relativeDate(n.date)}</p>
                            </div>
                            {!n.read && <div className="w-2 h-2 rounded-full bg-accent-500 shrink-0 mt-1.5" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </Dropdown>

            <Dropdown
              trigger={
                <button type="button" aria-label="Меню профиля" className="flex items-center gap-2 h-11 p-0.5 sm:pr-3 rounded-full hover:bg-white/10 transition-colors">
                  <Avatar name={userName || 'Пользователь'} color="accent" size="sm" />
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-white leading-tight max-w-[8rem] truncate">{userName}</p>
                    <p className="text-2xs text-white/40 leading-tight">{state.user?.plan === 'free' ? 'Free' : state.user?.plan === 'business' ? 'Business' : 'Pro'}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-white/40 hidden sm:block" />
                </button>
              }
            >
              {(close) => (
                <div className="w-56">
                  <div className="px-3.5 py-3 border-b border-border">
                    <p className="text-sm font-medium text-white truncate">{userName}</p>
                    <p className="text-2xs text-white/40 truncate">{state.user?.email}</p>
                  </div>
                  <DropdownItem onClick={() => { onNavigate('settings'); close(); }} icon={<User className="w-4 h-4" />}>Профиль</DropdownItem>
                  <DropdownItem onClick={() => { onNavigate('subscription'); close(); }} icon={<CreditCard className="w-4 h-4" />}>Подписка</DropdownItem>
                  <DropdownItem onClick={() => { onNavigate('settings'); close(); }} icon={<Settings className="w-4 h-4" />}>Настройки</DropdownItem>
                  <div className="h-px bg-border my-1.5" />
                  <DropdownItem onClick={() => { logout(); close(); }} icon={<LogOut className="w-4 h-4" />} danger>Выйти</DropdownItem>
                </div>
              )}
            </Dropdown>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileMenuOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label="Меню разделов" className="absolute left-3 top-3 bottom-3 w-[min(19rem,calc(100vw-1.5rem))] liquid-panel rounded-[28px] p-5 animate-fade-in flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center font-bold text-white text-sm">B</div>
                <span className="font-bold text-white">BIZBOX</span>
              </div>
              <button type="button" aria-label="Закрыть меню" onClick={() => setMobileMenuOpen(false)} className="liquid-control rounded-full w-10 h-10 flex items-center justify-center text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav aria-label="Все разделы" className="flex-1 space-y-1 overflow-y-auto">
              {moreItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.page}
                    onClick={() => { onNavigate(item.page); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-bg-hover transition-colors"
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            {businessName && (
              <div className="pt-4 border-t border-border">
                <Badge tone="accent">{businessName}</Badge>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

interface AppLayoutProps {
  current: Page;
  onNavigate: (p: Page) => void;
  children: ReactNode;
}

export function AppLayout({ current, onNavigate, children }: AppLayoutProps) {
  const { state } = useApp();
  useLayoutEffect(() => {
    // Navigation must not retain the previous page's scroll under the sticky bar.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [current]);
  return (
    <div className="app-canvas flex">
      <Sidebar current={current} onNavigate={onNavigate} businessName={state.business?.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onNavigate={onNavigate} businessName={state.business?.name} userName={state.user?.name} />
        <main className="app-content flex-1 px-4 pt-6 sm:px-6 sm:pt-7 max-w-7xl w-full mx-auto">
          <SyncBanner />
          <div key={current} className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
      <BottomNav current={current} onNavigate={onNavigate} />
    </div>
  );
}
