'use client';

import Link from 'next/link';
import { UserCog } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export default function CreateModeratorPage() {
  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UserCog className="h-6 w-6 text-indigo-600" /> Create Moderator
          </h1>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm max-w-md">
          <UserCog className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-900 mb-2">Create a new moderator account</p>
          <p className="text-xs text-slate-500 mb-4">Use the Moderators page to create and manage moderator accounts.</p>
          <Link href={ROUTES.admin.moderators}
            className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white no-underline hover:bg-indigo-700 transition-colors">
            Go to Moderators
          </Link>
        </div>
      </div>
    
  );
}
