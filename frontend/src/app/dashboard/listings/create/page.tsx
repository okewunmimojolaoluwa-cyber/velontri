'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sellerApi, sellerKeys, type CreateListingRequest } from '@/lib/api/endpoints/seller';
import { listingKeys } from '@/lib/api/endpoints/listings';
import { ROUTES } from '@/config/routes';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, ChevronRight, ImageIcon, Upload, X, Lock, Zap, ArrowRight } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import Link from 'next/link';

/* ── Plan limits (mirrors subscription page) ────────────── */
const PLAN_LIMITS: Record<string, number> = {
  free:       3,
  starter:    20,
  business:   100,
  enterprise: Infinity,
};

function getPlanFromCount(count: number): string {
  if (count <= 3)   return 'free';
  if (count <= 20)  return 'starter';
  if (count <= 100) return 'business';
  return 'enterprise';
}

function getPlanLimit(planId: string): number {
  return PLAN_LIMITS[planId] ?? 3;
}

/* ── Limit gate ────────────────────────────────────────── */
function ListingLimitGate({
  current, limit, planId,
}: { current: number; limit: number; planId: string }) {
  const nextPlan = planId === 'free' ? 'Starter' : planId === 'starter' ? 'Business' : 'Enterprise';
  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 mx-auto mb-5">
          <Lock className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-[20px] font-black text-slate-900 mb-2">Listing Limit Reached</h2>
        <p className="text-[14px] text-slate-600 mb-1">
          You&apos;ve used <span className="font-bold text-amber-700">{current} / {limit === Infinity ? '∞' : limit}</span> listings on your current plan.
        </p>
        <p className="text-[14px] text-slate-600 mb-6">
          Upgrade to the <strong>{nextPlan} plan</strong> to publish more listings.
        </p>

        <div className="space-y-3">
          <Link
            href={`${ROUTES.user.subscription}?from=create`}
            className="flex w-full items-center justify-center gap-2 h-12 rounded-xl
              bg-indigo-600 text-[14px] font-bold text-white no-underline
              hover:bg-indigo-700 transition-colors"
          >
            <Zap className="h-4 w-4" />
            Upgrade Plan
          </Link>
          <Link
            href={ROUTES.user.listings}
            className="flex w-full items-center justify-center gap-2 h-11 rounded-xl
              border border-slate-200 bg-white text-[14px] font-semibold text-slate-600
              no-underline hover:bg-slate-50 transition-colors"
          >
            View My Listings
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-left">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Plan comparison</p>
          <div className="space-y-2">
            {[
              { name: 'Free',       limit: 3,        current: planId === 'free' },
              { name: 'Starter',    limit: 20,       current: planId === 'starter' },
              { name: 'Business',   limit: 100,      current: planId === 'business' },
              { name: 'Enterprise', limit: Infinity, current: planId === 'enterprise' },
            ].map(p => (
              <div key={p.name} className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px]
                ${p.current ? 'bg-amber-50 font-bold text-amber-800' : 'text-slate-600'}`}>
                <span>{p.name} {p.current && '← current'}</span>
                <span className="font-semibold">{p.limit === Infinity ? 'Unlimited' : `${p.limit} listings`}</span>
              </div>
            ))}
          </div>
          <Link href={ROUTES.user.subscription}
            className="mt-3 flex items-center gap-1 text-[12px] font-semibold text-indigo-600
              no-underline hover:text-indigo-700">
            See full plan details <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const CATEGORIES = [
  'Vehicles', 'Property', 'Electronics', 'Fashion', 'Furniture',
  'Services', 'Jobs', 'Agriculture', 'Health & Beauty', 'Sports', 'Books', 'Other',
];

const LISTING_TYPES = [
  { value: 'physical',  label: 'Product',  icon: '📦', desc: 'Physical or digital item' },
  { value: 'service',   label: 'Service',  icon: '🔧', desc: 'Offer a skill or service' },
  { value: 'job',       label: 'Job',      icon: '💼', desc: 'Hiring or job posting' },
  { value: 'property',  label: 'Property', icon: '🏠', desc: 'Real estate for sale/rent' },
  { value: 'vehicle',   label: 'Vehicle',  icon: '🚗', desc: 'Cars, bikes, trucks' },
];

const NG_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara',
  'Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo',
  'Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara',
];

const STEPS = ['Type', 'Details', 'Location', 'Photos', 'Review'];

export default function CreateListingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session.userId;
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Quota check: how many active listings does this user have? ────────
  const { data: listingsData, isLoading: quotaLoading } = useQuery({
    queryKey: [uid, 'seller', 'listings', { page: 1, page_size: 1 }],
    queryFn: () => sellerApi.getMyListings({ page: 1, page_size: 1, status: 'active' }),
    enabled: !!session.isAuthenticated,
    staleTime: 30_000,
  });

  // Get plan from localStorage (set by subscription page after "upgrading")
  const storedPlan = typeof window !== 'undefined'
    ? (localStorage.getItem('velontri_plan') ?? 'free')
    : 'free';

  const activeCount   = listingsData?.meta?.total ?? 0;
  const planLimit     = getPlanLimit(storedPlan);
  const atLimit       = activeCount >= planLimit;
  const effectivePlan = storedPlan;
  const [form, setForm] = useState({
    listing_type: '',
    title: '',
    description: '',
    price: '',
    currency: 'NGN',
    category: '',
    condition: 'new' as 'new' | 'used' | 'refurbished',
    state: '',
    city: '',
    whatsapp_number: '',
    contact_phone: '',
    images: [] as string[],
  });

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      // 1. Create the listing
      const res = await sellerApi.createListing({
        title: form.title,
        description: form.description,
        price: parseFloat(form.price) || 0,
        currency: form.currency,
        category: form.category,
        listing_type: form.listing_type as CreateListingRequest['listing_type'],
        city: form.city || undefined,
        state: form.state || undefined,
        country: 'NG',
        condition: form.condition,
        image_url: form.images[0] || undefined,
        whatsapp_number: form.whatsapp_number || undefined,
        contact_phone: form.contact_phone || undefined,
      });
      // 2. Publish immediately so it goes live
      const listingId = (res.data as any)?.id;
      if (listingId) {
        await sellerApi.publishListing(listingId);
      }
      return res;
    },
    onSuccess: () => {
      // Invalidate user-scoped caches so every page auto-refreshes
      qc.invalidateQueries({ queryKey: [uid, 'seller'] });
      qc.invalidateQueries({ queryKey: listingKeys.all });
      router.push(ROUTES.user.listings);
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.error?.message || err?.message;
      setError(detail ?? 'Failed to create listing. Please try again.');
    },
  });

  function next() {
    setError('');
    if (step === 0 && !form.listing_type) { setError('Please select a type.'); return; }
    if (step === 1) {
      if (!form.title.trim())       { setError('Title is required.'); return; }
      if (!form.description.trim()) { setError('Description is required.'); return; }
      if (!form.price || isNaN(parseFloat(form.price))) { setError('Enter a valid price.'); return; }
      if (!form.category)           { setError('Select a category.'); return; }
    }
    if (step === 2) {
      if (!form.state) { setError('Select your state.'); return; }
      if (!form.whatsapp_number.trim()) { setError('WhatsApp number is required.'); return; }
      // Basic E.164 validation: starts with + and has 7–15 digits
      if (!/^\+[1-9]\d{6,14}$/.test(form.whatsapp_number.trim())) {
        setError('Enter a valid WhatsApp number in international format (e.g. +2348012345678).');
        return;
      }
    }
    if (step < STEPS.length - 1) { setStep(s => s + 1); } else { submit(); }
  }

  /* ── File handling ─────────────────────────────────── */
  const readFilesAsDataURLs = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const remaining = 6 - form.images.length;
    if (remaining <= 0) return;
    const toRead = fileArr.slice(0, remaining);
    toRead.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setForm((f) => {
            if (f.images.length >= 6) return f;
            return { ...f, images: [...f.images, dataUrl] };
          });
        }
      };
      reader.readAsDataURL(file);
    });
  }, [form.images.length]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      readFilesAsDataURLs(e.target.files);
      // reset so same file can be re-selected
      e.target.value = '';
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      readFilesAsDataURLs(e.dataTransfer.files);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Post a Listing</h1>
        <p className="text-sm text-slate-500 mt-0.5">Reach millions of buyers across Africa</p>
      </div>

      {/* ── Quota loading ── */}
      {quotaLoading && (
        <div className="flex items-center justify-center py-12">
          <svg className="h-8 w-8 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
              strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* ── Limit gate — shown when at/over quota ── */}
      {!quotaLoading && atLimit && (
        <ListingLimitGate
          current={activeCount}
          limit={planLimit}
          planId={effectivePlan}
        />
      )}

      {/* ── Create wizard — only shown when under quota ── */}
      {!quotaLoading && !atLimit && (
        <>
          {/* Usage bar */}
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-semibold text-slate-600 capitalize">
                {effectivePlan} Plan
              </p>
              <p className="text-[12px] text-slate-500">
                <span className="font-bold text-slate-800">{activeCount}</span>
                {' / '}
                {planLimit === Infinity ? '∞' : planLimit} listings used
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: planLimit === Infinity ? '5%' : `${Math.min(100, (activeCount / planLimit) * 100)}%` }}
              />
            </div>
          </div>

      {/* Step progress */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1 flex-1">
            <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full
              text-xs font-bold transition-colors ${
                i < step
                  ? 'bg-indigo-600 text-white'
                  : i === step
                  ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400 ring-offset-1'
                  : 'bg-slate-100 text-slate-400'
              }`}>
              {i < step ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 rounded-full ${i < step ? 'bg-indigo-600' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs font-semibold text-slate-500 -mt-2">{STEPS[step]}</p>

      {/* Step content card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-600">{error}</p>
          </div>
        )}

        {/* STEP 0 — Type */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-700 mb-4">What are you listing?</p>
            {LISTING_TYPES.map(({ value, label, icon, desc }) => (
              <button
                key={value}
                onClick={() => setForm(f => ({ ...f, listing_type: value }))}
                className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left
                  transition-all ${
                    form.listing_type === value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                  }`}
              >
                <span className="text-3xl">{icon}</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                {form.listing_type === value && (
                  <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 flex-shrink-0">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* STEP 1 — Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. 2022 Toyota Camry — Lagos, excellent condition"
                maxLength={100}
              />
              <p className="text-xs text-slate-400 mt-1">{form.title.length}/100</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe condition, features, reason for selling…"
                rows={5}
                maxLength={2000}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm
                  text-slate-800 placeholder-slate-400 focus:border-indigo-400
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">{form.description.length}/2000</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">₦</span>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0"
                    className="pl-8"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Condition</label>
                <select
                  value={form.condition}
                  onChange={e => setForm(f => ({ ...f, condition: e.target.value as typeof form.condition }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm
                    text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  <option value="new">Brand New</option>
                  <option value="used">Used</option>
                  <option value="refurbished">Refurbished</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setForm(f => ({ ...f, category: cat }))}
                    className={`rounded-xl border py-2 px-3 text-xs font-medium transition-all ${
                      form.category === cat
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:border-indigo-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — Location */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                State <span className="text-red-500">*</span>
              </label>
              <select
                value={form.state}
                onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm
                  text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Select state</option>
                {NG_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">City</label>
              <Input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="e.g. Victoria Island"
              />
            </div>

            {/* WhatsApp — required */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                WhatsApp Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg select-none">📱</span>
                <Input
                  value={form.whatsapp_number}
                  onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))}
                  placeholder="+2348012345678"
                  type="tel"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Buyers will contact you directly on WhatsApp. Use international format, e.g. +2348012345678
              </p>
            </div>

            {/* Optional phone */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Phone Number <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <Input
                value={form.contact_phone}
                onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                placeholder="+2348012345678"
                type="tel"
              />
            </div>

            {/* Safety reminder */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Buyer safety tips displayed on your listing:</p>
              <ul className="text-xs text-amber-600 space-y-0.5 list-disc list-inside">
                <li>Meet in a public place</li>
                <li>Inspect before payment</li>
                <li>Never send money before seeing the item</li>
              </ul>
            </div>
          </div>
        )}

        {/* STEP 3 — Photos */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-slate-700">Add photos (up to 6)</p>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFileInputChange}
            />

            {/* Drop zone + grid */}
            <div
              className={`grid grid-cols-3 gap-3 rounded-xl border-2 border-dashed p-3 transition-colors ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 bg-slate-50/40'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              {form.images.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 rounded-full bg-indigo-600 px-2 py-0.5
                      text-[9px] font-bold text-white uppercase tracking-wide">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white
                      flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {form.images.length < 6 && (
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex
                    flex-col items-center justify-center gap-1 text-slate-400
                    hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-500
                    transition-colors cursor-pointer"
                >
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-xs font-medium">Add photo</span>
                </button>
              )}
            </div>

            {/* Upload button */}
            <button
              type="button"
              onClick={openFilePicker}
              disabled={form.images.length >= 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200
                bg-indigo-50 py-3 text-[13px] font-semibold text-indigo-600
                hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4" />
              {form.images.length === 0
                ? 'Choose photos from your device'
                : form.images.length >= 6
                ? 'Maximum 6 photos reached'
                : `Add more photos (${form.images.length}/6)`}
            </button>

            <p className="text-xs text-slate-400 text-center">
              Drag &amp; drop photos here, or tap the button above · JPG, PNG, WEBP, HEIC · Max 10 MB each
            </p>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center space-y-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">📐 Image Requirements</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[11px] text-slate-400 mt-1">
                <span>Recommended: <strong className="text-slate-600">800 × 600 px</strong></span>
                <span>Minimum: <strong className="text-slate-600">400 × 300 px</strong></span>
                <span>Aspect ratio: <strong className="text-slate-600">4:3 (or 1:1)</strong></span>
                <span>Formats: <strong className="text-slate-600">JPG, PNG, WEBP</strong></span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Images are automatically cropped to fill the card — portrait images crop at the top/bottom.
              </p>
            </div>
            <p className="text-xs font-medium text-indigo-600 text-center">
              📸 Listings with photos get 3× more views
            </p>
          </div>
        )}

        {/* STEP 4 — Review */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-slate-700">Review your listing before posting</p>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {form.images[0] && (
                <img src={form.images[0]} alt="" className="w-full h-48 object-cover" />
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-bold text-slate-900">{form.title}</p>
                  <span className="text-lg font-black text-indigo-600 whitespace-nowrap">
                    ₦{parseFloat(form.price || '0').toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-slate-100 rounded-full px-2.5 py-1 text-slate-600 capitalize">
                    {LISTING_TYPES.find(t => t.value === form.listing_type)?.label ?? form.listing_type}
                  </span>
                  <span className="text-xs bg-slate-100 rounded-full px-2.5 py-1 text-slate-600">
                    {form.category}
                  </span>
                  <span className="text-xs bg-slate-100 rounded-full px-2.5 py-1 text-slate-600 capitalize">
                    {form.condition}
                  </span>
                  {form.state && (
                    <span className="text-xs bg-slate-100 rounded-full px-2.5 py-1 text-slate-600 flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" />
                      {form.city ? `${form.city}, ` : ''}{form.state}
                    </span>
                  )}
                  {form.whatsapp_number && (
                    <span className="text-xs bg-green-100 rounded-full px-2.5 py-1 text-green-700 flex items-center gap-1">
                      📱 {form.whatsapp_number}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 line-clamp-3">{form.description}</p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700">
                Your listing will be reviewed and go live within minutes.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => (step > 0 ? setStep(s => s - 1) : router.back())}
          disabled={isPending}
        >
          {step === 0 ? 'Cancel' : '← Back'}
        </Button>
        <Button onClick={next} disabled={isPending}>
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
              </svg>
              Submitting…
            </span>
          ) : step === STEPS.length - 1 ? (
            'Post Listing →'
          ) : (
            <span className="flex items-center gap-1.5">
              Continue <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
        </>
      )}
    </div>
  );
}
