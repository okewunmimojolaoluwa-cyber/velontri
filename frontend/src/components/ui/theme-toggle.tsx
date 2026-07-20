'use client';

import { useTheme } from '@/lib/hooks/use-theme';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ThemeToggleProps {
  /** 'icon' — just the icon button. 'pill' — pill with label. 'switch' — iOS-style toggle */
  variant?: 'icon' | 'pill' | 'switch';
  className?: string;
}

export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'switch') {
    return (
      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        role="switch"
        aria-checked={isDark}
        className={cn(
          'relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer items-center rounded-full',
          'border-2 border-transparent transition-colors duration-300 focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
          isDark ? 'bg-indigo-600' : 'bg-slate-200',
          className,
        )}
      >
        {/* Track icons */}
        <span className="absolute left-1 flex h-4 w-4 items-center justify-center opacity-60">
          <Sun className="h-3 w-3 text-amber-400" />
        </span>
        <span className="absolute right-1 flex h-4 w-4 items-center justify-center opacity-60">
          <Moon className="h-3 w-3 text-indigo-200" />
        </span>

        {/* Thumb */}
        <span
          className={cn(
            'pointer-events-none relative inline-flex h-5 w-5 transform items-center justify-center',
            'rounded-full shadow-lg ring-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            isDark
              ? 'translate-x-7 bg-white'
              : 'translate-x-0 bg-white',
          )}
        >
          {isDark
            ? <Moon className="h-3 w-3 text-indigo-600" />
            : <Sun className="h-3 w-3 text-amber-500" />}
        </span>
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={cn(
          'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold',
          'transition-all duration-200 select-none',
          isDark
            ? 'border-slate-600 bg-slate-800 text-slate-300 hover:border-indigo-500 hover:text-indigo-300'
            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600',
          className,
        )}
      >
        <span className="relative h-4 w-4">
          <Sun className={cn(
            'absolute inset-0 h-4 w-4 transition-all duration-300',
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
          )} />
          <Moon className={cn(
            'absolute inset-0 h-4 w-4 transition-all duration-300',
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0',
          )} />
        </span>
        {isDark ? 'Light' : 'Dark'}
      </button>
    );
  }

  // Default: icon only
  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-xl',
        'transition-all duration-200 select-none',
        isDark
          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
        className,
      )}
    >
      {/* Sun icon — visible in light mode */}
      <Sun className={cn(
        'absolute h-4 w-4 transition-all duration-300',
        isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
      )} />
      {/* Moon icon — visible in dark mode */}
      <Moon className={cn(
        'absolute h-4 w-4 transition-all duration-300',
        isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0',
      )} />
    </button>
  );
}
