import { useState, useMemo } from 'react';
import { Search, Star, MapPin, MessageSquare, Briefcase } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import type { Specialist } from '@/types';
import { formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Input, Textarea, Field } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';

const categories = ['Все', 'Бухгалтерия', 'Юристы', 'Маркетинг', 'Дизайн', 'HR', 'IT', 'Фото и видео'];

export function SpecialistsPage() {
  const { state } = useApp();
  const toast = useToast();
  const [category, setCategory] = useState('Все');
  const [search, setSearch] = useState('');
  const [contactSpec, setContactSpec] = useState<Specialist | null>(null);

  const filtered = useMemo(() => {
    return state.specialists.filter(s => {
      if (category !== 'Все' && s.category !== category) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.profession.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [state.specialists, category, search]);

  return (
    <div className="space-y-6">
      <PageHeader title="Специалисты" subtitle="Найдите профессионалов для вашего бизнеса" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени или профессии..." className="pl-9" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={cn('px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
              category === c ? 'bg-accent-500/10 text-accent-300 border border-accent-500/30' : 'bg-bg-card text-white/50 border border-border hover:text-white/70')}>
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<Briefcase className="w-6 h-6" />} title="Специалисты не найдены" description="Измените фильтры или поисковый запрос" /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(spec => (
            <Card key={spec.id} hover className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <Avatar name={spec.name} color={spec.avatarColor} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{spec.name}</p>
                  <p className="text-xs text-white/50">{spec.profession}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-3.5 h-3.5 fill-warning-500 text-warning-500" />
                    <span className="text-xs font-medium text-white">{spec.rating.toFixed(1)}</span>
                    <span className="text-2xs text-white/40">· {spec.projects} проектов</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/50 mb-3 line-clamp-2">{spec.bio}</p>
              <div className="flex items-center gap-3 mb-4 text-2xs text-white/40">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{spec.location}</span>
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{spec.category}</span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <p className="text-2xs text-white/40">от</p>
                  <p className="text-sm font-bold text-white tabular-nums">{formatCurrency(spec.price)}</p>
                </div>
                <Button size="sm" onClick={() => setContactSpec(spec)}><MessageSquare className="w-3.5 h-3.5" /> Связаться</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ContactModal spec={contactSpec} onClose={() => setContactSpec(null)} onSend={() => { toast.success('Запрос отправлен', 'Специалист свяжется с вами в ближайшее время.'); setContactSpec(null); }} />
    </div>
  );
}

function ContactModal({ spec, onClose, onSend }: { spec: Specialist | null; onClose: () => void; onSend: () => void }) {
  const [message, setMessage] = useState('');
  return (
    <Modal open={!!spec} onClose={onClose} title="Связаться со специалистом" size="md">
      {spec && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-base border border-border">
            <Avatar name={spec.name} color={spec.avatarColor} size="md" />
            <div>
              <p className="text-sm font-semibold text-white">{spec.name}</p>
              <p className="text-xs text-white/50">{spec.profession} · {spec.category}</p>
            </div>
          </div>
          <Field label="Сообщение">
            <Textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder={`Здравствуйте, ${spec.name}! Меня интересует...`} autoFocus />
          </Field>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Отмена</Button>
            <Button className="flex-1" onClick={onSend} disabled={!message.trim()}>Отправить</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
