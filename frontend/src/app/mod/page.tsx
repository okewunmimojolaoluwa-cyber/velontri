'use client';

import { useQuery } from '@tanstack/react-query';
import { ListChecks, FileCheck, AlertTriangle, Flag, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import Link from 'next/link';
import { ROUTES } from '@/config/routes';

const STAT_CARDS = [
  { icon: ListChecks,    label: 'Pending Listings', key: 'pending_listings', color: '#4F46E5', bg: '#eef2ff', href: ROUTES.mod.pendingListings },
  { icon: FileCheck,     label: 'Pending KYC',      key: 'pending_kyc',      color: '#0369A1', bg: '#e0f2fe', href: ROUTES.mod.kyc },
  { icon: AlertTriangle, label: 'Open Disputes',    key: 'open_disputes',    color: '#DC2626', bg: '#fef2f2', href: ROUTES.mod.disputes },
  { icon: Flag,          label: 'Open Reports',     key: 'open_reports',     color: '#D97706', bg: '#fffbeb', href: ROUTES.mod.reports },
];

export default function ModOverviewPage() {
  // Fetch real stats from the analytics admin overview endpoint
  const { data: overviewData, isLoading } = useQuery({
    queryKey: ['mod', 'overview'],
    queryFn: () =>
      apiClient.get<ApiResponse<any>>('/analytics/admin/overview').then(r => r.data),
    staleTime: 60_000,
  });

  // Fetch real pending listings
  const { data: listingsData } = useQuery({
    queryKey: ['mod', 'pending-listings'],
    queryFn: () =>
      apiClient.get<ApiResponse<any[]>>('/listings', {
        params: { status: 'pending_review', page_size: 5 }
      }).then(r => r.data),
    staleTime: 30_000,
  });

  const ov = overviewData?.data;
  const pendingListings = Array.isArray(listingsData?.data) ? listingsData.data : [];

  const stats = {
    pending_listings: ov?.pending_listings ?? 0,
    pending_kyc: ov?.pending_kyc ?? 0,
    open_disputes: ov?.open_disputes ?? 0,
    open_reports: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Moderation Overview</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Review and manage platform content.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ icon: Icon, label, key, color, bg, href }) => (
          <Link key={key} href={href}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm
              no-underline transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: color }} />
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: bg }}>
                <Icon className="h-4 w-4" style={{ color }} strokeWidth={2} />
              </div>
            </div>
            <p className="text-[2rem] font-black text-slate-900 tracking-tight leading-none">
              {isLoading
                ? <span className="inline-block h-8 w-12 rounded-lg bg-slate-100 animate-pulse" />
                : stats[key as keyof typeof stats] ?? 0}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold" style={{ color }}>
              View all →
            </p>
          </Link>
        ))}
      </div>

      {/* Priority queue */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Listings queue */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-indigo-600" />
              <h2 className="text-[14px] font-bold text-slate-900">Listings to Review</h2>
              {stats.pending_listings > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  {stats.pending_listings} pending
                </span>
              )}
            </div>
            <Link href={ROUTES.mod.pendingListings} className="text-[12px] font-semibold text-indigo-600 no-underline hover:underline">
              Review all →
            </Link>
          </div>
          {pendingListings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ListChecks className="h-8 w-8 text-slate-200 mb-2" />
              <p className="text-[13px] font-semibold text-slate-500">No pending listings</p>
              <p className="text-[11px] text-slate-400 mt-0.5">New listings will appear here for review</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingListings.slice(0, 5).map((listing: any) => (
                <div key={listing.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-900 truncate">{listing.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {listing.city ?? ''}{listing.city && listing.price ? ' · ' : ''}
                      {listing.price ? `₦${Number(listing.price).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-3 flex-shrink-0">
                    <Link href={`/listings/${listing.id}`}
                      className="h-7 rounded-lg bg-slate-50 border border-slate-200 px-3 text-[11px]
                        font-semibold text-slate-600 hover:bg-slate-100 transition-colors no-underline
                        flex items-center">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick info panel */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Clock className="h-4 w-4 text-slate-500" />
            <h2 className="text-[14px] font-bold text-slate-900">Platform Status</h2>
          </div>
          <div className="p-5 space-y-4">
            {[
              { label: 'Total Listings',    value: ov?.total_listings?.toLocaleString() ?? '—',   color: '#4F46E5' },
              { label: 'Active Listings',   value: ov?.active_listings?.toLocaleString() ?? '—',  color: '#059669' },
              { label: 'Registered Users',  value: ov?.active_users?.toLocaleString() ?? '—',     color: '#0369A1' },
              { label: 'Messages Sent',     value: ov?.total_messages?.toLocaleString() ?? '—',   color: '#7C3AED' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <p className="text-[13px] text-slate-600">{label}</p>
                <p className="text-[14px] font-black" style={{ color }}>
                  {isLoading
                    ? <span className="inline-block h-4 w-12 rounded bg-slate-100 animate-pulse" />
                    : value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
