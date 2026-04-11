# Backend Handoff: Social Content Dashboard — Full Spec

> **Frontend status:** LIVE at `rdgr.bradfordcarlton.com/social-content`
> **Frontend file:** `sites/rdgr-dashboard/social-content.html`
> **Date:** 2026-03-29

---

## Overview

The Social Content Dashboard is a 5-tab page managing the content pipeline:

1. **Pillars** — Content pillar CRUD with editable generation instructions
2. **Content Queue** — Approve/reject/schedule posts
3. **Calendar** — Month/week view of scheduled posts
4. **Strategy** — Editorial calendar & bump log
5. **Config** — Per-platform posting limits, schedule strategy, content mix

The frontend is fully built and deployed. This document specifies everything the backend needs to support it.

---

## 1. Schema Changes Required

### 1.1 `social_calendar_config` — New Columns

The table exists with 4 rows (linkedin, twitter, instagram, facebook). **Add these columns:**

```sql
ALTER TABLE social_calendar_config
  ADD COLUMN IF NOT EXISTS schedule_mode text NOT NULL DEFAULT 'preferred_times',
  ADD COLUMN IF NOT EXISTS posting_windows jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS min_gap_minutes int NOT NULL DEFAULT 60;
```

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `schedule_mode` | TEXT | `'preferred_times'` | Active scheduling strategy: `'preferred_times'` or `'posting_windows'` |
| `posting_windows` | JSONB | `[]` | Array of `{"start":"HH:MM","end":"HH:MM","days":[1,2,3,4,5]}` objects |
| `min_gap_minutes` | INT | `60` | Min minutes between consecutive auto-posts (used in windows mode) |

### 1.2 `social_calendar_config` — Full Schema Reference

| Column | Type | Existing? | Purpose |
|--------|------|-----------|---------|
| `id` | SERIAL PK | Yes | |
| `brand_id` | TEXT | Yes | Always `"carlton"` |
| `platform` | TEXT | Yes | Platform key |
| `posts_per_day` | INT | Yes | Max posts per day |
| `posts_per_week` | INT | Yes | Max posts per week |
| `preferred_times` | TEXT[] | Yes | Specific posting times: `["09:00","12:00"]` |
| `active_days` | INT[] | Yes | Active days (ISO: 1=Mon, 7=Sun) |
| `content_mix` | JSONB | Yes | `{"engagement":0.2,"educational":0.3,...}` |
| `account_info` | JSONB | Yes | Platform credentials (read-only from frontend) |
| `is_active` | BOOLEAN | Yes | Platform enabled/disabled |
| `schedule_mode` | TEXT | **NEW** | `'preferred_times'` or `'posting_windows'` |
| `posting_windows` | JSONB | **NEW** | Time range windows with per-window day selection |
| `min_gap_minutes` | INT | **NEW** | Min gap between auto-posts |
| `created_at` | TIMESTAMPTZ | Yes | |
| `updated_at` | TIMESTAMPTZ | Yes | |
| UNIQUE | `(brand_id, platform)` | Yes | Required for upsert |

### 1.3 Ensure Upsert Works

The frontend uses `POST` with `Prefer: resolution=merge-duplicates` header. This requires the `(brand_id, platform)` unique constraint. Verify it exists:

```sql
-- Check if constraint exists; create if not:
ALTER TABLE social_calendar_config
  ADD CONSTRAINT social_calendar_config_brand_platform_unique
  UNIQUE (brand_id, platform);
```

---

## 2. RPCs the Frontend Calls

All RPCs must exist and return the expected shapes.

### 2.1 Content Pillars

| RPC | Parameters | Expected Return |
|-----|-----------|-----------------|
| `get_content_pillars` | `p_brand_id TEXT, p_active_only BOOLEAN` | `{pillars: [{id, brand_id, pillar_name, description, target_audience, active, source, generation_instructions, example_hooks, banned_angles, tone_overrides, content_formats, primary_keywords, sub_topics, min_frequency, max_frequency, total_generated, total_approved, total_rejected, approval_rate, last_used_at, suggested_action, suggestion_reason, instruction_version, last_aligned_at, alignment_source, previous_instructions, updated_by}], count, active_count}` |
| `upsert_content_pillar` | `p_brand_id, p_pillar_name, p_description, p_target_audience, p_primary_keywords TEXT[], p_sub_topics TEXT[], p_source TEXT, p_updated_by TEXT` | `{action: "created"\|"updated", id, pillar_name}` |
| `toggle_content_pillar` | `p_brand_id, p_pillar_id INT, p_active BOOLEAN, p_updated_by TEXT` | `{id, pillar_name, active}` |
| `delete_content_pillar` | `p_brand_id, p_pillar_id INT, p_hard_delete BOOLEAN` | `{id, pillar_name, action: "soft_deleted"\|"hard_deleted"}` |
| `compute_pillar_performance` | `p_brand_id, p_days INT, p_min_posts INT` | `{pillars_analyzed, results: [{pillar_id, approval_rate, total_generated, suggested_action, suggestion_reason}]}` |

### 2.2 Content Calendar

| RPC | Parameters | Expected Return |
|-----|-----------|-----------------|
| `get_content_calendar` | `p_brand_id, p_start_date DATE, p_end_date DATE, p_platforms TEXT[], p_statuses TEXT[]` | `{posts: [{id, brand_id, platform, content_text, hashtags, content_category, status, priority, scheduled_at, created_at, posted_at, generation_batch_id, image_prompt, suggested_cta, approved_by, approved_at, bumped_by, original_scheduled_at, bump_count}], count, date_range}` |
| `get_content_calendar_stats` | `p_brand_id, p_start_date DATE, p_end_date DATE` | `{total_posts, approval_rate, bump_count, by_day: [{date, count}], by_platform: [{platform, count}], by_status: [{status, count}]}` |
| `get_bump_log` | `p_brand_id, p_limit INT` | `{bumps: [{created_at, platform, original_scheduled_at, new_scheduled_at, displaced_count, reason}], count}` |

### 2.3 Bumping

| RPC | Parameters | Expected Return |
|-----|-----------|-----------------|
| `bump_content_queue` | `p_brand_id, p_new_post JSONB, p_scheduled_at TIMESTAMPTZ, p_bump_strategy TEXT` | `{new_post_id, displaced_posts[], displaced_count}` |
| `reschedule_content_post` | `p_queue_id INT, p_new_scheduled_at TIMESTAMPTZ, p_cascade BOOLEAN` | `{old_scheduled_at, new_scheduled_at, displaced_posts[]}` |

---

## 3. Webhooks the Frontend Calls

Base URL: `https://n8n.carltonaiservices.com/webhook`
Method: POST, no auth headers.

### 3.1 Content Approval

**Endpoint:** `content-approve-v2`

| Action | Payload | Expected Behavior |
|--------|---------|-------------------|
| Approve | `{action: "approve", queue_ids: [int]}` | Set status to `approved` |
| Approve + Schedule | `{action: "approve", queue_ids: [int], scheduled_at: "ISO datetime"}` | Set status to `scheduled`, set `scheduled_at` |
| Reject | `{action: "reject", queue_ids: [int], rejection_reason: "text"}` | Set status to `rejected` |
| Request Edits | `{action: "request_edits", queue_ids: [int], rejection_reason: "feedback"}` | Set status to `revision_requested` |

### 3.2 Content Bumping

**Endpoint:** `content-bump`

| Operation | Payload | Expected Behavior |
|-----------|---------|-------------------|
| Reschedule | `{operation: "reschedule", queue_id: int, scheduled_at: "ISO datetime"}` | Update `scheduled_at`, log bump |
| News Flash | `{operation: "insert_and_bump", brand_id: "carlton", platform: string, title: string, content_text: string, scheduled_at: "ISO datetime", bump_strategy: "cascade"}` | Insert new post, cascade-bump existing posts |

### 3.3 Content Generation

| Endpoint | Payload | Purpose |
|----------|---------|---------|
| `content-pillar-align` | `{brand_id: "carlton"}` | Force brand-to-pillar instruction realignment |
| `content-daily-engine-v2` | `{brand_id: "carlton"}` | Trigger daily content generation |
| `content-strategist-v2` | `{brand_id: "carlton", force: true}` | Trigger weekly editorial plan generation |

---

## 4. How `content-daily-engine-v2` Should Use Config

This is the critical integration. The content generation/scheduling workflow should read `social_calendar_config` to constrain what it produces.

### 4.1 Read Config

```sql
SELECT platform, posts_per_day, posts_per_week, schedule_mode,
       preferred_times, posting_windows, min_gap_minutes,
       active_days, content_mix, is_active
FROM social_calendar_config
WHERE brand_id = 'carlton' AND is_active = true;
```

### 4.2 Enforce Limits

For each platform:

1. **Check `is_active`** — skip platform entirely if false
2. **Check `active_days`** — only generate/schedule on days in the array (1=Mon, 7=Sun)
3. **Respect `posts_per_day`** — count existing scheduled/approved/posted items for today; don't exceed limit
4. **Respect `posts_per_week`** — count existing items for the current week; don't exceed limit

### 4.3 Schedule Based on Mode

**If `schedule_mode = 'preferred_times'`:**
- Schedule posts at the exact times in `preferred_times` array (e.g., `["09:00","12:00","17:00"]`)
- These are Pacific time strings
- Assign one post per time slot, up to `posts_per_day`
- If more posts than slots, queue extras as `approved` without `scheduled_at`

**If `schedule_mode = 'posting_windows'`:**
- Schedule posts within the defined windows: `[{"start":"08:00","end":"12:00","days":[1,2,3,4,5]}, ...]`
- Each window has its own day restriction
- Respect `min_gap_minutes` between consecutive posts
- Distribute posts evenly across windows
- Example: 2 posts/day, window 08:00-18:00, gap 60min → schedule at ~10:00 and ~14:00

### 4.4 Content Mix

The `content_mix` object defines the target distribution:
```json
{"engagement": 0.2, "educational": 0.3, "promotional": 0.2, "thought_leadership": 0.3}
```

When assigning content categories/pillars to generated posts, aim for this distribution across the week. Values sum to 1.0.

---

## 5. Future: `compute_posting_suggestions` RPC

The frontend currently computes suggestions client-side (limited to post frequency analysis). A server-side RPC would enable richer analysis.

### Proposed Signature

```sql
CREATE OR REPLACE FUNCTION compute_posting_suggestions(
    p_brand_id text,
    p_platform text DEFAULT NULL,  -- NULL = all platforms
    p_days int DEFAULT 30
) RETURNS jsonb AS $$
-- Analyze social_content_queue for the given platform
-- Group by hour-of-day and day-of-week
-- Compare engagement metrics by time slot
-- Generate suggestion objects and write to social_calendar_config.suggestions
$$;
```

### Suggestion Object Shape

```json
{
    "id": "sug_001",
    "type": "optimal_times",
    "message": "Posts at 3pm get 2.3x more engagement than your current 9am slot on LinkedIn.",
    "recommended_times": ["15:00"],
    "confidence": "high",
    "data_points": 47,
    "generated_at": "2026-03-28T10:00:00Z"
}
```

Types: `optimal_times` (with `recommended_times`), `daily_limit` (with `recommended_value`), `info` (message only).

This RPC could be triggered:
- On-demand via the frontend "Analyze" button
- On a weekly schedule via n8n workflow
- After every batch of posts is published

---

## 6. Tables Read by Frontend (Summary)

| Table | Access | Via |
|-------|--------|-----|
| `content_pillars` | Read + Write | RPCs + Direct PATCH |
| `social_content_queue` | Read only | RPCs + Direct GET |
| `editorial_calendar` | Read only | Direct GET |
| `social_calendar_config` | Read + Write | Direct GET + UPSERT |

---

## 7. Platform Keys Reference

The frontend recognizes these platform keys. Any platform key works — the UI renders dynamically.

| Key | Label | Has Config Row? |
|-----|-------|-----------------|
| `linkedin` | LinkedIn | Yes (existing) |
| `twitter` | Twitter / X | Yes (existing) |
| `facebook` | Facebook | Yes (existing) |
| `instagram` | Instagram | Yes (existing) |
| `reddit` | Reddit | No (shows defaults) |
| `blog` | Blog | No (shows defaults) |
| `newsletter` | Newsletter | No (shows defaults) |

To add a new platform: insert a row in `social_calendar_config` with the platform key. The frontend picks it up automatically.

---

## 8. RLS / Permissions

All frontend calls use the Supabase anon key. Ensure:
- **Read**: anon can SELECT from `content_pillars`, `social_content_queue`, `editorial_calendar`, `social_calendar_config`
- **Write**: anon can INSERT/UPDATE on `social_calendar_config` (for config saves)
- **Write**: anon can UPDATE on `content_pillars` (for instruction edits, suggestion dismissals)
- **RPC**: All listed RPCs are accessible to anon role
