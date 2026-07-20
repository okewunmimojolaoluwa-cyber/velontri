'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { listingsApi, listingKeys } from '@/lib/api/endpoints/listings';
import { ListingCard, ListingCardSkeleton } from './listing-card';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

export function FeaturedListings() {
  const { data, isLoading } = useQuery({
    queryKey: listingKeys.list({ page: 1, page_size: 8 }),
    queryFn: () => listingsApi.browse({ page: 1, page_size: 8 }),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: 2 * 60_000,
  });

  const listings = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {isLoading
        ? Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)
        : listings.length === 0
        ? (
          <div className="col-span-full rounded-2xl border-2 border-dashed border-border/60 py-16 text-center">
            <p className="text-muted-foreground">No listings yet.</p>
            <Button variant="ghost-primary" size="sm" className="mt-3" asChild>
              <Link href={ROUTES.register}>Be the first to sell</Link>
            </Button>
          </div>
        )
        : listings.map((l) => <ListingCard key={l.id} listing={l} />)
      }
    </div>
  );
}
