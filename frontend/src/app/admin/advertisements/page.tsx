'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function AdvertisementsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'expired'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'advertisements', filter],
    queryFn: () => apiClient.get<ApiResponse<Advertisement[]>>('/admin/advertisements', { params: { status: filter } }).then(r => r.data),
  });

  const { mutate: approve } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/advertisements/${id}/approve`, {}),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'advertisements'] }),
  });

  const { mutate: reject } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/advertisements/${id}/reject`, {}),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'advertisements'] }),
  });

  const ads = data?.data ?? [];

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-indigo-600" /> Advertisements
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Review and manage paid advertisement placements</p>
        </div>

        <div className="flex gap-2">
          {(['all', 'active', 'pending', 'expired'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`h-9 rounded-xl border px-4 text-sm font-medium capitalize transition-colors ${
                filter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
        ) : ads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
            <Megaphone className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-sm font-semibold text-slate-900">No advertisements found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ads.map(ad => (
              <div key={ad.id} className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 px-5 py-4 shadow-sm">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {ad.image_url && <img src={ad.image_url} alt={ad.title} className="h-14 w-20 rounded-lg object-cover flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{ad.title}</p>
                    <p className="text-xs text-slate-500">by {ad.advertiser} · {ad.placement}</p>
                    <p className="text-xs font-bold text-indigo-600">
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(ad.budget)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold capitalize ${
                    ad.status === 'active'  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    ad.status === 'pending' ? 'bg-amber-50  text-amber-700  border-amber-100' :
                                             'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>{ad.status}</span>
                  {ad.status === 'pending' && (
                    <>
                      <button onClick={() => approve(ad.id)}
                        className="h-8 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 transition-colors">
                        Approve
                      </button>
                      <button onClick={() => reject(ad.id)}
                        className="h-8 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors">
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    
  );
}

interface Advertisement { id: string; title: string; advertiser: string; image_url?: string; placement: string; budget: number; status: 'active' | 'pending' | 'expired'; }
