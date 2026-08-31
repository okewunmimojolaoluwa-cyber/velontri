'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatCircle, PaperPlaneRight, MagnifyingGlass, Tray, ArrowClockwise, ArrowLeft, CircleNotch, WarningCircle } from '@phosphor-icons/react';
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

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function Avatar({ name, size = 'md', active = false }: { name: string; size?: 'sm' | 'md'; active?: boolean }) {
  const sz = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-[13px]';
  const bg = active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600';
  return (
    <div className={`${sz} ${bg} flex flex-shrink-0 items-center justify-center rounded-full font-bold`}>
      {getInitials(name)}
    </div>
  );
}

export default function UserMessagesPage() {
  const { session } = useAuth();
  const qc = useQueryClient();

  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [sendErr, setSendErr] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Thread list — polls every 8s */
  const { data: threadsData, isLoading: threadsLoading, refetch: refetchThreads } = useQuery({
    queryKey: ['chat-inbox', session.userId],
    queryFn: async (): Promise<ApiResponse<Thread[]>> => {
      try {
        const res = await apiClient.get<ApiResponse<Thread[]>>('/chat/inbox');
        if (Array.isArray(res.data?.data)) return res.data;
      } catch {}
      return { success: true, data: [], meta: null, message: '' };
    },
    enabled: session.isAuthenticated,
    refetchInterval: 8_000,
    staleTime: 3_000,
    refetchOnWindowFocus: true,
  });

  /* Messages for active thread — polls every 4s */
  const { data: msgsData, isLoading: msgsLoading } = useQuery({
    queryKey: ['chat-messages', active],
    queryFn: async (): Promise<ApiResponse<Message[]>> => {
      if (!active) return { success: true, data: [], meta: null, message: '' };
      try {
        const res = await apiClient.get<ApiResponse<Message[]>>(`/chat/inbox/${active}/messages`);
        if (Array.isArray(res.data?.data)) return res.data;
      } catch {}
      return { success: true, data: [], meta: null, message: '' };
    },
    enabled: !!active,
    refetchInterval: 4_000,
    staleTime: 2_000,
  });

  /* Send message */
  const { mutate: sendMsg, isPending: sending } = useMutation({
    mutationFn: async () => {
      const thread = threads.find(t => t.id === active);
      const recipientId = thread?.other_user_id ?? '';
      if (!recipientId) throw new Error('Cannot identify recipient. Please refresh and try again.');
      if (!text.trim()) throw new Error('Message cannot be empty.');
      await apiClient.post('/chat/messages', {
        recipient_id: recipientId,
        content: text.trim(),
        ...(thread?.listing_id ? { listing_id: thread.listing_id } : {}),
      });
    },
    onSuccess: () => {
      setText('');
      setSendErr('');
      qc.invalidateQueries({ queryKey: ['chat-messages', active] });
      qc.invalidateQueries({ queryKey: ['chat-inbox', session.userId] });
      setTimeout(() => {
        qc.refetchQueries({ queryKey: ['chat-messages', active] });
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        textareaRef.current?.focus();
      }, 300);
    },
    onError: (e: any) => {
      setSendErr(e?.response?.data?.error?.message ?? e?.message ?? 'Failed to send. Please try again.');
    },
  });

  const threads: Thread[] = Array.isArray(threadsData?.data) ? threadsData.data : [];
  const messages: Message[] = Array.isArray(msgsData?.data) ? msgsData.data : [];

  const filtered = search.trim()
    ? threads.filter(t =>
        (t.other_user_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.last_message ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : threads;

  const activeThread = threads.find(t => t.id === active);
  const otherUserName = activeThread?.other_user_name || activeThread?.other_user_id?.slice(0, 8) || 'User';

  // Scroll to bottom when messages change or thread opens
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, active]);

  // Clear send error when text changes
  useEffect(() => {
    if (sendErr) setSendErr('');
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !sending) sendMsg();
    }
  }

  function handleSend() {
    if (text.trim() && !sending) sendMsg();
  }

  /* ── Thread list panel (shared between mobile + desktop) ── */
  function ThreadList() {
    return (
      <>
        {/* Search */}
        <div className="px-3 py-2.5 border-b border-slate-100 flex-shrink-0">
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px]
                text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Threads */}
        <div className="flex-1 overflow-y-auto">
          {threadsLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
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
              <Tray className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-[14px] font-semibold text-slate-900">No conversations yet</p>
              <p className="text-[12px] text-slate-400 mt-1 max-w-[180px] leading-relaxed">
                Message a seller from any listing to start a conversation.
              </p>
            </div>
          ) : (
            <ul>
              {filtered.map(thread => {
                const name = thread.other_user_name || thread.other_user_id?.slice(0, 8) || 'User';
                const isActive = thread.id === active;
                return (
                  <li key={thread.id}>
                    <button
                      onClick={() => { setActive(thread.id); setSendErr(''); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-slate-50
                        transition-colors ${isActive ? 'bg-indigo-50' : 'hover:bg-slate-50 active:bg-slate-100'}`}
                    >
                      <Avatar name={name} active={isActive} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-[13px] truncate ${isActive ? 'font-bold text-indigo-700' : 'font-semibold text-slate-900'}`}>
                            {name}
                          </p>
                          <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">
                            {timeAgo(thread.last_message_at ?? thread.created_at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {thread.last_message || (thread.listing_id ? 'About a listing' : 'New conversation')}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </>
    );
  }

  /* ── Message input bar (shared) ── */
  function InputBar() {
    return (
      <div className="border-t border-slate-100 p-4 flex-shrink-0 space-y-2">
        {sendErr && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2">
            <WarningCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            <p className="text-[12px] text-red-600">{sendErr}</p>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5
              text-[14px] text-slate-800 placeholder-slate-400 focus:border-indigo-400
              focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all
              max-h-32 overflow-y-auto"
            style={{ minHeight: 44 }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl
              bg-indigo-600 text-white hover:bg-indigo-700 transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {sending
              ? <CircleNotch className="h-4 w-4 animate-spin" />
              : <PaperPlaneRight className="h-4 w-4" />
            }
          </button>
        </div>
      </div>
    );
  }

  /* ── Messages area (shared) ── */
  function MessagesArea() {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
        {msgsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className="h-9 w-48 rounded-2xl bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <ChatCircle className="h-10 w-10 text-slate-200 mx-auto mb-2" />
              <p className="text-[13px] text-slate-400">No messages yet. Say hello!</p>
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const mine = msg.sender_id === session.userId;
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed break-words ${
                  mine
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                }`}>
                  <p>{msg.content}</p>
                  <p className={`mt-0.5 text-[10px] text-right ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {timeAgo(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={{ height: 'calc(100dvh - 120px)', minHeight: 480 }}
    >

      {/* ══ MOBILE layout ══ */}
      <div className="flex flex-col h-full md:hidden">
        {!active ? (
          /* Thread list */
          <>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 flex-shrink-0">
              <h2 className="text-[16px] font-black text-slate-900">Messages</h2>
              <button
                onClick={() => refetchThreads()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <ArrowClockwise className="h-3.5 w-3.5" />
              </button>
            </div>
            <ThreadList />
          </>
        ) : (
          /* Open conversation */
          <>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
              <button
                onClick={() => { setActive(null); setSendErr(''); }}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <Avatar name={otherUserName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-slate-900 truncate">{otherUserName}</p>
                {activeThread?.listing_id && (
                  <p className="text-[10px] text-slate-400">About a listing</p>
                )}
              </div>
            </div>
            <MessagesArea />
            <InputBar />
          </>
        )}
      </div>

      {/* ══ DESKTOP split-pane layout ══ */}
      <div className="hidden md:flex h-full">

        {/* Sidebar */}
        <div className="flex w-72 flex-shrink-0 flex-col border-r border-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 flex-shrink-0">
            <h2 className="text-[15px] font-black text-slate-900">Messages</h2>
            <button
              onClick={() => refetchThreads()}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <ArrowClockwise className="h-3.5 w-3.5" />
            </button>
          </div>
          <ThreadList />
        </div>

        {/* Chat area */}
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
              <ChatCircle className="h-8 w-8 text-indigo-400" />
            </div>
            <p className="text-[16px] font-bold text-slate-900">Select a conversation</p>
            <p className="text-[13px] text-slate-400 max-w-xs">
              Choose a conversation from the left, or message a seller from any listing.
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col min-w-0">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 flex-shrink-0">
              <Avatar name={otherUserName} active />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-slate-900 truncate">{otherUserName}</p>
                {activeThread?.listing_id && (
                  <p className="text-[11px] text-slate-400">About a listing</p>
                )}
              </div>
            </div>
            <MessagesArea />
            <InputBar />
          </div>
        )}
      </div>
    </div>
  );
}
