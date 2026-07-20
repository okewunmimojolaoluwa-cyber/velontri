'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import { ListingsPage } from '@/app/admin/products/page';

export default function AdminJobsPage() {
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'jobs', committed],
    queryFn: () => apiClient.get<ApiResponse<any[]>>('/listings/admin/list', { params: { type: 'job', search: committed || undefined, page_size: 30 } }).then(r => r.data),
  });

  return <ListingsPage title="Jobs" icon={<Briefcase className="h-6 w-6 text-violet-600" />} listings={data?.data ?? []} isLoading={isLoading} search={search} setSearch={setSearch} onSearch={() => setCommitted(search)} />;
}
