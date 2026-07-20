
'use client';

import { useMemo } from 'react';

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { score, label, color } = useMemo(() => {
    if (!password) return { score: 0, label: 'Enter a password', color: '#e2e8f0' };
    let s = 0;
    if (password.length >= 8)  s++;
    if (password.length >= 12) s++;
    if (/[a-z]/.test(password)) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^a-zA-Z0-9]/.test(password)) s++;
    if (s <= 2) return { score: s, label: 'Weak',   color: '#ef4444' };
    if (s <= 4) return { score: s, label: 'Medium', color: '#f59e0b' };
    return { score: s, label: 'Strong', color: '#10b981' };
  }, [password]);

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-1.5 flex-1 rounded-full transition-all"
            style={{ background: i <= score ? color : '#e2e8f0' }} />
        ))}
      </div>
      <p className="text-[11px] text-slate-400">
        Password strength:{' '}
        <span className="font-semibold" style={{ color }}>{label}</span>
      </p>
    </div>
  );
}
