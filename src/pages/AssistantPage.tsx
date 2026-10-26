import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Square, Check, Plus, RotateCcw } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Input';
import { PageHeader } from '@/components/PageHeader';
import { serviceRequest } from '@/lib/serviceApi';
import { getTelegram } from '@/lib/telegram';
import { assistantContext, isAssistantProposal, type AssistantReply, type AssistantProposal } from '@/lib/assistantActions';
import { formatCurrency, localDateValue } from '@/lib/format';

interface Message {id:string;role:'user'|'assistant';content:string;proposals?:AssistantProposal[];sources?:string[]}
const suggestions=['Разбери прибыль и расходы за этот месяц','Какие задачи просрочены и с чего начать?','Каким клиентам стоит уделить внимание?'];
export function AssistantPage() {
  const {state,auth,applyAssistantProposal,syncConflict}=useApp();
  const identity=auth.mode==='telegram'?String(getTelegram()?.initDataUnsafe?.user?.id||''):'';
  const historyKey=identity?`bizbox_ai_chat_v1_${identity}`:'';
  const [messages,setMessages]=useState<Message[]>(()=>{
    if(!historyKey)return[];
    try{const saved=JSON.parse(sessionStorage.getItem(historyKey)||'[]');return Array.isArray(saved)?saved.filter(m=>m&&typeof m.id==='string'&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-24).map(m=>({...m,proposals:Array.isArray(m.proposals)?m.proposals.filter(isAssistantProposal):[],sources:Array.isArray(m.sources)?m.sources.filter((s:unknown)=>typeof s==='string'):[]})):[];}catch{return[];}
  });
  const [input,setInput]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [remaining,setRemaining]=useState<number|null>(null);const [saving,setSaving]=useState<string|null>(null);
  const controller=useRef<AbortController|null>(null);const active=useRef(true);const bottom=useRef<HTMLDivElement>(null);
  const current=useRef({state,identity});current.current={state,identity};
  useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();};},[]);
  useEffect(()=>{try{if(historyKey)sessionStorage.setItem(historyKey,JSON.stringify(messages.slice(-24)));}catch{/* Chat can still work without session storage. */}},[messages,historyKey]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest',behavior:'auto'});},[messages,busy]);
  const send=async(value=input)=>{
    const question=value.trim();if(!question||busy)return;
    const submittedIdentity=identity;setInput('');setError('');setBusy(true);
    const next:Message={id:crypto.randomUUID(),role:'user',content:question};
    const history=messages.slice(-10).map(m=>({role:m.role,content:m.content.slice(0,2000)}));
    setMessages(items=>[...items,next].slice(-24));
    const request=new AbortController();controller.current=request;
    try{
      const result=await serviceRequest<AssistantReply>('assistant',{message:question,history,context:assistantContext(current.current.state,localDateValue())},request.signal);
      if(!active.current||current.current.identity!==submittedIdentity)return;
      if(typeof result.text!=='string'||!Array.isArray(result.proposals)||!result.proposals.every(isAssistantProposal))throw new Error('Получен неполный ответ. Повтори вопрос.');
      setMessages(items=>[...items,{id:crypto.randomUUID(),role:'assistant',content:result.text,proposals:result.proposals,sources:Array.isArray(result.sources)?result.sources.filter(s=>typeof s==='string'):[]}].slice(-24) as Message[]);
      setRemaining(typeof result.remaining==='number'?result.remaining:null);
    }catch(e){if(active.current){setInput(question);setError(request.signal.aborted?'Запрос остановлен. Записи не изменены.':e instanceof Error?e.message:'Не удалось получить ответ.');}}
    finally{if(active.current){setBusy(false);controller.current=null;}}
  };
  const apply=async(proposal:AssistantProposal)=>{
    if(saving)return;setSaving(proposal.id);setError('');
    try{
      await applyAssistantProposal(proposal);
      if(active.current)setMessages(items=>[...items,{id:crypto.randomUUID(),role:'user' as const,content:`Подтверждено и сохранено: ${proposal.action.kind==='task'?proposal.action.title:proposal.action.description}.`}].slice(-24));
    }catch(e){if(active.current)setError(e instanceof Error?e.message:'Не удалось сохранить запись.');}
    finally{if(active.current)setSaving(null);}
  };
  return <div className="max-w-3xl mx-auto space-y-5">
    <PageHeader title="ИИ-помощник" subtitle="Разбирается в твоём бизнесе. Помогает действовать."/>
    <Card className="p-5 bg-gradient-to-br from-violet-500/15 via-accent-500/10 to-transparent">
      <Sparkles className="text-accent-300 mb-3" size={26}/><p className="text-sm text-white/75 leading-relaxed">Могу объяснить прибыль, найти основные расходы, расставить приоритеты и подготовить задачу или финансовую запись. Новые записи добавляются только после твоего подтверждения.</p>
      <p className="text-xs text-white/45 mt-3">При отправке вопроса Google Gemini получает показатели, категории операций, названия и сроки задач, имена клиентов и суммы сделок. Телефоны, email и чеки не передаются. История хранится в этой вкладке.</p>
    </Card>
    {auth.mode==='demo'&&<p className="text-sm text-amber-300">Для настоящего ИИ войди через Telegram. В демо ответы не подменяются заготовками.</p>}
    {messages.length===0&&<div className="grid gap-2">{suggestions.map(s=><button key={s} disabled={auth.mode!=='telegram'} onClick={()=>void send(s)} className="liquid-control rounded-2xl text-left p-4 text-sm text-white/80 hover:text-white disabled:opacity-40">{s}</button>)}</div>}
    {messages.length>0&&<Button variant="ghost" size="sm" disabled={busy||Boolean(saving)} onClick={()=>{setMessages([]);setError('');}}><RotateCcw size={14}/>Новый разговор</Button>}
    <div role="log" aria-label="Разговор с ИИ" aria-live="polite" className="space-y-4">
      {messages.map(message=><div key={message.id} className={message.role==='user'?'ml-8 sm:ml-20':'mr-2'}>
        <div className={`rounded-3xl p-4 sm:p-5 ${message.role==='user'?'bg-accent-500/15 border border-accent-400/15':'liquid-panel'}`}>
          <p className="text-[10px] uppercase tracking-widest text-white/45 mb-2">{message.role==='user'?'Ты':'BizBox AI'}</p>
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          {!!message.sources?.length&&<p className="mt-3 text-xs text-accent-300/80">По данным: {message.sources.join(' · ')}</p>}
          {message.proposals?.filter(isAssistantProposal).map(proposal=>{
            const a=proposal.action;const exists=(a.kind==='task'?state.tasks:state.transactions).some(item=>item.id===`ai_${proposal.id}`);
            return <div key={proposal.id} className="liquid-inset rounded-2xl p-4 mt-4">
              <p className="font-semibold text-sm">{a.kind==='task'?a.title:`${a.type==='income'?'Доход':'Расход'} · ${formatCurrency(a.amount)}`}</p>
              <p className="text-xs text-white/65 mt-2">{a.kind==='task'?`${a.dueDate} · ${a.priority==='high'?'Высокий':a.priority==='low'?'Низкий':'Средний'} приоритет`:`${a.date} · ${a.category}`}</p>
              {a.description&&<p className="text-sm text-white/70 mt-2">{a.description}</p>}
              <Button size="sm" className="mt-3" disabled={Boolean(saving)||syncConflict||exists} onClick={()=>void apply(proposal)}>{exists?<><Check size={14}/>Добавлено в приложение</>:saving===proposal.id?'Сохраняем…':<><Plus size={14}/>Подтвердить и добавить</>}</Button>
            </div>;
          })}
        </div>
      </div>)}
      {busy&&<p role="status" className="text-sm text-accent-300 animate-pulse">Изучаю данные и готовлю ответ…</p>}
      <div ref={bottom}/>
    </div>
    {error&&<p role="alert" className="text-sm text-danger-400 whitespace-pre-wrap">{error}</p>}
    {syncConflict&&<p className="text-sm text-amber-300">Сначала выбери актуальную версию данных в уведомлении сверху. До этого новые записи из чата недоступны.</p>}
    <form onSubmit={e=>{e.preventDefault();void send();}} className="liquid-panel p-3 rounded-3xl space-y-3">
      <Textarea aria-label="Вопрос ИИ-помощнику" placeholder="Например: почему упала прибыль? Или: добавь расход 12 000 ₸ на рекламу сегодня" rows={3} maxLength={4000} value={input} onChange={e=>setInput(e.target.value)} disabled={auth.mode!=='telegram'}/>
      <div className="flex justify-between items-center gap-3"><p className="text-[11px] text-white/45">{remaining===null?'До 30 вопросов в сутки':`Осталось вопросов сегодня: ${remaining}`}</p>{busy?<Button type="button" variant="secondary" onClick={()=>controller.current?.abort()}><Square size={14}/>Остановить</Button>:<Button type="submit" disabled={!input.trim()||auth.mode!=='telegram'}><Send size={15}/>Отправить</Button>}</div>
    </form>
  </div>;
}
