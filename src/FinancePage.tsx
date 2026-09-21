import { useState, useMemo } from 'react';
import {
  Plus, Search, TrendingUp, TrendingDown, ArrowLeftRight, Edit2, Trash2,
  Wallet, PiggyBank, CreditCard, Receipt, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import type { Transaction, TransactionType } from '@/types';
import { formatCurrency, formatDate, formatDateShort } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, AnimatedNumber, BarChart, DonutChart, ComparisonChart } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { SelectDropdown } from '@/components/ui/Misc';
import { EmptyState } from '@/components/ui/EmptyState';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/seed';
import { cn } from '@/lib/cn';

const statusConfig: Record<Transaction['status'], { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  completed: { label: 'Выполнен', tone: 'success' },
  pending: { label: 'Ожидает', tone: 'warning' },
  failed: { label: 'Ошибка', tone: 'danger' },
};

const DONUT_COLORS = ['#0066FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#64748B'];

export function FinancePage() {
  const { state, addTransaction, updateTransaction, deleteTransaction } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const income = useMemo(() => state.transactions.filter(t => t.type === 'income' && t.status === 'completed').reduce((s, t) => s + t.amount, 0), [state.transactions]);
  const expenses = useMemo(() => state.transactions.filter(t => t.type === 'expense' && t.status === 'completed').reduce((s, t) => s + t.amount, 0), [state.transactions]);
  const profit = income - expenses;

  const filtered = useMemo(() => {
    return state.transactions.filter(t => {
      if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.category.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter && t.type !== typeFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (tab === 'income' && t.type !== 'income') return false;
      if (tab === 'expense' && t.type !== 'expense') return false;
      return true;
    });
  }, [state.transactions, search, typeFilter, categoryFilter, tab]);

  const allCategories = useMemo(() => Array.from(new Set(state.transactions.map(t => t.category))), [state.transactions]);

  const monthlyData = useMemo(() => {
    const months = ['Май', 'Июн', 'Июл', 'Авг', 'Сен'];
    return months.map((label, i) => ({
      label,
      income: Math.round(1600000 + i * 140000 + Math.sin(i) * 100000),
      expense: Math.round(700000 + i * 60000 + Math.cos(i) * 40000),
    }));
  }, []);

  const expenseCategories = useMemo(() => {
    const map: Record<string, number> = {};
    state.transactions.filter(t => t.type === 'expense' && t.status === 'completed').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([label, value], i) => ({ label, value, color: DONUT_COLORS[i % DONUT_COLORS.length] }));
  }, [state.transactions]);

  const profitData = monthlyData.map(d => ({ label: d.label, value: d.income - d.expense }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Финансы"
        subtitle="Полный контроль над доходами и расходами"
        actions={<Button onClick={() => { setEditTx(null); setModalOpen(true); }}><Plus className="w-4 h-4" /> Операция</Button>}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-success-400 mb-2"><ArrowDownCircle className="w-4 h-4" /><span className="text-2xs text-white/40 uppercase">Доходы</span></div>
          <AnimatedNumber value={income} format={formatCurrency} className="text-xl font-bold text-white tabular-nums" />
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-danger-400 mb-2"><ArrowUpCircle className="w-4 h-4" /><span className="text-2xs text-white/40 uppercase">Расходы</span></div>
          <AnimatedNumber value={expenses} format={formatCurrency} className="text-xl font-bold text-white tabular-nums" />
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-accent-400 mb-2"><PiggyBank className="w-4 h-4" /><span className="text-2xs text-white/40 uppercase">Прибыль</span></div>
          <AnimatedNumber value={profit} format={formatCurrency} className="text-xl font-bold text-success-400 tabular-nums" />
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-accent-300 mb-2"><Wallet className="w-4 h-4" /><span className="text-2xs text-white/40 uppercase">Операций</span></div>
          <AnimatedNumber value={state.transactions.length} format={n => String(Math.round(n))} className="text-xl font-bold text-white tabular-nums" />
        </Card>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Обзор' },
          { value: 'income', label: 'Доходы' },
          { value: 'expense', label: 'Расходы' },
          { value: 'accounts', label: 'Счета' },
          { value: 'payments', label: 'Платежи' },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5 sm:p-6">
            <h3 className="text-base font-semibold text-white mb-1">Доходы vs Расходы</h3>
            <p className="text-xs text-white/40 mb-5">Сравнение за последние 5 месяцев</p>
            <ComparisonChart data={monthlyData} height={220} formatValue={formatCurrency} />
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-accent-500" /><span className="text-xs text-white/60">Доходы</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-danger-500" /><span className="text-xs text-white/60">Расходы</span></div>
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <h3 className="text-base font-semibold text-white mb-1">Прибыль по месяцам</h3>
            <p className="text-xs text-white/40 mb-5">Динамика чистой прибыли</p>
            <BarChart data={profitData} height={220} formatValue={formatCurrency} />
          </Card>
          <Card className="p-5 sm:p-6 lg:col-span-2">
            <h3 className="text-base font-semibold text-white mb-5">Структура расходов</h3>
            {expenseCategories.length > 0 ? (
              <DonutChart data={expenseCategories} centerValue={formatCurrency(expenses)} centerLabel="Всего расходов" />
            ) : (
              <EmptyState icon={<Receipt className="w-6 h-6" />} title="Нет данных о расходах" description="Добавьте операции с типом «Расход»" />
            )}
          </Card>
        </div>
      )}

      {tab === 'accounts' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'Основной счёт', balance: income - expenses, number: 'KZ44 •• 7782', icon: Wallet, color: 'accent' },
            { name: 'Резервный фонд', balance: 480000, number: 'KZ12 •• 3344', icon: PiggyBank, color: 'success' },
            { name: 'Кредитная карта', balance: -120000, number: '•• 9921', icon: CreditCard, color: 'danger' },
          ].map(a => {
            const Icon = a.icon;
            return (
              <Card key={a.name} hover className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', a.color === 'accent' && 'bg-accent-500/10 text-accent-400', a.color === 'success' && 'bg-success-500/10 text-success-400', a.color === 'danger' && 'bg-danger-500/10 text-danger-400')}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <Badge tone="neutral">{a.number}</Badge>
                </div>
                <p className="text-2xs text-white/40 uppercase">{a.name}</p>
                <p className={cn('text-xl font-bold tabular-nums mt-1', a.balance < 0 ? 'text-danger-400' : 'text-white')}>{formatCurrency(a.balance)}</p>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'payments' && (
        <Card className="p-5 sm:p-6">
          <h3 className="text-base font-semibold text-white mb-4">Предстоящие платежи</h3>
          <div className="space-y-3">
            {[
              { title: 'Аренда офиса', amount: 180000, date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10), status: 'pending' },
              { title: 'Зарплата сотрудникам', amount: 1150000, date: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10), status: 'pending' },
              { title: 'Налоги за квартал', amount: 64000, date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10), status: 'pending' },
              { title: 'Подписка Figma', amount: 9000, date: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10), status: 'pending' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-bg-base border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-warning-500/10 text-warning-400 flex items-center justify-center"><Receipt className="w-4 h-4" /></div>
                  <div>
                    <p className="text-sm font-medium text-white">{p.title}</p>
                    <p className="text-2xs text-white/40">{formatDate(p.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white tabular-nums">{formatCurrency(p.amount)}</p>
                  <Badge tone="warning">Ожидает</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(tab === 'income' || tab === 'expense' || tab === 'overview') && (
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по операциям..." className="pl-9" />
            </div>
            <SelectDropdown value={typeFilter} onChange={setTypeFilter} options={[{ value: 'income', label: 'Доход' }, { value: 'expense', label: 'Расход' }, { value: 'transfer', label: 'Перевод' }]} placeholder="Тип" />
            <SelectDropdown value={categoryFilter} onChange={setCategoryFilter} options={allCategories.map(c => ({ value: c, label: c }))} placeholder="Категория" />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-6 h-6" />}
              title="Операции не найдены"
              description="Измените фильтры или добавьте новую операцию"
              action={<Button onClick={() => { setEditTx(null); setModalOpen(true); }}><Plus className="w-4 h-4" /> Добавить</Button>}
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="text-2xs font-medium text-white/40 uppercase tracking-wide py-3 px-2">Дата</th>
                      <th className="text-2xs font-medium text-white/40 uppercase tracking-wide py-3 px-2">Описание</th>
                      <th className="text-2xs font-medium text-white/40 uppercase tracking-wide py-3 px-2">Категория</th>
                      <th className="text-2xs font-medium text-white/40 uppercase tracking-wide py-3 px-2">Тип</th>
                      <th className="text-2xs font-medium text-white/40 uppercase tracking-wide py-3 px-2 text-right">Сумма</th>
                      <th className="text-2xs font-medium text-white/40 uppercase tracking-wide py-3 px-2">Статус</th>
                      <th className="text-2xs font-medium text-white/40 uppercase tracking-wide py-3 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.id} className="border-b border-border/subtle hover:bg-bg-hover/50 transition-colors group">
                        <td className="py-3 px-2 text-sm text-white/50 whitespace-nowrap">{formatDateShort(t.date)}</td>
                        <td className="py-3 px-2 text-sm text-white font-medium max-w-[16rem] truncate">{t.description}</td>
                        <td className="py-3 px-2 text-sm text-white/60">{t.category}</td>
                        <td className="py-3 px-2">
                          <span className={cn('inline-flex items-center gap-1 text-xs', t.type === 'income' ? 'text-success-400' : t.type === 'expense' ? 'text-danger-400' : 'text-accent-400')}>
                            {t.type === 'income' ? <TrendingUp className="w-3 h-3" /> : t.type === 'expense' ? <TrendingDown className="w-3 h-3" /> : <ArrowLeftRight className="w-3 h-3" />}
                            {t.type === 'income' ? 'Доход' : t.type === 'expense' ? 'Расход' : 'Перевод'}
                          </span>
                        </td>
                        <td className={cn('py-3 px-2 text-sm font-semibold tabular-nums text-right whitespace-nowrap', t.type === 'income' ? 'text-success-400' : 'text-white')}>
                          {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}{formatCurrency(t.amount)}
                        </td>
                        <td className="py-3 px-2"><Badge tone={statusConfig[t.status].tone}>{statusConfig[t.status].label}</Badge></td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditTx(t); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-bg-raised text-white/40 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg hover:bg-danger-500/10 text-white/40 hover:text-danger-400"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {filtered.map(t => (
                  <div key={t.id} className="p-3.5 rounded-xl bg-bg-base border border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', t.type === 'income' ? 'bg-success-500/10 text-success-400' : t.type === 'expense' ? 'bg-danger-500/10 text-danger-400' : 'bg-accent-500/10 text-accent-400')}>
                          {t.type === 'income' ? <TrendingUp className="w-4 h-4" /> : t.type === 'expense' ? <TrendingDown className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{t.description}</p>
                          <p className="text-2xs text-white/40">{t.category} · {formatDateShort(t.date)}</p>
                        </div>
                      </div>
                      <span className={cn('text-sm font-semibold tabular-nums shrink-0', t.type === 'income' ? 'text-success-400' : 'text-white')}>
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}{formatCurrency(t.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <Badge tone={statusConfig[t.status].tone}>{statusConfig[t.status].label}</Badge>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditTx(t); setModalOpen(true); }} className="p-1.5 rounded-lg text-white/40"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg text-white/40"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editTx={editTx}
        onSave={(data) => {
          if (editTx) {
            updateTransaction(editTx.id, data);
            toast.success('Операция обновлена');
          } else {
            addTransaction({ ...data, status: 'completed', account: 'Основной счёт' });
            toast.success('Операция добавлена');
          }
          setModalOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) { deleteTransaction(deleteId); toast.success('Операция удалена'); } }}
        title="Удалить операцию?"
        message="Это действие нельзя отменить. Операция будет удалена навсегда."
        confirmLabel="Удалить"
        danger
      />
    </div>
  );
}

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  editTx: Transaction | null;
  onSave: (data: Omit<Transaction, 'id' | 'status' | 'account'> & Partial<Pick<Transaction, 'status' | 'account'>>) => void;
}

function TransactionModal({ open, onClose, editTx, onSave }: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>(editTx?.type || 'income');
  const [amount, setAmount] = useState(editTx ? String(editTx.amount) : '');
  const [category, setCategory] = useState(editTx?.category || '');
  const [description, setDescription] = useState(editTx?.description || '');
  const [date, setDate] = useState(editTx?.date || new Date().toISOString().slice(0, 10));

  // Reset when editTx changes
  useMemo(() => {
    if (open) {
      setType(editTx?.type || 'income');
      setAmount(editTx ? String(editTx.amount) : '');
      setCategory(editTx?.category || '');
      setDescription(editTx?.description || '');
      setDate(editTx?.date || new Date().toISOString().slice(0, 10));
    }
  }, [open, editTx]);

  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSave = () => {
    const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
    if (!amt || amt <= 0) return;
    onSave({ type, amount: amt, category: category || cats[0], description: description || category || cats[0], date });
  };

  return (
    <Modal open={open} onClose={onClose} title={editTx ? 'Редактировать операцию' : 'Новая операция'} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(['income', 'expense', 'transfer'] as TransactionType[]).map(t => (
            <button
              key={t}
              onClick={() => { setType(t); setCategory(''); }}
              className={cn(
                'py-3 rounded-xl border text-sm font-medium transition-all',
                type === t
                  ? t === 'income' ? 'bg-success-500/10 border-success-500/40 text-success-400' : t === 'expense' ? 'bg-danger-500/10 border-danger-500/40 text-danger-400' : 'bg-accent-500/10 border-accent-500/40 text-accent-400'
                  : 'border-border bg-bg-base text-white/40',
              )}
            >
              {t === 'income' ? 'Доход' : t === 'expense' ? 'Расход' : 'Перевод'}
            </button>
          ))}
        </div>
        <Field label="Сумма">
          <div className="relative">
            <Input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="pl-9 text-lg font-semibold" autoFocus />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg font-semibold">₸</span>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Категория">
            <Select value={category} onChange={e => setCategory(e.target.value)} options={cats.map(c => ({ value: c, label: c }))} placeholder="Выберите" />
          </Field>
          <Field label="Дата">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Описание">
          <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание операции" />
        </Field>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={handleSave} disabled={!parseFloat(amount.replace(/\s/g, '').replace(',', '.'))}>Сохранить</Button>
        </div>
      </div>
    </Modal>
  );
}
