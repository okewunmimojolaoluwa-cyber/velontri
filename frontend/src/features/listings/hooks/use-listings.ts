import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { listingsApi, listingKeys, type ListingFilters } from '@/lib/api/endpoints/listings';

export function useListings(filters: ListingFilters = {}) {
 return useQuery({
 queryKey: listingKeys.list(filters),
 queryFn: () => listingsApi.browse(filters),
 staleTime: 60_000, // Cache for 1 minute
 gcTime: 5 * 60_000, // Keep in cache for 5 minutes
 });
}

export function useInfiniteListings(filters: ListingFilters = {}) {
 return useInfiniteQuery({
 queryKey: ['listings', 'infinite', filters],
 queryFn: ({ pageParam = 1 }) => 
 listingsApi.browse({ ...filters, page: pageParam, page_size: 50 }),
 getNextPageParam: (lastPage) => {
 const meta = lastPage?.meta;
 return meta?.has_next ? (meta.page || 1) + 1 : undefined;
 },
 initialPageParam: 1,
 staleTime: 60_000, // Cache for 1 minute
 gcTime: 5 * 60_000, // Keep in cache for 5 minutes
 });
}

export function useListing(id: string) {
 return useQuery({
 queryKey: listingKeys.detail(id),
 queryFn: () => listingsApi.getById(id),
 enabled: Boolean(id),
 staleTime: 0, // always re-fetch so media_urls is current
 gcTime: 30_000,
 });
}
