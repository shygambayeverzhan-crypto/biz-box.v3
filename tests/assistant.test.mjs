import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { askAssistant, assistantConnection, financialSummary, sanitizeContext, validateProposal, executeTool } from '../server/assistant.mjs';
import { verifyInitData } from '../server/telegram.mjs';
import { assistantContext, applyProposal, isAssistantProposal } from '../src/lib/assistantActions.ts';
import { createNewUserState } from '../src/lib/seed.ts';

const context={today:'2026-10-26',transactions:[
  {type:'income',amount:50000,date:'2026-10-26',status:'completed',category:'Продажа'},
  {type:'expense',amount:33500,date:'2026-10-26',status:'completed',category:'Аренда'},
  {type:'transfer',amount:100000,date:'2026-10-26',status:'completed',category:'Перевод'},
  {type:'income',amount:900000,date:'2026-10-26',status:'pending',category:'Продажа'},
],tasks:[],clients:[]};
test('AI finance tools calculate from completed records and do not count transfers',()=>{
  const report=financialSummary(sanitizeContext(context));
  assert.equal(report.income,50000);assert.equal(report.expenses,33500);assert.equal(report.profit,16500);assert.equal(report.margin,33);assert.equal(report.pending,1);
  assert.equal(financialSummary(context,{startDate:'2026-02-30'}).error.length>0,true);
  assert.equal(financialSummary({...context,transactions:[]}).margin,null);
});
test('AI boundary strips contact data, arbitrary instructions and credentials',()=>{
  const safe=sanitizeContext({...context,token:'SECRET',clients:[{name:'Клиент',email:'private@example.test',phone:'PRIVATE',notes:['SECRET'],status:'active',dealValue:12000}],transactions:context.transactions.map(t=>({...t,description:'SECRET',receipt:'SECRET'}))});
  assert.equal(JSON.stringify(safe).includes('SECRET'),false);assert.equal(JSON.stringify(safe).includes('private@example'),false);
  assert.throws(()=>sanitizeContext({...context,transactions:[{...context.transactions[0],amount:Infinity}]}));
  assert.throws(()=>validateProposal({kind:'transaction',type:'income',amount:-1,date:context.today,category:'x',description:'x'}));
});
test('tool loop uses actual results, returns confirmation proposals and never writes records',async()=>{
  const original=JSON.stringify(context);let calls=0;
  const result=await askAssistant({context,message:'Прибыль? И добавь задачу проверить аренду завтра.',history:[]},{token:'test-token',fetcher:async(url,options)=>{
    const body=JSON.parse(options.body);calls++;
    assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer test-token');
    assert.equal(body.store,undefined);assert.equal(body.max_tokens,4096);assert.equal(body.reasoning_effort,'low');
    if(calls===1)return Response.json({choices:[{message:{role:'assistant',content:null,tool_calls:[
      {id:'c1',type:'function',function:{name:'financial_summary',arguments:'{}'},extra_content:{google:{thought_signature:'opaque-signature'}}},
      {id:'c2',type:'function',function:{name:'propose_task',arguments:JSON.stringify({title:'Проверить аренду',dueDate:'2026-10-27',priority:'medium'})}},
    ]}}]});
    assert.equal(body.messages.find(m=>m.tool_calls)?.tool_calls[0].extra_content.google.thought_signature,'opaque-signature');
    const output=JSON.parse(body.messages.find(m=>m.tool_call_id==='c1').content);
    assert.equal(output.profit,16500);
    return Response.json({choices:[{message:{content:'Прибыль 16 500 ₸. Подтверди задачу ниже.'}}]});
  }});
  assert.equal(calls,2);assert.equal(result.proposals.length,1);assert.equal(result.sources.length,1);assert.equal(JSON.stringify(context),original);
  assert.equal(isAssistantProposal(result.proposals[0]),true);
  assert.equal(JSON.stringify(result).includes('opaque-signature'),false);
});
test('unknown tools and malformed proposals are not executed',()=>{
  const proposals=[];
  assert.ok(executeTool('delete_everything',{},context,proposals).error);
  assert.ok(executeTool('propose_task',{title:'Bad',dueDate:'tomorrow',priority:'medium'},context,proposals).error);
  assert.equal(proposals.length,0);
});
test('AI provider access errors are honest and do not expose secrets or pretend success',async()=>{
  for(const [status,expected] of [[401,'ai_invalid_key'],[402,'ai_insufficient_funds'],[403,'ai_access_required'],[404,'ai_model_unavailable'],[429,'ai_quota_required'],[400,'ai_request_rejected'],[503,'ai_unavailable']]) {
    await assert.rejects(askAssistant({context,message:'Привет',history:[]},{token:'SECRET',fetcher:async()=>Response.json({error:{code:status,message:'SECRET'}},{status})}),e=>e.code===expected&&!e.message.includes('SECRET'));
  }
  await assert.rejects(askAssistant({context,message:'Привет',history:[]},{token:'SECRET',fetcher:async()=>Response.json({error:{details:[{reason:'API_KEY_INVALID'}]}},{status:400})}),e=>e.code==='ai_invalid_key');
});
test('Gemini configuration never sends an old OpenAI credential to Google',()=>{
  assert.equal(assistantConnection({OPENAI_API_KEY:'old-secret',BIZ_BOX_API_KEY_AI:'old-secret'}).token,undefined);
  assert.equal(assistantConnection({GEMINI_API_KEY:'google-key'}).token,'google-key');
  assert.equal(assistantConnection({GOOGLE_API_KEY:'google-key'}).token,'google-key');
  assert.equal(assistantConnection({GEMINI_MODEL:'gemini-3.5-flash-lite'}).model,'gemini-3.5-flash-lite');
});
test('confirmed AI proposals are applied once, including retry after failed sync',()=>{
  const p={id:'11111111-1111-4111-8111-111111111111',action:{kind:'task',title:'Позвонить',description:'',dueDate:'2026-10-27',priority:'medium'}};
  const s=createNewUserState('Test','');const once=applyProposal(s,p);assert.equal(once.tasks.length,s.tasks.length+1);assert.equal(applyProposal(once,p),once);
  assert.throws(()=>applyProposal(s,{...p,action:{...p.action,dueDate:'2026-02-30'}}));
  const packet=assistantContext({...s,clients:[{name:'Test',phone:'SECRET',email:'SECRET',status:'active',dealValue:0}]},'2026-10-26');
  assert.equal(JSON.stringify(packet).includes('SECRET'),false);
});
test('referral start parameter is taken only from HMAC-verified Telegram data',()=>{
  const token='123456:'+ 'a'.repeat(40),now=Date.now();
  const params=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:12345,first_name:'Test'}),start_param:'ref_'+ 'a'.repeat(32)});
  const secret=createHmac('sha256','WebAppData').update(token).digest();
  const signature=createHmac('sha256',secret).update([...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex');params.set('hash',signature);
  assert.equal(verifyInitData(params.toString(),token,now).startParam,'ref_'+'a'.repeat(32));
  params.set('start_param','ref_'+'b'.repeat(32));assert.throws(()=>verifyInitData(params.toString(),token,now));
});
