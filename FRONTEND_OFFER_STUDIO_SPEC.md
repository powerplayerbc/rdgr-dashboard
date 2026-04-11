# Frontend Offer Studio Spec

## Overview

The Offer Studio is a new section in the RDGR approval portal (`/offer-studio`) where Bradford can create offer ideas, track their build progress, review AI-generated content, manage testimonials and landing pages, and view revenue metrics. All reads go through Supabase RPCs; all writes go through n8n webhooks.

---

## 1. Route & Navigation

**Route:** `/offer-studio` in the approval portal

**Sidebar entry** (add to `navItems` in `Sidebar.tsx`):
```javascript
{ href: '/offer-studio', label: 'Offer Studio', icon: 'M12 8c-1.657...' }  // lightbulb or rocket icon
```

**Sub-tabs** (within the page):
1. **Offers** — Pipeline view, create new offers
2. **Testimonials** — Manage social proof
3. **Landing Pages** — Status, preview, publish
4. **Revenue** — Headline metrics and sales

---

## 2. Supabase Connection

Same Supabase instance as the rest of the portal:
- **URL:** `https://yrwrswyjawmgtxrgbnim.supabase.co`
- **Auth:** Use the existing Supabase client (anon key + JWT from auth)
- **Time display:** Convert UTC to Pacific Time (`America/Los_Angeles`)

---

## 3. Offers Tab

### 3a. "New Offer Idea" Form

A simple form that triggers AI proposal generation.

**Fields:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| Niche / Industry | text | yes | — |
| Target Audience | textarea | yes | — |
| Template Type | select | no | `scorecard` |
| Additional Context | textarea | no | — |

**Template options (from `offer_templates`):**
```javascript
const { data } = await supabase
  .from('offer_templates')
  .select('template_key, display_name, description, default_price_cents')
  .eq('brand_id', 'carlton')
  .eq('status', 'active');
```

**Submit action:**
```javascript
POST https://n8n.carltonaiservices.com/webhook/offer-ideate
Content-Type: application/json

{
  "brand_id": "carlton",
  "niche": "real estate agents",
  "target_audience": "Solo agents in Las Vegas wanting AI for lead gen",
  "template_key": "scorecard",
  "context": "Optional notes"
}
```

**Response:**
```json
{
  "success": true,
  "proposal_id": "PROP_260322084610",
  "proposed_title": "AI Lead Machine Scorecard for Solo Las Vegas Agents",
  "confidence_score": 0.78,
  "template_key": "scorecard",
  "message": "Offer proposed and pending approval"
}
```

After submission, show a toast: "Offer idea submitted. A review task will appear shortly." The proposal creates a human task automatically.

### 3b. Offer Pipeline View

**Data source:**
```javascript
const { data } = await supabase.rpc('get_dashboard_offers', { p_brand_id: 'carlton' });
```

**Response shape:**
```typescript
interface DashboardOffer {
  offer_id: string;          // "O_260322080344"
  title: string;
  slug: string;
  niche: string;
  target_audience: string;
  status: 'ideation' | 'approved' | 'building' | 'review' | 'ready' | 'live' | 'paused' | 'retired';
  price_cents: number;
  price_type: 'one_time' | 'per_seat' | 'subscription';
  template_key: string;
  template_name: string;
  landing_page_url: string | null;
  stripe_payment_link: string | null;
  steps_completed: number;   // e.g. 3
  steps_total: number;        // e.g. 9
  current_step: string | null; // "Research market and competition"
  created_at: string;
  updated_at: string;
}
```

**Display:** Card grid or list. Each offer shows:
- Title + niche
- Status badge (color-coded)
- Progress bar: `steps_completed / steps_total`
- Current step name
- Price display
- Links: landing page (if exists), payment link (if exists)

**Status badge colors:**
| Status | Color | Label |
|--------|-------|-------|
| ideation | gray | Ideation |
| building | blue | Building |
| review | amber | Review |
| ready | green | Ready |
| live | emerald | Live |
| paused | orange | Paused |
| retired | red | Retired |

### 3c. Pending Tasks (inline in Offers tab)

Show tasks for the offers domain. Use the same query pattern as `FRONTEND_HUMAN_TASK_INTEGRATION.md`.

**Data source:**
```javascript
const { data } = await supabase.rpc('get_offer_studio_tasks', { p_brand_id: 'carlton' });
```

**Response shape:**
```typescript
interface OfferStudioTask {
  task_id: string;
  title: string;
  description: string;
  domain: 'offers' | 'testimonials' | 'landing_pages';
  status: string;
  human_action_type: string;
  review_content: {
    type: 'text' | 'url' | 'comparison' | 'document';
    data: string;
  };
  action_options: string[];  // ["approve", "reject"]
  context: object | null;
  entity_id: string;
  created_at: string;
}
```

**Rendering review_content by type:**
- `text`: Markdown/preformatted text viewer
- `url`: iframe preview or "Open Preview" link
- `comparison`: Side-by-side (original | polished)
- `document`: Link to Google Doc

**Action buttons:**
| Action | Label | Variant | Sends |
|--------|-------|---------|-------|
| approve | Approve | green | `{task_id, action: "approve", acted_by: "bradford"}` |
| reject | Reject | red | `{task_id, action: "reject", feedback: "...", acted_by: "bradford"}` |
| edit | Edit & Approve | blue | `{task_id, action: "edit", edited_content: "...", acted_by: "bradford"}` |
| request_changes | Request Changes | amber | `{task_id, action: "request_changes", feedback: "...", acted_by: "bradford"}` |

**Action endpoint:**
```javascript
POST https://n8n.carltonaiservices.com/webhook/human-action
Content-Type: application/json

{
  "task_id": "260322084610-HT",
  "action": "approve",
  "feedback": "Looks great",
  "acted_by": "bradford"
}
```

**Response:**
```json
{
  "success": true,
  "task_id": "260322084610-HT",
  "action": "approve",
  "task_status": "completed",
  "callback_fired": true,
  "message": "Task approved successfully — workflow callback triggered"
}
```

### 3d. Proposals View (sub-section)

Show AI-generated proposals awaiting approval.

```javascript
const { data } = await supabase
  .from('offer_proposals')
  .select('*')
  .eq('brand_id', 'carlton')
  .order('created_at', { ascending: false });
```

Fields: proposal_id, proposed_title, proposed_niche, proposed_audience, proposed_price_cents, confidence_score, status, rationale

---

## 4. Testimonials Tab

### 4a. Testimonial List

**Data source:**
```javascript
const { data } = await supabase.rpc('get_dashboard_testimonials', { p_brand_id: 'carlton' });
```

**Response shape:**
```typescript
interface DashboardTestimonial {
  testimonial_id: string;
  attribution_name: string;
  attribution_company: string | null;
  attribution_industry: string | null;
  headline: string | null;
  raw_text: string;
  polished_text: string | null;
  short_version: string | null;
  format: string;
  approval_status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  consent_status: string;
  times_used: number;
  last_used_at: string | null;
  rating: number | null;
  tags: string[] | null;
  created_at: string;
}
```

**Display:** Table or card list with approval_status badge, headline, attribution, times_used.

### 4b. "Add Testimonial" Form

**Fields:**
| Field | Type | Required |
|-------|------|----------|
| Raw Text | textarea | yes |
| Author Name | text | yes |
| Company | text | no |
| Industry | text | no |
| Source | select (manual, email_reply, social_media, review_site) | no |

**Submit action:**
```javascript
POST https://n8n.carltonaiservices.com/webhook/testimonial-ingest
Content-Type: application/json

{
  "raw_text": "Working with Bradford transformed our business...",
  "author_name": "Jane Smith",
  "company": "Smith Realty",
  "source": "manual",
  "consent": true
}
```

This triggers TESTIMONIAL-INGEST → TESTIMONIAL-POLISH → creates a human task with side-by-side comparison (raw vs polished).

---

## 5. Landing Pages Tab

### 5a. Landing Page List

**Data source:**
```javascript
const { data } = await supabase.rpc('get_dashboard_landing_pages', { p_brand_id: 'carlton' });
```

**Response shape:**
```typescript
interface DashboardLandingPage {
  page_id: string;
  slug: string;
  title: string;
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived' | 'paused';
  template_type: string;
  headline: string | null;
  offer_id: string | null;
  preview_url: string;     // https://offers.bradfordcarlton.com/preview/{slug}
  public_url: string | null; // only when published
  page_views: number;
  conversions: number;
  conversion_rate: number;
  views_7d: number;
  conversions_7d: number;
  created_at: string;
  published_at: string | null;
}
```

**Display:** Table with status badge, preview link, analytics columns.

### 5b. Actions

- **Preview:** Open `preview_url` in new tab or iframe
- **Publish:** POST to `/webhook/lp-publish` with `{page_id, operation: "publish"}`
- **Unpublish:** POST to `/webhook/lp-publish` with `{page_id, operation: "unpublish"}`

---

## 6. Revenue Tab

### 6a. Headline Metrics

**Data source:**
```javascript
const { data } = await supabase.rpc('get_revenue_summary', { p_brand_id: 'carlton' });
```

**Response shape:**
```typescript
interface RevenueSummary {
  total_revenue_cents: number;
  revenue_30d_cents: number;
  total_purchases: number;
  purchases_30d: number;
  active_offers: number;
  active_subscriptions: number;
  mrr_cents: number;
  top_offer: {
    title: string;
    revenue_cents: number;
    purchases: number;
  } | {};
}
```

**Display:** 4 metric cards:
1. Total Revenue (format as $X,XXX.XX)
2. Last 30 Days Revenue
3. Total Purchases
4. Active Offers + MRR

Plus: Top-performing offer card (if exists).

### 6b. Recent Purchases

```javascript
const { data } = await supabase
  .from('offer_purchases')
  .select('purchase_id, offer_id, customer_email, amount_cents, payment_status, created_at')
  .eq('brand_id', 'carlton')
  .order('created_at', { ascending: false })
  .limit(20);
```

---

## 7. Real-time Updates

Subscribe to changes on key tables for live dashboard updates:

```javascript
// Offers pipeline changes
supabase.channel('offer-studio')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'offer_build_steps' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'directive_tasks', filter: 'requires_human=eq.true' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'landing_pages' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_testimonials' }, handleUpdate)
  .subscribe();
```

---

## 8. Error Handling

- Webhook calls may timeout (120s default). Show a spinner during calls.
- If a webhook returns `{success: false}`, show the error message.
- Human action webhook is idempotent — safe to retry on failure.
- For Supabase RPC calls, empty arrays mean "no data yet" — show empty states.

---

## 9. Key Backend Endpoints Summary

| Action | Method | Endpoint | Payload |
|--------|--------|----------|---------|
| Create offer idea | POST | `/webhook/offer-ideate` | `{brand_id, niche, target_audience, template_key}` |
| Approve/reject task | POST | `/webhook/human-action` | `{task_id, action, feedback, acted_by}` |
| Add testimonial | POST | `/webhook/testimonial-ingest` | `{raw_text, author_name, company, source}` |
| Publish landing page | POST | `/webhook/lp-publish` | `{page_id, operation: "publish"}` |
| List offers | RPC | `get_dashboard_offers` | `{p_brand_id: "carlton"}` |
| List landing pages | RPC | `get_dashboard_landing_pages` | `{p_brand_id: "carlton"}` |
| List testimonials | RPC | `get_dashboard_testimonials` | `{p_brand_id: "carlton"}` |
| Revenue metrics | RPC | `get_revenue_summary` | `{p_brand_id: "carlton"}` |
| Pending tasks | RPC | `get_offer_studio_tasks` | `{p_brand_id: "carlton"}` |
| Offer templates | Table | `offer_templates` | `?brand_id=eq.carlton&status=eq.active` |
| Proposals | Table | `offer_proposals` | `?brand_id=eq.carlton&order=created_at.desc` |
| Recent purchases | Table | `offer_purchases` | `?brand_id=eq.carlton&order=created_at.desc&limit=20` |

---

## 10. Existing Patterns to Follow

- **Social Outreach page** (`/social-outreach/page.tsx`): Same Supabase RPC reads + n8n webhook writes pattern
- **Human Task Integration** (`FRONTEND_HUMAN_TASK_INTEGRATION.md`): Task rendering, action buttons, review_content types
- **Outreach Draft Review** (`FRONTEND_OUTREACH_DRAFT_REVIEW_SPEC.md`): Approve/reject/edit flow with feedback
