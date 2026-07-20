import { cn } from '@/lib/utils/cn';

/**
 * Skeleton – loading placeholder that pulses.
 * Drop-in replacement for shadcn/ui skeleton.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-slate-100', className)}
      {...props}
    />
  );
}
