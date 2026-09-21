import { useState, useMemo } from 'react';
import { Plus, Search, Users, Phone, Mail, TrendingUp, Trash2, ArrowLeft, MessageSquare, Activity, Phone as PhoneIcon, Calendar as CalIcon } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import type { Client, ClientStatus, ClientActivity } from '@/types';
import { formatCurrency, formatDate, relativeDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Input, Field, Select, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';

const statusConfig: Record<ClientStatus, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  active: { label: 'Активный', tone: 'success' },
  potential: { label: 'Потенциальный', tone: 'warning' },
  archived: { label: 'Архив', tone: 'neutral' },
};

const activityIcons: Record<ClientActivity['type'], typeof Phone> = {
  call: PhoneIcon, meeting: CalIcon, email: Mail, deal: TrendingUp, payment: TrendingUp,
};

const activityLabels: Record<ClientActivity['type'], string> = {
  call: 'Звонок', meeting: 'Встреча', email: 'Email', deal: 'Сделка', payment: 'Платёж',
};

const filters = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'potential', label: 'Потенциальные' },
  { value: 'archived', label: 'Архив' },
];

export function ClientsPage() {
  const { state, addClient, deleteClient, addClientNote, addClientActivity } = useApp();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return state.clients.filter(c => {
      if (filter !== 'all' && c.status !== filter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.company.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [state.clients, filter, search]);

  const totalDealValue = filtered.reduce((s, c) => s + c.dealValue, 0);

  // Sync selected client with state
  const currentClient = selectedClient ? state.clients.find(c => c.id === selectedClient.id) || null : null;

  if (currentClient) {
    return <ClientProfile client={currentClient} onBack={() => setSelectedClient(null)} onDelete={(id) => { setDeleteId(id); }} onAddNote={(text) => { addClientNote(currentClient.id, text); toast.success('Заметка добавлена'); }} onAddActivity={(type, text) => { addClientActivity(currentClient.id, type, text); toast.success('Активность добавлена'); }} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Клиенты"
        subtitle={`Всего: ${state.clients.length} · Сумма сделок: ${formatCurrency(totalDealValue)}`}
        actions={<Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> Добавить</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск клиентов..." className="pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={cn('px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                filter === f.value ? 'bg-accent-500/10 text-accent-300 border border-accent-500/30' : 'bg-bg-card text-white/50 border border-border')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<Users className="w-6 h-6" />} title="Клиенты не найдены" description="Добавьте первого клиента или измените фильтры" action={<Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> Добавить клиента</Button>} /></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block p-2">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="text-2xs font-medium text-white/40 uppercase py-3 px-3">Клиент</th>
                  <th className="text-2xs font-medium text-white/40 uppercase py-3 px-3">Контакт</th>
                  <th className="text-2xs font-medium text-white/40 uppercase py-3 px-3">Статус</th>
                  <th className="text-2xs font-medium text-white/40 uppercase py-3 px-3 text-right">Сумма сделок</th>
                  <th className="text-2xs font-medium text-white/40 uppercase py-3 px-3">Активность</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => setSelectedClient(c)} className="border-b border-border/subtle hover:bg-bg-hover/50 transition-colors cursor-pointer group">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} color={c.avatarColor} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{c.name}</p>
                          <p className="text-2xs text-white/40 truncate">{c.company}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-sm text-white/60">{c.phone}</td>
                    <td className="py-3 px-3"><Badge tone={statusConfig[c.status].tone}>{statusConfig[c.status].label}</Badge></td>
                    <td className="py-3 px-3 text-sm font-semibold text-white tabular-nums text-right">{formatCurrency(c.dealValue)}</td>
                    <td className="py-3 px-3 text-2xs text-white/40">{relativeDate(c.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(c => (
              <Card key={c.id} hover className="p-4" onClick={() => setSelectedClient(c)}>
                <div className="flex items-start gap-3">
                  <Avatar name={c.name} color={c.avatarColor} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{c.name}</p>
                        <p className="text-2xs text-white/40 truncate">{c.company}</p>
                      </div>
                      <Badge tone={statusConfig[c.status].tone}>{statusConfig[c.status].label}</Badge>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-2xs text-white/40">{relativeDate(c.lastActivity)}</span>
                      <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(c.dealValue)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={(data) => { addClient(data); toast.success('Клиент добавлен', data.name); setAddOpen(false); }} />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deleteClient(deleteId); toast.success('Клиент удалён'); setSelectedClient(null); } }} title="Удалить клиента?" message="Клиент и все связанные данные будут удалены." confirmLabel="Удалить" danger />
    </div>
  );
}

function AddClientModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (c: Omit<Client, 'id' | 'notes' | 'activities'>) => void }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<ClientStatus>('potential');
  const [dealValue, setDealValue] = useState('');

  const handleAdd = () => {
    if (!name) return;
    onAdd({
      name, company: company || '—', email: email || '—', phone: phone || '—',
      status, dealValue: parseFloat(dealValue.replace(/\s/g, '').replace(',', '.')) || 0,
      lastActivity: new Date().toISOString(), avatarColor: ['accent', 'success', 'warning'][Math.floor(Math.random() * 3)],
    });
    setName(''); setCompany(''); setEmail(''); setPhone(''); setDealValue(''); setStatus('potential');
  };

  return (
    <Modal open={open} onClose={onClose} title="Добавить клиента" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Имя" required><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ержан М." autoFocus /></Field>
          <Field label="Компания"><Input value={company} onChange={e => setCompany(e.target.value)} placeholder="ТОО «Альфа»" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.kz" /></Field>
          <Field label="Телефон"><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 701 ..." /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Статус"><Select value={status} onChange={e => setStatus(e.target.value as ClientStatus)} options={[{ value: 'active', label: 'Активный' }, { value: 'potential', label: 'Потенциальный' }, { value: 'archived', label: 'Архив' }]} /></Field>
          <Field label="Сумма сделки, ₸"><Input type="text" inputMode="decimal" value={dealValue} onChange={e => setDealValue(e.target.value)} placeholder="0" /></Field>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={handleAdd} disabled={!name}>Добавить</Button>
        </div>
      </div>
    </Modal>
  );
}

function ClientProfile({ client, onBack, onDelete, onAddNote, onAddActivity }: {
  client: Client; onBack: () => void; onDelete: (id: string) => void;
  onAddNote: (text: string) => void; onAddActivity: (type: ClientActivity['type'], text: string) => void;
}) {
  const [noteText, setNoteText] = useState('');
  const [activityOpen, setActivityOpen] = useState(false);
  const [actType, setActType] = useState<ClientActivity['type']>('call');
  const [actText, setActText] = useState('');

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    onAddNote(noteText.trim());
    setNoteText('');
  };

  const handleSaveActivity = () => {
    if (!actText.trim()) return;
    onAddActivity(actType, actText.trim());
    setActText(''); setActivityOpen(false);
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Назад к клиентам
      </button>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar name={client.name} color={client.avatarColor} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{client.name}</h1>
            <p className="text-sm text-white/50">{client.company}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge tone={statusConfig[client.status].tone}>{statusConfig[client.status].label}</Badge>
              <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(client.dealValue)}</span>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={() => onDelete(client.id)}><Trash2 className="w-3.5 h-3.5" /> Удалить</Button>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Контакты</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-bg-base flex items-center justify-center text-white/40"><Mail className="w-4 h-4" /></div><div><p className="text-2xs text-white/40">Email</p><p className="text-sm text-white">{client.email}</p></div></div>
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-bg-base flex items-center justify-center text-white/40"><Phone className="w-4 h-4" /></div><div><p className="text-2xs text-white/40">Телефон</p><p className="text-sm text-white">{client.phone}</p></div></div>
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-bg-base flex items-center justify-center text-white/40"><Activity className="w-4 h-4" /></div><div><p className="text-2xs text-white/40">Последняя активность</p><p className="text-sm text-white">{relativeDate(client.lastActivity)}</p></div></div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">История активности</h3>
            <Button size="sm" variant="secondary" onClick={() => setActivityOpen(true)}><Plus className="w-3.5 h-3.5" /> Добавить</Button>
          </div>
          {client.activities.length === 0 ? (
            <p className="text-sm text-white/40 py-6 text-center">Нет активности</p>
          ) : (
            <div className="space-y-3">
              {client.activities.map(a => {
                const Icon = activityIcons[a.type];
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-2xs text-accent-300">{activityLabels[a.type]}</span>
                        <span className="text-2xs text-white/30">{formatDate(a.date)}</span>
                      </div>
                      <p className="text-sm text-white/80 mt-0.5">{a.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Заметки</h3>
        <div className="flex gap-2 mb-4">
          <Input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Добавить заметку..." onKeyDown={e => e.key === 'Enter' && handleSaveNote()} />
          <Button onClick={handleSaveNote} disabled={!noteText.trim()}><MessageSquare className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-2">
          {client.notes.length === 0 ? (
            <p className="text-sm text-white/40 py-4 text-center">Заметок пока нет</p>
          ) : (
            client.notes.map(n => (
              <div key={n.id} className="p-3 rounded-xl bg-bg-base border border-border">
                <p className="text-sm text-white/80">{n.text}</p>
                <p className="text-2xs text-white/30 mt-1">{formatDate(n.date)}</p>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal open={activityOpen} onClose={() => setActivityOpen(false)} title="Добавить активность" size="sm">
        <div className="space-y-4">
          <Field label="Тип">
            <Select value={actType} onChange={e => setActType(e.target.value as ClientActivity['type'])} options={(Object.keys(activityLabels) as ClientActivity['type'][]).map(t => ({ value: t, label: activityLabels[t] }))} />
          </Field>
          <Field label="Описание"><Textarea rows={2} value={actText} onChange={e => setActText(e.target.value)} placeholder="Что произошло?" autoFocus /></Field>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setActivityOpen(false)}>Отмена</Button>
            <Button className="flex-1" onClick={handleSaveActivity} disabled={!actText.trim()}>Добавить</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default SubscriptionPage;
