'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SealCheck, MagnifyingGlass, CaretDown, CaretUp, CheckCircle, XCircle, WarningCircle, Clock, X } from '@phosphor-icons/react';
import { useAuth } from '@/features/auth/auth-provider';
import { apiClient } from '@/lib/api/client';

const STATUS_TABS = [
 { value: 'pending', label: 'Pending', query: undefined },
 { value: 'submitted', label: 'Submitted' },
 { value: 'under_review', label: 'Under Review' },
 { value: 'more_info_required', label: 'More Info Needed' },
 { value: 'all', label: 'All' },
] as const;

const REJECTION_CATEGORIES = [
 'Identity document could not be verified',
 'Document image is unclear or illegible',
 'Name on ID does not match provided name',
 'Expired identity document',
 'Duplicate application detected',
 'Business registration could not be verified',
 'Incomplete application information',
 'Other',
];

function RejectModal({
 appId, applicantName, onClose, onDone,
}: {
 appId: string; applicantName: string; onClose: () => void; onDone: () => void;
}) {
 const [cat, setCat] = useState('');
 const [reason, setReason] = useState('');
 const [notes, setNotes] = useState('');
 const [err, setErr] = useState('');

 const { mutate, isPending } = useMutation({
 mutationFn: () => apiClient.post(`/verification/applications/${appId}/reject`, {
 rejection_category: cat, rejection_reason: reason, additional_notes: notes,
 }),
 onSuccess: () => { onDone(); onClose(); },
 onError: (e: any) => setErr(e?.message || 'Failed to reject.'),
 });

 return (
 <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
 <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
 <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
 <div>
 <h3 className="text-[15px] font-black text-slate-900">Reject Application</h3>
 <p className="text-[12px] text-slate-400">{applicantName}</p>
 </div>
 <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
 </div>
 <div className="p-6 space-y-4">
 <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
 <p className="text-[12px] text-red-700">A rejection reason is required. The applicant will receive this explanation and can update their information to resubmit.</p>
 </div>
 <div>
 <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Rejection Category *</label>
 <select value={cat} onChange={e => { setCat(e.target.value); setErr(''); }}
 className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] text-slate-700 outline-none focus:border-red-400 transition-all">
 <option value="">Select a reason…</option>
 {REJECTION_CATEGORIES.map(r => <option key={r} value={r}>{r}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Additional Explanation</label>
 <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
 placeholder="Provide specific details to help the applicant understand what needs to be fixed…"
 className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-red-400 focus:bg-white resize-none transition-all" />
 </div>
 <div>
 <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Internal Notes (not shown to applicant)</label>
 <input value={notes} onChange={e => setNotes(e.target.value)}
 placeholder="Optional internal notes for the team"
 className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-700 outline-none focus:border-slate-400 transition-all" />
 </div>
 {err && <p className="text-[12px] font-medium text-red-600">{err}</p>}
 <div className="flex gap-2">
 <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
 <button onClick={() => { if (!cat) { setErr('Select a rejection category.'); return; } mutate(); }}
 disabled={isPending}
 className="flex-1 h-10 rounded-xl bg-red-600 text-[13px] font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
 {isPending ? 'Rejecting…' : 'Reject Application'}
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}

function MoreInfoModal({
 appId, applicantName, onClose, onDone,
}: {
 appId: string; applicantName: string; onClose: () => void; onDone: () => void;
}) {
 const [notes, setNotes] = useState('');
 const [err, setErr] = useState('');

 const { mutate, isPending } = useMutation({
 mutationFn: () => apiClient.post(`/verification/applications/${appId}/request-info`, { notes }),
 onSuccess: () => { onDone(); onClose(); },
 onError: (e: any) => setErr(e?.message || 'Failed to send request.'),
 });

 return (
 <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
 <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
 <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
 <h3 className="text-[15px] font-black text-slate-900">Request More Information</h3>
 <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
 </div>
 <div className="p-6 space-y-4">
 <div>
 <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Instructions for {applicantName} *</label>
 <textarea value={notes} onChange={e => { setNotes(e.target.value); setErr(''); }} rows={4}
 placeholder="Describe exactly what additional information or documents are needed and why…"
 className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-amber-400 focus:bg-white resize-none transition-all" />
 </div>
 {err && <p className="text-[12px] font-medium text-red-600">{err}</p>}
 <div className="flex gap-2">
 <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
 <button onClick={() => { if (!notes.trim()) { setErr('Please provide instructions.'); return; } mutate(); }}
 disabled={isPending}
 className="flex-1 h-10 rounded-xl bg-amber-500 text-[13px] font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
 {isPending ? 'Sending…' : 'PaperPlaneRight Request'}
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}

export default function ModVerificationPage() {
 const { session } = useAuth();
 const qc = useQueryClient();
 const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
 const [expanded, setExpanded] = useState<string | null>(null);
 const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
 const [infoModal, setInfoModal] = useState<{ id: string; name: string } | null>(null);
 const [search, setSearch] = useState('');

 const { data, isLoading, isError, refetch } = useQuery({
 queryKey: ['mod', 'verification', activeTab],
 queryFn: () => apiClient.get('/verification/applications', {
 params: { status: activeTab || undefined, page_size: 50 },
 }).then(r => r.data),
 enabled: session.isAuthenticated,
 staleTime: 30_000,
 });

 const { mutate: approve } = useMutation({
 mutationFn: (id: string) => apiClient.post(`/verification/applications/${id}/approve`, {}),
 onSuccess: () => qc.invalidateQueries({ queryKey: ['mod', 'verification'] }),
 onError: (e: any) => alert(e?.message || 'Failed to approve.'),
 });

 const apps = Array.isArray(data?.data) ? data.data : [];
 const filtered = search
 ? apps.filter((a: any) =>
 (a.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
 (a.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
 (a.business_name || '').toLowerCase().includes(search.toLowerCase())
 )
 : apps;

 const meta = data?.meta;

 function invalidate() {
 qc.invalidateQueries({ queryKey: ['mod', 'verification'] });
 setExpanded(null);
 }

 return (
 <div className="space-y-5">
 {rejectModal && (
 <RejectModal appId={rejectModal.id} applicantName={rejectModal.name}
 onClose={() => setRejectModal(null)} onDone={invalidate} />
 )}
 {infoModal && (
 <MoreInfoModal appId={infoModal.id} applicantName={infoModal.name}
 onClose={() => setInfoModal(null)} onDone={invalidate} />
 )}

 <div>
 <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
 <SealCheck className="h-6 w-6 text-amber-500" /> Seller Verification
 </h1>
 <p className="text-[13px] text-slate-400 mt-0.5">
 {meta?.total != null ? `${meta.total} application(s)` : 'Review seller verification applications'}
 </p>
 </div>

      {/* Tabs + MagnifyingGlass */}
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
 <div className="flex gap-1.5 flex-wrap">
 {[
 { value: undefined, label: 'Pending' },
 { value: 'submitted', label: 'Submitted' },
 { value: 'under_review', label: 'Under Review' },
 { value: 'more_info_required', label: 'More Info' },
 { value: 'all', label: 'All' },
 ].map(tab => (
 <button key={tab.label} onClick={() => setActiveTab(tab.value as any)}
 className={`h-8 rounded-xl px-3.5 text-[12px] font-semibold capitalize transition-all ${
 activeTab === tab.value
 ? 'bg-amber-500 text-white shadow-sm'
 : 'border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
 }`}>
 {tab.label}
 </button>
 ))}
 </div>
 <div className="relative sm:ml-auto">
 <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
 <input value={search} onChange={e => setSearch(e.target.value)}
 placeholder="Search applications…"
 className="h-9 w-full sm:w-52 rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-amber-400 transition-all" />
 </div>
 </div>

      {/* Content */}
 {isError ? (
 <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
 <p className="text-[14px] font-semibold text-red-700 mb-2">Failed to load applications</p>
 <button onClick={() => refetch()} className="text-[13px] font-semibold text-red-600 hover:underline">Try again</button>
 </div>
 ) : isLoading ? (
 <div className="space-y-3">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
 ))}
 </div>
 ) : filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
 <SealCheck className="h-12 w-12 text-slate-200 mb-3" />
 <p className="text-[14px] font-semibold text-slate-900 mb-1">No applications found</p>
 <p className="text-[12px] text-slate-400">Verification applications will appear here when submitted.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {filtered.map((app: any) => {
 const isOpen = expanded === app.id;
 const name = app.full_name || app.user_name || 'Applicant';
 return (
 <div key={app.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
 <button className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
 onClick={() => setExpanded(isOpen ? null : app.id)}>
 <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[14px] font-bold text-amber-700">
 {name.charAt(0).toUpperCase()}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[14px] font-bold text-slate-900 truncate">{name}</p>
 <p className="text-[11px] text-slate-400">
 {app.user_email} · {app.seller_type || 'individual'} · {app.city || ''}{app.country ? `, ${app.country}` : ''}
 </p>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${
 app.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-100'
 : app.status === 'under_review' ? 'bg-amber-50 text-amber-700 border-amber-100'
 : app.status === 'more_info_required' ? 'bg-orange-50 text-orange-700 border-orange-100'
 : app.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
 : 'bg-slate-100 text-slate-500 border-slate-200'
 }`}>{app.status?.replace(/_/g, ' ')}</span>
 {isOpen ? <CaretUp className="h-4 w-4 text-slate-400" /> : <CaretDown className="h-4 w-4 text-slate-400" />}
 </div>
 </button>

 {isOpen && (
 <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-4">
                    {/* Application details */}
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12px]">
 {[
 ['Application ID', app.id?.slice(0, 16) + '…'],
 ['Seller Type', app.seller_type || ' '],
 ['Submitted', app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-NG') : ' '],
 ['Business', app.business_name || app.display_name || ' '],
 ['Location', [app.city, app.country].filter(Boolean).join(', ') || ' '],
 ['User email', app.user_email || ' '],
 ].map(([label, value]) => (
 <div key={label}>
 <p className="font-bold uppercase tracking-wide text-slate-400 text-[10px] mb-0.5">{label}</p>
 <p className="text-slate-700 truncate">{value}</p>
 </div>
 ))}
 </div>

                    {/* Actions */}
 {!['approved', 'rejected'].includes(app.status) && (
 <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
 <button onClick={() => approve(app.id)}
 className="flex items-center gap-1.5 h-9 rounded-xl bg-emerald-600 px-4 text-[12px] font-bold text-white hover:bg-emerald-700 transition-colors">
 <CheckCircle className="h-3.5 w-3.5" /> Approve
 </button>
 <button onClick={() => setRejectModal({ id: app.id, name })}
 className="flex items-center gap-1.5 h-9 rounded-xl bg-red-600 px-4 text-[12px] font-bold text-white hover:bg-red-700 transition-colors">
 <XCircle className="h-3.5 w-3.5" /> Reject
 </button>
 <button onClick={() => setInfoModal({ id: app.id, name })}
 className="flex items-center gap-1.5 h-9 rounded-xl border border-amber-200 bg-amber-50 px-4 text-[12px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
 <WarningCircle className="h-3.5 w-3.5" /> Request Info
 </button>
 </div>
 )}

 {app.status === 'approved' && (
 <div className="flex items-center gap-2 text-[12px] text-emerald-700">
 <CheckCircle className="h-4 w-4" />
 Approved by {app.reviewer_name} · {app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString('en-NG') : ''}
 </div>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}