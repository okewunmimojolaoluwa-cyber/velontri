'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, Package, DollarSign, ShoppingCart, Star, Store, MapPin, BarChart2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

/* ── Types ─────────────────────────────────────── */
interface BusinessStats {
  total_revenue: number;
  active_users: number;
  total_orders: number;
  active_listings: number;
  avg_rating: number;
  active_stores: number;
  countries: number;
  mom_growth: number;
  currency: string;
}

interface CategoryGmv {
  category: string;
  percentage: number;
  color: string;
}

interface CountryStat {
  country: string;
  flag: string;
  user_count: number;
  share_pct: number;
}

/* ── Skeleton rows ──────────────────────────────── */
function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-8 rounded-lg bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

export default function BusinessOverviewPage() {
  /* Core KPIs */
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'business-overview'],
    queryFn: () =>
      apiClient.get<ApiResponse<BusinessStats>>('/analytics/business').then((r) => r.data),
    staleTime: 60_000,
  });

  /* Category GMV breakdown */
  const { data: catData, isLoading: catLoading } = useQuery({
    queryKey: ['admin', 'category-gmv'],
    queryFn: () =>
      apiClient.get<ApiResponse<CategoryGmv[]>>('/analytics/categories/gmv').then((r) => r.data),
    staleTime: 60_000,
  });

  /* Top countries */
  const { data: countryData, isLoading: countryLoading } = useQuery({
    queryKey: ['admin', 'top-countries'],
    queryFn: () =>
      apiClient.get<ApiResponse<CountryStat[]>>('/analytics/countries/top').then((r) => r.data),
    staleTime: 60_000,
  });

  const stats     = statsData?.data;
  const categories = catData?.data ?? [];
  const countries  = countryData?.data ?? [];
  const currency   = stats?.currency ?? 'NGN';

  function fmt(n: number) {
    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
        notation: n >= 1_000_000 ? 'compact' : 'standard',
      }).format(n);
    } catch {
      return `₦${n.toLocaleString()}`;
    }
  }

  const KPI_CARDS = stats
    ? [
        { label: 'Total Revenue',   value: fmt(stats.total_revenue),                  icon: DollarSign,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Active Users',    value: stats.active_users.toLocaleString(),         icon: Users,        color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
        { label: 'Total Orders',    value: stats.total_orders.toLocaleString(),         icon: ShoppingCart, color: 'text-violet-600',  bg: 'bg-violet-50'  },
        { label: 'Active Listings', value: stats.active_listings.toLocaleString(),      icon: Package,      color: 'text-sky-600',     bg: 'bg-sky-50'     },
        { label: 'Avg. Rating',     value: `${stats.avg_rating.toFixed(1)} ★`,          icon: Star,         color: 'text-amber-600',   bg: 'bg-amber-50'   },
        { label: 'Active Stores',   value: stats.active_stores.toLocaleString(),        icon: Store,        color: 'text-pink-600',    bg: 'bg-pink-50'    },
        { label: 'Countries',       value: stats.countries.toLocaleString(),            icon: MapPin,       color: 'text-teal-600',    bg: 'bg-teal-50'    },
        { label: 'MoM Growth',      value: `+${stats.mom_growth.toFixed(1)}%`,          icon: TrendingUp,   color: 'text-green-600',   bg: 'bg-green-50'   },
      ]
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Business Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">High-level view of your platform health</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading || !KPI_CARDS
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-slate-100 animate-pulse mb-3" />
                <div className="h-7 w-24 rounded-lg bg-slate-100 animate-pulse mb-1" />
                <div className="h-3 w-20 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ))
          : KPI_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${bg} mb-3`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Categories by GMV */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Top Categories by GMV</h3>
          {catLoading ? (
            <SkeletonRows count={5} />
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <BarChart2 className="h-10 w-10 text-slate-200 mb-2" />
              <p className="text-sm font-semibold text-slate-900">No category data yet</p>
              <p className="text-xs text-slate-400 mt-1">Revenue will appear here after your first successful sales</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map(({ category, percentage, color }) => (
                <div key={category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{category}</span>
                    <span className="text-sm font-bold text-slate-900">{percentage}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{ width: `${percentage}%`, background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top countries */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Top Countries</h3>
          {countryLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-100 animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-24 rounded-full bg-slate-100 animate-pulse" />
                    <div className="h-2 w-16 rounded-full bg-slate-100 animate-pulse" />
                  </div>
                  <div className="h-4 w-8 rounded-full bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
          ) : countries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <MapPin className="h-10 w-10 text-slate-200 mb-2" />
              <p className="text-sm font-semibold text-slate-900">No geographic data yet</p>
              <p className="text-xs text-slate-400 mt-1">Country data will appear once users register</p>
            </div>
          ) : (
            <div className="space-y-3">
              {countries.map(({ country, flag, user_count, share_pct }) => (
                <div key={country} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{flag}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{country}</p>
                      <p className="text-xs text-slate-500">{user_count.toLocaleString()} users</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{share_pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
