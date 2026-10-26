import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'liquid-primary',
  secondary: 'liquid-control hover:bg-white/10 text-white',
  ghost: 'text-white/75 hover:text-white hover:bg-white/10',
  danger: 'bg-danger-500/90 hover:bg-danger-500 text-white',
  outline: 'border border-white/20 hover:border-accent-400/50 text-white/85 hover:text-white hover:bg-white/5',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3.5 py-1.5 text-xs gap-1.5 rounded-full',
  md: 'min-h-11 px-5 py-2.5 text-sm gap-2 rounded-full',
  lg: 'min-h-12 px-6 py-3 text-base gap-2 rounded-full',
  icon: 'h-11 w-11 rounded-full',
};

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-[background,box-shadow,transform,filter] duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
