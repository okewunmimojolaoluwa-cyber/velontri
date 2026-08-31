"""
Fix all remaining icon names leaked into text content.
Handles JSX text nodes, button labels, comments, span text, etc.
"""
import os
import re

src = r"C:\Users\USER PC\Desktop\velontri\frontend\src"

# All substitutions: old -> new
# These are ONLY text content fixes (not component names/imports)
subs = [
    # ── Button text / span content ──
    (r'} MagnifyingGlass\n',          '} Search\n'),
    (r'>\s*MagnifyingGlass\s*</',     '>Search</'),
    (r'>\s*MagnifyingGlass\s*$',      '>Search'),
    # Inline button text after icon: <MagnifyingGlass .../> MagnifyingGlass
    (r'/> MagnifyingGlass',           '/> Search'),
    # JSX comment text
    (r'{/\* MagnifyingGlass \*/}',    '{/* Search */}'),
    (r'{/\* MagnifyingGlass header',  '{/* Search header'),
    (r'{/\* MagnifyingGlass \*/',     '{/* Search */'),
    # HTML comments
    (r'/* MagnifyingGlass */',        '/* Search */'),
    (r'/* MagnifyingGlass ',          '/* Search '),
    # String literals in arrays/objects
    (r"'AI MagnifyingGlass'",         "'AI Search'"),
    (r'"AI MagnifyingGlass"',         '"AI Search"'),
    (r'label: \'MagnifyingGlass\'',   "label: 'Search'"),
    (r'label: "MagnifyingGlass"',     'label: "Search"'),
    # Inline text in JSX (after >)
    (r'>AI MagnifyingGlass<',        '>AI Search<'),
    (r'>AI-Powered MagnifyingGlass<', '>AI-Powered Search<'),
    (r'>MagnifyingGlass like',        '>Search like'),
    (r'>Try AI MagnifyingGlass<',    '>Try AI Search<'),
    (r'>MagnifyingGlass</',          '>Search</'),
    # Specific patterns from the codebase
    ('AI MagnifyingGlass',            'AI Search'),
    ('AI-Powered MagnifyingGlass',    'AI-Powered Search'),
    ('MagnifyingGlass like',          'Search like'),
    ('Try AI MagnifyingGlass',        'Try AI Search'),
    # Footer link label
    ("{ label: 'AI MagnifyingGlass'", "{ label: 'AI Search'"),
    # Button / submit text nodes
    (r'>\s*MagnifyingGlass\s*\n',    '>Search\n'),
    # Inline after icon component
    ('} MagnifyingGlass',            '} Search'),
    # Span text
    ('>MagnifyingGlass\n',           '>Search\n'),
    # Comment in JSX
    ('/* MagnifyingGlass */',        '/* Search */'),
    # After closing tag on same line
    ('</> MagnifyingGlass',          '</> Search'),
    # Direct text: MagnifyingGlass\n (alone on line in JSX)
]

modified = 0
for root, dirs, files in os.walk(src):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '.git')]
    for fname in files:
        if not (fname.endswith('.tsx') or fname.endswith('.ts')):
            continue
        path = os.path.join(root, fname)
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        original = content

        # Apply direct replacements first
        for old, new in subs:
            content = content.replace(old, new)

        # Then regex-based: any MagnifyingGlass that is NOT preceded by < or { (import/JSX tag)
        # and not followed by alphanumeric (not part of className or variable)
        # Pattern: MagnifyingGlass as standalone text node value
        # Match: "MagnifyingGlass" when it appears as button/span text only
        # Safe approach: replace in button text patterns
        
        # Pattern 1: >MagnifyingGlass< (text node between tags)
        content = re.sub(r'(?<=>)MagnifyingGlass(?=<)', 'Search', content)
        
        # Pattern 2: MagnifyingGlass\n inside JSX (indented text on its own line)
        content = re.sub(r'^(\s+)MagnifyingGlass\s*$', r'\1Search', content, flags=re.MULTILINE)
        
        # Pattern 3: /> MagnifyingGlass (after self-closing tag, space, then text)
        content = re.sub(r'(/>\s+)MagnifyingGlass(?=\s)', r'\1Search', content)

        if content != original:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            modified += 1
            print(f"  {fname}")

print(f"\nDone. Modified {modified} files.")
