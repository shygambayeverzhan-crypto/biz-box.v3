import { useState } from 'react';
import { User, Briefcase, Bell, Shield, CreditCard, Save, LogOut, Download, ShieldCheck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import type { Page, PaymentRequest, PaymentStatus, NotificationType } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Input, Field, Select } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { APP_VERSION } from '@/lib/telegram';
import { PLANS, PAYMENT_CONTACT } from '@/lib/billing';
import { getNotificationPreferences } from '@/lib/notificationPreferences';

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
  const { auth, logout } = useApp();
  const [section, setSection] = useState('profile');

  return (
    <div className="space-y-6">
      <PageHeader title="Настройки" subtitle="Управление аккаунтом и бизнесом" />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Section nav */}
        <div className="lg:w-56 shrink-0">
          <div className="liquid-inset p-1.5 rounded-3xl grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-1" aria-label="Разделы настроек">
            {sections.filter(s => s.id !== 'admin' || auth.mode === 'demo').map(s => {
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => setSection(s.id)}
                  aria-current={section === s.id ? 'page' : undefined}
                  className={cn('flex items-center gap-2 px-3 py-3 rounded-2xl text-xs font-medium transition-all whitespace-nowrap',
                    section === s.id ? 'glass text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-bg-hover')}>
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
          {section === 'admin' && auth.mode === 'demo' && <AdminSection />}
        </div>
      </div>
      <p className="text-[11px] text-white/25 text-center">BizBox · {APP_VERSION}</p>
    </div>
  );
}

  function ProfileSection() {
    const { state, updateUser, retrySave } = useApp();
    const toast = useToast();
    const [name, setName] = useState(state.user?.name || '');
    const [email, setEmail] = useState(state.user?.email || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
      if (!name.trim()) { setError('Укажите имя.'); return; }
      setSaving(true); setError('');
      updateUser({ name: name.trim(), email: email.trim() });
      try { await retrySave(); toast.success('Профиль сохранён'); }
      catch (e) { setError(e instanceof Error ? e.message : 'Не удалось синхронизировать профиль. Повторите сохранение.'); }
      finally { setSaving(false); }
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
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); void handleSave(); }}>
          <Field label="Имя" htmlFor="profile-name"><Input id="profile-name" required disabled={saving} maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Email" htmlFor="profile-email"><Input id="profile-email" type="email" disabled={saving} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
          <Button type="submit" disabled={saving}><Save className="w-4 h-4" /> {saving ? 'Сохраняем…' : 'Сохранить'}</Button>
        </form>
      </Card>
    );
  }

  function BusinessSection() {
    const { state, updateBusiness, retrySave } = useApp();
    const toast = useToast();
    const [name, setName] = useState(state.business?.name || '');
    const [industry, setIndustry] = useState(state.business?.industry || '');
    const [city, setCity] = useState(state.business?.city || '');
    const [employees, setEmployees] = useState(state.business?.employeesCount || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
      if (![name, industry, city, employees].every(v => v.trim())) { setError('Заполните название, сферу, город и количество сотрудников.'); return; }
      setSaving(true); setError('');
      updateBusiness({ name: name.trim(), industry: industry.trim(), city: city.trim(), employeesCount: employees });
      try { await retrySave(); toast.success('Данные бизнеса сохранены'); }
      catch (e) { setError(e instanceof Error ? e.message : 'Не удалось синхронизировать данные. Повторите сохранение.'); }
      finally { setSaving(false); }
    };

    return (
      <Card className="p-5 sm:p-6">
        <h3 className="text-base font-semibold text-white mb-5">Информация о бизнесе</h3>
        <div className="space-y-4">
          <Field label="Название бизнеса" htmlFor="business-name"><Input id="business-name" disabled={saving} value={name} onChange={e => setName(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Сфера" htmlFor="business-industry"><Input id="business-industry" disabled={saving} value={industry} onChange={e => setIndustry(e.target.value)} /></Field>
            <Field label="Город" htmlFor="business-city"><Input id="business-city" disabled={saving} value={city} onChange={e => setCity(e.target.value)} /></Field>
          </div>
          <Field label="Количество сотрудников" htmlFor="business-employees">
            <Select id="business-employees" disabled={saving} value={employees} onChange={e => setEmployees(e.target.value)} options={[{ value: '1', label: 'Только я' }, { value: '2-5', label: '2–5' }, { value: '6-15', label: '6–15' }, { value: '16-50', label: '16–50' }, { value: '50+', label: '50+' }]} placeholder="Выберите" />
          </Field>
          {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
          <Button disabled={saving} onClick={() => void handleSave()}><Save className="w-4 h-4" /> {saving ? 'Сохраняем…' : 'Сохранить'}</Button>
        </div>
      </Card>
    );
  }

  function NotificationsSection() {
    const { state, updateUser, retrySave } = useApp();
    const toast = useToast();
    const settings = getNotificationPreferences(state.user?.notificationPreferences);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const items: { key: NotificationType; label: string; desc: string }[] = [
      { key: 'payment', label: 'Платежи', desc: 'Счета и оплаты' },
      { key: 'task', label: 'Задачи', desc: 'События по задачам' },
      { key: 'client', label: 'Клиенты', desc: 'Новые клиенты и активности' },
      { key: 'document', label: 'Документы', desc: 'Статусы документов' },
      { key: 'system', label: 'Системные', desc: 'Сообщения BizBox' },
    ];

    const toggle = async (key: NotificationType) => {
      setSaving(true); setError('');
      updateUser({ notificationPreferences: { ...settings, [key]: !settings[key] } });
      try { await retrySave(); toast.success('Настройки сохранены'); }
      catch { setError('Изменение применено. Облачное сохранение ещё не завершено — повторите синхронизацию.'); }
      finally { setSaving(false); }
    };

    return (
      <Card className="p-5 sm:p-6">
        <h3 className="text-base font-semibold text-white mb-2">Уведомления в приложении</h3>
        <p className="text-xs text-white/60 mb-4">Выберите, что показывать под значком колокольчика. Сообщения самого Telegram настраиваются в Telegram.</p>
        {error && <p role="alert" className="text-xs text-amber-200 mb-3">{error}</p>}
        <div className="space-y-1">
          {items.map(item => (
            <div key={item.key} className="flex items-center justify-between py-3.5 border-b border-border/subtle last:border-0">
              <div>
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-2xs text-white/40 mt-0.5">{item.desc}</p>
              </div>
              <button type="button" disabled={saving} role="switch" aria-checked={settings[item.key]} aria-label={item.label} onClick={() => void toggle(item.key)}
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
    const { auth, exportWorkspace } = useApp();
    return (
      <div className="space-y-6">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-accent-400" />
            <h3 className="text-base font-semibold text-white">Вход через Telegram</h3>
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            {auth.mode === 'telegram'
              ? 'BizBox открывает рабочее пространство твоего аккаунта Telegram. После сохранения данные доступны при следующем входе через этого же бота.'
              : 'Сейчас открыт демо-режим. Для своего бизнеса открой BizBox в Telegram: там данные сохраняются в твоём аккаунте.'}
          </p>
          <p className="text-sm text-white/50 leading-relaxed mt-4">
            Пароль Telegram и двухэтапную проверку можно настроить в самом Telegram: «Настройки» → «Конфиденциальность». Активные сеансы — в разделе «Устройства».
          </p>
        </Card>

        <Card className="p-5 sm:p-6">
          <h3 className="text-base font-semibold text-white">Копия данных</h3>
          <p className="text-sm text-white/50 leading-relaxed mt-2 mb-5">Скачай профиль, операции, клиентов и задачи одним файлом JSON. В копию попадут и изменения, которые ещё ожидают сохранения.</p>
          <Button onClick={exportWorkspace}><Download className="w-4 h-4" /> Скачать копию</Button>
        </Card>
      </div>
    );
  }

  function AdminSection() {
    const { state, confirmPayment, rejectPayment } = useApp();
    const toast = useToast();
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
function SubscriptionSection({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { state, auth, subscriptionAccess, paymentRequest, billingStatus, billingError } = useApp();
  const plan = state.user?.plan || 'free';
  const planInfo = PLANS[plan];
  const expiry = subscriptionAccess && plan !== 'free'
    ? new Date(subscriptionAccess.expiresAt).toLocaleDateString('ru-RU')
    : null;

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <h3 className="text-base font-semibold text-white mb-5">Текущая подписка</h3>
        <div className="flex items-center justify-between p-4 rounded-xl bg-bg-base border border-border mb-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-white">{planInfo.name}</p>
              <Badge tone="accent">{auth.mode === 'demo' ? 'Демо' : 'Активен'}</Badge>
            </div>
            <p className="text-sm text-white/40 mt-1">{plan === 'free' ? 'Бесплатно, без срока' : `${formatCurrency(planInfo.price)} / 30 дней`}</p>
            {expiry && <p className="text-sm text-white/60 mt-2">Доступ до {expiry}</p>}
          </div>
        </div>
        <Button onClick={() => onNavigate('subscription')}>Тарифы и оплата</Button>
        {billingStatus === 'loading' && <p role="status" className="mt-3 text-xs text-white/50">Обновляем статус подписки…</p>}
        {(billingStatus === 'unavailable' || billingStatus === 'auth_required') && <p className="mt-3 text-xs leading-relaxed text-amber-300">{billingError || 'Не удалось обновить оплату. Открой раздел тарифов, чтобы повторить запрос.'}</p>}
      </Card>

      {paymentRequest && (
        <Card className={cn('p-5', paymentRequest.status === 'approved' ? 'border-success-500/30' : paymentRequest.status === 'rejected' ? 'border-danger-500/30' : 'border-warning-500/30')}>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', paymentRequest.status === 'approved' ? 'bg-success-500/10 text-success-400' : paymentRequest.status === 'rejected' ? 'bg-danger-500/10 text-danger-400' : 'bg-warning-500/10 text-warning-400')}>
              {paymentRequest.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : paymentRequest.status === 'rejected' ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{paymentRequest.status === 'approved' ? 'Оплата подтверждена' : paymentRequest.status === 'rejected' ? 'Оплата не подтверждена' : paymentRequest.receiptReceived ? 'Чек получен' : 'Прикрепи чек к заявке'}</p>
              <p className="text-xs text-white/50 mt-0.5">
                {PLANS[paymentRequest.plan].name} — {formatCurrency(paymentRequest.amount)}.
              </p>
              <p className="text-xs text-white/40 mt-2">{paymentRequest.status === 'approved'
                ? 'Действующий тариф и срок доступа показаны выше.'
                : paymentRequest.status === 'rejected' ? `Если деньги отправлены, напиши @${PAYMENT_CONTACT}. Повторно платить не нужно.`
                  : paymentRequest.receiptReceived ? 'Ожидаем подтверждения Ержана. После него тариф включится автоматически.' : 'Открой заявку и отправь чек боту. Заявка сама по себе не подтверждает оплату.'}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => onNavigate('subscription')}>Открыть заявку</Button>
        </Card>
      )}
    </div>
  );
}


export default SettingsPage;
