import { useState, useMemo } from 'react';
import { Plus, Mail, Phone, Trash2, Edit2, ArrowLeft, Calendar, Briefcase, Wallet, CheckSquare } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import type { Employee } from '@/types';
import { formatCurrency, formatDate, relativeDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Input, Field, Select } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';

const statusConfig: Record<Employee['status'], { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  active: { label: 'Работает', tone: 'success' },
  vacation: { label: 'В отпуске', tone: 'warning' },
  inactive: { label: 'Неактивен', tone: 'neutral' },
};

const colorOptions = ['accent', 'success', 'warning', 'danger'];

const departments = ['Продажи', 'Финансы', 'Маркетинг', 'Администрирование', 'Дизайн', 'Разработка', 'HR'];

export function EmployeesPage() {
  const { state, addEmployee, updateEmployee, deleteEmployee } = useApp();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totalSalary = state.employees.reduce((s, e) => s + e.salary, 0);
  const currentEmp = selected ? state.employees.find(e => e.id === selected.id) || null : null;

  if (currentEmp) {
    return <EmployeeProfile employee={currentEmp} onBack={() => setSelected(null)} onEdit={() => { setEditEmp(currentEmp); setModalOpen(true); }} onDelete={(id) => setDeleteId(id)} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сотрудники"
        subtitle={`${state.employees.length} сотрудников · Фонд: ${formatCurrency(totalSalary)}/мес`}
        actions={<Button onClick={() => { setEditEmp(null); setModalOpen(true); }}><Plus className="w-4 h-4" /> Добавить</Button>}
      />

      {state.employees.length === 0 ? (
        <Card><EmptyState icon={<Briefcase className="w-6 h-6" />} title="Сотрудников нет" description="Добавьте первого сотрудника" action={<Button onClick={() => { setEditEmp(null); setModalOpen(true); }}><Plus className="w-4 h-4" /> Добавить</Button>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.employees.map(emp => (
            <Card key={emp.id} hover className="p-5 group" onClick={() => setSelected(emp)}>
              <div className="flex items-start gap-3 mb-4">
                <Avatar name={emp.name} color={emp.avatarColor} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{emp.name}</p>
                  <p className="text-xs text-white/50">{emp.position}</p>
                  <div className="mt-1.5"><Badge tone={statusConfig[emp.status].tone}>{statusConfig[emp.status].label}</Badge></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-bg-base rounded-lg p-2">
                  <Wallet className="w-3.5 h-3.5 text-white/30 mx-auto mb-1" />
                  <p className="text-2xs text-white/40">Зарплата</p>
                  <p className="text-xs font-medium text-white tabular-nums">{Math.round(emp.salary / 1000)}к</p>
                </div>
                <div className="bg-bg-base rounded-lg p-2">
                  <CheckSquare className="w-3.5 h-3.5 text-white/30 mx-auto mb-1" />
                  <p className="text-2xs text-white/40">Задачи</p>
                  <p className="text-xs font-medium text-white">{emp.tasksCount}</p>
                </div>
                <div className="bg-bg-base rounded-lg p-2">
                  <Calendar className="w-3.5 h-3.5 text-white/30 mx-auto mb-1" />
                  <p className="text-2xs text-white/40">Выплата</p>
                  <p className="text-xs font-medium text-white">{relativeDate(emp.nextPayment)}</p>
                </div>
              </div>
              <div className="flex gap-1 mt-4 pt-4 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditEmp(emp); setModalOpen(true); }}><Edit2 className="w-3.5 h-3.5" /> Изменить</Button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteId(emp.id); }} className="ml-auto p-2 rounded-lg text-white/40 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EmployeeModal open={modalOpen} onClose={() => setModalOpen(false)} editEmp={editEmp} onSave={(data) => {
        if (editEmp) { updateEmployee(editEmp.id, data); toast.success('Сотрудник обновлён'); }
        else { addEmployee(data); toast.success('Сотрудник добавлен'); }
        setModalOpen(false);
      }} />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deleteEmployee(deleteId); toast.success('Сотрудник удалён'); setSelected(null); } }} title="Удалить сотрудника?" message="Сотрудник будет удалён из системы." confirmLabel="Удалить" danger />
    </div>
  );
}

function EmployeeProfile({ employee, onBack, onEdit, onDelete }: { employee: Employee; onBack: () => void; onEdit: () => void; onDelete: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Назад к сотрудникам
      </button>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar name={employee.name} color={employee.avatarColor} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{employee.name}</h1>
            <p className="text-sm text-white/50">{employee.position} · {employee.department}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge tone={statusConfig[employee.status].tone}>{statusConfig[employee.status].label}</Badge>
              <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(employee.salary)}/мес</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onEdit}><Edit2 className="w-3.5 h-3.5" /> Изменить</Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(employee.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Контакты</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-bg-base flex items-center justify-center text-white/40"><Mail className="w-4 h-4" /></div><div><p className="text-2xs text-white/40">Email</p><p className="text-sm text-white">{employee.email}</p></div></div>
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-bg-base flex items-center justify-center text-white/40"><Phone className="w-4 h-4" /></div><div><p className="text-2xs text-white/40">Телефон</p><p className="text-sm text-white">{employee.phone}</p></div></div>
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-bg-base flex items-center justify-center text-white/40"><Calendar className="w-4 h-4" /></div><div><p className="text-2xs text-white/40">Дата приёма</p><p className="text-sm text-white">{formatDate(employee.joinDate)}</p></div></div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Финансы</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2"><span className="text-sm text-white/50">Зарплата</span><span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(employee.salary)}</span></div>
            <div className="flex justify-between items-center py-2"><span className="text-sm text-white/50">Следующая выплата</span><span className="text-sm text-white">{relativeDate(employee.nextPayment)}</span></div>
            <div className="flex justify-between items-center py-2"><span className="text-sm text-white/50">Отдел</span><span className="text-sm text-white">{employee.department}</span></div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Задачи</h3>
          <div className="text-center py-4">
            <p className="text-3xl font-bold text-white">{employee.tasksCount}</p>
            <p className="text-sm text-white/40 mt-1">активных задач</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmployeeModal({ open, onClose, editEmp, onSave }: { open: boolean; onClose: () => void; editEmp: Employee | null; onSave: (d: Omit<Employee, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('Продажи');
  const [salary, setSalary] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Employee['status']>('active');
  const [avatarColor, setAvatarColor] = useState('accent');

  useMemo(() => {
    if (open) {
      setName(editEmp?.name || '');
      setPosition(editEmp?.position || '');
      setDepartment(editEmp?.department || 'Продажи');
      setSalary(editEmp ? String(editEmp.salary) : '');
      setEmail(editEmp?.email || '');
      setPhone(editEmp?.phone || '');
      setStatus(editEmp?.status || 'active');
      setAvatarColor(editEmp?.avatarColor || 'accent');
    }
  }, [open, editEmp]);

  const handleSave = () => {
    if (!name || !position) return;
    onSave({
      name, position, department, salary: parseFloat(salary.replace(/\s/g, '').replace(',', '.')) || 0,
      email: email || '—', phone: phone || '—', status, avatarColor,
      tasksCount: editEmp?.tasksCount ?? 0,
      nextPayment: editEmp?.nextPayment || new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
      joinDate: editEmp?.joinDate || new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={editEmp ? 'Редактировать сотрудника' : 'Новый сотрудник'} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Имя" required><Input value={name} onChange={e => setName(e.target.value)} placeholder="Алексей Иванов" autoFocus /></Field>
          <Field label="Должность" required><Input value={position} onChange={e => setPosition(e.target.value)} placeholder="Менеджер" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Отдел"><Select value={department} onChange={e => setDepartment(e.target.value)} options={departments.map(d => ({ value: d, label: d }))} /></Field>
          <Field label="Статус"><Select value={status} onChange={e => setStatus(e.target.value as Employee['status'])} options={[{ value: 'active', label: 'Работает' }, { value: 'vacation', label: 'В отпуске' }, { value: 'inactive', label: 'Неактивен' }]} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Зарплата, ₸"><Input type="text" inputMode="decimal" value={salary} onChange={e => setSalary(e.target.value)} placeholder="300000" /></Field>
          <Field label="Цвет аватара">
            <div className="flex gap-2 h-10 items-center">
              {colorOptions.map(c => (
                <button key={c} onClick={() => setAvatarColor(c)} className={cn('w-8 h-8 rounded-full border-2 transition-all', avatarColor === c ? 'border-white scale-110' : 'border-transparent', c === 'accent' && 'bg-accent-500', c === 'success' && 'bg-success-500', c === 'warning' && 'bg-warning-500', c === 'danger' && 'bg-danger-500')} />
              ))}
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@bizbox.kz" /></Field>
          <Field label="Телефон"><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 701 ..." /></Field>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={handleSave} disabled={!name || !position}>{editEmp ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      </div>
    </Modal>
  );
}
