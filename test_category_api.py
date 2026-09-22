"""
Test script for Category API endpoints.

Tests all 12 category endpoints to verify Phase 2 implementation.

Usage:
    python test_category_api.py
"""
import requests
import json
from typing import Dict, Any


BASE_URL = "http://localhost:8001/api/v1"
HEADERS = {"Content-Type": "application/json"}


def print_test(name: str, passed: bool, details: str = "") -> None:
    """Print test result with formatting."""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {name}")
    if details:
        print(f"   {details}")


def test_list_categories() -> Dict[str, Any]:
    """Test GET /categories - List top-level categories."""
    print("\n🧪 Test 1: List Top-Level Categories")
    try:
        response = requests.get(f"{BASE_URL}/categories?level=1", timeout=5)
        passed = response.status_code == 200
        data = response.json() if passed else {}
        
        if passed and "categories" in data:
            count = len(data["categories"])
            print_test("List categories", True, f"Found {count} top-level categories")
            return data["categories"][0] if count > 0 else {}
        else:
            print_test("List categories", False, f"Status: {response.status_code}")
            return {}
    except Exception as e:
        print_test("List categories", False, str(e))
        return {}


def test_category_tree() -> None:
    """Test GET /categories/tree - Get nested tree."""
    print("\n🧪 Test 2: Get Category Tree")
    try:
        response = requests.get(
            f"{BASE_URL}/categories/tree?max_depth=2",
            timeout=5
        )
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                has_children = "children" in data[0]
                print_test(
                    "Category tree",
                    True,
                    f"Got {len(data)} categories, nested: {has_children}"
                )
            else:
                print_test("Category tree", False, "Empty response")
        else:
            print_test("Category tree", False, f"Status: {response.status_code}")
    except Exception as e:
        print_test("Category tree", False, str(e))


def test_popular_categories() -> None:
    """Test GET /categories/popular - Most popular categories."""
    print("\n🧪 Test 3: Get Popular Categories")
    try:
        response = requests.get(
            f"{BASE_URL}/categories/popular?level=1&limit=5",
            timeout=5
        )
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            if "categories" in data:
                count = len(data["categories"])
                print_test(
                    "Popular categories",
                    True,
                    f"Got {count} popular categories"
                )
            else:
                print_test("Popular categories", False, "Invalid response format")
        else:
            print_test("Popular categories", False, f"Status: {response.status_code}")
    except Exception as e:
        print_test("Popular categories", False, str(e))


def test_search_categories() -> None:
    """Test GET /categories?query= - Search categories."""
    print("\n🧪 Test 4: Search Categories")
    try:
        response = requests.get(
            f"{BASE_URL}/categories?query=vehicle",
            timeout=5
        )
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            if "categories" in data:
                count = len(data["categories"])
                print_test(
                    "Search categories",
                    True,
                    f"Found {count} results for 'vehicle'"
                )
            else:
                print_test("Search categories", False, "Invalid response")
        else:
            print_test("Search categories", False, f"Status: {response.status_code}")
    except Exception as e:
        print_test("Search categories", False, str(e))


def test_get_category(category_id: str) -> bool:
    """Test GET /categories/{id} - Get single category."""
    print("\n🧪 Test 5: Get Single Category")
    if not category_id:
        print_test("Get category", False, "No category ID provided")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/categories/{category_id}",
            timeout=5
        )
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            if "id" in data and "name" in data:
                print_test(
                    "Get category",
                    True,
                    f"Got category: {data['name']}"
                )
                return True
            else:
                print_test("Get category", False, "Invalid response format")
                return False
        else:
            print_test("Get category", False, f"Status: {response.status_code}")
            return False
    except Exception as e:
        print_test("Get category", False, str(e))
        return False


def test_get_category_with_attributes(category_id: str) -> None:
    """Test GET /categories/{id}/with-attributes."""
    print("\n🧪 Test 6: Get Category with Attributes")
    if not category_id:
        print_test("Get with attributes", False, "No category ID")
        return
    
    try:
        response = requests.get(
            f"{BASE_URL}/categories/{category_id}/with-attributes",
            timeout=5
        )
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            if "category" in data and "attributes" in data:
                attr_count = len(data["attributes"])
                print_test(
                    "Get with attributes",
                    True,
                    f"Got {attr_count} attributes"
                )
            else:
                print_test("Get with attributes", False, "Invalid response")
        else:
            print_test("Get with attributes", False, f"Status: {response.status_code}")
    except Exception as e:
        print_test("Get with attributes", False, str(e))


def test_get_category_attributes(category_id: str) -> None:
    """Test GET /categories/{id}/attributes."""
    print("\n🧪 Test 7: Get Category Attributes")
    if not category_id:
        print_test("Get attributes", False, "No category ID")
        return
    
    try:
        response = requests.get(
            f"{BASE_URL}/categories/{category_id}/attributes",
            timeout=5
        )
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            if isinstance(data, list):
                print_test(
                    "Get attributes",
                    True,
                    f"Got {len(data)} attributes"
                )
            else:
                print_test("Get attributes", False, "Invalid response")
        else:
            print_test("Get attributes", False, f"Status: {response.status_code}")
    except Exception as e:
        print_test("Get attributes", False, str(e))


def test_get_category_children(category_id: str) -> str:
    """Test GET /categories/{id}/children."""
    print("\n🧪 Test 8: Get Category Children")
    if not category_id:
        print_test("Get children", False, "No category ID")
        return ""
    
    try:
        response = requests.get(
            f"{BASE_URL}/categories/{category_id}/children",
            timeout=5
        )
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            if "categories" in data:
                count = len(data["categories"])
                print_test(
                    "Get children",
                    True,
                    f"Got {count} children"
                )
                return data["categories"][0]["id"] if count > 0 else ""
            else:
                print_test("Get children", False, "Invalid response")
                return ""
        else:
            print_test("Get children", False, f"Status: {response.status_code}")
            return ""
    except Exception as e:
        print_test("Get children", False, str(e))
        return ""


def test_get_category_stats(category_id: str) -> None:
    """Test GET /categories/{id}/stats."""
    print("\n🧪 Test 9: Get Category Statistics")
    if not category_id:
        print_test("Get stats", False, "No category ID")
        return
    
    try:
        response = requests.get(
            f"{BASE_URL}/categories/{category_id}/stats",
            timeout=5
        )
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            if "listing_count" in data:
                print_test(
                    "Get stats",
                    True,
                    f"Listings: {data['listing_count']}, " +
                    f"With descendants: {data.get('listing_count_with_descendants', 0)}"
                )
            else:
                print_test("Get stats", False, "Invalid response")
        else:
            print_test("Get stats", False, f"Status: {response.status_code}")
    except Exception as e:
        print_test("Get stats", False, str(e))


def test_validate_hierarchy(category_id: str, subcategory_id: str) -> None:
    """Test POST /categories/validate-hierarchy."""
    print("\n🧪 Test 10: Validate Category Hierarchy")
    if not category_id or not subcategory_id:
        print_test("Validate hierarchy", False, "Missing IDs")
        return
    
    try:
        payload = {
            "category_id": category_id,
            "subcategory_id": subcategory_id
        }
        response = requests.post(
            f"{BASE_URL}/categories/validate-hierarchy",
            headers=HEADERS,
            json=payload,
            timeout=5
        )
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            if "valid" in data:
                is_valid = data["valid"]
                error = data.get("error", "None")
                print_test(
                    "Validate hierarchy",
                    True,
                    f"Valid: {is_valid}, Error: {error}"
                )
            else:
                print_test("Validate hierarchy", False, "Invalid response")
        else:
            print_test("Validate hierarchy", False, f"Status: {response.status_code}")
    except Exception as e:
        print_test("Validate hierarchy", False, str(e))


def test_validate_attributes(category_id: str) -> None:
    """Test POST /categories/validate-attributes."""
    print("\n🧪 Test 11: Validate Listing Attributes")
    if not category_id:
        print_test("Validate attributes", False, "No category ID")
        return
    
    try:
        # Test with sample attributes
        payload = {
            "category_id": category_id,
            "attributes": {
                "test_field": "test_value"
            }
        }
        response = requests.post(
            f"{BASE_URL}/categories/validate-attributes",
            headers=HEADERS,
            json=payload,
            timeout=5
        )
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            if "valid" in data:
                is_valid = data["valid"]
                error_count = len(data.get("errors", []))
                missing = len(data.get("missing_required", []))
                print_test(
                    "Validate attributes",
                    True,
                    f"Valid: {is_valid}, Errors: {error_count}, Missing: {missing}"
                )
            else:
                print_test("Validate attributes", False, "Invalid response")
        else:
            print_test("Validate attributes", False, f"Status: {response.status_code}")
    except Exception as e:
        print_test("Validate attributes", False, str(e))


def test_health_check() -> bool:
    """Test if marketplace service is running."""
    print("\n🏥 Checking Marketplace Service Health...")
    try:
        response = requests.get(f"{BASE_URL.replace('/api/v1', '')}/health", timeout=5)
        passed = response.status_code == 200
        print_test("Service health", passed, "Service is running" if passed else "Service unavailable")
        return passed
    except Exception as e:
        print_test("Service health", False, f"Cannot reach service: {e}")
        return False


def main():
    """Run all category API tests."""
    print("=" * 60)
    print("🧪 Velontri Category API Test Suite")
    print("=" * 60)
    print("\nTesting Category System - Phase 2 Implementation")
    print(f"Base URL: {BASE_URL}")
    
    # Check service health first
    if not test_health_check():
        print("\n❌ Marketplace service is not running!")
        print("   Start it with: cd backend/marketplace-service && uvicorn app.main:app")
        return
    
    # Test 1: List categories (get a category ID for subsequent tests)
    first_category = test_list_categories()
    category_id = first_category.get("id", "")
    
    if not category_id:
        print("\n❌ No categories found! Run Phase 1 migration first:")
        print("   python backend/scripts/run_migration_direct.py backend/migrations/001_category_system.sql")
        print("   python backend/scripts/seed_categories.py")
        return
    
    # Test 2-4: Browsing endpoints
    test_category_tree()
    test_popular_categories()
    test_search_categories()
    
    # Test 5-9: Single category endpoints
    if test_get_category(category_id):
        test_get_category_with_attributes(category_id)
        test_get_category_attributes(category_id)
        subcategory_id = test_get_category_children(category_id)
        test_get_category_stats(category_id)
        
        # Test 10-11: Validation endpoints
        if subcategory_id:
            test_validate_hierarchy(category_id, subcategory_id)
        test_validate_attributes(category_id)
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ Test Suite Complete")
    print("=" * 60)
    print("\n📝 Next Steps:")
    print("   1. Review test results above")
    print("   2. Check Swagger docs: http://localhost:8001/docs")
    print("   3. Test creating a listing with categories")
    print("   4. Start Phase 3 (Frontend Integration)")


if __name__ == "__main__":
    main()
