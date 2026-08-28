import { useQuery } from '@tanstack/react-query';
import { listingsApi, listingKeys, type ListingFilters } from '@/lib/api/endpoints/listings';

export function useListings(filters: ListingFilters = {}) {
 return useQuery({
 queryKey: listingKeys.list(filters),
 queryFn: () => listingsApi.browse(filters),
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
