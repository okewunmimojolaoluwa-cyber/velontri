'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus, Trash2, Search } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

const DEFAULT_SUBCATEGORIES: Record<string, string[]> = {
  Vehicles:   ['Cars', 'Motorcycles', 'Trucks', 'Buses', 'Boats', 'Tractors', 'Parts & Accessories'],
  Property:   ['Houses', 'Apartments', 'Land', 'Commercial', 'Shortlet', 'Office Space'],
  Electronics:['Phones', 'Laptops', 'Tablets', 'TVs', 'Cameras', 'Audio', 'Gaming', 'Accessories'],
  Fashion:    ['Men\'s Clothing', 'Women\'s Clothing', 'Kids Clothing', 'Shoes', 'Bags', 'Jewellery', 'Watches'],
  Furniture:  ['Living Room', 'Bedroom', 'Office', 'Kitchen', 'Outdoor'],
  Services:   ['Cleaning', 'Repairs', 'Tutoring', 'Photography', 'Legal', 'Health & Wellness'],
  Jobs:       ['Full-time', 'Part-time', 'Contract', 'Remote', 'Internship', 'Freelance'],
  Agriculture:['Crops', 'Livestock', 'Farm Equipment', 'Seeds & Fertilizers', 'Fish Farming'],
};

const CATEGORIES = Object.keys(DEFAULT_SUBCATEGORIES);

export default function AdminSubcategoriesPage() {
  const [selectedCat, setSelectedCat] = useState(CATEGORIES[0]);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');

  const subcategories = DEFAULT_SUBCATEGORIES[selectedCat] ?? [];
  const filtered = search
    ? subcategories.filter(s => s.toLowerCase().includes(search.toLowerCase()))
    : subcategories;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-black text-slate-900 tracking-tight">Subcategories</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Manage subcategories for each listing category</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">

        {/* Category sidebar */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Categories</p>
          </div>
          <ul className="py-2">
            {CATEGORIES.map(cat => (
              <li key={cat}>
                <button onClick={() => { setSelectedCat(cat); setSearch(''); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors ${
                    selectedCat === cat
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}>
                  <span>{cat}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    selectedCat === cat ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {DEFAULT_SUBCATEGORIES[cat]?.length ?? 0}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Subcategory list */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${selectedCat} subcategories…`}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[14px]
                  text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 transition-all" />
            </div>
            <div className="flex items-center gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="New subcategory"
                className="h-10 w-44 rounded-xl border border-slate-200 px-4 text-[14px]
                  text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 transition-all"
                onKeyDown={e => {
                  if (e.key === 'Enter' && newName.trim()) {
                    DEFAULT_SUBCATEGORIES[selectedCat] = [
                      ...(DEFAULT_SUBCATEGORIES[selectedCat] ?? []),
                      newName.trim(),
                    ];
                    setNewName('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (!newName.trim()) return;
                  DEFAULT_SUBCATEGORIES[selectedCat] = [
                    ...(DEFAULT_SUBCATEGORIES[selectedCat] ?? []),
                    newName.trim(),
                  ];
                  setNewName('');
                }}
                className="h-10 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-[13px]
                  font-bold text-white hover:bg-indigo-700 transition-colors">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                {selectedCat} — {filtered.length} subcategor{filtered.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Tag className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-[14px] font-semibold text-slate-900">
                  {search ? `No results for "${search}"` : 'No subcategories'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtered.map(sub => (
                  <li key={sub} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                        <Tag className="h-3.5 w-3.5 text-indigo-500" />
                      </div>
                      <span className="text-[14px] font-medium text-slate-800">{sub}</span>
                    </div>
                    <button
                      onClick={() => {
                        DEFAULT_SUBCATEGORIES[selectedCat] =
                          (DEFAULT_SUBCATEGORIES[selectedCat] ?? []).filter(s => s !== sub);
                        setSearch(s => s); // trigger re-render
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400
                        hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
