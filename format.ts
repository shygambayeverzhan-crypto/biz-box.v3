export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount);
  return '₸ ' + rounded.toLocaleString('ru-RU').replace(/,/g, ' ');
}

export function formatCurrencyShort(amount: number): string {
  if (amount >= 1_000_000) {
    return '₸ ' + (amount / 1_000_000).toFixed(1).replace('.', ',') + ' млн';
  }
  if (amount >= 1_000) {
    return '₸ ' + Math.round(amount / 1000) + ' тыс';
  }
  return '₸ ' + amount;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function relativeDate(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Завтра';
  if (diffDays === -1) return 'Вчера';
  if (diffDays > 1 && diffDays <= 7) return `Через ${diffDays} дн.`;
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} дн. назад`;
  return formatDate(iso);
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
