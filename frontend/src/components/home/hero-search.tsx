'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const CATEGORIES = ['All', 'Real Estate', 'Vehicles', 'Electronics', 'Fashion', 'Jobs', 'Services'];

const SUGGESTIONS = [
  'iPhone 15 Pro Max Lagos',
  'Toyota Camry under ₦12M',
  '3-bedroom apartment Lekki',
  'Software developer remote',
  'MacBook Pro M3 Abuja',
];

export function HeroSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [catOpen, setCatOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  function handleSearch(q = query) {
    if (!q.trim()) return;
    const params = new URLSearchParams({ q: q.trim() });
    if (category !== 'All') params.set('category', category);
    router.push(`/search?${params}`);
  }

  return (
    <div className="relative">
      {/* Search bar */}
      <div className={cn(
        'flex items-center rounded-2xl bg-white/10 backdrop-blur-md border transition-all duration-200',
        focused ? 'border-white/40 shadow-[0_0_0_3px_rgba(255,255,255,0.08)]' : 'border-white/20',
      )}>
        {/* Category selector */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setCatOpen((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-4 text-sm font-medium text-white/80 hover:text-white transition-colors border-r border-white/15"
          >
            {category}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', catOpen && 'rotate-180')} />
          </button>
          {catOpen && (
            <div className="absolute top-full left-0 mt-2 w-44 rounded-xl bg-white shadow-xl border border-border/60 py-1.5 z-50">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategory(cat); setCatOpen(false); inputRef.current?.focus(); }}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm transition-colors',
                    category === cat ? 'text-primary font-semibold bg-primary/5' : 'text-foreground hover:bg-muted'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search listings…"
          className="flex-1 bg-transparent px-4 py-4 text-white placeholder:text-white/40 text-base focus:outline-none"
        />

        {/* Submit */}
        <button
          onClick={() => handleSearch()}
          className="flex items-center gap-2 m-1.5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-foreground hover:bg-white/90 transition-colors"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:block">Search</span>
        </button>
      </div>

      {/* Suggestions dropdown */}
      {focused && !query && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-white shadow-2xl border border-border/60 overflow-hidden z-40">
          <div className="px-4 py-2.5 border-b border-border/60">
            <p className="text-xs font-semibold text-muted-foreground">Popular searches</p>
          </div>
          <ul>
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  onMouseDown={() => { setQuery(s); handleSearch(s); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors text-left"
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  {s}
                </button>
              </li>
            ))}
          </ul>
          <div className="px-4 py-2.5 border-t border-border/60 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            AI-assisted results
          </div>
        </div>
      )}
    </div>
  );
}
