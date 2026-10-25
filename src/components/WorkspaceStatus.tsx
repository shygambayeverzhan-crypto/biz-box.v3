import { useState } from 'react';
import { CheckCircle2, CloudUpload, AlertCircle, RefreshCw, Download, ArrowRight } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { APP_VERSION, BOT_URL } from '@/lib/telegram';

export function WorkspaceLoading() {
  const { bootStatus, bootError, reloadWorkspace } = useApp();
  const failed = bootStatus === 'error';
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg-base">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-8"><Logo size="lg" /></div>
        <div className="rounded-2xl border border-border bg-bg-card p-8">
          {failed ? <AlertCircle className="w-9 h-9 text-amber-400 mx-auto mb-5" /> : <RefreshCw className="w-8 h-8 text-accent-400 animate-spin mx-auto mb-5" />}
          <h1 className="text-xl font-semibold text-white">{failed ? 'Не удалось загрузить профиль' : 'Открываем твой BizBox'}</h1>
          <p className="text-sm text-white/50 mt-3 leading-relaxed" role={failed ? 'alert' : 'status'}>{failed ? bootError : 'Загружаем сохранённые данные из Telegram…'}</p>
          {failed && <><Button className="w-full mt-6" onClick={() => void reloadWorkspace()}><RefreshCw className="w-4 h-4" /> Попробовать ещё раз</Button><a className="block text-sm text-accent-300 mt-4" href={BOT_URL}>Открыть через профиль бота</a></>}
        </div>
        <p className="text-[11px] text-white/25 mt-6">BizBox · {APP_VERSION}</p>
      </div>
    </div>
  );
}

export function SyncBanner() {
  const { auth, syncStatus, syncError, retrySave, reloadWorkspace, exportWorkspace } = useApp();
  if (auth.mode === 'demo') return <div className="px-4 py-2 text-center text-xs text-amber-300 bg-amber-400/10">Демо · примеры данных · изменения не сохраняются</div>;
  if (auth.mode !== 'telegram') return null;
  const failed = syncStatus === 'error';
  return (
    <div className={failed ? 'bg-amber-400/10 border-b border-amber-400/20 px-4 py-3' : 'border-b border-border px-4 py-2'} role={failed ? 'alert' : 'status'} aria-live="polite">
      <div className="flex items-center justify-center gap-2 text-xs">
        {failed ? <AlertCircle className="w-4 h-4 text-amber-300" /> : syncStatus === 'saving' ? <CloudUpload className="w-4 h-4 text-accent-400 animate-pulse" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        <span className={failed ? 'text-amber-200' : 'text-white/50'}>{failed ? syncError : syncStatus === 'saving' ? 'Сохраняем в Telegram… Не закрывай приложение.' : syncStatus === 'saved' ? 'Сохранено в Telegram' : 'Telegram подключён'}</span>
        <span className="text-white/25 ml-2 shrink-0">{APP_VERSION}</span>
      </div>
      {failed && <div className="flex flex-wrap justify-center gap-2 mt-3">
        <Button size="sm" variant="secondary" onClick={() => void retrySave().catch(() => {})}><RefreshCw className="w-3 h-3" /> Повторить</Button>
        <Button size="sm" variant="ghost" onClick={exportWorkspace}><Download className="w-3 h-3" /> Скачать копию</Button>
        <Button size="sm" variant="ghost" onClick={() => {
          if (window.confirm('Загрузить облачную версию? Несохранённые изменения на этом экране будут заменены. Сначала можно скачать копию.')) void reloadWorkspace();
        }}>Загрузить облачную версию</Button>
      </div>}
    </div>
  );
}

export function LegacyImport() {
  const { legacyState, importLegacy, dismissLegacy } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="min-h-screen flex items-center justify-center p-6"><div className="max-w-md w-full bg-bg-card border border-border rounded-2xl p-7">
    <Logo size="md" />
    <h1 className="text-2xl font-bold text-white mt-7">Нашли сохранённый бизнес</h1>
    <p className="text-white/60 mt-3">На этом устройстве есть «{legacyState?.business?.name}». Если это твои данные, перенеси их в свой Telegram.</p>
    <p className="text-xs text-white/40 mt-3">Профиль, финансы, клиенты и задачи будут доступны при следующем входе.</p>
    {error && <p role="alert" className="text-amber-300 text-sm mt-4">{error}</p>}
    <Button disabled={busy} className="w-full mt-6" onClick={async () => {
      setBusy(true); setError('');
      try { await importLegacy(); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить. Попробуй ещё раз.'); } finally { setBusy(false); }
    }}>{busy ? 'Переносим…' : 'Это мои данные — перенести'}<ArrowRight className="w-4 h-4" /></Button>
    <Button disabled={busy} className="w-full mt-3" variant="ghost" onClick={dismissLegacy}>Создать новый бизнес</Button>
  </div></div>;
}
