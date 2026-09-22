'use client';

/**
 * DynamicAttributeFields Component
 * 
 * Renders dynamic form fields based on category attributes.
 * Supports: text, number, select, multiselect, boolean, date
 */

import { useEffect, useState } from 'react';
import type { CategoryAttribute } from '@/types/category';
import { useCategoryWithAttributes } from '@/lib/hooks/use-categories';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface DynamicAttributeFieldsProps {
  categoryId?: string;
  subcategoryId?: string;
  childCategoryId?: string;
  values?: Record<string, any>;
  onChange?: (values: Record<string, any>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  className?: string;
}

export function DynamicAttributeFields({
  categoryId,
  subcategoryId,
  childCategoryId,
  values = {},
  onChange,
  errors = {},
  disabled = false,
  className,
}: DynamicAttributeFieldsProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, any>>(values);

  // Get the most specific category (child > subcategory > category)
  const targetCategoryId = childCategoryId || subcategoryId || categoryId;

  // Fetch category with attributes
  const { data: categoryData, isLoading } = useCategoryWithAttributes(targetCategoryId);
  const attributes = categoryData?.attributes || [];

  // Update internal state when values prop changes
  useEffect(() => {
    setFieldValues(values);
  }, [values]);

  // Handle field value change
  const handleFieldChange = (slug: string, value: any) => {
    const newValues = {
      ...fieldValues,
      [slug]: value,
    };
    setFieldValues(newValues);
    onChange?.(newValues);
  };

  // Render field based on attribute type
  const renderField = (attribute: CategoryAttribute) => {
    const value = fieldValues[attribute.slug];
    const error = errors[attribute.slug];
    const fieldId = `attribute-${attribute.slug}`;

    switch (attribute.type) {
      case 'text':
        return (
          <div key={attribute.id} className="space-y-2">
            <Label htmlFor={fieldId} className="text-sm font-medium">
              {attribute.name}
              {attribute.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {attribute.validation_rules?.maxLength && attribute.validation_rules.maxLength > 200 ? (
              <Textarea
                id={fieldId}
                value={value || ''}
                onChange={(e) => handleFieldChange(attribute.slug, e.target.value)}
                placeholder={`Enter ${attribute.name.toLowerCase()}`}
                required={attribute.required}
                disabled={disabled}
                maxLength={attribute.validation_rules?.maxLength}
                className={cn(error && 'border-destructive')}
              />
            ) : (
              <Input
                id={fieldId}
                type="text"
                value={value || ''}
                onChange={(e) => handleFieldChange(attribute.slug, e.target.value)}
                placeholder={`Enter ${attribute.name.toLowerCase()}`}
                required={attribute.required}
                disabled={disabled}
                minLength={attribute.validation_rules?.minLength}
                maxLength={attribute.validation_rules?.maxLength}
                pattern={attribute.validation_rules?.pattern}
                className={cn(error && 'border-destructive')}
              />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'number':
        return (
          <div key={attribute.id} className="space-y-2">
            <Label htmlFor={fieldId} className="text-sm font-medium">
              {attribute.name}
              {attribute.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={fieldId}
              type="number"
              value={value !== undefined ? value : ''}
              onChange={(e) => handleFieldChange(attribute.slug, e.target.value ? Number(e.target.value) : undefined)}
              placeholder={`Enter ${attribute.name.toLowerCase()}`}
              required={attribute.required}
              disabled={disabled}
              min={attribute.validation_rules?.min}
              max={attribute.validation_rules?.max}
              step="any"
              className={cn(error && 'border-destructive')}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={attribute.id} className="space-y-2">
            <Label htmlFor={fieldId} className="text-sm font-medium">
              {attribute.name}
              {attribute.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
              value={value || ''}
              onValueChange={(val) => handleFieldChange(attribute.slug, val)}
              disabled={disabled}
              required={attribute.required}
            >
              <SelectTrigger id={fieldId} className={cn(error && 'border-destructive')}>
                <SelectValue placeholder={`Select ${attribute.name.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {!attribute.required && (
                  <SelectItem value="">None</SelectItem>
                )}
                {attribute.options?.options?.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'multiselect':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div key={attribute.id} className="space-y-2">
            <Label className="text-sm font-medium">
              {attribute.name}
              {attribute.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="space-y-2 border rounded-md p-3">
              {attribute.options?.options?.map((option: string) => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${fieldId}-${option}`}
                    checked={selectedValues.includes(option)}
                    onCheckedChange={(checked) => {
                      const newValues = checked
                        ? [...selectedValues, option]
                        : selectedValues.filter((v: string) => v !== option);
                      handleFieldChange(attribute.slug, newValues);
                    }}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={`${fieldId}-${option}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'boolean':
        return (
          <div key={attribute.id} className="flex items-center space-x-2 py-2">
            <Checkbox
              id={fieldId}
              checked={value || false}
              onCheckedChange={(checked) => handleFieldChange(attribute.slug, checked)}
              disabled={disabled}
            />
            <Label
              htmlFor={fieldId}
              className="text-sm font-medium cursor-pointer"
            >
              {attribute.name}
              {attribute.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {error && <p className="text-sm text-destructive ml-7">{error}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={attribute.id} className="space-y-2">
            <Label htmlFor={fieldId} className="text-sm font-medium">
              {attribute.name}
              {attribute.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={fieldId}
              type="date"
              value={value || ''}
              onChange={(e) => handleFieldChange(attribute.slug, e.target.value)}
              required={attribute.required}
              disabled={disabled}
              className={cn(error && 'border-destructive')}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  if (!targetCategoryId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="text-sm text-muted-foreground">Loading category fields...</div>
      </div>
    );
  }

  if (!attributes || attributes.length === 0) {
    return null;
  }

  // Sort attributes by sort_order
  const sortedAttributes = [...attributes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Additional Details</h3>
        <p className="text-sm text-muted-foreground">
          Provide more information about your listing
        </p>
      </div>
      
      <div className="space-y-4">
        {sortedAttributes.map(renderField)}
      </div>
    </div>
  );
}
