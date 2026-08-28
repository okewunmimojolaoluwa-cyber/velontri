'use client';

import { useState } from 'react';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import { FileText, CheckCircle, XCircle, WarningCircle } from '@phosphor-icons/react';

interface KycRequest {
 id: string;
 user_id: string;
 user_name?: string;
 doc_type: string;
 document_number?: string;
 country?: string;
 selfie_verified?: boolean;
 status: 'pending' | 'approved' | 'rejected';
 submitted_at?: string;
 email?: string;
}

const STATUS_STYLES: Record<string, string> = {
 approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
 pending: 'bg-amber-50 text-amber-700 border-amber-100',
 rejected: 'bg-red-50 text-red-600 border-red-100',
};

export default function ModKycPage() {
 const { session } = useAuth();
 const qc = useQueryClient();
 const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
 const [actionError, setActionError] = useState('');

 const { data, isLoading, isError } = useQuery({
 queryKey: ['mod-kyc', filter],
 queryFn: () =>
 apiClient
 .get<ApiResponse<KycRequest[]>>(`/users/admin/kyc?status=${filter}`)
 .then((r) => r.data),
 enabled: session.isAuthenticated,
 retry: false,
 });

 const approveMutation = useMutation({
 mutationFn: (id: string) =>
 apiClient.post(`/users/admin/kyc/${id}/review`, { status: 'approved' }),
 onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-kyc'] }),
 onError: (err: any) =>
 setActionError(err?.message || 'Failed to approve. Please try again.'),
 });

 const rejectMutation = useMutation({
 mutationFn: (id: string) =>
 apiClient.post(`/users/admin/kyc/${id}/review`, { status: 'rejected' }),
 onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-kyc'] }),
 onError: (err: any) =>
 setActionError(err?.message || 'Failed to reject. Please try again.'),
 });

 const kycRequests: KycRequest[] = Array.isArray(data?.data) ? data.data as KycRequest[] : [];

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
 <FileText className="h-5 w-5 text-amber-500" /> KYC Verification
 </h1>
 <p className="text-[13px] text-slate-400 mt-0.5">Review identity verification requests</p>
 </div>

      {/* Funnel tabs */}
 <div className="flex gap-1.5">
 {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
 <button
 key={s}
 onClick={() => setFilter(s)}
 className={`h-8 rounded-xl px-3.5 text-[12px] font-semibold capitalize transition-all ${
 filter === s
 ? 'bg-amber-500 text-white'
 : 'border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
 }`}
 >
 {s}
 </button>
 ))}
 </div>

      {/* Error */}
 {actionError && (
 <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
 <WarningCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
 <p className="text-[13px] font-medium text-red-600">{actionError}</p>
 <button onClick={() => setActionError('')} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>
 </div>
 )}

      {/* API error */}
 {isError && (
 <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
 <p className="text-[14px] font-semibold text-amber-700 mb-1">Failed to load KYC requests</p>
 <p className="text-[13px] text-amber-600">Please try again later.</p>
 </div>
 )}

 {isLoading ? (
 <div className="space-y-3">
 {Array.from({ length: 3 }).map((_, i) => (
 <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
 ))}
 </div>
 ) : kycRequests.length === 0 && !isError ? (
 <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
 <FileText className="h-10 w-10 text-slate-200 mb-3" />
 <p className="text-[14px] font-semibold text-slate-900 mb-1">No KYC requests</p>
 <p className="text-[12px] text-slate-400">
 {filter === 'pending' ? 'No pending verifications.' : `No ${filter} requests found.`}
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {kycRequests.map((kyc) => (
 <div
 key={kyc.id}
 className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
 >
 <div className="p-5">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="text-[14px] font-bold text-slate-900">
 {kyc.user_name || `User ${kyc.user_id.slice(0, 8)}`}
 </p>
 {kyc.email && (
 <p className="text-[12px] text-slate-400 mt-0.5">{kyc.email}</p>
 )}
 <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-slate-500">
 <span>Document: <strong className="text-slate-700 capitalize">{kyc.doc_type?.replace('_', ' ')}</strong></span>
 {kyc.document_number && (
 <span>No: <strong className="text-slate-700">{kyc.document_number}</strong></span>
 )}
 {kyc.country && (
 <span>Country: <strong className="text-slate-700">{kyc.country}</strong></span>
 )}
 {kyc.submitted_at && (
 <span>Submitted: <strong className="text-slate-700">
 {new Date(kyc.submitted_at).toLocaleDateString()}
 </strong></span>
 )}
 </div>
 </div>
 <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${STATUS_STYLES[kyc.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
 {kyc.status}
 </span>
 </div>
 </div>

 {kyc.status === 'pending' && (
 <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
 <button
 onClick={() => approveMutation.mutate(kyc.id)}
 disabled={approveMutation.isPending}
 className="flex items-center gap-1.5 h-8 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
 >
 <CheckCircle className="h-3.5 w-3.5" />
 Approve
 </button>
 <button
 onClick={() => rejectMutation.mutate(kyc.id)}
 disabled={rejectMutation.isPending}
 className="flex items-center gap-1.5 h-8 rounded-lg border border-red-200 bg-red-50 px-3 text-[12px] font-bold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
 >
 <XCircle className="h-3.5 w-3.5" />
 Reject
 </button>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 );
}