import { apiClient } from '@/lib/api/client';
import type { ApiResponse, PaginationMeta } from '@/types/api';
import type { ListingSummary } from './listings';

export interface SearchParams {
  q: string;
  category?: string;
  listing_type?: string;
  min_price?: number;
  max_price?: number;
  city?: string;
  country?: string;
  page?: number;
  page_size?: number;
  sort_by?: 'price_asc' | 'price_desc' | 'newest' | 'relevance';
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'category' | 'listing';
}

/** Shape the backend search service returns inside data */
interface BackendSearchResponse {
  results: ListingSummary[];
  total: number;
  page: number;
  page_size: number;
  next_cursor?: string | null;
}

/**
 * Normalise the backend search response into the standard
 * { data: ListingSummary[], meta: PaginationMeta } envelope.
 */
function normaliseSearch(
  raw: ApiResponse<BackendSearchResponse | ListingSummary[]>,
): ApiResponse<ListingSummary[]> {
  const inner = raw.data;

  // Already a plain array (fallback / mock)
  if (Array.isArray(inner)) {
    return raw as ApiResponse<ListingSummary[]>;
  }

  // Backend wraps results in { results: [...], total, page, page_size }
  if (inner && typeof inner === 'object' && 'results' in inner) {
    const sr = inner as BackendSearchResponse;
    const totalPages = Math.ceil(sr.total / (sr.page_size || 20));
    const meta: PaginationMeta = {
      page: sr.page,
      page_size: sr.page_size,
      total: sr.total,
      total_pages: totalPages,
      has_next: sr.page < totalPages,
      has_prev: sr.page > 1,
    };
    return { ...raw, data: sr.results, meta };
  }

  // Unknown shape — return empty
  return { ...raw, data: [], meta: null };
}

export const searchApi = {
  search(params: SearchParams): Promise<ApiResponse<ListingSummary[]>> {
    return apiClient
      .get<ApiResponse<BackendSearchResponse | ListingSummary[]>>('/search', { params })
      .then(r => normaliseSearch(r.data));
  },

  suggest(q: string): Promise<ApiResponse<SearchSuggestion[]>> {
    return apiClient
      .get<ApiResponse<{ suggestions: string[] } | SearchSuggestion[]>>(
        '/search/suggest',
        { params: { q } },
      )
      .then(r => {
        const raw = r.data;
        const inner = raw.data;
        // Backend returns { suggestions: string[] }
        if (
          inner &&
          !Array.isArray(inner) &&
          typeof inner === 'object' &&
          'suggestions' in inner
        ) {
          const suggestions = (inner as { suggestions: string[] }).suggestions ?? [];
          const normalised: ApiResponse<SearchSuggestion[]> = {
            ...raw,
            data: suggestions.map(s => ({ text: s, type: 'query' as const })),
          };
          return normalised;
        }
        return raw as ApiResponse<SearchSuggestion[]>;
      });
  },
};

export const searchKeys = {
  all: ['search'] as const,
  results:     (params: SearchParams) => [...searchKeys.all, 'results', params] as const,
  suggestions: (q: string)            => [...searchKeys.all, 'suggestions', q] as const,
};
