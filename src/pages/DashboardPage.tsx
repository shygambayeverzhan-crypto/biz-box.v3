import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, Users, CheckSquare, Plus, ArrowRight,
  Calculator, Scale, Megaphone, UsersRound, Palette, Server, Star, Clock,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import type { Page, Task } from '@/types';
import { greeting, formatCurrency, relativeDate } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { AnimatedNumber, LineChart } from '@/components/ui';
import { NewOperationModal, KpiCard } from '@/components/NewOperationModal';
import { cn } from '@/lib/cn';

interface DashboardProps {
  onNavigate: (p: Page) => void;
}

const priorityConfig: Record<Task['priority'], { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  high: { label: 'Высокий', tone: 'danger' },
  medium: { label: 'Средний', tone: 'warning' },
  low: { label: 'Низкий', tone: 'neutral' },
};

const specialistsShort = [
  { icon: Calculator, label: 'Бухгалтер', desc: 'Учёт и налоги' },
  { icon: Scale, label: 'Юрист', desc: 'Договоры и право' },
  { icon: Megaphone, label: 'Маркетолог', desc: 'Реклама и SMM' },
  { icon: UsersRound, label: 'HR', desc: 'Подбор персонала' },
  { icon: Palette, label: 'Дизайнер', desc: 'Брендинг и UI' },
  { icon: Server, label: 'IT', desc: 'Автоматизация' },
];

export function DashboardPage({ onNavigate }: DashboardProps) {
  const { state, toggleTask } = useApp();
  const toast = useToast();
  const [opModalOpen, setOpModalOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = state.tasks.filter(t => t.dueDate === today && !t.completed);

  const income = useMemo(() => state.transactions.filter(t => t.type === 'income' && t.status === 'completed').reduce((s, t) => s + t.amount, 0), [state.transactions]);
  const expenses = useMemo(() => state.transactions.filter(t => t.type === 'expense' && t.status === 'completed').reduce((s, t) => s + t.amount, 0), [state.transactions]);
  const profit = income - expenses;

  const revenueData = useMemo(() => {
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен'];
    return months.map((label, i) => ({
      label,
      value: Math.round(1500000 + i * 120000 + Math.sin(i) * 180000 + (i === 8 ? income - 2000000 : 0)),
    }));
  }, [income]);

  const userName = state.user?.name || 'Ержан';

  const handleTaskToggle = (task: Task) => {
    toggleTask(task.id);
    if (!task.completed) toast.success('Задача выполнена', task.title);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{greeting()}, {userName}</h1>
          <p className="text-sm text-white/50 mt-1">Вот что происходит в вашем бизнесе сегодня.</p>
        </div>
        <Button onClick={() => setOpModalOpen(true)}>
          <Plus className="w-4 h-4" /> Новая операция
        </Button>
      </div>

      {/* Revenue card */}
      <Card className="p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-accent-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row gap-6">
          <div className="lg:w-1/3">
            <p className="text-sm text-white/50">Выручка за месяц</p>
            <div className="flex items-baseline gap-2 mt-1">
              <AnimatedNumber value={income} format={formatCurrency} className="text-3xl sm:text-4xl font-bold text-white tabular-nums" />
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <TrendingUp className="w-4 h-4 text-success-400" />
              <span className="text-sm font-medium text-success-400">+18,4%</span>
              <span className="text-xs text-white/40">к прошлому месяцу</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-bg-base rounded-xl p-3 border border-border">
                <p className="text-2xs text-white/40">Расходы</p>
                <p className="text-base font-semibold text-white mt-0.5 tabular-nums">{formatCurrency(expenses)}</p>
              </div>
              <div className="bg-bg-base rounded-xl p-3 border border-border">
                <p className="text-2xs text-white/40">Прибыль</p>
                <p className="text-base font-semibold text-success-400 mt-0.5 tabular-nums">{formatCurrency(profit)}</p>
              </div>
            </div>
          </div>
          <div className="lg:flex-1 min-w-0">
            <LineChart data={revenueData} height={220} formatValue={formatCurrency} />
          </div>
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard label="Расходы" value={expenses} format={formatCurrency} icon={<TrendingDown className="w-[18px] h-[18px]" />} accent="text-danger-400 bg-danger-500/10" trend={{ value: '-5,2%', positive: false }} onClick={() => onNavigate('finance')} />
        <KpiCard label="Прибыль" value={profit} format={formatCurrency} icon={<Wallet className="w-[18px] h-[18px]" />} accent="text-success-400 bg-success-500/10" trend={{ value: '+24,1%', positive: true }} onClick={() => onNavigate('finance')} />
        <KpiCard label="Клиенты" value={state.clients.length} format={n => String(Math.round(n))} icon={<Users className="w-[18px] h-[18px]" />} accent="text-accent-400 bg-accent-500/10" trend={{ value: '+12', positive: true }} onClick={() => onNavigate('clients')} />
        <KpiCard label="Задачи" value={state.tasks.filter(t => !t.completed).length} format={n => String(Math.round(n))} icon={<CheckSquare className="w-[18px] h-[18px]" />} accent="text-warning-400 bg-warning-500/10" onClick={() => onNavigate('tasks')} />
        <KpiCard label="Сотрудники" value={state.employees.length} format={n => String(Math.round(n))} icon={<Users className="w-[18px] h-[18px]" />} accent="text-accent-300 bg-accent-500/10" onClick={() => onNavigate('employees')} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today tasks */}
        <Card className="lg:col-span-2 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Сегодня</h2>
            <button onClick={() => onNavigate('tasks')} className="text-xs text-accent-400 hover:text-accent-300 flex items-center gap-1">
              Все задачи <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {todayTasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-white/40">На сегодня задач нет. Отличная работа!</div>
            ) : (
              todayTasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-base border border-border hover:border-border-strong transition-colors group">
                  <button
                    onClick={() => handleTaskToggle(task)}
                    className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                      task.completed ? 'bg-accent-500 border-accent-500 animate-check-pop' : 'border-border-strong hover:border-accent-500',
                    )}
                  >
                    {task.completed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', task.completed ? 'text-white/40 line-through' : 'text-white')}>{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge tone={priorityConfig[task.priority].tone}>{priorityConfig[task.priority].label}</Badge>
                      {task.dueTime && <span className="text-2xs text-white/40 flex items-center gap-1"><Clock className="w-3 h-3" />{task.dueTime}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Specialists */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Нужна помощь?</h2>
            <button onClick={() => onNavigate('specialists')} className="text-xs text-accent-400 hover:text-accent-300">Все</button>
          </div>
          <p className="text-xs text-white/40 mb-4">Найдите специалиста для вашего бизнеса</p>
          <div className="grid grid-cols-2 gap-2.5">
            {specialistsShort.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.label}
                  onClick={() => onNavigate('specialists')}
                  className="flex flex-col items-start gap-2 p-3 rounded-xl bg-bg-base border border-border hover:border-accent-500/40 hover:bg-accent-500/5 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{s.label}</p>
                    <p className="text-2xs text-white/40">{s.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Последние операции</h2>
          <button onClick={() => onNavigate('finance')} className="text-xs text-accent-400 hover:text-accent-300 flex items-center gap-1">
            Все <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-1">
          {state.transactions.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-bg-hover transition-colors">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', t.type === 'income' ? 'bg-success-500/10 text-success-400' : t.type === 'expense' ? 'bg-danger-500/10 text-danger-400' : 'bg-accent-500/10 text-accent-400')}>
                {t.type === 'income' ? <TrendingUp className="w-4 h-4" /> : t.type === 'expense' ? <TrendingDown className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{t.description}</p>
                <p className="text-2xs text-white/40">{t.category} · {relativeDate(t.date)}</p>
              </div>
              <span className={cn('text-sm font-semibold tabular-nums shrink-0', t.type === 'income' ? 'text-success-400' : t.type === 'expense' ? 'text-white' : 'text-accent-400')}>
                {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}{formatCurrency(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <NewOperationModal open={opModalOpen} onClose={() => setOpModalOpen(false)} />
    </div>
  );
}
export default SubscriptionPage;
