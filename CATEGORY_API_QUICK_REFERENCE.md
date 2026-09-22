# Category API Quick Reference

**Quick reference for developers working with the new category system.**

---

## 🚀 Quick Start

### Get All Top-Level Categories
```bash
GET /api/v1/categories?level=1
```

### Get Category Tree (Nested Structure)
```bash
GET /api/v1/categories/tree?max_depth=3
```

### Get Category by ID or Slug
```bash
GET /api/v1/categories/{uuid-or-slug}
GET /api/v1/categories/vehicles  # by slug
```

### Get Category with Attributes
```bash
GET /api/v1/categories/{uuid}/with-attributes
```

---

## 📋 All Endpoints at a Glance

| Method | Endpoint | Description | Cache |
|--------|----------|-------------|-------|
| GET | `/categories` | List/search categories | - |
| GET | `/categories/tree` | Get nested tree | 10min |
| GET | `/categories/popular` | Most popular by count | 5min |
| GET | `/categories/{id}` | Single category | - |
| GET | `/categories/{id}/with-attributes` | Category + attributes | 10min |
| GET | `/categories/{id}/attributes` | Attributes only | - |
| GET | `/categories/{id}/children` | Direct children | - |
| GET | `/categories/{id}/stats` | Listing counts | - |
| POST | `/categories/validate-hierarchy` | Validate hierarchy | - |
| POST | `/categories/validate-attributes` | Validate attributes | - |

---

## 🔍 Common Use Cases

### 1. Building a Category Selector

**Step 1: Get top-level categories**
```typescript
const response = await fetch('/api/v1/categories?level=1');
const { categories } = await response.json();
```

**Step 2: Get children when user selects a category**
```typescript
const response = await fetch(`/api/v1/categories/${parentId}/children`);
const { categories } = await response.json();
```

**Alternative: Get full tree at once**
```typescript
const tree = await fetch('/api/v1/categories/tree?max_depth=3');
```

---

### 2. Creating a Listing with Categories

```typescript
// Step 1: Get category attributes to build form
const { category, attributes } = await fetch(
  `/api/v1/categories/${categoryId}/with-attributes`
).then(r => r.json());

// Step 2: Validate before submitting
const validation = await fetch('/api/v1/categories/validate-attributes', {
  method: 'POST',
  body: JSON.stringify({
    category_id: categoryId,
    subcategory_id: subcategoryId,
    attributes: {
      make: 'Toyota',
      model: 'Camry',
      year: 2020
    }
  })
}).then(r => r.json());

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  return;
}

// Step 3: Create listing
await fetch('/api/v1/listings', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Toyota Camry 2020',
    category_id: categoryId,
    subcategory_id: subcategoryId,
    attributes: {
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      mileage: 45000
    }
  })
});
```

---

### 3. Building Category Filters

```typescript
// Get filterable attributes for a category
const attributes = await fetch(
  `/api/v1/categories/${categoryId}/attributes?filterable_only=true`
).then(r => r.json());

// Build filter UI based on attribute types
attributes.forEach(attr => {
  switch (attr.type) {
    case 'select':
      // Render dropdown with attr.options.options
      break;
    case 'number':
      // Render range slider
      break;
    case 'boolean':
      // Render checkbox
      break;
  }
});
```

---

### 4. Homepage "Popular Categories"

```typescript
const { categories } = await fetch(
  '/api/v1/categories/popular?level=1&limit=8'
).then(r => r.json());

// Each category has: id, name, slug, icon, image_url, listing_count
```

---

## 📦 Response Shapes

### CategoryResponse
```typescript
{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  level: number;  // 1, 2, or 3
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}
```

### CategoryTreeResponse (nested)
```typescript
{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  level: number;
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  children: CategoryTreeResponse[];  // recursive
}
```

### CategoryAttributeResponse
```typescript
{
  id: string;
  category_id: string;
  name: string;
  slug: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date';
  required: boolean;
  searchable: boolean;
  filterable: boolean;
  options: {
    options?: string[];  // for select/multiselect
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
```

### ListingResponse (with categories)
```typescript
{
  id: string;
  // ... other fields
  
  // New category system
  category_id: string | null;
  subcategory_id: string | null;
  child_category_id: string | null;
  attributes: {
    [slug: string]: string | number | boolean;
  } | null;
  
  // Legacy (still supported)
  category: string | null;
  subcategory: string | null;
}
```

---

## ⚡ Query Parameters

### GET /categories
- `level` (1-3): Filter by category level
- `parent_id` (UUID): Filter by parent
- `active_only` (boolean): Only active categories (default: true)
- `query` (string): Search term
- `limit` (1-100): Max results (default: 20)

### GET /categories/tree
- `parent_id` (UUID): Start from this parent (default: root)
- `max_depth` (1-3): Tree depth (default: 3)
- `active_only` (boolean): Only active (default: true)

### GET /categories/popular
- `level` (1-3): Category level (default: 1)
- `limit` (1-50): Max results (default: 10)

### GET /categories/{id}/attributes
- `filterable_only` (boolean): Only filterable attributes
- `searchable_only` (boolean): Only searchable attributes

---

## ✅ Validation

### Validate Hierarchy
```typescript
POST /api/v1/categories/validate-hierarchy
{
  category_id: string;
  subcategory_id?: string;
  child_category_id?: string;
}

Response:
{
  valid: boolean;
  error: string | null;
}
```

**Validation Rules**:
- `category_id` must be level 1
- `subcategory_id` must be level 2 and child of `category_id`
- `child_category_id` must be level 3 and child of `subcategory_id`
- All must be active
- Cannot skip levels (can't have child without subcategory)

---

### Validate Attributes
```typescript
POST /api/v1/categories/validate-attributes
{
  category_id: string;
  subcategory_id?: string;
  child_category_id?: string;
  attributes: {
    [slug: string]: any;
  };
}

Response:
{
  valid: boolean;
  errors: Array<{
    attribute: string;
    error: string;
  }>;
  missing_required: string[];
}
```

**Validates**:
- Required fields are present
- Types match schema (text, number, boolean, etc.)
- Select/multiselect values are in allowed options
- Validation rules (min, max, minLength, maxLength, pattern)

---

## 🎨 Frontend Integration Examples

### React Category Selector Component

```typescript
import { useState, useEffect } from 'react';

export function CategorySelector({ onChange }) {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);

  // Load top-level categories
  useEffect(() => {
    fetch('/api/v1/categories?level=1')
      .then(r => r.json())
      .then(data => setCategories(data.categories));
  }, []);

  // Load subcategories when category selected
  useEffect(() => {
    if (selectedCategory) {
      fetch(`/api/v1/categories/${selectedCategory}/children`)
        .then(r => r.json())
        .then(data => setSubcategories(data.categories));
    }
  }, [selectedCategory]);

  return (
    <div>
      <select
        onChange={e => {
          setSelectedCategory(e.target.value);
          setSelectedSubcategory(null);
          onChange({ categoryId: e.target.value, subcategoryId: null });
        }}
      >
        <option>Select Category</option>
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>

      {selectedCategory && (
        <select
          onChange={e => {
            setSelectedSubcategory(e.target.value);
            onChange({ categoryId: selectedCategory, subcategoryId: e.target.value });
          }}
        >
          <option>Select Subcategory</option>
          {subcategories.map(sub => (
            <option key={sub.id} value={sub.id}>{sub.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
```

---

### Dynamic Attribute Fields

```typescript
export function DynamicAttributeFields({ categoryId, onChange }) {
  const [attributes, setAttributes] = useState([]);
  const [values, setValues] = useState({});

  useEffect(() => {
    fetch(`/api/v1/categories/${categoryId}/with-attributes`)
      .then(r => r.json())
      .then(data => setAttributes(data.attributes));
  }, [categoryId]);

  const renderField = (attr) => {
    switch (attr.type) {
      case 'text':
        return (
          <input
            type="text"
            placeholder={attr.name}
            required={attr.required}
            onChange={e => {
              setValues({ ...values, [attr.slug]: e.target.value });
              onChange({ ...values, [attr.slug]: e.target.value });
            }}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            placeholder={attr.name}
            required={attr.required}
            min={attr.validation_rules?.min}
            max={attr.validation_rules?.max}
            onChange={e => {
              setValues({ ...values, [attr.slug]: Number(e.target.value) });
              onChange({ ...values, [attr.slug]: Number(e.target.value) });
            }}
          />
        );

      case 'select':
        return (
          <select
            required={attr.required}
            onChange={e => {
              setValues({ ...values, [attr.slug]: e.target.value });
              onChange({ ...values, [attr.slug]: e.target.value });
            }}
          >
            <option value="">Select {attr.name}</option>
            {attr.options?.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <label>
            <input
              type="checkbox"
              onChange={e => {
                setValues({ ...values, [attr.slug]: e.target.checked });
                onChange({ ...values, [attr.slug]: e.target.checked });
              }}
            />
            {attr.name}
          </label>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      {attributes.map(attr => (
        <div key={attr.id}>
          <label>
            {attr.name}
            {attr.required && <span>*</span>}
          </label>
          {renderField(attr)}
        </div>
      ))}
    </div>
  );
}
```

---

## 🔥 Performance Tips

1. **Use Redis-cached endpoints** for read-heavy operations:
   - `/categories/tree` - 10 min cache
   - `/categories/{id}/with-attributes` - 10 min cache
   - `/categories/popular` - 5 min cache

2. **Fetch tree structure once** and traverse locally instead of multiple API calls

3. **Validate on blur**, not on every keystroke

4. **Cache category data** in localStorage/Redux for the session

5. **Use slugs for URLs**, UUIDs for API calls

---

## 🐛 Common Issues

### "Category not found"
- Check if migration was run
- Verify category_id is valid UUID
- Try accessing by slug instead

### "Invalid category hierarchy"
- Parent-child relationship must be correct
- Check category levels (1 → 2 → 3)
- Ensure all categories are active

### Validation fails
- Check required attributes are provided
- Verify attribute types match schema
- Ensure select values are in allowed options

### Listing creation fails
- Run Phase 1 migration first
- Validate hierarchy before creating
- Check attributes match category schema

---

## 📚 Related Documentation

- **Phase 1**: `CATEGORY_SYSTEM_PHASE1_COMPLETE.md` - Database schema
- **Phase 2**: `CATEGORY_SYSTEM_PHASE2_COMPLETE.md` - Backend API details
- **Swagger**: `http://localhost:8001/docs` - Interactive API docs
- **Migration**: `backend/migrations/001_category_system.sql`
- **Seed Data**: `backend/scripts/seed_categories.py`

---

**Last Updated**: 2026-09-22
