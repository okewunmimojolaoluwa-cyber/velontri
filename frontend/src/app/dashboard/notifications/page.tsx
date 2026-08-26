'use client';

import { Bell, Package, ChatCircle, CurrencyDollar, ShieldCheck, CheckCheck, CheckCircle, XCircle, ArrowSquareOut, User } from '@phosphor-icons/react';
import { useNotifications } from '@/lib/hooks/use-notifications';
import type { Notification } from '@/lib/hooks/use-notifications';
import Link from 'next/link';

const TYPE_ICON: Record<string, typeof Bell> = {
  order:            Package,
  message:          ChatCircle,
  payment:          CurrencyDollar,
  listing:          Package,
  listing_approved: Package,
  listing_rejected: XCircle,
  system:           ShieldCheck,
  dispute:          ShieldCheck,
};

const TYPE_COLOR: Record<string, string> = {
  listing_approved: 'bg-emerald-100 text-emerald-600',
  listing_rejected: 'bg-red-100 text-red-600',
  message:          'bg-indigo-100 text-indigo-600',
  payment:          'bg-amber-100 text-amber-600',
  dispute:          'bg-orange-100 text-orange-600',
};

function fmtTime(ts: string) {
  try {
    return new Date(ts).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ts; }
}

export default function UserNotificationsPage() {
  const { notifications, unread_count, isLoading, markRead, markAllRead } = useNotifications({
    page: 1,
    page_size: 50,
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Notifications</h1>
          {unread_count > 0 && (
            <p className="text-[12px] text-indigo-600 font-semibold mt-0.5">
              {unread_count} unread
            </p>
          )}
        </div>
        {unread_count > 0 && (
          <button
            onClick={() => markAllRead()}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:underline"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-[14px] font-semibold text-slate-900 mb-1">All caught up</p>
            <p className="text-[12px] text-slate-400">Notifications will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n: Notification) => {
              const Icon = TYPE_ICON[n.type] ?? Bell;
              const iconCls = TYPE_COLOR[n.type] ?? (n.is_read ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-600');
              const isRejection = n.type === 'listing_rejected';
              const isApproval  = n.type === 'listing_approved';

              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 px-5 py-4 transition-colors cursor-default ${
                    !n.is_read ? 'bg-indigo-50/40' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => { if (!n.is_read) markRead(n.id); }}
                >
                  {/* Icon */}
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${iconCls}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[13px] font-semibold leading-snug ${!n.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                      )}
                    </div>

                    <p className={`text-[12px] mt-0.5 leading-relaxed whitespace-pre-line ${
                      isRejection ? 'text-red-700' : isApproval ? 'text-emerald-700' : 'text-slate-500'
                    }`}>
                      {n.message}
                    </p>

                    {/* Sender — always from backend JWT, never frontend */}
                    {n.sender_name ? (
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="font-medium">
                          {n.sender_role ? `${n.sender_name} · ${n.sender_role}` : n.sender_name}
                        </span>
                      </p>
                    ) : (isApproval || isRejection) ? (
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Velontri Moderation Team
                      </p>
                    ) : null}

                    <p className="text-[10px] text-slate-400 mt-1">{fmtTime(n.created_at)}</p>

                    {/* Action buttons */}
                    {(n.action_url || isRejection) && (
                      <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                        {n.action_url && (
                          <Link
                            href={n.action_url}
                            className="inline-flex items-center gap-1 h-7 rounded-lg bg-indigo-50 border border-indigo-200
                              px-2.5 text-[11px] font-semibold text-indigo-600 no-underline hover:bg-indigo-100 transition-colors"
                          >
                            <ArrowSquareOut className="h-3 w-3" /> View
                          </Link>
                        )}
                        {isRejection && (
                          <Link
                            href="/dashboard/listings"
                            className="inline-flex items-center gap-1 h-7 rounded-lg bg-slate-50 border border-slate-200
                              px-2.5 text-[11px] font-semibold text-slate-600 no-underline hover:bg-slate-100 transition-colors"
                          >
                            PencilSimple &amp; Resubmit
                          </Link>
                        )}
                      </div>
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