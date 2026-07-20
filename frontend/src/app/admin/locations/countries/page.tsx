'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Globe } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

interface Country {
  name: string;
  code: string;
  flag: string;
  currency: string;
  user_count: number;
  is_active: boolean;
}

export default function CountriesPage() {
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'countries'],
    queryFn: () =>
      apiClient.get<ApiResponse<Country[]>>('/admin/locations/countries').then((r) => r.data),
    staleTime: 300_000,
  });

  const { mutate: toggleCountry } = useMutation({
    mutationFn: ({ code, active }: { code: string; active: boolean }) =>
      apiClient.patch(`/admin/locations/countries/${code}`, { is_active: active }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'countries'] }),
  });

  const countries = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <MapPin className="h-6 w-6 text-teal-600" /> Countries
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage supported countries and their settings</p>
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-semibold text-red-700 mb-2">Failed to load countries</p>
          <button onClick={() => refetch()} className="text-sm font-semibold text-red-600 hover:underline">Try again</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Country', 'Code', 'Currency', 'Users', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 rounded-full bg-slate-100 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : countries.length === 0 && !isError
              ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Globe className="h-10 w-10 text-slate-200" />
                      <p className="text-sm font-semibold text-slate-900">No countries configured</p>
                      <p className="text-xs text-slate-400">Countries will appear here once they are added to the platform</p>
                    </div>
                  </td>
                </tr>
              )
              : countries.map((c) => (
                  <tr key={c.code} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{c.flag}</span>
                        <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5 text-slate-600">{c.code}</code>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{c.currency}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                      {c.user_count.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold ${
                        c.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggleCountry({ code: c.code, active: !c.is_active })}
                        className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
