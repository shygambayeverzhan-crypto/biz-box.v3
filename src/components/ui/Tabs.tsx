import { cn } from '@/lib/cn';

interface TabsProps {
  tabs: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto no-scrollbar border-b border-border', className)}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative',
            value === tab.value ? 'text-white' : 'text-white/50 hover:text-white/70',
          )}
        >
          {tab.icon}
          {tab.label}
          {value === tab.value && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
