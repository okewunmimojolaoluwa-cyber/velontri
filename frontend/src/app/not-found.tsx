import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import { VelontriLogo } from '@/components/ui/velontri-logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] px-5 text-center">
      {/* Velontri logo */}
      <Link href="/" className="mb-12 flex items-center gap-2.5 no-underline">
        <VelontriLogo size={36} showWordmark wordmarkSize="md"
          wordmarkClassName="text-slate-900" />
      </Link>

      {/* 404 number */}
      <p className="font-black text-slate-100"
        style={{ fontSize: 'clamp(6rem, 15vw, 10rem)', letterSpacing: '-0.05em', lineHeight: 1, userSelect: 'none' }}>
        404
      </p>

      <h1 className="mt-4 font-black text-slate-900"
        style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', letterSpacing: '-0.025em' }}>
        Page not found
      </h1>

      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={ROUTES.home}
          className="inline-flex h-11 items-center rounded-xl bg-indigo-600 px-6 text-[14px]
            font-bold text-white no-underline shadow-sm transition-colors hover:bg-indigo-700">
          Back to home
        </Link>
        <Link href={ROUTES.listings}
          className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-6 text-[14px]
            font-semibold text-slate-700 no-underline transition-colors hover:bg-slate-100">
          Browse listings
        </Link>
      </div>

      {/* Decorative */}
      <div className="mt-16 flex items-center gap-2 text-[12px] text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        All systems operational
      </div>
    </div>
  );
}
