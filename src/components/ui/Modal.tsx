import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

function useDialog(open: boolean, onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); }
      if (e.key !== 'Tab' || !panel.current) return;
      const controls = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { e.preventDefault(); panel.current.focus(); }
      else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);
  return panel;
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', fullScreenOnMobile = true }: ModalProps) {
  const panel = useDialog(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Диалог'}
        tabIndex={-1}
        className={cn(
          'relative w-full liquid-panel animate-fade-in-up flex flex-col',
          'rounded-t-[30px] sm:rounded-[30px]',
          fullScreenOnMobile && 'max-h-[92dvh] sm:max-h-[88dvh]',
          sizeMap[size],
        )}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-border shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">{title}</h2>
              {subtitle && <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>}
            </div>
            <button type="button" aria-label="Закрыть" onClick={onClose} className="text-white/60 hover:text-white transition-colors shrink-0 p-2 rounded-full hover:bg-bg-hover">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6" style={{ maxHeight: fullScreenOnMobile ? 'calc(92dvh - 8rem)' : undefined }}>
          {children}
        </div>
        {footer && <div className="p-5 sm:p-6 border-t border-white/10 shrink-0 pb-[max(1.25rem,var(--app-safe-bottom))]">{footer}</div>}
      </div>
    </div>, document.body,
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
  const panel = useDialog(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div ref={panel} tabIndex={-1} role="alertdialog" aria-modal="true" aria-label={title} className="relative w-full max-w-sm liquid-panel rounded-[30px] p-6 animate-scale-in">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/60 mt-2">{message}</p>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 min-h-11 rounded-full liquid-control hover:bg-bg-hover text-white/80 text-sm font-medium transition-colors">
            Отмена
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={cn('flex-1 min-h-11 rounded-full text-sm font-medium transition-colors', danger ? 'bg-danger-500 hover:bg-danger-600 text-white' : 'liquid-primary')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>, document.body,
  );
}
