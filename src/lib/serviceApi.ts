import { getTelegram } from './telegram';

export class ServiceError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function serviceRequest<T>(action: string, data: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const app = getTelegram();
  const initData = app?.initData;
  const identity = app?.initDataUnsafe?.user?.id;
  if (!initData) throw new Error('Открой BizBox через профиль бота в Telegram, чтобы воспользоваться этой функцией.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  if (signal?.aborted) controller.abort();
  const timeout = window.setTimeout(abort, action === 'assistant' ? 58_000 : 20_000);
  try {
    const response = await fetch('https://biz-box-v3.vercel.app/api/bizbox', {
      method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...data,action,initData}),signal:controller.signal,
    });
    if (getTelegram()?.initData !== initData || getTelegram()?.initDataUnsafe?.user?.id !== identity) throw new Error('Аккаунт изменился. Открой приложение заново.');
    const result = await response.json();
    if (!response.ok) throw new ServiceError(typeof result.error === 'string' ? result.error : 'Сервис временно недоступен. Попробуй позже.', response.status);
    return result as T;
  } catch (e) {
    if (signal?.aborted) throw new DOMException('Отменено','AbortError');
    if (controller.signal.aborted) throw new Error('Ответ задерживается. Обнови статус перед повторной попыткой.');
    throw e instanceof Error ? e : new Error('Не удалось связаться с сервисом.');
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort',abort); }
}

export interface ReferralState {
  code:string; balance:number; earned:number; invited:number; paid:number;
  history:{id:string;amount:number;kind:'referral_bonus'|'subscription';date:string}[];
  invitations:{date:string;status:'registered'|'rewarded';bonus:number}[];
}
