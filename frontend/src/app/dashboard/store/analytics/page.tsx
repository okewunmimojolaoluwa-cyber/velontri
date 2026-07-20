'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Package, CheckCircle, Clock, XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/auth-provider';
import { sellerApi } from '@/lib/api/endpoints/seller';
import { ROUTES } from '@/config/routes';

function fmt(n: number, cur = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: cur, maximumFractionDigits: 0,
      notation: n >= 1_000_000 ? 'compact' : 'standard',
    }).format(n);
  } catch { return `₦${n.toLocaleString()}`; }
}

export default function StoreAnalyticsPage() {
  const { session } = useAuth();
  const uid = session.userId;

  // Fetch real listings — derive stats from actual data
  // Use page_size=50 to stay within backend limits (le=100 in current gateway)
  const { data: listingsData, isLoading } = useQuery({
    queryKey: [uid, 'seller', 'listings', { page: 1, page_size: 50 }],
    queryFn: () => sellerApi.getMyListings({ page: 1, page_size: 50 }),
    enabled: session.isAuthenticated,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const listings = Array.isArray(listingsData?.data) ? listingsData.data : [];
  const totalListings   = listingsData?.meta?.total ?? listings.length;
  const activeListings  = listings.filter(l => l.status === 'active').length;
  const pendingListings = listings.filter(l => l.status === 'pending_review' || l.status === 'draft').length;
  const rejectedListings = listings.filter(l => l.status === 'rejected').length;
  const listingRate = totalListings > 0
    ? `${Math.round((activeListings / totalListings) * 100)}%`
    : '—';

  const KPI = [
    { icon: Package,     label: 'Total Listings',  value: totalListings.toLocaleString(),    color: '#4F46E5', bg: '#eef2ff' },
    { icon: CheckCircle, label: 'Active',           value: activeListings.toLocaleString(),   color: '#059669', bg: '#ecfdf5' },
    { icon: Clock,       label: 'Pending / Draft',  value: pendingListings.toLocaleString(),  color: '#D97706', bg: '#fffbeb' },
    { icon: XCircle,     label: 'Rejected',         value: rejectedListings.toLocaleString(), color: '#DC2626', bg: '#fef2f2' },
    { icon: TrendingUp,  label: 'Active Rate',      value: listingRate,                       color: '#7C3AED', bg: '#f5f3ff' },
  ];

  const statusColors: Record<string, string> = {
    active:         'bg-emerald-50 text-emerald-700',
    pending_review: 'bg-amber-50 text-amber-700',
    draft:          'bg-slate-100 text-slate-500',
    rejected:       'bg-red-50 text-red-600',
    archived:       'bg-slate-100 text-slate-400',
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={ROUTES.user.store}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200
            text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all no-underline">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Store Analytics</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Live data from your listings</p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
                <div className="h-9 w-9 rounded-xl bg-slate-100 mb-3" />
                <div className="h-6 w-16 rounded-lg bg-slate-100 mb-1" />
                <div className="h-3 w-20 rounded-full bg-slate-100" />
              </div>
            ))
          : KPI.map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl mb-3"
                  style={{ background: bg }}>
                  <Icon className="h-[18px] w-[18px]" style={{ color }} />
                </div>
                <p className="text-[1.3rem] font-black text-slate-900 tracking-tight leading-none mb-1">
                  {value}
                </p>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
              </div>
            ))}
      </div>

      {/* Listings table */}
      {!isLoading && listings.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Your Listings
            </p>
            <p className="text-[11px] text-slate-400">{totalListings} total</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {listings.slice(0, 10).map(l => {
              const sc = statusColors[l.status ?? 'draft'] ?? 'bg-slate-100 text-slate-500';
              return (
                <li key={l.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                  {/* Thumbnail */}
                  <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {l.image_url
                      ? <img src={l.image_url} alt="" className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center text-base">
                          {l.listing_type === 'vehicle' ? '🚗' : l.listing_type === 'property' ? '🏠' : '📦'}
                        </div>}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">{l.title}</p>
                    <p className="text-[11px] text-slate-400 capitalize">{l.listing_type} · {l.city ?? ''}</p>
                  </div>
                  {/* Price */}
                  <p className="text-[13px] font-black text-indigo-600 shrink-0">
                    {fmt(l.price ?? 0, l.currency ?? 'NGN')}
                  </p>
                  {/* Status */}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0 ${sc}`}>
                    {l.status === 'pending_review' ? 'Pending' : l.status ?? 'Draft'}
                  </span>
                  {/* View */}
                  <Link href={`/listings/${l.id}`}
                    className="text-[12px] font-semibold text-indigo-600 no-underline hover:underline shrink-0">
                    View
                  </Link>
                </li>
              );
            })}
          </ul>
          {listings.length > 10 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <Link href={ROUTES.user.listings}
                className="text-[13px] font-semibold text-indigo-600 no-underline hover:underline">
                View all {totalListings} listings →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && listings.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed
          border-slate-200 py-16 text-center">
          <BarChart3 className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-[15px] font-semibold text-slate-900 mb-1">No listings yet</p>
          <p className="text-[13px] text-slate-400 mb-4">
            Post your first listing to start tracking analytics.
          </p>
          <Link href={ROUTES.user.create}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5
              text-[13px] font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
            Post a listing
          </Link>
        </div>
      )}
    </div>
  );
}
