# Design System — נהל הכל

Hebrew-first personal management app. Mobile-only, RTL layout, installed as a PWA.  
Stack: React 19 + TailwindCSS v4 + Radix UI. All design tokens live in `src/styles.css`.

---

## Philosophy

- **Mobile-native feel** — every tap has physical feedback, no desktop hover states needed
- **Hebrew-first** — `dir="rtl"`, `lang="he"`, right-side chrome (timelines, borders, back chevrons)  
- **Emil Kowalski principles** — custom easing curves, press-scale feedback, stagger-entrance, overscroll prevention, reduced-motion respect
- **oklch color space** — all colors defined in oklch for perceptual uniformity and easy theming

---

## Color Tokens

All tokens are CSS custom properties set on `:root` in `src/styles.css`.

### Base palette

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.985 0.002 250)` | Page background (near-white blue tint) |
| `--foreground` | `oklch(0.24 0.012 260)` | Primary text |
| `--card` | `oklch(1 0 0)` | Card / surface background (pure white) |
| `--card-foreground` | `oklch(0.24 0.012 260)` | Text on cards |
| `--muted` | `oklch(0.96 0.004 250)` | Muted backgrounds (chips, inputs) |
| `--muted-foreground` | `oklch(0.55 0.012 260)` | Secondary / caption text |
| `--border` | `oklch(0.92 0.004 250)` | Borders and dividers |
| `--input` | `oklch(0.92 0.004 250)` | Input border color |

### Brand

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `oklch(0.58 0.15 250)` | Buttons, active states, dots, icons |
| `--primary-foreground` | `oklch(1 0 0)` | Text on primary backgrounds |
| `--primary-soft` | `oklch(0.95 0.025 250)` | Light primary tint for badges |
| `--ring` | `oklch(0.58 0.15 250)` | Focus ring |

### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--destructive` | `oklch(0.6 0.19 25)` | Errors, over-budget states |
| `--success` | `oklch(0.62 0.14 155)` | Confirmation banners |
| `--accent` | `oklch(0.95 0.008 250)` | Hover tints |

### Category colors

Each category has a dot class and a soft badge class (defined in `src/lib/queries.ts` via `getCat()`).

| Category | Token | oklch value | Soft class example |
|----------|-------|-------------|-------------------|
| Work | `--cat-work` | `oklch(0.58 0.15 250)` | `bg-primary/12 text-primary` |
| Family | `--cat-family` | `oklch(0.62 0.14 350)` | pink tint |
| Health | `--cat-health` | `oklch(0.6 0.12 165)` | green tint |
| Money | `--cat-money` | `oklch(0.68 0.13 70)` | amber tint |
| Shopping | `--cat-shopping` | `oklch(0.62 0.14 320)` | purple tint |

### Utility helpers in Tailwind classes

```
bg-primary/8     → very light primary wash (banners, hints)
bg-primary/12    → light primary wash (category soft badges)
border-primary/25 → subtle primary border
```

---

## Typography

Fonts are loaded from Google Fonts (set in `index.html` or root layout).

| Role | Font | Class / token |
|------|------|---------------|
| Body / UI | **Assistant** | `--font-sans`, applied to `body` |
| Headings (h1–h3) | **Heebo** | `--font-display`, auto-applied via `@layer base` |
| Heading style | Bold, `-0.02em` letter-spacing | Applied globally to `h1, h2, h3` |
| Eyebrow label | Assistant 600, 0.78rem | `@utility eyebrow` (`.eyebrow` class) |
| Monospace numbers | — | `tabular-nums` Tailwind class where needed |

### Type scale in use

| Use | Size | Weight | Class |
|-----|------|--------|-------|
| Page title | `text-2xl` | 700 | AppShell `<h1>` |
| Section heading | `text-lg` | 700 | `<h2>` |
| Card primary text | `text-sm` | 700 | Item titles |
| Card secondary | `text-xs` | 400 | Dates, labels |
| Eyebrow | `0.78rem` | 600 | `.eyebrow` |
| Large number | `text-4xl` / `text-3xl` | 700 | Budget figures |
| Badge text | `text-[10px]` / `text-[11px]` | 600 | Category chips |

---

## Radius

Base radius: `--radius: 1.1rem`

| Token | Value | Typical use |
|-------|-------|-------------|
| `--radius-sm` | `base - 4px` | Small chips |
| `--radius-md` | `base - 2px` | Medium elements |
| `--radius-lg` | `base` | Standard card radius |
| `--radius-xl` | `base + 4px` | — |
| `--radius-2xl` | `base + 8px` | List items (`rounded-2xl`) |
| `--radius-3xl` | `base + 12px` | Hero cards, budget card (`rounded-3xl`) |
| `--radius-4xl` | `base + 16px` | — |

**Rule:** Use `rounded-2xl` for list items and form fields, `rounded-3xl` for section cards, `rounded-full` for FABs and toggles.

---

## Shadows

| Token | Value | Use |
|-------|-------|-----|
| `--shadow-card` | `0 1px 2px oklch(0 0 0 / 4%), 0 8px 24px -18px oklch(0 0 0 / 22%)` | All `surface-card` elements |
| `--shadow-float` | `0 8px 24px -10px oklch(0 0 0 / 22%)` | FABs, floating buttons |

Applied via the `surface-card` utility class (see Components).

---

## Animation System

### Easing curves

All defined in `@theme inline` in `src/styles.css`:

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1)   /* snappy deceleration — most UI */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)  /* emphasized — modals, drawers */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)   /* bottom sheet slide */
```

In TSX files use the shorthand constant:
```ts
const ease = "cubic-bezier(0.23, 1, 0.32, 1)";
```

### Keyframes

```css
fade-up   — opacity 0→1, translateY 10px→0    (entrance animation)
fade-in   — opacity 0→1                        (simple fade)
grow-bar  — scaleX 0→1 (transformOrigin: left) (progress bars)
```

### Timing rules

| Element type | Duration | Easing |
|-------------|----------|--------|
| Button press (transform) | `160ms` | `--ease-out` |
| FAB press | `160ms` | `--ease-out` |
| Stagger list items | `320ms` per item | `--ease-out` |
| Section page entrance | `280–300ms` | `--ease-out` |
| Progress bar grow | `700ms` | `--ease-out` |
| Modal / drawer | `200–500ms` | `--ease-in-out` or `--ease-drawer` |
| Toggle switch | `150ms` | Tailwind default |

### Stagger delays

```css
child 1:  0ms
child 2:  50ms
child 3:  100ms
child 4:  150ms
child 5:  200ms
child 6:  250ms
child 7+: 300ms
```

Applied with the `stagger-list` utility class on a `<ul>` or `<ol>`.

### Section cascade (page-level)

On pages with multiple sections, stagger section entrance:
```tsx
style={{ animation: `fade-up 300ms ${ease} both` }}          // Section 1: 0ms
style={{ animation: `fade-up 300ms ${ease} 60ms both` }}     // Section 2: 60ms
style={{ animation: `fade-up 300ms ${ease} 120ms both` }}    // Section 3: 120ms
style={{ animation: `fade-up 300ms ${ease} 180ms both` }}    // Section 4: 180ms
```

---

## Press / Interaction Feedback

All interactive elements must have tactile press feedback. **Always include both the Tailwind `active:` class AND an inline easing style.**

```tsx
style={{ transitionTimingFunction: ease, transitionDuration: "160ms" }}
```

| Element | Scale | Tailwind class |
|---------|-------|----------------|
| FAB (floating action button) | 0.92 | `active:scale-[0.92]` |
| Primary button (large) | 0.97 | `active:scale-[0.97]` |
| Month nav / calendar day | 0.88 | `active:scale-[0.88]` |
| List item link | 0.97 | `active:scale-[0.97]` |
| Category chip | 0.93 | `active:scale-[0.93]` |
| Checkbox | 0.85 | `active:scale-[0.85]` |
| Nav tab icon | 0.92 | `active:scale-[0.92]` |
| Small text link | 0.90 | `active:scale-[0.90]` |

Global baseline (applied in `@layer base`):
```css
button, [role="button"] {
  transition: transform 160ms var(--ease-out);
}
button:active, [role="button"]:active {
  transform: scale(0.97);
}
```

---

## Utility Classes

Defined in `src/styles.css` with `@utility`:

### `app-shell`
```css
margin-inline: auto;
max-width: 30rem;        /* 480px — max phone width */
min-height: 100dvh;
padding-bottom: 6.5rem; /* clear bottom nav */
```

### `surface-card`
```css
background: var(--color-card);
border: 1px solid var(--color-border);
box-shadow: var(--shadow-card);
```
Use on all card-like containers. Always pair with `rounded-2xl` or `rounded-3xl`.

### `eyebrow`
```css
font-family: var(--font-sans);
font-weight: 600;
font-size: 0.78rem;
color: var(--color-muted-foreground);
```
Use for section sub-labels, date headers, group labels.

### `stagger-list`
Apply to `<ul>` or `<ol>` — children animate in with a cascade of `fade-up`.

---

## Component Patterns

### List item
```tsx
<li className="surface-card flex items-center gap-3 rounded-2xl p-3.5">
  {/* icon */}
  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl {cat.soft}">
    <Icon className="size-4" />
  </span>
  {/* content */}
  <div className="flex-1 min-w-0">
    <p className="text-sm font-bold truncate">{title}</p>
    <p className="text-xs text-muted-foreground">{subtitle}</p>
  </div>
  {/* trailing */}
  <p className="text-sm font-bold tabular-nums shrink-0">{value}</p>
</li>
```

### Progress bar
```tsx
<div className="h-3 overflow-hidden rounded-full bg-muted">
  <div
    className="h-full rounded-full bg-primary"
    style={{
      width: `${percent}%`,
      transformOrigin: "left center",
      animation: `grow-bar 700ms ${ease} both`,
    }}
  />
</div>
```

### FAB (Floating Action Button)
```tsx
<Link
  to="/somewhere"
  className="fixed bottom-24 left-5 z-20 flex size-12 items-center justify-center
             rounded-full bg-primary text-primary-foreground shadow-lg
             transition-[transform] duration-[160ms] active:scale-[0.92]"
  style={{ transitionTimingFunction: ease }}
>
  <Plus className="size-5" />
</Link>
```
- Always `fixed bottom-24 left-5` (above bottom nav, RTL = left side)
- Size: `size-12` (48×48px)

### Category chip / badge
```tsx
<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${cat.soft}`}>
  {cat.label}
</span>
```

### Timeline list (calendar events)
```tsx
<ol className="space-y-2 border-r border-border/70 pr-4 stagger-list">
  <li className="relative surface-card rounded-2xl p-3.5">
    {/* dot on the timeline line */}
    <span className={`absolute -right-[1.4rem] top-4 size-2.5 rounded-full ring-4 ring-background ${cat.dot}`} />
    {/* content */}
  </li>
</ol>
```
RTL: border is on the **right** (`border-r`), dot at `-right-[1.4rem]`.

### Toggle switch
```tsx
<button
  type="button"
  onClick={() => setOn(v => !v)}
  className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-primary" : "bg-muted")}
>
  <span className={cn(
    "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
    on ? "translate-x-5" : "translate-x-0.5"
  )} />
</button>
```

### Demo / empty state banner
```tsx
<div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/8 p-3.5">
  <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
  <div>
    <p className="text-sm font-semibold text-primary">תוכן לדוגמה</p>
    <p className="text-xs text-muted-foreground mt-0.5">הוסף פריט ראשון ודוגמאות אלו יעלמו</p>
  </div>
</div>
```

---

## RTL Conventions

| Element | RTL rule |
|---------|----------|
| Timeline / vertical list | `border-r` (right border), dot at `-right-[...]` |
| Back / navigation chevron | `ChevronRight` goes back, `ChevronLeft` goes forward |
| FAB position | `left-5` (left side = secondary in RTL) |
| Primary accent strip on card | `absolute inset-y-0 right-0 w-1.5` (right edge) |
| Text alignment | Default `text-right` via `dir="rtl"` on `<html>` |
| Progress bar origin | `transformOrigin: "left center"` — fills left-to-right physically |
| Form labels | `block` elements, right-aligned by RTL flow |

---

## Overscroll & Mobile Baseline

```css
html, body {
  overscroll-behavior: none;   /* no pull-to-refresh, no bounce */
}
input, select, textarea {
  font-size: max(16px, 1em);   /* prevent iOS zoom on focus */
}
body {
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
```

---

## Reduced Motion

All animations are gated:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Icon Usage

Library: **Lucide React** (`lucide-react`).  
Standard sizes: `size-4` (16px) inline, `size-5` (20px) FAB, `size-8` (32px) empty states.  
Color: always `text-primary` for accent icons, inherit for neutral ones.

---

## Page Structure

Every page wraps in `<AppShell title="...">` which provides:
- Max-width container (`app-shell` utility)
- Top bar with title + optional subtitle
- Quick-action drawer (bottom sheet)
- Bottom navigation bar (5 tabs)
- User menu

Content inside AppShell has `px-4` side padding from the shell, `space-y-7` between sections on most pages, and `pb-24` on the last scrollable section to clear the bottom nav.
