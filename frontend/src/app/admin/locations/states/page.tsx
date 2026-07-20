'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface State {
  name: string;
  country_code: string;
  listings_count: number;
  is_active: boolean;
}

const COUNTRY_OPTIONS = [
  { code: 'NG', label: '🇳🇬 Nigeria' },
  { code: 'GH', label: '🇬🇭 Ghana' },
  { code: 'KE', label: '🇰🇪 Kenya' },
  { code: 'EG', label: '🇪🇬 Egypt' },
];

export default function StatesPage() {
  const [country, setCountry] = useState('NG');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'states', country],
    queryFn: () =>
      apiClient
        .get<ApiResponse<State[]>>('/admin/locations/states', { params: { country_code: country } })
        .then((r) => r.data),
    staleTime: 300_000,
  });

  const states = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-teal-600" /> States / Regions
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage states by country</p>
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-semibold text-red-700 mb-2">Failed to load states</p>
          <button onClick={() => refetch()} className="text-sm font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
              <div className="h-4 rounded bg-slate-100 animate-pulse mb-1" />
              <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && states.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <MapPin className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-900">No states found</p>
          <p className="text-xs text-slate-400 mt-1">
            No states are configured for this country yet.
          </p>
        </div>
      )}

      {/* State cards */}
      {!isLoading && !isError && states.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {states.map((s) => (
            <div
              key={s.name}
              className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm hover:border-indigo-200 transition-colors cursor-pointer"
            >
              <p className="text-sm font-semibold text-slate-900">{s.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.listings_count.toLocaleString()} listings</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
