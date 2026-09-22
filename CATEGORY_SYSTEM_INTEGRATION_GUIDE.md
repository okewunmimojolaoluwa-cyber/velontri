# 🔧 Category System Integration Guide

**Priority**: HIGH  
**Status**: Ready for Integration  
**Estimated Time**: 2-4 hours  

---

## 📋 Overview

The Category System components are **complete and ready**. This guide shows exactly what needs to be updated to integrate them into the existing listing forms.

---

## 🎯 Integration Tasks

### Task 1: Update Listing Creation Form ⏳ **PENDING**
**File**: `frontend/src/app/dashboard/listings/create/page.tsx`  
**Priority**: HIGH  
**Time**: 1-2 hours

#### Current State:
❌ Using hardcoded `CATEGORIES` object (lines 203-293)  
❌ Using string-based category/subcategory  
❌ No dynamic attribute fields  

#### Required Changes:

**1. Add Imports (add at top)**
```typescript
// Add these imports
import { CategorySelector } from '@/components/categories/category-selector';
import { DynamicAttributeFields } from '@/components/categories/dynamic-attribute-fields';
import { validateAttributes } from '@/lib/api/endpoints/categories';
```

**2. Update Form State (around line 559)**
```typescript
// Replace form state with:
const [form, setForm] = useState({
  listing_type: '',
  title: '',
  description: '',
  price: '',
  currency: 'NGN',
  // ✅ NEW: Use UUID-based categories
  category_id: '',
  subcategory_id: '',
  child_category_id: '',
  attributes: {} as Record<string, any>, // ✅ NEW: Dynamic attributes
  // Remove old fields:
  // category: '',
  // subcategory: '',
  condition: 'new' as 'new' | 'used' | 'refurbished',
  country: '',
  state: '',
  city: '',
  whatsapp_number: '',
  contact_phone: '',
  images: [] as string[],
  videos: [] as string[],
  is_negotiable: false,
});

// ✅ NEW: Add category selection state
const [categorySelection, setCategorySelection] = useState({
  categoryId: '',
  subcategoryId: '',
  childCategoryId: '',
});

// ✅ NEW: Add validation errors state
const [attributeErrors, setAttributeErrors] = useState<Record<string, string>>({});
```

**3. Update Validation in `next()` function (around line 750)**
```typescript
// In step 0 validation, replace category check:
if (step === 0) {
  if (!form.title.trim()) { setError('Title is required.'); return; }
  if (!form.description.trim()) { setError('Description is required.'); return; }
  if (!form.price || isNaN(parseFloat(form.price))) { setError('Enter a valid price.'); return; }
  
  // ✅ NEW: Validate category selection
  if (!categorySelection.categoryId) { 
    setError('Select a category.'); 
    return; 
  }
  if (!categorySelection.subcategoryId) { 
    setError('Select a subcategory.'); 
    return; 
  }
  
  // ✅ NEW: Validate attributes before proceeding
  try {
    const validation = await validateAttributes({
      category_id: categorySelection.categoryId,
      subcategory_id: categorySelection.subcategoryId,
      child_category_id: categorySelection.childCategoryId,
      attributes: form.attributes,
    });
    
    if (!validation.valid) {
      const errorMap: Record<string, string> = {};
      validation.errors?.forEach(err => {
        errorMap[err.attribute] = err.error;
      });
      setAttributeErrors(errorMap);
      setError('Please fix attribute validation errors.');
      return;
    }
  } catch (err) {
    setError('Failed to validate attributes. Please try again.');
    return;
  }
  
  // Auto-set listing_type based on category (keep existing logic)
  const autoType = getListingTypeFromCategory(form.category);
  setForm(f => ({ ...f, listing_type: autoType }));
}
```

**4. Update API Call in mutation (around line 610)**
```typescript
mutationFn: async () => {
  // ... existing warm-up code ...
  
  // ... existing image compression code ...
  
  const normalizedPhone = normalizePhoneNumber(form.whatsapp_number);
  const res = await sellerApi.createListing({
    title: form.title,
    description: form.description,
    price: parseFloat(form.price) || 0,
    currency: form.currency,
    
    // ✅ NEW: Send UUID-based categories
    category_id: categorySelection.categoryId,
    subcategory_id: categorySelection.subcategoryId,
    child_category_id: categorySelection.childCategoryId || undefined,
    attributes: form.attributes, // ✅ NEW: Send dynamic attributes
    
    // Remove old fields:
    // category: form.category,
    // subcategory: form.subcategory,
    
    listing_type: form.listing_type as CreateListingRequest['listing_type'],
    city: form.city || undefined,
    state: form.state || undefined,
    country: form.country || 'NG',
    condition: form.condition,
    whatsapp_number: normalizedPhone || undefined,
    contact_phone: normalizedPhone || undefined,
    is_negotiable: form.is_negotiable,
    image_url: coverImageUrl,
    extra_image_urls: extraImageUrls.length > 0 ? extraImageUrls : undefined,
    extra_video_urls: form.videos.length > 0 ? form.videos : undefined,
  } as any);
  
  // ... rest of existing code ...
},
```

**5. Replace Category UI in Step 0 (around line 900)**
```typescript
{/* STEP 0 — Details */}
{step === 0 && (
  <div className="space-y-4">
    {/* Title field - keep as is */}
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1.5">
        Title <span className="text-red-500">*</span>
      </label>
      <Input
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        placeholder="e.g. 2022 Toyota Camry Lagos, excellent condition"
        maxLength={100}
      />
      <p className="text-xs text-slate-400 mt-1">{form.title.length}/100</p>
    </div>

    {/* Description field - keep as is */}
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1.5">
        Description <span className="text-red-500">*</span>
      </label>
      <textarea
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        placeholder="Describe condition, features, reason for selling…"
        rows={5}
        maxLength={2000}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm
          text-slate-800 placeholder-slate-400 focus:border-indigo-400
          focus:outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none"
      />
      <p className="text-xs text-slate-400 mt-1">{form.description.length}/2000</p>
    </div>

    {/* Price fields - keep as is */}
    <div className="grid grid-cols-2 gap-4">
      {/* ... existing price and currency fields ... */}
    </div>

    {/* ✅ NEW: Replace old category dropdowns with CategorySelector */}
    <CategorySelector
      value={categorySelection}
      onChange={(selection) => {
        setCategorySelection(selection);
        setAttributeErrors({}); // Clear errors when category changes
      }}
      required
    />

    {/* ✅ NEW: Add Dynamic Attribute Fields */}
    {categorySelection.subcategoryId && (
      <DynamicAttributeFields
        categoryId={categorySelection.categoryId}
        subcategoryId={categorySelection.subcategoryId}
        childCategoryId={categorySelection.childCategoryId}
        values={form.attributes}
        onChange={(attributes) => {
          setForm(f => ({ ...f, attributes }));
          setAttributeErrors({}); // Clear errors when values change
        }}
        errors={attributeErrors}
      />
    )}

    {/* Condition field - keep as is */}
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1.5">
        Condition <span className="text-red-500">*</span>
      </label>
      {/* ... existing condition selector ... */}
    </div>
  </div>
)}
```

**6. Remove Old Category Constants (lines 203-293)**
```typescript
// ❌ DELETE: Remove entire CATEGORIES object
// const CATEGORIES: Record<string, string[]> = { ... };

// ✅ Keep getListingTypeFromCategory but update it:
function getListingTypeFromCategory(categoryName: string): string {
  // This function will need to be updated or removed
  // For now, you can determine type from category name or remove it
  // The backend might handle this automatically
  if (categoryName.includes('Vehicle')) return 'vehicle';
  if (categoryName.includes('Property')) return 'property';
  if (categoryName.includes('Service') || categoryName.includes('Repair')) return 'service';
  if (categoryName.includes('Job') || categoryName.includes('CV')) return 'job';
  return 'physical';
}
```

---

### Task 2: Update Listing Edit Form ⏳ **PENDING**
**File**: `frontend/src/app/dashboard/listings/[id]/edit/page.tsx` (if exists)  
**Priority**: MEDIUM  
**Time**: 1 hour

Apply the same changes as Task 1, but also:
- Pre-populate `categorySelection` from existing listing data
- Pre-populate `attributes` from existing listing data

---

### Task 3: Add Category Browsing Page ⏳ **OPTIONAL**
**File**: `frontend/src/app/categories/page.tsx` (create new)  
**Priority**: LOW  
**Time**: 2 hours

```typescript
'use client';

import { useCategoryTree, usePopularCategories } from '@/lib/hooks/use-categories';
import Link from 'next/link';
import { ROUTES } from '@/config/routes';

export default function CategoriesPage() {
  const { data: tree, isLoading: treeLoading } = useCategoryTree();
  const { data: popular } = usePopularCategories(1, 10);

  if (treeLoading) return <div>Loading categories...</div>;

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Browse Categories</h1>
      
      {/* Popular Categories */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Popular Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {popular?.categories.map(category => (
            <Link 
              key={category.id}
              href={`${ROUTES.listings}?category=${category.slug}`}
              className="p-4 border rounded-lg hover:shadow-md transition"
            >
              <div className="text-2xl mb-2">{category.icon}</div>
              <h3 className="font-semibold">{category.name}</h3>
              <p className="text-sm text-slate-500">
                {category.listing_count} listings
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* All Categories */}
      <section>
        <h2 className="text-xl font-semibold mb-4">All Categories</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tree?.map(category => (
            <div key={category.id} className="border rounded-lg p-4">
              <Link 
                href={`${ROUTES.listings}?category=${category.slug}`}
                className="text-lg font-semibold hover:text-indigo-600"
              >
                {category.icon} {category.name}
              </Link>
              {category.children && category.children.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {category.children.slice(0, 5).map(child => (
                    <li key={child.id}>
                      <Link
                        href={`${ROUTES.listings}?category=${category.slug}&subcategory=${child.slug}`}
                        className="text-sm text-slate-600 hover:text-indigo-600"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                  {category.children.length > 5 && (
                    <li className="text-sm text-slate-400">
                      +{category.children.length - 5} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

### Task 4: Add Category Filters to Search ⏳ **OPTIONAL**
**File**: `frontend/src/app/search/page.tsx` or `frontend/src/app/listings/page.tsx`  
**Priority**: MEDIUM  
**Time**: 2 hours

Add category-based filtering to the listings/search page using the category selector.

---

## 🧪 Testing Checklist

### After Integration:
- [ ] Create a new listing with categories
- [ ] Verify category selector loads categories
- [ ] Verify subcategories load when category selected
- [ ] Verify dynamic fields appear for selected category
- [ ] Fill in required attributes
- [ ] Submit listing
- [ ] Verify listing created with correct category_id, subcategory_id, attributes
- [ ] Check listing displays correctly
- [ ] Test validation errors (missing required fields)
- [ ] Test with different categories
- [ ] Test edit form (if applicable)

---

## 📝 Backend API Changes Required

### Check if these fields are accepted:
The backend API needs to accept these fields in the listing creation endpoint:

```python
# backend/marketplace-service/app/schemas.py
class CreateListingRequest(BaseModel):
    # Existing fields...
    
    # ✅ NEW: Add these if not present
    category_id: Optional[UUID] = None
    subcategory_id: Optional[UUID] = None  
    child_category_id: Optional[UUID] = None
    attributes: Optional[Dict[str, Any]] = None
    
    # Legacy fields (keep for backward compatibility)
    category: Optional[str] = None
    subcategory: Optional[str] = None
```

### Verify Backend Validation:
The backend should validate:
1. Category hierarchy (category → subcategory → child)
2. Required attributes are present
3. Attribute types match schema
4. Attribute values pass validation rules

This is already implemented in Phase 2! Just verify it's working.

---

## 🚀 Deployment Steps

### 1. Verify Backend is Ready
```bash
# Test category API
python test_category_api.py

# Should pass all 11 tests
```

### 2. Update Frontend Code
- Follow Task 1 changes above
- Test locally first
- Commit changes

### 3. Deploy
```bash
cd frontend
npm run build
npm start

# Or deploy to Vercel/Netlify
```

### 4. Monitor
- Check for errors in browser console
- Verify listings are created correctly
- Check database for category_id, attributes fields

---

## 🐛 Common Issues & Solutions

### Issue 1: Categories not loading
**Solution**: Check API URL in `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1
```

### Issue 2: Validation failing
**Solution**: Check backend logs for validation errors. Ensure attribute values match expected types.

### Issue 3: Old listings breaking
**Solution**: System is backward compatible. Old listings with string categories will continue working.

### Issue 4: TypeScript errors
**Solution**: Ensure all imports are correct:
```typescript
import { CategorySelector } from '@/components/categories/category-selector';
import { DynamicAttributeFields } from '@/components/categories/dynamic-attribute-fields';
import { validateAttributes } from '@/lib/api/endpoints/categories';
```

---

## 📚 Documentation References

- **Quick Start**: `CATEGORY_SYSTEM_README.md`
- **Phase 3 Guide**: `CATEGORY_SYSTEM_PHASE3_PROGRESS.md`
- **API Reference**: `CATEGORY_API_QUICK_REFERENCE.md`
- **Complete Status**: `CATEGORY_SYSTEM_FINAL_STATUS.md`

---

## ✅ Success Criteria

Integration is complete when:
- [x] Components are created ✅
- [x] API client functions work ✅
- [x] React hooks work ✅
- [ ] Listing creation form uses new components ⏳
- [ ] Listings are created with category_id and attributes ⏳
- [ ] Validation works end-to-end ⏳
- [ ] No regressions in existing functionality ⏳

---

## 💡 Tips

1. **Test incrementally**: Integrate one component at a time
2. **Keep old code initially**: Comment out old code, don't delete immediately
3. **Check browser console**: Watch for errors during testing
4. **Use React DevTools**: Inspect component props and state
5. **Test with real data**: Use actual categories from the API

---

## 🎯 Next Steps

**Immediate** (Today):
1. ✅ Review this guide
2. 🔄 Update listing creation form (Task 1)
3. 🔄 Test locally
4. 🔄 Fix any issues
5. 🔄 Deploy

**This Week**:
1. Update listing edit form (Task 2)
2. Add category browsing page (Task 3)
3. Add category filters (Task 4)
4. Deploy to production

---

**Integration Status**: 🟡 Ready to Begin  
**Estimated Completion**: 2-4 hours  
**Risk Level**: 🟢 Low (Components are tested)  

---

*For questions, refer to component JSDoc comments or `CATEGORY_SYSTEM_README.md`*
