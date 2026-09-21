import { useState } from 'react';
import { Check, Sparkles, Zap, Crown, ExternalLink, Copy, Clock, ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import type { UserProfile, PaymentRequest } from '@/types';
import { formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Field } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

const KASPI_PAY_URL = 'https://pay.kaspi.kz/pay/6hpgsuja';

interface Plan {
  id: UserProfile['plan'];
  name: string;
  price: number;
  icon: typeof Check;
  features: string[];
  highlight?: boolean;
  color: string;
}

const plans: Plan[] = [
  {
    id: 'free', name: 'FREE', price: 0, icon: Sparkles, color: 'text-white/60',
    features: ['1 бизнес', 'Базовый учёт', '20 операций в месяц', '5 документов', 'Календарь', 'Базовый CRM'],
  },
  {
    id: 'business', name: 'BUSINESS', price: 4990, icon: Zap, highlight: true, color: 'text-accent-400',
    features: ['Всё из Free', 'Безлимитные операции', 'Документы без лимитов', 'Полноценный CRM', 'Сотрудники', 'Финансовая аналитика', 'Приоритетная поддержка'],
  },
  {
    id: 'pro', name: 'PRO', price: 14990, icon: Crown, color: 'text-warning-400',
    features: ['Всё из Business', 'Расширенная аналитика', 'Бизнес-специалисты', 'Автоматизация процессов', 'Приоритетные специалисты', 'Расширенные лимиты'],
  },
];

const planPrices: Record<string, number> = { free: 0, business: 4990, pro: 14990 };
const planNames: Record<string, string> = { free: 'FREE', business: 'BUSINESS', pro: 'PRO' };

type ModalState =
  | { type: 'kaspi'; plan: Plan }
  | { type: 'returned'; plan: Plan }
  | { type: 'confirm'; plan: Plan }
  | null;

export function SubscriptionPage() {
  const { state, addPayment } = useApp();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [period, setPeriod] = useState<'month' | 'year'>('month');

  const currentPlan = state.user?.plan || 'free';

  const handleSelect = (plan: Plan) => {
    if (plan.id === 'free') return;
    setModal({ type: 'kaspi', plan });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Тарифы BIZBOX" subtitle="Выберите план, который подходит вашему бизнесу" />

      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setPeriod('month')} className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all', period === 'month' ? 'bg-accent-500/15 text-accent-300' : 'text-white/50')}>Помесячно</button>
        <button onClick={() => setPeriod('year')} className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2', period === 'year' ? 'bg-accent-500/15 text-accent-300' : 'text-white/50')}>
          Годовая <Badge tone="success">−20%</Badge>
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {plans.map(plan => {
          const Icon = plan.icon;
          const isCurrent = currentPlan === plan.id;
          const price = period === 'year' ? Math.round(plan.price * 12 * 0.8) : plan.price;
          return (
            <Card key={plan.id} className={cn('p-6 relative flex flex-col', plan.highlight && 'border-accent-500/40 shadow-glow-sm')}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge tone="accent" className="px-3 py-1">Популярный</Badge>
                </div>
              )}
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-4', plan.highlight ? 'bg-accent-500/15' : 'bg-white/5')}>
                <Icon className={cn('w-5 h-5', plan.color)} />
              </div>
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              <div className="mt-3 mb-5">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white tabular-nums">{formatCurrency(plan.price)}</span>
                  <span className="text-sm text-white/40">/мес</span>
                </div>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5">
                    <div className={cn('w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5', plan.highlight ? 'bg-accent-500/20' : 'bg-white/5')}>
                      <Check className={cn('w-2.5 h-2.5', plan.highlight ? 'text-accent-400' : 'text-white/50')} />
                    </div>
                    <span className="text-sm text-white/70">{f}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <Button variant="secondary" className="w-full" disabled>Текущий тариф</Button>
              ) : plan.id === 'free' ? (
                <Button variant="outline" className="w-full" disabled={currentPlan !== 'free' ? false : true}>
                  {currentPlan === 'free' ? 'Текущий тариф' : 'Выбрать FREE'}
                </Button>
              ) : (
                <Button variant={plan.highlight ? 'primary' : 'outline'} className="w-full" onClick={() => handleSelect(plan)}>
                  Оплатить {formatCurrency(plan.price)}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Pending payment notice */}
      {state.payments.filter(p => p.status === 'awaiting_confirmation' || p.status === 'under_review').length > 0 && (
        <Card className="p-5 border-warning-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning-500/10 text-warning-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Оплата на проверке</p>
              <p className="text-xs text-white/50 mt-0.5">
                У вас есть запрос на оплату тарифа {state.payments.find(p => p.status === 'awaiting_confirmation' || p.status === 'under_review')?.plan === 'business' ? 'BUSINESS' : 'PRO'}. Мы активируем тариф после подтверждения оплаты.
              </p>
            </div>
          </div>
        </Card>
      )}

      <KaspiPayModal modal={modal} setModal={setModal} toast={toast} />
      <ConfirmPaymentModal modal={modal} setModal={setModal} toast={toast} userName={state.user?.name || ''} userEmail={state.user?.email || ''} addPayment={addPayment} />
      <ReturnedModal modal={modal} setModal={setModal} />
    </div>
  );
}

function KaspiPayModal({ modal, setModal, toast }: { modal: ModalState; setModal: (m: ModalState) => void; toast: ReturnType<typeof useToast> }) {
  if (!modal || modal.type !== 'kaspi') return null;
  const { plan } = modal;
  const amount = planPrices[plan.id];
  const amountStr = String(amount);

  const copyAmount = async () => {
    try {
      await navigator.clipboard.writeText(amountStr);
      toast.success('Сумма скопирована', `${amountStr} ₸ скопировано в буфер обмена`);
    } catch {
      toast.error('Не удалось скопировать', 'Скопируйте сумму вручную');
    }
  };

  const goToKaspi = () => {
    setModal({ type: 'returned', plan });
    window.open(KASPI_PAY_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal open onClose={() => setModal(null)} title={`Оплата ${plan.name}`} subtitle={`Стоимость: ${formatCurrency(amount)} / месяц`} size="md">
      <div className="space-y-5">
        {/* Kaspi badge */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-bg-base border border-border">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F14635] to-[#D31E28] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-lg">K</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Kaspi Pay</p>
            <p className="text-2xs text-white/40">Оплата производится через Kaspi Pay</p>
          </div>
        </div>

        {/* Amount instruction */}
        <div className="p-4 rounded-xl bg-accent-500/5 border border-accent-500/20">
          <p className="text-sm text-white/70 mb-3">
            Введите сумму <span className="text-accent-300 font-semibold">{formatCurrency(amount)}</span> в Kaspi Pay
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3.5 h-11 rounded-xl bg-bg-base border border-border-strong">
              <span className="text-lg font-bold text-white tabular-nums">{amountStr}</span>
              <span className="text-sm text-white/40">₸</span>
            </div>
            <Button variant="secondary" onClick={copyAmount} className="shrink-0">
              <Copy className="w-4 h-4" /> <span className="hidden sm:inline">Скопировать сумму</span>
            </Button>
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-bg-base border border-border">
          <ShieldCheck className="w-4 h-4 text-success-400 shrink-0 mt-0.5" />
          <p className="text-2xs text-white/50 leading-relaxed">
            Все платёжные данные вводятся только внутри Kaspi. BIZBOX не запрашивает и не хранит номера карт, CVV или пароли от Kaspi.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Отмена</Button>
          <Button className="flex-1" onClick={goToKaspi}>
            <ExternalLink className="w-4 h-4" /> Перейти к оплате Kaspi
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ReturnedModal({ modal, setModal }: { modal: ModalState; setModal: (m: ModalState) => void }) {
  if (!modal || modal.type !== 'returned') return null;
  const { plan } = modal;

  return (
    <Modal open onClose={() => setModal(null)} title="Оплатили?" size="sm">
      <div className="space-y-5">
        <p className="text-sm text-white/60 leading-relaxed">
          После оплаты отправьте подтверждение, чтобы мы активировали тариф {plan.name}.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>
            <ArrowLeft className="w-4 h-4" /> Вернуться
          </Button>
          <Button className="flex-1" onClick={() => setModal({ type: 'confirm', plan })}>
            Я оплатил
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmPaymentModal({ modal, setModal, toast, userName, userEmail, addPayment }: {
  modal: ModalState;
  setModal: (m: ModalState) => void;
  toast: ReturnType<typeof useToast>;
  userName: string;
  userEmail: string;
  addPayment: (p: Omit<PaymentRequest, 'id' | 'createdAt' | 'status'>) => string;
}) {
  if (!modal || modal.type !== 'confirm') return null;
  const { plan } = modal;
  const amount = planPrices[plan.id];

  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState('');

  const handleSubmit = () => {
    if (!name.trim() || !phone.trim()) {
      toast.error('Заполните все поля', 'Имя и телефон обязательны для подтверждения');
      return;
    }
    addPayment({
      userId: userEmail,
      plan: plan.id as 'business' | 'pro',
      amount,
      customerName: name.trim(),
      customerPhone: phone.trim(),
    });
    toast.success('Подтверждение отправлено', 'Оплата проверяется. Мы активируем тариф после проверки.');
    setModal(null);
  };

  return (
    <Modal open onClose={() => setModal(null)} title="Подтверждение оплаты" subtitle={`Тариф ${plan.name}`} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Имя" required>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" autoFocus />
          </Field>
          <Field label="Телефон" required>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 701 ..." inputMode="tel" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Выбранный тариф">
            <Input value={planNames[plan.id]} readOnly className="bg-bg-base text-white/50" />
          </Field>
          <Field label="Сумма">
            <Input value={`${formatCurrency(amount)} ₸`} readOnly className="bg-bg-base text-white/50" />
          </Field>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-warning-500/5 border border-warning-500/20">
          <Clock className="w-4 h-4 text-warning-400 shrink-0 mt-0.5" />
          <p className="text-2xs text-white/50 leading-relaxed">
            После отправки подтверждения статус оплаты изменится на «Ожидает подтверждения». Тариф будет активирован после проверки оплаты администратором.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Отмена</Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!name.trim() || !phone.trim()}>
            <Send className="w-4 h-4" /> Отправить подтверждение
          </Button>
        </div>
      </div>
    </Modal>
  );
}
