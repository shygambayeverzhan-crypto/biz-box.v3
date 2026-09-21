import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({ value, duration = 900, format, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current!);
    fromRef.current = display;
    startRef.current = 0;

    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(fromRef.current + (value - fromRef.current) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const formatted = format ? format(display) : Math.round(display).toLocaleString('ru-RU');
  return <span className={className}>{formatted}</span>;
}
