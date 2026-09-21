import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullScreenOnMobile?: boolean;
}

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', fullScreenOnMobile = true }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          'relative w-full bg-bg-surface border border-border-strong shadow-card-hover animate-fade-in-up',
          'rounded-t-3xl sm:rounded-2xl',
          fullScreenOnMobile && 'max-h-[92vh] sm:max-h-[88vh]',
          sizeMap[size],
        )}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-border shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">{title}</h2>
              {subtitle && <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors shrink-0 p-1 rounded-lg hover:bg-bg-hover">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-5 sm:p-6" style={{ maxHeight: fullScreenOnMobile ? 'calc(92vh - 8rem)' : undefined }}>
          {children}
        </div>
        {footer && <div className="p-5 sm:p-6 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Подтвердить', danger }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-bg-surface border border-border-strong rounded-2xl shadow-card-hover p-6 animate-scale-in">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/60 mt-2">{message}</p>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-bg-raised hover:bg-bg-hover text-white/80 text-sm font-medium transition-colors">
            Отмена
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={cn('flex-1 h-10 rounded-xl text-sm font-medium transition-colors text-white', danger ? 'bg-danger-500 hover:bg-danger-600' : 'bg-accent-500 hover:bg-accent-400')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
