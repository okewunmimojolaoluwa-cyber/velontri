'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Globe } from '@phosphor-icons/react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Country { code: string; name: string; flag: string; is_active: boolean; listing_count: number; }
interface City { id: string; name: string; state: string; country: string; is_active: boolean; listing_count: number; }

export default function AdminLocationsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'countries' | 'cities'>('countries');
  const [search, setSearch] = useState('');

  const { data: countriesData, isLoading: countriesLoading, isError: countriesError } = useQuery({
    queryKey: ['admin', 'countries'],
    queryFn: () => apiClient.get<ApiResponse<Country[]>>('/admin/locations/countries').then(r => r.data),
    staleTime: 60_000,
  });

  const { data: citiesData, isLoading: citiesLoading } = useQuery({
    queryKey: ['admin', 'cities', search],
    queryFn: () => apiClient.get<ApiResponse<City[]>>('/admin/locations/cities', { params: { search: search || undefined, page_size: 50 } }).then(r => r.data),
    staleTime: 30_000,
  });

  const { mutate: toggleCountry } = useMutation({
    mutationFn: (code: string) => apiClient.patch(`/admin/locations/countries/${code}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'countries'] }),
  });

  const countries: Country[] = Array.isArray(countriesData?.data) ? countriesData.data : [];
  const cities: City[] = Array.isArray(citiesData?.data) ? citiesData.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <MapPin className="h-6 w-6 text-sky-600" /> Locations
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Manage supported countries and cities</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5">
        {(['countries', 'cities'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`h-9 rounded-xl border px-4 text-[13px] font-semibold capitalize transition-colors ${
              tab === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'countries' && (
        <>
          {countriesError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-[14px] font-semibold text-red-700">Failed to load countries</p>
            </div>
          ) : countriesLoading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden lg:grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                {['Flag', 'Country', 'Code', 'Status', 'Toggle'].map(h => (
                  <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
                ))}
              </div>
              <ul className="divide-y divide-slate-100">
                {countries.map(c => (
                  <li key={c.code} className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto_auto_auto] gap-3 lg:gap-4 px-5 py-4 items-center hover:bg-slate-50 transition-colors">
                    <span className="text-2xl">{c.flag}</span>
                    <p className="text-[14px] font-semibold text-slate-900">{c.name}</p>
                    <code className="text-[12px] bg-slate-100 rounded-lg px-2 py-0.5 text-slate-600 font-mono">{c.code}</code>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      c.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => toggleCountry(c.code)}
                      className={`h-8 rounded-lg border px-3 text-[11px] font-semibold transition-colors ${
                        c.is_active
                          ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}>
                      {c.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {tab === 'cities' && (
        <>
          <div className="relative max-w-xs">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cities…"
              className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-4 pr-4 text-[14px] text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 transition-all"
            />
          </div>
          {citiesLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
          ) : cities.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
              <Globe className="h-12 w-12 text-slate-200 mb-3" />
              <p className="text-[14px] font-semibold text-slate-900">No cities found</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden lg:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                {['City', 'State', 'Country', 'Status'].map(h => (
                  <p key={h} className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{h}</p>
                ))}
              </div>
              <ul className="divide-y divide-slate-100">
                {cities.map(c => (
                  <li key={c.id} className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto] gap-3 lg:gap-4 px-5 py-3 items-center hover:bg-slate-50 transition-colors">
                    <p className="text-[14px] font-semibold text-slate-900">{c.name}</p>
                    <p className="text-[13px] text-slate-500">{c.state}</p>
                    <p className="text-[13px] text-slate-500">{c.country}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      c.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}