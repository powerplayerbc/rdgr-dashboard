# Frontend Spec: Social Content Dashboard

## Overview
A new page at `/social-content` (or as a sub-tab under Outreach > SOCIAL) that replaces the Google Sheets content calendar with a live Supabase-powered dashboard. Shows content pillars, content queue, editorial calendar, and performance analytics.

**Data source:** All data reads from Supabase RPCs (no Google Sheets). All mutations go through n8n webhooks or direct Supabase PATCH.

**Architecture:** The content system is a self-correcting pipeline:
1. **Brand identity** (via BRAND-DISCOVERY) defines who we are
2. **CONTENT-PILLAR-ALIGN** automatically regenerates pillar instructions whenever brand identity changes
3. **Pillar assignment is deterministic** — a weighted rotation algorithm assigns one pillar per platform per batch (not GPT)
4. **GPT follows pillar instructions** — approach, angle, story type, CTA style, do/don't lists are hard constraints
5. **Performance feeds back** — approval rates per pillar drive rotation weights and system suggestions (deactivate/boost)
6. **Human retains control** — Bradford can edit pillar instructions, add/remove pillars, override suggestions

---

## Page Layout: 4 Sub-Tabs

### Tab 1: Content Pillars

**Purpose:** Manage the canonical content pillars that drive all content generation. Each pillar is not just a label — it contains structured generation instructions that deterministically control what GPT writes. The system assigns pillars to posts using a weighted rotation algorithm, and GPT follows the pillar's instructions precisely.

**RPC:** `get_content_pillars(p_brand_id, p_active_only)`

**Display:** Card grid showing each pillar with:

**Card Header:**
- Pillar name (editable inline)
- Active toggle (green/grey switch)
- Source badge: `manual` (blue) | `system` (purple) | `brand_discovery` (gold)
- System suggestion badge: `deactivate` (red warning) | `boost` (green star) | none
- Alignment status indicator: `last_aligned_at` timestamp + `alignment_source` badge

**Card Body (expandable):**
- Description (editable)
- Target audience (editable)
- Performance bar: `approval_rate` as colored bar (red <20%, yellow 20-60%, green >60%)
- Stats row: `total_generated` / `total_approved` / `total_rejected` / `last_used_at`
- Version badge: `instruction_version` (shows how many times instructions have been updated)

**Card Detail Panel (click to expand — the core of how content is shaped):**

| Field | Type | Purpose | Editable? |
|-------|------|---------|-----------|
| `generation_instructions.approach` | Text | How to structure the post (lead with problem, show fix, etc.) | Yes |
| `generation_instructions.angle` | Text | The perspective/authority to write from | Yes |
| `generation_instructions.story_type` | Select | `client_transformation`, `revenue_recovery`, `problem_solution`, `personal_transformation`, `contrarian_insight`, `industry_war_story`, `efficiency_gain` | Yes |
| `generation_instructions.cta_style` | Text | What kind of CTA to use (offer a template, ask for DM, etc.) | Yes |
| `generation_instructions.proof_points` | Tag list | Types of evidence to include (hours saved, revenue recovered, etc.) | Yes |
| `generation_instructions.do_list` | Checklist | Things the GPT MUST do in every post for this pillar | Yes |
| `generation_instructions.dont_list` | Checklist | Things the GPT must NEVER do for this pillar | Yes |
| `example_hooks` | Text list | Example opening lines to emulate (GPT sees 2 per generation) | Yes |
| `banned_angles` | Tag list | Specific angles/framings to NEVER use | Yes |
| `tone_overrides` | Sliders | Per-pillar tone adjustments (confidence, empathy, warmth, etc.) | Yes |
| `content_formats` | Multi-select | Allowed formats: `post`, `thread`, `how_to`, `case_study`, `story`, `comparison`, `listicle` | Yes |
| `primary_keywords` | Tag list | SEO/topic keywords associated with this pillar | Yes |
| `sub_topics` | Tag list | Specific sub-topics within this pillar | Yes |
| `min_frequency` / `max_frequency` | Number | How often this pillar should appear per week (min/max) | Yes |

**How these fields control content generation:**
1. The **Assign Pillars** Code node deterministically selects which pillar each platform-post gets (weighted rotation: recency penalty + performance bonus + underuse bonus)
2. The **Build Content Prompt** Code node passes each pillar's `generation_instructions`, `example_hooks`, `banned_angles`, and `tone_overrides` directly into the GPT prompt as hard constraints
3. GPT generates content following these instructions — it does NOT choose the topic, angle, or CTA style on its own
4. The `content_category` field in every generated post exactly matches the `pillar_name`

**How brand alignment works (automatic):**
- When brand identity is updated via BRAND-DISCOVERY, the **CONTENT-PILLAR-ALIGN** workflow is triggered automatically
- It loads the updated brand context, then for each active pillar, GPT regenerates the `generation_instructions`, `example_hooks`, and `banned_angles` to align with the new brand identity
- Previous instructions are preserved in `previous_instructions` for audit/rollback
- `instruction_version` increments, `last_aligned_at` updates, `alignment_source` shows what triggered it
- Also runs weekly on schedule as a drift-catch safety net

**Actions:**
| Action | Webhook/RPC | Payload |
|--------|-------------|---------|
| Add new pillar | `upsert_content_pillar` RPC | `{p_brand_id, p_pillar_name, p_description, p_source: "manual"}` |
| Edit pillar metadata | `upsert_content_pillar` RPC | `{p_brand_id, p_pillar_name, p_description, p_target_audience}` |
| Edit generation instructions | Direct Supabase PATCH | `PATCH content_pillars SET generation_instructions=..., example_hooks=..., banned_angles=..., tone_overrides=... WHERE id=?` |
| Toggle active | `toggle_content_pillar` RPC | `{p_brand_id, p_pillar_id, p_active}` |
| Delete pillar | `delete_content_pillar` RPC | `{p_brand_id, p_pillar_id}` |
| Refresh performance | `compute_pillar_performance` RPC | `{p_brand_id, p_days: 30}` |
| Accept suggestion | `toggle_content_pillar` RPC | `{p_brand_id, p_pillar_id, p_active: false}` |
| Dismiss suggestion | Direct Supabase PATCH | `PATCH content_pillars SET suggested_action=null WHERE id=?` |
| Force brand re-alignment | `content-pillar-align` webhook | `{brand_id: "carlton"}` |
| Trigger content generation | `content-daily-engine-v2` webhook | `{brand_id: "carlton"}` |
| Trigger weekly strategy | `content-strategist-v2` webhook | `{brand_id: "carlton", force: true}` |

**Add Pillar Form (expanded):**
- Pillar name (required)
- Description (required)
- Target audience (required)
- Approach — how to structure posts (required)
- Angle — writing perspective (required)
- Story type — dropdown (required)
- CTA style — what to offer (required)
- Do list — checklist items (at least 2)
- Don't list — checklist items (at least 2)
- Example hooks — 2-3 opening lines to emulate
- Banned angles — topics/framings to avoid
- Primary keywords — tag input
- Content formats — multi-select

---

### Tab 2: Content Queue (The Table That Was On Google Sheets)

**Purpose:** Shows all generated content posts with their status, scheduled time, and approval actions. This is the main operational view Bradford works from.

**RPC:** `get_content_calendar(p_brand_id, p_start_date, p_end_date, p_platforms, p_statuses)`

**Display:** Data table with columns:
| Column | Type | Notes |
|--------|------|-------|
| Status | Badge | `pending_approval` (amber), `scheduled` (blue), `approved` (green), `posted` (dark green), `rejected` (red), `revision_requested` (orange) |
| Date | Date | `scheduled_at` or `created_at` if not scheduled |
| Platform | Icon + text | LinkedIn, Twitter, Instagram, Facebook, blog, newsletter |
| Pillar | Tag | `content_category` field — always matches a canonical `content_pillars.pillar_name` |
| Title | Text | Clickable to expand full content |
| Priority | Number | 1 = breaking (red), 3 = normal (grey) |
| Bump | Badge | Shows if `bumped_by` is not null, with tooltip showing original time |
| Actions | Buttons | Approve, Reject, Reschedule, Bump (based on status) |

**Filters (top bar):**
- Date range picker (default: this week)
- Platform multi-select
- Status multi-select
- Pillar multi-select (values come from `content_pillars.pillar_name` — always in sync)

**Expandable Row Detail:**
When a row is clicked, show:
- Full `content_text`
- `hashtags` as tags
- `image_prompt` (if any)
- `suggested_cta`
- `generation_batch_id`
- Approval history (approved_by, approved_at)
- Bump history (bumped_by, original_scheduled_at, bump_count)

**Actions:**
| Action | Webhook | Payload |
|--------|---------|---------|
| Approve (single) | `content-approve-v2` | `{action: "approve", queue_ids: [id], scheduled_at: "optional datetime"}` |
| Approve with schedule | `content-approve-v2` | `{action: "approve", queue_ids: [id], scheduled_at: "2026-04-01T09:00:00-07:00"}` |
| Approve all in batch | `content-approve-v2` | `{action: "approve_all", batch_id: "CONTENT-..."}` |
| Batch approve with per-item schedule | `content-approve-v2` | `{action: "approve_all", batch_id: "...", schedule_items: [{queue_id: 42, scheduled_at: "..."}]}` |
| Reject | `content-approve-v2` | `{action: "reject", queue_ids: [id], rejection_reason: "text"}` |
| Request edits | `content-approve-v2` | `{action: "request_edits", queue_ids: [id], rejection_reason: "feedback"}` |
| Reschedule | `content-bump` | `{operation: "reschedule", queue_id: id, scheduled_at: "new time"}` |
| News flash bump | `content-bump` | `{operation: "insert_and_bump", brand_id, platform, title, content_text, scheduled_at, bump_strategy: "cascade"}` |

---

### Tab 3: Calendar View

**Purpose:** Visual month/week grid showing scheduled posts by date.

**RPC:** `get_content_calendar(p_brand_id, p_start_date, p_end_date)`
**Stats RPC:** `get_content_calendar_stats(p_brand_id, p_start_date, p_end_date)`

**Display:**
- Month grid (like Google Calendar) with day cells
- Each day cell shows colored dots per post (color = platform)
- Click a day to see all posts for that day in a slide-out panel
- Header shows: total posts, approval rate, bump count from stats RPC

**Header widgets:**
- Posts this period: `total_posts`
- Approval rate: `approval_rate`
- Platform breakdown: mini bar chart from `by_platform`
- Bumps: `bump_count`

---

### Tab 4: Editorial Calendar & Strategy

**Purpose:** Shows the weekly editorial plan generated by CONTENT-STRATEGIST-V2.

**Data source:** Direct Supabase read from `editorial_calendar` table:
```
GET /rest/v1/editorial_calendar?brand_id=eq.carlton&order=id.desc&limit=5
```

**Display:**
- Current week's plan as a 7-day card layout
- Each card shows: date, theme, platform, pillar, content_format, priority, brief
- Status badge: `pending_review` | `approved` | `rejected`

**Also show:** Bump log from `get_bump_log(p_brand_id)` as a collapsible audit trail at the bottom.

---

## RPC Reference (All Available)

### Content Pillars
| RPC | Parameters | Returns |
|-----|-----------|---------|
| `get_content_pillars` | `p_brand_id, p_active_only` | `{pillars[], count, active_count}` — pillars include all fields: generation_instructions, tone_overrides, example_hooks, banned_angles, content_formats, performance stats, alignment tracking |
| `upsert_content_pillar` | `p_brand_id, p_pillar_name, p_description, p_target_audience, p_primary_keywords, p_sub_topics, p_source, p_updated_by` | `{action, id, pillar_name}` |
| `toggle_content_pillar` | `p_brand_id, p_pillar_id, p_active, p_updated_by` | `{id, pillar_name, active}` |
| `delete_content_pillar` | `p_brand_id, p_pillar_id, p_hard_delete` | `{id, pillar_name, action}` |
| `compute_pillar_performance` | `p_brand_id, p_days, p_min_posts` | `{pillars_analyzed, results[]}` |

### content_pillars Table Schema (Direct Supabase reads/writes)
| Column | Type | Purpose |
|--------|------|---------|
| `id` | INT | PK |
| `brand_id` | TEXT | Brand identifier |
| `pillar_name` | TEXT | Canonical name — used as `content_category` in all generated content |
| `description` | TEXT | What this pillar covers |
| `target_audience` | TEXT | Who this content is for |
| `primary_keywords` | JSONB | SEO/topic keywords |
| `sub_topics` | JSONB | Specific sub-topics array |
| `generation_instructions` | JSONB | `{approach, angle, story_type, cta_style, proof_points[], do_list[], dont_list[]}` |
| `tone_overrides` | JSONB | Per-pillar tone adjustments `{confidence, empathy, warmth, etc.}` |
| `example_hooks` | TEXT[] | Opening lines to emulate |
| `content_formats` | TEXT[] | Allowed formats: post, thread, how_to, etc. |
| `banned_angles` | TEXT[] | Framings to NEVER use |
| `min_frequency` | INT | Min posts per week for this pillar |
| `max_frequency` | INT | Max posts per week |
| `source` | TEXT | `manual`, `system`, `brand_discovery` |
| `active` | BOOLEAN | Whether this pillar is used in generation |
| `total_generated` | INT | Posts generated for this pillar |
| `total_approved` | INT | Posts approved |
| `total_rejected` | INT | Posts rejected |
| `approval_rate` | NUMERIC | Computed approval percentage |
| `last_used_at` | TIMESTAMPTZ | When content was last generated for this pillar |
| `suggested_action` | TEXT | System suggestion: `deactivate`, `boost`, or null |
| `suggestion_reason` | TEXT | Why the system suggests this action |
| `instruction_version` | INT | How many times instructions have been updated |
| `last_aligned_at` | TIMESTAMPTZ | When instructions were last aligned with brand identity |
| `alignment_source` | TEXT | What triggered the last alignment: `content-pillar-align`, `manual`, etc. |
| `previous_instructions` | JSONB | Snapshot of instructions before last alignment (for audit/rollback) |
| `updated_by` | TEXT | Who last modified: `bradford`, `system`, `content-pillar-align`, `content-strategist-v2` |

### Content Calendar
| RPC | Parameters | Returns |
|-----|-----------|---------|
| `get_content_calendar` | `p_brand_id, p_start_date, p_end_date, p_platforms[], p_statuses[]` | `{posts[], count, date_range}` |
| `get_content_calendar_stats` | `p_brand_id, p_start_date, p_end_date` | `{total_posts, approval_rate, bump_count, by_day[], by_platform[], by_status[]}` |
| `get_bump_log` | `p_brand_id, p_limit` | `{bumps[], count}` |

### Bumping
| RPC | Parameters | Returns |
|-----|-----------|---------|
| `bump_content_queue` | `p_brand_id, p_new_post JSONB, p_scheduled_at, p_bump_strategy` | `{new_post_id, displaced_posts[], displaced_count}` |
| `reschedule_content_post` | `p_queue_id, p_new_scheduled_at, p_cascade` | `{old_scheduled_at, new_scheduled_at, displaced_posts[]}` |

### Webhooks (Actions)
| Webhook | Purpose | Key Payload Fields |
|---------|---------|-------------------|
| `content-approve-v2` | Approve/reject/edit content | `action, queue_ids[], batch_id, scheduled_at, schedule_items[], rejection_reason` |
| `content-bump` | Bump/reschedule/view schedule | `operation, brand_id, platform, title, content_text, scheduled_at, bump_strategy` |
| `content-daily-engine-v2` | Trigger content generation | `brand_id, depth, target_date, theme, pillar, platforms` |
| `content-strategist-v2` | Trigger weekly plan + chain generation | `brand_id, force` |
| `content-pillar-align` | Force brand-to-pillar realignment | `brand_id` |

---

## Supabase Table Direct Reads

These can be read directly via Supabase client (anon key, RLS allows read):
- `content_pillars` — pillar definitions + instructions + performance + alignment tracking
- `social_content_queue` — content queue with statuses, scheduling, bumping
- `editorial_calendar` — weekly editorial plans

---

## System Architecture Diagram

```
BRAND-DISCOVERY (human Q&A)
    │ update_identity_section
    ▼
autonomous_brands.identity ──────────────────────┐
    │                                             │
    │ (auto-trigger after synthesis)              │
    ▼                                             │
CONTENT-PILLAR-ALIGN (webhook + weekly)           │
    │ GPT regenerates per-pillar instructions     │
    ▼                                             │
content_pillars table                             │
    │ generation_instructions, hooks, banned       │
    ▼                                             │
CONTENT-DAILY-ENGINE-V2 (daily 8am + webhook)     │
    │ 1. Assign Pillars (deterministic rotation)  │
    │ 2. Build Prompt (pillar instructions +      │
    │    brand voice + Reddit pains + research)───┘
    │ 3. GPT generates (hard constraints)
    ▼
social_content_queue (pending_approval)
    │
    ▼
CONTENT-APPROVE-V2 (human approval + scheduling)
    │
    ▼
social_content_queue (scheduled → posted)
    │
    │ performance feedback loop
    ▼
compute_pillar_performance RPC
    │ approval_rate, suggested_action
    ▼
content_pillars (updated stats, deactivate/boost suggestions)
```

---

## Authentication
All webhooks are open (no auth header needed — they're internal n8n webhooks).
All Supabase reads use the anon key (RLS configured for read access).
All Supabase writes (PATCH for pillar instructions) use the anon key with RLS allowing authenticated writes.
