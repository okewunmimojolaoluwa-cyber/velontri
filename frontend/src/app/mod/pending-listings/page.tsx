'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Tag,
  MapPin,
  User,
  Calendar,
} from 'lucide-react';

interface PendingListing {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  listing_type: string;
  condition?: string;
  location: string;
  city?: string;
  country?: string;
  price: number;
  currency: string;
  seller_name: string;
  seller_email: string;
  seller_id: string;
  status: 'pending_review' | 'active' | 'rejected' | 'pending' | 'approved';
  image_url?: string;
  created_at: string;
}

type FilterType = 'all' | 'pending' | 'approved' | 'rejected';

export default function ModPendingListingsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['mod-pending-listings', filter],
    queryFn: () =>
      apiClient
        .get<ApiResponse<PendingListing[]>>(`/mod/listings?status=${filter}`)
        .then((r) => r.data),
    enabled: session?.isAuthenticated,
    refetchInterval: 30_000, // poll every 30s
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/mod/listings/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-pending-listings'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/mod/listings/${id}/reject?reason=${encodeURIComponent(reason)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-pending-listings'] });
      setRejectModal(null);
      setRejectReason('');
    },
  });

  const listings = data?.data || [];

  const pendingCount = listings.filter(
    (l) => l.status === 'pending_review' || l.status === 'pending',
  ).length;

  const statusLabel = (status: string) => {
    if (status === 'pending_review' || status === 'pending') return 'Pending Review';
    if (status === 'active' || status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    return status;
  };

  const statusColor = (status: string) => {
    if (status === 'pending_review' || status === 'pending')
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    if (status === 'active' || status === 'approved')
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  };

  const filterButtons: { label: string; value: FilterType }[] = [
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: 'all' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Listing Moderation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review, approve, and reject seller listings before they go live.
          </p>
        </div>
        {pendingCount > 0 && filter === 'pending' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-sm font-semibold text-white">
            <AlertCircle className="h-4 w-4" />
            {pendingCount} awaiting review
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-0">
        {filterButtons.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              filter === value
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          title="No listings found"
          description={
            filter === 'pending'
              ? 'No listings are currently awaiting review.'
              : `No ${filter} listings found.`
          }
        />
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => {
            const isExpanded = expandedId === listing.id;
            const isPending = listing.status === 'pending_review' || listing.status === 'pending';
            return (
              <div
                key={listing.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
              >
                {/* Card header */}
                <div className="p-5 flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    {listing.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={listing.image_url}
                        alt={listing.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400 text-xs text-center px-2">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {listing.title}
                      </h3>
                      <span
                        className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(listing.status)}`}
                      >
                        {statusLabel(listing.status)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        {listing.category}
                        {listing.listing_type && ` · ${listing.listing_type}`}
                      </span>
                      {(listing.city || listing.country) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {listing.location || [listing.city, listing.country].filter(Boolean).join(', ')}
                        </span>
                      )}
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {listing.currency} {listing.price.toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {listing.seller_name}
                        {listing.seller_email && ` (${listing.seller_email})`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(listing.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded description */}
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                      {listing.description || 'No description provided.'}
                    </p>
                    {listing.condition && (
                      <p className="mt-2 text-xs text-gray-500">
                        Condition: <span className="font-medium capitalize">{listing.condition}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Action bar */}
                <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                  {isPending && (
                    <>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        onClick={() => approveMutation.mutate(listing.id)}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 gap-1.5"
                        onClick={() =>
                          setRejectModal({ id: listing.id, title: listing.title })
                        }
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto gap-1"
                    onClick={() => setExpandedId(isExpanded ? null : listing.id)}
                  >
                    <Eye className="h-4 w-4" />
                    {isExpanded ? 'Hide' : 'Details'}
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Reject Listing
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              &ldquo;{rejectModal.title}&rdquo;
            </p>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={4}
              placeholder="e.g. Item description is misleading, prohibited item category, inappropriate images..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                disabled={rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (!rejectReason.trim()) return;
                  rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason });
                }}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject Listing'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
