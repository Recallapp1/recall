# Design System

> **Sürüm 2 (2026-10-04).** Ürün ekibinin kararıyla palet koyu lacivert + beyaz olarak yenilendi ve tanıtım sayfası yeniden tasarlandı ([ADR-007](docs/decisions/ADR-007-navy-palette-and-landing.md)). Glassmorphism, köşe yarıçapları, hareket ve buton kuralları korunmuştur. Sürüm 1 (siyah/zinc + emerald) git geçmişindedir.
>
> Kod karşılığı ve panel türetmeleri: [docs/04-panel/DESIGN-SYSTEM.md](docs/04-panel/DESIGN-SYSTEM.md). Canlı stil rehberi: `/dev/tasarim` (yalnızca geliştirmede).

A clinical, trustworthy design system: deep navy and clean white, one bright blue accent, glass depth on dark sections.

---

## 1. Visual Foundations

### Color Palette

| Role                         | Token                | Value       |
| ---------------------------- | -------------------- | ----------- |
| Deepest navy (footer, gradient bottom) | `ink`      | `#050B1F`   |
| Dark section surface         | `surface-dark`       | `#0B1736`   |
| Card on dark surface         | `surface-raised`     | `#13254F`   |
| Page background (cool white) | `canvas`             | `#F4F7FC`   |
| Cards, light sections        | `paper`              | `#FFFFFF`   |
| Primary (buttons, links)     | `primary`            | `#1D4ED8`   |
| Primary soft (icon chips)    | `primary-soft`       | `#DBEAFE`   |
| Accent (highlight on dark only) | `accent`          | `#60A5FA`   |
| Heading text (light)         | `heading`            | `#0B1736`   |
| Body text (light)            | `body`               | `#475569`   |
| Secondary text (dark)        | `on-dark-muted`      | `#A5B4CF`   |
| Borders (light)              | `hairline`           | `#E3E8F2`   |
| Subtle border (dark)         | `glass-border`       | `rgba(255, 255, 255, 0.12)` |
| Positive status              | `success`            | `#15803D`   |

**Contrast (WCAG AA):** body on white 7.6:1, heading on white 17.7:1, white on primary 6.7:1, accent on navy 6.9:1, secondary text on navy 8.4:1. The accent is **not** used as text on light backgrounds (2.5:1).

### Typography

- **Font family:** `'Montserrat', sans-serif` for all text (landing, panel, emails), self-hosted variable font with `latin-ext` for Turkish (`@fontsource-variable/montserrat`)
- **Headings:** weight 600, letter-spacing `-0.05em`, line-height `1.05`
- **Body:** weight 400, `body` on light, `on-dark-muted` on dark
- **Labels:** weight 700, size `10px`, letter-spacing `0.2em`, uppercase
- **Display type:** `text-4xl` to `text-5xl` for section headings; hero up to `text-7xl`

### Glassmorphism

```css
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.12);
```

- Navigation uses `blur(20px)` and is translucent (see §3 Sticky header).
- Every glass element has a 1px white border at ~10% opacity.

### Depth on Dark Sections

- Dark sections use a bottom-heavy navy gradient (`surface-dark` → `surface-darker` → `ink`) plus a subtle grain overlay at **8%** opacity.
- Soft, blurred blue light sources (`primary`, `accent`) and a faint grid add depth instead of photos.

### Corner Radius

- Major section wrappers: `2.5rem` (40px)
- Internal cards: `1rem` (16px) to `1.5rem` (24px)
- Pricing / bento / large cards: `2rem` (32px)
- Buttons, nav, pills, badges: fully rounded (`rounded-full`)

### Dark Background Rule

Never use flat colors for dark backgrounds. Always apply the navy gradient plus the grain overlay.

---

## 2. Motion & Animation

- **Entry (`fade-in-up`):** `translateY(20px → 0)`, `opacity 0 → 1`, `cubic-bezier(0.16, 1, 0.3, 1)`, `0.8s`
- **Hover:** scale to `105%` with background-color transitions, `300ms`
- **Status tag:** gentle bounce; live indicators pulse
- **Reduced motion:** all animation disabled under `prefers-reduced-motion`

---

## 3. Layout Principles

- Content width: `max-w-6xl` (72rem) for landing content, `1600px` page cap
- **Sticky floating header:** always visible while scrolling (`sticky top-0`), translucent glass pill that adapts to what is beneath it:
  - over dark surfaces: clear glass (`white 5%`, `blur(20px)`), white text, so the section shows through and the bar never blends into a same-colored background
  - over light surfaces: frosted white (`white 55%`), dark text
  - if any part of the bar is over a light surface, the frosted white mode is used (readable on both)
  - **spacing:** height 56px; at the top of the page it floats inside the hero, 16px (mobile) / 20px (≥640px) below the hero's top edge, max width 768px (`max-w-3xl`), centered with equal side gaps; nav links never wrap; while scrolling it sticks 12px from the viewport top
  - dark sections and dark cards in light sections are tagged `data-header-tone="dark"`; light cards in dark sections `data-header-tone="light"`
- Alternate dark navy and light sections for rhythm; light sections alternate `canvas` and `paper`
- Section anchors leave room for the sticky header (`scroll-mt-28`)
- All major section wrappers, **including the hero and the footer**, are inset from the page edges and keep the `2.5rem` radius on all four corners

---

## 4. Landing Page Structure

| # | Section | Tone |
|---|---|---|
| 1 | Sticky header (logo, links, "Demo talep edin") | navy glass |
| 2 | Hero: "Kliniğinizin yeni nesil sekreteri" + live call illustration (no eyebrow pill) | dark |
| 3 | Clinic types | canvas |
| 4 | Problem → solution | canvas |
| 5 | How it works (4 steps) | paper |
| 6 | Features (6 cards) | dark |
| 7 | Sample conversation + assistant principles | canvas |
| 8 | Panel preview | paper |
| 9 | Security & KVKK | dark |
| 10 | Onboarding (4 steps) | canvas |
| 11 | Pricing (3 plans, featured one dark) | paper |
| 12 | FAQ (accordion) | canvas |
| 13 | Contact / demo request form | dark |
| 14 | Footer | dark |

**Content rule:** no fabricated customer logos, testimonials or statistics. Product illustrations are labelled as examples.

---

## 5. Special Components

### Interactive Action Button

Pill button with a nested circular icon container.

- **`onDark`** (on navy): `bg-paper`, `text-heading`, icon circle `surface-dark`, hover icon `primary`
- **`primary`** (on light): `bg-primary`, white text, icon circle translucent white, hover `primary-hover`
- **Base:** `rounded-full`, `pl-6 pr-2 py-2`, inner icon `w-10 h-10`; whole button scales to `105%` on hover

### Secondary Link

Outlined pill for the less important of two actions (white border on dark, `hairline` on light).

### Glass Stat Card

High-transparency card for metrics on dark sections: `w-72`, `1.25rem` padding, `text-3xl` metric, muted description.

---

## 6. Rules

**MUST**

- Keep the `2.5rem` radius on all major section wrappers.
- Use the navy gradient and grain on dark backgrounds.
- Give all glass elements a 1px, ~10%-opacity white border.
- Use only the tokens above; `pnpm lint:tokens` enforces it.
- Keep text contrast at WCAG AA or better.

**DO NOT**

- Use flat colors for dark backgrounds.
- Use the accent color as text on light backgrounds.
- Publish fabricated testimonials, logos or numbers.
