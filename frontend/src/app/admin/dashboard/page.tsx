'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, Package, DollarSign, AlertTriangle, Shield, Activity,
  TrendingUp, Server, ArrowRight, BarChart2,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RoleGate } from '@/components/rbac/role-gate';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils/cn';

/* ── Types ─────────────────────────────────────── */
interface PlatformStats {
  total_users: number;
  total_listings: number;
  total_transactions: number;
  pending_disputes: number;
  pending_moderation: number;
  gmv_today: number;
  gmv_week: number;
  gmv_month: number;
  today_sales_count: number;
  currency: string;
  new_users_today: number;
  active_sessions: number;
}

interface RevenuePoint {
  date: string;
  gmv: number;
}

interface ServiceHealth {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency_ms: number;
}

interface LiveEvent {
  message: string;
  time_ago: string;
  event_type: string;
}

function fmt(n: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      notation: n >= 1_000_000 ? 'compact' : 'standard',
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

const EVENT_DOT: Record<string, string> = {
  registration: 'bg-emerald-500',
  listing:      'bg-primary',
  transaction:  'bg-amber-500',
  dispute:      'bg-red-500',
  kyc:          'bg-sky-500',
  subscription: 'bg-violet-500',
};

export default function AdminDashboardPage() {
  /* Core stats */
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () =>
      apiClient.get<ApiResponse<PlatformStats>>('/analytics/admin/stats').then((r) => r.data),
    staleTime: 60_000,
  });

  /* GMV chart */
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['admin', 'gmv-chart'],
    queryFn: () =>
      apiClient.get<ApiResponse<RevenuePoint[]>>('/analytics/revenue/daily?days=14').then((r) => r.data),
    staleTime: 60_000,
  });

  /* System health */
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () =>
      apiClient.get<ApiResponse<ServiceHealth[]>>('/admin/health').then((r) => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  /* Live activity */
  const { data: liveData, isLoading: liveLoading } = useQuery({
    queryKey: ['admin', 'live-activity'],
    queryFn: () =>
      apiClient.get<ApiResponse<LiveEvent[]>>('/analytics/activity/recent?limit=6').then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  const stats    = statsData?.data;
  const chart    = chartData?.data ?? [];
  const health   = healthData?.data ?? [];
  const events   = liveData?.data ?? [];
  const currency = stats?.currency ?? 'NGN';

  return (
    <RoleGate
      roles={['super_admin']}
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center space-y-2">
            <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto" />
            <p className="font-semibold">Access Denied</p>
            <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Business Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Platform performance and metrics.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 text-xs font-semibold text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Platform live
          </div>
        </div>

        {/* Revenue Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Today's Revenue"
            value={statsLoading ? '…' : stats ? fmt(stats.gmv_today, currency) : '—'}
            icon={DollarSign}
            color="#059669" bg="#ecfdf5"
          />
          <StatCard
            label="Weekly Revenue"
            value={statsLoading ? '…' : stats ? fmt(stats.gmv_week, currency) : '—'}
            icon={DollarSign}
            color="#059669" bg="#ecfdf5"
          />
          <StatCard
            label="Monthly Revenue"
            value={statsLoading ? '…' : stats ? fmt(stats.gmv_month, currency) : '—'}
            icon={DollarSign}
            color="#059669" bg="#ecfdf5"
          />
          <StatCard
            label="Today's Sales"
            value={statsLoading ? '…' : stats ? stats.today_sales_count.toLocaleString() : '—'}
            icon={Package}
            color="#4F46E5" bg="#eef2ff"
          />
        </div>

        {/* Charts row */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* GMV chart */}
          <div className="lg:col-span-2 card-premium p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-semibold">Platform GMV</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Last 14 days</p>
              </div>
              <Badge variant="success">Live</Badge>
            </div>
            <div className="h-52">
              {chartLoading ? (
                <div className="h-full rounded-xl bg-muted/30 animate-pulse flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Loading chart…</p>
                </div>
              ) : chart.length === 0 ? (
                <div className="h-full rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2">
                  <BarChart2 className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">No analytics available yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(243 75% 59%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(243 75% 59%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(val: number) => fmt(val, currency)}
                    />
                    <Area type="monotone" dataKey="gmv" stroke="hsl(243 75% 59%)" strokeWidth={2.5} fill="url(#adminGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* System health */}
          <div className="card-premium p-6">
            <div className="flex items-center gap-2 mb-5">
              <Server className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">System Health</h2>
            </div>
            {healthLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                ))}
              </div>
            ) : health.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Server className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground">Health data unavailable</p>
              </div>
            ) : (
              <div className="space-y-3">
                {health.map(({ name, status, latency_ms }) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        'h-2 w-2 rounded-full flex-shrink-0',
                        status === 'operational' ? 'bg-emerald-500' :
                        status === 'degraded'    ? 'bg-amber-500'   : 'bg-red-500'
                      )} />
                      <span className="text-xs text-muted-foreground truncate">{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{latency_ms}ms</span>
                      <Badge
                        variant={status === 'operational' ? 'success' : status === 'degraded' ? 'warning' : 'destructive'}
                        className="text-xs capitalize"
                      >
                        {status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions + Live feed */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Quick actions */}
          <div className="card-premium p-6 space-y-4">
            <h2 className="font-semibold">Quick Actions</h2>
            <div className="space-y-2">
              {[
                {
                  icon: Users,
                  label: 'Manage Users',
                  desc: stats ? `${stats.total_users.toLocaleString()} total registered` : 'Loading…',
                  href: ROUTES.admin.users,
                  color: 'text-primary bg-primary/10',
                },
                {
                  icon: Shield,
                  label: 'Review Listings',
                  desc: stats ? `${stats.pending_moderation} pending review` : 'Loading…',
                  href: ROUTES.admin.listings,
                  color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
                },
                {
                  icon: AlertTriangle,
                  label: 'Resolve Disputes',
                  desc: stats ? `${stats.pending_disputes} open` : 'Loading…',
                  href: ROUTES.admin.disputes,
                  color: 'text-red-500 bg-red-100 dark:bg-red-900/30',
                },
              ].map(({ icon: Icon, label, desc, href, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted transition-colors group"
                >
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{statsLoading ? 'Loading…' : desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>

          {/* Live activity feed */}
          <div className="card-premium overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Live Activity</h2>
              </div>
              <Badge variant="success">Real-time</Badge>
            </div>
            {liveLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-2">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-muted animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <Activity className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm font-medium">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-1">Events will appear here as they happen</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {events.map((event, i) => (
                  <li key={i} className="flex items-start gap-3 px-6 py-3.5">
                    <span className={cn('mt-1.5 h-2 w-2 rounded-full flex-shrink-0', EVENT_DOT[event.event_type] ?? 'bg-slate-400')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{event.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{event.time_ago}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </RoleGate>
  );
}
