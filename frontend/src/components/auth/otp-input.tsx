'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface OTPInputProps {
  /** Current OTP value as a string (e.g. "123456" or "12" for partial) */
  value: string;
  onChange: (value: string) => void;
  /** Fires when all boxes are filled */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  /** Visual theme: 'light' (auth pages) or 'dark' (dashboard) */
  theme?: 'light' | 'dark';
  className?: string;
  autoFocus?: boolean;
}

/**
 * Unified 6-box OTP input component.
 *
 * Features:
 * - Auto-advances on digit entry
 * - Backspace moves focus backward
 * - Arrow key navigation
 * - Full paste support (handles "123456" or " 1 2 3 4 5 6")
 * - Auto-selects on focus
 * - onComplete fires when all digits are filled
 * - Two visual themes: light (white bg) and dark (slate bg)
 */
export function OTPInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  theme = 'light',
  className,
  autoFocus = true,
}: OTPInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function updateDigit(index: number, digit: string) {
    const next = [...digits];
    next[index] = digit;
    const newVal = next.join('');
    onChange(newVal);
    return newVal;
  }

  function handleChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned && raw) return; // Reject non-digits

    // Handle paste of full code into a single box
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, length).split('');
      const next = Array.from({ length }, (_, i) => chars[i] ?? '');
      const newVal = next.join('');
      onChange(newVal);
      const lastFilled = Math.min(chars.length - 1, length - 1);
      refs.current[lastFilled]?.focus();
      if (newVal.replace(/\s/g, '').length === length) onComplete?.(newVal);
      return;
    }

    const digit = cleaned.slice(-1);
    const newVal = updateDigit(index, digit);
    if (digit && index < length - 1) {
      setTimeout(() => refs.current[index + 1]?.focus(), 10);
    }
    if (newVal.length === length && !newVal.includes('')) {
      onComplete?.(newVal);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        updateDigit(index, '');
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
      }
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
      e.preventDefault();
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus();
      e.preventDefault();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    const next = Array.from({ length }, (_, i) => text[i] ?? '');
    onChange(text.slice(0, length));
    const lastFilled = Math.min(text.length, length - 1);
    setTimeout(() => refs.current[lastFilled]?.focus(), 10);
    if (text.length === length) onComplete?.(text);
  }

  const boxCls = cn(
    // Base
    'h-14 w-12 rounded-xl border-2 text-center text-[22px] font-black transition-all outline-none',
    'focus:ring-4',
    // Theme: light
    theme === 'light' && [
      'bg-slate-50 border-slate-200 text-slate-900',
      'focus:border-indigo-500 focus:bg-white focus:ring-indigo-500/15',
      'disabled:opacity-40',
    ],
    // Theme: dark
    theme === 'dark' && [
      'bg-slate-900 border-slate-700 text-white',
      'focus:border-violet-500 focus:bg-slate-800 focus:ring-violet-500/20',
      'disabled:opacity-40',
    ],
  );

  return (
    <div
      className={cn('flex items-center justify-center gap-2.5', className)}
      onPaste={handlePaste}
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Verification code digit ${i + 1} of ${length}`}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          className={boxCls}
        />
      ))}
    </div>
  );
}
