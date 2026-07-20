'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Edit2, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export default function CmsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CmsPage | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'cms-pages'],
    queryFn: () => apiClient.get<ApiResponse<CmsPage[]>>('/admin/cms').then(r => r.data),
  });

  const { mutate: deletePage } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/cms/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'cms-pages'] }),
  });

  const pages = data?.data ?? [];

  const DEFAULT_PAGES = [
    { slug: 'about',       title: 'About Us',       last_updated: 'Today' },
    { slug: 'terms',       title: 'Terms of Service', last_updated: 'Today' },
    { slug: 'privacy',     title: 'Privacy Policy',  last_updated: 'Today' },
    { slug: 'help',        title: 'Help Center',     last_updated: 'Today' },
    { slug: 'seller-guide', title: 'Seller Guide',   last_updated: 'Today' },
  ];

  return (
    
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-indigo-600" /> CMS Pages
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage static content pages</p>
          </div>
          <button className="flex items-center gap-2 h-10 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 transition-colors">
            <Plus className="h-4 w-4" /> New Page
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Title', 'Slug', 'Last Updated', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(isLoading ? [] : pages.length > 0 ? pages : DEFAULT_PAGES).map((p: any) => (
                <tr key={p.slug} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900">{p.title}</td>
                  <td className="px-5 py-3">
                    <code className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">/{p.slug}</code>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{p.last_updated || 'N/A'}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1 transition-colors">
                        <Edit2 className="h-3 w-3" /> Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    
  );
}

interface CmsPage { id: string; slug: string; title: string; content: string; last_updated: string; }
