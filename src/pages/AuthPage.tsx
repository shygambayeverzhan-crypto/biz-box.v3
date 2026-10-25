import { ArrowUpRight, Wallet, Users, CheckSquare, Cloud, Sparkles } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { APP_VERSION, BOT_URL } from '@/lib/telegram';

export function AuthPage() {
  const { startDemo } = useApp();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg-base">
      <div className="w-full max-w-md">
        <Logo size="lg" />
        <div className="mt-10 inline-flex items-center gap-2 text-xs text-accent-300 border border-accent-500/20 bg-accent-500/10 rounded-full px-3 py-1.5"><Cloud className="w-3.5 h-3.5" /> С сохранением в Telegram</div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white leading-tight">Твой бизнес.<br />Всё на месте.</h1>
        <p className="mt-4 text-white/50 leading-relaxed">Доходы, клиенты и дела — в одном пространстве. Открой BizBox через Telegram: профиль будет доступен при следующем входе.</p>
        <div className="grid grid-cols-3 gap-3 my-8">
          {[{ icon: Wallet, name: 'Финансы' }, { icon: Users, name: 'Клиенты' }, { icon: CheckSquare, name: 'Задачи' }].map(({ icon: Icon, name }) => (
            <div key={name} className="rounded-2xl bg-bg-card border border-border p-4"><Icon className="w-5 h-5 text-accent-400 mb-3" /><span className="text-xs text-white/70">{name}</span></div>
          ))}
        </div>
        <a href={BOT_URL} className="flex items-center justify-center gap-2 w-full rounded-xl bg-accent-500 hover:bg-accent-400 py-3.5 font-medium text-white">Открыть в Telegram <ArrowUpRight className="w-4 h-4" /></a>
        <Button variant="ghost" className="w-full mt-3" onClick={startDemo}><Sparkles className="w-4 h-4" /> Посмотреть демо</Button>
        <p className="text-xs text-white/30 text-center mt-3">Демо содержит примеры и не сохраняет изменения.</p>
        <p className="text-[11px] text-white/25 text-center mt-8">BizBox · {APP_VERSION}</p>
      </div>
    </div>
  );
}
export default AuthPage;
