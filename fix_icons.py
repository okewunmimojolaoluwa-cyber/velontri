import os
import re

src = r"C:\Users\USER PC\Desktop\velontri\frontend\src"

# Map of bad names -> correct Phosphor v2 names
fixes = {
    "ClipboardList":     "ClipboardText",
    "ShieldOff":         "ShieldSlash",
    "UserCog":           "UserGear",
    "BarChart3":         "ChartBar",
    "ChatSquare":        "ChatTeardrop",
    "Activity":          "Pulse",
    "Inbox":             "Tray",
    "CheckCheck":        "ChecksFat",
    "MessageSquarePlus": "ChatCircleDots",
    "FileCheck":         "FileText",
    "PackageOpen":       "Package",
    # Additional
    "CheckCheck":        "Checks",   # Phosphor v2: Checks (not ChecksFat)
    # Additional ones that may still lurk
    "BarChart2":         "ChartBar",
    "LineChart":         "ChartLine",
    "PieChart":          "ChartPie",
    "ToggleRight":       "ToggleLeft",
    "WrenchIcon":        "Wrench",
    "LayoutTemplate":    "SquaresFour",
    "LayoutGrid":        "SquaresFour",
}

modified = 0
for root, dirs, files in os.walk(src):
    # Skip node_modules and .next
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '.git')]
    for fname in files:
        if not (fname.endswith('.tsx') or fname.endswith('.ts')):
            continue
        path = os.path.join(root, fname)
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        original = content
        for old, new in fixes.items():
            if old == new:
                continue
            # Word-boundary replacement
            content = re.sub(r'(?<![a-zA-Z0-9_])' + re.escape(old) + r'(?![a-zA-Z0-9_])', new, content)
        if content != original:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            modified += 1
            print(f"  Fixed: {path.replace(src, '')}")

print(f"\nTotal modified: {modified}")
