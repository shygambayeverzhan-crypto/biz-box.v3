import { useState } from 'react';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

type AuthMode = 'login' | 'register' | 'forgot';

export function AuthPage() {
  const { login } = useApp();
  const toast = useToast();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'forgot') {
      toast.success('Ссылка отправлена', 'Инструкции по восстановлению отправлены на ваш email.');
      setMode('login');
      return;
    }
    if (!email || !password) {
      toast.error('Заполните все поля', 'Email и пароль обязательны.');
      return;
    }
    if (mode === 'register' && !name) {
      toast.error('Укажите имя', 'Поле «Имя» обязательно для регистрации.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const result = login(email);
      setLoading(false);
      if (result.isNew) {
        toast.success('Аккаунт создан', 'Давайте настроим ваш бизнес.');
      } else {
        toast.success('С возвращением!', 'Вы успешно вошли в BIZBOX.');
      }
    }, 600);
  };

  const demoLogin = () => {
    setLoading(true);
    setTimeout(() => {
      login('demo@bizbox.app');
      setLoading(false);
      toast.success('Демо-вход', 'Вы вошли как демонстрационный пользователь.');
    }, 400);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-bg-surface flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent-500/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent-700/15 blur-3xl" />
        </div>
        <div className="relative">
          <Logo size="lg" />
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
            Весь бизнес —<br />под контролем.
          </h1>
          <p className="text-white/50 mt-4 text-lg leading-relaxed">
            Операционная система для малого бизнеса. Финансы, документы, клиенты, задачи и специалисты — в одном месте.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            {['Финансы', 'Документы', 'CRM', 'Задачи', 'Специалисты'].map(tag => (
              <span key={tag} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60">{tag}</span>
            ))}
          </div>
        </div>
        <div className="relative text-sm text-white/30">
          © 2026 BIZBOX. Все права защищены.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size="lg" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {mode === 'login' && 'С возвращением'}
              {mode === 'register' && 'Создать аккаунт'}
              {mode === 'forgot' && 'Восстановление пароля'}
            </h2>
            <p className="text-sm text-white/50 mt-1.5">
              {mode === 'login' && 'Войдите в свой бизнес-аккаунт'}
              {mode === 'register' && 'Начните управлять бизнесом сегодня'}
              {mode === 'forgot' && 'Введите email для восстановления'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <Field label="Имя" required>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ержан" autoFocus />
              </Field>
            )}
            <Field label="Email" required>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" autoFocus={mode !== 'register'} />
              </div>
            </Field>
            {mode !== 'forgot' && (
              <Field label="Пароль" required>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pl-9 pr-9" />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button type="button" onClick={() => setMode('forgot')} className="text-xs text-white/40 hover:text-white/70 transition-colors">
                  Забыли пароль?
                </button>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Загрузка...' : (
                <>
                  {mode === 'login' && 'Войти'}
                  {mode === 'register' && 'Создать аккаунт'}
                  {mode === 'forgot' && 'Отправить ссылку'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-2xs text-white/30">или</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Button variant="outline" size="lg" className="w-full" onClick={demoLogin} disabled={loading}>
                <Sparkles className="w-4 h-4 text-accent-400" />
                Войти в демо-режим
              </Button>
              <p className="text-2xs text-white/30 text-center mt-3">
                demo@bizbox.app · demo123
              </p>
            </>
          )}

          <p className="text-sm text-white/50 text-center mt-8">
            {mode === 'login' && (
              <>Нет аккаунта? <button onClick={() => setMode('register')} className="text-accent-400 hover:text-accent-300 font-medium">Создать</button></>
            )}
            {mode === 'register' && (
              <>Уже есть аккаунт? <button onClick={() => setMode('login')} className="text-accent-400 hover:text-accent-300 font-medium">Войти</button></>
            )}
            {mode === 'forgot' && (
              <><button onClick={() => setMode('login')} className="text-accent-400 hover:text-accent-300 font-medium">Назад к входу</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
export default SubscriptionPage;
