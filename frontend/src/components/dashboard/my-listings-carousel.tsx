'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Eye, Edit, Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';

interface Listing {
  id: string;
  title: string;
  price: string;
  image: string;
  status: 'active' | 'pending' | 'sold';
  views: number;
}

interface MyListingsCarouselProps {
  listings?: Listing[];
}

const DEFAULT_LISTINGS: Listing[] = [
  {
    id: '1',
    title: 'iPhone 15 Pro Max',
    price: '₦850,000',
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=200&h=200&fit=crop',
    status: 'active',
    views: 245,
  },
  {
    id: '2',
    title: 'MacBook Pro M3',
    price: '₦1,200,000',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200&h=200&fit=crop',
    status: 'active',
    views: 189,
  },
  {
    id: '3',
    title: 'Sony WH-1000XM5',
    price: '₦125,000',
    image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=200&h=200&fit=crop',
    status: 'pending',
    views: 67,
  },
];

export function MyListingsCarousel({ listings = DEFAULT_LISTINGS }: MyListingsCarouselProps) {
  if (listings.length === 0) {
    return null;
  }

  const getStatusColor = (status: Listing['status']) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700';
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'sold':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          My Listings
        </p>
        <Link
          href={ROUTES.user.listings}
          className="text-xs font-semibold text-indigo-600 no-underline hover:text-indigo-700"
        >
          See all
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
      >
        {listings.map((listing, index) => (
          <motion.div
            key={listing.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
            className="flex-shrink-0 w-40"
          >
            <Link
              href={`${ROUTES.user.listings}/${listing.id}`}
              className="no-underline group block"
            >
              <div className="relative overflow-hidden rounded-2xl bg-slate-100 aspect-square mb-2">
                <img
                  src={listing.image}
                  alt={listing.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute top-2 right-2">
                  <span
                    className={cn(
                      'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                      getStatusColor(listing.status)
                    )}
                  >
                    {listing.status}
                  </span>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-900 truncate mb-1">
                {listing.title}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-indigo-600">
                  {listing.price}
                </p>
                <div className="flex items-center gap-1 text-slate-400">
                  <Eye className="h-3 w-3" />
                  <span className="text-[10px]">{listing.views}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
                  <Edit className="h-3 w-3" />
                  Edit
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-indigo-50 px-2 py-1.5 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">
                  <Zap className="h-3 w-3" />
                  Promote
                </button>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
