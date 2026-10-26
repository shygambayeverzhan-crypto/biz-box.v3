import type { CloudStorage } from '../../src/lib/cloudWorkspace';
import type { AppState } from '../../src/types';

/** Preview-only bridge. It never calls Telegram or reads real Telegram user data. */
export function installTelegramMock(): void {
  if (import.meta.env.MODE !== 'integration') throw new Error('Telegram fixture is limited to integration builds.');

  const storage = window.sessionStorage;
  const options = new URLSearchParams(window.location.search);
  const localStorageEnabled = options.get('storage') === 'enabled';
  const prefix = 'bizbox_integration_fixture_v1_';
  const accountKey = `${prefix}account`;
  const account = storage.getItem(accountKey) === 'B' ? 'B' : 'A';
  const cloudKey = `${prefix}cloud_${account}`;
  const readFailureKey = `${prefix}read_failure`;
  const writeFailureKey = `${prefix}write_failure_once`;
  const allWritesFailureKey = `${prefix}write_failure_all`;
  const lostAcknowledgmentKey = `${prefix}lost_acknowledgment_once`;
  const delayKey = `${prefix}response_delay_ms`;
  const manifestKey = 'bizbox_workspace_v2';
  const userId = account === 'A' ? 424200001 : 424200002;
  if (options.has('delay')) {
    const delay = Number(options.get('delay'));
    if (Number.isFinite(delay)) storage.setItem(delayKey, String(Math.max(0, Math.min(30_000, delay))));
  }
  if (!storage.getItem(cloudKey)) storage.setItem(cloudKey, '{}');

  // Opt-in persistence remains namespaced, so no fixture can see or overwrite
  // real profiles even when the test app shares an origin with another build.
  if (localStorageEnabled) {
    const nativeStorage = window.localStorage;
    const localPrefix = `${prefix}local_`;
    const keys = () => Array.from({ length: nativeStorage.length }, (_, index) => nativeStorage.key(index))
      .filter((key): key is string => key !== null && key.startsWith(localPrefix));
    const scopedStorage: Storage = {
      get length() { return keys().length; },
      key(index) { return keys()[index]?.slice(localPrefix.length) ?? null; },
      getItem(key) { return nativeStorage.getItem(localPrefix + key); },
      setItem(key, value) { nativeStorage.setItem(localPrefix + key, value); },
      removeItem(key) { nativeStorage.removeItem(localPrefix + key); },
      clear() { for (const key of keys()) nativeStorage.removeItem(key); },
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => scopedStorage });
  } else {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('localStorage is disabled in this fixture', 'SecurityError'); },
      set() { throw new DOMException('localStorage is disabled in this fixture', 'SecurityError'); },
    });
  }

  const panel = document.createElement('details');
  panel.setAttribute('aria-label', 'Панель тестового Telegram');
  panel.style.cssText = 'position:fixed;right:8px;bottom:96px;max-height:65vh;overflow:auto;z-index:2147483646;max-width:calc(100vw - 16px);width:340px;border:1px solid #fbbf24;border-radius:12px;background:#172033;color:#fef3c7;padding:10px;box-shadow:0 6px 24px #0008;font:12px/1.5 system-ui;';
  const heading = document.createElement('summary');
  heading.textContent = `ТЕСТОВЫЙ TELEGRAM · аккаунт ${account}`;
  heading.style.cssText = 'cursor:pointer;font-weight:700;';
  panel.append(heading);
  const explanation = document.createElement('p');
  explanation.textContent = `Только фиктивные данные. localStorage ${localStorageEnabled ? 'включён в отдельной тестовой области' : 'отключён; для проверки восстановления откройте ?storage=enabled'}. Облако отдельно для каждого тестового аккаунта.`;
  explanation.style.cssText = 'margin:8px 0;color:#d1d5db;';
  panel.append(explanation);
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
  panel.append(controls);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'margin:8px 0 0;color:#d1d5db;';
  panel.append(status);
  const closingStatus = document.createElement('p');
  closingStatus.style.cssText = 'margin:6px 0 0;font-weight:700;';
  closingStatus.textContent = 'Предупреждение при закрытии: выкл';
  panel.append(closingStatus);
  document.body.append(panel);

  const button = (label: string, action: () => void) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.style.cssText = 'cursor:pointer;border:1px solid #6b7280;background:#25334b;color:#fff;border-radius:6px;padding:6px 8px;font:inherit;';
    element.addEventListener('click', action);
    controls.append(element);
    return element;
  };
  button('Переоткрыть', () => window.location.reload());
  button('Сбой следующей записи', () => {
    storage.setItem(writeFailureKey, '1');
    status.textContent = 'Следующая запись завершится ошибкой. Старые данные останутся на месте.';
  });
  const allWritesButton = button('', () => {
    storage.setItem(allWritesFailureKey, storage.getItem(allWritesFailureKey) === '1' ? '0' : '1');
    refreshAllWritesLabel();
  });
  function refreshAllWritesLabel() {
    const enabled = storage.getItem(allWritesFailureKey) === '1';
    allWritesButton.textContent = `Сбой всех записей: ${enabled ? 'вкл' : 'выкл'}`;
    status.textContent = enabled ? 'Все записи будут отклоняться, пока этот режим включён.' : 'Запись в облако работает.';
  }
  refreshAllWritesLabel();
  button('Потерять подтверждение', () => {
    storage.setItem(lostAcknowledgmentKey, '1');
    status.textContent = 'Следующий манифест сохранится в облаке, но его callback не придёт. Проверяйте восстановление без дубликатов.';
  });
  const delayButton = button('', () => {
    storage.setItem(delayKey, Number(storage.getItem(delayKey)) > 0 ? '0' : '15000');
    refreshDelayLabel();
  });
  function refreshDelayLabel() {
    const delay = Number(storage.getItem(delayKey)) || 0;
    delayButton.textContent = `Задержка ответов: ${delay ? `${delay / 1000} с` : 'выкл'}`;
  }
  refreshDelayLabel();
  const readButton = button('', () => {
    storage.setItem(readFailureKey, storage.getItem(readFailureKey) === '1' ? '0' : '1');
    refreshReadLabel();
  });
  function refreshReadLabel() {
    const enabled = storage.getItem(readFailureKey) === '1';
    readButton.textContent = `Сбой чтения: ${enabled ? 'вкл' : 'выкл'}`;
    status.textContent = enabled ? 'Чтение завершится ошибкой до отключения этого режима.' : 'Чтение работает. Облако сохраняется при переоткрытии вкладки.';
  }
  refreshReadLabel();
  button(account === 'A' ? 'Новый тестовый аккаунт (B)' : 'Вернуться к аккаунту A', () => {
    storage.setItem(accountKey, account === 'A' ? 'B' : 'A');
    storage.setItem(readFailureKey, '0');
    storage.setItem(writeFailureKey, '0');
    storage.setItem(allWritesFailureKey, '0');
    storage.setItem(lostAcknowledgmentKey, '0');
    storage.setItem(delayKey, '0');
    window.location.reload();
  });

  button('Тестовый бизнес', () => {
    void (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const state: AppState = {
        user: { name: 'Тестовый предприниматель', email: '', plan: 'free' },
        business: { name: 'Тестовый бизнес', industry: 'Услуги', city: 'Алматы', employeesCount: '1', modules: ['finance', 'clients', 'tasks', 'calendar'] },
        onboardingComplete: true,
        transactions: [{ id: 'fixture-expense-33500', type: 'expense', amount: 33500, category: 'Прочие расходы', description: 'Тестовый расход', date: today, status: 'completed' }],
        documents: [], clients: [], tasks: [], employees: [], notifications: [], events: [], specialists: [], payments: [],
      };
      const json = JSON.stringify(state);
      const revision = crypto.randomUUID();
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
      const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (json.length > 3500) throw new Error('Fixture seed exceeds one chunk');
      storage.setItem(cloudKey, JSON.stringify({
        [manifestKey]: JSON.stringify({ version: 2, revision, chunks: 1, length: json.length, sha256 }),
        [`bizbox_ws_${revision}_0`]: json,
      }));
      for (const key of [readFailureKey, writeFailureKey, allWritesFailureKey, lostAcknowledgmentKey, delayKey]) storage.setItem(key, '0');
      if (localStorageEnabled) {
        const localKeys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index));
        for (const key of localKeys) if (key?.includes(String(userId))) window.localStorage.removeItem(key);
      }
      window.location.reload();
    })().catch(() => { status.textContent = 'Не удалось подготовить тестовый бизнес.'; });
  });

  const readCloud = (): Record<string, string> => {
    const parsed: unknown = JSON.parse(storage.getItem(cloudKey) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.values(parsed).every(value => typeof value === 'string')) throw new Error('Invalid fixture storage');
    return parsed as Record<string, string>;
  };
  const readCloudSnapshot = () => {
    const values = readCloud();
    const manifest = JSON.parse(values[manifestKey] || 'null') as { version: number; revision: string; chunks: number } | null;
    if (!manifest || manifest.version !== 2 || !Number.isInteger(manifest.chunks) || manifest.chunks < 1 || manifest.chunks > 48) {
      throw new Error('Сначала создайте тестовый бизнес.');
    }
    const json = Array.from({ length: manifest.chunks }, (_, index) => values[`bizbox_ws_${manifest.revision}_${index}`] || '').join('');
    const state = JSON.parse(json) as AppState;
    if (!state.user || !state.business) throw new Error('Сначала создайте тестовый бизнес.');
    return { values, manifest, state };
  };
  button('Изменить облако отдельно', () => {
    void (async () => {
      const { values, manifest, state } = readCloudSnapshot();
      const next: AppState = { ...state, business: { ...state.business!, name: 'Облачная версия' } };
      const json = JSON.stringify(next);
      const chunks: string[] = [];
      for (let offset = 0; offset < json.length;) {
        let end = Math.min(offset + 3500, json.length);
        if (end < json.length && /[\uD800-\uDBFF]/.test(json[end - 1])) end--;
        chunks.push(json.slice(offset, end));
        offset = end;
      }
      if (chunks.length > 48) throw new Error('Тестовая копия слишком большая.');
      const revision = crypto.randomUUID();
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
      const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (readCloud()[manifestKey] !== values[manifestKey]) throw new Error('Дождитесь окончания сохранения и повторите.');
      for (let index = 0; index < chunks.length; index++) values[`bizbox_ws_${revision}_${index}`] = chunks[index];
      values[manifestKey] = JSON.stringify({ version: 2, revision, chunks: chunks.length, length: json.length, sha256, previous: { revision: manifest.revision, chunks: manifest.chunks } });
      storage.setItem(cloudKey, JSON.stringify(values));
      status.textContent = 'В облаке теперь «Облачная версия». Экран не обновлён; следующая правка проверит конфликт.';
    })().catch(error => { status.textContent = error instanceof Error ? error.message : 'Не удалось изменить тестовое облако.'; });
  });
  button('Старая местная копия', () => {
    if (!localStorageEnabled) { status.textContent = 'Для старой местной копии откройте ?storage=enabled.'; return; }
    try {
      const { state } = readCloudSnapshot();
      const legacy: AppState = { ...state, user: { ...state.user!, name: 'Местная версия 2.2' } };
      window.localStorage.setItem(`bizbox_cache_v2_${userId}`, JSON.stringify(legacy));
      window.localStorage.removeItem(`bizbox_recovery_v3_${userId}`);
      window.location.reload();
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Не удалось создать старую местную копию.'; }
  });
  const defer = (operation: () => void) => { window.setTimeout(operation, Number(storage.getItem(delayKey)) || 10); };
  const cloud: CloudStorage = {
    getItem(key, callback) {
      defer(() => {
        if (storage.getItem(readFailureKey) === '1') { callback('FIXTURE_READ_FAILURE'); return; }
        try { callback(null, readCloud()[key] ?? ''); } catch { callback('FIXTURE_STORAGE_FAILURE'); }
      });
    },
    getItems(keys, callback) {
      defer(() => {
        if (storage.getItem(readFailureKey) === '1') { callback('FIXTURE_READ_FAILURE'); return; }
        try {
          const values = readCloud();
          callback(null, Object.fromEntries(keys.map(key => [key, values[key] ?? ''])));
        } catch { callback('FIXTURE_STORAGE_FAILURE'); }
      });
    },
    setItem(key, value, callback) {
      defer(() => {
        if (storage.getItem(allWritesFailureKey) === '1') { callback('FIXTURE_WRITE_FAILURE'); return; }
        if (storage.getItem(writeFailureKey) === '1') {
          storage.setItem(writeFailureKey, '0');
          status.textContent = 'Ошибка записи воспроизведена. Следующие записи снова работают.';
          callback('FIXTURE_WRITE_FAILURE');
          return;
        }
        if (key.length > 128 || value.length > 4096) { callback('FIXTURE_LIMIT_EXCEEDED'); return; }
        try {
          const values = readCloud();
          values[key] = value;
          if (Object.keys(values).length > 1024) { callback('FIXTURE_KEY_LIMIT_EXCEEDED'); return; }
          storage.setItem(cloudKey, JSON.stringify(values));
          if (key === manifestKey && storage.getItem(lostAcknowledgmentKey) === '1') {
            storage.setItem(lostAcknowledgmentKey, '0');
            status.textContent = 'Манифест сохранён, подтверждение потеряно. Чтение доступно для проверки результата.';
            return;
          }
          callback(null, true);
        } catch { callback('FIXTURE_STORAGE_FAILURE'); }
      });
    },
    removeItems(keys, callback) {
      defer(() => {
        try {
          const values = readCloud();
          for (const key of keys) delete values[key];
          storage.setItem(cloudKey, JSON.stringify(values));
          callback(null, true);
        } catch { callback('FIXTURE_STORAGE_FAILURE'); }
      });
    },
  };

  const mockServices = options.get('services') === 'mock';
  const homeHandlers = new Set<() => void>();
  let homeAdded = false;
  if (mockServices) {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input) !== 'https://biz-box-v3.vercel.app/api/bizbox') return nativeFetch(input, init);
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.action === 'state') return Response.json({subscription:null,request:null});
      if (body.action === 'referral_state') return Response.json({code:'a'.repeat(32),balance:1499,earned:1499,invited:2,paid:1,history:[{id:'fixture-reward',amount:1499,kind:'referral_bonus',date:'2026-10-26T12:00:00Z'}],invitations:[{date:'2026-10-26T12:00:00Z',status:'rewarded',bonus:1499},{date:'2026-10-26T13:00:00Z',status:'registered',bonus:0}]});
      if (body.action === 'assistant') return Response.json({text:'ТЕСТОВЫЙ ОТВЕТ (не модель): подготовлена задача. Подтверди её ниже.',sources:['Тестовая среда'],remaining:29,proposals:[{id:'11111111-1111-4111-8111-111111111111',action:{kind:'task',title:'Проверить рекламу',description:'Тест подтверждения',dueDate:'2026-10-27',priority:'medium'}}]});
      return Response.json({error:'Тестовый сервис: действие отключено'},{status:400});
    };
  }
  const webApp = {
    version: '9.0',
    platform: 'web',
    // Empty signed data prevents the billing client from making real requests.
    initData: mockServices ? 'isolated-fixture-not-a-real-session' : '',
    initDataUnsafe: { user: { id: userId, first_name: 'Проверка' } },
    CloudStorage: cloud,
    ready() {},
    expand() {},
    close() { window.location.reload(); },
    isVersionAtLeast(version: string) {
      const [major, minor = 0] = version.split('.').map(Number);
      return Number.isFinite(major) && Number.isFinite(minor) && (major < 9 || (major === 9 && minor <= 0));
    },
    enableClosingConfirmation() { closingStatus.textContent = 'Предупреждение при закрытии: вкл'; },
    disableClosingConfirmation() { closingStatus.textContent = 'Предупреждение при закрытии: выкл'; },
    checkHomeScreenStatus(callback: (status: string) => void) { callback(homeAdded ? 'added' : 'missed'); },
    addToHomeScreen() { homeAdded = true; homeHandlers.forEach(handler => handler()); },
    onEvent(event: string, handler: () => void) { if(event === 'homeScreenAdded')homeHandlers.add(handler); },
    offEvent(event: string, handler: () => void) { if(event === 'homeScreenAdded')homeHandlers.delete(handler); },
  };
  window.Telegram = { WebApp: webApp };
}
