'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, FileText, ShieldOff } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

const STATUS_CLS: Record<string, string> = {
  pending:  'bg-amber-50  text-amber-700  border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  rejected: 'bg-red-50    text-red-700    border-red-100',
};

export default function AdminKycPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'kyc', filter],
    queryFn: () => apiClient.get<ApiResponse<KycDoc[]>>('/users/admin/kyc', { params: { status: filter, page_size: 50 } }).then(r => r.data),
  });

  const { mutate: review } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      apiClient.post(`/users/admin/kyc/${id}/review`, { status }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'kyc'] }),
  });

  const docs = data?.data ?? [];
  const pendingCount = filter === 'pending' ? docs.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-emerald-600" /> KYC Verification
          </h1>
          {pendingCount > 0 && (
            <p className="text-sm font-medium text-amber-600 mt-0.5">{pendingCount} document{pendingCount !== 1 ? 's' : ''} pending review</p>
          )}
        </div>

        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
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
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 py-20 text-center">
            <BadgeCheck className="h-12 w-12 text-emerald-300 mb-3" />
            <p className="text-sm font-semibold text-slate-900">No {filter !== 'all' ? filter : ''} KYC documents</p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 px-5 py-4 shadow-sm">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
                    <FileText className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{doc.user_name}</p>
                    <p className="text-xs text-slate-500">{doc.doc_type} · {new Date(doc.submitted_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold capitalize ${STATUS_CLS[doc.status] ?? ''}`}>
                    {doc.status}
                  </span>
                  {doc.status === 'pending' && (
                    <>
                      <button onClick={() => review({ id: doc.id, status: 'approved' })}
                        className="h-8 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 transition-colors">
                        Approve
                      </button>
                      <button onClick={() => review({ id: doc.id, status: 'rejected' })}
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

interface KycDoc { id: string; user_name: string; doc_type: string; status: 'pending' | 'approved' | 'rejected'; submitted_at: string; }
