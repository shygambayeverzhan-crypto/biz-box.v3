import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-4', className)}>
      <div className="w-14 h-14 rounded-2xl bg-bg-base border border-border flex items-center justify-center text-white/30 mb-4">
        {icon}
      </div>
      <h3 className="text-base font-medium text-white/80">{title}</h3>
      {description && <p className="text-sm text-white/40 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-2xl', className)} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <div className="skeleton w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="skeleton h-3 w-1/4 rounded" />
      </div>
      <div className="skeleton h-6 w-16 rounded" />
    </div>
  );
}
