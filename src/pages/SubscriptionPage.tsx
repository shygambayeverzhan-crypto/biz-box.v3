import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowUpRight, Check, CheckCircle2, Clock, Copy, CreditCard, KeyRound, RefreshCw, Send } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { PLANS, KASPI_URL, PAYMENT_PHONE, PAYMENT_RECIPIENT, PAYMENT_CONTACT, ACCESS_DAYS, receiptLink, type PaidPlan } from '@/lib/billing';
import { botReceiptLink } from '@/lib/billingApi';
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
  const { state, auth, subscriptionAccess, paymentRequest, billingStatus, billingError, submitPaymentRequest, refreshBilling, activateAccessCode } = useApp();
  const currentPlan = state.user?.plan || 'free';
  const app = getTelegram();
  const telegramId = app?.initDataUnsafe?.user?.id;
  const userId = typeof telegramId === 'number' && Number.isSafeInteger(telegramId) && telegramId > 0 ? String(telegramId) : '';
  const canPay = auth.mode === 'telegram' && Boolean(userId);
  const canRequest = canPay && Boolean(app?.initData) && billingStatus !== 'auth_required';
  const [selected, setSelected] = useState<PaidPlan | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeWarning, setNoticeWarning] = useState(false);
  const [notificationFailed, setNotificationFailed] = useState(false);
  const [error, setError] = useState('');
  const checkout = useRef<HTMLHeadingElement>(null);
  const requestHeading = useRef<HTMLHeadingElement>(null);
  const pendingRequest = paymentRequest?.status === 'pending' ? paymentRequest : null;
  const checkoutPlan = selected ? pendingRequest?.plan || selected : null;
  const selectedPlan = checkoutPlan ? PLANS[checkoutPlan] : null;
  const alreadyIncluded = checkoutPlan && auth.mode !== 'demo' && (checkoutPlan === currentPlan || currentPlan === 'pro');
  const needsFallback = billingStatus === 'unavailable' || billingStatus === 'auth_required';

  useEffect(() => { if (selected) checkout.current?.focus({ preventScroll: true }); }, [selected]);

  function choosePlan(plan: PaidPlan) {
    setError(''); setNotice(''); setNoticeWarning(false);
    if (pendingRequest && pendingRequest.plan !== plan) {
      setSelected(pendingRequest.plan);
      setNotice(`У тебя уже есть заявка на ${PLANS[pendingRequest.plan].name}. Для смены тарифа напиши Ержану — повторно платить не нужно.`);
      setNoticeWarning(true);
    } else setSelected(plan);
    requestAnimationFrame(() => checkout.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function copyPhone() {
    setNoticeWarning(false);
    try { await navigator.clipboard.writeText(PAYMENT_PHONE); setNotice('Номер скопирован. Получатель: ' + PAYMENT_RECIPIENT); }
    catch { setNotice('Выдели и скопируй номер вручную: ' + PAYMENT_PHONE); }
  }

  async function submitPayment(plan: PaidPlan) {
    if (submitting) return;
    setSubmitting(true); setError(''); setNotice('');
    try {
      const result = await submitPaymentRequest(plan);
      setNotificationFailed(!result.notificationDelivered);
      setNoticeWarning(!result.notificationDelivered);
      setNotice(result.notificationDelivered
        ? 'Заявка сохранена, уведомление отправлено Ержану. Теперь прикрепи чек в чате бота.'
        : 'Заявка сохранена, но уведомление Ержану не доставлено. Отправь чек боту или напиши Ержану напрямую — повторно платить не нужно.');
      requestAnimationFrame(() => { requestHeading.current?.focus({ preventScroll: true }); requestHeading.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === 'AbortError'
        ? 'Запрос прерван. Заявка могла сохраниться — обнови статус перед повторной отправкой.'
        : cause instanceof Error ? cause.message : 'Не удалось отправить заявку. Обнови статус или напиши Ержану.');
    } finally { setSubmitting(false); }
  }

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true); setError('');
    try { await refreshBilling(); }
    catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        setError(cause instanceof Error ? cause.message : 'Не удалось обновить статус. Попробуй чуть позже.');
      }
    } finally { setRefreshing(false); }
  }

  async function activate() {
    if (activating) return;
    setActivating(true); setError(''); setNotice(''); setNoticeWarning(false);
    try {
      await activateAccessCode(accessCode.trim());
      setAccessCode(''); setSelected(null);
      setNotice('Код проверен и сохранён. Текущий тариф и срок доступа показаны сверху.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось проверить код. Попробуй ещё раз.');
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
        {billingStatus === 'loading' && <p role="status" className="mt-3 text-xs text-white/50">Обновляем статус подписки…</p>}
      </header>

      {notice && <p role="status" className={`rounded-xl border p-4 text-sm leading-relaxed ${noticeWarning ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}>{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm leading-relaxed text-red-300">{error}</p>}

      {paymentRequest && <section className="rounded-2xl border border-accent-500/30 bg-bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 ref={requestHeading} tabIndex={-1} className="text-lg font-semibold text-white focus:outline-none">Заявка на {PLANS[paymentRequest.plan].name}</h2>
            <p className="mt-1 text-sm text-white/55">{price(paymentRequest.amount)} · {new Date(paymentRequest.createdAt).toLocaleDateString('ru-RU')}</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs ${paymentRequest.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : paymentRequest.status === 'rejected' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>
            {paymentRequest.status === 'approved' ? 'Оплата подтверждена' : paymentRequest.status === 'rejected' ? 'Не подтверждена' : paymentRequest.receiptReceived ? 'Чек получен' : 'Нужен чек'}
          </span>
        </div>
        {paymentRequest.status === 'pending' ? <>
          <p className="mt-4 text-sm leading-relaxed text-white/65">{paymentRequest.receiptReceived
            ? 'Чек сохранён. Ержан проверит поступление денег и подтвердит оплату. Доступ появится автоматически — статус обновляется, пока приложение открыто.'
            : 'Нажми кнопку ниже, затем «Запустить» в чате бота и прикрепи чек фото или файлом. Ержан проверит оплату; после подтверждения тариф включится автоматически.'}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={botReceiptLink(paymentRequest.id)} target="_blank" rel="noopener noreferrer" className={`${linkStyle} bg-accent-500 text-white hover:bg-accent-400`} onClick={event => openExternal(event, true)}><Send size={17} aria-hidden="true" />{paymentRequest.receiptReceived ? 'Отправить другой чек' : 'Отправить чек боту'}</a>
            <Button variant="secondary" disabled={refreshing} onClick={() => { void refresh(); }}><RefreshCw size={16} aria-hidden="true" />{refreshing ? 'Обновляем…' : 'Обновить статус'}</Button>
            {notificationFailed && <Button variant="secondary" disabled={submitting || !canRequest} onClick={() => { void submitPayment(paymentRequest.plan); }}>{submitting ? 'Отправляем…' : 'Повторить уведомление'}</Button>}
          </div>
          <p className="mt-3 text-xs text-white/40">Полученный чек и заявка ещё не означают, что оплата подтверждена.</p>
        </> : paymentRequest.status === 'approved' ? <p className="mt-4 text-sm leading-relaxed text-white/65">Ержан подтвердил оплату. Действующий тариф и дата окончания доступа показаны сверху.</p>
          : <p className="mt-4 text-sm leading-relaxed text-white/65">Ержан не подтвердил эту оплату. Если деньги были отправлены, напиши <a className="text-accent-400 underline" href={`https://t.me/${PAYMENT_CONTACT}`} target="_blank" rel="noopener noreferrer" onClick={event => openExternal(event, true)}>@{PAYMENT_CONTACT}</a> и приложи чек. Повторно платить не нужно.</p>}
        <p className="mt-4 break-all text-[11px] text-white/35">Номер заявки: {paymentRequest.id}</p>
      </section>}

      {needsFallback && <aside className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 text-sm leading-relaxed">
        <p className="font-medium text-white">{billingStatus === 'auth_required' ? 'Нужно обновить вход' : 'Подтверждение оплаты пока недоступно'}</p>
        <p className="mt-2 text-white/65">{billingError || 'Не удалось получить статус. Попробуй обновить его чуть позже.'}</p>
        <p className="mt-2 text-white/65">Если уже оплатил, отправь чек и свой Telegram ID <a href={`https://t.me/${PAYMENT_CONTACT}`} target="_blank" rel="noopener noreferrer" className="text-accent-400 underline" onClick={event => openExternal(event, true)}>@{PAYMENT_CONTACT}</a>. Действующий доступ по коду сохранится до окончания его срока.</p>
        <Button variant="secondary" size="sm" className="mt-3" disabled={refreshing} onClick={() => { void refresh(); }}>{refreshing ? 'Обновляем…' : 'Обновить статус'}</Button>
      </aside>}

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
      <p className="text-center text-xs leading-relaxed text-white/50">Один платёж — {ACCESS_DAYS} дней доступа после подтверждения владельцем. Автосписаний нет. Это личное рабочее пространство; совместный доступ сотрудников не входит в тарифы.</p>

      {checkoutPlan && selectedPlan && <section className="overflow-hidden rounded-2xl border border-border bg-bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:p-6">
          <div><h2 ref={checkout} tabIndex={-1} className="scroll-mt-24 text-lg font-bold text-white focus:outline-none">Подключаем {selectedPlan.name}</h2><p className="mt-1 text-sm text-white/55">{price(selectedPlan.price)} · {ACCESS_DAYS} дней · ручное подтверждение</p></div>
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Закрыть</Button>
        </div>
        {!canPay ? <div className="p-5 text-sm leading-relaxed text-white/70 sm:p-6">{auth.mode === 'demo' ? 'Это просмотр тарифов в демо. Для покупки открой своё рабочее пространство через профиль BizBox в Telegram.' : 'Не удалось получить твой Telegram ID. Открой BizBox через кнопку приложения в профиле бота.'}</div>
          : alreadyIncluded ? <div className="flex items-center gap-3 p-6 text-emerald-400"><CheckCircle2 aria-hidden="true" />Этот тариф уже доступен. Повторно платить не нужно.</div>
          : <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-semibold text-white"><CreditCard size={18} className="text-accent-400" aria-hidden="true" />1. Оплати через Kaspi</h3>
              <p className="text-sm leading-relaxed text-white/60">Кнопка откроет страницу Kaspi. Перед подтверждением проверь сумму <strong className="text-white">{price(selectedPlan.price)}</strong> и реквизиты получателя.</p>
              {subscriptionAccess && <p className="text-xs leading-relaxed text-amber-400">У тебя ещё действует {PLANS[currentPlan].name}. Перед оплатой согласуй с Ержаном переход: оставшиеся дни не переносятся автоматически.</p>}
              {pendingRequest ? <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-300">Заявка уже создана. Прикрепи чек боту и дождись проверки — повторно платить не нужно.</p> :
                <a href={KASPI_URL} target="_blank" rel="noopener noreferrer" className={`${linkStyle} w-full bg-red-500 text-white hover:bg-red-400`} onClick={event => openExternal(event)}>Оплатить {price(selectedPlan.price)}<ArrowUpRight size={18} aria-hidden="true" /></a>}
              <div className="rounded-xl border border-border bg-bg-base/70 p-4">
                <p className="text-xs text-white/50">Или перевод по номеру телефона</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="select-text text-lg font-semibold text-white">{PAYMENT_PHONE}</span><Button variant="ghost" size="icon" onClick={copyPhone} aria-label="Скопировать номер для оплаты"><Copy size={17} aria-hidden="true" /></Button></div>
                <p className="text-sm text-white/70">{PAYMENT_RECIPIENT}</p>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-semibold text-white"><Send size={18} className="text-accent-400" aria-hidden="true" />2. Сообщи об оплате</h3>
              <p className="text-sm leading-relaxed text-white/60">После перевода нажми «Я оплатил», затем отправь чек боту. Ержан проверит поступление денег и подтвердит оплату — тариф включится без кода.</p>
              {pendingRequest ? <>
                <a href={botReceiptLink(pendingRequest.id)} target="_blank" rel="noopener noreferrer" className={`${linkStyle} w-full bg-accent-500 text-white hover:bg-accent-400`} onClick={event => openExternal(event, true)}><Send size={17} aria-hidden="true" />Отправить чек боту</a>
                <p className="flex items-center gap-2 text-xs text-amber-300"><Clock size={15} aria-hidden="true" />{pendingRequest.receiptReceived ? 'Чек получен, ожидаем решения' : 'Заявка сохранена, осталось прикрепить чек'}</p>
              </> : <Button size="lg" className="w-full" disabled={!canRequest || submitting} onClick={() => { void submitPayment(checkoutPlan); }}>{submitting ? 'Отправляем заявку…' : 'Я оплатил'}</Button>}
              <p className="text-xs leading-relaxed text-white/50">Кнопка сообщает о переводе. Она не проверяет банк и сама по себе не включает тариф.</p>
              {needsFallback && <a href={receiptLink(checkoutPlan, pendingRequest?.id || 'без заявки', userId)} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-accent-400 underline underline-offset-4" onClick={event => openExternal(event, true)}>Отправить чек Ержану напрямую</a>}
              <p className="text-xs text-white/50">Твой Telegram ID: <span className="select-all text-white/80">{userId}</span></p>
            </div>
          </div>}
      </section>}

      <details className="rounded-2xl border border-border bg-bg-card p-5 sm:p-6">
        <summary className="cursor-pointer text-sm font-semibold text-white">У меня есть старый код доступа</summary>
        <div className="mt-5">
          <p className="mb-4 flex items-start gap-2 text-sm leading-relaxed text-white/60"><KeyRound size={18} className="mt-0.5 shrink-0 text-accent-400" aria-hidden="true" />Ранее выданные коды продолжают работать. Вставь код из ответа Ержана — он будет сохранён для твоего аккаунта.</p>
          {userId && <p className="mb-3 text-xs text-white/50">Твой Telegram ID: <span className="select-all text-white/80">{userId}</span></p>}
          <form onSubmit={event => { event.preventDefault(); void activate(); }} className="space-y-3">
            <label htmlFor="access-code" className="text-xs font-medium text-white/60">Код доступа</label>
            <textarea id="access-code" value={accessCode} onChange={event => setAccessCode(event.target.value)} maxLength={4096} rows={3} autoCapitalize="off" autoComplete="off" spellCheck={false} placeholder="bb1.…" disabled={!canPay || activating} className="block w-full resize-y rounded-xl border border-border bg-bg-base px-4 py-3 text-sm text-white outline-none focus:border-accent-500 disabled:opacity-50" />
            <Button type="submit" disabled={!canPay || !accessCode.trim() || activating}>{activating ? 'Сохраняем код…' : 'Проверить и сохранить код'}</Button>
          </form>
          {auth.mode === 'demo' && <p className="mt-3 text-xs text-white/50">В демо оплата и активация отключены.</p>}
        </div>
      </details>
      <p className="text-center text-xs text-white/50">Есть вопрос по оплате или продлению? <a href={`https://t.me/${PAYMENT_CONTACT}`} target="_blank" rel="noopener noreferrer" className="text-accent-400 underline underline-offset-4" onClick={event => openExternal(event, true)}>Напиши Ержану</a></p>
    </div>
  );
}
