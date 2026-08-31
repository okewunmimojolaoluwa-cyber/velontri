import os

src = r"C:\Users\USER PC\Desktop\velontri\frontend\src"

# Direct string substitutions — fix icon names leaked into text content
subs = [
    # Placeholder attributes — most common issue
    ('placeholder="MagnifyingGlass ', 'placeholder="Search '),
    ('placeholder="MagnifyingGlass…', 'placeholder="Search…'),
    ("placeholder='MagnifyingGlass ", "placeholder='Search "),
    # Button / span text nodes
    ('>MagnifyingGlass</', '>Search</'),
    ('>MagnifyingGlass </','> Search </'),
    # Specific strings from the build
    ('MagnifyingGlass Velontri', 'Search Velontri'),
    ('MagnifyingGlass failed', 'Search failed'),
    ('MagnifyingGlass bar */', 'Search bar */'),
    ('/* MagnifyingGlass bar', '/* Search bar'),
    ('Search bar */', 'Search bar */'),  # idempotent
    # aria-label and title
    ('aria-label="MagnifyingGlass"', 'aria-label="Search"'),
    ('title="MagnifyingGlass"', 'title="Search"'),
    # Other icon names that leaked into display text
    ('>Storefront</', '>Store</'),
    ('>FloppyDisk</', '>Save</'),
    ('>SignOut</', '>Sign out</'),
    ('>SignIn</', '>Sign in</'),
    ('>PaperPlaneRight</', '>Send</'),
    ('>ArrowClockwise</', '>Refresh</'),
    ('>SquaresFour</', '>Grid</'),
    ('>SealCheck</', '>Verified</'),
    ('>ChatCircle</', '>Messages</'),
    ('>BookmarkSimple</', '>Bookmark</'),
    ('>ShareNetwork</', '>Share</'),
    ('>DownloadSimple</', '>Download</'),
    ('>UploadSimple</', '>Upload</'),
    ('>Funnel</', '>Filter</'),
    ('>CircleNotch</', '>Loading</'),
    # span with icon name as text label
    ('>MagnifyingGlass', '>Search'),
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
        for old, new in subs:
            content = content.replace(old, new)
        if content != original:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            modified += 1
            print(f"  {fname}: {path.replace(src, '')}")
print(f"\nDone. Modified {modified} files.")
