import { type ReactNode, type ButtonHTMLAttributes, cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DropdownProps {
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, children, align = 'right', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popupId = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      ref.current?.querySelector('button')?.focus();
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(o => !o)}>
        {isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(trigger)
          ? cloneElement(trigger, { 'aria-expanded': open, 'aria-controls': open ? popupId : undefined })
          : trigger}
      </div>
      {open && (
        <div id={popupId} className={cn(
          'absolute z-50 mt-3 min-w-[12rem] liquid-panel rounded-[22px] py-2 animate-scale-in origin-top',
          align === 'right' ? 'right-0' : 'left-0',
          className,
        )}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
}

export function DropdownItem({ onClick, children, icon, danger }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors text-left',
        danger ? 'text-danger-400 hover:bg-danger-500/10' : 'text-white/70 hover:text-white hover:bg-bg-hover',
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 glass-strong border border-border-strong rounded-lg text-2xs text-white/80 whitespace-nowrap z-50 animate-fade-in pointer-events-none">
          {content}
        </div>
      )}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}

export function ProgressBar({ value, max = 100, color = 'bg-accent-500', className }: ProgressBarProps) {
  return (
    <div className={cn('h-2 rounded-full bg-bg-base overflow-hidden', className)}>
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
    </div>
  );
}

interface SelectDropdownProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export function SelectDropdown({ value, onChange, options, placeholder = 'Все', className }: SelectDropdownProps) {
  const current = options.find(o => o.value === value);
  return (
    <Dropdown
      trigger={
        <button className={cn('inline-flex items-center gap-2 min-h-10 px-3.5 rounded-full liquid-control text-sm text-white/80 hover:border-border-strong transition-colors', className)}>
          <span className={value ? 'text-white' : 'text-white/40'}>{current?.label ?? placeholder}</span>
          <ChevronDown className="w-4 h-4 text-white/40" />
        </button>
      }
    >
      {(close) => (
        <>
          <DropdownItem onClick={() => { onChange(''); close(); }}>
            <span className="text-white/50">{placeholder}</span>
          </DropdownItem>
          {options.map(o => (
            <DropdownItem key={o.value} onClick={() => { onChange(o.value); close(); }}>
              <span className={o.value === value ? 'text-accent-400' : ''}>{o.label}</span>
            </DropdownItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}
