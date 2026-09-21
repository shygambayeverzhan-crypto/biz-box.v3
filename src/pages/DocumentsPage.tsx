import { useState, useMemo } from 'react';
import {
  Plus, Upload, Search, FileText, FileSignature, Receipt, FileBarChart, FileEdit,
  Trash2, Eye, Download, FileCheck,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useToast } from '@/store/ToastContext';
import type { DocumentItem, DocumentStatus } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Field, Select, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';

const statusConfig: Record<DocumentStatus, { label: string; tone: 'neutral' | 'warning' | 'success' | 'accent' }> = {
  draft: { label: 'Черновик', tone: 'neutral' },
  signing: { label: 'На подписи', tone: 'warning' },
  signed: { label: 'Подписан', tone: 'accent' },
  paid: { label: 'Оплачен', tone: 'success' },
};

const typeConfig: Record<DocumentItem['type'], { label: string; icon: typeof FileText; color: string }> = {
  contract: { label: 'Договор', icon: FileSignature, color: 'bg-accent-500/10 text-accent-400' },
  invoice: { label: 'Счёт', icon: Receipt, color: 'bg-success-500/10 text-success-400' },
  act: { label: 'Акт', icon: FileCheck, color: 'bg-warning-500/10 text-warning-400' },
  proposal: { label: 'КП', icon: FileBarChart, color: 'bg-accent-300/10 text-accent-300' },
  template: { label: 'Шаблон', icon: FileEdit, color: 'bg-white/5 text-white/50' },
};

const categories = [
  { value: 'all', label: 'Все' },
  { value: 'contract', label: 'Договоры' },
  { value: 'invoice', label: 'Счета' },
  { value: 'act', label: 'Акты' },
  { value: 'proposal', label: 'Коммерческие предложения' },
  { value: 'template', label: 'Шаблоны' },
];

export function DocumentsPage() {
  const { state, addDocument, deleteDocument, updateDocument } = useApp();
  const toast = useToast();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return state.documents.filter(d => {
      if (category !== 'all' && d.type !== category) return false;
      if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.client.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [state.documents, category, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: state.documents.length };
    categories.slice(1).forEach(cat => { c[cat.value] = state.documents.filter(d => d.type === cat.value).length; });
    return c;
  }, [state.documents]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Документы"
        subtitle="Управление договорами, счетами и актами"
        actions={
          <>
            <Button variant="secondary" onClick={() => toast.info('Загрузка', 'Функция загрузки файлов будет доступна в следующей версии.')}>
              <Upload className="w-4 h-4" /> Загрузить
            </Button>
            <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Создать</Button>
          </>
        }
      />

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
              category === cat.value ? 'bg-accent-500/10 text-accent-300 border border-accent-500/30' : 'bg-bg-card text-white/50 border border-border hover:text-white/70',
            )}
          >
            {cat.label}
            <span className={cn('text-2xs px-1.5 py-0.5 rounded-full', category === cat.value ? 'bg-accent-500/20 text-accent-300' : 'bg-white/5 text-white/40')}>{counts[cat.value] || 0}</span>
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск документов..." className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<FileText className="w-6 h-6" />} title="Документы не найдены" description="Создайте первый документ или измените фильтры" action={<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Создать документ</Button>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => {
            const tc = typeConfig[doc.type];
            const Icon = tc.icon;
            return (
              <Card key={doc.id} hover className="p-5 group" onClick={() => setPreviewDoc(doc)}>
                <div className="flex items-start justify-between mb-4">
                  <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', tc.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <Badge tone={statusConfig[doc.status].tone}>{statusConfig[doc.status].label}</Badge>
                </div>
                <p className="text-sm font-medium text-white line-clamp-2 mb-1">{doc.name}</p>
                <p className="text-2xs text-white/40 mb-3">{doc.number}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">Клиент</span><span className="text-white/70 truncate ml-2 max-w-[10rem]">{doc.client}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Дата</span><span className="text-white/70">{formatDate(doc.date)}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Сумма</span><span className="text-white font-semibold tabular-nums">{doc.amount > 0 ? formatCurrency(doc.amount) : '—'}</span></div>
                </div>
                <div className="flex items-center gap-1 mt-4 pt-4 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setPreviewDoc(doc); }}><Eye className="w-3.5 h-3.5" /> Просмотр</Button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteId(doc.id); }} className="ml-auto p-2 rounded-lg text-white/40 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateDocumentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(data) => {
          addDocument(data);
          toast.success('Документ создан', data.name);
          setCreateOpen(false);
        }}
      />

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} onStatusChange={(id, status) => { updateDocument(id, { status }); toast.success('Статус обновлён', statusConfig[status].label); }} />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) { deleteDocument(deleteId); toast.success('Документ удалён'); } }}
        title="Удалить документ?"
        message="Документ будет удалён без возможности восстановления."
        confirmLabel="Удалить"
        danger
      />
    </div>
  );
}

function CreateDocumentModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (d: Omit<DocumentItem, 'id'>) => void }) {
  const { state } = useApp();
  const [type, setType] = useState<DocumentItem['type']>('contract');
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [amount, setAmount] = useState('');
  const [content, setContent] = useState('');

  const types: { value: DocumentItem['type']; label: string; icon: typeof FileText }[] = [
    { value: 'contract', label: 'Договор', icon: FileSignature },
    { value: 'invoice', label: 'Счёт', icon: Receipt },
    { value: 'act', label: 'Акт', icon: FileCheck },
    { value: 'proposal', label: 'КП', icon: FileBarChart },
  ];

  const handleCreate = () => {
    if (!name) return;
    const num = `${type[0].toUpperCase()}-2025/${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;
    onCreate({
      name, type, client: client || '—',
      date: new Date().toISOString().slice(0, 10),
      status: 'draft', amount: parseFloat(amount.replace(/\s/g, '').replace(',', '.')) || 0,
      number: num,
      content,
    });
    setName(''); setClient(''); setAmount(''); setContent(''); setType('contract');
  };

  return (
    <Modal open={open} onClose={onClose} title="Создать документ" subtitle="Выберите тип и заполните данные" size="md">
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {types.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.value} onClick={() => setType(t.value)}
                className={cn('flex flex-col items-center gap-2 py-3 rounded-xl border transition-all',
                  type === t.value ? 'bg-accent-500/10 border-accent-500/40 text-accent-400' : 'border-border bg-bg-base text-white/40')}>
                <Icon className="w-5 h-5" /><span className="text-xs">{t.label}</span>
              </button>
            );
          })}
        </div>
        <Field label="Название документа" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Договор на разработку сайта" autoFocus />
        </Field>
        <Field label="Клиент">
          <Select value={client} onChange={e => setClient(e.target.value)} options={state.clients.map(c => ({ value: c.company, label: `${c.company} — ${c.name}` }))} placeholder="Выберите клиента" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Сумма, ₸">
            <Input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Статус">
            <Select value="draft" onChange={() => {}} options={[{ value: 'draft', label: 'Черновик' }]} />
          </Field>
        </div>
        <Field label="Содержание">
          <Textarea rows={3} value={content} onChange={e => setContent(e.target.value)} placeholder="Краткое описание содержания документа..." />
        </Field>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={handleCreate} disabled={!name}>Создать</Button>
        </div>
      </div>
    </Modal>
  );
}

function DocumentPreviewModal({ doc, onClose, onStatusChange }: { doc: DocumentItem | null; onClose: () => void; onStatusChange: (id: string, status: DocumentStatus) => void }) {
  if (!doc) return null;
  const tc = typeConfig[doc.type];
  const Icon = tc.icon;
  return (
    <Modal open={!!doc} onClose={onClose} title={doc.name} subtitle={doc.number} size="lg">
      <div className="space-y-5">
        {/* Document preview */}
        <div className="bg-white text-gray-800 rounded-xl p-6 sm:p-8 shadow-inner">
          <div className="border-b border-gray-200 pb-4 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center text-white font-bold text-sm">B</div>
                  <span className="font-bold text-gray-900">BIZBOX</span>
                </div>
                <p className="text-xs text-gray-500">{tc.label} № {doc.number}</p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>от {formatDate(doc.date)}</p>
                <p>г. Астана</p>
              </div>
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">{doc.name}</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {doc.content || `Настоящий ${tc.label.toLowerCase()} оформлен между BIZBOX (Исполнитель) и ${doc.client} (Заказчик) на оказание услуг. Сумма ${tc.label.toLowerCase()}а составляет ${formatCurrency(doc.amount)}.`}
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div><p className="text-xs text-gray-400">Исполнитель</p><p className="font-medium text-gray-800">Nova Studio</p></div>
            <div><p className="text-xs text-gray-400">Заказчик</p><p className="font-medium text-gray-800">{doc.client}</p></div>
            <div><p className="text-xs text-gray-400">Сумма</p><p className="font-medium text-gray-800">{formatCurrency(doc.amount)}</p></div>
            <div><p className="text-xs text-gray-400">Статус</p><p className="font-medium text-gray-800">{statusConfig[doc.status].label}</p></div>
          </div>
          <div className="flex justify-between pt-6 border-t border-gray-200">
            <div><p className="text-xs text-gray-400 mb-6">Исполнитель</p><div className="w-32 border-b border-gray-300" /></div>
            <div><p className="text-xs text-gray-400 mb-6">Заказчик</p><div className="w-32 border-b border-gray-300" /></div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {doc.status === 'draft' && <Button size="sm" onClick={() => onStatusChange(doc.id, 'signing')}>Отправить на подпись</Button>}
          {doc.status === 'signing' && <Button size="sm" onClick={() => onStatusChange(doc.id, 'signed')}><FileCheck className="w-3.5 h-3.5" /> Подписать</Button>}
          {doc.status === 'signed' && <Button size="sm" variant="secondary" onClick={() => onStatusChange(doc.id, 'paid')}>Отметить оплаченным</Button>}
          <Button size="sm" variant="ghost" onClick={() => { onClose(); }}><Download className="w-3.5 h-3.5" /> Скачать PDF</Button>
          <div className="ml-auto flex items-center gap-2">
            <Icon className="w-4 h-4 text-white/30" />
            <Badge tone={statusConfig[doc.status].tone}>{statusConfig[doc.status].label}</Badge>
          </div>
        </div>
      </div>
    </Modal>
  );
}
export default SubscriptionPage;
