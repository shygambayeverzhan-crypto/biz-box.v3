import { HttpError, verifyInitData, verifyWebhookSecret, botApi, formatRequestMessage, requestKeyboard } from '../server/telegram.mjs';
import { billingStore, clientState } from '../server/billingStore.mjs';
import { askAssistant, sanitizeContext } from '../server/assistant.mjs';

const ADMIN_ID = '6575928505';
const APP_URL = 'https://biz-box-v3.vercel.app';
const WEBHOOK_URL = `${APP_URL}/api/bizbox?action=telegram`;
const ALLOWED_ORIGINS = new Set([APP_URL, 'https://biz-boxv3.vercel.app']);
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

function configured() {
  return Boolean(process.env.BIZBOX_BOT_TOKEN && process.env.BIZBOX_STORAGE_TOKEN
    && process.env.BIZBOX_STORAGE_URL && process.env.BIZBOX_WEBHOOK_SECRET);
}
function api(method, payload) { return botApi(method, payload, process.env.BIZBOX_BOT_TOKEN); }
function message(chatId, text, replyMarkup) {
  return api('sendMessage', { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}
const appKeyboard = { inline_keyboard: [[{ text: 'Открыть BizBox', web_app: { url: APP_URL } }]] };

function keyboard(request) {
  const buttons = requestKeyboard(request);
  if (request.receipt?.file_id) buttons.inline_keyboard.push([{ text: '📎 Показать чек', callback_data: `bb:receipt:${request.id}` }]);
  return buttons;
}

async function notifyAdmin(requestId) {
  const claim = await billingStore('claim_notification', { request_id: requestId });
  if (!claim.claimed) return Boolean(claim.request?.admin_message_id);
  let sent;
  try {
    sent = await message(ADMIN_ID, formatRequestMessage(claim.request), keyboard(claim.request));
  } catch (error) {
    // A known rejection is safe to retry immediately; an ambiguous timeout keeps
    // the short lease, since Telegram may already have accepted the message.
    if (error.telegramCode) await billingStore('release_notification', { request_id: requestId }).catch(() => {});
    return false;
  }
  await billingStore('mark_notification', { request_id: requestId, admin_id: ADMIN_ID, message_id: sent.message_id });
  return true;
}

async function updateAdminCard(request, fallbackMessageId) {
  const messageId = request.admin_message_id || fallbackMessageId;
  if (!messageId) return;
  await api('editMessageText', {
    chat_id: ADMIN_ID, message_id: messageId,
    text: formatRequestMessage(request), reply_markup: keyboard(request),
  }).catch(() => { /* The immutable database decision remains authoritative. */ });
}

async function sendReceipt(request) {
  if (!request?.receipt?.file_id) { await message(ADMIN_ID, 'Чек к этой заявке ещё не прикреплён.'); return; }
  const receipt = request.receipt;
  const method = receipt.type === 'photo' ? 'sendPhoto' : 'sendDocument';
  const field = receipt.type === 'photo' ? 'photo' : 'document';
  await api(method, { chat_id: ADMIN_ID, [field]: receipt.file_id, caption: `Чек к заявке ${request.id}\n${request.plan.toUpperCase()} · ${request.amount} ₸\nID клиента: ${request.user_id}` });
}

async function handleCallback(query) {
  if (!query || typeof query.id !== 'string') return;
  const allowed = String(query.from?.id) === ADMIN_ID
    && query.message?.chat?.type === 'private' && String(query.message.chat.id) === ADMIN_ID;
  if (!allowed) {
    await api('answerCallbackQuery', { callback_query_id: query.id, text: 'Эти кнопки доступны только владельцу.', show_alert: true }).catch(() => {});
    return;
  }
  const match = new RegExp(`^bb:(approve|reject|receipt):(${UUID})$`, 'i').exec(query.data || '');
  if (!match) return;
  const [, decision, requestId] = match;
  if (decision === 'receipt') {
    await api('answerCallbackQuery', { callback_query_id: query.id, text: 'Открываю чек…' }).catch(() => {});
    const { request } = await billingStore('get_request', { admin_id: ADMIN_ID, request_id: requestId });
    await sendReceipt(request);
    return;
  }
  const result = await billingStore('decide', { request_id: requestId, admin_id: ADMIN_ID, decision });
  const approved = result.request.status === 'approved';
  await api('answerCallbackQuery', {
    callback_query_id: query.id,
    text: result.changed ? (approved ? 'Тариф подключён.' : 'Заявка отклонена.') : 'По этой заявке уже принято решение.',
  }).catch(() => {});
  await updateAdminCard(result.request, query.message.message_id);
  if (!result.request.customer_notified_at) {
    const text = approved
      ? `Готово! Тариф ${result.subscription.plan.toUpperCase()} подключён до ${new Date(result.subscription.expires_at).toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty' })}. Открой BizBox — доступ обновится автоматически.`
      : 'Заявка на оплату отклонена. Проверь сумму и чек. Если деньги списались, свяжись с @shygambayevtg; повторно платить не нужно.';
    try {
      await message(result.request.user_id, text, appKeyboard);
      await billingStore('mark_customer_notified', { request_id: requestId, admin_id: ADMIN_ID });
    } catch {
      await message(ADMIN_ID, `Решение по заявке ${requestId} сохранено. Личное уведомление клиенту доставить не удалось; статус доступен в приложении.`).catch(() => {});
    }
  }
}

async function pendingAdmin() {
  const { requests } = await billingStore('list_pending', { admin_id: ADMIN_ID });
  if (!requests.length) { await message(ADMIN_ID, 'Новых заявок нет. Как только клиент отметит оплату, пришлю её сюда.', appKeyboard); return; }
  await message(ADMIN_ID, `Ожидают решения: ${requests.length}${requests.length === 20 ? '+' : ''}. Показываю первые ${Math.min(5, requests.length)}. Проверь поступление денег перед подтверждением.`);
  for (const request of requests.slice(0, 5)) {
    await message(ADMIN_ID, formatRequestMessage(request), keyboard(request));
  }
}

async function handleMessage(msg) {
  if (!msg?.from || msg.chat?.type !== 'private' || msg.from.is_bot || !Number.isSafeInteger(msg.from.id)
    || msg.from.id <= 0 || msg.chat.id !== msg.from.id) return;
  const userId = String(msg.from.id);
  const text = typeof msg.text === 'string' ? msg.text.trim() : '';
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();
  if (command === '/start' && /^ref_[a-f0-9]{32}$/.test(text.split(/\s+/)[1] || '')) {
    await billingStore('referral_register', { user_id: userId, code: text.split(/\s+/)[1].slice(4) });
  }
  if (command === '/admin') {
    if (userId === ADMIN_ID) await pendingAdmin();
    else await message(userId, 'Эта команда доступна владельцу BizBox. Твой тариф — в приложении.', appKeyboard);
    return;
  }
  if (command === '/start' && text.includes('receipt_')) {
    const id = text.split(/\s+/)[1]?.replace(/^receipt_/, '');
    const state = await billingStore('get_state', { user_id: userId });
    if (state.request?.status !== 'pending' || state.request.id !== id) {
      await message(userId, 'Заявка не найдена или по ней уже принято решение. Открой «Тарифы» в BizBox.', appKeyboard);
      return;
    }
    await message(userId, `Пришли чек одним сообщением: фото или PDF. Прикреплю его к заявке ${state.request.plan.toUpperCase()} на ${state.request.amount} ₸ и передам владельцу.`);
    return;
  }
  if (command === '/start' || command === '/help') {
    await message(userId, userId === ADMIN_ID
      ? 'Ты в BizBox 👋\nЗаявки на оплату будут приходить сюда. /admin — показать ожидающие решения.\nПодтверждай доступ после проверки поступления в Kaspi.'
      : 'Привет! Это BizBox 👋\nОткрой приложение, чтобы вести дела. Для подключения тарифа: оплати через Kaspi, нажми «Я оплатил» в разделе «Тарифы» и отправь чек сюда. После решения владельца сообщу результат.', appKeyboard);
    return;
  }
  if (command === '/status') {
    const state = await billingStore('get_state', { user_id: userId });
    const sub = state.subscription;
    await message(userId, sub && Date.parse(sub.expires_at) > Date.now()
      ? `Тариф ${sub.plan.toUpperCase()} до ${new Date(sub.expires_at).toLocaleDateString('ru-RU')}.`
      : 'Серверная подписка пока не подключена. Статус заявки и ранее выданного кода — в разделе «Тарифы».', appKeyboard);
    return;
  }
  const photo = Array.isArray(msg.photo) ? msg.photo.at(-1) : null;
  const document = msg.document;
  if (photo || document) {
    if (document && (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(document.mime_type) || document.file_size > 20 * 1024 * 1024)) {
      await message(userId, 'Пришли чек фотографией или PDF размером до 20 МБ.'); return;
    }
    const file = photo || document;
    const receipt = { file_id: file.file_id, type: photo ? 'photo' : 'document', message_id: msg.message_id };
    const before = await billingStore('get_state', { user_id: userId });
    if (before.request?.status !== 'pending') {
      await message(userId, 'Сначала выбери тариф и нажми «Я оплатил» в приложении. Затем отправь чек сюда.', appKeyboard); return;
    }
    if (!Number.isSafeInteger(msg.date) || msg.date < Math.floor(Date.parse(before.request.created_at) / 1000)) return;
    // A repeated Telegram delivery of the same file/message has no extra effect.
    if (before.request.receipt?.message_id === msg.message_id) return;
    const { request } = await billingStore('attach_receipt', { user_id: userId, request_id: before.request.id, message_date: msg.date, receipt });
    await notifyAdmin(request.id).catch(() => false);
    await updateAdminCard(request);
    await message(userId, 'Чек прикреплён к заявке. Ждём решения владельца — сообщу его здесь.', appKeyboard);
    return;
  }
  await message(userId, 'Для оплаты открой «Тарифы», затем нажми «Я оплатил». Чек можно отправить сюда фотографией или PDF.', appKeyboard);
}

async function setup(body, request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!verifyWebhookSecret(bearer, process.env.BIZBOX_SETUP_SECRET)) throw new HttpError(403, 'forbidden', 'Доступ запрещён.');
  if (body.operation === 'diagnose_ai') {
    const key=process.env.OPENAI_API_KEY || process.env.BIZ_BOX_API_KEY_AI;
    if(!key) throw new HttpError(503,'ai_not_configured','Не задан ключ OpenAI.');
    const response=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:process.env.OPENAI_MODEL || 'gpt-5.6-terra',messages:[{role:'user',content:'Say hello.'}],max_completion_tokens:16,reasoning_effort:'none',store:false}),
    });
    const result=await response.json();
    // Admin-only probe uses a fixed synthetic prompt and never returns credentials.
    const clean=value=>String(value||'').replaceAll(key,'[redacted]').replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').replace(/(?:org|proj)-[A-Za-z0-9_-]+/g,'[account]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]+/g,'[email]').slice(0,1000);
    return {ok:response.ok,status:response.status,code:clean(result.error?.code),type:clean(result.error?.type),message:clean(result.error?.message),retryAfter:response.headers.get('retry-after')};
  }
  if (body.operation === 'test_ai') {
    return askAssistant({message:'Какая прибыль за октябрь 2026? Также подготовь задачу Проверить рекламу на 27 октября 2026, средний приоритет. Ответь кратко.',history:[],context:{today:'2026-10-26',transactions:[{type:'income',amount:50000,date:'2026-10-26',status:'completed',category:'Тест'},{type:'expense',amount:33500,date:'2026-10-26',status:'completed',category:'Тест'}],tasks:[],clients:[]}});
  }
  const bot = await api('getMe', {});
  if (bot.username?.toLowerCase() !== 'biznowbox_bot') throw new HttpError(409, 'wrong_bot', 'Токен принадлежит другому боту. Нужен @Biznowbox_bot.');
  if(body.operation === 'repair_menu') {
    await api('setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть BizBox',web_app:{url:APP_URL}}});
    const menu=await api('getChatMenuButton',{});
    return {ok:menu.web_app?.url===APP_URL,url:menu.web_app?.url};
  }
  const hook = await api('getWebhookInfo', {});
  const state = await billingStore('list_pending', { admin_id: ADMIN_ID });
  if (body.operation === 'install') {
    if (hook.url && hook.url !== WEBHOOK_URL) throw new HttpError(409, 'webhook_exists', 'У бота уже подключён другой обработчик. Сначала нужно согласовать его замену.');
    await api('setWebhook', { url: WEBHOOK_URL, secret_token: process.env.BIZBOX_WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'], max_connections: 5, drop_pending_updates: false });
    await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Открыть BizBox', web_app: { url: APP_URL } } });
    await api('setMyCommands', { commands: [{ command: 'start', description: 'Открыть BizBox' }, { command: 'help', description: 'Как подключить тариф' }, { command: 'status', description: 'Моя подписка' }] });
    await api('setMyCommands', { scope: { type: 'chat', chat_id: ADMIN_ID }, commands: [{ command: 'start', description: 'Открыть BizBox' }, { command: 'admin', description: 'Заявки: подтвердить или отклонить' }, { command: 'status', description: 'Моя подписка' }] }).catch(() => {});
    let adminNotified = false;
    try { await message(ADMIN_ID, 'Админка BizBox подключена ✅\nЗаявки будут приходить сюда с кнопками «Подтвердить» и «Отклонить».\n/admin — показать ожидающие решения. Перед подтверждением проверь поступление в Kaspi.', appKeyboard); adminNotified = true; } catch { /* Owner needs to start/unblock bot. */ }
    return { ok: true, installed: true, adminNotified, botUsername: bot.username };
  }
  return { ok: true, botUsername: bot.username, webhookConfigured: hook.url === WEBHOOK_URL, otherWebhookConfigured: Boolean(hook.url && hook.url !== WEBHOOK_URL), pendingRequests: state.requests.length, webhookPendingUpdates: hook.pending_update_count, webhookHasError: Boolean(hook.last_error_date) };
}

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > 262_144) throw new HttpError(413, 'too_large', 'Запрос слишком большой.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'bad_request', 'Пустой запрос.');
  let size = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 262_144) { await reader.cancel(); throw new HttpError(413, 'too_large', 'Запрос слишком большой.'); }
    chunks.push(value);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error();
    return parsed;
  } catch { throw new HttpError(400, 'bad_request', 'Некорректный запрос.'); }
}

export default {
  async fetch(request) {
    const origin = request.headers.get('origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (origin && ALLOWED_ORIGINS.has(origin)) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' });
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ error: 'Этот адрес не разрешён.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'GET') return reply({ service: 'BizBox', version: '2.4-assistant', configured: configured() });
    if (request.method !== 'POST') return reply({ error: 'Метод не поддерживается.' }, 405);
    try {
      if (!configured()) throw new HttpError(503, 'billing_unavailable', 'Подтверждение через бота ещё подключается. Попробуй позже.');
      const isWebhook = new URL(request.url).searchParams.get('action') === 'telegram';
      if (isWebhook && !verifyWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token'), process.env.BIZBOX_WEBHOOK_SECRET)) throw new HttpError(403, 'forbidden', 'Доступ запрещён.');
      const body = await readBody(request);
      if (isWebhook) {
        if (body.callback_query) await handleCallback(body.callback_query);
        else if (body.message) await handleMessage(body.message);
        return reply({ ok: true });
      }
      if (body.action === 'setup') return reply(await setup(body, request));
      const user = verifyInitData(body.initData, process.env.BIZBOX_BOT_TOKEN);
      if (body.action === 'assistant') {
        // Reject malformed requests before reserving quota or calling a model.
        sanitizeContext(body.context);
        if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000 || !Array.isArray(body.history) || body.history.length > 12) throw new HttpError(400,'assistant_input','Проверь текст вопроса.');
        const quota = await billingStore('assistant_reserve', { user_id:user.id });
        return reply({...await askAssistant(body),remaining:quota.remaining});
      }
      if (['state','request','referral_state','wallet_redeem'].includes(body.action)) {
        const code = /^ref_[a-f0-9]{32}$/.test(user.startParam) ? user.startParam.slice(4) : '';
        await billingStore('referral_register', { user_id:user.id,code });
      }
      if (body.action === 'referral_state') return reply(await billingStore('referral_state',{user_id:user.id}));
      if (body.action === 'wallet_redeem') return reply(await billingStore('wallet_redeem',{user_id:user.id,plan:body.plan,request_id:body.requestId}));
      if (body.action === 'state') return reply(clientState(await billingStore('get_state', { user_id: user.id })));
      if (body.action !== 'request' || !['business', 'pro'].includes(body.plan)) throw new HttpError(400, 'bad_request', 'Выбери тариф BUSINESS или PRO.');
      const { request: payment } = await billingStore('create_request', { user_id: user.id, name: user.name, username: user.username, plan: body.plan });
      const delivered = payment.status === 'pending' ? await notifyAdmin(payment.id).catch(() => false) : true;
      const state = await billingStore('get_state', { user_id: user.id });
      return reply({ ...clientState(state), notificationDelivered: delivered });
    } catch (error) {
      // Only safe codes/status are logged. Never log request bodies, IDs, receipts,
      // Telegram token URLs, initData or the original network exception.
      console.error('bizbox_api_error', { code: error instanceof HttpError ? error.code : 'internal' });
      return reply({ code: error instanceof HttpError ? error.code : 'internal', error: error instanceof HttpError ? error.message : 'Не удалось обработать запрос. Попробуй ещё раз.' }, error instanceof HttpError ? error.status : 500);
    }
  },
};
