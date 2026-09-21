import { useState } from 'react';
import { Check, ArrowRight, ArrowLeft, Wallet, FileText, Users, CheckSquare, UserCog, PartyPopper } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Input';
import type { BusinessProfile } from '@/types';
import { cn } from '@/lib/cn';

const industries = [
  { value: 'Digital agency', label: 'Digital-агентство' },
  { value: 'Retail', label: 'Розничная торговля' },
  { value: 'Services', label: 'Услуги' },
  { value: 'Consulting', label: 'Консалтинг' },
  { value: 'Cafe', label: 'Кафе / Ресторан' },
  { value: 'Construction', label: 'Строительство' },
  { value: 'Logistics', label: 'Логистика' },
  { value: 'Other', label: 'Другое' },
];

const employeeOptions = [
  { value: '1', label: 'Только я' },
  { value: '2-5', label: '2–5 человек' },
  { value: '6-15', label: '6–15 человек' },
  { value: '16-50', label: '16–50 человек' },
  { value: '50+', label: 'Более 50' },
];

const modules = [
  { key: 'finance', label: 'Финансы', icon: Wallet, desc: 'Учёт доходов и расходов' },
  { key: 'documents', label: 'Документы', icon: FileText, desc: 'Договоры, счета, акты' },
  { key: 'clients', label: 'Клиенты', icon: Users, desc: 'CRM и история сделок' },
  { key: 'tasks', label: 'Задачи', icon: CheckSquare, desc: 'Управление задачами' },
  { key: 'employees', label: 'Сотрудники', icon: UserCog, desc: 'Команда и зарплаты' },
];

export function OnboardingPage() {
  const { completeOnboarding, state } = useApp();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState<BusinessProfile>({
    name: '',
    industry: '',
    city: '',
    employeesCount: '',
    modules: ['finance', 'documents', 'clients', 'tasks', 'employees'],
  });

  const toggleModule = (key: string) => {
    setBusiness(b => ({
      ...b,
      modules: b.modules.includes(key) ? b.modules.filter(m => m !== key) : [...b.modules, key],
    }));
  };

  const canProceed = () => {
    if (step === 0) return business.name && business.industry && business.city && business.employeesCount;
    if (step === 1) return business.modules.length > 0;
    return true;
  };

  const next = () => {
    if (step < 2) setStep(s => s + 1);
    else {
      completeOnboarding(business);
      toast.success('BIZBOX готов!', 'Ваш бизнес успешно настроен. Добро пожаловать!');
    }
  };

  const userName = state.user?.name;

  return (
    <div className="min-h-screen flex flex-col bg-bg-base">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="flex justify-center mb-8">
            <Logo size="md" />
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {[0, 1, 2].map(i => (
              <div key={i} className={cn('flex-1 h-1.5 rounded-full transition-all duration-500', i <= step ? 'bg-accent-500' : 'bg-border')} />
            ))}
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card animate-fade-in-up" key={step}>
            {step === 0 && (
              <>
                <h2 className="text-xl font-bold text-white">Расскажите о бизнесе</h2>
                <p className="text-sm text-white/50 mt-1 mb-6">Это поможет настроить BIZBOX под ваши задачи.</p>
                <div className="space-y-4">
                  <Field label="Название бизнеса" required>
                    <Input value={business.name} onChange={e => setBusiness({ ...business, name: e.target.value })} placeholder="Nova Studio" autoFocus />
                  </Field>
                  <Field label="Сфера деятельности" required>
                    <Select value={business.industry} onChange={e => setBusiness({ ...business, industry: e.target.value })} options={industries} placeholder="Выберите сферу" />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Город" required>
                      <Input value={business.city} onChange={e => setBusiness({ ...business, city: e.target.value })} placeholder="Астана" />
                    </Field>
                    <Field label="Сотрудников" required>
                      <Select value={business.employeesCount} onChange={e => setBusiness({ ...business, employeesCount: e.target.value })} options={employeeOptions} placeholder="Выберите" />
                    </Field>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="text-xl font-bold text-white">Что хотите контролировать?</h2>
                <p className="text-sm text-white/50 mt-1 mb-6">Выберите модули для вашего бизнеса. Можно изменить позже.</p>
                <div className="space-y-2.5">
                  {modules.map(m => {
                    const selected = business.modules.includes(m.key);
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.key}
                        onClick={() => toggleModule(m.key)}
                        className={cn(
                          'w-full flex items-center gap-3.5 p-4 rounded-xl border transition-all duration-200 text-left',
                          selected ? 'bg-accent-500/10 border-accent-500/40' : 'bg-bg-base border-border hover:border-border-strong',
                        )}
                      >
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors', selected ? 'bg-accent-500/20 text-accent-400' : 'bg-white/5 text-white/40')}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{m.label}</p>
                          <p className="text-2xs text-white/40 mt-0.5">{m.desc}</p>
                        </div>
                        <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all', selected ? 'bg-accent-500 border-accent-500' : 'border-border-strong')}>
                          {selected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 2 && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center mx-auto mb-5 shadow-glow animate-scale-in">
                  <PartyPopper className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Ваш BIZBOX готов</h2>
                <p className="text-sm text-white/50 mt-2 max-w-xs mx-auto">
                  {userName}, мы настроили рабочее пространство для «{business.name}». Всё готово к работе.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {business.modules.map(m => {
                    const mod = modules.find(x => x.key === m);
                    if (!mod) return null;
                    const Icon = mod.icon;
                    return (
                      <span key={m} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500/10 border border-accent-500/20 text-2xs text-accent-300">
                        <Icon className="w-3.5 h-3.5" />
                        {mod.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep(s => s - 1)}>
                  <ArrowLeft className="w-4 h-4" /> Назад
                </Button>
              ) : <div />}
              <Button onClick={next} disabled={!canProceed()}>
                {step < 2 ? <>Далее <ArrowRight className="w-4 h-4" /></> : <>Перейти в BIZBOX <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default SubscriptionPage;
