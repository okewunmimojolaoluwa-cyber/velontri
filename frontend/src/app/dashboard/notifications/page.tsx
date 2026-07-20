'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Package, MessageCircle, DollarSign, ShieldCheck, CheckCheck } from 'lucide-react';
import { notificationsApi } from '@/lib/api/endpoints/notifications';
import { useAuth } from '@/features/auth/auth-provider';

const TYPE_ICON: Record<string, typeof Bell> = {
  order:    Package,
  message:  MessageCircle,
  payment:  DollarSign,
  listing:  Package,
  system:   ShieldCheck,
};

export default function UserNotificationsPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session.userId;

  const { data, isLoading } = useQuery({
    queryKey: [uid, 'notifications', 'list'],
    queryFn: () => notificationsApi.getNotifications({ page: 1, page_size: 50 }),
    enabled: session.isAuthenticated,
  });

  const { mutate: markAll } = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: [uid, 'notifications'] }),
  });

  const notifs = Array.isArray(data?.data) ? data.data : [];
  const unread = notifs.filter(n => !n.is_read).length;

  return (
      <div className="space-y-5 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Notifications</h1>
            {unread > 0 && <p className="text-[12px] text-indigo-600 font-semibold mt-0.5">{unread} unread</p>}
          </div>
          {unread > 0 && (
            <button onClick={() => markAll()}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:underline">
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
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="h-12 w-12 text-slate-200 mb-3" />
              <p className="text-[14px] font-semibold text-slate-900 mb-1">All caught up</p>
              <p className="text-[12px] text-slate-400">Notifications will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifs.map(n => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                return (
                  <li key={n.id}
                    className={`flex items-start gap-3 px-5 py-4 transition-colors ${!n.is_read ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`}>
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl
                      ${!n.is_read ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium leading-snug ${!n.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                        {n.title}
                      </p>
                      <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(n.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
  );
}
