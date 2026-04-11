# Backend Spec: Twitter/X Auto-Posting & Affiliate Marketing Engine

> **Origin**: Inspired by [MoneyPrinterV2](https://github.com/FujiwaraChoki/MoneyPrinterV2) — evaluated 2026-03-25
> **Author**: Frontend developer (handoff to backend)
> **Status**: Ready for backend implementation

---

## Overview

Two new capabilities to add to the Carlton AI system:

1. **Twitter/X Auto-Posting** — Bridge the gap between "approved draft" and "live tweet" with strict rate limiting
2. **Affiliate Marketing Engine** — Scrape products, generate pitches, post with affiliate links

---

## Existing Infrastructure (Already Built)

### Twitter/X Posting
| Asset | ID | Status | Purpose |
|-------|----|--------|---------|
| **RDGR-TOOL-POST-TWITTER** | `P4x9LB2Wl0AK7P77` | ACTIVE | Primary posting utility — webhook → route by type (text/image/thread) → post via Twitter v2 API. Handles media uploads via v1.1 API. **Modify this in place.** |
| **Rodger Twitter Posting Bot** | `cwMCoX97uFdwKK3T` | INACTIVE | Older Rodger-based flow with LangChain agents, Slack confirmations, Google Sheets tracking. Reference for approval/confirmation patterns. |
| **X Posting Nodes** | `4rYPu6ulNMKJVj5W` | ARCHIVED | Reference for raw API patterns (media upload, v2 posting). |

### Credentials
- **X OAuth 2 - BC** (ID: `KOb5OBW8JMDuPkb0`) — OAuth 2.0 for Twitter v2 API (tweet posting)
- **X OAuth - BC** (ID: `R9f0H3ngkvEdS9Qi`) — OAuth 1.0 for Twitter v1.1 API (media uploads)
- Account: `drbradcarlton`

### Frontend (already built, will consume these backends)
- Social dashboard at `rdgr.bradfordcarlton.com/social-dashboard` with approval queue, voice settings, quick post modal
- Offer Studio at `rdgr.bradfordcarlton.com/offer-studio` with offers, landing pages, promotions, revenue

### Supabase Tables (existing)
- `social_content_queue` — queued social posts (needs schema additions)
- `social_outreach_drafts` — AI-generated outreach messages
- `social_targets` — discovered social prospects
- `social_calendar_config` — daily action limits per platform
- `social_voice_settings` — per-platform voice/tone configuration

---

## CRITICAL CONSTRAINT: X API Free Tier

**Hard limit: 17 posts per rolling 24-hour window.**

This must be strictly tracked at all times, including during testing. Every post attempt (manual, automated, or test) must be logged and counted. The rate tracker is the foundation — build it FIRST before any auto-posting logic.

---

## Part 1: X Post Rate Tracker (BUILD FIRST — Priority 1)

### New Supabase Table: `x_post_tracker`

```sql
CREATE TABLE x_post_tracker (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tweet_id text,
  content_text text,
  post_type text NOT NULL DEFAULT 'text',  -- text | image | thread
  posted_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',   -- manual | auto | test
  brand_id text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for fast rolling-window queries
CREATE INDEX idx_x_post_tracker_brand_window
  ON x_post_tracker (brand_id, posted_at DESC)
  WHERE success = true;
```

### New Supabase RPC: `get_x_posts_remaining`

```sql
CREATE OR REPLACE FUNCTION get_x_posts_remaining(p_brand_id text)
RETURNS jsonb AS $$
DECLARE
  v_window_start timestamptz;
  v_posts_used int;
  v_hard_cap int := 17;
  v_oldest_post timestamptz;
BEGIN
  v_window_start := now() - interval '24 hours';

  SELECT count(*), min(posted_at) INTO v_posts_used, v_oldest_post
  FROM x_post_tracker
  WHERE brand_id = p_brand_id
    AND success = true
    AND posted_at >= v_window_start;

  RETURN jsonb_build_object(
    'posts_used', v_posts_used,
    'posts_remaining', GREATEST(0, v_hard_cap - v_posts_used),
    'hard_cap', v_hard_cap,
    'can_post', v_posts_used < v_hard_cap,
    'window_start', v_window_start,
    'window_resets_at', CASE
      WHEN v_oldest_post IS NOT NULL THEN v_oldest_post + interval '24 hours'
      ELSE now()
    END,
    'next_slot_at', CASE
      WHEN v_posts_used < v_hard_cap THEN now()
      ELSE v_oldest_post + interval '24 hours'
    END
  );
END;
$$ LANGUAGE plpgsql;
```

### New n8n Workflow: `X-RATE-CHECK`

- **Webhook**: `POST /webhook/x-rate-check`
- **Input**: `{ brand_id }`
- **Flow**:
  1. Call Supabase RPC `get_x_posts_remaining(brand_id)`
  2. Return result as JSON
- **Output**:
```json
{
  "can_post": true,
  "posts_used": 5,
  "posts_remaining": 12,
  "hard_cap": 17,
  "window_resets_at": "2026-03-26T14:30:00Z",
  "next_slot_at": "2026-03-25T14:30:00Z"
}
```

### Update: `RDGR-TOOL-POST-TWITTER` (ID: `P4x9LB2Wl0AK7P77`)

Add these steps **before** the existing routing logic:

1. **Rate Check Gate**: Call `X-RATE-CHECK` → if `can_post === false`, respond immediately:
   ```json
   {
     "success": false,
     "error": "X API rate limit reached",
     "rate": { "used": 17, "remaining": 0, "resets_at": "..." }
   }
   ```
2. **Post-Success Logging**: After successful tweet, insert into `x_post_tracker`:
   ```json
   {
     "tweet_id": "<from API response>",
     "content_text": "<posted text>",
     "post_type": "<text|image|thread>",
     "source": "<from input or 'manual'>",
     "brand_id": "<from input>",
     "success": true
   }
   ```
3. **Post-Failure Logging**: On API error, insert with `success: false` and `error_message`
4. **Updated Response**: Include rate limit info in every response:
   ```json
   {
     "success": true,
     "post_id": "...",
     "post_url": "https://x.com/drbradcarlton/status/...",
     "platform": "twitter",
     "rate": { "used": 6, "remaining": 11, "resets_at": "..." }
   }
   ```

---

## Part 2: X Auto-Post Scheduler (Priority 2)

### Schema Additions: `social_content_queue`

```sql
ALTER TABLE social_content_queue
  ADD COLUMN IF NOT EXISTS tweet_id text,
  ADD COLUMN IF NOT EXISTS post_url text,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,  -- NULL = post ASAP
  ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;
```

### New n8n Workflow: `X-AUTO-POST`

- **Triggers**:
  - CRON: every 2 hours
  - Webhook: `POST /webhook/x-auto-post` (for "Post Now" from frontend)
- **Input** (webhook): `{ brand_id, queue_id? }` — if `queue_id` provided, post that specific item
- **Flow**:

```
1. Call X-RATE-CHECK
   └─ If can_post === false → exit silently (CRON) or return error (webhook)

2. Query social_content_queue:
   WHERE platform = 'twitter'
     AND status = 'approved'
     AND (scheduled_at <= NOW() OR scheduled_at IS NULL)
     AND retry_count < 3
   ORDER BY
     CASE WHEN queue_id IS NOT NULL AND id = queue_id THEN 0 ELSE 1 END,  -- "Post Now" first
     scheduled_at ASC NULLS LAST,  -- scheduled posts before ASAP
     priority DESC,
     created_at ASC
   LIMIT posts_remaining

3. For each queued post:
   a. Check minimum 15-minute gap since last auto-post (anti-bot spacing)
   b. Call RDGR-TOOL-POST-TWITTER with:
      { post_type, content_text, hashtags, media_urls, brand_id, source: 'auto' }
   c. On success:
      - UPDATE social_content_queue SET
          status = 'posted',
          tweet_id = <response.post_id>,
          post_url = <response.post_url>,
          posted_at = NOW()
   d. On failure:
      - UPDATE social_content_queue SET
          retry_count = retry_count + 1,
          last_error = <error message>,
          status = CASE WHEN retry_count >= 2 THEN 'failed' ELSE status END

4. Return summary:
   { success: true, posted_count: N, failed_count: M, rate: { used, remaining } }
```

### Scheduling Rules
- Respect BOTH `social_calendar_config` daily limits AND X API 17/24h hard cap (use whichever is lower)
- Minimum 15-minute gap between auto-posts (avoid bot-like behavior)
- Priority ordering: manual "Post Now" > scheduled time arrived > FIFO by created_at
- Max 3 retry attempts per post — after 3 failures, mark as `failed` and skip

---

## Part 3: Affiliate Marketing Engine (Priority 3)

### New Supabase Tables

#### `affiliate_products`
```sql
CREATE TABLE affiliate_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id text NOT NULL,
  source_url text NOT NULL,
  source_platform text NOT NULL DEFAULT 'amazon',  -- amazon | other
  affiliate_link text,
  title text,
  price_cents int,
  description text,
  features jsonb DEFAULT '[]'::jsonb,
  images jsonb DEFAULT '[]'::jsonb,
  category text,
  status text NOT NULL DEFAULT 'active',  -- active | paused | retired
  scrape_data jsonb DEFAULT '{}'::jsonb,  -- raw scrape response for debugging
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_affiliate_products_brand ON affiliate_products (brand_id, status);
```

#### `affiliate_pitches`
```sql
CREATE TABLE affiliate_pitches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES affiliate_products(id),
  brand_id text NOT NULL,
  target_platform text NOT NULL,  -- twitter | linkedin | facebook | instagram
  content_text text NOT NULL,
  hashtags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',  -- draft | approved | posted | rejected
  social_queue_id uuid,  -- FK to social_content_queue once queued
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_affiliate_pitches_product ON affiliate_pitches (product_id, status);
```

#### `affiliate_performance`
```sql
CREATE TABLE affiliate_performance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES affiliate_products(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  clicks int DEFAULT 0,
  conversions int DEFAULT 0,
  revenue_cents int DEFAULT 0,
  UNIQUE(product_id, date)
);

CREATE INDEX idx_affiliate_performance_date ON affiliate_performance (product_id, date DESC);
```

### New n8n Workflow: `AFFILIATE-SCRAPE`

- **Webhook**: `POST /webhook/affiliate-scrape`
- **Input**:
```json
{
  "url": "https://amazon.com/dp/B0...",
  "brand_id": "carlton-ai",
  "source_platform": "amazon"  // optional, auto-detected from URL
}
```
- **Flow**:
  1. Detect platform from URL (amazon.com → "amazon", else "other")
  2. **For Amazon**: Use Apify Amazon Product Scraper actor (reliable, structured data)
     - Or fallback: HTTP Request + Code node to parse HTML
  3. Extract: title, price, description, features array, image URLs
  4. Upsert to `affiliate_products` table
  5. Return product preview

- **Output**:
```json
{
  "success": true,
  "product": {
    "id": "uuid",
    "title": "Product Name",
    "price_cents": 2999,
    "description": "...",
    "features": ["Feature 1", "Feature 2"],
    "images": ["https://..."],
    "source_platform": "amazon",
    "status": "active"
  }
}
```

- **Error handling**: If scraping fails, return structured error so frontend can offer manual entry form:
```json
{
  "success": false,
  "error": "Could not extract product data",
  "partial_data": { "title": "...", "url": "..." },
  "suggestion": "manual_entry"
}
```

### New n8n Workflow: `AFFILIATE-PITCH-GEN`

- **Webhook**: `POST /webhook/affiliate-pitch`
- **Input**:
```json
{
  "product_id": "uuid",
  "platforms": ["twitter", "linkedin"],
  "voice_settings": { ... },  // optional override, else fetch from social_voice_settings
  "brand_id": "carlton-ai",
  "auto_queue": false  // if true, push approved pitches directly to social_content_queue
}
```
- **Flow**:
  1. Fetch product from `affiliate_products`
  2. Fetch brand voice settings from `social_voice_settings` table (or use override)
  3. For each target platform:
     - Build OpenAI prompt with product data + voice settings + platform constraints
     - Platform-specific rules:
       - **Twitter**: Max 280 chars including affiliate link, generate 2-3 hashtags
       - **LinkedIn**: Max 3000 chars, professional tone, no hashtag spam
       - **Instagram**: Focus on visual hooks, include CTA, up to 30 hashtags
     - Append affiliate link to generated content
  4. Insert pitches to `affiliate_pitches` (status=draft)
  5. If `auto_queue: true` → also insert to `social_content_queue` with status=pending_approval
  6. Return generated pitches

- **Output**:
```json
{
  "success": true,
  "pitches": [
    {
      "id": "uuid",
      "platform": "twitter",
      "content_text": "Just found this game-changer for...\nhttps://amzn.to/...",
      "hashtags": ["#productivity", "#techtools"],
      "status": "draft",
      "char_count": 247
    }
  ]
}
```

### New n8n Workflow: `AFFILIATE-MANAGE` (CRUD)

- **Webhook**: `POST /webhook/affiliate-manage`
- **Input**:
```json
{
  "action": "list | get | update | delete",
  "brand_id": "carlton-ai",
  "product_id": "uuid",           // required for get/update/delete
  "filters": { "status": "active" }, // for list
  "data": { "status": "paused" }   // for update
}
```
- Standard CRUD against `affiliate_products` table
- `list` supports filtering by status, category, source_platform
- `delete` soft-deletes (sets status=retired)

---

## Part 4: Frontend Contract

### Webhook Endpoints (what frontend will call)

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/webhook/x-rate-check` | POST | `{ brand_id }` | `{ can_post, posts_used, posts_remaining, hard_cap, next_slot_at, window_resets_at }` |
| `/webhook/x-auto-post` | POST | `{ brand_id, queue_id? }` | `{ success, posted_count, failed_count, rate: {...} }` |
| `/webhook/affiliate-scrape` | POST | `{ url, brand_id, source_platform? }` | `{ success, product: {...} }` |
| `/webhook/affiliate-pitch` | POST | `{ product_id, platforms[], voice_settings?, brand_id, auto_queue? }` | `{ success, pitches: [...] }` |
| `/webhook/affiliate-manage` | POST | `{ action, brand_id, product_id?, filters?, data? }` | varies by action |

### Supabase Realtime Subscriptions (frontend will subscribe to)

| Table | Events | Frontend Use |
|-------|--------|-------------|
| `x_post_tracker` | INSERT | Live rate limit counter on social dashboard |
| `affiliate_products` | INSERT, UPDATE | Product library in Affiliates tab |
| `affiliate_pitches` | INSERT, UPDATE | Pitch status updates |
| `social_content_queue` | UPDATE | Post status changes (approved → posted) |

### Status Enums

**`affiliate_products.status`**: `active` → `paused` → `retired`
**`affiliate_pitches.status`**: `draft` → `approved` → `posted` | `rejected`
**`social_content_queue.status` (additions)**: `posted` (new terminal state), `failed` (new error state after 3 retries)

---

## Part 5: Build Order

| Step | What | Depends On | Estimated Effort |
|------|------|-----------|-----------------|
| 1 | `x_post_tracker` table + `get_x_posts_remaining` RPC | Nothing | Small |
| 2 | `X-RATE-CHECK` workflow | Step 1 | Small |
| 3 | Update `RDGR-TOOL-POST-TWITTER` — add rate check gate + logging | Steps 1-2 | Medium |
| 4 | `social_content_queue` schema additions | Nothing | Small |
| 5 | `X-AUTO-POST` workflow | Steps 1-4 | Medium |
| 6 | `affiliate_products` + `affiliate_pitches` + `affiliate_performance` tables | Nothing | Small |
| 7 | `AFFILIATE-SCRAPE` workflow | Step 6 | Medium |
| 8 | `AFFILIATE-PITCH-GEN` workflow | Step 6 | Medium |
| 9 | `AFFILIATE-MANAGE` workflow (CRUD) | Step 6 | Small |

**Steps 1-5** (Twitter auto-posting) should be completed and tested before steps 6-9 (affiliate engine).

**Steps 6-9** can be built in parallel since they share the same tables but are independent workflows.

---

## Testing Notes

- **Rate tracker testing**: Before testing any posting, verify `get_x_posts_remaining` returns accurate counts. Every test post counts against the 17/24h limit.
- **Use `source: 'test'` for test posts** so they can be identified in the tracker, but they STILL count against the rate limit.
- **AFFILIATE-SCRAPE testing**: Test with a known Amazon product URL first. Verify extracted data matches the actual listing.
- **Thread posting**: Remember thread tweets count as multiple posts against the rate limit (a 5-tweet thread = 5 posts used).

---

## System Registry Entries (register after building)

```json
[
  { "name": "x-rate-check", "category": "workflow", "metadata": { "id": "<new>", "webhook": "/webhook/x-rate-check" }},
  { "name": "x-auto-post", "category": "workflow", "metadata": { "id": "<new>", "webhook": "/webhook/x-auto-post" }},
  { "name": "affiliate-scrape", "category": "workflow", "metadata": { "id": "<new>", "webhook": "/webhook/affiliate-scrape" }},
  { "name": "affiliate-pitch-gen", "category": "workflow", "metadata": { "id": "<new>", "webhook": "/webhook/affiliate-pitch" }},
  { "name": "affiliate-manage", "category": "workflow", "metadata": { "id": "<new>", "webhook": "/webhook/affiliate-manage" }},
  { "name": "x_post_tracker", "category": "supabase_table", "metadata": { "purpose": "X API rate limit tracking" }},
  { "name": "affiliate_products", "category": "supabase_table", "metadata": { "purpose": "Affiliate product library" }},
  { "name": "affiliate_pitches", "category": "supabase_table", "metadata": { "purpose": "Generated affiliate content" }},
  { "name": "affiliate_performance", "category": "supabase_table", "metadata": { "purpose": "Affiliate click/conversion tracking" }}
]
```
