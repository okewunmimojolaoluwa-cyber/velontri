import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'ghost-primary' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

const variantClasses: Record<string, string> = {
  default:
    'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:scale-[0.99]',
  outline:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  'ghost-primary':
    'bg-transparent text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 active:scale-[0.99]',
};

const sizeClasses: Record<string, string> = {
  default: 'h-10 px-4 py-2 text-sm',
  sm:      'h-8 px-3 py-1 text-xs',
  lg:      'h-12 px-6 py-3 text-base',
  icon:    'h-10 w-10 p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      asChild = false,
      children,
      ...props
    },
    ref,
  ) => {
    // When asChild is true, render the first child element with button props merged in
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ...props,
        className: cn(
          'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-40',
          variantClasses[variant],
          sizeClasses[size],
          className,
          (children as React.ReactElement<any>).props.className,
        ),
      });
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-40',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
