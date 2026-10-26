import type { UserProfile } from '@/types';

export type PaidPlan = 'business' | 'pro';
export const KASPI_URL = 'https://pay.kaspi.kz/pay/6hpgsuja';
export const PAYMENT_PHONE = '+7 706 536 0812';
export const PAYMENT_RECIPIENT = 'Ержан Ш.';
export const PAYMENT_CONTACT = 'shygambayevtg';
export const ACCESS_DAYS = 30;

export const PLANS: Record<UserProfile['plan'], {
  name: string; price: number; description: string; features: string[];
}> = {
  free: {
    name: 'FREE', price: 0, description: 'Навести порядок в ежедневных делах',
    features: ['Учёт доходов и расходов', 'Клиенты, заметки и история общения', 'Задачи и календарь', 'Сохранение в Telegram и JSON-копия'],
  },
  business: {
    name: 'BUSINESS', price: 4990, description: 'Держать финансы и документы рядом',
    features: ['Всё, что входит в FREE', 'Реестр счетов, актов и договоров', 'Карточки документов с суммой и клиентом', 'Ручной учёт статусов документов'],
  },
  pro: {
    name: 'PRO', price: 14990, description: 'Добавить учёт сотрудников',
    features: ['Всё, что входит в BUSINESS', 'Карточки сотрудников и контакты', 'Учёт окладов и отделов', 'Плановые даты выплат'],
  },
};

export function receiptLink(plan: PaidPlan, requestId: string, userId: string): string {
  const message = `Здравствуйте! Оплата BizBox ${PLANS[plan].name}: ${PLANS[plan].price.toLocaleString('ru-RU')} ₸ за ${ACCESS_DAYS} дней.\nЗаявка: ${requestId}\nTelegram ID: ${userId}\nПрикрепляю чек. После проверки пришлите, пожалуйста, код доступа.`;
  return `https://t.me/${PAYMENT_CONTACT}?text=${encodeURIComponent(message)}`;
}
