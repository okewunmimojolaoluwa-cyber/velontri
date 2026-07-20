'use client';

import Link from 'next/link';
import { Heart, Star, BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const PRODUCTS = [
  {
    id: '1',
    title: 'iPhone 15 Pro Max 256GB Natural Titanium',
    price: 1250000,
    currency: 'NGN',
    rating: 4.9,
    reviews: 247,
    seller: 'TechHub Lagos',
    verified: true,
    badge: 'Hot',
    img: 'https://images.unsplash.com/photo-1696446702183-5ac24ca5a7ae?w=600&q=80&fit=crop',
    category: 'Electronics',
  },
  {
    id: '2',
    title: 'Toyota Camry 2023 XSE V6 Low Mileage',
    price: 18500000,
    currency: 'NGN',
    rating: 4.8,
    reviews: 63,
    seller: 'AutoMart NG',
    verified: true,
    badge: 'Featured',
    img: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=600&q=80&fit=crop',
    category: 'Vehicles',
  },
  {
    id: '3',
    title: '3-Bedroom Fully Furnished Lekki Phase 1',
    price: 85000000,
    currency: 'NGN',
    rating: 5.0,
    reviews: 12,
    seller: 'Prime Estates',
    verified: true,
    badge: 'Premium',
    img: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80&fit=crop',
    category: 'Property',
  },
  {
    id: '4',
    title: 'MacBook Pro M3 Max 16" Space Black',
    price: 2100000,
    currency: 'NGN',
    rating: 4.7,
    reviews: 89,
    seller: 'iStore Africa',
    verified: true,
    badge: 'Best Seller',
    img: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80&fit=crop',
    category: 'Electronics',
  },
];

const BADGE_MAP: Record<string, 'primary' | 'gold' | 'success' | 'violet'> = {
  'Hot': 'primary',
  'Featured': 'gold',
  'Premium': 'violet',
  'Best Seller': 'success',
};

function fmt(n: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency,
      maximumFractionDigits: 0,
      notation: n >= 1_000_000 ? 'compact' : 'standard',
    }).format(n);
  } catch { return `${currency} ${n.toLocaleString()}`; }
}

export function TrendingSection() {
  return (
    <section className="py-20 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Trending now</p>
            <h2 className="text-3xl font-bold tracking-tight">Most popular today</h2>
          </div>
          <Link href="/listings" className="text-sm text-primary font-semibold hover:underline">
            See all →
          </Link>
        </div>

        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((p) => (
            <Link
              key={p.id}
              href={`/listings/${p.id}`}
              className="group card-premium overflow-hidden"
            >
              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={p.img}
                  alt={p.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Badge */}
                <div className="absolute top-3 left-3">
                  <Badge variant={BADGE_MAP[p.badge] ?? 'default'}>{p.badge}</Badge>
                </div>

                {/* Save button */}
                <button
                  className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-sm"
                  onClick={(e) => e.preventDefault()}
                >
                  <Heart className="h-4 w-4 text-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-2.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{p.category}</p>
                <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {p.title}
                </h3>

                {/* Rating */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i < Math.floor(p.rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold">{p.rating}</span>
                  <span className="text-xs text-muted-foreground">({p.reviews})</span>
                </div>

                {/* Price + seller */}
                <div className="flex items-end justify-between pt-1">
                  <span className="text-lg font-black text-primary">{fmt(p.price, p.currency)}</span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />}
                    <span className="truncate max-w-[80px]">{p.seller}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
