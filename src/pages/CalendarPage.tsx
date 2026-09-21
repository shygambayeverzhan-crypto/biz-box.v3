import { useState, useMemo } from 'react';
import { CheckSquare, Receipt, FileText, UserCog, ChevronRight, ChevronLeft } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import type { CalendarEvent } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const eventConfig: Record<CalendarEvent['type'], { label: string; icon: typeof CheckSquare; bg: string; text: string; dot: string }> = {
  task: { label: 'Задача', icon: CheckSquare, bg: 'bg-accent-500/10', text: 'text-accent-300', dot: 'bg-accent-500' },
  payment: { label: 'Платёж', icon: Receipt, bg: 'bg-success-500/10', text: 'text-success-400', dot: 'bg-success-500' },
  document: { label: 'Документ', icon: FileText, bg: 'bg-warning-500/10', text: 'text-warning-400', dot: 'bg-warning-500' },
  employee: { label: 'Сотрудник', icon: UserCog, bg: 'bg-danger-500/10', text: 'text-danger-400', dot: 'bg-danger-500' },
};

export function CalendarPage() {
  const { state } = useApp();
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = (new Date(year, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const monthName = month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const today = new Date().toISOString().slice(0, 10);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    state.events.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [state.events]);

  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Календарь" subtitle="Задачи, платежи, документы и события сотрудников" />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white capitalize">{monthName}</h3>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setMonth(new Date(year, m - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
              <Button size="sm" variant="secondary" onClick={() => setMonth(new Date())}>Сегодня</Button>
              <Button size="sm" variant="ghost" onClick={() => setMonth(new Date(year, m + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => <div key={d} className="text-center text-2xs text-white/40 font-medium py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = new Date(year, m, day).toISOString().slice(0, 10);
              const dayEvents = eventsByDate[dateStr] || [];
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              return (
                <button key={day} onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    'min-h-[3.5rem] sm:min-h-[5rem] rounded-lg border p-1.5 text-left transition-all',
                    isToday ? 'border-accent-500/40' : 'border-border',
                    isSelected ? 'ring-2 ring-accent-500/30 bg-bg-hover' : 'bg-bg-base hover:bg-bg-hover/50',
                  )}>
                  <span className={cn('text-xs block', isToday ? 'text-accent-300 font-bold' : 'text-white/40')}>{day}</span>
                  <div className="space-y-0.5 mt-1">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className={cn('flex items-center gap-1 px-1 py-0.5 rounded text-2xs truncate', eventConfig[e.type].bg, eventConfig[e.type].text)}>
                        <span className={cn('w-1 h-1 rounded-full shrink-0', eventConfig[e.type].dot)} />
                        <span className="truncate hidden sm:inline">{e.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && <p className="text-2xs text-white/30 px-1">+{dayEvents.length - 2}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          {/* Legend */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Типы событий</h3>
            <div className="space-y-2">
              {Object.entries(eventConfig).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <div key={key} className="flex items-center gap-2.5">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', cfg.bg, cfg.text)}><Icon className="w-3.5 h-3.5" /></div>
                    <span className="text-sm text-white/60">{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Selected day events */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              {selectedDate ? new Date(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : 'Выберите день'}
            </h3>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-white/40 py-4 text-center">Нет событий</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map(e => {
                  const cfg = eventConfig[e.type];
                  const Icon = cfg.icon;
                  return (
                    <div key={e.id} className={cn('flex items-center gap-2.5 p-2.5 rounded-lg', cfg.bg)}>
                      <Icon className={cn('w-4 h-4 shrink-0', cfg.text)} />
                      <span className="text-sm text-white/80">{e.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
export default SubscriptionPage;
