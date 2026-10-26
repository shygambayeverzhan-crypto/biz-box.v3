import { useCallback, useEffect, useRef, useState } from 'react';
import { Gift, Copy, Share2, Wallet, RefreshCw, Users } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getTelegram } from '@/lib/telegram';
import { serviceRequest, ServiceError, type ReferralState } from '@/lib/serviceApi';
import { formatCurrency } from '@/lib/format';

export function ReferralsPage() {
  const {auth,refreshBilling} = useApp();
  const [data,setData]=useState<ReferralState|null>(null);
  const [error,setError]=useState(''); const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(false); const [paying,setPaying]=useState(false);
  const [plan,setPlan]=useState<'business'|'pro'|null>(null);
  const purchaseKey=`bizbox_wallet_pending_${getTelegram()?.initDataUnsafe?.user?.id || 'none'}`;
  const purchase=useRef<{id:string;plan:string}|null>((()=>{try{const p=JSON.parse(localStorage.getItem(purchaseKey)||'null');return p&&typeof p.id==='string'&&/^[a-f0-9-]{36}$/.test(p.id)&&['business','pro'].includes(p.plan)?p:null;}catch{return null;}})());
  const active=useRef(true);
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    if(auth.mode!=='telegram')return;
    setLoading(true);setError('');
    try {const next=await serviceRequest<ReferralState>('referral_state',{},signal);if(active.current)setData(next);}
    catch(e){if(active.current&&!signal?.aborted)setError(e instanceof Error?e.message:'Не удалось загрузить баланс.');}
    finally{if(active.current&&!signal?.aborted)setLoading(false);}
  },[auth.mode]);
  useEffect(()=>{active.current=true;const controller=new AbortController();void refresh(controller.signal);return()=>{active.current=false;controller.abort();};},[refresh]);
  const link=data?`https://t.me/Biznowbox_bot?startapp=ref_${data.code}`:'';
  const copy=async()=>{try{await navigator.clipboard.writeText(link);setNotice('Ссылка скопирована');}catch{setNotice('Выдели и скопируй ссылку ниже.');}};
  const share=()=>{
    const url=`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Веди финансы, клиентов и задачи в BizBox. Присоединяйся по моей ссылке!')}`;
    const app=getTelegram();if(app?.openTelegramLink)app.openTelegramLink(url);else window.open(url,'_blank','noopener,noreferrer');
  };
  const redeem=async()=>{
    if(!plan||paying)return;
    setPaying(true);setError('');setNotice('');
    if(purchase.current&&purchase.current.plan!==plan){setError('Предыдущая оплата ещё не проверена. Повтори её для того же тарифа: повторного списания не будет.');setPaying(false);return;}
    if(!purchase.current)purchase.current={id:crypto.randomUUID(),plan};
    try{
      // Keep the same payment ID across reloads after an ambiguous network failure.
      try { localStorage.setItem(purchaseKey,JSON.stringify(purchase.current)); }
      catch { throw new Error('Разреши сохранение данных в приложении, чтобы безопасно оплатить бонусами.'); }
      await serviceRequest('wallet_redeem',{plan,requestId:purchase.current.id});
      if(!active.current)return;
      try { localStorage.removeItem(purchaseKey); } catch { /* The server retains the idempotent result. */ }
      purchase.current=null;
      setPlan(null);setNotice('Тариф оплачен бонусами и подключён на 30 дней.');
      await Promise.all([refresh(),refreshBilling()]);
    }catch(e){
      if(e instanceof ServiceError && e.status===400){
        try { localStorage.removeItem(purchaseKey); } catch { /* A rejected purchase made no debit. */ }
        purchase.current=null;
      }
      if(active.current)setError(e instanceof Error?e.message:'Не удалось оплатить. Обнови баланс.');
    }
    finally{if(active.current)setPaying(false);}
  };
  return <div className="space-y-5 max-w-4xl mx-auto">
    <PageHeader title="Приглашай и зарабатывай" subtitle="10% от первой оплаты друга — на твой баланс BizBox"/>
    <Card className="p-6 sm:p-8 bg-gradient-to-br from-accent-500/15 to-violet-500/10">
      <Gift className="text-accent-300 mb-4" size={30}/><h2 className="text-xl font-semibold">Хорошие инструменты хочется советовать</h2>
      <p className="text-sm text-white/65 mt-3 leading-relaxed">Друг впервые открывает BizBox по твоей ссылке и оплачивает тариф. После подтверждения оплаты 10% автоматически поступят тебе. Например, за PRO — {formatCurrency(1499)}.</p>
      {auth.mode==='demo'?<p className="mt-5 text-sm text-amber-300">Персональная ссылка и настоящий баланс доступны при входе через Telegram.</p>:<>
        <div className="flex flex-wrap gap-3 mt-5"><Button disabled={!data} onClick={share}><Share2 size={16}/>Пригласить друга</Button><Button variant="secondary" disabled={!data} onClick={()=>void copy()}><Copy size={16}/>Копировать ссылку</Button></div>
        {link&&<input aria-label="Реферальная ссылка" readOnly value={link} onFocus={e=>e.currentTarget.select()} className="w-full mt-4 bg-transparent text-xs text-white/60 py-2 border-b border-white/10"/>}
      </>}
    </Card>
    {notice&&<p role="status" className="text-success-400 text-sm">{notice}</p>}
    {error&&<p role="alert" className="text-danger-400 text-sm">{error}</p>}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[[Wallet,'Баланс',data?formatCurrency(data.balance):'—'],[Gift,'Заработано',data?formatCurrency(data.earned):'—'],[Users,'Приглашено',data?.invited??'—'],[Users,'Оплатили',data?.paid??'—']].map(([Icon,label,value])=>{const Symbol=Icon as typeof Wallet;return <Card key={String(label)} className="p-4"><Symbol size={18} className="text-accent-300 mb-3"/><p className="text-xs text-white/55">{String(label)}</p><p className="text-lg font-semibold mt-1">{String(value)}</p></Card>;})}
    </div>
    {auth.mode==='telegram'&&<Button variant="ghost" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={15} className={loading?'animate-spin':''}/>{loading?'Обновляем…':'Обновить баланс'}</Button>}
    <Card className="p-5"><h2 className="font-semibold">Потратить бонусы</h2><p className="text-sm text-white/60 mt-2">Оплати 30 дней тарифа целиком с внутреннего баланса. Вывод денег и частичная оплата пока недоступны.</p>
      <div className="flex flex-wrap gap-3 mt-4"><Button variant="secondary" disabled={!data||data.balance<4990} onClick={()=>setPlan('business')}>BUSINESS · {formatCurrency(4990)}</Button><Button variant="secondary" disabled={!data||data.balance<14990} onClick={()=>setPlan('pro')}>PRO · {formatCurrency(14990)}</Button></div>
    </Card>
    <Card className="p-5"><h2 className="font-semibold">История баланса</h2>{!data?.history.length?<p className="text-sm text-white/50 mt-3">Здесь появятся начисления и оплаты бонусами.</p>:<ul className="divide-y divide-white/10 mt-3">{data.history.map(entry=><li key={entry.id} className="py-3 flex justify-between gap-3 text-sm"><div><p>{entry.kind==='referral_bonus'?'Бонус за первую оплату':'Оплата тарифа'}</p><p className="text-xs text-white/45 mt-1">{new Date(entry.date).toLocaleDateString('ru-RU')}</p></div><span className={entry.amount>0?'text-success-400':'text-white/80'}>{entry.amount>0?'+':''}{formatCurrency(entry.amount)}</span></li>)}</ul>}</Card>
    {!!data?.invitations.length&&<Card className="p-5"><h2 className="font-semibold">Приглашения</h2><ul className="divide-y divide-white/10 mt-3">{data.invitations.map((entry,index)=><li key={`${entry.date}:${index}`} className="py-3 flex justify-between gap-3 text-sm"><span>Друг · {new Date(entry.date).toLocaleDateString('ru-RU')}</span><span className="text-white/60">{entry.status==='rewarded'?`Начислено ${formatCurrency(entry.bonus)}`:'Ждём первую оплату'}</span></li>)}</ul></Card>}
    <p className="text-xs text-white/45 leading-relaxed">Бонус начисляется один раз за нового приглашённого после подтверждения первой оплаты через Kaspi. Самоприглашения, повторные оплаты и оплаты бонусами не учитываются. В истории отображаются последние 50 записей.</p>
    <Modal open={Boolean(plan)} onClose={()=>{if(!paying)setPlan(null);}} title="Оплатить бонусами">
      <p className="text-sm text-white/70 mb-5">Списать {formatCurrency(plan==='pro'?14990:4990)} с внутреннего баланса и подключить {plan?.toUpperCase()} на 30 дней?</p>
      <Button disabled={paying} onClick={()=>void redeem()}>{paying?'Подключаем…':'Подтвердить оплату'}</Button>
      {error&&<p role="alert" className="text-danger-400 text-sm mt-3">{error}</p>}
    </Modal>
  </div>;
}
