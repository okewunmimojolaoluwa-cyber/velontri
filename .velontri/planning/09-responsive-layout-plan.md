# Velontri Responsive Layout Plan

## Breakpoint Strategy

### Breakpoint Definitions

```typescript
const breakpoints = {
  xs: '0px',      // Mobile phones (portrait)
  sm: '640px',    // Mobile phones (landscape)
  md: '768px',    // Tablets (portrait)
  lg: '1024px',   // Tablets (landscape) / Small laptops
  xl: '1280px',   // Desktops
  '2xl': '1536px', // Large desktops
};
```

### Target Devices

| Breakpoint | Device Range | Typical Devices |
|-------------|-------------|-----------------|
| xs | 0-639px | iPhone SE, Galaxy S, small phones |
| sm | 640-767px | iPhone 12 Pro, Galaxy S21, large phones |
| md | 768-1023px | iPad, iPad Mini, tablets |
| lg | 1024-1279px | iPad Pro, small laptops |
| xl | 1280-1535px | Desktops, laptops |
| 2xl | 1536px+ | Large desktops, 4K monitors |

---

## User Dashboard Responsive Layout

### Desktop Layout (xl+)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (64px)                                                  │
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│  Sidebar (280px) │  Main Content (calc)                         │
│  (Fixed)         │  (Scrollable)                                 │
│                  │                                              │
│                  │                                              │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

**Specifications:**
- Sidebar: 280px fixed width, full height
- Header: 64px height, full width
- Main content: Remaining width, scrollable
- Content max-width: 1400px centered

### Tablet Layout (lg)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (64px)                                                  │
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│  Sidebar (240px) │  Main Content (calc)                         │
│  (Fixed)         │  (Scrollable)                                 │
│                  │                                              │
│                  │                                              │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

**Specifications:**
- Sidebar: 240px fixed width, collapsible
- Header: 64px height, full width
- Main content: Remaining width, scrollable
- Content max-width: 1200px centered

### Tablet Layout (md)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (64px)                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Main Content (100% width, scrollable)                          │
│                                                                  │
│  [Hamburger Menu] (top-left, toggles sidebar overlay)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

[Sidebar Overlay] (when opened)
┌──────────────────┐
│  Sidebar (280px) │
│  (Overlay)       │
│                  │
└──────────────────┘
```

**Specifications:**
- Sidebar: 280px width, overlay mode
- Header: 64px height, with hamburger menu
- Main content: 100% width, scrollable
- Sidebar: Slide-in from left, backdrop blur

### Mobile Layout (sm)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (56px)                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Main Content (100% width, scrollable)                          │
│                                                                  │
│                                                                  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Bottom Nav (64px)                                               │
│  [Home] [Saved] [SELL] [Messages] [Dashboard]                   │
└─────────────────────────────────────────────────────────────────┘
```

**Specifications:**
- Header: 56px height, simplified
- Bottom Nav: 64px height, fixed at bottom
- Main content: 100% width, scrollable
- SELL button: Floating, elevated above nav
- Safe area: Account for device notches/home indicator

### Small Mobile Layout (xs)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (56px)                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Main Content (100% width, scrollable)                          │
│  (Compact spacing, smaller fonts)                                │
│                                                                  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Bottom Nav (64px)                                               │
│  [Home] [Saved] [SELL] [Messages] [Dashboard]                   │
└─────────────────────────────────────────────────────────────────┘
```

**Specifications:**
- Header: 56px height, minimal
- Bottom Nav: 64px height, icons only (no labels)
- Main content: 100% width, compact spacing
- Font sizes: 10-12px for body text
- Touch targets: Minimum 44x44px

---

## Moderator Dashboard Responsive Layout

### Desktop Layout (xl+)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (64px)                                                  │
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│  Sidebar (280px) │  Main Content (calc)                         │
│  (Fixed)         │  (Scrollable)                                 │
│                  │                                              │
│                  │                                              │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

**Specifications:**
- Sidebar: 280px fixed width, full height
- Header: 64px height, full width
- Main content: Remaining width, scrollable
- Content max-width: 1400px centered
- Badge indicators: Always visible

### Tablet Layout (md-lg)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (64px)                                                  │
├─────────────────────────────────────────────────────────────────┤
│  [Tab Navigation] (horizontal scroll)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Main Content (100% width, scrollable)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Specifications:**
- Header: 64px height, with hamburger menu
- Tab Nav: 48px height, horizontal scroll
- Main content: 100% width, scrollable
- Sidebar: Hidden, accessible via hamburger menu

### Mobile Layout (sm-xs)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (56px)                                                  │
├─────────────────────────────────────────────────────────────────┤
│  [Tab Navigation] (horizontal scroll)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Main Content (100% width, scrollable)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Specifications:**
- Header: 56px height, simplified
- Tab Nav: 48px height, horizontal scroll
- Main content: 100% width, scrollable
- Cards: Single column layout
- Actions: Bottom sheet for review actions

---

## Super Admin Dashboard Responsive Layout

### Desktop Layout (xl+)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (64px)                                                  │
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│  Sidebar (320px) │  Main Content (calc)                         │
│  (Fixed)         │  (Scrollable)                                 │
│                  │                                              │
│                  │                                              │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

**Specifications:**
- Sidebar: 320px fixed width (wider for admin menu)
- Header: 64px height, full width
- Main content: Remaining width, scrollable
- Content max-width: 1600px centered
- KPI Cards: 4 columns on desktop

### Tablet Layout (lg)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (64px)                                                  │
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│  Sidebar (280px) │  Main Content (calc)                         │
│  (Fixed)         │  (Scrollable)                                 │
│                  │                                              │
│                  │                                              │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

**Specifications:**
- Sidebar: 280px fixed width, collapsible
- Header: 64px height, full width
- Main content: Remaining width, scrollable
- KPI Cards: 2 columns on tablet
- Charts: Full width, stacked

### Tablet Layout (md)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (64px)                                                  │
├─────────────────────────────────────────────────────────────────┤
│  [Hamburger Menu]                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Main Content (100% width, scrollable)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Specifications:**
- Sidebar: 320px width, overlay mode
- Header: 64px height, with hamburger menu
- Main content: 100% width, scrollable
- KPI Cards: 2 columns
- Charts: Full width

### Mobile Layout (sm-xs)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (56px)                                                  │
├─────────────────────────────────────────────────────────────────┤
│  [Hamburger Menu]                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Main Content (100% width, scrollable)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Specifications:**
- Header: 56px height, simplified
- Sidebar: 320px width, overlay mode
- Main content: 100% width, scrollable
- KPI Cards: 1 column, stacked
- Charts: Full width, simplified
- Tables: Horizontal scroll

---

## Component-Specific Responsive Behavior

### Navigation Components

#### User Sidebar
```
xl+: Fixed, 280px width, always visible
lg: Fixed, 240px width, collapsible
md: Overlay, 280px width, slide-in
sm-xs: Hidden, accessible via hamburger menu
```

#### Bottom Navigation (User Only)
```
xl-lg: Hidden
md: Hidden
sm-xs: Fixed at bottom, 64px height
```

#### Moderator Tab Navigation
```
xl+: Hidden (use sidebar)
lg: Horizontal scroll, 48px height
md-sm-xs: Horizontal scroll, 48px height
```

#### Admin Sidebar
```
xl+: Fixed, 320px width, always visible
lg: Fixed, 280px width, collapsible
md-sm-xs: Overlay, 320px width, slide-in
```

### Card Components

#### Stats Cards
```
xl+: 4 columns (grid-cols-4)
lg: 3 columns (grid-cols-3)
md: 2 columns (grid-cols-2)
sm-xs: 1 column (grid-cols-1)
```

#### Listing Cards
```
xl+: 4 columns (grid-cols-4)
lg: 3 columns (grid-cols-3)
md: 2 columns (grid-cols-2)
sm: 2 columns (grid-cols-2)
xs: 1 column (grid-cols-1)
```

#### Transaction Items
```
xl-lg: Table view
md: Table view
sm-xs: Card view (stacked)
```

### Chart Components

#### Revenue Chart
```
xl+: Full width, 800px height
lg: Full width, 600px height
md: Full width, 400px height
sm-xs: Full width, 300px height
```

#### Activity Chart
```
xl+: Full width, 400px height
lg: Full width, 350px height
md: Full width, 300px height
sm-xs: Full width, 250px height
```

### Form Components

#### Listing Wizard
```
xl-lg: Multi-column layout, side-by-side steps
md: Single column, stacked steps
sm-xs: Single column, full-width inputs
```

#### Profile Form
```
xl-lg: 2 columns, avatar on left
md: 2 columns, avatar on top
sm-xs: 1 column, full-width
```

---

## Typography Scale by Breakpoint

### Font Sizes

| Element | xs | sm | md | lg | xl | 2xl |
|---------|----|----|----|----|----|-----|
| Display | 32px | 36px | 40px | 48px | 56px | 64px |
| H1 | 24px | 28px | 30px | 36px | 40px | 48px |
| H2 | 20px | 22px | 24px | 30px | 32px | 36px |
| H3 | 18px | 20px | 22px | 24px | 26px | 28px |
| H4 | 16px | 18px | 20px | 22px | 24px | 24px |
| Body | 14px | 15px | 16px | 16px | 16px | 16px |
| Small | 12px | 13px | 14px | 14px | 14px | 14px |
| XSmall | 10px | 11px | 12px | 12px | 12px | 12px |

### Line Heights

| Element | xs | sm | md | lg | xl | 2xl |
|---------|----|----|----|----|----|-----|
| Display | 1.1 | 1.1 | 1.1 | 1.1 | 1.1 | 1.1 |
| Headings | 1.2 | 1.2 | 1.2 | 1.2 | 1.2 | 1.2 |
| Body | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 |
| Small | 1.4 | 1.4 | 1.4 | 1.4 | 1.4 | 1.4 |

---

## Spacing Scale by Breakpoint

### Padding/Margins

| Size | xs | sm | md | lg | xl | 2xl |
|------|----|----|----|----|----|-----|
| xs | 4px | 4px | 4px | 4px | 4px | 4px |
| sm | 8px | 8px | 8px | 8px | 8px | 8px |
| md | 12px | 12px | 16px | 16px | 16px | 16px |
| lg | 16px | 16px | 24px | 24px | 24px | 24px |
| xl | 20px | 24px | 32px | 32px | 32px | 32px |
| 2xl | 24px | 32px | 48px | 48px | 48px | 48px |

### Container Padding

| Breakpoint | Container Padding |
|-----------|------------------|
| xs | 16px |
| sm | 20px |
| md | 24px |
| lg | 32px |
| xl | 32px |
| 2xl | 48px |

---

## Touch Target Sizes

### Minimum Touch Targets

| Element | Minimum Size | Recommended Size |
|---------|-------------|-----------------|
| Buttons | 44x44px | 48x48px |
| Links | 44x44px | 48x48px |
| Checkboxes | 44x44px | 48x48px |
| Radio Buttons | 44x44px | 48x48px |
| Form Inputs | 44px height | 48px height |
| Navigation Items | 44x44px | 48x48px |

### Spacing Between Touch Targets

- Minimum: 8px
- Recommended: 12px
- Optimal: 16px

---

## Image Responsive Behavior

### Listing Images

```
xl+: 400x400px (grid)
lg: 350x350px (grid)
md: 300x300px (grid)
sm: 250x250px (grid)
xs: 200x200px (grid)
```

### Profile Images

```
xl-lg: 120x120px
md: 100x100px
sm-xs: 80x80px
```

### Store Logos

```
xl+: 200x200px
lg: 180x180px
md: 160x160px
sm-xs: 140x140px
```

---

## Safe Area Handling

### Notch-Aware Design

```css
/* iPhone notch */
@supports (padding-top: env(safe-area-inset-top)) {
  .header {
    padding-top: env(safe-area-inset-top);
  }
}

/* Home indicator */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .bottom-nav {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

### Device-Specific Adjustments

```css
/* iPhone SE (small screen) */
@media (max-width: 375px) {
  .container {
    padding: 12px;
  }
}

/* iPhone 14 Pro Max (large screen) */
@media (min-width: 430px) {
  .container {
    padding: 20px;
  }
}
```

---

## Performance Optimization

### Lazy Loading

```typescript
// Lazy load heavy components by breakpoint
const UserActivityChart = lazy(() => import('./UserActivityChart'));
const AdminRevenueChart = lazy(() => import('./AdminRevenueChart'));

// Only load charts on larger screens
const ResponsiveChart = () => {
  const isLargeScreen = useMediaQuery('(min-width: 1024px)');
  
  if (!isLargeScreen) {
    return <ChartPlaceholder />;
  }
  
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <UserActivityChart />
    </Suspense>
  );
};
```

### Image Optimization

```typescript
// Responsive images with Next/Image
<Image
  src="/listing-image.jpg"
  alt="Listing"
  width={800}
  height={800}
  sizes="(max-width: 640px) 200px, (max-width: 1024px) 300px, 400px"
  loading="lazy"
/>
```

### Virtual Scrolling

```typescript
// Virtual scrolling for long lists on mobile
import { useVirtualizer } from '@tanstack/react-virtual';

const VirtualizedList = ({ items }) => {
  const parentRef = useRef();
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });
  
  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      {virtualizer.getVirtualItems().map(item => (
        <div key={item.key} style={{ height: item.size }}>
          {items[item.index]}
        </div>
      ))}
    </div>
  );
};
```

---

## Accessibility Considerations

### Keyboard Navigation

- All interactive elements keyboard accessible
- Tab order follows visual layout
- Focus indicators visible on all breakpoints
- Skip to content link on mobile

### Screen Reader Support

- Proper ARIA labels on all breakpoints
- Live regions for dynamic content
- Semantic HTML maintained
- Alt text for all images

### Color Contrast

- Minimum 4.5:1 contrast ratio for text
- Minimum 3:1 contrast ratio for large text
- Tested on all breakpoints
- Dark mode support

---

## Testing Strategy

### Breakpoint Testing

- Test on all defined breakpoints
- Use Chrome DevTools device emulation
- Test on real devices when possible
- Test orientation changes

### Responsive Testing Checklist

- [ ] Navigation works on all breakpoints
- [ ] Cards stack correctly on mobile
- [ ] Tables scroll horizontally on mobile
- [ ] Forms are usable on mobile
- [ ] Touch targets meet minimum size
- [ ] Images load appropriately
- [ ] Text remains readable
- [ ] No horizontal scroll on body
- [ ] Safe areas respected
- [ ] Performance acceptable on mobile

---

## Implementation Priority

### Phase 1: Core Layouts (High Priority)
1. User Dashboard responsive layout
2. Moderator Dashboard responsive layout
3. Super Admin Dashboard responsive layout

### Phase 2: Navigation (High Priority)
1. User Sidebar responsive behavior
2. User Bottom Nav mobile implementation
3. Moderator Tab Navigation
4. Admin Sidebar responsive behavior

### Phase 3: Components (Medium Priority)
1. Stats Cards responsive grid
2. Listing Cards responsive grid
3. Chart components responsive sizing
4. Table components responsive behavior

### Phase 4: Optimization (Medium Priority)
1. Lazy loading implementation
2. Image optimization
3. Virtual scrolling for long lists
4. Performance monitoring

### Phase 5: Polish (Low Priority)
1. Animation adjustments per breakpoint
2. Safe area refinements
3. Touch target optimization
4. Accessibility improvements
