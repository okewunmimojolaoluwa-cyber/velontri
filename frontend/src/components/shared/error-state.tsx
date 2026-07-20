import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'There was an error loading this content.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 py-14 text-center px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 mb-4">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <p className="text-[14px] font-semibold text-red-800 mb-1">{title}</p>
      <p className="text-[12px] text-red-600 max-w-xs leading-relaxed">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 h-9 rounded-xl border border-red-200 bg-white px-4 text-[13px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
