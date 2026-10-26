import { useState, useEffect, useRef, useId } from 'react';
import { cn } from '@/lib/cn';
import { chartPoints } from '@/lib/chartGeometry';

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  gradientId?: string;
  formatValue?: (n: number) => string;
  className?: string;
}

export function LineChart({ data, height = 200, color = '#78AEFF', gradientId, formatValue, className }: LineChartProps) {
  const chartId = useId();
  const fillId = gradientId || `chart-${chartId.replace(/:/g, '')}`;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setProgress(1); return; }
    setProgress(0);
    const start = performance.now();
    const dur = 1000;
    const step = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current!);
  }, [data]);

  const width = 600;
  const padX = 12;
  const padY = 18;

  const points = chartPoints(data, width, height);
  const animatedPoints = chartPoints(data, width, height, progress);
  const activePoint = hoverIdx === null ? null : points[hoverIdx];

  const linePath = animatedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${animatedPoints[animatedPoints.length - 1]?.x ?? 0} ${height - padY} L ${animatedPoints[0]?.x ?? 0} ${height - padY} Z`;

  return (
    <div className={cn('relative w-full pb-7', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible" style={{ height }} preserveAspectRatio="none" role="img" aria-label={`Выручка по месяцам: ${data.map(d => `${d.label}: ${formatValue ? formatValue(d.value) : d.value}`).join(', ')}`}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={padX} x2={width - padX} y1={padY + f * (height - padY * 2)} y2={padY + f * (height - padY * 2)} stroke="#1E2A44" strokeWidth="1" strokeDasharray="4 4" opacity={0.5} />
        ))}
        <path d={areaPath} fill={`url(#${fillId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {animatedPoints.map((p, i) => (
          <g key={i}>
            <rect x={p.x - (width - padX * 2) / data.length / 2} y={0} width={(width - padX * 2) / data.length} height={height} fill="transparent"
              onPointerDown={() => setHoverIdx(i)} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} />
            {hoverIdx === i && (
              <>
                <line x1={p.x} x2={p.x} y1={padY} y2={height - padY} stroke={color} strokeWidth="1" opacity={0.4} />
                <circle cx={p.x} cy={p.y} r="5" fill={color} stroke="#070A12" strokeWidth="2" />
              </>
            )}
            <circle cx={p.x} cy={p.y} r="2.5" fill={color} opacity={progress === 1 ? 0.8 : 0} />
          </g>
        ))}
      </svg>
      {activePoint && progress === 1 && (
        <div
          className="absolute pointer-events-none glass-strong border border-border-strong rounded-lg px-3 py-2 text-xs whitespace-nowrap z-10 -translate-x-1/2"
          style={{ left: `${Math.max(18, Math.min(82, activePoint.x / width * 100))}%`, top: 4 }}
        >
          <div className="text-white/60">{activePoint.label}</div>
          <div className="text-white font-semibold mt-0.5">{formatValue ? formatValue(activePoint.value) : activePoint.value}</div>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 flex justify-between px-1">
        {data.map((d, i) => (
          <span key={i} className="text-2xs text-white/40">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  formatValue?: (n: number) => string;
  className?: string;
}

export function BarChart({ data, height = 200, formatValue, className }: BarChartProps) {
  const [progress, setProgress] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    const dur = 800;
    const step = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current!);
  }, [data]);

  const max = Math.max(...data.map(d => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group"
            onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
            {hoverIdx === i && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full glass-strong border border-border-strong rounded-lg px-2.5 py-1.5 text-2xs whitespace-nowrap z-10">
                <div className="text-white font-semibold">{formatValue ? formatValue(d.value) : d.value}</div>
                <div className="text-white/40">{d.label}</div>
              </div>
            )}
            <div
              className="w-full max-w-[2.5rem] rounded-t-lg transition-all duration-300 relative overflow-hidden"
              style={{
                height: `${(d.value / max) * progress * 100}%`,
                background: d.color || 'linear-gradient(180deg, #0066FF 0%, #003D99 100%)',
                minHeight: progress > 0 ? '4px' : '0',
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-2 mt-3">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-2xs text-white/40 truncate">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  className?: string;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({ data, size = 180, thickness = 28, className, centerLabel, centerValue }: DonutChartProps) {
  const [progress, setProgress] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    const dur = 900;
    const step = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current!);
  }, [data]);

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn('flex flex-col sm:flex-row items-center gap-6', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#10182B" strokeWidth={thickness} />
          {data.map((d, i) => {
            const fraction = (d.value / total) * progress;
            const dash = fraction * circumference;
            const gap = circumference - dash;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={hoverIdx === i ? thickness + 4 : thickness}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ opacity: hoverIdx === null || hoverIdx === i ? 1 : 0.4 }}
              />
            );
            offset += (d.value / total) * circumference;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hoverIdx !== null ? (
            <>
              <span className="text-lg font-bold text-white">{Math.round((data[hoverIdx].value / total) * 100)}%</span>
              <span className="text-2xs text-white/50">{data[hoverIdx].label}</span>
            </>
          ) : (
            <>
              <span className="text-lg font-bold text-white">{centerValue}</span>
              <span className="text-2xs text-white/50">{centerLabel}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 w-full">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2.5 cursor-pointer" onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-sm text-white/70 flex-1 truncate">{d.label}</span>
            <span className="text-sm font-medium text-white">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ComparisonChartProps {
  data: { label: string; income: number; expense: number }[];
  height?: number;
  formatValue?: (n: number) => string;
  className?: string;
}

export function ComparisonChart({ data, height = 220, formatValue, className }: ComparisonChartProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    const dur = 800;
    const step = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current!);
  }, [data]);

  const max = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end justify-between gap-3 sm:gap-4" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div className="flex items-end gap-1 w-full justify-center h-full">
              <div className="w-3 sm:w-4 rounded-t-md transition-all duration-500"
                style={{ height: `${(d.income / max) * progress * 100}%`, background: 'linear-gradient(180deg, #0066FF, #003D99)', minHeight: progress > 0 ? '3px' : 0 }} title={`Доход: ${formatValue?.(d.income) ?? d.income}`} />
              <div className="w-3 sm:w-4 rounded-t-md transition-all duration-500"
                style={{ height: `${(d.expense / max) * progress * 100}%`, background: 'linear-gradient(180deg, #EF4444, #991B1B)', minHeight: progress > 0 ? '3px' : 0 }} title={`Расход: ${formatValue?.(d.expense) ?? d.expense}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-3 sm:gap-4 mt-3">
        {data.map((d, i) => <span key={i} className="flex-1 text-center text-2xs text-white/40">{d.label}</span>)}
      </div>
    </div>
  );
}
