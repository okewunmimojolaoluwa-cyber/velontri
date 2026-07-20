import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  error?: string;
  label?: string;
  hint?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, iconRight, error, label, hint, id, ...props }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground/90"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            className={cn(
              // Base
              'flex h-11 w-full rounded-xl',
              'bg-background/80 backdrop-blur-sm',
              'border border-border/70',
              'px-4 py-2.5 text-sm text-foreground',
              'placeholder:text-muted-foreground/60',
              // Focus
              'transition-all duration-200',
              'focus-visible:outline-none',
              'focus-visible:border-primary/60',
              'focus-visible:ring-3 focus-visible:ring-primary/12',
              'focus-visible:bg-background',
              // Hover
              'hover:border-border',
              // Disabled
              'disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-muted/40',
              // Error
              error && 'border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/15',
              // Icon padding
              icon && 'pl-10',
              iconRight && 'pr-10',
              className,
            )}
            ref={ref}
            {...props}
          />
          {iconRight && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {iconRight}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-destructive font-medium">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
