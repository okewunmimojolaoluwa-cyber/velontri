'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Package, MapPin, Eye, TrendingUp, PlusCircle } from 'lucide-react';
import { sellerApi } from '@/lib/api/endpoints/seller';
import { useAuth } from '@/features/auth/auth-provider';
import { ROUTES } from '@/config/routes';

function fmt(n: number, cur = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: cur, maximumFractionDigits: 0,
    }).format(n);
  } catch { return `₦${n.toLocaleString()}`; }
}

const CONDITION_LABEL: Record<string, string> = {
  new: 'Brand New', used: 'Used', refurbished: 'Refurbished',
};

const STATUS_CLS: Record<string, string> = {
  active:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft:         'bg-slate-100 text-slate-500 border-slate-200',
  pending_review:'bg-amber-50 text-amber-700 border-amber-200',
  archived:      'bg-orange-50 text-orange-700 border-orange-200',
  rejected:      'bg-red-50 text-red-600 border-red-200',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', draft: 'Draft', pending_review: 'Under Review',
  archived: 'Archived', rejected: 'Rejected',
};

export default function UserSalesPage() {
  const { session } = useAuth();
  const uid = session.userId;

  const { data, isLoading } = useQuery({
    queryKey: [uid, 'seller', 'listings', { page: 1, page_size: 50 }],
    queryFn: () => sellerApi.getMyListings({ page: 1, page_size: 50 }),
    enabled: !!session.isAuthenticated,
    staleTime: 30_000,
  });

  const listings = Array.isArray(data?.data) ? data.data : [];
  const active   = listings.filter((l: any) => l.status === 'active').length;
  const total    = data?.meta?.total ?? listings.length;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">My Listings</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {active} active · {total} total
          </p>
        </div>
        <Link href={ROUTES.user.create}
          className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-indigo-600 px-4
            text-[12px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
          <PlusCircle className="h-3.5 w-3.5" /> Post listing
        </Link>
      </div>

      {/* Stats row */}
      {listings.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total listings', value: total, color: '#4F46E5' },
            { label: 'Active', value: active, color: '#059669' },
            { label: 'Archived', value: listings.filter((l: any) => l.status === 'archived').length, color: '#D97706' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
              <p className="text-[1.5rem] font-black" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
        <TrendingUp className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-indigo-700 leading-relaxed">
          Buyers contact you directly via <strong>WhatsApp</strong>. Keep your number updated on each listing
          so serious buyers can reach you instantly.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-14 w-14 rounded-xl bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-3/4 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                  <div className="h-4 w-1/4 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-[14px] font-semibold text-slate-900 mb-1">No listings yet</p>
            <p className="text-[12px] text-slate-400 mb-4">Post your first listing and reach buyers across Africa.</p>
            <Link href={ROUTES.user.create}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4
                text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
              <PlusCircle className="h-3.5 w-3.5" /> Post a listing
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {listings.map((listing: any) => {
              const loc = [listing.city, listing.country].filter(Boolean).join(', ');
              const status = listing.status ?? 'draft';
              return (
                <li key={listing.id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className="h-14 w-14 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    {listing.image_url ? (
                      <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-6 w-6 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 truncate">{listing.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {listing.condition && (
                        <span className="text-[10px] font-medium text-slate-400 capitalize">
                          {CONDITION_LABEL[listing.condition] ?? listing.condition}
                        </span>
                      )}
                      {loc && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <MapPin className="h-2.5 w-2.5" /> {loc}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-black text-slate-900 mt-0.5">
                      {fmt(listing.price ?? 0, listing.currency ?? 'NGN')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${STATUS_CLS[status] ?? STATUS_CLS.draft}`}>
                      {STATUS_LABEL[status] ?? status}
                    </span>
                    {listing.review_count > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Eye className="h-3 w-3" /> {listing.review_count}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
