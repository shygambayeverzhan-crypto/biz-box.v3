import { useState, type ReactNode } from 'react';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Check } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/seed';
import type { TransactionType } from '@/types';
import { cn } from '@/lib/cn';

interface NewOperationModalProps {
  open: boolean;
  onClose: () => void;
}

const types: { value: TransactionType; label: string; icon: typeof ArrowDownCircle; color: string }[] = [
  { value: 'income', label: 'Доход', icon: ArrowDownCircle, color: 'text-success-400 border-success-500/40 bg-success-500/10' },
  { value: 'expense', label: 'Расход', icon: ArrowUpCircle, color: 'text-danger-400 border-danger-500/40 bg-danger-500/10' },
  { value: 'transfer', label: 'Перевод', icon: ArrowLeftRight, color: 'text-accent-400 border-accent-500/40 bg-accent-500/10' },
];

export function NewOperationModal({ open, onClose }: NewOperationModalProps) {
  const { addTransaction } = useApp();
  const toast = useToast();
  const [type, setType] = useState<TransactionType>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const cats = type === 'income' ? INCOME_CATEGORIES : type === 'expense' ? EXPENSE_CATEGORIES : ['Основной счёт', 'Резервный фонд'];

  const handleSubmit = () => {
    const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
    if (!amt || amt <= 0) {
      toast.error('Введите сумму', 'Сумма должна быть больше нуля.');
      return;
    }
    if (!category) {
      toast.error('Выберите категорию', 'Категория обязательна.');
      return;
    }
    addTransaction({
      type,
      amount: amt,
      category,
      description: description || category,
      date,
      status: 'completed',
      account: 'Основной счёт',
    });
    toast.success('Операция добавлена', `${type === 'income' ? 'Доход' : type === 'expense' ? 'Расход' : 'Перевод'} на сумму ${amt.toLocaleString('ru-RU')} ₸`);
    setAmount(''); setCategory(''); setDescription('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Новая операция" subtitle="Добавьте доход, расход или перевод" size="md">
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {types.map(t => {
            const Icon = t.icon;
            const active = type === t.value;
            return (
              <button
                key={t.value}
                onClick={() => { setType(t.value); setCategory(''); }}
                className={cn(
                  'flex flex-col items-center gap-2 py-3.5 rounded-xl border transition-all duration-200',
                  active ? t.color : 'border-border bg-bg-base text-white/40 hover:border-border-strong',
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>

        <Field label="Сумма" required>
          <div className="relative">
            <Input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="pl-9 text-lg font-semibold" autoFocus />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg font-semibold">₸</span>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Категория" required>
            <Select value={category} onChange={e => setCategory(e.target.value)} options={cats.map(c => ({ value: c, label: c }))} placeholder="Выберите" />
          </Field>
          <Field label="Дата">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>

        <Field label="Описание">
          <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Дополнительная информация об операции" />
        </Field>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={handleSubmit}>
            <Check className="w-4 h-4" /> Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface KpiCardProps {
  label: string;
  value: number;
  format: (n: number) => string;
  icon: ReactNode;
  trend?: { value: string; positive?: boolean };
  accent?: string;
  onClick?: () => void;
}

export function KpiCard({ label, value, format, icon, trend, accent = 'text-accent-400 bg-accent-500/10', onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-bg-card border border-border rounded-2xl p-4 sm:p-5 transition-all duration-300',
        onClick && 'hover:border-border-strong hover:shadow-card-hover cursor-pointer',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', accent)}>{icon}</div>
        {trend && (
          <span className={cn('text-2xs font-medium', trend.positive ? 'text-success-400' : 'text-danger-400')}>
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-2xs text-white/40 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{format(value)}</p>
    </div>
  );
}
