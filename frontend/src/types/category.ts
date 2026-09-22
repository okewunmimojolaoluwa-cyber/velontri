/**
 * Category System TypeScript Types
 * 
 * Corresponds to backend schemas in:
 * backend/marketplace-service/app/category_schemas.py
 */

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  level: number; // 1, 2, or 3
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryTree {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  level: number;
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  children: CategoryTree[];
}

export interface CategoryAttribute {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date';
  required: boolean;
  searchable: boolean;
  filterable: boolean;
  options: {
    options?: string[];
    [key: string]: any;
  } | null;
  validation_rules: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  } | null;
  sort_order: number;
}

export interface CategoryWithAttributes {
  category: Category;
  attributes: CategoryAttribute[];
}

export interface PopularCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  image_url: string | null;
  listing_count: number;
}

export interface CategoryStats {
  category_id: string;
  listing_count: number;
  listing_count_with_descendants: number;
}

// Request types
export interface CategoryListParams {
  level?: number;
  parent_id?: string;
  active_only?: boolean;
  query?: string;
  limit?: number;
}

export interface CategoryTreeParams {
  parent_id?: string;
  max_depth?: number;
  active_only?: boolean;
}

export interface ValidateCategoryHierarchyRequest {
  category_id?: string;
  subcategory_id?: string;
  child_category_id?: string;
}

export interface ValidateCategoryHierarchyResponse {
  valid: boolean;
  error: string | null;
}

export interface ValidateAttributesRequest {
  category_id: string;
  subcategory_id?: string;
  child_category_id?: string;
  attributes: Record<string, any>;
}

export interface AttributeValidationError {
  attribute: string;
  error: string;
}

export interface ValidateAttributesResponse {
  valid: boolean;
  errors: AttributeValidationError[];
  missing_required: string[];
}

// Response types
export interface BulkCategoryResponse {
  categories: Category[];
  total: number;
}

export interface PopularCategoriesResponse {
  categories: PopularCategory[];
  level: number;
}

// Listing types with categories
export interface ListingCategories {
  // New UUID-based system
  category_id?: string | null;
  subcategory_id?: string | null;
  child_category_id?: string | null;
  attributes?: Record<string, any> | null;
  
  // Legacy string-based system (deprecated)
  category?: string | null;
  subcategory?: string | null;
}

// Category selection state
export interface CategorySelection {
  category?: Category;
  subcategory?: Category;
  childCategory?: Category;
  attributes: Record<string, any>;
}

// Form field types for dynamic attributes
export type AttributeFieldType = 
  | 'text' 
  | 'number' 
  | 'select' 
  | 'multiselect' 
  | 'boolean' 
  | 'date';

export interface AttributeFieldConfig {
  attribute: CategoryAttribute;
  value: any;
  error?: string;
}
