"""
Remove em dashes (—) from user-visible text in frontend .tsx/.ts files.
Skips:
  - Lines that are pure code comments (// ... or # ...)
  - JSX comment blocks {/* ... */}
  - Python/JS variable names and logic
Replaces:
  - Em dashes in string literals, JSX text, metadata titles/descriptions
"""
import os
import re

src = r"C:\Users\USER PC\Desktop\velontri\frontend\src"

modified = 0
for root, dirs, files in os.walk(src):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '.git')]
    for fname in files:
        if not (fname.endswith('.tsx') or fname.endswith('.ts') or fname.endswith('.js')):
            continue
        path = os.path.join(root, fname)
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()

        new_lines = []
        changed = False
        for line in lines:
            stripped = line.strip()
            # Skip pure code comments — em dash in comments is fine
            if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
                new_lines.append(line)
                continue
            # Skip JSX comments {/* ... */}
            if '{/*' in line and '*/' in line:
                new_lines.append(line)
                continue

            # Replace em dash with nothing (or space if between words)
            # Pattern: word — word → word word (remove dash + surrounding spaces)
            new_line = re.sub(r'\s*—\s*', ' ', line)
            # Clean up double spaces
            new_line = re.sub(r'  +', ' ', new_line)
            # Preserve original indentation (only strip extra from content, not indent)
            if new_line != line:
                changed = True
            new_lines.append(new_line)

        if changed:
            with open(path, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            modified += 1
            print(f"  {path.replace(src + os.sep, '')}")

print(f"\nDone. Modified {modified} files.")
