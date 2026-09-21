import { cn } from '@/lib/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: 'w-7 h-7', text: 'text-base', icon: 'text-sm' },
  md: { box: 'w-9 h-9', text: 'text-lg', icon: 'text-base' },
  lg: { box: 'w-12 h-12', text: 'text-2xl', icon: 'text-xl' },
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const s = sizes[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className={cn('relative rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center font-bold text-white shadow-glow-sm', s.box)}>
        <span className={s.icon}>B</span>
      </div>
      {showText && <span className={cn('font-bold text-white tracking-tight', s.text)}>BIZBOX</span>}
    </div>
  );
}
