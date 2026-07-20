import { cn } from '@/lib/utils/cn';
import type { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline';
}

const VARIANT_CLS: Record<string, string> = {
  default:     'bg-indigo-100 text-indigo-700 border-indigo-200',
  secondary:   'bg-slate-100  text-slate-600  border-slate-200',
  success:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  destructive: 'bg-red-100    text-red-700    border-red-200',
  warning:     'bg-amber-100  text-amber-700  border-amber-200',
  outline:     'bg-transparent text-slate-600 border-slate-300',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        VARIANT_CLS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
