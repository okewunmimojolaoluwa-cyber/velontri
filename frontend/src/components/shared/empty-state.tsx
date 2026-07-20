import { PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Optional icon override */
  icon?: ReactNode;
  /** Optional action area */
  action?: ReactNode;
}

/**
 * EmptyState – consistent empty-list placeholder.
 */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mb-4 text-slate-300">
        {icon ?? <PackageOpen className="h-7 w-7" />}
      </div>
      <p className="text-[15px] font-semibold text-slate-900 mb-1">{title}</p>
      {description && (
        <p className="text-[13px] text-slate-400 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
