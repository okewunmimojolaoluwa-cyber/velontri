/**
 * Category API Client
 * 
 * Provides functions to interact with the category API endpoints.
 */

import { apiClient } from '../client';
import type {
  BulkCategoryResponse,
  Category,
  CategoryAttribute,
  CategoryListParams,
  CategoryStats,
  CategoryTree,
  CategoryTreeParams,
  CategoryWithAttributes,
  PopularCategoriesResponse,
  ValidateAttributesRequest,
  ValidateAttributesResponse,
  ValidateCategoryHierarchyRequest,
  ValidateCategoryHierarchyResponse,
} from '@/types/category';

const BASE_PATH = '/categories';

/**
 * List categories with optional filtering
 */
export async function listCategories(
  params?: CategoryListParams
): Promise<BulkCategoryResponse> {
  const searchParams = new URLSearchParams();
  
  if (params?.level) searchParams.append('level', params.level.toString());
  if (params?.parent_id) searchParams.append('parent_id', params.parent_id);
  if (params?.active_only !== undefined) {
    searchParams.append('active_only', params.active_only.toString());
  }
  if (params?.query) searchParams.append('query', params.query);
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  
  const queryString = searchParams.toString();
  const url = queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH;
  
  return apiClient.get<BulkCategoryResponse>(url);
}

/**
 * Get nested category tree structure
 */
export async function getCategoryTree(
  params?: CategoryTreeParams
): Promise<CategoryTree[]> {
  const searchParams = new URLSearchParams();
  
  if (params?.parent_id) searchParams.append('parent_id', params.parent_id);
  if (params?.max_depth) searchParams.append('max_depth', params.max_depth.toString());
  if (params?.active_only !== undefined) {
    searchParams.append('active_only', params.active_only.toString());
  }
  
  const queryString = searchParams.toString();
  const url = queryString ? `${BASE_PATH}/tree?${queryString}` : `${BASE_PATH}/tree`;
  
  return apiClient.get<CategoryTree[]>(url);
}

/**
 * Get popular categories by listing count
 */
export async function getPopularCategories(
  level: number = 1,
  limit: number = 10
): Promise<PopularCategoriesResponse> {
  return apiClient.get<PopularCategoriesResponse>(
    `${BASE_PATH}/popular?level=${level}&limit=${limit}`
  );
}

/**
 * Get single category by ID or slug
 */
export async function getCategory(
  idOrSlug: string
): Promise<Category> {
  return apiClient.get<Category>(`${BASE_PATH}/${idOrSlug}`);
}

/**
 * Get category with all its attributes
 */
export async function getCategoryWithAttributes(
  idOrSlug: string
): Promise<CategoryWithAttributes> {
  return apiClient.get<CategoryWithAttributes>(
    `${BASE_PATH}/${idOrSlug}/with-attributes`
  );
}

/**
 * Get attributes for a category
 */
export async function getCategoryAttributes(
  idOrSlug: string,
  filterableOnly: boolean = false,
  searchableOnly: boolean = false
): Promise<CategoryAttribute[]> {
  const params = new URLSearchParams();
  if (filterableOnly) params.append('filterable_only', 'true');
  if (searchableOnly) params.append('searchable_only', 'true');
  
  const queryString = params.toString();
  const url = queryString 
    ? `${BASE_PATH}/${idOrSlug}/attributes?${queryString}`
    : `${BASE_PATH}/${idOrSlug}/attributes`;
  
  return apiClient.get<CategoryAttribute[]>(url);
}

/**
 * Get direct children of a category
 */
export async function getCategoryChildren(
  idOrSlug: string,
  activeOnly: boolean = true
): Promise<BulkCategoryResponse> {
  return apiClient.get<BulkCategoryResponse>(
    `${BASE_PATH}/${idOrSlug}/children?active_only=${activeOnly}`
  );
}

/**
 * Get category statistics
 */
export async function getCategoryStats(
  idOrSlug: string
): Promise<CategoryStats> {
  return apiClient.get<CategoryStats>(`${BASE_PATH}/${idOrSlug}/stats`);
}

/**
 * Validate category hierarchy
 */
export async function validateCategoryHierarchy(
  request: ValidateCategoryHierarchyRequest
): Promise<ValidateCategoryHierarchyResponse> {
  return apiClient.post<ValidateCategoryHierarchyResponse>(
    `${BASE_PATH}/validate-hierarchy`,
    request
  );
}

/**
 * Validate listing attributes against category schema
 */
export async function validateAttributes(
  request: ValidateAttributesRequest
): Promise<ValidateAttributesResponse> {
  return apiClient.post<ValidateAttributesResponse>(
    `${BASE_PATH}/validate-attributes`,
    request
  );
}

// Convenience functions

/**
 * Get top-level categories
 */
export async function getTopLevelCategories(): Promise<Category[]> {
  const response = await listCategories({ level: 1, active_only: true });
  return response.categories;
}

/**
 * Get subcategories for a category
 */
export async function getSubcategories(categoryId: string): Promise<Category[]> {
  const response = await getCategoryChildren(categoryId, true);
  return response.categories;
}

/**
 * Search categories
 */
export async function searchCategories(
  query: string,
  level?: number,
  limit: number = 20
): Promise<Category[]> {
  const response = await listCategories({ query, level, limit, active_only: true });
  return response.categories;
}

/**
 * Get filterable attributes for building filters
 */
export async function getFilterableAttributes(
  categoryId: string
): Promise<CategoryAttribute[]> {
  return getCategoryAttributes(categoryId, true, false);
}

/**
 * Get full category path (category → subcategory → child)
 */
export async function getCategoryPath(
  categoryId?: string,
  subcategoryId?: string,
  childCategoryId?: string
): Promise<{
  category?: Category;
  subcategory?: Category;
  childCategory?: Category;
}> {
  const result: {
    category?: Category;
    subcategory?: Category;
    childCategory?: Category;
  } = {};
  
  try {
    if (categoryId) {
      result.category = await getCategory(categoryId);
    }
    if (subcategoryId) {
      result.subcategory = await getCategory(subcategoryId);
    }
    if (childCategoryId) {
      result.childCategory = await getCategory(childCategoryId);
    }
  } catch (error) {
    console.error('Error fetching category path:', error);
  }
  
  return result;
}
