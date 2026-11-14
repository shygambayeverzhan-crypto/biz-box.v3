import { cn } from '@/lib/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}
const sizes = {
  sm: { box: 'w-8 h-8', icon: 'w-[23px] h-[24px]', text: 'text-base' },
  md: { box: 'w-10 h-10', icon: 'w-[29px] h-[30px]', text: 'text-xl' },
  lg: { box: 'w-14 h-14', icon: 'w-10 h-11', text: 'text-2xl' },
};
export function Logo({ size='md', showText=true, className }: LogoProps) {
  const s=sizes[size];
  return <div className={cn('flex items-center gap-2.5', className)}>
    <span className={cn('biz-logo-tile', s.box)}>
      <svg viewBox="0 0 144 152" className={cn('biz-brand-mark',s.icon)} fill="none" aria-hidden="true">
        <path d="M30 28V119" stroke="currentColor" strokeWidth="20" strokeLinecap="round"/>
        <path d="M38 30H67C86 30 98 41 98 56C98 71 86 81 67 81H39" stroke="currentColor" strokeWidth="20" strokeLinejoin="round" strokeLinecap="round"/>
        <path d="M39 77H73C95 77 108 88 108 104C108 121 94 132 73 132H39" stroke="currentColor" strokeWidth="20" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
    </span>
    {showText && <span className={cn('font-extrabold tracking-tight text-white',s.text)}>Biz<span className="text-accent-400">Box</span></span>}
  </div>;
}
