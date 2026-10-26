import type { AppState, Task, Transaction } from '../types';
export type AssistantAction =
  | {kind:'task';title:string;description:string;dueDate:string;priority:Task['priority']}
  | {kind:'transaction';type:'income'|'expense';amount:number;date:string;category:string;description:string};
export interface AssistantProposal {id:string;action:AssistantAction}
export interface AssistantReply {text:string;proposals:AssistantProposal[];sources:string[];remaining?:number}
const validDate=(x:unknown):x is string=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const validText=(x:unknown,max:number)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
export function isAssistantProposal(value:unknown):value is AssistantProposal {
  if(!value||typeof value!=='object')return false;
  const p=value as AssistantProposal;
  if(typeof p.id!=='string'||! /^[a-f0-9-]{36}$/.test(p.id)||!p.action||typeof p.action!=='object')return false;
  const a=p.action;
  if(a.kind==='task')return validText(a.title,160)&&typeof a.description==='string'&&a.description.length<=500&&validDate(a.dueDate)&&['low','medium','high'].includes(a.priority);
  return a.kind==='transaction'&&['income','expense'].includes(a.type)&&Number.isFinite(a.amount)&&a.amount>0&&a.amount<=1e12&&validDate(a.date)&&validText(a.category,80)&&validText(a.description,160);
}
/** Stable proposal IDs make retrying an interrupted save idempotent. */
export function applyProposal(state:AppState,proposal:AssistantProposal):AppState {
  if(!isAssistantProposal(proposal))throw new Error('Предложение ИИ содержит некорректные данные. Повтори запрос.');
  const id=`ai_${proposal.id}`,a=proposal.action;
  if(a.kind==='task') {
    if(state.tasks.some(t=>t.id===id))return state;
    const task:Task={id,title:a.title,description:a.description,dueDate:a.dueDate,priority:a.priority,completed:false,status:'new'};
    return {...state,tasks:[task,...state.tasks]};
  }
  if(state.transactions.some(t=>t.id===id))return state;
  const transaction:Transaction={id,type:a.type,amount:a.amount,date:a.date,category:a.category,description:a.description,status:'completed'};
  return {...state,transactions:[transaction,...state.transactions]};
}
export function assistantContext(state:AppState,today:string) {
  return {
    today,truncated:state.transactions.length>1000||state.tasks.length>300||state.clients.length>200,
    transactions:state.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,1000).map(({type,amount,date,status,category})=>({type,amount,date:date.slice(0,10),status,category:category.slice(0,80)})),
    tasks:state.tasks.slice().sort((a,b)=>Number(a.completed)-Number(b.completed)||a.dueDate.localeCompare(b.dueDate)).slice(0,300).map(({title,dueDate,status,priority,completed})=>({title:title.slice(0,160),dueDate,status,priority,completed})),
    clients:state.clients.slice(0,200).map(({name,status,dealValue})=>({name:name.slice(0,100),status,dealValue})),
  };
}
