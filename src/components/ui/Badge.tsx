import { cn } from '@/lib/cn';

type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral' | 'blue';

const tones: Record<Tone, string> = {
  accent: 'bg-accent-500/15 text-accent-300 border-accent-500/20',
  success: 'bg-success-500/15 text-success-400 border-success-500/20',
  warning: 'bg-warning-500/15 text-warning-400 border-warning-500/20',
  danger: 'bg-danger-500/15 text-danger-400 border-danger-500/20',
  neutral: 'bg-white/5 text-white/60 border-white/10',
  blue: 'bg-accent-500/10 text-accent-300 border-accent-500/20',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-medium border', tones[tone], className)}>
      {children}
    </span>
  );
}
