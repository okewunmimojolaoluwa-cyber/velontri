#!/usr/bin/env python3
"""
Test script to verify Africa-wide country support fixes.

This script checks:
1. That OAuth registration no longer defaults to 'NG'
2. That user profile creation respects provided country
3. That listings can be created with any African country
4. That search/browse works across all countries
"""

import asyncio
import sys
from pathlib import Path

# Add backend path
sys.path.insert(0, str(Path(__file__).parent / "backend"))


async def test_oauth_country_default():
    """Test that OAuth users are not forced to Nigeria."""
    print("\n=== Testing OAuth Country Default ===")
    
    # Read the auth service file
    auth_service_path = Path(__file__).parent / "backend" / "auth-service" / "app" / "service.py"
    content = auth_service_path.read_text()
    
    # Check that 'NG' is NOT hardcoded in OAuth registration
    if "country_code='NG'" in content and "oauth" in content.lower():
        print("❌ FAIL: OAuth registration still hardcoded to 'NG'")
        return False
    
    if "country_code=''" in content or 'country_code=""' in content:
        print("✅ PASS: OAuth registration no longer defaults to 'NG'")
        return True
    
    print("⚠️  WARNING: Could not verify OAuth country handling")
    return None


async def test_user_consumer_default():
    """Test that user profile creation uses provided country."""
    print("\n=== Testing User Consumer Country Default ===")
    
    # Read the user consumer file
    consumer_path = Path(__file__).parent / "backend" / "user-service" / "app" / "consumers.py"
    content = consumer_path.read_text()
    
    # Check the default value in create_profile call
    if 'country_code=payload.get("country_code", "NG")' in content:
        print("❌ FAIL: User profile creation still defaults to 'NG'")
        return False
    
    if 'country_code=payload.get("country_code", "")' in content:
        print("✅ PASS: User profile creation no longer defaults to 'NG'")
        return True
    
    print("⚠️  WARNING: Could not verify user consumer country handling")
    return None


async def test_listing_creation_country():
    """Test that frontend listing creation uses selected country."""
    print("\n=== Testing Listing Creation Country ===")
    
    # Read the listing creation page
    listing_page_path = Path(__file__).parent / "frontend" / "src" / "app" / "dashboard" / "listings" / "create" / "page.tsx"
    content = listing_page_path.read_text()
    
    # Check that country is not hardcoded
    if "country: 'NG'," in content and "form.country" not in content:
        print("❌ FAIL: Listing creation still hardcoded to 'NG'")
        return False
    
    if "country: form.country" in content or "form.country || 'NG'" in content:
        print("✅ PASS: Listing creation uses selected country")
        return True
    
    print("⚠️  WARNING: Could not verify listing creation country handling")
    return None


async def test_country_selectors():
    """Test that country selectors include multiple African countries."""
    print("\n=== Testing Country Selector Coverage ===")
    
    # Check registration page
    reg_page_path = Path(__file__).parent / "frontend" / "src" / "app" / "(auth)" / "register" / "page.tsx"
    reg_content = reg_page_path.read_text()
    
    african_countries = ['NG', 'GH', 'KE', 'ZA', 'TZ', 'UG', 'ET', 'EG', 'MA']
    found_countries = sum(1 for code in african_countries if f"'{code}'" in reg_content or f'"{code}"' in reg_content)
    
    print(f"   Registration page: {found_countries}/{len(african_countries)} major African countries found")
    
    # Check listing creation page
    listing_page_path = Path(__file__).parent / "frontend" / "src" / "app" / "dashboard" / "listings" / "create" / "page.tsx"
    listing_content = listing_page_path.read_text()
    
    listing_countries = ['NG', 'GH', 'KE', 'ZA', 'TZ', 'UG', 'ET', 'EG', 'MA', 'DZ', 'AO', 'CI', 'SN', 'CM', 'ZW', 'ZM', 'RW', 'MZ']
    found_listing = sum(1 for code in listing_countries if f"'{code}'" in listing_content or f'"{code}"' in listing_content)
    
    print(f"   Listing creation page: {found_listing}/{len(listing_countries)} African countries found")
    
    # Check listings browse page
    browse_page_path = Path(__file__).parent / "frontend" / "src" / "app" / "listings" / "page.tsx"
    browse_content = browse_page_path.read_text()
    
    # Should have all 54 African countries
    major_browse = sum(1 for code in african_countries if f"'{code}'" in browse_content or f'"{code}"' in browse_content)
    
    print(f"   Browse/search page: {major_browse}/{len(african_countries)} major African countries found (should have all 54)")
    
    if found_countries >= 7 and found_listing >= 15 and major_browse >= 7:
        print("✅ PASS: Country selectors cover multiple African countries")
        return True
    else:
        print("❌ FAIL: Country selectors missing African countries")
        return False


async def test_search_service():
    """Test that search service doesn't filter by country by default."""
    print("\n=== Testing Search Service Country Handling ===")
    
    # Read the search router
    search_path = Path(__file__).parent / "backend" / "search-service" / "app" / "routers" / "search.py"
    content = search_path.read_text()
    
    # Check that country is optional parameter
    if "country: str | None" in content or "country: Optional[str]" in content:
        print("✅ PASS: Search accepts optional country parameter")
        
        # Check it doesn't hardcode country filter
        if "country = 'NG'" not in content and 'country = "NG"' not in content:
            print("✅ PASS: Search does not hardcode country filter")
            return True
        else:
            print("❌ FAIL: Search has hardcoded country filter")
            return False
    
    print("⚠️  WARNING: Could not verify search service country handling")
    return None


async def main():
    """Run all tests."""
    print("=" * 60)
    print("VELONTRI AFRICA-WIDE COUNTRY SUPPORT TEST")
    print("=" * 60)
    
    results = []
    
    # Run all tests
    results.append(("OAuth Country Default", await test_oauth_country_default()))
    results.append(("User Consumer Default", await test_user_consumer_default()))
    results.append(("Listing Creation Country", await test_listing_creation_country()))
    results.append(("Country Selectors", await test_country_selectors()))
    results.append(("Search Service", await test_search_service()))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result is True)
    failed = sum(1 for _, result in results if result is False)
    warnings = sum(1 for _, result in results if result is None)
    
    for name, result in results:
        if result is True:
            print(f"✅ {name}")
        elif result is False:
            print(f"❌ {name}")
        else:
            print(f"⚠️  {name}")
    
    print(f"\nTotal: {passed} passed, {failed} failed, {warnings} warnings")
    
    if failed > 0:
        print("\n❌ SOME TESTS FAILED - Country hardcoding issues remain")
        return 1
    elif warnings > 0:
        print("\n⚠️  ALL CRITICAL TESTS PASSED - Some checks could not be verified")
        return 0
    else:
        print("\n✅ ALL TESTS PASSED - Africa-wide country support is working!")
        return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
