'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car, Search } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import { ListingsPage } from '@/app/admin/products/page';

export default function AdminVehiclesPage() {
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'vehicles', committed],
    queryFn: () => apiClient.get<ApiResponse<any[]>>('/listings/admin/list', { params: { type: 'vehicle', search: committed || undefined, page_size: 30 } }).then(r => r.data),
  });

  return <ListingsPage title="Vehicles" icon={<Car className="h-6 w-6 text-indigo-600" />} listings={data?.data ?? []} isLoading={isLoading} search={search} setSearch={setSearch} onSearch={() => setCommitted(search)} />;
}
