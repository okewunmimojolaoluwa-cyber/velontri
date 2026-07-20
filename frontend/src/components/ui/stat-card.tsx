import { cn } from '@/lib/utils/cn';
import type { ElementType, HTMLAttributes } from 'react';

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: ElementType;
  color?: string;
  bg?: string;
  change?: number;
}

export function StatCard({ label, value, icon: Icon, color = '#4F46E5', bg = '#eef2ff', change, className, ...props }: StatCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm',
        className,
      )}
      {...props}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: color }} />
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: bg }}>
            <Icon className="h-4 w-4" style={{ color }} strokeWidth={2} />
          </div>
        )}
      </div>
      <p className="text-[1.4rem] font-black text-slate-900 tracking-tight leading-none">{value}</p>
      {change !== undefined && change !== 0 && (
        <p className={`mt-1.5 text-[11px] font-semibold ${change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {change > 0 ? '+' : ''}{change}%
        </p>
      )}
    </div>
  );
}
