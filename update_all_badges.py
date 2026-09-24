#!/usr/bin/env python3
"""
Update all Negotiable badge instances to use the new responsive design.
This ensures consistency across the entire application.
"""

import re
from pathlib import Path

# Badge patterns to update (listing cards)
LISTING_CARD_OLD = r'px-2 py-0\.5 text-\[10px\] font-bold text-emerald-700 whitespace-nowrap'
LISTING_CARD_NEW = r'px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 whitespace-nowrap leading-none flex-shrink-0'

# Detail page badge (keep slightly larger)
DETAIL_PAGE_OLD = r'px-2\.5 py-1 text-\[11px\] font-bold text-emerald-700 whitespace-nowrap'
DETAIL_PAGE_NEW = r'px-2 py-0.5 text-[10px] font-bold text-emerald-700 whitespace-nowrap leading-none flex-shrink-0'

def update_file(file_path: Path):
    """Update badge styling in a single file."""
    try:
        content = file_path.read_text(encoding='utf-8')
        original = content
        
        # Update listing card badges
        content = re.sub(LISTING_CARD_OLD, LISTING_CARD_NEW, content)
        
        # Update detail page badges
        content = re.sub(DETAIL_PAGE_OLD, DETAIL_PAGE_NEW, content)
        
        if content != original:
            file_path.write_text(content, encoding='utf-8')
            print(f"✅ Updated: {file_path}")
            return True
        return False
    except Exception as e:
        print(f"❌ Error updating {file_path}: {e}")
        return False

def main():
    """Find and update all files with Negotiable badges."""
    frontend_dir = Path(__file__).parent / 'frontend' / 'src'
    
    if not frontend_dir.exists():
        print(f"❌ Frontend directory not found: {frontend_dir}")
        return
    
    # Find all TSX files
    tsx_files = list(frontend_dir.rglob('*.tsx'))
    
    print(f"🔍 Scanning {len(tsx_files)} TSX files...")
    updated_count = 0
    
    for file_path in tsx_files:
        if update_file(file_path):
            updated_count += 1
    
    print(f"\n✅ Updated {updated_count} files")
    
    if updated_count == 0:
        print("ℹ️ No files needed updating (already up to date)")

if __name__ == '__main__':
    main()
