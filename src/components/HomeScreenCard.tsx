import { useEffect, useState } from 'react';
import { Smartphone, Check, X } from 'lucide-react';
import { getTelegram, BOT_URL } from '@/lib/telegram';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

type Status = 'checking' | 'unsupported' | 'unknown' | 'added' | 'missed';
export function HomeScreenCard({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>('checking');
  const [requested, setRequested] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const app = getTelegram(); let active = true;
    const update = (value: string) => { if (active) setStatus(['unsupported','unknown','added','missed'].includes(value) ? value as Status : 'unknown'); };
    const added = () => update('added');
    let supported = false;
    try { supported = Boolean(app?.isVersionAtLeast('8.0') && app.addToHomeScreen && app.checkHomeScreenStatus); } catch { /* Older clients. */ }
    if (!app || !supported) { setStatus('unsupported'); return; }
    const timer = window.setTimeout(() => update('unknown'), 4000);
    try {
      app.onEvent?.('homeScreenAdded', added);
      app.checkHomeScreenStatus?.(value => { window.clearTimeout(timer); update(value); });
    } catch { window.clearTimeout(timer); update('unsupported'); }
    const check = () => { if (document.visibilityState === 'visible') { try { app.checkHomeScreenStatus?.(update); } catch { update('unknown'); } } };
    document.addEventListener('visibilitychange', check);
    return () => { active = false; window.clearTimeout(timer); app.offEvent?.('homeScreenAdded', added); document.removeEventListener('visibilitychange',check); };
  }, []);
  if (compact && (dismissed || status === 'added' || status === 'unsupported')) return null;
  const add = () => {
    setError('');
    try {
      const app = getTelegram();
      if (!app?.addToHomeScreen) throw new Error();
      app.addToHomeScreen(); setRequested(true);
    } catch { setError('Не удалось открыть окно добавления. Обнови Telegram и повтори попытку.'); }
  };
  return <Card className="p-5 relative">
    {compact && <button type="button" aria-label="Скрыть подсказку" className="absolute right-3 top-3 p-2 text-white/50" onClick={()=>setDismissed(true)}><X size={16}/></button>}
    <div className="flex gap-3 pr-5"><div className="rounded-2xl bg-accent-500/15 p-3 h-fit text-accent-300"><Smartphone size={22}/></div><div>
      <h3 className="font-semibold text-white">BizBox в один клик</h3>
      <p className="text-sm text-white/60 mt-1">Добавь значок на главный экран телефона — открывай бизнес сразу.</p>
    </div></div>
    {status === 'added' ? <p className="flex gap-2 items-center text-success-400 mt-4 text-sm"><Check size={17}/>Значок уже добавлен</p>
      : status === 'unsupported' ? <div className="text-sm text-white/65 mt-4 space-y-2"><p>Открой BizBox в последней версии Telegram на телефоне. Если этот способ не поддерживается, открой профиль бота и закрепи его чат для быстрого доступа.</p><a href={BOT_URL} className="text-accent-300 underline underline-offset-4">Открыть в Telegram</a></div>
      : <Button className="mt-4" disabled={status==='checking'} onClick={add}>{status==='checking'?'Проверяем устройство…':'Добавить на главный экран'}</Button>}
    {requested && status !== 'added' && <p role="status" className="text-xs text-white/60 mt-3">Подтверди добавление в окне Telegram. Если значок уже есть, повторно добавлять его не нужно.</p>}
    {error && <p role="alert" className="text-sm text-danger-400 mt-3">{error}</p>}
  </Card>;
}
