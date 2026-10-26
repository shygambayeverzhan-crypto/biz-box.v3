import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 sm:mb-7">
      <div className="min-w-0">
        <h1 className="text-[27px] leading-tight sm:text-3xl font-semibold text-white tracking-[-0.035em]">{title}</h1>
        {subtitle && <p className="text-[13px] sm:text-sm leading-relaxed text-white/60 mt-1.5 max-w-xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
