'use client';

import { useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'velontri-theme';

/**
 * useTheme — reads/writes the `dark` class on <html>.
 * Persists to localStorage. Respects system preference on first visit.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  // Initialise from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light') {
      apply(stored);
      setTheme(stored);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial: Theme = prefersDark ? 'dark' : 'light';
      apply(initial);
      setTheme(initial);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      apply(next);
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggleTheme, isDark: theme === 'dark' };
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
