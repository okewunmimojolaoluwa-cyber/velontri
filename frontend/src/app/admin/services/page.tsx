'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import { ListingsPage } from '@/app/admin/products/page';

export default function AdminServicesPage() {
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'services', committed],
    queryFn: () => apiClient.get<ApiResponse<any[]>>('/listings/admin/list', { params: { type: 'service', search: committed || undefined, page_size: 30 } }).then(r => r.data),
  });

  return <ListingsPage title="Services" icon={<Briefcase className="h-6 w-6 text-indigo-600" />} listings={data?.data ?? []} isLoading={isLoading} search={search} setSearch={setSearch} onSearch={() => setCommitted(search)} />;
}
