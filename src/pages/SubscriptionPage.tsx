import React, { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Check, Copy, Gift, Sparkles, Users, Zap, ShieldCheck, ExternalLink } from 'lucide-react';
import type { UserProfile } from '@/types';

export const SubscriptionPage: React.FC = () => {
  const { state, setPlan, referral, applyReferralCode } = useApp();
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const currentPlan = state.user?.plan || 'free';

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
      description: 'Базовый функционал для ознакомления и небольших проектов',
      features: [
        'Учет доходов и расходов',
        'До 10 клиентов в базе',
        'Базовые шаблоны документов',
        '1 пользователь',
      ],
    },
    {
      id: 'pro',
      name: 'Бизнес PRO',
      price: '9 900 ₸',
      period: 'в месяц',
      description: 'Полный набор инструментов с AI-ассистентом для быстрого роста',
      popular: true,
      features: [
        'Безлимитный финансовый учет',
        'AI-аналитика и отчеты',
        'Маркетплейс специалистов',
        'Автогенерация документов',
        'До 5 сотрудников',
        'Приоритетная поддержка',
      ],
    },
    {
      id: 'enterprise',
      name: 'Корпорация',
      price: '29 900 ₸',
      period: 'в месяц',
      description: 'Максимальные мощности и индивидуальные интеграции',
      features: [
        'Всё, что есть в PRO',
        'Неограниченное число сотрудников',
        'Выделенный AI-агент под бизнес',
        'Персональный менеджер 24/7',
        'API и пользовательские интеграции',
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
    if (res.ok) setInputCode('');
  };

  const handleSelectPlan = (planId: UserProfile['plan']) => {
    if (planId !== 'free') {
      // Открываем Kaspi Pay в новой вкладке для проведения оплаты
      window.open(KASPI_PAY_LINK, '_blank');
    }
    // Активируем выбранный план в приложении
    setPlan(planId);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      {/* Заголовок */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Управление подпиской и бонусами
        </h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Выберите подходящий тариф для вашего бизнеса или используйте реферальную программу, чтобы получать бонусы и бесплатный доступ.
        </p>
      </div>

      {/* Карточки Тарифов */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((p) => {
          const isCurrent = currentPlan === p.id;
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
                  <Sparkles className="w-3 h-3" /> Популярный выбор
                </span>
              )}

              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{p.name}</h3>
                <p className="text-sm text-gray-500">{p.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{p.price}</span>
                  <span className="text-sm text-gray-500">/{p.period}</span>
                </div>

                <ul className="space-y-2.5 pt-4 border-t border-gray-100 dark:border-gray-700">
                  {p.features.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleSelectPlan(p.id)}
                disabled={isCurrent}
                className={`w-full mt-6 py-2.5 px-4 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                  isCurrent
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                    : isPaid
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200'
                }`}
              >
                {isCurrent ? (
                  'Текущий тариф'
                ) : isPaid ? (
                  <>
                    <span>Оплатить через Kaspi Pay</span>
                    <ExternalLink className="w-4 h-4" />
                  </>
                ) : (
                  'Перейти на бесплатный'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Реферальная программа */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-8 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-indigo-700/50 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
              <Gift className="w-5 h-5 text-amber-400" />
              <span>Реферальная программа BIZBOX</span>
            </div>
            <h2 className="text-2xl font-bold">Приглашайте друзей и получайте бонусы</h2>
            <p className="text-indigo-200 text-sm max-w-xl">
              Поделитесь ссылкой с коллегами. За каждого зарегистрированного пользователя вы получаете <strong>+500 ₸</strong> на бонусный баланс, а ваш друг — скидку на тариф PRO.
            </p>
          </div>

          {/* Статистика */}
          <div className="flex gap-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 shrink-0">
            <div className="text-center px-3">
              <div className="flex items-center justify-center gap-1 text-xs text-indigo-200">
                <Users className="w-3.5 h-3.5" /> Приглашено
              </div>
              <div className="text-xl font-extrabold mt-1">{referral.invitedCount} чел.</div>
            </div>
            <div className="w-px bg-indigo-700/50" />
            <div className="text-center px-3">
              <div className="flex items-center justify-center gap-1 text-xs text-indigo-200">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Бонусы
              </div>
              <div className="text-xl font-extrabold mt-1 text-amber-400">{referral.bonusEarned} ₸</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Моя ссылка */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">
              Ваша реферальная ссылка
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}?ref=${referral.code}`}
                className="w-full bg-white/10 border border-indigo-500/30 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="bg-white text-indigo-900 font-semibold px-4 py-2 rounded-xl text-sm hover:bg-indigo-50 transition flex items-center gap-1.5 shrink-0"
              >
                {copied ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Скопировано!' : 'Копировать'}
              </button>
            </div>
          </div>

          {/* Ввод промокода */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">
              Есть промокод или код друга?
            </label>
            <form onSubmit={handleApplyCode} className="flex gap-2">
              <input
                type="text"
                placeholder="Введите код (например: HACKALEM)"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="w-full bg-white/10 border border-indigo-500/30 rounded-xl px-3.5 py-2 text-sm text-white placeholder-indigo-300 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded-xl text-sm hover:bg-amber-300 transition shrink-0"
              >
                Применить
              </button>
            </form>
            {message && (
              <p className={`text-xs mt-1 ${message.isError ? 'text-rose-300' : 'text-emerald-300'}`}>
                {message.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
