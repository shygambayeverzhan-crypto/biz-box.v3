import { useState, useMemo } from 'react';
import {
  Plus, List, Columns3, Calendar as CalIcon, Trash2, Edit2, Clock, Flag,
  Check, GripVertical, X,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import type { Task, TaskStatus, TaskPriority } from '@/types';
import { formatDate, relativeDate, formatDateShort } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Input, Field, Select, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';

const priorityConfig: Record<TaskPriority, { label: string; tone: 'danger' | 'warning' | 'neutral'; color: string }> = {
  high: { label: 'Высокий', tone: 'danger', color: 'bg-danger-500' },
  medium: { label: 'Средний', tone: 'warning', color: 'bg-warning-500' },
  low: { label: 'Низкий', tone: 'neutral', color: 'bg-white/30' },
};

const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  new: { label: 'Новые', color: 'text-white/60' },
  in_progress: { label: 'В работе', color: 'text-accent-400' },
  review: { label: 'На проверке', color: 'text-warning-400' },
  done: { label: 'Выполнено', color: 'text-success-400' },
};

const kanbanColumns: TaskStatus[] = ['new', 'in_progress', 'review', 'done'];

const views = [
  { value: 'list', label: 'Список', icon: List },
  { value: 'kanban', label: 'Канбан', icon: Columns3 },
  { value: 'calendar', label: 'Календарь', icon: CalIcon },
];

export function TasksPage() {
  const { state, addTask, updateTask, deleteTask, toggleTask } = useApp();
  const toast = useToast();
  const [view, setView] = useState('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dragTask, setDragTask] = useState<string | null>(null);

  const handleDrop = (status: TaskStatus) => {
    if (dragTask) {
      updateTask(dragTask, { status, completed: status === 'done' });
      toast.success('Задача перемещена', statusConfig[status].label);
      setDragTask(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Задачи"
        subtitle={`${state.tasks.filter(t => !t.completed).length} активных · ${state.tasks.filter(t => t.completed).length} выполнено`}
        actions={<Button onClick={() => { setEditTask(null); setModalOpen(true); }}><Plus className="w-4 h-4" /> Задача</Button>}
      />

      {/* View switcher */}
      <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1 w-fit">
        {views.map(v => {
          const Icon = v.icon;
          return (
            <button key={v.value} onClick={() => setView(v.value)}
              className={cn('flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all',
                view === v.value ? 'bg-accent-500/15 text-accent-300' : 'text-white/50 hover:text-white')}>
              <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{v.label}</span>
            </button>
          );
        })}
      </div>

      {view === 'list' && <TaskListView tasks={state.tasks} onToggle={toggleTask} onEdit={(t) => { setEditTask(t); setModalOpen(true); }} onDelete={(id) => setDeleteId(id)} />}

      {view === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kanbanColumns.map(col => {
            const colTasks = state.tasks.filter(t => t.status === col);
            return (
              <div key={col} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(col)}
                className="bg-bg-card/50 border border-border rounded-2xl p-3 min-h-[200px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', statusConfig[col].color.replace('text', 'bg'))} />
                    <span className={cn('text-sm font-semibold', statusConfig[col].color)}>{statusConfig[col].label}</span>
                  </div>
                  <span className="text-2xs text-white/30">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map(task => (
                    <div key={task.id} draggable onDragStart={() => setDragTask(task.id)}
                      className="group bg-bg-base border border-border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-border-strong transition-all">
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-4 h-4 text-white/20 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium text-white line-clamp-2', task.completed && 'line-through text-white/40')}>{task.title}</p>
                          {task.description && <p className="text-2xs text-white/40 mt-1 line-clamp-2">{task.description}</p>}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={cn('w-2 h-2 rounded-full', priorityConfig[task.priority].color)} />
                            <span className="text-2xs text-white/40">{priorityConfig[task.priority].label}</span>
                            {task.dueDate && <span className="text-2xs text-white/40 flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatDateShort(task.dueDate)}</span>}
                          </div>
                          {task.assignee && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <Avatar name={task.assignee} color="accent" size="xs" />
                              <span className="text-2xs text-white/50">{task.assignee}</span>
                            </div>
                          )}
                          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditTask(task); setModalOpen(true); }} className="p-1 rounded text-white/40 hover:text-white"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => setDeleteId(task.id)} className="p-1 rounded text-white/40 hover:text-danger-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && <p className="text-2xs text-white/20 text-center py-4">Перетащите сюда</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'calendar' && <TaskCalendarView tasks={state.tasks} onEdit={(t) => { setEditTask(t); setModalOpen(true); }} />}

      <TaskModal open={modalOpen} onClose={() => setModalOpen(false)} editTask={editTask} employees={state.employees.map(e => e.name)} onSave={(data) => {
        if (editTask) { updateTask(editTask.id, data); toast.success('Задача обновлена'); }
        else { addTask(data); toast.success('Задача создана'); }
        setModalOpen(false);
      }} />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deleteTask(deleteId); toast.success('Задача удалена'); } }} title="Удалить задачу?" message="Задача будет удалена без возможности восстановления." confirmLabel="Удалить" danger />
    </div>
  );
}

function TaskListView({ tasks, onToggle, onEdit, onDelete }: { tasks: Task[]; onToggle: (id: string) => void; onEdit: (t: Task) => void; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState('');
  const filtered = filter ? tasks.filter(t => t.status === filter) : tasks;

  return (
    <Card className="p-5">
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        <button onClick={() => setFilter('')} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap', !filter ? 'bg-accent-500/10 text-accent-300' : 'text-white/50')}>Все</button>
        {kanbanColumns.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap', filter === s ? 'bg-accent-500/10 text-accent-300' : 'text-white/50')}>{statusConfig[s].label}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={<Check className="w-6 h-6" />} title="Задач нет" description="Создайте первую задачу" />
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-base border border-border hover:border-border-strong transition-colors group">
              <button onClick={() => onToggle(task.id)} className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all', task.completed ? 'bg-accent-500 border-accent-500 animate-check-pop' : 'border-border-strong hover:border-accent-500')}>
                {task.completed && <Check className="w-3 h-3 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium truncate', task.completed ? 'text-white/40 line-through' : 'text-white')}>{task.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn('w-1.5 h-1.5 rounded-full', priorityConfig[task.priority].color)} />
                  <span className="text-2xs text-white/40">{priorityConfig[task.priority].label}</span>
                  {task.dueDate && <span className="text-2xs text-white/40 flex items-center gap-0.5"><Clock className="w-3 h-3" />{relativeDate(task.dueDate)}</span>}
                  {task.assignee && <span className="text-2xs text-white/40">· {task.assignee}</span>}
                </div>
              </div>
              <Badge tone={task.status === 'done' ? 'success' : task.status === 'review' ? 'warning' : 'neutral'}>{statusConfig[task.status].label}</Badge>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg text-white/40 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => onDelete(task.id)} className="p-1.5 rounded-lg text-white/40 hover:text-danger-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TaskCalendarView({ tasks, onEdit }: { tasks: Task[]; onEdit: (t: Task) => void }) {
  const [month, setMonth] = useState(new Date());
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1).getDay() || 7;
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const monthName = month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(t => {
      const d = t.dueDate;
      if (!map[d]) map[d] = [];
      map[d].push(t);
    });
    return map;
  }, [tasks]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white capitalize">{monthName}</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setMonth(new Date(year, m - 1, 1))}>←</Button>
          <Button size="sm" variant="ghost" onClick={() => setMonth(new Date())}>Сегодня</Button>
          <Button size="sm" variant="ghost" onClick={() => setMonth(new Date(year, m + 1, 1))}>→</Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => <div key={d} className="text-center text-2xs text-white/40 font-medium py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstDay - 1 }).map((_, i) => <div key={'e' + i} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = new Date(year, m, day).toISOString().slice(0, 10);
          const dayTasks = tasksByDate[dateStr] || [];
          const isToday = dateStr === today;
          return (
            <div key={day} className={cn('min-h-[4rem] sm:min-h-[6rem] rounded-lg border p-1.5 transition-colors', isToday ? 'border-accent-500/40 bg-accent-500/5' : 'border-border bg-bg-base')}>
              <span className={cn('text-xs', isToday ? 'text-accent-300 font-bold' : 'text-white/40')}>{day}</span>
              <div className="space-y-0.5 mt-1">
                {dayTasks.slice(0, 3).map(t => (
                  <button key={t.id} onClick={() => onEdit(t)} className={cn('w-full text-left text-2xs px-1.5 py-1 rounded truncate block transition-colors',
                    t.completed ? 'bg-success-500/10 text-success-400/70' : t.priority === 'high' ? 'bg-danger-500/15 text-danger-400/90' : 'bg-accent-500/10 text-accent-300')}>
                    {t.title}
                  </button>
                ))}
                {dayTasks.length > 3 && <p className="text-2xs text-white/30 px-1.5">+{dayTasks.length - 3} ещё</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TaskModal({ open, onClose, editTask, employees, onSave }: { open: boolean; onClose: () => void; editTask: Task | null; employees: string[]; onSave: (d: Omit<Task, 'id'>) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('new');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueTime, setDueTime] = useState('');
  const [assignee, setAssignee] = useState('');

  useMemo(() => {
    if (open) {
      setTitle(editTask?.title || '');
      setDescription(editTask?.description || '');
      setStatus(editTask?.status || 'new');
      setPriority(editTask?.priority || 'medium');
      setDueDate(editTask?.dueDate || new Date().toISOString().slice(0, 10));
      setDueTime(editTask?.dueTime || '');
      setAssignee(editTask?.assignee || '');
    }
  }, [open, editTask]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), description, status, priority, dueDate, dueTime: dueTime || undefined, assignee: assignee || undefined, completed: status === 'done' });
  };

  return (
    <Modal open={open} onClose={onClose} title={editTask ? 'Редактировать задачу' : 'Новая задача'} size="md">
      <div className="space-y-4">
        <Field label="Название" required><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Оплатить аренду" autoFocus /></Field>
        <Field label="Описание"><Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Дополнительные детали..." /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Статус"><Select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} options={kanbanColumns.map(s => ({ value: s, label: statusConfig[s].label }))} /></Field>
          <Field label="Приоритет"><Select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} options={[{ value: 'high', label: 'Высокий' }, { value: 'medium', label: 'Средний' }, { value: 'low', label: 'Низкий' }]} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Дата"><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></Field>
          <Field label="Время"><Input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} /></Field>
        </div>
        <Field label="Ответственный"><Select value={assignee} onChange={e => setAssignee(e.target.value)} options={employees.map(e => ({ value: e, label: e }))} placeholder="Не назначен" /></Field>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={handleSave} disabled={!title.trim()}>{editTask ? 'Сохранить' : 'Создать'}</Button>
        </div>
      </div>
    </Modal>
  );
}
