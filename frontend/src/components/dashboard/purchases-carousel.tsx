'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { MapPin, Truck, Package } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes';

interface Purchase {
  id: string;
  title: string;
  seller: string;
  price: string;
  image: string;
  status: 'processing' | 'shipped' | 'delivered';
  deliveryDate?: string;
}

interface PurchasesCarouselProps {
  purchases?: Purchase[];
}

const DEFAULT_PURCHASES: Purchase[] = [
  {
    id: '1',
    title: 'Samsung Galaxy S24 Ultra',
    seller: 'TechHub Nigeria',
    price: '₦950,000',
    image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=200&h=200&fit=crop',
    status: 'shipped',
    deliveryDate: 'Tomorrow',
  },
  {
    id: '2',
    title: 'Nike Air Max 270',
    seller: 'SneakerHead',
    price: '₦85,000',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop',
    status: 'processing',
    deliveryDate: 'In 3 days',
  },
];

export function PurchasesCarousel({ purchases = DEFAULT_PURCHASES }: PurchasesCarouselProps) {
  if (purchases.length === 0) {
    return null;
  }

  const getStatusColor = (status: Purchase['status']) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'shipped':
        return 'bg-amber-100 text-amber-700';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: Purchase['status']) => {
    switch (status) {
      case 'processing':
        return Package;
      case 'shipped':
        return Truck;
      case 'delivered':
        return MapPin;
      default:
        return Package;
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          My Purchases
        </p>
        <Link
          href={ROUTES.user.purchases}
          className="text-xs font-semibold text-indigo-600 no-underline hover:text-indigo-700"
        >
          See all
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
      >
        {purchases.map((purchase, index) => {
          const StatusIcon = getStatusIcon(purchase.status);
          return (
            <motion.div
              key={purchase.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
              className="flex-shrink-0 w-64"
            >
              <Link
                href={`${ROUTES.user.purchases}/${purchase.id}`}
                className="no-underline group block"
              >
                <div className="flex gap-3 rounded-2xl bg-white border border-slate-200 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative overflow-hidden rounded-xl bg-slate-100 w-20 h-20 flex-shrink-0">
                    <img
                      src={purchase.image}
                      alt={purchase.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate mb-1">
                      {purchase.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate mb-2">
                      by {purchase.seller}
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1',
                          getStatusColor(purchase.status)
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {purchase.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-indigo-600">
                        {purchase.price}
                      </p>
                      {purchase.deliveryDate && (
                        <span className="text-[10px] text-slate-400">
                          {purchase.deliveryDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
