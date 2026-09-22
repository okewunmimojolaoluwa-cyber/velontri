'use client';

/**
 * CategorySelector Component
 * 
 * Hierarchical category selector with 3 levels:
 * - Category (Level 1)
 * - Subcategory (Level 2)
 * - Child Category (Level 3)
 */

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Category } from '@/types/category';
import {
  useTopLevelCategories,
  useCategoryChildren,
} from '@/lib/hooks/use-categories';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface CategorySelectorProps {
  value?: {
    categoryId?: string;
    subcategoryId?: string;
    childCategoryId?: string;
  };
  onChange?: (value: {
    categoryId?: string;
    subcategoryId?: string;
    childCategoryId?: string;
  }) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showLevel3?: boolean; // Whether to show child category selector
}

export function CategorySelector({
  value,
  onChange,
  required = false,
  disabled = false,
  className,
  showLevel3 = true,
}: CategorySelectorProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    value?.categoryId
  );
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>(
    value?.subcategoryId
  );
  const [selectedChildCategoryId, setSelectedChildCategoryId] = useState<string | undefined>(
    value?.childCategoryId
  );

  // Fetch top-level categories
  const { data: topLevelCategories, isLoading: isLoadingCategories } = useTopLevelCategories();

  // Fetch subcategories when category is selected
  const { data: subcategoryResponse, isLoading: isLoadingSubcategories } = useCategoryChildren(
    selectedCategoryId,
    true
  );
  const subcategories = subcategoryResponse?.categories || [];

  // Fetch child categories when subcategory is selected
  const { data: childCategoryResponse, isLoading: isLoadingChildCategories } = useCategoryChildren(
    selectedSubcategoryId,
    true
  );
  const childCategories = childCategoryResponse?.categories || [];

  // Update internal state when value prop changes
  useEffect(() => {
    if (value?.categoryId !== selectedCategoryId) {
      setSelectedCategoryId(value?.categoryId);
    }
    if (value?.subcategoryId !== selectedSubcategoryId) {
      setSelectedSubcategoryId(value?.subcategoryId);
    }
    if (value?.childCategoryId !== selectedChildCategoryId) {
      setSelectedChildCategoryId(value?.childCategoryId);
    }
  }, [value]);

  // Handle category selection
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId(undefined);
    setSelectedChildCategoryId(undefined);
    
    onChange?.({
      categoryId,
      subcategoryId: undefined,
      childCategoryId: undefined,
    });
  };

  // Handle subcategory selection
  const handleSubcategoryChange = (subcategoryId: string) => {
    setSelectedSubcategoryId(subcategoryId);
    setSelectedChildCategoryId(undefined);
    
    onChange?.({
      categoryId: selectedCategoryId,
      subcategoryId,
      childCategoryId: undefined,
    });
  };

  // Handle child category selection
  const handleChildCategoryChange = (childCategoryId: string) => {
    setSelectedChildCategoryId(childCategoryId);
    
    onChange?.({
      categoryId: selectedCategoryId,
      subcategoryId: selectedSubcategoryId,
      childCategoryId,
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Category (Level 1) */}
      <div className="space-y-2">
        <Label htmlFor="category" className="text-sm font-medium">
          Category {required && <span className="text-destructive">*</span>}
        </Label>
        <Select
          value={selectedCategoryId}
          onValueChange={handleCategoryChange}
          disabled={disabled || isLoadingCategories}
          required={required}
        >
          <SelectTrigger id="category" className="w-full">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {isLoadingCategories ? (
              <SelectItem value="loading" disabled>
                Loading categories...
              </SelectItem>
            ) : topLevelCategories && topLevelCategories.length > 0 ? (
              topLevelCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.icon && <span className="mr-2">{category.icon}</span>}
                  {category.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                No categories available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Subcategory (Level 2) */}
      {selectedCategoryId && (
        <div className="space-y-2">
          <Label htmlFor="subcategory" className="text-sm font-medium">
            Subcategory {required && <span className="text-destructive">*</span>}
          </Label>
          <Select
            value={selectedSubcategoryId}
            onValueChange={handleSubcategoryChange}
            disabled={disabled || isLoadingSubcategories}
            required={required}
          >
            <SelectTrigger id="subcategory" className="w-full">
              <SelectValue placeholder="Select a subcategory" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingSubcategories ? (
                <SelectItem value="loading" disabled>
                  Loading subcategories...
                </SelectItem>
              ) : subcategories.length > 0 ? (
                subcategories.map((subcategory) => (
                  <SelectItem key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  No subcategories available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Child Category (Level 3) - Optional */}
      {showLevel3 && selectedSubcategoryId && childCategories.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="child-category" className="text-sm font-medium">
            Category Type <span className="text-muted-foreground">(Optional)</span>
          </Label>
          <Select
            value={selectedChildCategoryId}
            onValueChange={handleChildCategoryChange}
            disabled={disabled || isLoadingChildCategories}
          >
            <SelectTrigger id="child-category" className="w-full">
              <SelectValue placeholder="Select type (optional)" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingChildCategories ? (
                <SelectItem value="loading" disabled>
                  Loading...
                </SelectItem>
              ) : (
                <>
                  <SelectItem value="none">None</SelectItem>
                  {childCategories.map((childCategory) => (
                    <SelectItem key={childCategory.id} value={childCategory.id}>
                      {childCategory.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
