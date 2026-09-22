/**
 * React hooks for category management
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import type {
  BulkCategoryResponse,
  Category,
  CategoryAttribute,
  CategoryStats,
  CategoryTree,
  CategoryWithAttributes,
  PopularCategoriesResponse,
} from '@/types/category';
import * as categoryApi from '../api/endpoints/categories';

/**
 * Fetch top-level categories
 */
export function useTopLevelCategories() {
  return useQuery({
    queryKey: ['categories', 'level', 1],
    queryFn: () => categoryApi.getTopLevelCategories(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch category tree
 */
export function useCategoryTree(
  parentId?: string,
  maxDepth: number = 3,
  activeOnly: boolean = true
) {
  return useQuery({
    queryKey: ['categories', 'tree', parentId, maxDepth, activeOnly],
    queryFn: () => categoryApi.getCategoryTree({ parent_id: parentId, max_depth: maxDepth, active_only: activeOnly }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch popular categories
 */
export function usePopularCategories(level: number = 1, limit: number = 10) {
  return useQuery({
    queryKey: ['categories', 'popular', level, limit],
    queryFn: () => categoryApi.getPopularCategories(level, limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch single category
 */
export function useCategory(idOrSlug?: string) {
  return useQuery({
    queryKey: ['categories', idOrSlug],
    queryFn: () => categoryApi.getCategory(idOrSlug!),
    enabled: !!idOrSlug,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch category with attributes
 */
export function useCategoryWithAttributes(idOrSlug?: string) {
  return useQuery({
    queryKey: ['categories', idOrSlug, 'attributes'],
    queryFn: () => categoryApi.getCategoryWithAttributes(idOrSlug!),
    enabled: !!idOrSlug,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch category attributes
 */
export function useCategoryAttributes(
  idOrSlug?: string,
  filterableOnly: boolean = false,
  searchableOnly: boolean = false
) {
  return useQuery({
    queryKey: ['categories', idOrSlug, 'attributes-only', filterableOnly, searchableOnly],
    queryFn: () => categoryApi.getCategoryAttributes(idOrSlug!, filterableOnly, searchableOnly),
    enabled: !!idOrSlug,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch category children (subcategories)
 */
export function useCategoryChildren(idOrSlug?: string, activeOnly: boolean = true) {
  return useQuery({
    queryKey: ['categories', idOrSlug, 'children', activeOnly],
    queryFn: () => categoryApi.getCategoryChildren(idOrSlug!, activeOnly),
    enabled: !!idOrSlug,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch category statistics
 */
export function useCategoryStats(idOrSlug?: string) {
  return useQuery({
    queryKey: ['categories', idOrSlug, 'stats'],
    queryFn: () => categoryApi.getCategoryStats(idOrSlug!),
    enabled: !!idOrSlug,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Search categories
 */
export function useSearchCategories(
  query: string,
  level?: number,
  limit: number = 20
) {
  return useQuery({
    queryKey: ['categories', 'search', query, level, limit],
    queryFn: () => categoryApi.searchCategories(query, level, limit),
    enabled: query.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch filterable attributes for a category
 */
export function useFilterableAttributes(categoryId?: string) {
  return useQuery({
    queryKey: ['categories', categoryId, 'filterable-attributes'],
    queryFn: () => categoryApi.getFilterableAttributes(categoryId!),
    enabled: !!categoryId,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch full category path
 */
export function useCategoryPath(
  categoryId?: string,
  subcategoryId?: string,
  childCategoryId?: string
) {
  return useQuery({
    queryKey: ['categories', 'path', categoryId, subcategoryId, childCategoryId],
    queryFn: () => categoryApi.getCategoryPath(categoryId, subcategoryId, childCategoryId),
    enabled: !!(categoryId || subcategoryId || childCategoryId),
    staleTime: 10 * 60 * 1000,
  });
}
