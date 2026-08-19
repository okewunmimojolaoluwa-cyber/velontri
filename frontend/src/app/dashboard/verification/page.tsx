'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck, ChevronRight, Upload, X, Check,
  AlertCircle, Clock, CheckCircle, XCircle, Info,
  User, FileText, Store, Shield, Building2,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/features/auth/auth-provider';

// ── Types ────────────────────────────────────────────────────────────────────

type VStatus =
  | 'not_verified' | 'draft' | 'submitted' | 'under_review'
  | 'approved' | 'rejected' | 'more_info_required' | 'suspended';

interface VerificationData {
  status: VStatus;
  application?: Record<string, any> | null;
}

// ── Status display config ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<VStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  not_verified:      { label: 'Not Verified',          color: 'text-slate-500',   bg: 'bg-slate-100',   icon: Shield },
  draft:             { label: 'Application Started',   color: 'text-indigo-600',  bg: 'bg-indigo-50',   icon: FileText },
  submitted:         { label: 'Application Submitted', color: 'text-blue-600',    bg: 'bg-blue-50',     icon: Clock },
  under_review:      { label: 'Under Review',          color: 'text-amber-600',   bg: 'bg-amber-50',    icon: Clock },
  approved:          { label: 'Verified Seller ✓',     color: 'text-emerald-700', bg: 'bg-emerald-50',  icon: CheckCircle },
  rejected:          { label: 'Not Approved',          color: 'text-red-600',     bg: 'bg-red-50',      icon: XCircle },
  more_info_required:{ label: 'More Information Needed',color: 'text-amber-700',  bg: 'bg-amber-50',    icon: AlertCircle },
  suspended:         { label: 'Suspended',             color: 'text-red-700',     bg: 'bg-red-100',     icon: XCircle },
};

const STEPS = [
  { id: 1, label: 'Personal Info',    icon: User },
  { id: 2, label: 'ID Verification',  icon: FileText },
  { id: 3, label: 'Seller Info',      icon: Store },
  { id: 4, label: 'Seller Profile',   icon: Building2 },
  { id: 5, label: 'Declaration',      icon: Shield },
];

const ID_TYPES = [
  'National ID (NIN)',
  'International Passport',
  "Driver's Licence",
  "Voter's Card",
  'Other Government-issued ID',
];

const BUSINESS_CATEGORIES = [
  'Electronics', 'Fashion & Clothing', 'Furniture & Home',
  'Vehicles & Automotive', 'Property & Real Estate', 'Food & Beverages',
  'Health & Beauty', 'Sports & Fitness', 'Books & Education',
  'Services & Freelancing', 'Agriculture', 'Other',
];

const inputCls = 'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all';
const labelCls = 'block text-[13px] font-semibold text-slate-700 mb-1.5';

// ── Image upload helper ──────────────────────────────────────────────────────

function ImageUpload({
  label, value, onChange, hint,
}: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          <img src={value} alt={label} className="h-36 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="absolute bottom-2 left-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
            ✓ Uploaded
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
        >
          <Upload className="h-8 w-8 text-slate-300" />
          <span className="text-[13px] font-semibold text-slate-500">Click to upload</span>
          {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VerificationPage() {
  const { session } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [err, setErr] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
  const [form, setForm] = useState({
    // Step 1
    full_name: '', date_of_birth: '', country: 'Nigeria', state: '',
    city: '', residential_address: '', phone: '', email: '',
    // Step 2
    id_type: '', id_number: '', id_front_url: '', id_back_url: '',
    // Step 3
    seller_type: 'individual' as 'individual' | 'business',
    display_name: '', seller_description: '', location: '', whatsapp_number: '',
    business_name: '', business_description: '', business_address: '',
    business_reg_number: '', business_phone: '', business_category: '',
    // Step 4
    store_name: '', store_description: '', store_logo_url: '', profile_photo_url: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['verification', 'me'],
    queryFn: () => apiClient.get('/verification/me').then(r => r.data),
    enabled: session.isAuthenticated,
  });

  // Populate form from existing application data (useQuery onSuccess removed in v5)
  const [formPopulated, setFormPopulated] = useState(false);
  if (data && !formPopulated) {
    const app = (data as any)?.data?.application;
    if (app) {
      setFormPopulated(true);
      setForm(prev => ({
        ...prev,
        full_name:            app.full_name || prev.full_name,
        date_of_birth:        app.date_of_birth || '',
        country:              app.country || 'Nigeria',
        state:                app.state || '',
        city:                 app.city || '',
        residential_address:  app.residential_address || '',
        phone:                app.phone || '',
        email:                app.email || '',
        id_type:              app.id_type || '',
        id_number:            app.id_number || '',
        seller_type:          app.seller_type || 'individual',
        display_name:         app.display_name || '',
        seller_description:   app.seller_description || '',
        location:             app.location || '',
        whatsapp_number:      app.whatsapp_number || '',
        business_name:        app.business_name || '',
        business_description: app.business_description || '',
        business_address:     app.business_address || '',
        business_reg_number:  app.business_reg_number || '',
        business_phone:       app.business_phone || '',
        business_category:    app.business_category || '',
        store_name:           app.store_name || '',
        store_description:    app.store_description || '',
        store_logo_url:       app.store_logo_url || '',
        profile_photo_url:    app.profile_photo_url || '',
      }));
    }
  }

  const verData: VerificationData = data?.data ?? { status: 'not_verified' };
  const status = verData.status;
  const app = verData.application;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_verified;
  const StatusIcon = cfg.icon;

  function setField(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
    setErr('');
  }

  async function saveStep(): Promise<boolean> {
    setSaving(true);
    setErr('');
    try {
      await apiClient.post('/verification/save', form);
      qc.invalidateQueries({ queryKey: ['verification', 'me'] });
      return true;
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Failed to save. Please try again.';
      setErr(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function nextStep() {
    setErr('');
    if (step === 1) {
      if (!form.full_name.trim()) { setErr('Full name is required.'); return; }
      if (!form.phone.trim()) { setErr('Phone number is required.'); return; }
    }
    if (step === 2) {
      if (!form.id_type) { setErr('Please select an ID type.'); return; }
      if (!form.id_number.trim()) { setErr('ID number is required.'); return; }
      if (!form.id_front_url) { setErr('Please upload the front of your ID.'); return; }
    }
    const ok = await saveStep();
    if (ok) setStep(s => s + 1);
  }

  async function handleSubmit() {
    if (!agreed) { setErr('You must agree to the declaration before submitting.'); return; }
    setSubmitting(true);
    setErr('');
    try {
      await apiClient.post('/verification/save', form);
      await apiClient.post('/verification/submit', {});
      qc.invalidateQueries({ queryKey: ['verification', 'me'] });
      setSuccessMsg('Your application has been submitted successfully. Our team will review it shortly.');
    } catch (e: any) {
      setErr(e?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Status screen for submitted/approved/etc ──────────────────────────────

  if (!isLoading && status !== 'not_verified' && status !== 'draft') {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Seller Verification</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Track your verification application status</p>
        </div>

        {/* Status card */}
        <div className={`rounded-2xl border p-6 ${cfg.bg} border-current/10`}>
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-full ${cfg.bg} border-2 border-current/20`}>
              <StatusIcon className={`h-7 w-7 ${cfg.color}`} />
            </div>
            <div>
              <p className={`text-[17px] font-black ${cfg.color}`}>{cfg.label}</p>
              {app?.submitted_at && (
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Submitted {new Date(app.submitted_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Progress tracker */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-[14px] font-bold text-slate-900 mb-5">Application Progress</h2>
          <div className="space-y-0">
            {[
              { label: 'Application Started', done: true },
              { label: 'Information Submitted', done: ['submitted','under_review','approved','rejected','more_info_required'].includes(status) },
              { label: 'Under Review', done: ['under_review','approved','rejected'].includes(status), active: status === 'under_review' || status === 'submitted' },
              { label: 'Decision Made', done: ['approved','rejected'].includes(status) },
              { label: 'Verified Seller', done: status === 'approved' },
            ].map((st, i, arr) => (
              <div key={st.label} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    st.done ? 'border-indigo-600 bg-indigo-600 text-white'
                      : st.active ? 'border-amber-500 bg-amber-50 text-amber-500'
                      : 'border-slate-200 bg-white text-slate-300'
                  }`}>
                    {st.done ? <Check className="h-4 w-4" /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`w-0.5 h-8 my-0.5 ${st.done ? 'bg-indigo-200' : 'bg-slate-100'}`} />
                  )}
                </div>
                <p className={`pt-1.5 text-[13px] font-semibold ${st.done ? 'text-slate-900' : 'text-slate-400'}`}>
                  {st.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Application ID */}
        {app?.id && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Application ID</p>
                <p className="text-slate-700 font-mono text-[12px]">{app.id.slice(0, 16)}...</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Status</p>
                <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
              </div>
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {status === 'rejected' && (app?.rejection_reason || app?.additional_notes) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-bold text-red-900 mb-1">Reason for Rejection</p>
                {app.rejection_category && <p className="text-[13px] text-red-700 font-semibold">{app.rejection_category}</p>}
                {app.rejection_reason && <p className="text-[13px] text-red-700 mt-1">{app.rejection_reason}</p>}
                {app.additional_notes && <p className="text-[13px] text-red-600 mt-2 italic">{app.additional_notes}</p>}
              </div>
            </div>
            <button
              onClick={() => { setStep(1); }}
              className="mt-4 w-full h-11 rounded-xl bg-red-600 text-[14px] font-bold text-white hover:bg-red-700 transition-colors"
            >
              Update Information & Resubmit
            </button>
          </div>
        )}

        {/* More info required */}
        {status === 'more_info_required' && app?.additional_notes && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-bold text-amber-900 mb-1">Additional Information Required</p>
                <p className="text-[13px] text-amber-700">{app.additional_notes}</p>
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              className="mt-4 w-full h-11 rounded-xl bg-amber-500 text-[14px] font-bold text-white hover:bg-amber-600 transition-colors"
            >
              Update Application
            </button>
          </div>
        )}

        {/* Approved badge */}
        {status === 'approved' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mx-auto mb-3">
              <BadgeCheck className="h-9 w-9 text-emerald-600" />
            </div>
            <p className="text-[18px] font-black text-emerald-900">Verified Seller</p>
            <p className="text-[13px] text-emerald-700 mt-1">
              Your profile and listings display the Verified Seller badge.
            </p>
            {app?.reviewer_name && (
              <p className="text-[11px] text-emerald-600 mt-2">
                Reviewed by {app.reviewer_name} · {app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString('en-NG') : ''}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Benefits landing (not_verified, before starting) ──────────────────────

  if (!isLoading && status === 'not_verified' && step === 0) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Become a Verified Seller</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Build trust with buyers by verifying your identity and seller information.</p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
          <h2 className="text-[15px] font-bold text-slate-900 mb-4">Benefits of Verification</h2>
          <div className="space-y-3">
            {[
              { icon: '✓', text: 'Verified Seller badge on your profile and listings' },
              { icon: '✓', text: 'Increased buyer trust and confidence' },
              { icon: '✓', text: 'Better seller profile visibility on the platform' },
              { icon: '✓', text: 'More credibility with every listing you post' },
              { icon: '✓', text: 'Access to verified-seller features as they become available' },
            ].map(b => (
              <div key={b.text} className="flex items-start gap-3">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white mt-0.5">✓</span>
                <p className="text-[13px] text-slate-700">{b.text}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setStep(1)}
          className="w-full h-13 rounded-xl bg-indigo-600 text-[15px] font-bold text-white hover:bg-indigo-700 transition-colors py-3.5"
        >
          Start Verification Process
        </button>
      </div>
    );
  }

  // ── Multi-step form ───────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">Become a Verified Seller</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Complete all steps to submit your verification application.</p>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-bold text-emerald-900">Application Submitted!</p>
            <p className="text-[13px] text-emerald-700 mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Step progress */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const StepIcon = s.icon;
          const done = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => done && setStep(s.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all ${
                  active ? 'bg-indigo-600 text-white shadow-sm'
                    : done ? 'bg-indigo-50 text-indigo-600 cursor-pointer hover:bg-indigo-100'
                    : 'bg-slate-100 text-slate-400 cursor-default'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.id}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {err && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-[13px] font-medium text-red-600">{err}</p>
        </div>
      )}

      {/* Step 1 — Personal Info */}
      {step === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <User className="h-4 w-4 text-indigo-600" /> Personal Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Full Name *</label>
              <input value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="As it appears on your ID" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => setField('date_of_birth', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input value={form.country} onChange={e => setField('country', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>State</label>
              <input value={form.state} onChange={e => setField('state', e.target.value)} placeholder="e.g. Lagos" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input value={form.city} onChange={e => setField('city', e.target.value)} placeholder="e.g. Victoria Island" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Residential Address</label>
              <input value={form.residential_address} onChange={e => setField('residential_address', e.target.value)} placeholder="Street address" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone Number *</label>
              <input value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+2348012345678" type="tel" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email Address</label>
              <input value={form.email} onChange={e => setField('email', e.target.value)} placeholder="you@example.com" type="email" className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — ID Verification */}
      {step === 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600" /> Identity Verification
          </h2>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-blue-700">Your identity documents are stored securely and will never be shared publicly. Only our verification team can access them.</p>
          </div>
          <div>
            <label className={labelCls}>ID Type *</label>
            <select value={form.id_type} onChange={e => setField('id_type', e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-700 outline-none focus:border-indigo-400 transition-all">
              <option value="">Select ID type…</option>
              {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>ID Number *</label>
            <input value={form.id_number} onChange={e => setField('id_number', e.target.value)} placeholder="Enter your ID number" className={inputCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUpload
              label="Front of ID *"
              value={form.id_front_url}
              onChange={v => setField('id_front_url', v)}
              hint="Clear photo, all corners visible"
            />
            <ImageUpload
              label="Back of ID (if applicable)"
              value={form.id_back_url}
              onChange={v => setField('id_back_url', v)}
              hint="Back side if required"
            />
          </div>
        </div>
      )}

      {/* Step 3 — Seller Info */}
      {step === 3 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <Store className="h-4 w-4 text-indigo-600" /> Seller Information
          </h2>
          <div>
            <label className={labelCls}>Seller Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: 'individual', label: 'Individual', icon: '👤', desc: 'Selling as a person' },
                { val: 'business', label: 'Business', icon: '🏢', desc: 'Registered business' },
              ].map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => setField('seller_type', opt.val)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
                    form.seller_type === opt.val ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'
                  }`}>
                  <span className="text-2xl">{opt.icon}</span>
                  <p className="text-[13px] font-bold text-slate-900">{opt.label}</p>
                  <p className="text-[11px] text-slate-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {form.seller_type === 'individual' ? (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Display Name</label>
                <input value={form.display_name} onChange={e => setField('display_name', e.target.value)} placeholder="How buyers will see you" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>About You / Seller Description</label>
                <textarea value={form.seller_description} onChange={e => setField('seller_description', e.target.value)}
                  placeholder="Tell buyers what you sell and why they should trust you…"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white resize-none transition-all" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Location</label>
                  <input value={form.location} onChange={e => setField('location', e.target.value)} placeholder="e.g. Lagos, Nigeria" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>WhatsApp Number</label>
                  <input value={form.whatsapp_number} onChange={e => setField('whatsapp_number', e.target.value)} placeholder="+2348012345678" type="tel" className={inputCls} />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Business Name</label>
                <input value={form.business_name} onChange={e => setField('business_name', e.target.value)} placeholder="Registered business name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Business Description</label>
                <textarea value={form.business_description} onChange={e => setField('business_description', e.target.value)}
                  placeholder="What your business does, products/services offered…"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white resize-none transition-all" />
              </div>
              <div>
                <label className={labelCls}>Business Address</label>
                <input value={form.business_address} onChange={e => setField('business_address', e.target.value)} placeholder="Registered business address" className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Business Registration Number</label>
                  <input value={form.business_reg_number} onChange={e => setField('business_reg_number', e.target.value)} placeholder="CAC number or equivalent" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Business Category</label>
                  <select value={form.business_category} onChange={e => setField('business_category', e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-700 outline-none focus:border-indigo-400 transition-all">
                    <option value="">Select category…</option>
                    {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Business Phone</label>
                  <input value={form.business_phone} onChange={e => setField('business_phone', e.target.value)} placeholder="+234…" type="tel" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>WhatsApp Number</label>
                  <input value={form.whatsapp_number} onChange={e => setField('whatsapp_number', e.target.value)} placeholder="+234…" type="tel" className={inputCls} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4 — Seller Profile */}
      {step === 4 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-600" /> Seller Profile
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Store Name</label>
              <input value={form.store_name} onChange={e => setField('store_name', e.target.value)} placeholder="Your store name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input value={form.location} onChange={e => setField('location', e.target.value)} placeholder="e.g. Lagos, Nigeria" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Store Description</label>
            <textarea value={form.store_description} onChange={e => setField('store_description', e.target.value)}
              placeholder="Describe your store and what makes you special…"
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:bg-white resize-none transition-all" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUpload label="Profile Photo" value={form.profile_photo_url} onChange={v => setField('profile_photo_url', v)} hint="Square photo recommended" />
            <ImageUpload label="Store Logo" value={form.store_logo_url} onChange={v => setField('store_logo_url', v)} hint="Your business/store logo" />
          </div>

          {/* Preview */}
          {(form.store_name || form.display_name || form.business_name) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">Profile Preview</p>
              <div className="flex items-center gap-3">
                {form.profile_photo_url || form.store_logo_url ? (
                  <img src={form.profile_photo_url || form.store_logo_url} alt="" className="h-12 w-12 rounded-full object-cover border-2 border-white shadow" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-[16px] font-bold text-indigo-700">
                    {(form.store_name || form.display_name || form.business_name).charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[14px] font-bold text-slate-900">{form.store_name || form.display_name || form.business_name}</p>
                    <span className="flex items-center gap-0.5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      <BadgeCheck className="h-2.5 w-2.5" /> VERIFIED
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-500">{form.location || 'Nigeria'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 5 — Declaration */}
      {step === 5 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-600" /> Declaration
          </h2>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-700 leading-relaxed">
            By submitting this verification application, you confirm that:
            <ul className="mt-3 space-y-2 list-none">
              {[
                'All information provided is accurate and truthful.',
                'The identity documents belong to you or your registered business.',
                'You are authorized to represent this business (if applicable).',
                'You agree to Velontri\'s seller verification policies and terms.',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-indigo-600 flex-shrink-0"
            />
            <span className="text-[14px] font-semibold text-slate-900">
              I confirm that the information and documents I have provided are accurate and belong to me or my business.
            </span>
          </label>
          {successMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-[13px] font-semibold text-emerald-700">{successMsg}</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      {!successMsg && (
        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="h-11 rounded-xl border border-slate-200 px-5 text-[14px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
          )}
          {step === 1 && (
            <button
              onClick={() => setStep(0)}
              className="h-11 rounded-xl border border-slate-200 px-5 text-[14px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          )}
          {step < 5 ? (
            <button
              onClick={nextStep}
              disabled={saving}
              className="flex-1 h-11 rounded-xl bg-indigo-600 text-[14px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? 'Saving…' : 'Save & Continue'}
              {!saving && <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !agreed}
              className="flex-1 h-11 rounded-xl bg-indigo-600 text-[14px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? 'Submitting…' : 'Submit Application'}
              {!submitting && <Check className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
