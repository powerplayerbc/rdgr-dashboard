# Frontend Spec: Universal Page Publishing System

**For:** Frontend Developer (Claude Built Websites session)
**Created:** 2026-03-24
**Backend status:** Schema deployed, workflows active, ready for frontend

---

## What Was Built (Backend)

### New Supabase Tables
- **`brand_themes`** — colors, fonts, logos, footer config per brand. Carlton seeded.
- **`page_promotions`** — ads/banners with placement, targeting, scheduling, priority.

### Modified Table: `landing_pages`
New columns added:
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `page_type` | TEXT | 'landing' | Values: landing, blog, checkout, confirmation, scheduling, upsell, downsell, info, account |
| `fold_index` | INT | 3 | Number of body_sections to SSR (above fold). Rest lazy-loaded. |
| `structured_data` | JSONB | null | JSON-LD for SEO |
| `canonical_url` | TEXT | null | Canonical URL |
| `author` | TEXT | null | For blog posts |
| `published_date` | TIMESTAMPTZ | null | For blog posts |
| `category` | TEXT | null | Content category |
| `related_page_ids` | TEXT[] | {} | Cross-linking |
| `promotion_ids` | TEXT[] | {} | Explicit promo overrides |

`template_type` CHECK expanded to include: blog, checkout, confirmation, scheduling, upsell, downsell, info.

### New RPCs
- **`get_brand_theme(p_brand_id)`** — Returns full theme object for a brand
- **`get_active_promotions(p_brand_id, p_page_id, p_template_type)`** — Returns targeted promotions
- **`expire_promotions()`** — Expires overdue promotions (for scheduled job)

### New Workflows
- **PAGE-CREATE** (`LX1W0UUXjm5JsVrr`) — POST `/webhook/page-create` — creates any page type
- **PROMO-MANAGE** (`946rwThotFGrxaLB`) — POST `/webhook/promo-manage` — CRUD for promotions

---

## What the Frontend Needs to Build

### 1. New GitHub Repo: `carlton-pages`
- Move contents of `landing-app/` from Agentic Workflows repo into a new `carlton-pages` repo
- This becomes the standalone deployable for Coolify
- DNS already configured for: offers.bradfordcarlton.com, blog.bradfordcarlton.com, shop.bradfordcarlton.com, pages.bradfordcarlton.com

### 2. Extract SectionRenderer
- Extract `GenericSection` from `GenericTemplate.tsx` into `components/sections/SectionRenderer.tsx`
- Each section type gets its own file in `components/sections/`
- `GenericTemplate` delegates to `SectionRenderer` (pure refactor, no behavior change)

### 3. New Section Types to Add

| Section Type | Component | Purpose |
|---|---|---|
| `rich_text` | `RichTextSection.tsx` | Markdown body with headings (blog, info) |
| `author_bio` | `AuthorBioSection.tsx` | Author card: photo, name, bio (blog) |
| `table_of_contents` | `TableOfContentsSection.tsx` | Auto TOC from headings (blog, info) |
| `order_summary` | `OrderSummarySection.tsx` | Cart/order display (checkout, confirmation) |
| `countdown_timer` | `CountdownTimerSection.tsx` | Urgency countdown — `'use client'` (upsell) |
| `scheduling_embed` | `SchedulingEmbedSection.tsx` | Cal.com/Calendly iframe — `'use client'` (scheduling) |
| `related_pages` | `RelatedPagesSection.tsx` | Grid of related page cards (blog, info) |
| `image_gallery` | `ImageGallerySection.tsx` | Image grid/carousel (blog) |
| `promotion_slot` | `PromotionSlotSection.tsx` | Explicit promo injection point (all) |

**TypeScript types** — add to `types.ts`:
```typescript
export type SectionType =
  | 'hero' | 'benefits' | 'how_it_works' | 'testimonials' | 'pricing'
  | 'faq' | 'cta' | 'features' | 'stats' | 'video' | 'text'
  | 'comparison' | 'form'
  // New:
  | 'rich_text' | 'author_bio' | 'table_of_contents' | 'order_summary'
  | 'countdown_timer' | 'scheduling_embed' | 'related_pages'
  | 'image_gallery' | 'promotion_slot'

export type PageType = 'landing' | 'blog' | 'checkout' | 'confirmation'
  | 'scheduling' | 'upsell' | 'downsell' | 'info'

export type TemplateType =
  | 'scorecard' | 'workshop' | 'live_session' | 'generic'
  | 'blog' | 'checkout' | 'confirmation' | 'scheduling'
  | 'upsell' | 'downsell' | 'info'
```

### 4. New Template Components

Each is a thin layout wrapper that uses `SectionRenderer`:

| Template | File | Layout |
|---|---|---|
| Blog | `BlogTemplate.tsx` | Narrow prose column, optional TOC sidebar, `<article>` semantics |
| Checkout | `CheckoutTemplate.tsx` | Two-column: content left, order summary sticky right |
| Confirmation | `ConfirmationTemplate.tsx` | Single centered column, success icon, noindex |
| Scheduling | `SchedulingTemplate.tsx` | Two-column or single with calendar embed |
| Upsell | `UpsellTemplate.tsx` | Single column, high-urgency, countdown |
| Downsell | `DownsellTemplate.tsx` | Single column, lower pressure, empathetic |
| Info | `InfoTemplate.tsx` | Full-width sections, organization structured data |

**Update `renderTemplate` switch** in `[...slug]/page.tsx` to include all new types.

### 5. Brand Theming System

**ThemeProvider** (server component):
```typescript
// src/components/theme/ThemeProvider.tsx
import { supabase } from '@/lib/supabase'

export async function getTheme(brandId: string) {
  const { data } = await supabase.rpc('get_brand_theme', { p_brand_id: brandId })
  return data
}

export function ThemeProvider({ theme, children }) {
  if (!theme) return <>{children}</>

  const cssVars = {
    '--color-bg-primary': theme.color_bg_primary,
    '--color-bg-secondary': theme.color_bg_secondary,
    '--color-bg-tertiary': theme.color_bg_tertiary,
    '--color-text-primary': theme.color_text_primary,
    '--color-text-secondary': theme.color_text_secondary,
    '--color-text-muted': theme.color_text_muted,
    '--color-accent-primary': theme.color_accent_primary,
    '--color-accent_hover': theme.color_accent_hover,
    '--color-accent-text': theme.color_accent_text,
    '--color-border': theme.color_border,
    '--font-heading': theme.font_heading,
    '--font-body': theme.font_body,
  }

  return (
    <div style={cssVars as React.CSSProperties}>
      {theme.font_url && <link href={theme.font_url} rel="stylesheet" />}
      {children}
    </div>
  )
}
```

**Migration path for existing components:**
- New templates use `bg-[var(--color-bg-primary)]` from the start
- Existing templates keep `bg-navy-950` etc. (navy IS the Carlton theme — no change needed)
- Shared components (Hero, Footer) accept optional theme override props
- `globals.css` `@theme` block already defines `--color-navy-*` which are the defaults

### 6. Lazy Loading (Above/Below Fold)

In `[...slug]/page.tsx`:
```typescript
const foldIndex = page.fold_index ?? 3
const aboveFold = page.body_sections.slice(0, foldIndex)
const hasBelowFold = page.body_sections.length > foldIndex

// SSR above-fold sections
{aboveFold.map((s, i) => <SectionRenderer key={i} section={s} ... />)}

// Client-side lazy load below-fold
{hasBelowFold && <BelowFoldLoader pageId={page.page_id} foldIndex={foldIndex} />}
```

**New API route** `/api/sections/[pageId]/route.ts`:
- Returns `body_sections[foldIndex:]` for client-side hydration
- `BelowFoldLoader` uses IntersectionObserver to trigger fetch

**Important for SEO:** Blog posts should set `fold_index` high (e.g., 20) so the full article is SSR'd.

### 7. Promotion Injection

Fetch promotions in `[...slug]/page.tsx`:
```typescript
const { data: promos } = await supabase.rpc('get_active_promotions', {
  p_brand_id: page.brand_id,
  p_page_id: page.page_id,
  p_template_type: page.template_type
})
```

**PromotionRenderer** component renders promos by placement:
- `banner_top` → above Hero
- `interstitial` → between sections (after Nth section)
- `post_content` → before Footer
- `banner_bottom` → sticky bar (client component)
- `exit_intent` → popup on mouse-leave (client component)

### 8. SEO Additions

- `/app/sitemap.ts` — dynamic sitemap querying all published pages
- `/app/robots.ts` — allow all crawlers
- In `generateMetadata()`: render `structured_data` as JSON-LD, add `canonical_url`, article metadata for blogs
- `/app/middleware.ts` — subdomain routing (cosmetic, filter by page_type)

### 9. Subdomain Middleware

```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  // Map subdomains to page_type filters (passed via headers or search params)
  // offers.* → landing, blog.* → blog, shop.* → checkout/confirmation/upsell/downsell
}
```

---

## How Pages Get Created

1. n8n workflow calls `POST /webhook/page-create` with page data
2. PAGE-CREATE inserts into `landing_pages` table
3. If `status: 'published'`, it calls `/api/revalidate` on the Next.js app
4. The `[...slug]/page.tsx` route picks it up automatically via the dynamic slug
5. No code deploy needed — just Supabase data + ISR revalidation

---

## Supabase Data Contract

### Brand Theme (from `get_brand_theme` RPC)
```json
{
  "brand_id": "carlton",
  "brand_name": "Carlton AI Services",
  "color_bg_primary": "#080c17",
  "color_accent_primary": "#f59e0b",
  "font_heading": "Inter",
  "font_body": "Inter",
  "font_url": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
  "footer_brand_name": "Carlton AI Services",
  "footer_links": [],
  "logo_url": null,
  "sitemap_hostname": "https://pages.carltonaiservices.com"
}
```

### Promotion (from `get_active_promotions` RPC)
```json
{
  "promotion_id": "PROMO_260324120000",
  "brand_id": "carlton",
  "title": "Spring Sale",
  "body_text": "20% off all scorecards",
  "cta_text": "Shop Now",
  "cta_url": "/offers",
  "placement": "banner_top",
  "style_variant": "urgent",
  "priority": 1,
  "bg_color": "#dc2626",
  "text_color": "#ffffff"
}
```
