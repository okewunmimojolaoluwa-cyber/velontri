"""
Category data access layer.

All category-related database operations.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.logging import get_logger

from .category_models import Category, CategoryAttribute

logger = get_logger(__name__)


# ── Category retrieval ────────────────────────────────────────────────────────

async def get_category_by_id(
    session: AsyncSession, category_id: uuid.UUID
) -> Category | None:
    """Get a category by ID."""
    result = await session.execute(
        select(Category).where(Category.id == category_id)
    )
    return result.scalars().first()


async def get_category_by_slug(
    session: AsyncSession, slug: str
) -> Category | None:
    """Get a category by slug."""
    result = await session.execute(
        select(Category).where(Category.slug == slug)
    )
    return result.scalars().first()


async def get_categories_by_level(
    session: AsyncSession,
    level: int,
    parent_id: uuid.UUID | None = None,
    active_only: bool = True,
) -> list[Category]:
    """
    Get all categories at a specific level.
    
    Args:
        level: Category level (1, 2, or 3)
        parent_id: Filter by parent category (for levels 2 and 3)
        active_only: Only return active categories
    """
    conditions = [Category.level == level]
    
    if parent_id is not None:
        conditions.append(Category.parent_id == parent_id)
    
    if active_only:
        conditions.append(Category.is_active == True)
    
    result = await session.execute(
        select(Category)
        .where(and_(*conditions))
        .order_by(Category.sort_order.asc(), Category.name.asc())
    )
    return list(result.scalars().all())


async def get_category_tree(
    session: AsyncSession,
    parent_id: uuid.UUID | None = None,
    max_depth: int = 3,
    active_only: bool = True,
) -> list[dict[str, Any]]:
    """
    Get category tree structure recursively.
    
    Returns a nested structure:
    [
        {
            "id": "...",
            "name": "Vehicles",
            "slug": "vehicles",
            "level": 1,
            "children": [
                {
                    "id": "...",
                    "name": "Cars",
                    "slug": "cars",
                    "level": 2,
                    "children": [...]
                }
            ]
        }
    ]
    """
    if max_depth < 1:
        return []
    
    conditions = []
    if parent_id is None:
        conditions.append(Category.parent_id.is_(None))
    else:
        conditions.append(Category.parent_id == parent_id)
    
    if active_only:
        conditions.append(Category.is_active == True)
    
    result = await session.execute(
        select(Category)
        .where(and_(*conditions))
        .order_by(Category.sort_order.asc(), Category.name.asc())
    )
    categories = list(result.scalars().all())
    
    tree = []
    for cat in categories:
        cat_dict = {
            "id": str(cat.id),
            "name": cat.name,
            "slug": cat.slug,
            "description": cat.description,
            "level": cat.level,
            "icon": cat.icon,
            "image_url": cat.image_url,
            "sort_order": cat.sort_order,
        }
        
        # Recursively get children
        if max_depth > 1:
            cat_dict["children"] = await get_category_tree(
                session,
                parent_id=cat.id,
                max_depth=max_depth - 1,
                active_only=active_only,
            )
        
        tree.append(cat_dict)
    
    return tree


async def search_categories(
    session: AsyncSession,
    query: str,
    level: int | None = None,
    active_only: bool = True,
    limit: int = 20,
) -> list[Category]:
    """
    Search categories by name or slug.
    
    Args:
        query: Search term
        level: Filter by category level (optional)
        active_only: Only return active categories
        limit: Maximum results
    """
    search_term = f"%{query}%"
    conditions = [
        or_(
            Category.name.ilike(search_term),
            Category.slug.ilike(search_term),
            Category.description.ilike(search_term),
        )
    ]
    
    if level is not None:
        conditions.append(Category.level == level)
    
    if active_only:
        conditions.append(Category.is_active == True)
    
    result = await session.execute(
        select(Category)
        .where(and_(*conditions))
        .order_by(Category.sort_order.asc(), Category.name.asc())
        .limit(limit)
    )
    return list(result.scalars().all())


# ── Category attributes ───────────────────────────────────────────────────────

async def get_category_attributes(
    session: AsyncSession,
    category_id: uuid.UUID,
) -> list[CategoryAttribute]:
    """Get all attributes for a category."""
    result = await session.execute(
        select(CategoryAttribute)
        .where(CategoryAttribute.category_id == category_id)
        .order_by(CategoryAttribute.sort_order.asc(), CategoryAttribute.name.asc())
    )
    return list(result.scalars().all())


async def get_attribute_by_id(
    session: AsyncSession,
    attribute_id: uuid.UUID,
) -> CategoryAttribute | None:
    """Get a category attribute by ID."""
    result = await session.execute(
        select(CategoryAttribute).where(CategoryAttribute.id == attribute_id)
    )
    return result.scalars().first()


async def get_searchable_attributes(
    session: AsyncSession,
    category_id: uuid.UUID,
) -> list[CategoryAttribute]:
    """Get searchable attributes for a category (for search indexing)."""
    result = await session.execute(
        select(CategoryAttribute)
        .where(
            and_(
                CategoryAttribute.category_id == category_id,
                CategoryAttribute.searchable == True,
            )
        )
        .order_by(CategoryAttribute.sort_order.asc())
    )
    return list(result.scalars().all())


async def get_filterable_attributes(
    session: AsyncSession,
    category_id: uuid.UUID,
) -> list[CategoryAttribute]:
    """Get filterable attributes for a category (for filter UI)."""
    result = await session.execute(
        select(CategoryAttribute)
        .where(
            and_(
                CategoryAttribute.category_id == category_id,
                CategoryAttribute.filterable == True,
            )
        )
        .order_by(CategoryAttribute.sort_order.asc())
    )
    return list(result.scalars().all())


# ── Category statistics ───────────────────────────────────────────────────────

async def count_listings_by_category(
    session: AsyncSession,
    category_id: uuid.UUID,
    include_descendants: bool = False,
) -> int:
    """
    Count listings in a category.
    
    Args:
        category_id: Category to count
        include_descendants: Also count listings in child categories
    """
    from sqlalchemy import text as _text
    
    if not include_descendants:
        result = await session.execute(
            _text("""
                SELECT COUNT(*) 
                FROM listings 
                WHERE CAST(category_id AS TEXT) = :cat_id 
                  AND status = 'active'
            """),
            {"cat_id": str(category_id)}
        )
        return result.scalar_one()
    
    # Include descendants - get all child category IDs recursively
    category = await get_category_by_id(session, category_id)
    if not category:
        return 0
    
    # Build list of category IDs to include (self + descendants)
    category_ids = [str(category_id)]
    
    # Get level 2 children
    if category.level == 1:
        level2_result = await session.execute(
            select(Category.id).where(Category.parent_id == category_id)
        )
        level2_ids = [str(c) for c in level2_result.scalars().all()]
        category_ids.extend(level2_ids)
        
        # Get level 3 children
        if level2_ids:
            level3_result = await session.execute(
                select(Category.id).where(
                    Category.parent_id.in_([uuid.UUID(cid) for cid in level2_ids])
                )
            )
            level3_ids = [str(c) for c in level3_result.scalars().all()]
            category_ids.extend(level3_ids)
    
    # Get level 2 children only
    elif category.level == 2:
        level3_result = await session.execute(
            select(Category.id).where(Category.parent_id == category_id)
        )
        level3_ids = [str(c) for c in level3_result.scalars().all()]
        category_ids.extend(level3_ids)
    
    # Count listings in all categories
    if len(category_ids) == 1:
        result = await session.execute(
            _text("""
                SELECT COUNT(*) 
                FROM listings 
                WHERE CAST(category_id AS TEXT) = :cat_id 
                  AND status = 'active'
            """),
            {"cat_id": category_ids[0]}
        )
    else:
        placeholders = ", ".join([f":cat_id{i}" for i in range(len(category_ids))])
        params = {f"cat_id{i}": cid for i, cid in enumerate(category_ids)}
        result = await session.execute(
            _text(f"""
                SELECT COUNT(*) 
                FROM listings 
                WHERE CAST(category_id AS TEXT) IN ({placeholders})
                  AND status = 'active'
            """),
            params
        )
    
    return result.scalar_one()


async def get_popular_categories(
    session: AsyncSession,
    level: int = 1,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """
    Get most popular categories by listing count.
    
    Returns:
        List of dicts with: {category, listing_count}
    """
    from sqlalchemy import text as _text
    
    result = await session.execute(
        _text("""
            SELECT 
                c.id,
                c.name,
                c.slug,
                c.icon,
                c.image_url,
                COUNT(l.id) as listing_count
            FROM categories c
            LEFT JOIN listings l ON CAST(l.category_id AS TEXT) = CAST(c.id AS TEXT)
                AND l.status = 'active'
            WHERE c.level = :level
              AND c.is_active = true
            GROUP BY c.id, c.name, c.slug, c.icon, c.image_url, c.sort_order
            ORDER BY listing_count DESC, c.sort_order ASC
            LIMIT :limit
        """),
        {"level": level, "limit": limit}
    )
    
    rows = result.mappings().all()
    return [
        {
            "id": str(row["id"]),
            "name": row["name"],
            "slug": row["slug"],
            "icon": row["icon"],
            "image_url": row["image_url"],
            "listing_count": row["listing_count"],
        }
        for row in rows
    ]


# ── Category validation ───────────────────────────────────────────────────────

async def validate_category_hierarchy(
    session: AsyncSession,
    category_id: uuid.UUID | None = None,
    subcategory_id: uuid.UUID | None = None,
    child_category_id: uuid.UUID | None = None,
) -> tuple[bool, str | None]:
    """
    Validate that category IDs form a valid hierarchy.
    
    Returns:
        (is_valid, error_message)
    """
    if category_id is None:
        return True, None
    
    # Get category
    category = await get_category_by_id(session, category_id)
    if not category:
        return False, "Category not found"
    
    if category.level != 1:
        return False, "Category must be level 1 (top-level)"
    
    if not category.is_active:
        return False, "Category is not active"
    
    # Validate subcategory if provided
    if subcategory_id:
        subcategory = await get_category_by_id(session, subcategory_id)
        if not subcategory:
            return False, "Subcategory not found"
        
        if subcategory.level != 2:
            return False, "Subcategory must be level 2"
        
        if subcategory.parent_id != category_id:
            return False, "Subcategory must be a child of the specified category"
        
        if not subcategory.is_active:
            return False, "Subcategory is not active"
        
        # Validate child category if provided
        if child_category_id:
            child_category = await get_category_by_id(session, child_category_id)
            if not child_category:
                return False, "Child category not found"
            
            if child_category.level != 3:
                return False, "Child category must be level 3"
            
            if child_category.parent_id != subcategory_id:
                return False, "Child category must be a child of the specified subcategory"
            
            if not child_category.is_active:
                return False, "Child category is not active"
    
    elif child_category_id:
        return False, "Cannot specify child_category_id without subcategory_id"
    
    return True, None
