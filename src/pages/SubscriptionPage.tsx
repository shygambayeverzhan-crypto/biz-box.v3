import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowUpRight, Check, CheckCircle2, Copy, CreditCard, KeyRound, Send } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { PLANS, KASPI_URL, PAYMENT_PHONE, PAYMENT_RECIPIENT, PAYMENT_CONTACT, ACCESS_DAYS, receiptLink, type PaidPlan } from '@/lib/billing';
import { getTelegram } from '@/lib/telegram';
import type { UserProfile } from '@/types';

const price = (amount: number) => `${amount.toLocaleString('ru-RU')} ₸`;
const linkStyle = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400';

// Keep real hrefs as fallback. Bridge calls run directly on the user's click.
function openExternal(event: MouseEvent<HTMLAnchorElement>, telegram = false) {
  const app = getTelegram();
  const open = telegram ? app?.openTelegramLink : app?.openLink;
  if (!app || !open) return;
  try { open.call(app, event.currentTarget.href); event.preventDefault(); }
  catch { /* The browser anchor remains usable if the bridge fails. */ }
}

export default function SubscriptionPage() {
  const { state, auth, subscriptionAccess, addPayment, updatePaymentStatus, activateAccessCode, syncStatus } = useApp();
  const currentPlan = state.user?.plan || 'free';
  const telegramId = getTelegram()?.initDataUnsafe?.user?.id;
  const userId = typeof telegramId === 'number' && Number.isSafeInteger(telegramId) && telegramId > 0 ? String(telegramId) : '';
  const canPay = auth.mode === 'telegram' && Boolean(userId);
  const existingRequest = state.payments.find(p => p.userId === userId && !['confirmed', 'rejected'].includes(p.status) && p.plan !== currentPlan && currentPlan !== 'pro');
  const [selected, setSelected] = useState<PaidPlan | null>(() => existingRequest?.plan || null);
  const [accessCode, setAccessCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const checkout = useRef<HTMLHeadingElement>(null);
  const request = selected ? state.payments.find(p => p.plan === selected && p.userId === userId && !['confirmed', 'rejected'].includes(p.status)) : undefined;
  const selectedPlan = selected ? PLANS[selected] : null;

  useEffect(() => { if (selected) checkout.current?.focus({ preventScroll: true }); }, [selected]);

  function choosePlan(plan: PaidPlan) {
    setSelected(plan); setNotice(''); setError('');
    if (canPay && !state.payments.some(p => p.plan === plan && p.userId === userId && !['confirmed', 'rejected'].includes(p.status))) {
      addPayment({ userId, plan, amount: PLANS[plan].price, customerName: state.user?.name || '', customerPhone: '' });
    }
    requestAnimationFrame(() => checkout.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function copyPhone() {
    try { await navigator.clipboard.writeText(PAYMENT_PHONE); setNotice('Номер скопирован. Получатель: ' + PAYMENT_RECIPIENT); }
    catch { setNotice('Не получилось скопировать. Выдели номер вручную: ' + PAYMENT_PHONE); }
  }

  async function activate() {
    if (activating) return;
    setActivating(true); setError(''); setNotice('');
    try {
      await activateAccessCode(accessCode.trim());
      setAccessCode(''); setSelected(null);
      setNotice('Готово! Доступ активирован и сохранён в Telegram.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось активировать доступ. Попробуй ещё раз.');
    } finally { setActivating(false); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-6">
      <header className="relative overflow-hidden rounded-3xl border border-accent-500/25 bg-gradient-to-br from-accent-500/15 via-bg-card to-bg-card p-6 sm:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-400">BIZBOX · Тарифы</span>
          <span className="rounded-full border border-border bg-bg-base/60 px-3 py-1.5 text-xs text-white/80">{auth.mode === 'demo' ? 'Демо · ' : 'Сейчас · '}{PLANS[currentPlan].name}</span>
        </div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Больше порядка. Меньше рутины.</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">Начни с бесплатного учёта. Когда понадобятся документы или карточки сотрудников — выбери подходящий тариф.</p>
        {subscriptionAccess && <p className="mt-4 flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 size={17} aria-hidden="true" />Доступ до {new Date(subscriptionAccess.expiresAt).toLocaleString('ru-RU')}</p>}
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as UserProfile['plan'][]).map(key => {
          const plan = PLANS[key]; const isCurrent = key === currentPlan;
          return (
            <section key={key} className={`relative flex flex-col rounded-2xl border p-5 sm:p-6 ${key === 'business' ? 'border-accent-500/60 bg-accent-500/10' : 'border-border bg-bg-card'}`}>
              <div className="mb-4 flex items-center justify-between gap-2"><h2 className="font-bold tracking-wide text-white">{plan.name}</h2>{isCurrent && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/75">Текущий</span>}</div>
              <p className="min-h-10 text-sm text-white/60">{plan.description}</p>
              <div className="mb-5 mt-5"><strong className="text-3xl font-bold text-white">{price(plan.price)}</strong><span className="ml-1.5 text-xs text-white/50">{key === 'free' ? 'навсегда' : '/ 30 дней'}</span></div>
              <ul className="mb-6 flex-1 space-y-3">{plan.features.map(feature => <li key={feature} className="flex items-start gap-2 text-sm leading-relaxed text-white/80"><Check className="mt-0.5 shrink-0 text-accent-400" size={16} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
              {key === 'free' ? <Button variant="secondary" disabled className="w-full">{isCurrent ? 'Уже подключён' : 'Базовые функции включены'}</Button> :
                <Button variant={key === 'business' ? 'primary' : 'outline'} onClick={() => choosePlan(key)} disabled={(isCurrent || currentPlan === 'pro') && auth.mode !== 'demo'} className="w-full">{auth.mode !== 'demo' && isCurrent ? 'Уже подключён' : auth.mode !== 'demo' && currentPlan === 'pro' ? 'Входит в PRO' : `Выбрать ${plan.name}`}<ArrowUpRight size={16} aria-hidden="true" /></Button>}
            </section>
          );
        })}
      </div>
      <p className="text-center text-xs leading-relaxed text-white/50">Один платёж — {ACCESS_DAYS} дней доступа с момента выдачи кода. Автосписаний нет. Это личное рабочее пространство; совместный доступ сотрудников не входит в тарифы.</p>

      {selected && selectedPlan && <section className="overflow-hidden rounded-2xl border border-border bg-bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:p-6">
          <div><h2 ref={checkout} tabIndex={-1} className="scroll-mt-24 text-lg font-bold text-white focus:outline-none">Подключаем {selectedPlan.name}</h2><p className="mt-1 text-sm text-white/55">{price(selectedPlan.price)} · {ACCESS_DAYS} дней · ручное подтверждение</p></div>
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Закрыть</Button>
        </div>
        {!canPay ? <div className="p-5 text-sm leading-relaxed text-white/70 sm:p-6">{auth.mode === 'demo' ? 'Это просмотр тарифов в демо. Для покупки и сохранения доступа открой своё рабочее пространство через профиль BizBox в Telegram.' : 'Не удалось получить твой Telegram ID. Открой BizBox через кнопку приложения в профиле бота — так код доступа будет привязан к тебе.'}</div> : <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-white"><CreditCard size={18} className="text-accent-400" aria-hidden="true" />1. Оплати через Kaspi</h3>
            <p className="text-sm leading-relaxed text-white/60">Кнопка откроет страницу Kaspi. Перед подтверждением проверь сумму <strong className="text-white">{price(selectedPlan.price)}</strong> и реквизиты получателя.</p>
            {subscriptionAccess && <p className="text-xs leading-relaxed text-amber-400">У тебя ещё действует {PLANS[currentPlan].name}. Перед оплатой согласуй с Ержаном переход: оставшиеся дни не переносятся автоматически.</p>}
            {request && <a href={KASPI_URL} target="_blank" rel="noopener noreferrer" className={`${linkStyle} w-full bg-red-500 text-white hover:bg-red-400`} onClick={event => {
              if (request.status === 'awaiting_payment') updatePaymentStatus(request.id, 'navigated_to_kaspi');
              openExternal(event);
            }}>Оплатить {price(selectedPlan.price)}<ArrowUpRight size={18} aria-hidden="true" /></a>}
            <div className="rounded-xl border border-border bg-bg-base/70 p-4">
              <p className="text-xs text-white/50">Или перевод по номеру телефона</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="select-text text-lg font-semibold text-white">{PAYMENT_PHONE}</span><Button variant="ghost" size="icon" onClick={copyPhone} aria-label="Скопировать номер для оплаты"><Copy size={17} /></Button></div>
              <p className="text-sm text-white/70">{PAYMENT_RECIPIENT}</p>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-white"><Send size={18} className="text-accent-400" aria-hidden="true" />2. Отправь чек</h3>
            <p className="text-sm leading-relaxed text-white/60">После оплаты отправь чек в <strong className="text-white">@{PAYMENT_CONTACT}</strong>. В чате уже будет текст с тарифом и твоим ID — прикрепи чек и нажми «Отправить».</p>
            {request && <>
              <a href={receiptLink(selected, request.id, userId)} target="_blank" rel="noopener noreferrer" className={`${linkStyle} w-full border border-border bg-bg-raised text-white hover:bg-bg-hover`} onClick={event => openExternal(event, true)}>Отправить чек<Send size={17} aria-hidden="true" /></a>
              <div className="rounded-xl bg-bg-base/70 p-3 text-xs leading-relaxed text-white/50"><p className="break-all">Заявка: {request.id}</p><p>Твой Telegram ID: <span className="select-all text-white/80">{userId}</span></p></div>
            </>}
            <p className="text-xs leading-relaxed text-white/50">После проверки поступления оплаты Ержан пришлёт код доступа. Вставь его ниже. Переход по ссылке сам по себе не подтверждает оплату.</p>
            {syncStatus === 'saving' && <p role="status" className="text-xs text-accent-400">Сохраняем заявку в твоём Telegram…</p>}
            {syncStatus === 'error' && <p role="alert" className="text-xs text-amber-400">Заявка пока не сохранена. Дождись сохранения перед оплатой или отправь свой Telegram ID вместе с чеком.</p>}
          </div>
        </div>}
      </section>}

      <section className="rounded-2xl border border-border bg-bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><KeyRound size={20} className="text-accent-400" aria-hidden="true" />Уже получил код?</h2>
        <p className="mb-4 mt-2 text-sm leading-relaxed text-white/60">Вставь код из ответа @{PAYMENT_CONTACT}. Он включает оплаченный тариф для твоего аккаунта.</p>
        {userId && <p className="mb-3 text-xs text-white/50">Твой Telegram ID: <span className="select-all text-white/80">{userId}</span></p>}
        <form onSubmit={event => { event.preventDefault(); void activate(); }} className="space-y-3">
          <label htmlFor="access-code" className="text-xs font-medium text-white/60">Код доступа</label>
          <textarea id="access-code" value={accessCode} onChange={event => setAccessCode(event.target.value)} maxLength={4096} rows={3} autoCapitalize="off" autoComplete="off" spellCheck={false} placeholder="bb1.…" disabled={!canPay || activating} className="block w-full resize-y rounded-xl border border-border bg-bg-base px-4 py-3 text-sm text-white outline-none focus:border-accent-500 disabled:opacity-50" />
          <Button type="submit" disabled={!canPay || !accessCode.trim() || activating}>{activating ? 'Сохраняем доступ…' : 'Активировать тариф'}</Button>
        </form>
        {auth.mode === 'demo' && <p className="mt-3 text-xs text-white/50">В демо оплата и активация отключены.</p>}
        {notice && <p role="status" className="mt-4 text-sm text-emerald-400">{notice}</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      </section>
      <p className="text-center text-xs text-white/50">Есть вопрос по оплате или продлению? <a href={`https://t.me/${PAYMENT_CONTACT}`} target="_blank" rel="noopener noreferrer" className="text-accent-400 underline underline-offset-4" onClick={event => openExternal(event, true)}>Напиши Ержану</a></p>
    </div>
  );
}
