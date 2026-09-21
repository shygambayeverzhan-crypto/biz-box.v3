import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  children: ReactNode;
}

export function Card({ hover, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-bg-card border border-border rounded-2xl shadow-card',
        hover && 'hover:border-border-strong hover:shadow-card-hover transition-all duration-300 cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
