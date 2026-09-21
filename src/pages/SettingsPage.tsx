import { useState } from 'react';
import { User, Briefcase, Bell, Shield, CreditCard, Save, LogOut, Check, ShieldCheck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import type { Page, PaymentRequest, PaymentStatus } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Input, Field, Select } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';

const planNames: Record<string, string> = { free: 'FREE', business: 'BUSINESS', pro: 'PRO' };

const sections = [
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'business', label: 'Бизнес', icon: Briefcase },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'security', label: 'Безопасность', icon: Shield },
  { id: 'subscription', label: 'Подписка', icon: CreditCard },
  { id: 'admin', label: 'Администрирование', icon: ShieldCheck },
];

export function SettingsPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { state, updateUser, updateBusiness, logout, confirmPayment, rejectPayment } = useApp();
  const toast = useToast();
  const [section, setSection] = useState('profile');

  return (
    <div className="space-y-6">
      <PageHeader title="Настройки" subtitle="Управление аккаунтом и бизнесом" />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Section nav */}
        <div className="lg:w-56 shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
            {sections.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => setSection(s.id)}
                  className={cn('flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                    section === s.id ? 'bg-accent-500/10 text-accent-300' : 'text-white/50 hover:text-white hover:bg-bg-hover')}>
                  <Icon className="w-4 h-4" /> {s.label}
                </button>
              );
            })}
            <button onClick={logout} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-danger-400 hover:bg-danger-500/10 transition-all whitespace-nowrap">
              <LogOut className="w-4 h-4" /> Выйти
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {section === 'profile' && <ProfileSection />}
          {section === 'business' && <BusinessSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'security' && <SecuritySection />}
          {section === 'subscription' && <SubscriptionSection onNavigate={onNavigate} />}
          {section === 'admin' && <AdminSection />}
        </div>
      </div>
    </div>
  );

  function ProfileSection() {
    const [name, setName] = useState(state.user?.name || '');
    const [email, setEmail] = useState(state.user?.email || '');

    const handleSave = () => {
      updateUser({ name, email });
      toast.success('Профиль обновлён');
    };

    return (
      <Card className="p-5 sm:p-6">
        <h3 className="text-base font-semibold text-white mb-5">Профиль</h3>
        <div className="flex items-center gap-4 mb-6">
          <Avatar name={name || 'Пользователь'} color="accent" size="lg" />
          <div>
            <p className="text-sm font-medium text-white">{name || '—'}</p>
            <p className="text-xs text-white/40">{email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Имя"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Button onClick={handleSave}><Save className="w-4 h-4" /> Сохранить</Button>
        </div>
      </Card>
    );
  }

  function BusinessSection() {
    const [name, setName] = useState(state.business?.name || '');
    const [industry, setIndustry] = useState(state.business?.industry || '');
    const [city, setCity] = useState(state.business?.city || '');
    const [employees, setEmployees] = useState(state.business?.employeesCount || '');

    const handleSave = () => {
      updateBusiness({ name, industry, city, employeesCount: employees });
      toast.success('Данные бизнеса обновлены');
    };

    return (
      <Card className="p-5 sm:p-6">
        <h3 className="text-base font-semibold text-white mb-5">Информация о бизнесе</h3>
        <div className="space-y-4">
          <Field label="Название бизнеса"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Сфера"><Input value={industry} onChange={e => setIndustry(e.target.value)} /></Field>
            <Field label="Город"><Input value={city} onChange={e => setCity(e.target.value)} /></Field>
          </div>
          <Field label="Количество сотрудников">
            <Select value={employees} onChange={e => setEmployees(e.target.value)} options={[{ value: '1', label: 'Только я' }, { value: '2-5', label: '2–5' }, { value: '6-15', label: '6–15' }, { value: '16-50', label: '16–50' }, { value: '50+', label: '50+' }]} placeholder="Выберите" />
          </Field>
          <Button onClick={handleSave}><Save className="w-4 h-4" /> Сохранить</Button>
        </div>
      </Card>
    );
  }

  function NotificationsSection() {
    const [settings, setSettings] = useState({
      payments: true, tasks: true, clients: true, documents: true, marketing: false,
    });

    const items = [
      { key: 'payments', label: 'Платежи', desc: 'Уведомления о счетах и оплатах' },
      { key: 'tasks', label: 'Задачи', desc: 'Напоминания о дедлайнах' },
      { key: 'clients', label: 'Клиенты', desc: 'Новые клиенты и активности' },
      { key: 'documents', label: 'Документы', desc: 'Статусы документов' },
      { key: 'marketing', label: 'Маркетинг', desc: 'Новости и акции BIZBOX' },
    ];

    const toggle = (key: string) => {
      setSettings(s => ({ ...s, [key]: !s[key as keyof typeof s] }));
      toast.success('Настройки сохранены');
    };

    return (
      <Card className="p-5 sm:p-6">
        <h3 className="text-base font-semibold text-white mb-5">Уведомления</h3>
        <div className="space-y-1">
          {items.map(item => (
            <div key={item.key} className="flex items-center justify-between py-3.5 border-b border-border/subtle last:border-0">
              <div>
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-2xs text-white/40 mt-0.5">{item.desc}</p>
              </div>
              <button onClick={() => toggle(item.key)}
                className={cn('relative w-11 h-6 rounded-full transition-colors', settings[item.key as keyof typeof settings] ? 'bg-accent-500' : 'bg-bg-raised')}>
                <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform', settings[item.key as keyof typeof settings] ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  function SecuritySection() {
    const [current, setCurrent] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirm, setConfirm] = useState('');
    const [twoFA, setTwoFA] = useState(false);

    const handleChangePass = () => {
      if (!current || !newPass) { toast.error('Заполните поля', 'Текущий и новый пароль обязательны'); return; }
      if (newPass !== confirm) { toast.error('Пароли не совпадают', 'Новый пароль и подтверждение должны быть одинаковыми'); return; }
      toast.success('Пароль изменён', 'Используйте новый пароль при следующем входе.');
      setCurrent(''); setNewPass(''); setConfirm('');
    };

    return (
      <div className="space-y-6">
        <Card className="p-5 sm:p-6">
          <h3 className="text-base font-semibold text-white mb-5">Смена пароля</h3>
          <div className="space-y-4">
            <Field label="Текущий пароль"><Input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" /></Field>
            <Field label="Новый пароль"><Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="••••••••" /></Field>
            <Field label="Подтвердите пароль"><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" /></Field>
            <Button onClick={handleChangePass}><Save className="w-4 h-4" /> Изменить пароль</Button>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Двухфакторная аутентификация</h3>
              <p className="text-sm text-white/40 mt-1">Дополнительная защита вашего аккаунта</p>
            </div>
            <button onClick={() => { setTwoFA(v => !v); toast.success(twoFA ? '2FA отключена' : '2FA включена'); }}
              className={cn('relative w-11 h-6 rounded-full transition-colors', twoFA ? 'bg-accent-500' : 'bg-bg-raised')}>
              <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform', twoFA ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
          </div>
        </Card>
      </div>
    );
  }

  function SubscriptionSection({ onNavigate }: { onNavigate: (p: Page) => void }) {
    const plan = state.user?.plan || 'free';
    const planInfo = { free: { name: 'FREE', price: '0 ₸' }, business: { name: 'BUSINESS', price: '4 990 ₸' }, pro: { name: 'PRO', price: '14 990 ₸' } };
    const pendingPayment = state.payments.find(p => p.status === 'awaiting_confirmation' || p.status === 'under_review');

    return (
      <div className="space-y-6">
        <Card className="p-5 sm:p-6">
          <h3 className="text-base font-semibold text-white mb-5">Текущая подписка</h3>
          <div className="flex items-center justify-between p-4 rounded-xl bg-bg-base border border-border mb-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-white">{planInfo[plan].name}</p>
                <Badge tone="accent">Активен</Badge>
              </div>
              <p className="text-sm text-white/40 mt-1">{planInfo[plan].price} / месяц</p>
            </div>
          </div>
          <Button onClick={() => onNavigate('subscription')}>Управление подпиской</Button>
        </Card>

        {pendingPayment && (
          <Card className="p-5 border-warning-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning-500/10 text-warning-400 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Оплата на проверке</p>
                <p className="text-xs text-white/50 mt-0.5">
                  Тариф {planInfo[pendingPayment.plan].name} — {planInfo[pendingPayment.plan].price}. Статус: ожидает подтверждения.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  function AdminSection() {
    const payments = state.payments;
    const pending = payments.filter(p => p.status === 'awaiting_confirmation' || p.status === 'under_review');

    const statusLabels: Record<PaymentStatus, { label: string; tone: 'warning' | 'neutral' | 'success' | 'danger' }> = {
      awaiting_payment: { label: 'Ожидает оплаты', tone: 'neutral' },
      navigated_to_kaspi: { label: 'Перешёл к оплате', tone: 'neutral' },
      awaiting_confirmation: { label: 'Ожидает подтверждения', tone: 'warning' },
      under_review: { label: 'Оплата проверяется', tone: 'warning' },
      confirmed: { label: 'Оплата подтверждена', tone: 'success' },
      rejected: { label: 'Оплата отклонена', tone: 'danger' },
    };

    return (
      <div className="space-y-6">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-accent-500/10 text-accent-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Администрирование платежей</h3>
              <p className="text-xs text-white/40 mt-0.5">Демо-режим: проверка и подтверждение оплат</p>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-white/40">Запросов на оплату пока нет</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.length > 0 && (
                <div className="mb-2">
                  <Badge tone="warning">{pending.length} ожидает подтверждения</Badge>
                </div>
              )}
              {payments.map((p: PaymentRequest) => {
                const st = statusLabels[p.status];
                const canConfirm = p.status === 'awaiting_confirmation' || p.status === 'under_review';
                return (
                  <div key={p.id} className="p-4 rounded-xl bg-bg-base border border-border">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white">{planNames[p.plan]}</p>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </div>
                        <p className="text-2xs text-white/40">
                          {p.customerName} · {p.customerPhone}
                        </p>
                        <p className="text-2xs text-white/30 mt-0.5">
                          {new Date(p.createdAt).toLocaleString('ru-RU')}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-white tabular-nums shrink-0">{formatCurrency(p.amount)}</span>
                    </div>
                    {canConfirm && (
                      <div className="flex gap-2 pt-3 border-t border-border">
                        <Button size="sm" variant="secondary" className="flex-1" onClick={() => {
                          rejectPayment(p.id);
                          toast.success('Оплата отклонена', `Тариф ${planNames[p.plan]} не активирован.`);
                        }}>
                          <XCircle className="w-3.5 h-3.5" /> Отклонить
                        </Button>
                        <Button size="sm" className="flex-1" onClick={() => {
                          confirmPayment(p.id);
                          toast.success('Оплата подтверждена', `Тариф ${planNames[p.plan]} активирован!`);
                        }}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Подтвердить оплату
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }
}
export default SubscriptionPage;
