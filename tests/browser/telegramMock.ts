import type { CloudStorage } from '../../src/lib/cloudWorkspace';

/** Preview-only bridge. It never calls Telegram or reads real Telegram user data. */
export function installTelegramMock(): void {
  if (import.meta.env.MODE !== 'integration') throw new Error('Telegram fixture is limited to integration builds.');

  const storage = window.sessionStorage;
  const prefix = 'bizbox_integration_fixture_v1_';
  const accountKey = `${prefix}account`;
  const account = storage.getItem(accountKey) === 'B' ? 'B' : 'A';
  const cloudKey = `${prefix}cloud_${account}`;
  const readFailureKey = `${prefix}read_failure`;
  const writeFailureKey = `${prefix}write_failure_once`;
  if (!storage.getItem(cloudKey)) storage.setItem(cloudKey, '{}');

  // A new browser session has no access to the old localStorage-based profile.
  // Fail every access explicitly so fallback code cannot accidentally pass tests.
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('localStorage is disabled in this fixture', 'SecurityError'); },
    set() { throw new DOMException('localStorage is disabled in this fixture', 'SecurityError'); },
  });

  const panel = document.createElement('details');
  panel.setAttribute('aria-label', 'Панель тестового Telegram');
  panel.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483646;max-width:calc(100vw - 16px);width:340px;border:1px solid #fbbf24;border-radius:12px;background:#172033;color:#fef3c7;padding:10px;box-shadow:0 6px 24px #0008;font:12px/1.5 system-ui;';
  const heading = document.createElement('summary');
  heading.textContent = `ТЕСТОВЫЙ TELEGRAM · аккаунт ${account}`;
  heading.style.cssText = 'cursor:pointer;font-weight:700;';
  panel.append(heading);
  const explanation = document.createElement('p');
  explanation.textContent = 'Только фиктивные данные. localStorage отключён. Облако имитируется отдельно для каждого тестового аккаунта.';
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
    window.location.reload();
  });

  const readCloud = (): Record<string, string> => {
    const parsed: unknown = JSON.parse(storage.getItem(cloudKey) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.values(parsed).every(value => typeof value === 'string')) throw new Error('Invalid fixture storage');
    return parsed as Record<string, string>;
  };
  const defer = (operation: () => void) => { window.setTimeout(operation, 10); };
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

  const webApp = {
    version: '9.0',
    platform: 'web',
    initData: 'fixture',
    initDataUnsafe: { user: { id: account === 'A' ? 424200001 : 424200002, first_name: 'Проверка' } },
    CloudStorage: cloud,
    ready() {},
    expand() {},
    close() { window.location.reload(); },
    isVersionAtLeast(version: string) {
      const [major, minor = 0] = version.split('.').map(Number);
      return Number.isFinite(major) && Number.isFinite(minor) && (major < 9 || (major === 9 && minor <= 0));
    },
    enableClosingConfirmation() {},
    disableClosingConfirmation() {},
  };
  window.Telegram = { WebApp: webApp };
}
