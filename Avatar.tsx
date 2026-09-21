import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

const colorMap: Record<string, string> = {
  accent: 'from-accent-500/30 to-accent-700/20 text-accent-300 border-accent-500/30',
  success: 'from-success-500/30 to-success-600/20 text-success-400 border-success-500/30',
  warning: 'from-warning-500/30 to-warning-600/20 text-warning-400 border-warning-500/30',
  danger: 'from-danger-500/30 to-danger-600/20 text-danger-400 border-danger-500/30',
  neutral: 'from-white/10 to-white/5 text-white/70 border-white/15',
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
      'rounded-full bg-gradient-to-br border flex items-center justify-center font-semibold shrink-0',
      colorMap[color] || colorMap.accent,
      sizeMap[size],
      className,
    )}>
      {initials(name)}
    </div>
  );
}
