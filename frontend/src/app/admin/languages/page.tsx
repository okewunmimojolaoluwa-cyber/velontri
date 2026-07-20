'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

const DEFAULT_LANGUAGES = [
  { code: 'en', name: 'English',  native: 'English',  flag: '🇬🇧', is_active: true,  is_default: true  },
  { code: 'fr', name: 'French',   native: 'Français', flag: '🇫🇷', is_active: true,  is_default: false },
  { code: 'ar', name: 'Arabic',   native: 'العربية',  flag: '🇸🇦', is_active: false, is_default: false },
  { code: 'sw', name: 'Swahili',  native: 'Kiswahili',flag: '🇹🇿', is_active: true,  is_default: false },
  { code: 'ha', name: 'Hausa',    native: 'Hausa',    flag: '🇳🇬', is_active: false, is_default: false },
];

export default function LanguagesPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'languages'],
    queryFn: () => apiClient.get<ApiResponse<Language[]>>('/admin/languages').then(r => r.data),
  });

  const { mutate: toggle } = useMutation({
    mutationFn: ({ code, is_active }: { code: string; is_active: boolean }) =>
      apiClient.patch(`/admin/languages/${code}`, { is_active }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'languages'] }),
  });

  const langs = (data?.data ?? []).length > 0 ? data!.data! : DEFAULT_LANGUAGES;

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-indigo-600" /> Languages
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage supported platform languages</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Language', 'Code', 'Native', 'Default', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {langs.map((l: any) => (
                <tr key={l.code} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{l.flag}</span>
                      <span className="text-sm font-semibold text-slate-900">{l.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3"><code className="text-xs bg-slate-100 rounded px-1.5 py-0.5 text-slate-600">{l.code}</code></td>
                  <td className="px-5 py-3 text-sm text-slate-600">{l.native}</td>
                  <td className="px-5 py-3">
                    {l.is_default && (
                      <span className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-semibold">Default</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold ${
                      l.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>{l.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-5 py-3">
                    {!l.is_default && (
                      <button onClick={() => toggle({ code: l.code, is_active: !l.is_active })}
                        className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                          l.is_active
                            ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}>
                        {l.is_active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    
  );
}

interface Language { code: string; name: string; native: string; flag: string; is_active: boolean; is_default: boolean; }
