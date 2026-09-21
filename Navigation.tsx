import { LayoutDashboard, Wallet, FileText, Users, CheckSquare, UserCog, Calendar, Briefcase, Settings } from 'lucide-react';
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
];

export function Sidebar({ current, onNavigate, businessName }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border bg-bg-surface h-screen sticky top-0">
      <div className="p-5 border-b border-border">
        <Logo />
      </div>
      <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 space-y-1">
        {navItems.map(item => {
          const active = current === item.page;
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={cn(
                'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group',
                active ? 'bg-accent-500/10 text-white' : 'text-white/55 hover:text-white hover:bg-bg-hover',
              )}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-accent-500" />}
              <Icon className={cn('w-[18px] h-[18px] shrink-0', active && 'text-accent-400')} />
              {item.label}
            </button>
          );
        })}
        <div className="h-px bg-border my-3" />
        <button
          onClick={() => onNavigate('settings')}
          className={cn(
            'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
            current === 'settings' ? 'bg-accent-500/10 text-white' : 'text-white/55 hover:text-white hover:bg-bg-hover',
          )}
        >
          <Settings className="w-[18px] h-[18px] shrink-0" />
          Настройки
        </button>
      </nav>
      {businessName && (
        <div className="p-4 border-t border-border">
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
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-border">
      <div className="flex items-center justify-around px-2 py-1.5 safe-area-inset-bottom">
        {bottomItems.map(item => {
          const active = current === item.page;
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[3.5rem]',
                active ? 'text-accent-400' : 'text-white/50',
              )}
            >
              <Icon className="w-[20px] h-[20px]" />
              <span className="text-2xs font-medium">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => onNavigate('settings')}
          className={cn('flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[3.5rem]', current === 'settings' ? 'text-accent-400' : 'text-white/50')}
        >
          <div className="grid grid-cols-2 gap-0.5 w-[20px] h-[20px]">
            <div className="rounded-sm bg-current" />
            <div className="rounded-sm bg-current" />
            <div className="rounded-sm bg-current" />
            <div className="rounded-sm bg-current" />
          </div>
          <span className="text-2xs font-medium">Ещё</span>
        </button>
      </div>
    </nav>
  );
}
