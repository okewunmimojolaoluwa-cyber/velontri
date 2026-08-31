"""
Scan all .tsx/.ts files for duplicate names in a single import statement
and remove the duplicates.
"""
import os
import re

src = r"C:\Users\USER PC\Desktop\velontri\frontend\src"

IMPORT_RE = re.compile(
    r'(import\s*\{)([^}]+)(\}\s*from\s*[\'"]@phosphor-icons/react[\'"])',
    re.DOTALL,
)

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

        def dedup_import(m):
            prefix = m.group(1)
            body   = m.group(2)
            suffix = m.group(3)
            # Split by comma, strip whitespace
            tokens = [t.strip() for t in body.split(',') if t.strip()]
            # De-duplicate while preserving order
            seen = set()
            unique = []
            for t in tokens:
                # Key = just the exported name (handle "X as Y" aliases)
                key = t.split(' as ')[0].strip() if ' as ' in t else t
                if key not in seen:
                    seen.add(key)
                    unique.append(t)
                else:
                    print(f"  Removed duplicate: {t!r} in {path.replace(src, '')}")
            return prefix + ' ' + ', '.join(unique) + ' ' + suffix

        content = IMPORT_RE.sub(dedup_import, content)

        if content != original:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            modified += 1

print(f"\nFixed {modified} files")
