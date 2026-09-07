'use client';

import { ArrowLeft } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { UserSearch } from '@/components/social/user-search';

/**
 * User search page - Allows users to find and follow other users/sellers.
 */
export default function UserSearchPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center
              justify-center text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" weight="bold" />
          </button>
          
          <div>
            <h1 className="text-[1.4rem] font-black text-slate-900 tracking-tight">
              Find Users
            </h1>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Search for users and sellers to follow
            </p>
          </div>
        </div>

        {/* Search component */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <UserSearch autoFocus />
        </div>
      </div>
    </div>
  );
}
