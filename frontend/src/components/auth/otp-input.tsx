'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  className?: string;
}

export function OTPInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  className,
}: OTPInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function handleChange(index: number, raw: string) {
    if (!/^\d*$/.test(raw)) return;
    const digit = raw.slice(-1);
    const next = [...digits];
    next[index] = digit;
    const newVal = next.join('');
    onChange(newVal);
    if (digit && index < length - 1) refs.current[index + 1]?.focus();
    if (newVal.length === length) onComplete?.(newVal);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    const next = Array.from({ length }, (_, i) => text[i] ?? '');
    const newVal = next.join('').slice(0, text.length);
    onChange(text);
    refs.current[Math.min(text.length, length - 1)]?.focus();
    if (text.length === length) onComplete?.(text);
  }

  return (
    <div
      className={cn('flex justify-center gap-2', className)}
      onPaste={handlePaste}
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={`OTP digit ${i + 1}`}
          className={cn(
            'h-12 w-11 rounded-md border border-input bg-background text-center text-lg font-semibold',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            digit && 'border-primary',
          )}
        />
      ))}
    </div>
  );
}
