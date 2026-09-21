import React, { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Check, Copy, Gift, Sparkles, Users, Zap, ShieldCheck, ExternalLink, Clock, ArrowRight } from 'lucide-react';
import type { UserProfile } from '@/types';

export const SubscriptionPage: React.FC = () => {
  const { state, referral, applyReferralCode, setPlan } = useApp();
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  const currentPlan = (state.user?.plan || 'free').toLowerCase();
  const KASPI_PAY_LINK = 'https://pay.kaspi.kz/pay/6hpgsuja';

  const plans: Array<{
    id: UserProfile['plan'];
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    popular?: boolean;
  }> = [
    {
      id: 'free',
      name: 'Старт (Free)',
      price: '0 ₸',
      period: 'навсегда',
      description: 'Базовый функционал для ознакомления',
      features: [
        'Учет доходов и расходов',
        'До 10 клиентов в базе',
        'Задачи и календарь',
      ],
    },
    {
      id: 'pro',
      name: 'Бизнес PRO',
      price: '9 900 ₸',
      period: 'в месяц',
      description: 'Полный набор инструментов с AI-аналитикой',
      popular: true,
      features: [
        'Безлимитный учет и отчеты',
        'Документы и договоры',
        'Маркетплейс специалистов',
        'Управление сотрудниками',
        'Приоритетная поддержка',
      ],
    },
    {
      id: 'enterprise',
      name: 'Корпорация',
      price: '29 900 ₸',
      period: 'в месяц',
      description: 'Максимальные мощности и интеграции',
      features: [
        'Всё из тарифа PRO',
        'Выделенный AI-агент',
        'Персональный менеджер',
        'API и Кастомные отчеты',
      ],
    },
  ];

  const handleCopy = () => {
    const link = `${window.location.origin}?ref=${referral.code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyCode = (e: React.FormEvent) => {
    e.preventDefault();
    const res = applyReferralCode(inputCode);
    setMessage({ text: res.message, isError: !res.ok });
    if (res.ok) {
      setInputCode('');
      setPendingPlan(null);
    }
  };

  const handlePayClick = (planId: UserProfile['plan']) => {
    if (planId === 'free') {
      setPlan('free');
      setPendingPlan(null);
      return;
    }
    // Открываем Kaspi Pay
    window.open(KASPI_PAY_LINK, '_blank');
    // Ставим статус "Ожидает подтверждения", но НЕ МЕНЯЕМ тариф!
    setPendingPlan(planId);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Управление подпиской
        </h1>
        <p className="text-sm text-gray-500 max-w-xl mx-auto">
          Оплатите через Kaspi Pay или введите промокод для активации тарифного плана.
        </p>
      </div>

      {/* Карточки Тарифов */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((p) => {
          const isCurrent = currentPlan === p.id;
          const isPending = pendingPlan === p.id;
          const isPaid = p.id !== 'free';

          return (
            <div
              key={p.id}
              className={`relative flex flex-col justify-between p-6 rounded-2xl bg-white dark:bg-gray-800 border-2 transition-all shadow-sm ${
                p.popular
                  ? 'border-indigo-600 shadow-indigo-100 dark:shadow-none'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full flex items-center gap-1 shadow">
                  <Sparkles className="w-3 h-3" /> Популярный
                </span>
              )}

              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{p.name}</h3>
                <p className="text-xs text-gray-500">{p.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{p.price}</span>
                  <span className="text-xs text-gray-500">/{p.period}</span>
                </div>

                <ul className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                  {p.features.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 space-y-2">
                <button
                  onClick={() => handlePayClick(p.id)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                      : isPending
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : isPaid
                      ? 'bg-red-600 text-white hover:bg-red-700 shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {isCurrent ? (
                    'Текущий тариф'
                  ) : isPending ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Ожидание оплаты в Kaspi...</span>
                    </>
                  ) : isPaid ? (
                    <>
                      <span>Оплатить через Kaspi</span>
                      <ExternalLink className="w-4 h-4" />
                    </>
                  ) : (
                    'Перейти на Free'
                  )}
                </button>

                {isPending && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
                    Оплатите в Kaspi. Проверка занимает до 15 мин. Или введите промокод ниже.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Активация промокода */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-indigo-700/50 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
              <Gift className="w-4 h-4 text-amber-400" />
              <span>Мгновенная активация</span>
            </div>
            <h2 className="text-xl font-bold">Активация по промокоду</h2>
            <p className="text-indigo-200 text-xs max-w-xl">
              Если у вас есть промокод от администратора или партнеров, введите его для моментального снятия ограничений.
            </p>
          </div>

          <div className="flex gap-4 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10 shrink-0">
            <div className="text-center px-2">
              <div className="flex items-center justify-center gap-1 text-[11px] text-indigo-200">
                <Users className="w-3 h-3" /> Рефералов
              </div>
              <div className="text-base font-extrabold mt-0.5">{referral.invitedCount} чел.</div>
            </div>
            <div className="w-px bg-indigo-700/50" />
            <div className="text-center px-2">
              <div className="flex items-center justify-center gap-1 text-[11px] text-indigo-200">
                <Zap className="w-3 h-3 text-amber-400" /> Бонусы
              </div>
              <div className="text-base font-extrabold mt-0.5 text-amber-400">{referral.bonusEarned} ₸</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">Ваша ссылка</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}?ref=${referral.code}`}
                className="w-full bg-white/10 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="bg-white text-indigo-900 font-semibold px-3 py-2 rounded-xl text-xs hover:bg-indigo-50 transition flex items-center gap-1 shrink-0"
              >
                {copied ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Готово!' : 'Копия'}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">Ввести промокод</label>
            <form onSubmit={handleApplyCode} className="flex gap-2">
              <input
                type="text"
                placeholder="Например: HACKALEM"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="w-full bg-white/10 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-indigo-300/50"
              />
              <button
                type="submit"
                className="bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded-xl text-xs hover:bg-amber-300 transition shrink-0 flex items-center gap-1"
              >
                <span>Активировать</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
            {message && (
              <p className={`text-xs mt-1 ${message.isError ? 'text-rose-300' : 'text-emerald-300 font-medium'}`}>
                {message.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
