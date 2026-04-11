# Backend Spec: Offer Studio v2 — New Features Integration

## Overview

The Offer Studio frontend (`/offer-studio`) has been updated with 8 new features. The frontend is live and gracefully degrades when backend data isn't available yet. This document specifies everything the backend developer needs to build to light up the full experience.

**What's already working:** The original Offer Studio features (pipeline, proposals, tasks, testimonials, basic landing pages, revenue) are fully operational. This spec covers only the **new additions**.

**Related spec:** `FRONTEND_PAGE_SYSTEM_SPEC.md` — the Universal Page Publishing System backend is deployed and this dashboard now integrates with it (see sections 6, 7, 8).

**Frontend location:** `sites/rdgr-dashboard/offer-studio.html` (deployed to `bradfordcarlton.com/offer-studio`)

---

## 1. Expanded Template Types — Webhook Processing

### What Changed
The "New Offer Idea" form now sends 28 different `template_key` values (up from 1). The existing `/webhook/offer-ideate` endpoint receives these.

### Webhook Endpoint
```
POST https://n8n.carltonaiservices.com/webhook/offer-ideate
```

### Payload (unchanged structure, new template_key values)
```json
{
  "brand_id": "carlton",
  "niche": "real estate agents",
  "target_audience": "Solo agents in Las Vegas wanting AI for lead gen",
  "template_key": "quiz",
  "context": "Optional notes"
}
```

### All Possible template_key Values

| Category | template_key | Display Name | Backend Processing Notes |
|----------|-------------|--------------|--------------------------|
| **Lead Magnets** | | | |
| | `scorecard` | Scorecard | *Already implemented* |
| | `checklist` | Checklist | Generate a downloadable checklist PDF/page |
| | `template` | Template / Worksheet | Generate a fillable template or worksheet |
| | `calculator` | Calculator / ROI Tool | Generate an interactive calculator (HTML/JS widget) |
| | `quiz` | Quiz / Assessment | Generate quiz questions, scoring logic, results copy |
| | `guide` | Guide / How-To | Generate a multi-section guide document |
| | `toolkit` | Toolkit / Resource Bundle | Generate a bundle of multiple resources |
| | `swipe_file` | Swipe File | Generate copy templates/examples |
| | `cheat_sheet` | Cheat Sheet | Generate a single-page reference document |
| | `resource_library` | Resource Library | Generate a curated collection of links/resources |
| **Digital Products** | | | |
| | `course` | Online Course | Generate course outline, module structure, lesson plans |
| | `workshop` | Workshop / Intensive | Generate workshop agenda, slides outline, exercises |
| | `ebook` | eBook / Whitepaper | Generate long-form content structure and chapters |
| | `webinar` | Webinar | Generate webinar script, slides outline, CTA sequence |
| | `masterclass` | Masterclass | Generate masterclass curriculum and promotional copy |
| **Services** | | | |
| | `consulting` | Consulting Session | Generate service description, intake form, pricing tiers |
| | `audit` | Audit / Review | Generate audit framework, scoring criteria, deliverable outline |
| | `coaching` | Coaching Program | Generate program structure, session outlines, milestones |
| | `done_for_you` | Done-for-You Service | Generate service package description, scope, deliverables |
| **Access & Trials** | | | |
| | `free_trial` | Free Trial / Demo | Generate trial flow, onboarding sequence, conversion points |
| | `community` | Community Access | Generate community value prop, rules, welcome sequence |
| | `membership` | Membership / Subscription | Generate membership tiers, benefits matrix, retention hooks |
| **Events & Programs** | | | |
| | `challenge` | Challenge / Bootcamp | Generate challenge structure, daily prompts, completion criteria |
| | `summit` | Virtual Summit / Conference | Generate event agenda, speaker framework, promotion plan |
| **Reports & Tools** | | | |
| | `report` | Report / Industry Analysis | Generate research framework, data points, analysis structure |
| | `software_tool` | Software Tool / SaaS | Generate tool specification, feature list, pricing model |
| **AI-Powered** | | | |
| | `ai_propose` | AI Propose Ideas | *Special — see below* |

### Special: `ai_propose` Template Key

When `template_key === 'ai_propose'`, the backend should **not** use a fixed template. Instead:

1. Take the `niche` and `target_audience` inputs
2. Research/analyze the market conditions for that niche (using available AI tools)
3. Determine which template type(s) would be most effective
4. Generate a proposal with the recommended template type and rationale
5. Set the `template_key` on the resulting proposal to the chosen type
6. Include in the `rationale` field why this template type was selected over alternatives

The frontend shows the user: "AI will analyze your market and propose the best offer type."

### Required Backend Work

1. **Update offer-ideate workflow** to recognize all 28 template_key values
2. **Create template-specific AI generation prompts** for each type — each template type needs different output structure, content focus, and deliverables
3. **Add AI market analysis logic** for the `ai_propose` path
4. **Populate `offer_templates` table** (optional but recommended):

```sql
INSERT INTO offer_templates (template_key, display_name, description, default_price_cents, brand_id, status)
VALUES
  ('checklist', 'Checklist', 'Downloadable checklist lead magnet', 0, 'carlton', 'active'),
  ('calculator', 'Calculator / ROI Tool', 'Interactive calculator widget', 0, 'carlton', 'active'),
  ('quiz', 'Quiz / Assessment', 'Interactive quiz with scoring', 0, 'carlton', 'active'),
  -- ... (all 28 types)
;
```

When the `offer_templates` table is populated, the frontend dropdown will auto-populate from DB instead of using the hardcoded list.

---

## 2. Landing Pages — New Tracking Columns

### What Changed
The landing pages table now displays 3 additional columns: Downloads, Purchases, Revenue.

### Data Source
The frontend reads these from the existing RPC:
```javascript
supabase.rpc('get_dashboard_landing_pages', { p_brand_id: 'carlton' })
```

### New Fields Required in RPC Response

Add these to the `get_dashboard_landing_pages` RPC return type:

| Field | Type | Description |
|-------|------|-------------|
| `downloads` | `integer` | Number of lead magnet downloads from this landing page |
| `purchases` | `integer` | Number of purchases originating from this landing page |
| `revenue_cents` | `integer` | Total revenue in cents attributed to this landing page |

### Implementation Options

**Option A: Add columns directly to the `landing_pages` table:**
```sql
ALTER TABLE landing_pages
  ADD COLUMN downloads integer DEFAULT 0,
  ADD COLUMN purchases integer DEFAULT 0,
  ADD COLUMN revenue_cents integer DEFAULT 0;
```
Then update the RPC to include them in the SELECT.

**Option B: Compute from tracking events (recommended):**
Keep the `landing_pages` table clean and compute these metrics in the RPC by joining against an events/analytics table:

```sql
-- In the get_dashboard_landing_pages RPC:
SELECT
  lp.*,
  COALESCE(stats.downloads, 0) as downloads,
  COALESCE(stats.purchases, 0) as purchases,
  COALESCE(stats.revenue_cents, 0) as revenue_cents
FROM landing_pages lp
LEFT JOIN (
  SELECT
    page_id,
    COUNT(*) FILTER (WHERE event_type = 'download') as downloads,
    COUNT(*) FILTER (WHERE event_type = 'purchase') as purchases,
    SUM(amount_cents) FILTER (WHERE event_type = 'purchase') as revenue_cents
  FROM landing_page_events
  GROUP BY page_id
) stats ON stats.page_id = lp.page_id
WHERE lp.brand_id = p_brand_id;
```

### Tracking Events
If using Option B, create a tracking table:
```sql
CREATE TABLE landing_page_events (
  event_id text PRIMARY KEY DEFAULT generate_event_id(),
  page_id text REFERENCES landing_pages(page_id),
  event_type text NOT NULL, -- 'view', 'download', 'purchase', 'conversion'
  amount_cents integer DEFAULT 0,
  customer_email text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_lpe_page_id ON landing_page_events(page_id);
CREATE INDEX idx_lpe_event_type ON landing_page_events(event_type);
```

### Data Flow
```
User visits landing page
  → JS tracks page view → INSERT landing_page_events (event_type='view')

User downloads lead magnet
  → Download handler → INSERT landing_page_events (event_type='download')

User purchases via Stripe link
  → Stripe webhook → INSERT landing_page_events (event_type='purchase', amount_cents=...)
  → Also INSERT offer_purchases (existing flow)
```

---

## 3. Product & Service Performance — New RPC

### What Changed
The Revenue tab now has a "Product & Service Performance" section showing a table of products ranked by revenue.

### Frontend Query Flow
1. **Tries RPC first:** `supabase.rpc('get_product_performance', { p_brand_id: 'carlton' })`
2. **Falls back to aggregating** `offer_purchases` by `offer_id` if RPC doesn't exist

### Required: Create `get_product_performance` RPC

```sql
CREATE OR REPLACE FUNCTION get_product_performance(p_brand_id text)
RETURNS TABLE (
  offer_id text,
  title text,
  units_sold integer,
  revenue_cents bigint,
  demand integer,
  trend text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.offer_id,
    o.title,
    COUNT(p.purchase_id)::integer as units_sold,
    COALESCE(SUM(p.amount_cents), 0)::bigint as revenue_cents,
    COALESCE(o_stats.follower_count, 0)::integer as demand,
    CASE
      WHEN recent.rev > prev.rev THEN 'up'
      WHEN recent.rev < prev.rev THEN 'down'
      ELSE 'flat'
    END as trend
  FROM offers o
  LEFT JOIN offer_purchases p
    ON p.offer_id = o.offer_id
    AND p.payment_status = 'completed'
  LEFT JOIN (
    -- Demand: could be waitlist signups, page views, social interest, etc.
    SELECT offer_id, COUNT(*) as follower_count
    FROM offer_interest -- or landing_page_events or a dedicated interest table
    GROUP BY offer_id
  ) o_stats ON o_stats.offer_id = o.offer_id
  LEFT JOIN LATERAL (
    -- Last 30 days revenue
    SELECT COALESCE(SUM(amount_cents), 0) as rev
    FROM offer_purchases
    WHERE offer_id = o.offer_id
      AND payment_status = 'completed'
      AND created_at > now() - interval '30 days'
  ) recent ON true
  LEFT JOIN LATERAL (
    -- Previous 30 days revenue (30-60 days ago)
    SELECT COALESCE(SUM(amount_cents), 0) as rev
    FROM offer_purchases
    WHERE offer_id = o.offer_id
      AND payment_status = 'completed'
      AND created_at > now() - interval '60 days'
      AND created_at <= now() - interval '30 days'
  ) prev ON true
  WHERE o.brand_id = p_brand_id
    AND o.status IN ('live', 'ready', 'paused')
  GROUP BY o.offer_id, o.title, o_stats.follower_count, recent.rev, prev.rev
  ORDER BY revenue_cents DESC;
END;
$$;
```

### Expected Response Shape
```json
[
  {
    "offer_id": "O_260322080344",
    "title": "AI Lead Machine Scorecard",
    "units_sold": 47,
    "revenue_cents": 223500,
    "demand": 312,
    "trend": "up"
  }
]
```

### Frontend Field Usage

| Field | Type | Required | Fallback | Notes |
|-------|------|----------|----------|-------|
| `offer_id` | text | yes | — | Used as row key and for cross-referencing |
| `title` | text | yes | Falls back to `offer_id` | Product display name |
| `units_sold` | integer | yes | `0` | Count of completed purchases |
| `revenue_cents` | integer | yes | `0` | Displayed as formatted currency |
| `demand` | integer | no | `0` | Followers/waitlist/interest count |
| `trend` | text | no | `'flat'` | Must be `'up'`, `'down'`, or `'flat'` — drives arrow icon color |

### Demand Tracking (New Table, if needed)
```sql
CREATE TABLE offer_interest (
  interest_id text PRIMARY KEY,
  offer_id text REFERENCES offers(offer_id),
  brand_id text DEFAULT 'carlton',
  source text, -- 'waitlist', 'landing_page', 'social', 'referral'
  email text,
  created_at timestamptz DEFAULT now()
);
```

---

## 4. Email Sequences — Full Integration Spec

This is the largest new feature. The frontend has a complete Email Sequences tab with metrics, card grid, expandable per-email editing, and direct save to Supabase.

### 4a. Schema Changes Required

#### Add columns to `crm_email_sequences`:
```sql
ALTER TABLE crm_email_sequences
  ADD COLUMN IF NOT EXISTS total_steps integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trigger_event text,
  ADD COLUMN IF NOT EXISTS subscribers_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_rate numeric(5,4) DEFAULT 0,      -- 0.0000 to 1.0000
  ADD COLUMN IF NOT EXISTS click_rate numeric(5,4) DEFAULT 0,      -- 0.0000 to 1.0000
  ADD COLUMN IF NOT EXISTS purchases integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_cents integer DEFAULT 0;
```

**Currently existing columns** (confirmed from CRM page queries): `sequence_id`, `name`, `status`, `created_at`

**Rate format:** `open_rate` and `click_rate` are stored as decimals (0.0 to 1.0). The frontend multiplies by 100 for display.

#### Create `crm_sequence_steps` table:
```sql
CREATE TABLE crm_sequence_steps (
  step_id text PRIMARY KEY,
  sequence_id text REFERENCES crm_email_sequences(sequence_id),
  step_order integer NOT NULL,
  subject text,
  body_text text,               -- Plain text version
  body_html text,               -- Rich HTML version (for power-user editing)
  image_url text,               -- Header/hero image URL
  cta_url text,                 -- Primary call-to-action link
  cta_text text,                -- CTA button text
  delay_hours integer DEFAULT 0, -- Hours after previous step (or after trigger)
  send_count integer DEFAULT 0,
  open_rate numeric(5,4) DEFAULT 0,
  click_rate numeric(5,4) DEFAULT 0,
  status text DEFAULT 'draft',  -- 'draft', 'active', 'paused'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_css_sequence ON crm_sequence_steps(sequence_id);
```

#### RLS Policy for Direct Editing
The frontend PATCHes `crm_sequence_steps` directly via Supabase REST API (using the anon key). You need an RLS policy that allows updates:

```sql
-- Allow anon users to update specific fields on sequence steps
CREATE POLICY "Allow sequence step edits" ON crm_sequence_steps
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Or more restrictive: only allow editing content fields
ALTER TABLE crm_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_update_content" ON crm_sequence_steps
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
```

**Alternatively**, if you don't want to open RLS for direct writes, create a webhook endpoint:
```
POST https://n8n.carltonaiservices.com/webhook/sequence-step-update
{
  "step_id": "STEP_001",
  "field": "subject",
  "value": "New subject line here"
}
```
The frontend currently writes directly to Supabase. If this fails (403 from RLS), it shows an error toast. You can either open the RLS or add a webhook — the frontend will work with either approach.

### 4b. Frontend Queries

**Primary fetch (full columns):**
```
GET /rest/v1/crm_email_sequences
  ?select=sequence_id,name,status,total_steps,trigger_event,created_at,subscribers_count,open_rate,click_rate,purchases,revenue_cents
  &order=created_at.desc
```

**Fallback fetch (if full query fails due to missing columns):**
```
GET /rest/v1/crm_email_sequences
  ?select=sequence_id,name,status,created_at
  &order=created_at.desc
```

**Sequence steps fetch (on card expand):**
```
GET /rest/v1/crm_sequence_steps
  ?sequence_id=eq.{seqId}
  &select=*
  &order=step_order
```

**Step save (on field edit):**
```
PATCH /rest/v1/crm_sequence_steps?step_id=eq.{stepId}
Content-Type: application/json
Prefer: return=minimal

{ "subject": "New value" }
```

Fields that can be PATCHed: `subject`, `body_text`, `body_html`, `image_url`, `cta_url`

### 4c. Keeping Metrics Up-to-Date

The sequence-level metrics (`subscribers_count`, `open_rate`, `click_rate`, `purchases`, `revenue_cents`) need to be computed and updated. Options:

**Option A: Periodic aggregation (recommended)**
Create a scheduled workflow or Postgres function that runs every hour:

```sql
CREATE OR REPLACE FUNCTION update_sequence_metrics()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE crm_email_sequences seq
  SET
    total_steps = (SELECT COUNT(*) FROM crm_sequence_steps WHERE sequence_id = seq.sequence_id),
    subscribers_count = (SELECT COUNT(DISTINCT contact_id) FROM crm_sequence_enrollments WHERE sequence_id = seq.sequence_id AND status = 'active'),
    open_rate = (
      SELECT AVG(s.open_rate)
      FROM crm_sequence_steps s
      WHERE s.sequence_id = seq.sequence_id AND s.send_count > 0
    ),
    click_rate = (
      SELECT AVG(s.click_rate)
      FROM crm_sequence_steps s
      WHERE s.sequence_id = seq.sequence_id AND s.send_count > 0
    ),
    purchases = (
      SELECT COUNT(*)
      FROM offer_purchases p
      WHERE p.metadata->>'sequence_id' = seq.sequence_id
        AND p.payment_status = 'completed'
    ),
    revenue_cents = (
      SELECT COALESCE(SUM(p.amount_cents), 0)
      FROM offer_purchases p
      WHERE p.metadata->>'sequence_id' = seq.sequence_id
        AND p.payment_status = 'completed'
    );
END;
$$;
```

**Option B: Event-driven updates**
After each email send/open/click event, update the step-level metrics. After each purchase linked to a sequence, update the sequence-level metrics.

### 4d. Email Send/Tracking Data Flow

```
Sequence enrollment trigger fires
  → crm_sequence_enrollments INSERT (contact_id, sequence_id, status='active')
  → Update crm_email_sequences.subscribers_count

Delay elapses, email step is due
  → Fetch crm_sequence_steps (body_html or body_text, subject, image_url, cta_url)
  → Render final HTML email (inject image, CTA link with tracking)
  → Send via email provider
  → UPDATE crm_sequence_steps SET send_count = send_count + 1

Recipient opens email
  → Tracking pixel fires
  → Log open event
  → Recompute step.open_rate = opens / send_count

Recipient clicks CTA
  → Redirect tracker fires
  → Log click event
  → Recompute step.click_rate = clicks / send_count

Recipient purchases
  → Stripe webhook → offer_purchases INSERT (with metadata: {sequence_id, step_id})
  → Update crm_email_sequences.purchases and .revenue_cents
```

### 4e. Realtime
The frontend subscribes to `postgres_changes` on `crm_email_sequences`. Any INSERT/UPDATE/DELETE will trigger a refetch. Make sure realtime is enabled for this table:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE crm_email_sequences;
```

---

## 5. Summary of All Database Changes

### New Tables

| Table | Purpose |
|-------|---------|
| `crm_sequence_steps` | Individual emails within a sequence — content, metrics, ordering |
| `landing_page_events` | Tracking events for landing pages (views, downloads, purchases) |
| `offer_interest` | Demand/follower tracking per offer (optional, for "demand" metric) |

### Altered Tables

| Table | New Columns |
|-------|-------------|
| `crm_email_sequences` | `total_steps`, `trigger_event`, `subscribers_count`, `open_rate`, `click_rate`, `purchases`, `revenue_cents` |
| `landing_pages` (or via RPC join) | `downloads`, `purchases`, `revenue_cents` |

### New/Updated RPCs

| RPC | Action |
|-----|--------|
| `get_product_performance(p_brand_id)` | **New** — returns product performance table |
| `get_dashboard_landing_pages(p_brand_id)` | **Update** — add `downloads`, `purchases`, `revenue_cents` to return |
| `update_sequence_metrics()` | **New** — periodic aggregation of email sequence stats |

### Updated Webhooks

| Endpoint | Change |
|----------|--------|
| `/webhook/offer-ideate` | Handle 27 new `template_key` values + `ai_propose` special path |

### RLS Policies

| Table | Policy Needed |
|-------|---------------|
| `crm_sequence_steps` | Allow anon UPDATE for content fields (or create webhook alternative) |

---

## 6. Implementation Priority

Recommended order (each is independently deployable — the frontend gracefully handles missing pieces):

1. **`crm_email_sequences` ALTER + `crm_sequence_steps` CREATE** — Lights up the Email Sequences tab immediately with real per-email data
2. **`get_product_performance` RPC** — Replaces the fallback aggregation with proper demand/trend data
3. **Landing page tracking** — `landing_page_events` table + update `get_dashboard_landing_pages` RPC
4. **Template processing expansion** — Update `offer-ideate` workflow to handle all 28 template types
5. **`ai_propose` market analysis** — Most complex, can be last since it's an enhancement
6. **Sequence metrics aggregation** — Schedule periodic `update_sequence_metrics()` runs
7. **Email send/open/click tracking** — Wire up tracking pixels and click redirects to update step metrics
8. **Page creation webhook integration** — Ensure PAGE-CREATE handles all the fields the dashboard sends
9. **Promotions CRUD webhook** — Ensure PROMO-MANAGE handles create/pause/activate/delete actions

---

## 6. Universal Page System — Dashboard Integration

The frontend now integrates with the Universal Page Publishing System (`FRONTEND_PAGE_SYSTEM_SPEC.md`). The backend already has the tables and workflows deployed — this section documents how the dashboard uses them.

### 6a. Create Page Form

The Landing Pages tab now has a "Create New Page" form that posts to the PAGE-CREATE webhook.

**Endpoint:**
```
POST https://n8n.carltonaiservices.com/webhook/page-create
```

**Payload:**
```json
{
  "brand_id": "carlton",
  "title": "AI Scorecard for Realtors",
  "page_type": "blog",
  "template_type": "blog",
  "headline": "How AI Scorecards Transform Real Estate Lead Gen",
  "slug": "ai-scorecard-realtors",
  "description": "Blog post about using AI scorecards in real estate",
  "author": "Bradford Carlton",
  "category": "AI",
  "canonical_url": "https://blog.bradfordcarlton.com/ai-scorecard-realtors",
  "offer_id": "O_260322080344",
  "fold_index": 3
}
```

**Required fields:** `brand_id`, `title`, `page_type`

**Conditional fields by page_type:**
| page_type | Additional Fields Sent |
|-----------|----------------------|
| `blog`, `info` | `author`, `category`, `canonical_url` |
| `checkout`, `upsell`, `downsell`, `confirmation` | `offer_id`, `fold_index` |
| `landing`, `scheduling` | (no additional fields) |

**All possible `page_type` values:** `landing`, `blog`, `checkout`, `confirmation`, `scheduling`, `upsell`, `downsell`, `info`

**All possible `template_type` values:** `generic`, `scorecard`, `workshop`, `live_session`, `blog`, `checkout`, `confirmation`, `scheduling`, `upsell`, `downsell`, `info`

**Expected response:**
```json
{
  "success": true,
  "page_id": "PAGE_260324120000",
  "slug": "ai-scorecard-realtors",
  "message": "Page created successfully"
}
```

### 6b. Page Type Filter & Enhanced Table

The Landing Pages table now displays a `page_type` column and supports client-side filtering. The frontend reads `page_type` from the existing `get_dashboard_landing_pages` RPC response.

**New fields expected in RPC response:**

| Field | Type | Description |
|-------|------|-------------|
| `page_type` | text | One of: landing, blog, checkout, confirmation, scheduling, upsell, downsell, info. Defaults to 'landing' on frontend if null. |
| `author` | text | Author name (for blog/info pages) |
| `category` | text | Content category |

The RPC should include these new `landing_pages` columns in its SELECT.

### 6c. Landing Pages Tab → Renamed to "Pages"

The tab label still says "Landing Pages" in the tab bar (for familiarity) but the panel header now says "Pages" to reflect that it manages all page types. The filter bar allows switching between: All, Landing, Blog, Checkout, Scheduling, Upsell, Info.

---

## 7. Promotions Management

### 7a. Promotions Tab

A new "Promotions" tab in the Offer Studio dashboard provides full CRUD for the `page_promotions` table.

### 7b. Data Source

**Primary:** Tries RPC first:
```javascript
supabase.rpc('get_active_promotions', { p_brand_id: 'carlton', p_page_id: null, p_template_type: null })
```

**Fallback:** Direct table query:
```
GET /rest/v1/page_promotions
  ?brand_id=eq.carlton
  &select=promotion_id,title,body_text,cta_text,cta_url,placement,style_variant,priority,bg_color,text_color,target_page_type,starts_at,expires_at,status,created_at
  &order=priority,created_at.desc
```

**Note:** The RPC signature accepts `p_page_id` and `p_template_type` for targeted filtering, but the dashboard passes `null` for both to get ALL promotions for the brand.

### 7c. CRUD via Webhook

All promotion management goes through the PROMO-MANAGE webhook:

```
POST https://n8n.carltonaiservices.com/webhook/promo-manage
```

**Create:**
```json
{
  "action": "create",
  "brand_id": "carlton",
  "title": "Spring Sale Banner",
  "body_text": "20% off all scorecards this week",
  "placement": "banner_top",
  "style_variant": "urgent",
  "cta_text": "Shop Now",
  "cta_url": "/offers",
  "priority": 1,
  "target_page_type": "landing",
  "bg_color": "#dc2626",
  "text_color": "#ffffff",
  "starts_at": "2026-03-24T00:00:00.000Z",
  "expires_at": "2026-03-31T23:59:59.000Z"
}
```

**Pause:**
```json
{
  "action": "pause",
  "promotion_id": "PROMO_260324120000",
  "brand_id": "carlton"
}
```

**Activate:**
```json
{
  "action": "activate",
  "promotion_id": "PROMO_260324120000",
  "brand_id": "carlton"
}
```

**Delete:**
```json
{
  "action": "delete",
  "promotion_id": "PROMO_260324120000",
  "brand_id": "carlton"
}
```

### 7d. Placement Values

| Value | Description | Where It Renders |
|-------|-------------|-----------------|
| `banner_top` | Full-width banner above hero | Top of published page |
| `interstitial` | Inserted between sections | Between body sections on published page |
| `post_content` | Before footer | After last body section on published page |
| `banner_bottom` | Sticky bar at bottom | Fixed bottom bar on published page |
| `exit_intent` | Popup on mouse-leave | Exit intent popup on published page |

### 7e. Style Variants

| Value | Visual | Use Case |
|-------|--------|----------|
| `default` | Brand-colored background | General promotions |
| `urgent` | Red background, high contrast | Flash sales, deadlines |
| `success` | Green background | Win-back, positive messaging |
| `info` | Blue background | Informational banners |
| `premium` | Gold/amber background | Premium/exclusive offers |

### 7f. Expected Response Shape (from RPC or direct query)

```json
{
  "promotion_id": "PROMO_260324120000",
  "title": "Spring Sale",
  "body_text": "20% off all scorecards",
  "cta_text": "Shop Now",
  "cta_url": "/offers",
  "placement": "banner_top",
  "style_variant": "urgent",
  "priority": 1,
  "bg_color": "#dc2626",
  "text_color": "#ffffff",
  "target_page_type": "landing",
  "starts_at": "2026-03-24T00:00:00Z",
  "expires_at": "2026-03-31T23:59:59Z",
  "status": "active",
  "created_at": "2026-03-24T12:00:00Z"
}
```

### 7g. Realtime

The frontend subscribes to `postgres_changes` on `page_promotions`. Ensure realtime is enabled:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE page_promotions;
```

---

## 8. Summary of All Database Changes (Updated)

### New Tables

| Table | Purpose |
|-------|---------|
| `crm_sequence_steps` | Individual emails within a sequence — content, metrics, ordering |
| `landing_page_events` | Tracking events for landing pages (views, downloads, purchases) |
| `offer_interest` | Demand/follower tracking per offer (optional, for "demand" metric) |
| `brand_themes` | *Already deployed* — colors, fonts, logos per brand |
| `page_promotions` | *Already deployed* — ads/banners with placement, targeting, scheduling |

### Altered Tables

| Table | New Columns |
|-------|-------------|
| `crm_email_sequences` | `total_steps`, `trigger_event`, `subscribers_count`, `open_rate`, `click_rate`, `purchases`, `revenue_cents` |
| `landing_pages` | `page_type`, `fold_index`, `structured_data`, `canonical_url`, `author`, `published_date`, `category`, `related_page_ids`, `promotion_ids` (*already deployed*) + `downloads`, `purchases`, `revenue_cents` (new tracking) |

### New/Updated RPCs

| RPC | Action |
|-----|--------|
| `get_product_performance(p_brand_id)` | **New** — returns product performance table |
| `get_dashboard_landing_pages(p_brand_id)` | **Update** — add `page_type`, `author`, `category`, `downloads`, `purchases`, `revenue_cents` to return |
| `get_brand_theme(p_brand_id)` | *Already deployed* |
| `get_active_promotions(p_brand_id, p_page_id, p_template_type)` | *Already deployed* — dashboard calls with nulls to get all |
| `update_sequence_metrics()` | **New** — periodic aggregation of email sequence stats |

### Webhooks

| Endpoint | Status | Dashboard Usage |
|----------|--------|-----------------|
| `/webhook/offer-ideate` | Update needed | Handle 27 new `template_key` values + `ai_propose` |
| `/webhook/page-create` | *Already deployed* | Dashboard sends page creation requests with all fields |
| `/webhook/promo-manage` | *Already deployed* | Dashboard sends create/pause/activate/delete actions |
| `/webhook/lp-publish` | Existing | No change |

### Realtime Tables

| Table | Channel | Callback |
|-------|---------|----------|
| `offers` | `offer-studio-offers` | `fetchOffers()` |
| `offer_build_steps` | `offer-studio-steps` | `fetchOffers()` |
| `directive_tasks` | `offer-studio-tasks` | `fetchTasks()` |
| `landing_pages` | `offer-studio-lp` | `fetchLandingPages()` |
| `crm_testimonials` | `offer-studio-testimonials` | `fetchTestimonials()` |
| `crm_email_sequences` | `offer-studio-sequences` | `fetchEmailSequences()` |
| `page_promotions` | `offer-studio-promos` | `fetchPromotions()` |

---

## 9. Implementation Priority (Updated)

1. **`crm_email_sequences` ALTER + `crm_sequence_steps` CREATE** — Lights up Email Sequences tab
2. **Update `get_dashboard_landing_pages` RPC** — Add `page_type`, `author`, `category` to response
3. **`get_product_performance` RPC** — Lights up product performance in Revenue tab
4. **Landing page tracking** — `landing_page_events` + update RPC for downloads/purchases/revenue
5. **Template processing expansion** — Update `offer-ideate` for all 28 template types
6. **`ai_propose` market analysis** — AI-driven template selection
7. **Sequence metrics aggregation** — Schedule periodic runs
8. **Email tracking pipeline** — Send/open/click tracking
9. **Verify PAGE-CREATE handles all dashboard fields** — Ensure page_type, author, category, fold_index, offer_id are processed
10. **Verify PROMO-MANAGE handles all actions** — Ensure create/pause/activate/delete all work from dashboard

---

## 10. Testing Checklist

After each backend change, verify on the live frontend at `bradfordcarlton.com/offer-studio`:

- [ ] Email Sequences tab shows sequences with all metric columns populated
- [ ] Clicking a sequence card expands to show individual emails with editable fields
- [ ] Editing a subject/body/image/CTA and tabbing away triggers a save (check toast message)
- [ ] Revenue tab → Product Performance table shows products with units, revenue, demand, trend arrows
- [ ] Landing Pages tab shows Downloads, Purchases, Revenue columns with real data
- [ ] Landing Pages tab shows page_type pill for each page (landing, blog, etc.)
- [ ] Landing Pages filter pills correctly filter by page type
- [ ] Creating a page via the form produces a page visible in the table
- [ ] Creating a blog page sends author/category fields to the webhook
- [ ] Creating an offer with any of the 28 template types produces a valid proposal
- [ ] Creating an offer with "AI Propose Ideas" triggers market analysis
- [ ] Promotions tab shows all promotions with correct placement/style badges
- [ ] Creating a promotion via the form shows it in the grid
- [ ] Pause/Activate/Delete actions on promotions work
- [ ] Realtime: changes to `page_promotions` auto-refresh the Promotions tab
- [ ] Realtime: changes to `crm_email_sequences` auto-refresh the Email Sequences tab
