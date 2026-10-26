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
  const { auth, syncStatus, syncError, syncLocallySaved, syncConflict, resolveWorkspaceConflict, retrySave, reloadWorkspace, exportWorkspace } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const chooseVersion = async (version: 'local' | 'cloud') => {
    const confirmed = window.confirm(version === 'local'
      ? 'Сохранить данные с этого устройства в Telegram? Текущая облачная версия будет заменена. Перед продолжением скачайте копию, если нужно сохранить обе версии.'
      : 'Использовать облачную версию? Текущие изменения на этом устройстве будут заменены. Перед продолжением скачайте копию, если нужно сохранить обе версии.');
    if (!confirmed) return;
    setBusy(true); setActionError('');
    try { await resolveWorkspaceConflict(version); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Не удалось выбрать версию. Повторите попытку.'); }
    finally { setBusy(false); }
  };
  if (auth.mode === 'demo') return <div className="text-center text-[11px] text-white/50 py-1">Демо-пространство · изменения не сохраняются</div>;
  if (auth.mode !== 'telegram') return null;
  const failed = syncStatus === 'error';
  const saving = syncStatus === 'saving';
  return (
    <div className={failed ? 'liquid-panel rounded-2xl border border-amber-300/25 px-3.5 py-3' : 'px-1 py-1'}>
      <div className="flex items-center gap-2 text-[11px]" role="status" aria-live="polite">
        {failed ? <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-200" /> : saving ? <CloudUpload className="w-3.5 h-3.5 shrink-0 text-accent-300 animate-pulse" /> : <CheckCircle2 className="w-3 h-3 text-emerald-300/80" />}
        <span className={failed ? 'text-amber-100 flex-1' : 'text-white/55 flex-1'}>{failed ? syncConflict ? 'Нужно выбрать актуальную версию' : syncLocallySaved ? 'На устройстве сохранено · ожидает синхронизации' : 'Есть несохранённые изменения' : saving ? 'Синхронизация…' : syncStatus === 'saved' ? 'Всё сохранено в Telegram' : 'Telegram подключён'}</span>
        {failed && <button type="button" className="text-amber-100 underline underline-offset-4 py-1" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Свернуть' : 'Подробнее'}</button>}
      </div>
      {failed && expanded && <div className="mt-3">
        <p className="text-xs leading-relaxed text-white/65">{syncError}</p>
        {actionError && <p className="text-xs text-amber-200 mt-2" role="alert">{actionError}</p>}
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm" variant="secondary" disabled={busy} onClick={async () => { setBusy(true); try { await retrySave(); } catch { /* Error remains visible. */ } finally { setBusy(false); } }}><RefreshCw className="w-3 h-3" /> {busy ? 'Повторяем…' : 'Повторить'}</Button>
          <Button size="sm" variant="ghost" onClick={exportWorkspace}><Download className="w-3 h-3" /> Скачать копию</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void reloadWorkspace()}>Проверить облако</Button>
        </div>
        {syncConflict && <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/10">
          <Button size="sm" disabled={busy} onClick={() => void chooseVersion('local')}>Сохранить эту версию</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void chooseVersion('cloud')}>Использовать облачную</Button>
        </div>}
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
