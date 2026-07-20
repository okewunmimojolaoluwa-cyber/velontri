'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send, Search, Inbox, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import { useAuth } from '@/features/auth/auth-provider';

interface Thread {
  id: string;
  participant_a: string;
  participant_b: string;
  other_user_id: string;
  other_user_name?: string;
  listing_id: string | null;
  created_at: string;
  last_message?: string | null;
  last_message_at?: string | null;
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  type: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

function timeAgo(dateStr: string) {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  } catch { return ''; }
}

export default function UserMessagesPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Thread list — tries /chat/inbox first, falls back to analytics endpoint ─── */
  const { data: threadsData, isLoading: threadsLoading, refetch: refetchThreads } = useQuery({
    queryKey: ['chat-inbox', session.userId],
    queryFn: async (): Promise<ApiResponse<Thread[]>> => {
      // Primary: dedicated inbox endpoint (Bearer-auth, returns names)
      try {
        const res = await apiClient.get<ApiResponse<Thread[]>>('/chat/inbox');
        if (Array.isArray(res.data?.data)) return res.data;
      } catch {}
      // Fallback: analytics raw-SQL endpoint
      try {
        const res = await apiClient.get<ApiResponse<Thread[]>>('/analytics/chat-threads');
        if (Array.isArray(res.data?.data)) return res.data;
      } catch {}
      return { success: true, data: [], meta: null, message: '0 threads' };
    },
    enabled: session.isAuthenticated,
    refetchInterval: 8_000,
    staleTime: 3_000,
    refetchOnWindowFocus: true,
  });

  /* ── Messages for active thread ─────────────────────────────────────────── */
  const { data: msgsData, isLoading: msgsLoading } = useQuery({
    queryKey: ['chat-messages', active],
    queryFn: async (): Promise<ApiResponse<Message[]>> => {
      // Primary: chat inbox messages endpoint
      try {
        const res = await apiClient.get<ApiResponse<Message[]>>(`/chat/inbox/${active}/messages`);
        if (Array.isArray(res.data?.data)) return res.data;
      } catch {}
      // Fallback: analytics raw SQL endpoint
      try {
        const res = await apiClient.get<ApiResponse<Message[]>>(`/analytics/chat-threads/${active}/messages`);
        if (Array.isArray(res.data?.data)) return res.data;
      } catch {}
      return { success: true, data: [], meta: null, message: '0 messages' };
    },
    enabled: !!active,
    refetchInterval: 4_000,
    staleTime: 2_000,
  });

  /* ── Send message ────────────────────────────────────────────────────────── */
  const { mutate: sendMsg, isPending: sending } = useMutation({
    mutationFn: async () => {
      const thread = threads.find(t => t.id === active);
      const recipientId = thread?.other_user_id ?? '';
      if (!recipientId || !text.trim()) throw new Error('No recipient or empty message');
      const res = await apiClient.post<ApiResponse<{ message_id: string; thread_id: string }>>('/chat/messages', {
        recipient_id: recipientId,
        content: text.trim(),
        listing_id: thread?.listing_id ?? undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      setText('');
      // Refetch both messages and thread list
      qc.invalidateQueries({ queryKey: ['chat-messages', active] });
      qc.invalidateQueries({ queryKey: ['chat-inbox', session.userId] });
      setTimeout(() => {
        qc.refetchQueries({ queryKey: ['chat-messages', active] });
        qc.refetchQueries({ queryKey: ['chat-inbox', session.userId] });
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    },
  });

  const threads = Array.isArray(threadsData?.data) ? threadsData.data : [];
  const messages = Array.isArray(msgsData?.data) ? msgsData.data : [];
  const filtered = search
    ? threads.filter(t =>
        (t.other_user_id ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.last_message ?? '').toLowerCase().includes(search.toLowerCase()))
    : threads;

  const activeThread = threads.find(t => t.id === active);
  const otherUserId = activeThread?.other_user_id ?? null;
  const otherUserName = activeThread?.other_user_name || otherUserId?.substring(0, 8) || 'User';

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, active]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
      e.preventDefault();
      sendMsg();
    }
  }

  return (
    <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={{ height: 'calc(100vh - 120px)', minHeight: 520 }}>

      {/* ── Sidebar ─────────────────────────────── */}
      <div className="flex w-72 flex-shrink-0 flex-col border-r border-slate-100">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-black text-slate-900">Messages</h2>
            <button onClick={() => refetchThreads()}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400
                hover:bg-slate-100 hover:text-slate-600 transition-colors"
              title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3
                text-[13px] text-slate-700 placeholder-slate-400 outline-none
                focus:border-indigo-400 focus:bg-white transition-all" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {threadsLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-2/3 rounded-full bg-slate-100" />
                    <div className="h-2.5 w-1/2 rounded-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Inbox className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-[13px] font-semibold text-slate-500">No conversations yet</p>
              <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
                When you message a seller, your conversations appear here.
              </p>
              <button onClick={() => refetchThreads()}
                className="mt-3 text-[12px] font-semibold text-indigo-600 hover:underline">
                Refresh
              </button>
            </div>
          ) : (
            <ul className="py-2">
              {filtered.map(thread => {
                const displayName = thread.other_user_name || thread.other_user_id?.substring(0, 8) || 'User';
                const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                const isActive = thread.id === active;
                return (
                  <li key={thread.id}>
                    <button onClick={() => setActive(thread.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}>
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center
                        rounded-full text-[13px] font-bold ${
                          isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                        {initials || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-[13px] truncate ${isActive ? 'font-bold text-indigo-700' : 'font-semibold text-slate-900'}`}>
                            {displayName}
                          </p>
                          <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">
                            {timeAgo(thread.last_message_at ?? thread.created_at)}
                          </span>
                        </div>
                        {thread.last_message ? (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{thread.last_message}</p>
                        ) : thread.listing_id ? (
                          <p className="text-[11px] text-slate-400 truncate">Re: listing</p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Chat area ───────────────────────────── */}
      {!active ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
            <MessageCircle className="h-8 w-8 text-indigo-400" />
          </div>
          <p className="text-[16px] font-bold text-slate-900">Select a conversation</p>
          <p className="text-[13px] text-slate-400 max-w-xs">
            Choose a conversation from the left, or start one by messaging a seller on any listing.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[12px] font-bold text-indigo-700">
              {otherUserName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-[14px] font-bold text-slate-900">{otherUserName}</p>
              {activeThread?.listing_id && (
                <p className="text-[11px] text-slate-400">Re: listing</p>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {msgsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                    <div className="h-9 w-48 rounded-2xl bg-slate-100 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[13px] text-slate-400">No messages yet. Say hello!</p>
              </div>
            ) : (
              messages.map(msg => {
                const mine = msg.sender_id === session.userId;
                return (
                  <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                      mine
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      <p>{msg.content}</p>
                      <p className={`mt-0.5 text-[10px] ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {timeAgo(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send)"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5
                  text-[14px] text-slate-800 placeholder-slate-400 focus:border-indigo-400
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all
                  max-h-32 overflow-y-auto"
                style={{ minHeight: 44 }}
              />
              <button
                onClick={() => text.trim() && sendMsg()}
                disabled={sending || !text.trim()}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl
                  bg-indigo-600 text-white hover:bg-indigo-700 transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending
                  ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                        strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                    </svg>
                  : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
