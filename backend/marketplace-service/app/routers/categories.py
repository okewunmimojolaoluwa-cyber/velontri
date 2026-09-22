"""
Category API routes.

Provides endpoints for browsing categories, getting attributes, and validating hierarchies.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_session
from shared.errors import NotFoundError
from shared.logging import get_logger
from shared.redis_client import get_redis

from .. import category_repository as cat_repo
from ..category_schemas import (
    BulkCategoryResponse,
    CategoryAttributeResponse,
    CategoryListRequest,
    CategoryResponse,
    CategoryStatsResponse,
    CategoryTreeRequest,
    CategoryTreeResponse,
    CategoryWithAttributesResponse,
    PopularCategoriesResponse,
    PopularCategoryResponse,
    ValidateAttributesRequest,
    ValidateAttributesResponse,
    ValidateCategoryHierarchyRequest,
    ValidateCategoryHierarchyResponse,
    AttributeValidationError,
)

router = APIRouter(prefix="/categories", tags=["Categories"])
logger = get_logger(__name__)


# ── Category browsing ─────────────────────────────────────────────────────────

@router.get("/", response_model=BulkCategoryResponse)
async def list_categories(
    level: int | None = Query(default=None, ge=1, le=3, description="Filter by level (1, 2, or 3)"),
    parent_id: str | None = Query(default=None, description="Filter by parent category UUID"),
    active_only: bool = Query(default=True, description="Only show active categories"),
    query: str | None = Query(default=None, description="Search term"),
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> BulkCategoryResponse:
    """
    List categories with optional filtering.
    
    - **level**: Filter by category level (1=top-level, 2=subcategory, 3=child)
    - **parent_id**: Get children of a specific category
    - **active_only**: Only return active categories
    - **query**: Search by name, slug, or description
    - **limit**: Maximum number of results
    """
    try:
        # Search query
        if query:
            categories = await cat_repo.search_categories(
                session, query=query, level=level, active_only=active_only, limit=limit
            )
        # Get by level/parent
        elif level:
            parent_uuid = uuid.UUID(parent_id) if parent_id else None
            categories = await cat_repo.get_categories_by_level(
                session, level=level, parent_id=parent_uuid, active_only=active_only
            )[:limit]
        # Get top-level by default
        else:
            categories = await cat_repo.get_categories_by_level(
                session, level=1, active_only=active_only
            )[:limit]
        
        return BulkCategoryResponse(
            categories=[CategoryResponse(**c.__dict__) for c in categories],
            total=len(categories)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid UUID format: {str(e)}"
        )


@router.get("/tree", response_model=list[CategoryTreeResponse])
async def get_category_tree(
    parent_id: str | None = Query(default=None, description="Start from this parent (or root if None)"),
    max_depth: int = Query(default=3, ge=1, le=3, description="Maximum tree depth"),
    active_only: bool = Query(default=True, description="Only show active categories"),
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> list[CategoryTreeResponse]:
    """
    Get nested category tree structure.
    
    Returns a hierarchical tree of categories with children nested inside parents.
    Perfect for building navigation menus and category selectors.
    
    - **parent_id**: Start tree from this category (or from root if None)
    - **max_depth**: How many levels deep to traverse (1-3)
    - **active_only**: Filter inactive categories
    """
    try:
        # Try cache first
        cache_key = f"category_tree:{parent_id or 'root'}:{max_depth}:{active_only}"
        cached = await redis.get(cache_key)
        if cached:
            import json
            return [CategoryTreeResponse(**c) for c in json.loads(cached)]
        
        # Build tree from database
        parent_uuid = uuid.UUID(parent_id) if parent_id else None
        tree = await cat_repo.get_category_tree(
            session,
            parent_id=parent_uuid,
            max_depth=max_depth,
            active_only=active_only,
        )
        
        # Cache for 10 minutes
        import json
        await redis.setex(cache_key, 600, json.dumps(tree))
        
        return [CategoryTreeResponse(**c) for c in tree]
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid UUID format: {str(e)}"
        )


@router.get("/popular", response_model=PopularCategoriesResponse)
async def get_popular_categories(
    level: int = Query(default=1, ge=1, le=3, description="Category level"),
    limit: int = Query(default=10, ge=1, le=50, description="Number of results"),
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> PopularCategoriesResponse:
    """
    Get most popular categories by active listing count.
    
    Useful for homepage "Browse by category" sections.
    
    - **level**: Which level of categories to return (1=top-level, 2=subcategories, 3=child)
    - **limit**: Maximum number of categories to return
    """
    cache_key = f"popular_categories:level_{level}:limit_{limit}"
    cached = await redis.get(cache_key)
    if cached:
        import json
        data = json.loads(cached)
        return PopularCategoriesResponse(
            categories=[PopularCategoryResponse(**c) for c in data],
            level=level
        )
    
    popular = await cat_repo.get_popular_categories(session, level=level, limit=limit)
    
    # Cache for 5 minutes
    import json
    await redis.setex(cache_key, 300, json.dumps(popular))
    
    return PopularCategoriesResponse(
        categories=[PopularCategoryResponse(**c) for c in popular],
        level=level
    )


# ── Single category ───────────────────────────────────────────────────────────

@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: str,
    session: AsyncSession = Depends(get_session),
) -> CategoryResponse:
    """
    Get a single category by ID or slug.
    
    - **category_id**: UUID or slug of the category
    """
    try:
        # Try UUID first
        cat_uuid = uuid.UUID(category_id)
        category = await cat_repo.get_category_by_id(session, cat_uuid)
    except ValueError:
        # Not a UUID, try slug
        category = await cat_repo.get_category_by_slug(session, category_id)
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{category_id}' not found"
        )
    
    return CategoryResponse(**category.__dict__)


@router.get("/{category_id}/with-attributes", response_model=CategoryWithAttributesResponse)
async def get_category_with_attributes(
    category_id: str,
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> CategoryWithAttributesResponse:
    """
    Get a category with all its dynamic attributes.
    
    Use this when creating listings to know what fields to show.
    
    - **category_id**: UUID or slug of the category
    """
    try:
        cache_key = f"category_attrs:{category_id}"
        cached = await redis.get(cache_key)
        if cached:
            import json
            return CategoryWithAttributesResponse(**json.loads(cached))
        
        # Get category
        try:
            cat_uuid = uuid.UUID(category_id)
            category = await cat_repo.get_category_by_id(session, cat_uuid)
        except ValueError:
            category = await cat_repo.get_category_by_slug(session, category_id)
        
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category '{category_id}' not found"
            )
        
        # Get attributes
        attributes = await cat_repo.get_category_attributes(session, category.id)
        
        response = CategoryWithAttributesResponse(
            category=CategoryResponse(**category.__dict__),
            attributes=[CategoryAttributeResponse(**attr.__dict__) for attr in attributes]
        )
        
        # Cache for 10 minutes
        import json
        await redis.setex(cache_key, 600, response.model_dump_json())
        
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid UUID format: {str(e)}"
        )


@router.get("/{category_id}/attributes", response_model=list[CategoryAttributeResponse])
async def get_category_attributes(
    category_id: str,
    filterable_only: bool = Query(default=False, description="Only return filterable attributes"),
    searchable_only: bool = Query(default=False, description="Only return searchable attributes"),
    session: AsyncSession = Depends(get_session),
) -> list[CategoryAttributeResponse]:
    """
    Get attributes for a category.
    
    - **category_id**: UUID or slug of the category
    - **filterable_only**: Only return attributes that can be used as filters
    - **searchable_only**: Only return attributes that are searchable
    """
    try:
        cat_uuid = uuid.UUID(category_id)
        category = await cat_repo.get_category_by_id(session, cat_uuid)
    except ValueError:
        category = await cat_repo.get_category_by_slug(session, category_id)
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{category_id}' not found"
        )
    
    if filterable_only:
        attributes = await cat_repo.get_filterable_attributes(session, category.id)
    elif searchable_only:
        attributes = await cat_repo.get_searchable_attributes(session, category.id)
    else:
        attributes = await cat_repo.get_category_attributes(session, category.id)
    
    return [CategoryAttributeResponse(**attr.__dict__) for attr in attributes]


@router.get("/{category_id}/children", response_model=BulkCategoryResponse)
async def get_category_children(
    category_id: str,
    active_only: bool = Query(default=True),
    session: AsyncSession = Depends(get_session),
) -> BulkCategoryResponse:
    """
    Get direct children of a category.
    
    - **category_id**: UUID or slug of the parent category
    - **active_only**: Only return active categories
    """
    try:
        cat_uuid = uuid.UUID(category_id)
        category = await cat_repo.get_category_by_id(session, cat_uuid)
    except ValueError:
        category = await cat_repo.get_category_by_slug(session, category_id)
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{category_id}' not found"
        )
    
    if category.level >= 3:
        # Level 3 categories have no children
        return BulkCategoryResponse(categories=[], total=0)
    
    child_level = category.level + 1
    children = await cat_repo.get_categories_by_level(
        session,
        level=child_level,
        parent_id=category.id,
        active_only=active_only,
    )
    
    return BulkCategoryResponse(
        categories=[CategoryResponse(**c.__dict__) for c in children],
        total=len(children)
    )


# ── Category statistics ───────────────────────────────────────────────────────

@router.get("/{category_id}/stats", response_model=CategoryStatsResponse)
async def get_category_stats(
    category_id: str,
    session: AsyncSession = Depends(get_session),
) -> CategoryStatsResponse:
    """
    Get statistics for a category.
    
    Returns:
    - **listing_count**: Active listings directly in this category
    - **listing_count_with_descendants**: Active listings in this category and all child categories
    
    - **category_id**: UUID or slug of the category
    """
    try:
        cat_uuid = uuid.UUID(category_id)
        category = await cat_repo.get_category_by_id(session, cat_uuid)
    except ValueError:
        category = await cat_repo.get_category_by_slug(session, category_id)
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{category_id}' not found"
        )
    
    direct_count = await cat_repo.count_listings_by_category(
        session, category.id, include_descendants=False
    )
    total_count = await cat_repo.count_listings_by_category(
        session, category.id, include_descendants=True
    )
    
    return CategoryStatsResponse(
        category_id=category.id,
        listing_count=direct_count,
        listing_count_with_descendants=total_count,
    )


# ── Validation ────────────────────────────────────────────────────────────────

@router.post("/validate-hierarchy", response_model=ValidateCategoryHierarchyResponse)
async def validate_category_hierarchy(
    body: ValidateCategoryHierarchyRequest,
    session: AsyncSession = Depends(get_session),
) -> ValidateCategoryHierarchyResponse:
    """
    Validate that category/subcategory/child_category form a valid hierarchy.
    
    Use this before creating or updating a listing to ensure the category selection is valid.
    
    - **category_id**: Top-level category (level 1)
    - **subcategory_id**: Subcategory (level 2, must be child of category)
    - **child_category_id**: Child category (level 3, must be child of subcategory)
    """
    is_valid, error = await cat_repo.validate_category_hierarchy(
        session,
        category_id=body.category_id,
        subcategory_id=body.subcategory_id,
        child_category_id=body.child_category_id,
    )
    
    return ValidateCategoryHierarchyResponse(
        valid=is_valid,
        error=error,
    )


@router.post("/validate-attributes", response_model=ValidateAttributesResponse)
async def validate_listing_attributes(
    body: ValidateAttributesRequest,
    session: AsyncSession = Depends(get_session),
) -> ValidateAttributesResponse:
    """
    Validate listing attributes against category schema.
    
    Checks:
    - Required attributes are present
    - Attribute types match schema
    - Values pass validation rules
    - Select/multiselect options are valid
    
    Use this before creating or updating a listing to catch validation errors early.
    """
    # Get the most specific category (child > subcategory > category)
    target_category_id = (
        body.child_category_id or body.subcategory_id or body.category_id
    )
    
    # Get category attributes
    attributes_schema = await cat_repo.get_category_attributes(session, target_category_id)
    
    errors: list[AttributeValidationError] = []
    missing_required: list[str] = []
    
    # Check required attributes
    for attr in attributes_schema:
        if attr.required and attr.slug not in body.attributes:
            missing_required.append(attr.name)
    
    # Validate each provided attribute
    for slug, value in body.attributes.items():
        # Find matching schema
        attr_schema = next((a for a in attributes_schema if a.slug == slug), None)
        if not attr_schema:
            errors.append(
                AttributeValidationError(
                    attribute=slug,
                    error=f"Unknown attribute '{slug}' for this category"
                )
            )
            continue
        
        # Type validation
        if attr_schema.type == "number":
            if not isinstance(value, (int, float)):
                errors.append(
                    AttributeValidationError(
                        attribute=slug,
                        error=f"Expected number, got {type(value).__name__}"
                    )
                )
        elif attr_schema.type == "boolean":
            if not isinstance(value, bool):
                errors.append(
                    AttributeValidationError(
                        attribute=slug,
                        error=f"Expected boolean, got {type(value).__name__}"
                    )
                )
        elif attr_schema.type in ("select", "multiselect"):
            # Check if value is in options
            if attr_schema.options and "options" in attr_schema.options:
                valid_options = attr_schema.options["options"]
                if attr_schema.type == "multiselect":
                    if not isinstance(value, list):
                        errors.append(
                            AttributeValidationError(
                                attribute=slug,
                                error="Expected list for multiselect"
                            )
                        )
                    elif not all(v in valid_options for v in value):
                        errors.append(
                            AttributeValidationError(
                                attribute=slug,
                                error=f"Invalid options. Valid: {valid_options}"
                            )
                        )
                else:
                    if value not in valid_options:
                        errors.append(
                            AttributeValidationError(
                                attribute=slug,
                                error=f"Invalid option. Valid: {valid_options}"
                            )
                        )
        
        # Validation rules
        if attr_schema.validation_rules:
            rules = attr_schema.validation_rules
            if "min" in rules and isinstance(value, (int, float)):
                if value < rules["min"]:
                    errors.append(
                        AttributeValidationError(
                            attribute=slug,
                            error=f"Value must be at least {rules['min']}"
                        )
                    )
            if "max" in rules and isinstance(value, (int, float)):
                if value > rules["max"]:
                    errors.append(
                        AttributeValidationError(
                            attribute=slug,
                            error=f"Value must be at most {rules['max']}"
                        )
                    )
            if "minLength" in rules and isinstance(value, str):
                if len(value) < rules["minLength"]:
                    errors.append(
                        AttributeValidationError(
                            attribute=slug,
                            error=f"Must be at least {rules['minLength']} characters"
                        )
                    )
            if "maxLength" in rules and isinstance(value, str):
                if len(value) > rules["maxLength"]:
                    errors.append(
                        AttributeValidationError(
                            attribute=slug,
                            error=f"Must be at most {rules['maxLength']} characters"
                        )
                    )
            if "pattern" in rules and isinstance(value, str):
                import re
                if not re.match(rules["pattern"], value):
                    errors.append(
                        AttributeValidationError(
                            attribute=slug,
                            error=f"Does not match required pattern"
                        )
                    )
    
    is_valid = len(errors) == 0 and len(missing_required) == 0
    
    return ValidateAttributesResponse(
        valid=is_valid,
        errors=errors,
        missing_required=missing_required,
    )
