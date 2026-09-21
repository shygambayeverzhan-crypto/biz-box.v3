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
  primary: 'bg-accent-500 hover:bg-accent-400 text-white shadow-glow-sm hover:shadow-glow',
  secondary: 'bg-bg-raised hover:bg-bg-hover text-white border border-border',
  ghost: 'text-white/70 hover:text-white hover:bg-bg-hover',
  danger: 'bg-danger-500/90 hover:bg-danger-500 text-white',
  outline: 'border border-border-strong hover:border-accent-500/50 text-white/80 hover:text-white hover:bg-bg-hover',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
};

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap',
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
