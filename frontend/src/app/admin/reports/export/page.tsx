'use client';

import { useState } from 'react';
import { Download, FileText, BarChart3, DollarSign, Users, Package } from 'lucide-react';

const REPORTS = [
  { id: 'users',        label: 'Users Report',         desc: 'All registered users with roles and activity', icon: Users,     format: ['CSV', 'Excel'] },
  { id: 'listings',     label: 'Listings Report',       desc: 'All listings with status, price and category', icon: Package,   format: ['CSV', 'Excel'] },
  { id: 'revenue',      label: 'Revenue Report',        desc: 'Revenue by stream, date and category',         icon: DollarSign,format: ['CSV', 'Excel', 'PDF'] },
  { id: 'orders',       label: 'Orders Report',         desc: 'Transaction history with amounts and status',  icon: BarChart3, format: ['CSV', 'Excel'] },
  { id: 'kyc',          label: 'KYC Report',            desc: 'Verification status for all users',            icon: FileText,  format: ['CSV', 'Excel'] },
  { id: 'audit',        label: 'Audit Log Export',      desc: 'Complete platform activity audit trail',       icon: FileText,  format: ['CSV', 'Excel'] },
];

export default function ExportReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  function download(id: string, format: string) {
    setDownloading(`${id}-${format}`);
    setTimeout(() => setDownloading(null), 2000);
  }

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Download className="h-6 w-6 text-indigo-600" /> Export Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Download platform data in CSV, Excel or PDF format</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {REPORTS.map(({ id, label, desc, icon: Icon, format }) => (
            <div key={id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                  <Icon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {format.map(f => (
                  <button key={f} onClick={() => download(id, f)}
                    disabled={downloading === `${id}-${f}`}
                    className="flex items-center gap-1.5 h-8 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors disabled:opacity-50">
                    {downloading === `${id}-${f}` ? (
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                      </svg>
                    ) : <Download className="h-3 w-3" />}
                    {f}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    
  );
}
