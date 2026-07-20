'use client';

import Link from 'next/link';
import { Mail, ChevronRight } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export default function EmailCampaignsPage() {
  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Mail className="h-6 w-6 text-indigo-600" /> Email Campaigns
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage email templates and broadcast campaigns</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/admin/emails"
            className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-indigo-200 transition-all no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Mail className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Email Templates</p>
                <p className="text-xs text-slate-500">Welcome, order confirmation, reset</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </Link>
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-5">
            <p className="text-sm font-bold text-slate-900 mb-1">Broadcast Campaign</p>
            <p className="text-xs text-slate-500">Send email to all users — coming soon</p>
          </div>
        </div>
      </div>
    
  );
}
