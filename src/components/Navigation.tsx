import { LayoutDashboard, Wallet, FileText, Users, CheckSquare, UserCog, Calendar, Briefcase, Settings, CreditCard } from 'lucide-react';
import type { Page } from '@/types';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/cn';

interface SidebarProps {
  current: Page;
  onNavigate: (p: Page) => void;
  businessName?: string;
}

const navItems: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Главная', icon: LayoutDashboard },
  { page: 'finance', label: 'Финансы', icon: Wallet },
  { page: 'documents', label: 'Документы', icon: FileText },
  { page: 'clients', label: 'Клиенты', icon: Users },
  { page: 'tasks', label: 'Задачи', icon: CheckSquare },
  { page: 'employees', label: 'Сотрудники', icon: UserCog },
  { page: 'calendar', label: 'Календарь', icon: Calendar },
  { page: 'specialists', label: 'Специалисты', icon: Briefcase },
  { page: 'subscription', label: 'Тарифы', icon: CreditCard },
];

export function Sidebar({ current, onNavigate, businessName }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 liquid-panel rounded-[28px] h-[calc(100dvh-2rem)] sticky top-4 m-4 mr-0">
      <div className="px-6 py-6 border-b border-white/10">
        <Logo />
      </div>
      <nav aria-label="Основная навигация" className="flex-1 overflow-y-auto no-scrollbar py-5 px-3 space-y-1">
        {navItems.map(item => {
          const active = current === item.page;
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(item.page)}
              className={cn(
                'w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-colors duration-200 relative group',
                active ? 'liquid-control text-white' : 'text-white/65 hover:text-white hover:bg-white/5',
              )}
            >
              <Icon className={cn('w-[18px] h-[18px] shrink-0', active && 'text-accent-400')} />
              {item.label}
            </button>
          );
        })}
        <div className="h-px bg-white/10 my-3" />
        <button
          onClick={() => onNavigate('settings')}
          aria-current={current === 'settings' ? 'page' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-colors duration-200',
            current === 'settings' ? 'liquid-control text-white' : 'text-white/65 hover:text-white hover:bg-white/5',
          )}
        >
          <Settings className="w-[18px] h-[18px] shrink-0" />
          Настройки
        </button>
      </nav>
      {businessName && (
        <div className="p-5 border-t border-white/10">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-500/30 to-accent-700/20 border border-accent-500/30 flex items-center justify-center text-xs font-bold text-accent-300">
              {businessName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{businessName}</p>
              <p className="text-2xs text-white/40">Бизнес</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

interface BottomNavProps {
  current: Page;
  onNavigate: (p: Page) => void;
}

const bottomItems: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Главная', icon: LayoutDashboard },
  { page: 'finance', label: 'Финансы', icon: Wallet },
  { page: 'tasks', label: 'Задачи', icon: CheckSquare },
  { page: 'clients', label: 'Клиенты', icon: Users },
];

export function BottomNav({ current, onNavigate }: BottomNavProps) {
  const moreActive = !bottomItems.some(item => item.page === current);
  return (
    <nav aria-label="Основная навигация" className="liquid-dock lg:hidden z-40 glass-strong">
      <div className="grid grid-cols-5 gap-1 p-1.5">
        {bottomItems.map(item => {
          const active = current === item.page;
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(item.page)}
              className={cn(
                'dock-item flex flex-col items-center justify-center gap-1 px-1 py-2 transition-colors',
                active ? 'dock-item-active' : 'hover:text-white hover:bg-white/5',
              )}
            >
              <Icon aria-hidden="true" className="w-5 h-5" strokeWidth={active ? 2 : 1.7} />
              <span className="text-[10px] font-medium tracking-[-0.01em]">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-current={moreActive ? 'page' : undefined}
          onClick={() => onNavigate('settings')}
          className={cn('dock-item flex flex-col items-center justify-center gap-1 px-1 py-2 transition-colors', moreActive ? 'dock-item-active' : 'hover:text-white hover:bg-white/5')}
        >
          <div aria-hidden="true" className="grid grid-cols-2 gap-[3px] w-[18px] h-[18px]">
            <div className="rounded-sm bg-current" />
            <div className="rounded-sm bg-current" />
            <div className="rounded-sm bg-current" />
            <div className="rounded-sm bg-current" />
          </div>
          <span className="text-[10px] font-medium">Ещё</span>
        </button>
      </div>
    </nav>
  );
}
