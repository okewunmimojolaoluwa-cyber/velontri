'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings, Shield, CreditCard, Bell, Server,
  Globe, Save, Loader2, CheckCircle, AlertTriangle,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

/* ── Types ─────────────────────────────────────────────── */
interface MaintenanceStatus {
  enabled: boolean;
  message: string;
}

/* ── Tab type ───────────────────────────────────────────── */
type Tab = 'general' | 'security' | 'integrations' | 'maintenance';

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: 'general',      label: 'General',      icon: Globe    },
  { id: 'security',     label: 'Security',     icon: Shield   },
  { id: 'integrations', label: 'Integrations', icon: CreditCard },
  { id: 'maintenance',  label: 'Maintenance',  icon: Server   },
];

/* ── General settings tab (static for now) ─────────────── */
function GeneralTab() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: 'Platform Name',    value: 'Velontri', hint: 'Displayed in emails and the browser tab' },
          { label: 'Support Email',    value: 'support@velontri.com', hint: 'Where user support emails go' },
          { label: 'Business Email',   value: 'business@velontri.com', hint: 'Enterprise contact email' },
          { label: 'Platform URL',     value: 'https://velontri.com', hint: 'The canonical public URL' },
        ].map(f => (
          <div key={f.label}>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">{f.label}</label>
            <input defaultValue={f.value}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px]
                text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10" />
            <p className="text-[11px] text-slate-400 mt-1">{f.hint}</p>
          </div>
        ))}
      </div>
      <div className="pt-2">
        <button className="inline-flex items-center gap-2 h-9 rounded-xl bg-indigo-600 px-5
          text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors">
          <Save className="h-3.5 w-3.5" /> Save changes
        </button>
      </div>
    </div>
  );
}

/* ── Security tab ───────────────────────────────────────── */
function SecurityTab() {
  return (
    <div className="space-y-5">
      {[
        { label: 'Session Timeout (minutes)', value: '480', hint: 'How long before idle users are logged out' },
        { label: 'Max Login Attempts',         value: '5',   hint: 'Account is locked after this many failed attempts' },
        { label: 'Lockout Duration (minutes)', value: '15',  hint: 'How long accounts stay locked after too many failures' },
      ].map(f => (
        <div key={f.label} className="max-w-sm">
          <label className="block text-[12px] font-semibold text-slate-700 mb-1">{f.label}</label>
          <input type="number" defaultValue={f.value}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px]
              text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10" />
          <p className="text-[11px] text-slate-400 mt-1">{f.hint}</p>
        </div>
      ))}
      <div className="pt-2">
        <button className="inline-flex items-center gap-2 h-9 rounded-xl bg-indigo-600 px-5
          text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors">
          <Save className="h-3.5 w-3.5" /> Save changes
        </button>
      </div>
    </div>
  );
}

/* ── Integrations tab ───────────────────────────────────── */
function IntegrationsTab() {
  return (
    <div className="space-y-6">
      {/* Paystack */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CreditCard className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-900">Paystack</p>
            <p className="text-[11px] text-slate-400">Subscription payment processing</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Secret Key</label>
            <input type="password" defaultValue="sk_test_••••••••••••••"
              className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px]
                text-slate-500 focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Public Key</label>
            <input type="text" defaultValue="pk_test_••••••••••••••"
              className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px]
                text-slate-500 focus:outline-none focus:border-indigo-400" />
            <p className="text-[10px] text-slate-400 mt-1">
              Edit these keys in <code className="bg-slate-100 px-1 rounded">backend/.env</code>
            </p>
          </div>
        </div>
      </div>

      {/* Gmail SMTP */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <Bell className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-900">Gmail SMTP</p>
            <p className="text-[11px] text-slate-400">Transactional email (OTPs, notifications)</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gmail Address</label>
            <input type="text" defaultValue="okewunmimojolaoluwa@gmail.com"
              className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px]
                text-slate-500 focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">App Password</label>
            <input type="password" defaultValue="••••••••••••••••"
              className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px]
                text-slate-500 focus:outline-none focus:border-indigo-400" />
            <p className="text-[10px] text-slate-400 mt-1">
              Edit in <code className="bg-slate-100 px-1 rounded">backend/.env</code> →
              GMAIL_USER / GMAIL_APP_PASSWORD
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Maintenance tab ─────────────────────────────────────── */
function MaintenanceTab() {
  const qc = useQueryClient();
  const [msgValue, setMsgValue] = useState('');
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'maintenance'],
    queryFn: () =>
      apiClient.get<ApiResponse<MaintenanceStatus>>('/admin/maintenance').then(r => r.data),
    staleTime: 10_000,
  });

  const status = data?.data;

  useEffect(() => {
    if (status?.message && !msgValue) {
      setMsgValue(status.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.message]);

  const { mutate: update, isPending } = useMutation({
    mutationFn: (body: { enabled: boolean; message: string }) =>
      apiClient.post('/admin/maintenance', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'maintenance'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleToggle = () => {
    if (!status) return;
    update({ enabled: !status.enabled, message: msgValue });
  };

  const handleSaveMessage = () => {
    if (!status) return;
    update({ enabled: status.enabled, message: msgValue });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const enabled = status?.enabled ?? false;

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Status card */}
      <div className={`rounded-2xl border-2 p-6 transition-all ${
        enabled
          ? 'border-amber-300 bg-amber-50'
          : 'border-slate-200 bg-white'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${
            enabled ? 'bg-amber-100' : 'bg-slate-100'
          }`}>
            <Server className={`h-6 w-6 ${enabled ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-black text-slate-900 mb-0.5">Maintenance Mode</p>
            <p className="text-[13px] text-slate-500 mb-4">
              When enabled, all users (except admins) will see a maintenance banner and
              cannot interact with the platform.
            </p>

            <div className="flex items-center gap-4">
              <button
                onClick={handleToggle}
                disabled={isPending}
                className={`flex items-center gap-2.5 h-10 rounded-xl px-5 font-bold text-[13px]
                  transition-all disabled:opacity-60 ${
                  enabled
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-slate-900 text-white hover:bg-slate-700'
                  }`}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : enabled ? (
                  <ToggleRight className="h-4 w-4" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
                {enabled ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
              </button>

              <span className={`flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-3 py-1 ${
                enabled
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                {enabled ? 'Maintenance ON' : 'Platform Live'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Success toast */}
      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-[13px] font-semibold text-emerald-700">Settings saved successfully.</p>
        </div>
      )}

      {/* Maintenance message */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <label className="block text-[13px] font-bold text-slate-900 mb-2">
          Maintenance Message
        </label>
        <p className="text-[12px] text-slate-400 mb-3">
          This message is shown to users while maintenance mode is active.
        </p>
        <textarea
          rows={3}
          value={msgValue}
          onChange={e => setMsgValue(e.target.value)}
          placeholder="We are currently performing scheduled maintenance. We'll be back shortly."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px]
            text-slate-800 placeholder-slate-400 resize-none focus:outline-none
            focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleSaveMessage}
            disabled={isPending || !msgValue.trim()}
            className="inline-flex items-center gap-2 h-9 rounded-xl bg-indigo-600 px-5
              text-[13px] font-bold text-white hover:bg-indigo-700 transition-colors
              disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save message
          </button>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[12px] font-bold text-amber-800 mb-0.5">Before enabling maintenance mode</p>
          <p className="text-[12px] text-amber-700 leading-relaxed">
            Active users will see the maintenance message and won't be able to use the platform.
            Admin users can still access the admin dashboard. Make sure to disable it once done.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function PlatformSettingsPage() {
  const [tab, setTab] = useState<Tab>('general');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-indigo-600" /> Platform Settings
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure platform-wide settings</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold
              transition-all ${tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {tab === 'general'      && <GeneralTab />}
        {tab === 'security'     && <SecurityTab />}
        {tab === 'integrations' && <IntegrationsTab />}
        {tab === 'maintenance'  && <MaintenanceTab />}
      </div>
    </div>
  );
}
