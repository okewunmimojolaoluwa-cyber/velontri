'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Heart, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';

interface RecommendedItem {
  id: string;
  title: string;
  price: string;
  image: string;
  location: string;
  condition: string;
}

interface RecommendedSectionProps {
  items?: RecommendedItem[];
}

const DEFAULT_ITEMS: RecommendedItem[] = [
  {
    id: '1',
    title: 'iPhone 14 Pro 256GB',
    price: '₦650,000',
    image: 'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=200&h=200&fit=crop',
    location: 'Lagos',
    condition: 'Like New',
  },
  {
    id: '2',
    title: 'PlayStation 5 Digital',
    price: '₦420,000',
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=200&h=200&fit=crop',
    location: 'Abuja',
    condition: 'New',
  },
  {
    id: '3',
    title: 'Canon EOS R6 Camera',
    price: '₦1,850,000',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&h=200&fit=crop',
    location: 'Port Harcourt',
    condition: 'Used',
  },
  {
    id: '4',
    title: 'Apple Watch Series 9',
    price: '₦280,000',
    image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=200&h=200&fit=crop',
    location: 'Ibadan',
    condition: 'Brand New',
  },
];

export function RecommendedSection({ items = DEFAULT_ITEMS }: RecommendedSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Recommended for You
        </p>
        <Link
          href={ROUTES.listings}
          className="text-xs font-semibold text-indigo-600 no-underline hover:text-indigo-700"
        >
          See all
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.6 }}
        className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
      >
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.6 + index * 0.05 }}
            className="flex-shrink-0 w-36"
          >
            <Link
              href={`${ROUTES.listings}/${item.id}`}
              className="no-underline group block"
            >
              <div className="relative overflow-hidden rounded-2xl bg-slate-100 aspect-square mb-2">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Heart className="h-4 w-4" strokeWidth={2} />
                </motion.button>
                <div className="absolute bottom-2 left-2">
                  <span className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white">
                    {item.condition}
                  </span>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-900 truncate mb-1">
                {item.title}
              </p>
              <p className="text-sm font-black text-indigo-600 mb-1">
                {item.price}
              </p>
              <div className="flex items-center gap-1 text-slate-400">
                <MapPin className="h-3 w-3" />
                <span className="text-[10px]">{item.location}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
