import { cn } from '@/lib/cn';

interface TabsProps {
  tabs: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div className={cn('liquid-inset flex gap-1 overflow-x-auto no-scrollbar rounded-full p-1', className)}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          type="button"
          aria-pressed={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'flex items-center justify-center gap-2 min-h-10 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-full transition-colors relative',
            value === tab.value ? 'liquid-control text-white' : 'text-white/60 hover:text-white/90',
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
