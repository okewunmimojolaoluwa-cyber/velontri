import re

path = r"C:\Users\USER PC\Desktop\velontri\frontend\src\app\page.tsx"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the mobile 2x2 emoji card grid — replace with simple text stats
old = '''                {/* Mobile: 2×2 grid with card style */}
 <div className="grid grid-cols-2 gap-3 sm:hidden">
 {[
 { v: 'Growing', l: 'Community', accent: '#4F46E5', bg: '#eef2ff', emoji: '🏪' },
 { v: '12', l: 'Countries', accent: '#059669', bg: '#ecfdf5', emoji: '🌍' },
 { v: 'Free', l: 'To list', accent: '#0369A1', bg: '#e0f2fe', emoji: '✅' },
 { v: '100%', l: 'No commissions', accent: '#D97706', bg: '#fffbeb', emoji: '💰' },
 ].map(({ v, l, accent, bg, emoji }) => (
 <div key={l}
 className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-4 px-3 text-center"
 style={{ background: bg }}>
 <span className="text-[1.4rem]">{emoji}</span>
 <p className="font-black leading-none"
 style={{ fontSize: '1.5rem', letterSpacing: '-0.03em', color: accent }}>
 {v}
 </p>
 <p className="text-[11px] font-semibold uppercase tracking-[0.06em]"
 style={{ color: accent }}>
 {l}
 </p>
 </div>
 ))}
 </div>'''

new = '''                {/* Mobile: 2×2 stat grid — clean text, no emoji */}
 <div className="grid grid-cols-2 gap-3 sm:hidden">
 {[
 { v: 'Growing', l: 'Community', accent: '#4F46E5' },
 { v: '12', l: 'Countries', accent: '#059669' },
 { v: 'Free', l: 'To list', accent: '#0369A1' },
 { v: '0%', l: 'Commissions', accent: '#D97706' },
 ].map(({ v, l, accent }) => (
 <div key={l} className="rounded-xl border border-slate-100 bg-slate-50 py-4 px-3">
 <p className="font-black leading-none"
 style={{ fontSize: '1.5rem', letterSpacing: '-0.03em', color: accent }}>
 {v}
 </p>
 <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-1">{l}</p>
 </div>
 ))}
 </div>'''

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed mobile stats grid")
else:
    print("Pattern not found — skipping (may already be fixed)")
