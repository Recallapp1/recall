# Design System

A glassmorphism-driven, depth-focused design system with a monochrome palette and a single vibrant emerald accent. It moves from an immersive dark hero to clean, structured light-mode sections.

---

## 1. Visual Foundations

### Color Palette

| Role | Value |
|---|---|
| Primary Dark | `#000000` |
| Dark Surface | `#18181B` (Zinc-900) |
| Light Background | `#F4F4F5` (Zinc-100) |
| Accent (Highlight) | `#34D399` (Emerald-400) |
| Body Text (light mode) | `#71717A` (Zinc-500) |
| Subtle Border (dark) | `rgba(255, 255, 255, 0.1)` |
| Light Card Border | Zinc-100 |

### Typography

- **Font family:** `'Inter', sans-serif`
- **Headings:** weight 500–700, letter-spacing `-0.05em`, line-height `1.05`
- **Body:** weight 300–400, color Zinc-500 (`#71717A`)
- **Labels:** weight 700, size `10px`, letter-spacing `0.2em`, uppercase
- **Large display type:** `text-4xl` to `text-5xl` for section headings

### Glassmorphism

```css
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.1);
```

- Floating navigation uses a stronger `blur(20px)`.
- Every glass element must have a 1px white border at 10% opacity for edge definition.

### Grain Overlay

- Use a noise SVG ("grainy-gradients") as a fixed overlay at **15% opacity** on dark sections.
- Purpose: add analog texture and prevent color banding.

### Corner Radius

- Major section wrappers / large containers: `2.5rem` (40px)
- Internal cards: `1rem` (16px) to `1.5rem` (24px)
- Pricing/bento cards: `2rem` (32px)
- Buttons, nav, pills: fully rounded (`rounded-full`)

### Dark Background Rule

Never use flat colors for dark backgrounds. Always apply a subtle, bottom-heavy gradient plus the grain overlay.

---

## 2. Motion & Animation

- **Entry (`fade-in-up`):** `translateY(20px → 0)`, `opacity 0 → 1`
  - Easing: `cubic-bezier(0.16, 1, 0.3, 1)`
  - Duration: `0.8s`
- **Hover:** scale to `105%` with background-color transitions, duration `300ms`
- **Image hover:** scale to `105%` inside overflow-hidden containers
- **Status tag:** gentle `bounce` animation

---

## 3. Layout Principles

- Max container width: `1600px`, centered
- Tiered section structure:
  1. Immersive full-height hero with absolutely positioned glass elements
  2. Light-mode, grid-based feature section
  3. Dark block with grid line-art overlay
  4. Bento-grid card layout
- Alternate dark and light sections for contrast and rhythm
- All major section wrappers keep the `2.5rem` radius for visual consistency

---

## 4. Section Styles

### Navigation

- Floating glass navbar
- `backdrop-filter: blur(20px)`, `rounded-full`, ~`1.5px` padding
- Links: `text-white/80`; hover: `bg-white/10` with rounded-full background

### Hero

- Height: `92vh`, radius `2.5rem`
- Background: high-resolution abstract image at 60% opacity
- Gradient overlay: `zinc-950/40` → `zinc-950/90`
- Oversized decorative background text: `22vw`, 3% opacity, blurred
- Composition: left-aligned typography block + right-aligned vertical stack of glass cards

### Feature Grid (Light Mode)

- Two columns
- Left: sticky header (4xl–5xl) with a 2×3 grid of icon + label pairs
- Right: large display card with image (105% hover-scale) and an internal floating glass panel containing progress bars and status indicators

### Dark Productivity Block

- Full-width, background `#18181B`
- Grayscale grid line-art overlay
- Two columns:
  - Left: numbered steps inside `rounded-2xl` boxes
  - Right: 3D-transformed mock-up window (rotated ~3°) with glass-morphic code snippets and a bouncing status tag at the bottom-right

### Bento Pricing Grid

- 3-column grid
- Card: white background, `2rem` radius, thin zinc-100 border
- Top half: `64px`-height image with gradient-to-black bottom overlay
- Bottom half: `1.5rem` padding, secondary text, full-width action button

---

## 5. Special Components

### Interactive Action Button

A pill button with a nested circular icon container.

- **Base:** `bg-white`, `rounded-full`, `pl-6 pr-2 py-2`
- **Text:** `font-medium`, `text-zinc-900`
- **Inner icon:** `w-10 h-10`, `bg-zinc-900`, `rounded-full`, white icon
- **Hover:** entire button scales to `105%`; inner icon background shifts to `bg-zinc-700`

### Glass Stat Card

High-transparency card for metrics on dark sections.

- Width ≈ `72px` unit scale (`w-72`), padding `1.25rem`
- Style: `rgba(255,255,255,0.05)` background, `blur(12px)`, `1px solid rgba(255,255,255,0.1)`
- Typography: large metric (`text-3xl`) + secondary description (`text-white/60`, `text-sm`)

---

## 6. Rules

**MUST**
- Maintain the `2.5rem` radius on all major section wrappers.
- Use grainy-gradient noise textures on dark backgrounds.
- Give all glass elements a 1px, 10%-opacity white border.

**DO NOT**
- Use flat colors for dark backgrounds; always add a subtle bottom-heavy gradient.
