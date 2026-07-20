'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, LayoutTemplate, GripVertical, Save, CheckCircle } from 'lucide-react';

interface Section {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  order: number;
}

const DEFAULT_SECTIONS: Section[] = [
  { id: 'featured',     name: 'Featured Listings',  description: 'Top listings shown at the top of the homepage',       enabled: true,  order: 1 },
  { id: 'vehicles',     name: 'Vehicles',            description: 'Latest active vehicle listings (cars, bikes, trucks)', enabled: true,  order: 2 },
  { id: 'property',     name: 'Property',            description: 'Real estate and property listings',                   enabled: true,  order: 3 },
  { id: 'electronics',  name: 'Electronics',         description: 'Electronics and tech listings',                      enabled: true,  order: 4 },
  { id: 'fashion',      name: 'Fashion',             description: 'Fashion and clothing listings',                      enabled: true,  order: 5 },
  { id: 'trending',     name: 'Trending',            description: 'Most viewed / recently active listings',             enabled: true,  order: 6 },
  { id: 'ai',           name: 'AI Recommendations',  description: 'Personalised recommendations powered by AI',         enabled: false, order: 7 },
];

const STORAGE_KEY = 'velontri_homepage_sections';

function loadSections(): Section[] {
  if (typeof window === 'undefined') return DEFAULT_SECTIONS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_SECTIONS;
}

function saveSections(sections: Section[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  } catch {}
}

export default function HomepageManagerPage() {
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS);
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setSections(loadSections());
  }, []);

  function toggle(id: string) {
    setSections(prev =>
      prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    );
    setSaved(false);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setSections(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
    setSaved(false);
  }

  function moveDown(index: number) {
    setSections(prev => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
    setSaved(false);
  }

  function handleSave() {
    saveSections(sections);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const sorted = [...sections].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6 text-indigo-600" />
            Homepage Manager
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Control which sections appear on the public homepage. Changes apply immediately after saving.
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 h-10 rounded-xl px-5 text-[13px] font-bold transition-all ${
            saved
              ? 'bg-emerald-600 text-white'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : 'Save changes'}
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
        <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-blue-500 flex items-center justify-center">
          <span className="text-white text-[9px] font-bold">i</span>
        </div>
        <p className="text-[12px] text-blue-700 leading-relaxed">
          Toggle sections on/off and reorder them using the arrows. Click <strong>Save changes</strong> to apply.
          Hidden sections are removed from the homepage immediately after saving.
        </p>
      </div>

      {/* Section list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Homepage Sections — {sorted.filter(s => s.enabled).length} of {sorted.length} visible
          </p>
        </div>

        <ul className="divide-y divide-slate-100">
          {sorted.map((s, idx) => (
            <li key={s.id}
              className={`flex items-center gap-3 px-5 py-4 transition-colors ${
                s.enabled ? 'hover:bg-slate-50' : 'bg-slate-50/50 opacity-60'
              }`}>

              {/* Drag handle / order controls */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button onClick={() => moveUp(idx)} disabled={idx === 0}
                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400
                    hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed
                    text-[10px] font-bold transition-colors">
                  ▲
                </button>
                <button onClick={() => moveDown(idx)} disabled={idx === sorted.length - 1}
                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400
                    hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed
                    text-[10px] font-bold transition-colors">
                  ▼
                </button>
              </div>

              {/* Order number */}
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg
                bg-slate-100 text-[12px] font-black text-slate-500">
                {s.order}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-[14px] font-bold ${s.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                  {s.name}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{s.description}</p>
              </div>

              {/* Status + toggle */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-[11px] font-semibold ${s.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {s.enabled ? 'Visible' : 'Hidden'}
                </span>
                <button
                  onClick={() => toggle(s.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    s.enabled ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                  role="switch"
                  aria-checked={s.enabled}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    s.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                {s.enabled
                  ? <Eye className="h-4 w-4 text-emerald-500" />
                  : <EyeOff className="h-4 w-4 text-slate-300" />}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Preview note */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[13px] font-semibold text-slate-700 mb-1.5">Live preview</p>
        <p className="text-[12px] text-slate-500 leading-relaxed">
          The homepage at <strong>velontri.com</strong> reads these settings from your browser storage.
          After saving, visit the homepage to see your changes. All sections pull real listing data from the database —
          sections with no active listings show an empty state automatically.
        </p>
        <a href="/" target="_blank" rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600 hover:underline">
          Open homepage →
        </a>
      </div>
    </div>
  );
}
