import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

const colorMap: Record<string, string> = {
  accent: 'bg-accent-500/10 text-accent-400 border-accent-500/20',
  success: 'bg-accent-500/10 text-accent-400 border-accent-500/20',
  warning: 'bg-bg-raised text-white/70 border-border',
  danger: 'bg-bg-raised text-white/70 border-border',
  neutral: 'bg-bg-raised text-white/70 border-border',
};

interface AvatarProps {
  name: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  xs: 'w-7 h-7 text-2xs',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
};

export function Avatar({ name, color = 'accent', size = 'md', className }: AvatarProps) {
  return (
    <div className={cn(
      'rounded-full border flex items-center justify-center font-semibold shrink-0',
      colorMap[color] || colorMap.accent,
      sizeMap[size],
      className,
    )}>
      {initials(name)}
    </div>
  );
}
