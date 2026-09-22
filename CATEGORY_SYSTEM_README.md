# Velontri Category System - Quick Start Guide

**Welcome to the Velontri Category System!** This guide will help you get started quickly.

---

## 🚀 Quick Start

### For Developers (First Time)

1. **Run the database migration**:
```bash
python backend/scripts/run_migration_direct.py backend/migrations/001_category_system.sql
python backend/scripts/seed_categories.py
```

2. **Start using in your code**:
```typescript
// Import components
import { CategorySelector } from '@/components/categories/category-selector';
import { DynamicAttributeFields } from '@/components/categories/dynamic-attribute-fields';

// Use in your form
<CategorySelector
  value={categorySelection}
  onChange={setCategorySelection}
  required
/>

<DynamicAttributeFields
  categoryId={categorySelection.categoryId}
  subcategoryId={categorySelection.subcategoryId}
  values={attributes}
  onChange={setAttributes}
/>
```

3. **Test the API**:
```bash
python test_category_api.py
```

---

## 📚 Documentation Index

### Getting Started
- **This file** - Quick start guide
- `CATEGORY_SYSTEM_COMPLETE.md` - Complete overview

### Phase Guides
- `CATEGORY_SYSTEM_PHASE1_COMPLETE.md` - Database implementation
- `CATEGORY_SYSTEM_PHASE2_COMPLETE.md` - Backend API
- `CATEGORY_SYSTEM_PHASE3_PROGRESS.md` - Frontend components

### Reference
- `CATEGORY_API_QUICK_REFERENCE.md` - API endpoint reference
- `CATEGORY_SYSTEM_IMPLEMENTATION_SUMMARY.md` - Architecture overview

---

## 🎯 What You Get

### Backend
- ✅ 12 REST API endpoints
- ✅ 170+ categories seeded
- ✅ 50+ dynamic attributes
- ✅ Full validation
- ✅ Redis caching

### Frontend
- ✅ TypeScript types
- ✅ React hooks
- ✅ CategorySelector component
- ✅ DynamicAttributeFields component
- ✅ Full type safety

---

## 📖 Common Use Cases

### 1. Creating a Listing with Categories

```typescript
import { useState } from 'react';
import { CategorySelector } from '@/components/categories/category-selector';
import { DynamicAttributeFields } from '@/components/categories/dynamic-attribute-fields';
import { validateAttributes } from '@/lib/api/endpoints/categories';
import { createListing } from '@/lib/api/endpoints/listings';

function CreateListingForm() {
  const [categorySelection, setCategorySelection] = useState({});
  const [attributes, setAttributes] = useState({});

  const handleSubmit = async () => {
    // Validate attributes
    const validation = await validateAttributes({
      category_id: categorySelection.categoryId,
      subcategory_id: categorySelection.subcategoryId,
      child_category_id: categorySelection.childCategoryId,
      attributes,
    });

    if (!validation.valid) {
      alert('Please fix validation errors');
      return;
    }

    // Create listing
    await createListing({
      title: 'My Item',
      category_id: categorySelection.categoryId,
      subcategory_id: categorySelection.subcategoryId,
      child_category_id: categorySelection.childCategoryId,
      attributes,
      price: 100,
      currency: 'USD',
      // ... other fields
    });
  };

  return (
    <form>
      <CategorySelector
        value={categorySelection}
        onChange={setCategorySelection}
        required
      />
      
      {categorySelection.subcategoryId && (
        <DynamicAttributeFields
          categoryId={categorySelection.categoryId}
          subcategoryId={categorySelection.subcategoryId}
          childCategoryId={categorySelection.childCategoryId}
          values={attributes}
          onChange={setAttributes}
        />
      )}
      
      <button onClick={handleSubmit}>Create Listing</button>
    </form>
  );
}
```

### 2. Browsing Categories

```typescript
import { useTopLevelCategories } from '@/lib/hooks/use-categories';

function CategoryList() {
  const { data: categories, isLoading } = useTopLevelCategories();

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {categories?.map(category => (
        <li key={category.id}>{category.name}</li>
      ))}
    </ul>
  );
}
```

### 3. Getting Category Tree

```typescript
import { useCategoryTree } from '@/lib/hooks/use-categories';

function CategoryTree() {
  const { data: tree } = useCategoryTree();

  return (
    <div>
      {tree?.map(category => (
        <div key={category.id}>
          <h3>{category.name}</h3>
          <ul>
            {category.children.map(child => (
              <li key={child.id}>{child.name}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔧 API Examples

### List Top-Level Categories
```bash
GET http://localhost:8001/api/v1/categories?level=1
```

### Get Category with Attributes
```bash
GET http://localhost:8001/api/v1/categories/{id}/with-attributes
```

### Validate Hierarchy
```bash
POST http://localhost:8001/api/v1/categories/validate-hierarchy
Content-Type: application/json

{
  "category_id": "uuid-1",
  "subcategory_id": "uuid-2"
}
```

### Validate Attributes
```bash
POST http://localhost:8001/api/v1/categories/validate-attributes
Content-Type: application/json

{
  "category_id": "uuid-1",
  "attributes": {
    "make": "Toyota",
    "year": 2020
  }
}
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Frontend (React)              │
├─────────────────────────────────────────┤
│  CategorySelector Component             │
│  DynamicAttributeFields Component       │
│  React Hooks (useCategories)            │
│  API Client Functions                   │
└──────────────┬──────────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────┐
│      Backend API (FastAPI)              │
├─────────────────────────────────────────┤
│  Category Router (12 endpoints)         │
│  Category Service                       │
│  Category Repository                    │
│  Redis Cache                            │
└──────────────┬──────────────────────────┘
               │ SQL
               ▼
┌─────────────────────────────────────────┐
│      Database (PostgreSQL)              │
├─────────────────────────────────────────┤
│  categories table                       │
│  category_attributes table              │
│  listings table (updated)               │
└─────────────────────────────────────────┘
```

---

## 📁 File Locations

### Backend
```
backend/
├── migrations/
│   └── 001_category_system.sql
├── scripts/
│   ├── seed_categories.py
│   └── migrate_existing_listings.py
└── marketplace-service/app/
    ├── category_models.py
    ├── category_repository.py
    ├── category_schemas.py
    └── routers/
        └── categories.py
```

### Frontend
```
frontend/src/
├── types/
│   └── category.ts
├── lib/
│   ├── api/endpoints/
│   │   └── categories.ts
│   └── hooks/
│       └── use-categories.ts
└── components/
    ├── categories/
    │   ├── category-selector.tsx
    │   └── dynamic-attribute-fields.tsx
    └── ui/
        ├── select.tsx
        ├── label.tsx
        ├── checkbox.tsx
        └── textarea.tsx
```

---

## 🧪 Testing

### Backend API Test
```bash
python test_category_api.py
```

### Manual Testing
```bash
# List categories
curl http://localhost:8001/api/v1/categories?level=1

# Get category tree
curl http://localhost:8001/api/v1/categories/tree

# Get popular categories
curl http://localhost:8001/api/v1/categories/popular?level=1&limit=10
```

### Swagger Docs
```
http://localhost:8001/docs
```

---

## 🐛 Troubleshooting

### Categories Not Showing
**Problem**: API returns empty array  
**Solution**: Run the seed script
```bash
python backend/scripts/seed_categories.py
```

### Database Migration Error
**Problem**: Migration fails with "table already exists"  
**Solution**: Tables exist, skip to seeding
```bash
python backend/scripts/seed_categories.py
```

### Component Not Rendering
**Problem**: React component not appearing  
**Solution**: Check imports and ensure backend API is running
```typescript
// Correct import
import { CategorySelector } from '@/components/categories/category-selector';
```

### Validation Errors
**Problem**: Attribute validation failing  
**Solution**: Check attribute schema matches category
```bash
# Get category attributes
curl http://localhost:8001/api/v1/categories/{id}/attributes
```

---

## 💡 Tips & Best Practices

### Performance
- ✅ Categories are cached (10 min)
- ✅ Use React Query for automatic caching
- ✅ Fetch tree once, traverse locally

### Validation
- ✅ Validate hierarchy before submission
- ✅ Validate attributes before submission
- ✅ Show validation errors to users

### UX
- ✅ Show loading states
- ✅ Handle empty states
- ✅ Mark required fields
- ✅ Provide helpful error messages

### Code Quality
- ✅ Use TypeScript for type safety
- ✅ Handle errors gracefully
- ✅ Add loading indicators
- ✅ Test with real data

---

## 📞 Support

### Documentation
- **Phase 1**: `CATEGORY_SYSTEM_PHASE1_COMPLETE.md`
- **Phase 2**: `CATEGORY_SYSTEM_PHASE2_COMPLETE.md`
- **Phase 3**: `CATEGORY_SYSTEM_PHASE3_PROGRESS.md`
- **Complete**: `CATEGORY_SYSTEM_COMPLETE.md`
- **API Reference**: `CATEGORY_API_QUICK_REFERENCE.md`

### API Documentation
- **Swagger**: `http://localhost:8001/docs`
- **ReDoc**: `http://localhost:8001/redoc`

### Testing
- **Test Script**: `python test_category_api.py`
- **Manual Tests**: See API examples above

---

## 🎓 Learning Path

### Beginner
1. Read this README
2. Run database migration
3. Test API with `test_category_api.py`
4. Explore Swagger docs
5. Try basic API calls

### Intermediate
1. Read Phase 2 guide
2. Understand API endpoints
3. Import React components
4. Build a simple form
5. Test validation

### Advanced
1. Read complete documentation
2. Customize components
3. Add new attributes
4. Extend functionality
5. Contribute improvements

---

## 🚢 Deployment

### Quick Deploy
```bash
# 1. Run migration
python backend/scripts/run_migration_direct.py backend/migrations/001_category_system.sql

# 2. Seed data
python backend/scripts/seed_categories.py

# 3. Restart services
# Backend will automatically pick up new routes

# 4. Deploy frontend
npm run build
```

### Zero Downtime
- ✅ Migration is backward compatible
- ✅ Old string categories still work
- ✅ Can deploy backend first, frontend later
- ✅ No breaking changes

---

## 📊 Stats

- **Categories**: 170+
- **Attributes**: 50+
- **API Endpoints**: 12
- **React Components**: 6
- **React Hooks**: 11
- **TypeScript Types**: 15+
- **Lines of Code**: ~10,545

---

## ✅ Checklist

### Initial Setup
- [ ] Run database migration
- [ ] Seed categories
- [ ] Test API endpoints
- [ ] Import React components
- [ ] Test in development

### Integration
- [ ] Update listing creation form
- [ ] Add category browsing page
- [ ] Add category filters
- [ ] Test end-to-end
- [ ] Deploy to production

### Optional
- [ ] Add category analytics
- [ ] Create admin UI
- [ ] Add search autocomplete
- [ ] Implement SEO pages

---

## 🎉 You're Ready!

You now have everything you need to use the Velontri Category System. Start with the Quick Start section above and refer to the detailed documentation as needed.

**Happy coding!** 🚀

---

*Last Updated: September 22, 2026*  
*Version: 1.0*  
*Status: Production Ready*
