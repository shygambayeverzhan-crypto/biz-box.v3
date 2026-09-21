import { useState, type ReactNode } from 'react';
import { Bell, LogOut, User, Settings, CreditCard, ChevronDown, Menu, X, Wallet, FileText, Users, CheckSquare, UserCog, Calendar, Briefcase } from 'lucide-react';
import type { Page, AppNotification } from '@/types';
import { useApp } from '@/store/AppContext';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem } from '@/components/ui/Misc';
import { Sidebar, BottomNav } from '@/components/Navigation';
import { relativeDate } from '@/lib/format';
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
  const { state, logout, markNotificationRead, markAllNotificationsRead } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unread = state.notifications.filter(n => !n.read).length;

  const moreItems: { page: Page; label: string; icon: typeof Wallet }[] = [
    { page: 'documents', label: 'Документы', icon: FileText },
    { page: 'employees', label: 'Сотрудники', icon: UserCog },
    { page: 'calendar', label: 'Календарь', icon: Calendar },
    { page: 'specialists', label: 'Специалисты', icon: Briefcase },
    { page: 'subscription', label: 'Тарифы', icon: CreditCard },
    { page: 'settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 glass border-b border-border">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden text-white/60 hover:text-white" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            {businessName && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm text-white/40">Бизнес:</span>
                <span className="text-sm font-medium text-white truncate">{businessName}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Dropdown
              trigger={
                <button className="relative w-10 h-10 rounded-xl hover:bg-bg-hover flex items-center justify-center text-white/60 hover:text-white transition-colors">
                  <Bell className="w-[18px] h-[18px]" />
                  {unread > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-danger-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </button>
              }
              className="w-80 max-w-[calc(100vw-2rem)]"
            >
              {(close) => (
                <div>
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
                    <span className="text-sm font-semibold text-white">Уведомления</span>
                    {unread > 0 && (
                      <button onClick={() => markAllNotificationsRead()} className="text-2xs text-accent-400 hover:text-accent-300">
                        Прочитать все
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {state.notifications.length === 0 ? (
                      <div className="py-8 text-center text-sm text-white/40">Нет уведомлений</div>
                    ) : (
                      state.notifications.slice(0, 8).map(n => {
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
                <button className="flex items-center gap-2 h-10 pl-1 pr-2 sm:pr-3 rounded-xl hover:bg-bg-hover transition-colors">
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
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-bg-surface border-r border-border p-4 animate-slide-in-right flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center font-bold text-white text-sm">B</div>
                <span className="font-bold text-white">BIZBOX</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-white/50 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1">
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
  return (
    <div className="min-h-screen flex">
      <Sidebar current={current} onNavigate={onNavigate} businessName={state.business?.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onNavigate={onNavigate} businessName={state.business?.name} userName={state.user?.name} />
        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-6 max-w-7xl w-full mx-auto">
          <div key={current} className="animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
      <BottomNav current={current} onNavigate={onNavigate} />
    </div>
  );
}
