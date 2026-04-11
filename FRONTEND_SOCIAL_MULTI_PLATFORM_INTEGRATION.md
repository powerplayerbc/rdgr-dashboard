# Backend Integration: Social Multi-Platform Outreach System

This document describes the backend data model, API contracts, table structures, RPCs, and workflow behaviors for the social media outreach system. It covers all 5 platforms (LinkedIn, Twitter/X, Instagram, Facebook, Reddit) and is intended for a frontend developer building the UI.

**Supabase instance:** `https://yrwrswyjawmgtxrgbnim.supabase.co`

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Tables](#2-database-tables)
3. [RPC Reference](#3-rpc-reference)
4. [Approval & Action Flow](#4-approval--action-flow)
5. [Settings: Scraper Input Configuration](#5-settings-scraper-input-configuration)
6. [Platform-Specific Card Data](#6-platform-specific-card-data)
7. [Conversation Tracking](#7-conversation-tracking)
8. [Discovery Run History](#8-discovery-run-history)
9. [Workflow Webhooks](#9-workflow-webhooks)
10. [Backend Pipeline Overview](#10-backend-pipeline-overview)
11. [Architectural Notes](#11-architectural-notes)

---

## 1. System Overview

The social outreach system discovers prospects across 5 platforms via APIFY scrapers (LinkedIn, Twitter, Instagram, Facebook) and the Reddit public API, generates AI-drafted outreach messages, and queues them for human review before action.

The frontend is responsible for:
- Presenting scraped prospect data and draft messages grouped by platform
- Providing a settings page for configuring scraper inputs (search terms, targeting, limits)
- Supporting the approve/edit/reject/redraft/skip/quick-act flow for all platforms
- Displaying daily action counters per platform
- Tracking active conversations (replies)

All platforms share the **same** approval and action RPCs. Platform differentiation is purely visual (card layout, badges, link types).

---

## 2. Database Tables

### 2.1 `social_targets` -- Discovered Prospects

Every scraped prospect becomes a row in this table. One row per unique person/thread per platform.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `brand_id` | TEXT | Always `'carlton'` |
| `discovery_run_id` | INT | FK to `social_discovery_runs.id` |
| `discovery_platform` | TEXT | `linkedin`, `twitter`, `instagram`, `facebook`, `reddit` |
| `discovery_method` | TEXT | `scraper`, `hashtag_search`, `keyword_search`, `subreddit_monitor`, `wave_catcher`, `pain_prospector`, `manual` |
| `discovery_type` | TEXT | `standard`, `wave_catcher`, `pain_prospector` (Reddit-specific) |
| `discovery_query` | TEXT | The search term or subreddit that found this target |
| `platform_username` | TEXT | Username on the platform |
| `platform_user_id` | TEXT | Platform-native user ID (if available) |
| `profile_url` | TEXT | Full URL to the profile |
| `display_name` | TEXT | Display name |
| `bio` | TEXT | Profile bio / job title |
| `follower_count` | INT | Follower count |
| `following_count` | INT | Following count |
| `post_count` | INT | Number of posts |
| `location` | TEXT | Location from profile |
| `website` | TEXT | Website from profile |
| `email_from_profile` | TEXT | Email if scraped from profile |
| `business_category` | TEXT | Business category tag |
| `thread_title` | TEXT | Reddit: post title |
| `thread_url` | TEXT | Reddit: full URL to the post |
| `thread_subreddit` | TEXT | Reddit: subreddit name (without `r/` prefix) |
| `thread_body_snippet` | TEXT | Reddit: first ~500 chars of post body |
| `thread_score` | INT | Reddit: upvote score |
| `thread_comment_count` | INT | Reddit: number of comments |
| `outreach_type` | TEXT | `dm` or `engagement` (AI-classified) |
| `classification_reason` | TEXT | Why the AI chose dm/engagement |
| `classification_confidence` | TEXT | `high`, `medium`, `low` |
| `human_override_type` | TEXT | If user manually flipped dm/engagement |
| `relevance_score` | INT (0-100) | AI relevance score |
| `engagement_potential` | INT (0-100) | AI engagement potential score |
| `contact_id` | TEXT | FK to `unified_contacts` if linked |
| `status` | TEXT | See status values below |
| `raw_scrape_data` | JSONB | Full raw data from scraper (platform-specific structure) |
| `last_seen_at` | TIMESTAMPTZ | Last time this target appeared in a scrape |
| `dedup_key` | TEXT (generated) | `brand_id:platform:username_or_thread_url` (UNIQUE) |
| `created_at` | TIMESTAMPTZ | Row creation time |

**Status values:** `new`, `classified`, `draft_created`, `approved`, `rejected`, `skipped`, `acted`, `duplicate`, `invalid`

**Platform-specific data in `raw_scrape_data`:**
- **LinkedIn:** `{ company, companyUrl, email, sourceJobTitle, ... }`
- **Twitter:** `{ text, retweetCount, likeCount, author: { userName, displayName, ... }, ... }`
- **Facebook:** `{ message, url, reactions, author: { name, url }, ... }`
- **Instagram:** `{ ownerUsername, caption, likesCount, ... }`
- **Reddit:** `{ matched_phrase, selftext, subreddit, score, num_comments, ... }`

---

### 2.2 `social_outreach_drafts` -- AI-Generated Draft Messages

Each draft is an AI-generated outreach message tied to a target. Has a dual lifecycle: approval (human reviews the draft) then action (human copies and sends it on the platform).

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `brand_id` | TEXT | Always `'carlton'` |
| `target_id` | INT | FK to `social_targets.id` |
| `contact_id` | TEXT | FK to `unified_contacts` if linked |
| `platform` | TEXT | Platform name |
| `outreach_type` | TEXT | `dm` or `engagement` |
| `engagement_subtype` | TEXT | Specific action type (see values below) |
| `draft_content` | TEXT | The AI-generated message text |
| `draft_subject` | TEXT | Subject line (DMs only, if applicable) |
| `target_url` | TEXT | URL to open for sending (thread URL for Reddit, profile URL for DMs) |
| `target_content_snippet` | TEXT | Context snippet shown on card |
| `voice_settings_version` | INT | Version of voice settings used to generate this draft |
| `generation_model` | TEXT | GPT model used (e.g., `gpt-4.1`) |
| `generation_context` | JSONB | Metadata: `{ discovery_type, prompt_template, ... }` |
| `approval_status` | TEXT | `draft`, `pending_review`, `approved`, `rejected`, `redraft`, `edited`, `skipped` |
| `approval_notes` | TEXT | User's feedback when rejecting/redrafting |
| `approved_at` | TIMESTAMPTZ | When approved |
| `approved_by` | TEXT | Who approved (default `'bradford'`) |
| `edited_content` | TEXT | Modified text if user edited before approving |
| `revision_count` | INT | How many times this was redrafted |
| `max_revisions` | INT | Cap on redrafts (default 3) |
| `action_status` | TEXT | `pending`, `acted`, `skipped`, `expired` |
| `acted_at` | TIMESTAMPTZ | When marked as acted upon |
| `action_notes` | TEXT | Notes from action step |
| `expires_at` | TIMESTAMPTZ | Auto-expiry (set by SOCIAL-CLEANUP) |
| `human_task_id` | TEXT | FK to human task system |
| `priority` | INT (1-5) | 1=highest, 5=lowest |
| `created_at` | TIMESTAMPTZ | Row creation time |

**`engagement_subtype` values:**
`comment`, `like`, `follow`, `connection_request`, `reply`, `quote_tweet`, `story_reply`, `group_comment`, `post_reaction`, `repost`, `reddit_comment`, `reddit_post`, `reddit_wave_comment`, `reddit_pain_comment`, `linkedin_dm`, `twitter_dm`, `instagram_dm`

---

### 2.3 `social_discovery_inputs` -- Configurable Scraper Inputs (Settings Page)

This is the table the frontend settings page manages directly via Supabase JS. Each row is one search input for one platform. The backend orchestrator reads from this table on each discovery run.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `brand_id` | TEXT | Always `'carlton'` |
| `platform` | TEXT | `twitter`, `instagram`, `facebook`, `linkedin` |
| `search_term` | TEXT | The keyword, URL, or query string |
| `search_type` | TEXT | Platform-specific (see per-platform section) |
| `industry_group` | TEXT | Optional grouping tag (e.g., `'general'`, `'hvac'`) |
| `location` | TEXT | Optional location filter |
| `actor_name_override` | TEXT | Override the default APIFY actor (rare) |
| `extra_params` | JSONB | Platform-specific extra parameters (see below) |
| `weight` | NUMERIC | Priority weight 0.5-3.0 (higher = selected first) |
| `max_results` | INT | Max items to return per run |
| `is_active` | BOOLEAN | Toggle on/off without deleting |
| `last_used_at` | TIMESTAMPTZ | Last time this input was used in a run |
| `times_used` | INT | Total usage count |
| `created_at` | TIMESTAMPTZ | Row creation time |
| `updated_at` | TIMESTAMPTZ | Last modified time |

**UNIQUE constraint:** `(brand_id, platform, search_term, search_type)`

**Frontend does direct CRUD on this table -- no workflow calls needed.**

```javascript
// Load all inputs for a platform
const { data } = await supabase
  .from('social_discovery_inputs')
  .select('*')
  .eq('brand_id', 'carlton')
  .eq('platform', selectedPlatform)
  .order('weight', { ascending: false });

// Add new input
await supabase.from('social_discovery_inputs').insert({
  brand_id: 'carlton',
  platform: 'twitter',
  search_term: 'AI consulting',
  search_type: 'keyword_search',
  industry_group: 'general',
  weight: 1.5,
  max_results: 100,
  is_active: true,
  extra_params: {}
});

// Toggle active/inactive
await supabase.from('social_discovery_inputs')
  .update({ is_active: false })
  .eq('id', inputId);

// Delete
await supabase.from('social_discovery_inputs')
  .delete()
  .eq('id', inputId);
```

**Per-platform `extra_params` structure:**

| Platform | `search_type` values | `extra_params` fields |
|----------|---------------------|-----------------------|
| **Twitter** | `keyword_search` | `{}` (none needed) |
| **Instagram** | `profile_search` | `{}` (none needed) |
| **Facebook** | `posts`, `pages`, `places`, `global` | `{ start_date?, end_date? }` (optional date filtering) |
| **LinkedIn** | `job_search` | `{ splitCountry, max_companies_to_scrape, max_employees_per_company, target_titles[] }` |

**Per-platform field summary:**

| Field | Twitter | Instagram | Facebook | LinkedIn |
|-------|---------|-----------|----------|----------|
| `search_term` | Keywords to search | Profile/hashtag search | Post/page search query | Job search keywords |
| `search_type` | `keyword_search` | `profile_search` | `posts`/`pages`/`places`/`global` | `job_search` |
| `max_results` | 50-200 | 10-50 | 10-50 | 50-100 (job postings) |
| `location` | N/A | N/A | City/region (optional) | N/A (uses `splitCountry` in extra_params) |
| `weight` | 0.5-3.0 | 0.5-3.0 | 0.5-3.0 | 0.5-3.0 |

---

### 2.4 `social_platform_config` -- Per-Platform Settings

One row per platform per brand. Controls daily limits, active toggles, and platform-specific configuration. Also holds Reddit's search strategy config (since Reddit config differs structurally from the other platforms).

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `brand_id` | TEXT | Always `'carlton'` |
| `platform` | TEXT | Platform name |
| `display_name` | TEXT | Human-readable name (e.g., `'X (Twitter)'`) |
| `is_active` | BOOLEAN | Master on/off toggle for this platform |
| `daily_dm_limit` | INT | Max DMs per day |
| `daily_engagement_limit` | INT | Max engagements per day |
| `discovery_enabled` | BOOLEAN | Whether discovery scraping is active |
| `discovery_actor_names` | TEXT[] | APIFY actor names to use |
| `discovery_schedule` | TEXT | Schedule description |
| `discovery_max_results` | INT | Max results per discovery run |
| `discovery_day_mask` | INT[] | Days of week (1=Mon, 5=Fri) |
| `dm_max_length` | INT | Character limit for DMs |
| `comment_max_length` | INT | Character limit for comments |
| `supports_dm` | BOOLEAN | Whether platform supports DMs |
| `supports_comment` | BOOLEAN | Whether platform supports comments |
| `supports_connection_request` | BOOLEAN | LinkedIn-specific |
| `supports_follow` | BOOLEAN | Whether follow is supported |
| `profile_base_url` | TEXT | Base URL for profile links |
| `search_strategies` | JSONB | Reddit search config (see below) |
| `platform_rules` | JSONB | Platform-specific rules |
| `monthly_apify_budget` | NUMERIC | APIFY budget ($39/month) |
| `created_at` | TIMESTAMPTZ | Row creation time |
| `updated_at` | TIMESTAMPTZ | Last modified time |

**UNIQUE constraint:** `(brand_id, platform)`

**Current platform limits:**

| Platform | DM Limit | Engagement Limit | Supports DM | Max DM Length | Max Comment Length |
|----------|----------|-------------------|-------------|---------------|--------------------|
| LinkedIn | 5/day | 10/day | Yes | 300 | 1250 |
| Instagram | 10/day | 15/day | Yes | 1000 | 2200 |
| Facebook | 10/day | 15/day | Yes | 5000 | 8000 |
| Twitter | 10/day | 20/day | Yes | 10000 | 280 |
| Reddit | 0/day | 15/day | No | N/A | 10000 |

**Reading/updating platform config:**

```javascript
// Read config for one platform
const { data } = await supabase
  .from('social_platform_config')
  .select('*')
  .eq('brand_id', 'carlton')
  .eq('platform', 'twitter')
  .single();

// Update daily limits
await supabase.from('social_platform_config')
  .update({
    daily_dm_limit: 10,
    daily_engagement_limit: 20,
    updated_at: new Date().toISOString()
  })
  .eq('brand_id', 'carlton')
  .eq('platform', 'twitter');

// Toggle platform active/inactive
await supabase.from('social_platform_config')
  .update({ is_active: false, updated_at: new Date().toISOString() })
  .eq('brand_id', 'carlton')
  .eq('platform', 'facebook');
```

**Reddit `search_strategies` (JSONB) structure:**

Reddit configuration lives in `social_platform_config.search_strategies` because its structure differs from the other platforms (subreddit groups, pain phrases). The other platforms use `social_discovery_inputs`.

```javascript
// Load Reddit config
const { data } = await supabase
  .from('social_platform_config')
  .select('search_strategies')
  .eq('brand_id', 'carlton')
  .eq('platform', 'reddit')
  .single();

// search_strategies contains:
[
  {
    "type": "wave_catcher",
    "subreddit_groups": [
      { "group": "A", "subreddits": ["smallbusiness", "entrepreneur", "Automate", "SaaS"] },
      { "group": "B", "subreddits": ["startups", "webdev", "artificial", "digitalnomad"] },
      { "group": "C", "subreddits": ["Bookkeeping", "realtors", "restaurateur", "HVAC"] },
      { "group": "D", "subreddits": ["dentistry", "lawncare", "contractors", "AutoDetailing"] }
    ],
    "posts_per_subreddit": 20,
    "top_n_to_qualify": 5
  },
  {
    "type": "pain_prospector",
    "search_phrases": [
      "hours per week", "manually every", "spend hours", "waste time",
      "tedious process", "hate doing", "takes me forever",
      "so much time on", "wish there was a tool", "automate this"
    ],
    "industry_subreddits": [
      "smallbusiness", "entrepreneur", "Bookkeeping", "realtors",
      "restaurateur", "HVAC", "dentistry", "lawncare", "contractors",
      "AutoDetailing", "freelance", "consulting", "ecommerce",
      "dropship", "PropertyManagement", "WeddingPlanning"
    ],
    "max_results_per_phrase": 5,
    "top_n_to_qualify": 5
  }
]

// Update Reddit config
await supabase.from('social_platform_config')
  .update({ search_strategies: updatedStrategies })
  .eq('brand_id', 'carlton')
  .eq('platform', 'reddit');
```

---

### 2.5 `social_daily_actions` -- Daily Action Counters

One row per platform per day. Auto-created on first action of the day. No cron reset needed -- the `action_date` column provides implicit daily partitioning.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `brand_id` | TEXT | Always `'carlton'` |
| `platform` | TEXT | Platform name |
| `action_date` | DATE | The calendar date (Pacific Time context) |
| `dm_count` | INT | DMs sent today |
| `engagement_count` | INT | Engagements today |
| `action_breakdown` | JSONB | Breakdown by subtype, e.g., `{ "comment": 3, "like": 2 }` |

**UNIQUE constraint:** `(brand_id, platform, action_date)`

This table is read-only from the frontend perspective. All writes go through the `increment_social_action` and `quick_act_social_draft` RPCs. Use `get_social_daily_counts` to read current values.

---

### 2.6 `social_conversations` -- Conversation Thread Tracking

Tracks back-and-forth messages after initial outreach. Each row is one message in a thread.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `draft_id` | INT | FK to `social_outreach_drafts.id` (the original outreach) |
| `brand_id` | TEXT | Always `'carlton'` |
| `platform` | TEXT | Platform name |
| `direction` | TEXT | `inbound` (from them) or `outbound` (from us) |
| `message_type` | TEXT | `reply` or `follow_up` |
| `content` | TEXT | The message text |
| `author` | TEXT | Author name |
| `author_is_us` | BOOLEAN | Whether this message is from us |
| `thread_url` | TEXT | URL to the thread/conversation |
| `approval_status` | TEXT | For outbound drafts: `pending_review`, `approved` |
| `action_status` | TEXT | `pending`, `acted` |
| `approved_at` | TIMESTAMPTZ | When approved |
| `acted_at` | TIMESTAMPTZ | When marked as sent |
| `created_at` | TIMESTAMPTZ | Row creation time |

**Frontend writes for conversation responses:**

```javascript
// Approve a drafted response
await supabase.from('social_conversations')
  .update({ approval_status: 'approved', approved_at: new Date().toISOString() })
  .eq('id', conversationRowId);

// Mark response as sent (after user copies and pastes on platform)
await supabase.from('social_conversations')
  .update({ action_status: 'acted', acted_at: new Date().toISOString() })
  .eq('id', conversationRowId);
```

---

### 2.7 `social_discovery_runs` -- Scraper Execution History (Read-Only)

Audit trail of every discovery run. The frontend reads this for the run history dashboard widget.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `brand_id` | TEXT | Always `'carlton'` |
| `run_id` | TEXT (UNIQUE) | Unique run identifier |
| `platform` | TEXT | Platform name |
| `search_type` | TEXT | `keyword_search`, `hashtag_search`, `subreddit_monitor`, `wave_catcher`, `pain_prospector`, etc. |
| `search_query` | TEXT | What was searched |
| `search_params` | JSONB | Full search parameters |
| `apify_actor_name` | TEXT | Which APIFY actor was used |
| `apify_run_id` | TEXT | APIFY run ID |
| `discovery_source` | TEXT | `apify`, `reddit_api`, `manual` |
| `discovery_type` | TEXT | `standard`, `wave_catcher`, `pain_prospector` |
| `profiles_found` | INT | Raw results from scraper |
| `profiles_qualified` | INT | Passed GPT qualification |
| `profiles_duplicate` | INT | Already existed (upsert refreshed) |
| `targets_created` | INT | New targets inserted |
| `dm_classified` | INT | Classified as DM |
| `engagement_classified` | INT | Classified as engagement |
| `cost_usd` | NUMERIC | APIFY cost for this run |
| `duration_ms` | INT | Run duration in milliseconds |
| `status` | TEXT | `pending`, `running`, `classifying`, `completed`, `failed`, `cancelled` |
| `error` | TEXT | Error message if failed |
| `pinned_results` | JSONB | Cached results for testing |
| `started_at` | TIMESTAMPTZ | Run start time |
| `completed_at` | TIMESTAMPTZ | Run completion time |
| `created_at` | TIMESTAMPTZ | Row creation time |

```javascript
// Load recent discovery runs
const { data } = await supabase
  .from('social_discovery_runs')
  .select('id, platform, search_type, search_query, discovery_type, profiles_found, profiles_duplicate, targets_created, status, cost_usd, created_at')
  .eq('brand_id', 'carlton')
  .order('created_at', { ascending: false })
  .limit(20);
```

---

### 2.8 `social_voice_settings` -- Per-Platform Voice/Tone Settings

One row per platform per brand. Controls how AI drafts are written. Documented fully in `FRONTEND_SOCIAL_VOICE_SETTINGS_SPEC.md` -- only summarized here.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `brand_id` | TEXT | Always `'carlton'` |
| `platform` | TEXT | Platform name |
| `tone_warmth` | INT (1-10) | Warmth slider |
| `tone_formality` | INT (1-10) | Formality slider |
| `tone_confidence` | INT (1-10) | Confidence slider |
| `tone_humor` | INT (1-10) | Humor slider |
| `tone_salesiness` | INT (1-10) | Salesiness slider |
| `max_message_length` | INT | Character limit for drafts |
| `use_emoji` | BOOLEAN | Allow emoji |
| `emoji_density` | TEXT | `none`, `minimal`, `moderate`, `heavy` |
| `use_hashtags` | BOOLEAN | Include hashtags |
| `hashtag_count_min` / `max` | INT | Hashtag range |
| `opening_style` | TEXT | `observation`, `compliment`, `question`, `shared_interest`, `mutual_connection`, `problem`, `personalized`, `direct`, `story` |
| `cta_style` | TEXT | `soft`, `direct`, `question`, `none` |
| `message_length` | TEXT | `micro`, `short`, `medium`, `long` |
| `personalization_depth` | TEXT | `light`, `medium`, `deep` |
| `keywords` | TEXT[] | Words to naturally include |
| `banned_phrases` | TEXT[] | Forbidden phrases |
| `value_propositions` | TEXT[] | Value prop sentences |
| `creativity` | INT (1-10) | Maps to GPT temperature |
| `custom_instruction` | TEXT | Free-text instruction appended to GPT prompt |
| `version` | INT | Auto-incremented on save |

**UNIQUE constraint:** `(brand_id, platform)`

Managed via `get_social_voice_settings` and `save_social_voice_settings` RPCs. See `FRONTEND_SOCIAL_VOICE_SETTINGS_SPEC.md` for full API reference.

---

### 2.9 `social_voice_learning_log` -- AI Suggestions

Generated nightly by the SOCIAL-VOICE-LEARN workflow. Each row is one improvement suggestion.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `brand_id` | TEXT | Always `'carlton'` |
| `platform` | TEXT | Platform name |
| `suggestion_type` | TEXT | e.g., `tone_adjustment`, `keyword_add` |
| `setting_field` | TEXT | Which setting to change (e.g., `tone_formality`) |
| `current_value` | TEXT | Current value of the setting |
| `suggested_value` | TEXT | Suggested new value |
| `reasoning` | TEXT | AI explanation of why |
| `evidence` | JSONB | Stats backing the suggestion |
| `confidence` | TEXT | `high`, `medium`, `low` |
| `status` | TEXT | `pending`, `accepted`, `dismissed` |
| `created_at` | TIMESTAMPTZ | Row creation time |

```javascript
// Load pending suggestions for a platform
const { data: suggestions } = await supabase
  .from('social_voice_learning_log')
  .select('*')
  .eq('brand_id', 'carlton')
  .eq('platform', selectedPlatform)
  .eq('status', 'pending')
  .order('created_at', { ascending: false });
```

---

### 2.10 `social_voice_snapshots` -- Voice Settings Snapshots

One-click apply/restore for voice settings. Created automatically by the learning system or as backups before applying changes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `brand_id` | TEXT | Always `'carlton'` |
| `platform` | TEXT | Platform name |
| `snapshot_type` | TEXT | `ai_suggested` or `manual_backup` |
| `settings_data` | JSONB | Full snapshot of all settings |
| `label` | TEXT | Description of the snapshot |
| `status` | TEXT | `pending`, `applied`, `superseded` |
| `backup_snapshot_id` | INT | FK to the backup created before applying |
| `applied_by` | TEXT | Who applied this snapshot |
| `created_at` | TIMESTAMPTZ | Row creation time |

```javascript
const { data: snapshots } = await supabase
  .from('social_voice_snapshots')
  .select('*')
  .eq('brand_id', 'carlton')
  .eq('platform', selectedPlatform)
  .order('created_at', { ascending: false })
  .limit(5);
```

---

## 3. RPC Reference

All RPCs are called via `supabase.rpc('function_name', { params })`.

### 3.1 `get_pending_social_drafts` -- Load Queue Items

Returns drafts for the approval queue or action queue, with target data joined.

```javascript
const { data } = await supabase.rpc('get_pending_social_drafts', {
  p_brand_id: 'carlton',
  p_queue_type: 'approval',   // 'approval' or 'action'
  p_platform: null,            // null for all, or 'linkedin'/'twitter'/'reddit'/etc.
  p_outreach_type: 'dm',      // 'dm' or 'engagement', or null for both
  p_limit: 50,
  p_offset: 0
});
```

**Returns:**
```json
{
  "success": true,
  "queue_type": "approval",
  "total": 12,
  "drafts": [
    {
      "id": 45,
      "platform": "reddit",
      "outreach_type": "engagement",
      "engagement_subtype": "reddit_wave_comment",
      "draft_content": "I had a similar challenge with...",
      "target_url": "https://reddit.com/r/smallbusiness/comments/abc123",
      "target_content_snippet": "What tools do you use for...",
      "approval_status": "pending_review",
      "priority": 2,
      "revision_count": 0,
      "max_revisions": 3,
      "created_at": "2026-03-21T14:00:00Z",
      "human_task_id": "T_260321140000",
      "platform_username": "Primary_Ad_8130",
      "target_name": "Primary_Ad_8130",
      "target_profile_url": "https://reddit.com/u/Primary_Ad_8130",
      "target_bio": null,
      "follower_count": null,
      "post_count": null,
      "relevance_score": 72,
      "classification_reason": "Post is asking for tool recommendations...",
      "business_category": null,
      "target_location": null,
      "thread_title": "What tools do you use for client onboarding?",
      "thread_url": "https://reddit.com/r/smallbusiness/comments/abc123",
      "thread_subreddit": "smallbusiness",
      "thread_body_snippet": "We're a 5-person agency and...",
      "thread_score": 15,
      "discovery_type": "wave_catcher",
      "generation_context": { "discovery_type": "wave_catcher", "prompt_template": "wave" },
      "raw_scrape_data": { "matched_phrase": null, "selftext": "...", "num_comments": 3 }
    }
  ]
}
```

**Approval queue** returns items where `approval_status IN ('pending_review', 'redraft')`.

**Action queue** returns items where `approval_status = 'approved' AND action_status = 'pending'` and not expired.

The action queue returns `final_content` (which is `edited_content` if edited, otherwise `draft_content`).

---

### 3.2 `get_social_daily_counts` -- Daily Action Counters

Returns current counts and limits for all platforms.

```javascript
const { data } = await supabase.rpc('get_social_daily_counts', {
  p_brand_id: 'carlton'
});
```

**Returns:** Array of 5 objects (one per platform):
```json
[
  {
    "platform": "linkedin",
    "display_name": "LinkedIn",
    "is_active": true,
    "dm_count": 2,
    "dm_limit": 5,
    "dm_remaining": 3,
    "engagement_count": 4,
    "engagement_limit": 10,
    "engagement_remaining": 6,
    "action_breakdown": { "comment": 3, "connection_request": 1 }
  }
]
```

---

### 3.3 `approve_social_draft` -- Approve/Reject/Edit/Redraft/Skip

```javascript
const { data } = await supabase.rpc('approve_social_draft', {
  p_draft_id: 45,
  p_action: 'approve',        // 'approve' | 'reject' | 'edit' | 'redraft' | 'skip'
  p_brand_id: 'carlton',
  p_notes: 'Looks good',      // optional feedback
  p_edited_content: null,      // required for 'edit' action
  p_override_type: null        // 'dm' or 'engagement' to flip classification
});
```

**Returns:**
```json
{ "success": true, "action": "approve", "draft_id": 45 }
```

**Action behaviors:**

| Action | Effect on draft | Effect on target |
|--------|----------------|------------------|
| `approve` | `approval_status='approved'`, sets `approved_at` | `status='approved'` |
| `reject` | `approval_status='rejected'` | `status='rejected'` |
| `edit` | `approval_status='approved'`, stores `edited_content`, sets `approved_at` | `status='approved'` |
| `redraft` | `approval_status='redraft'`, increments `revision_count` | No change |
| `skip` | `approval_status='skipped'` | `status='skipped'` |

The `p_override_type` parameter (optional) flips the classification. Passing `'dm'` when the draft is currently `'engagement'` will update both the draft and target `outreach_type` and set `human_override_type` on the target.

**Redraft triggers a workflow callback** to regenerate the draft with feedback:
```javascript
// After calling approve_social_draft with action='redraft', trigger the workflow:
await fetch('https://n8n.carltonaiservices.com/webhook/social-approved', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'reject',
    draft_id: 45,
    feedback: 'Make it less formal and reference the specific tool they mentioned',
    brand_id: 'carlton'
  })
});
```

---

### 3.4 `quick_act_social_draft` -- One-Step Approve + Act

Skips the approval queue entirely. Approves the draft, marks it as acted, and increments the daily counter in one transaction. Used when the user copies the text, pastes it on the platform, and clicks "Done" immediately.

```javascript
const { data } = await supabase.rpc('quick_act_social_draft', {
  p_draft_id: 45,
  p_brand_id: 'carlton',
  p_notes: null,               // optional
  p_override_type: null         // optional: 'dm' or 'engagement'
});
```

**Returns on success:**
```json
{
  "success": true,
  "action": "quick_act",
  "platform": "reddit",
  "outreach_type": "engagement",
  "dm_count": 0,
  "dm_limit": 0,
  "engagement_count": 5,
  "engagement_limit": 15
}
```

**Returns on limit hit:**
```json
{ "success": false, "error": "Daily engagement limit reached" }
```

---

### 3.5 `increment_social_action` -- Mark Acted Upon

Called from the action queue when the user has copied/pasted the message on the platform and clicks "Mark Acted Upon."

```javascript
const { data } = await supabase.rpc('increment_social_action', {
  p_brand_id: 'carlton',
  p_platform: 'reddit',
  p_outreach_type: 'engagement',   // 'dm' or 'engagement'
  p_draft_id: 45,                   // updates draft action_status to 'acted'
  p_engagement_subtype: 'reddit_wave_comment'  // optional, for breakdown tracking
});
```

**Returns on success:**
```json
{
  "success": true,
  "platform": "reddit",
  "outreach_type": "engagement",
  "dm_count": 0,
  "dm_limit": 0,
  "engagement_count": 6,
  "engagement_limit": 15
}
```

**Returns on limit hit:**
```json
{ "success": false, "error": "Daily engagement limit reached", "count": 15, "limit": 15 }
```

---

### 3.6 `get_active_conversations` -- Active Conversation Threads

Returns all drafts that have been acted upon and have conversation activity.

```javascript
const { data } = await supabase.rpc('get_active_conversations', {
  p_brand_id: 'carlton',
  p_platform: null              // null for all, or specific platform
});
```

**Returns:**
```json
{
  "total": 3,
  "conversations": [
    {
      "draft_id": 45,
      "platform": "reddit",
      "original_message": "I had a similar challenge...",
      "target_name": "Primary_Ad_8130",
      "platform_username": "Primary_Ad_8130",
      "thread_title": "What tools do you use for client onboarding?",
      "thread_url": "https://reddit.com/r/smallbusiness/comments/abc123",
      "target_profile_url": "https://reddit.com/u/Primary_Ad_8130",
      "response_received": true,
      "conversation_count": 2,
      "inbound_count": 1,
      "pending_replies": 1,
      "last_activity": "2026-03-21T16:30:00Z",
      "acted_at": "2026-03-21T14:15:00Z"
    }
  ]
}
```

---

### 3.7 `get_conversation_thread` -- Full Thread History

```javascript
const { data } = await supabase.rpc('get_conversation_thread', {
  p_draft_id: 45,
  p_brand_id: 'carlton'
});
```

**Returns:**
```json
{
  "original_message": "I had a similar challenge...",
  "messages": [
    {
      "direction": "outbound",
      "content": "I had a similar challenge...",
      "author": "Bradford",
      "author_is_us": true,
      "created_at": "2026-03-21T14:15:00Z"
    },
    {
      "direction": "inbound",
      "content": "That's a really good point. We're a small HVAC company...",
      "author": "Primary_Ad_8130",
      "author_is_us": false,
      "created_at": "2026-03-21T16:30:00Z"
    }
  ],
  "target": { "display_name": "Primary_Ad_8130", "platform": "reddit" }
}
```

---

### 3.8 `get_social_conversion_funnel` -- Funnel Statistics

```javascript
const { data } = await supabase.rpc('get_social_conversion_funnel', {
  p_brand_id: 'carlton',
  p_days: 30,
  p_platform: null              // null for all, or specific platform
});
```

**Returns:**
```json
{
  "funnel": {
    "discovered": 120,
    "classified": 40,
    "drafted": 15,
    "approved": 10,
    "acted": 8,
    "conversations_started": 3
  },
  "response_rates": [
    { "platform": "reddit", "total_acted": 5, "responses_received": 2, "response_rate_pct": 40.0 },
    { "platform": "twitter", "total_acted": 3, "responses_received": 1, "response_rate_pct": 33.3 }
  ],
  "platform_roi": [
    { "platform": "reddit", "targets": 80, "conversations": 2, "engagement_rate_pct": 2.5 },
    { "platform": "twitter", "targets": 40, "conversations": 1, "engagement_rate_pct": 2.5 }
  ],
  "time_to_act": {
    "avg_hours_to_approve": 1.2,
    "avg_hours_to_act": 0.5,
    "avg_hours_total": 1.7
  }
}
```

---

### 3.9 `get_social_outreach_stats` -- Dashboard Statistics

```javascript
const { data } = await supabase.rpc('get_social_outreach_stats', {
  p_brand_id: 'carlton',
  p_days: 7
});
```

**Returns:**
```json
{
  "success": true,
  "period_days": 7,
  "targets": [
    { "platform": "reddit", "total": 80, "new": 30, "classified": 20, "approved": 10, "acted": 5 }
  ],
  "drafts": [
    { "platform": "reddit", "pending_review": 8, "approved": 5, "rejected": 2, "dm_count": 0, "engagement_count": 13 }
  ],
  "daily_actions": [
    { "date": "2026-03-21", "platform": "reddit", "dm_count": 0, "engagement_count": 4 }
  ]
}
```

---

### 3.10 `get_apify_monthly_spend` -- APIFY Budget Tracking

```javascript
const { data } = await supabase.rpc('get_apify_monthly_spend', {
  p_brand_id: 'carlton'
});
```

**Returns:**
```json
{
  "success": true,
  "total_spend": 12.50,
  "budget": 39.00,
  "remaining": 26.50,
  "pct_used": 32.05,
  "month": "2026-03",
  "throttle_warning": false,
  "throttle_stop": false
}
```

The backend automatically throttles APIFY calls at 75% (`throttle_warning`) and stops at 90% (`throttle_stop`). Reddit discovery is free and unaffected.

---

### 3.11 Voice & Snapshot RPCs (Summary)

These are fully documented in `FRONTEND_SOCIAL_VOICE_SETTINGS_SPEC.md`. Quick reference:

| RPC | Purpose |
|-----|---------|
| `get_social_voice_settings(p_brand_id, p_platform)` | Load settings for one or all platforms |
| `save_social_voice_settings(p_brand_id, p_platform, p_settings)` | Partial upsert, auto-increments version |
| `resolve_social_voice_suggestion(p_suggestion_id, p_action)` | Accept or dismiss an AI suggestion |
| `apply_social_voice_snapshot(p_snapshot_id, p_applied_by)` | Apply snapshot (auto-creates backup first) |
| `get_contact_social_timeline(p_contact_id, p_target_id, p_brand_id)` | All social activity for a CRM contact |

---

## 4. Approval & Action Flow

All 5 platforms follow the identical flow. The RPCs are platform-agnostic.

```
Discovery (backend, automated)
  |
  v
social_targets (new row)
  |
  v
GPT Qualification (backend)
  |
  v
social_outreach_drafts (new row, approval_status='pending_review')
  |
  v
+---------------------------+
| APPROVAL QUEUE (frontend) |
+---------------------------+
  |
  +--> Approve --> action_status='pending' --> ACTION QUEUE
  |
  +--> Edit (inline edit, then approve) --> ACTION QUEUE
  |
  +--> Redraft (send feedback to GPT, new draft generated) --> back to APPROVAL QUEUE
  |
  +--> Skip --> approval_status='skipped', removed from queue
  |
  +--> Quick Act (approve + act + increment counter, all in one) --> DONE
  |
+---------------------------+
|  ACTION QUEUE (frontend)  |
+---------------------------+
  |
  User copies text --> opens platform link --> pastes message --> clicks "Mark Acted Upon"
  |
  v
increment_social_action --> daily counter updated, action_status='acted' --> DONE
```

**Auto-cleanup (SOCIAL-CLEANUP workflow, runs automatically):**
- Wave catcher drafts: auto-skipped after 24 hours
- Pain prospector + standard Reddit: auto-skipped after 48 hours
- LinkedIn/Instagram/Facebook/Twitter: auto-skipped after 5 days
- Target retention: 7 days minimum (for dedup), then purged

---

## 5. Settings: Scraper Input Configuration

### For LinkedIn, Twitter, Instagram, Facebook

The frontend manages the `social_discovery_inputs` table directly (see Section 2.3). Changes take effect on the next scheduled discovery run (7am PT Mon-Fri) or when manually triggered.

**Manual trigger:**
```javascript
// Trigger discovery for a specific platform
await fetch('https://n8n.carltonaiservices.com/webhook/social-orchestrator', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ brand_id: 'carlton', platform: 'linkedin' })
});

// Trigger discovery for ALL platforms
await fetch('https://n8n.carltonaiservices.com/webhook/social-orchestrator', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ brand_id: 'carlton' })
});
```

### For Reddit

Reddit configuration is stored in `social_platform_config.search_strategies` (see Section 2.4). The settings page should provide a way to edit:
- **Wave catcher:** Subreddit groups (4 groups of 4 subreddits each), posts per subreddit, top N to qualify
- **Pain prospector:** Search phrases, industry subreddits, max results per phrase, top N to qualify

**Manual trigger for Reddit:**
```javascript
// Trigger wave catcher run
await fetch('https://n8n.carltonaiservices.com/webhook/social-reddit-orch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ brand_id: 'carlton', mode: 'wave_catcher' })
});

// Trigger pain prospector run
await fetch('https://n8n.carltonaiservices.com/webhook/social-reddit-orch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ brand_id: 'carlton', mode: 'pain_prospector' })
});
```

---

## 6. Platform-Specific Card Data

The `get_pending_social_drafts` RPC joins target data automatically. Each draft includes all fields needed for display. Here is what to emphasize per platform.

### 6.1 Reddit Cards

Reddit has three visual variants based on `discovery_type`:

**Identifying the variant:**
```javascript
const getRedditCardType = (draft) => {
  const discoveryType = draft.discovery_type
    || draft.generation_context?.discovery_type
    || 'standard';
  switch (discoveryType) {
    case 'wave_catcher': return 'wave';
    case 'pain_prospector': return 'pain';
    default: return 'standard';
  }
};
```

**Wave Catcher cards** (`discovery_type = 'wave_catcher'`):
- Badge: Blue/teal "Wave"
- Show: `thread_subreddit`, `thread_title`, post age (calculate from target `created_at`), `thread_comment_count`
- Link: "Open Thread" using `thread_url`
- Post age color: orange/red if older than 6 hours (wave is fading)

**Pain Prospector cards** (`discovery_type = 'pain_prospector'`):
- Badge: Orange/amber "Pain Point"
- Show: matched phrase from `raw_scrape_data.matched_phrase` (highlight in post excerpt), `thread_subreddit`, `thread_title`
- Link: "Open Thread" using `thread_url`

**Standard Reddit cards** (`discovery_type = 'standard'`):
- No special badge
- Show: `thread_subreddit`, `thread_title`
- Link: "Open Thread" using `thread_url`

**Highlighting the matched phrase:**
```javascript
const highlightPhrase = (text, phrase) => {
  if (!phrase || !text) return text;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark class="bg-amber-200 px-1 rounded">$1</mark>');
};

// Usage
const matchedPhrase = draft.raw_scrape_data?.matched_phrase || null;
const highlightedBody = highlightPhrase(draft.thread_body_snippet, matchedPhrase);
```

### 6.2 Twitter/X Cards

- Show: `target_name` (display name), `platform_username`, `target_bio`, `follower_count`
- Tweet text: in `raw_scrape_data.text`
- Link: "View Profile" using `target_profile_url` (e.g., `https://x.com/username`)
- For DMs: link opens the profile; for engagement: link opens the specific tweet

### 6.3 LinkedIn Cards

LinkedIn targets are **people** (employees at companies), not companies.

- Show: `target_name` (employee name), `target_bio` (job title)
- Company: `raw_scrape_data.company`, `raw_scrape_data.companyUrl`
- Source context: `raw_scrape_data.sourceJobTitle` (the job posting that led to this prospect)
- Email: `raw_scrape_data.email` (if available from scraper)
- Link: "View Profile" using `target_profile_url`

### 6.4 Instagram Cards

- Show: `target_name`, `platform_username`, `target_bio`, `follower_count`
- Link: "View Profile" using `target_profile_url` (e.g., `https://instagram.com/username`)

### 6.5 Facebook Cards

- Show: author name from `raw_scrape_data.author.name`, post message from `raw_scrape_data.message`
- Post URL: `raw_scrape_data.url` or `target_url`
- Reactions: `raw_scrape_data.reactions`
- Link: "View Post" using `target_url`

---

## 7. Conversation Tracking

After a draft is acted upon (message sent on the platform), conversations can continue.

### Logging an Inbound Reply

When the user receives a reply on the platform, they log it via the SOCIAL-REPLY webhook:

```javascript
const result = await fetch('https://n8n.carltonaiservices.com/webhook/social-reply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    draft_id: 45,                    // the original outreach draft
    reply_text: 'Their reply text here...',
    author: 'Their Username',
    platform: 'reddit',
    brand_id: 'carlton',
    generate_response: true          // auto-draft a GPT response
  })
});
// Returns: { success, reply_logged, response_drafted, draft_reply, conversation_id }
```

Alternatively, from the CRM contact page, use `contact_id` instead of `draft_id`:
```javascript
await fetch('https://n8n.carltonaiservices.com/webhook/social-reply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contact_id: 'C_260321070000',    // system finds the most recent acted draft
    reply_text: 'Their reply text here...',
    author: 'Their Name',
    brand_id: 'carlton',
    generate_response: true
  })
});
```

The workflow automatically:
1. Logs the inbound reply in `social_conversations`
2. Updates engagement score on the linked contact (+15)
3. Auto-promotes prospect to lead if applicable
4. Drafts a GPT response using full conversation history (if `generate_response: true`)

### Approving/Sending a Drafted Response

Drafted responses appear in `social_conversations` where `author_is_us = true AND approval_status = 'pending_review'`.

```javascript
// Approve
await supabase.from('social_conversations')
  .update({ approval_status: 'approved', approved_at: new Date().toISOString() })
  .eq('id', conversationRowId);

// Mark as sent (after user copies and pastes)
await supabase.from('social_conversations')
  .update({ action_status: 'acted', acted_at: new Date().toISOString() })
  .eq('id', conversationRowId);
```

---

## 8. Discovery Run History

Read-only dashboard widget showing recent scraper executions.

```javascript
const { data } = await supabase
  .from('social_discovery_runs')
  .select('id, platform, search_type, search_query, discovery_type, profiles_found, profiles_duplicate, targets_created, cost_usd, status, created_at')
  .eq('brand_id', 'carlton')
  .order('created_at', { ascending: false })
  .limit(20);
```

Each row shows: when the run happened, which platform, what was searched, how many prospects were found, how many were new vs duplicates, APIFY cost, and status.

---

## 9. Workflow Webhooks

These are backend workflow entry points. The frontend calls them via `fetch()` (not Supabase RPC).

| Webhook Path | Method | Purpose | Payload |
|--------------|--------|---------|---------|
| `/social-orchestrator` | POST | Trigger discovery for one or all platforms | `{ brand_id, platform? }` |
| `/social-reddit-orch` | POST | Trigger Reddit discovery manually | `{ brand_id, mode: "wave_catcher" \| "pain_prospector" }` |
| `/social-approved` | POST | Callback after human approval (redraft) | `{ action, draft_id, feedback, brand_id }` |
| `/social-reply` | POST | Log inbound reply, optionally draft response | `{ draft_id \| contact_id, reply_text, author, platform, brand_id, generate_response }` |
| `/social-discover` | POST | Direct platform discovery (internal, used by orchestrator) | Internal use only |
| `/social-act` | POST | Internal callback after marking acted | Internal use only |

**Base URL:** `https://n8n.carltonaiservices.com/webhook`

---

## 10. Backend Pipeline Overview

This section provides context for understanding how data flows through the system. The frontend does not interact with most of these workflows directly -- they run automatically.

### Non-Reddit Discovery (LinkedIn, Twitter, Instagram, Facebook)

```
SOCIAL-ORCHESTRATOR (7am PT Mon-Fri, or manual POST /social-orchestrator)
  |
  +-> Checks APIFY budget (throttle at 75%, stop at 90%)
  +-> Reads active platforms from social_platform_config
  +-> Reads search inputs from social_discovery_inputs (sorted by weight)
  |
  For each active platform:
    |
    +-> SOCIAL-DISCOVER
    |     +-> Calls PROSP-SCRAPE (APIFY gateway)
    |     +-> APIFY actor runs the scrape (can take 30s to 12min for LinkedIn)
    |     +-> Platform-specific result parsing
    |     +-> Upserts into social_targets (dedup by platform_username)
    |     +-> New targets only flow downstream
    |
    +-> SOCIAL-QUALIFY
    |     +-> GPT-5-mini scores relevance + engagement potential
    |     +-> Classifies as DM or engagement
    |     +-> Updates social_targets with scores + classification
    |
    +-> SOCIAL-DRAFT (for each qualified target)
          +-> Loads per-platform voice settings
          +-> GPT-4.1 drafts personalized message
          +-> Saves to social_outreach_drafts
          +-> Creates human task (appears in frontend approval queue)
```

### Reddit Discovery (Separate Pipeline)

```
SOCIAL-REDDIT-ORCH (4x/day for each mode)
  |
  +-> Wave Catcher (7am/10am/1pm/4pm PT)
  |     +-> Browses /r/{sub}/new.json for 4 rotating subreddits
  |     +-> ~80 posts per execution
  |     +-> GPT selects top 5 most promising
  |     +-> engagement_subtype: reddit_wave_comment
  |
  +-> Pain Prospector (8:30am/11:30am/2:30pm/5:30pm PT)
        +-> Searches pain phrases across 4 rotating industry subreddits
        +-> GPT selects top 5 matching pain points
        +-> engagement_subtype: reddit_pain_comment
  |
  Both modes flow to:
    SOCIAL-QUALIFY -> SOCIAL-DRAFT -> Human task -> Frontend queue
```

### Nightly Learning

```
SOCIAL-VOICE-LEARN (midnight PT daily)
  +-> Analyzes approve/reject/edit patterns per platform (last 7 days)
  +-> GPT-5-mini generates 1-3 voice setting suggestions
  +-> Saves to social_voice_learning_log (status='pending')
  +-> Creates voice snapshots for one-click apply
```

---

## 11. Architectural Notes

1. **All platforms share the same approval/action RPCs.** `approve_social_draft`, `quick_act_social_draft`, and `increment_social_action` work identically for Reddit, Twitter, Facebook, Instagram, and LinkedIn. Platform differentiation is purely visual.

2. **LinkedIn targets are people, not companies.** The scraper finds job postings, identifies the companies behind them, then scrapes employee profiles. `raw_scrape_data` includes company context (company name, URL, source job title).

3. **Reddit uses a separate orchestrator.** Reddit uses the free public API (no APIFY cost), runs 4x/day (vs daily for APIFY platforms), and has two distinct discovery modes. It has its own workflow: SOCIAL-REDDIT-ORCH.

4. **`social_discovery_inputs` is the source of truth for non-Reddit scraper config.** Changes take effect on the next scheduled run (7am PT) or manual trigger. Reddit config is separate (in `social_platform_config.search_strategies`) because its structure is fundamentally different (subreddit groups and pain phrases vs simple keyword searches).

5. **Daily limits are enforced server-side.** The RPCs check limits before incrementing and return `{ success: false, error: '...' }` if the limit is hit. The frontend should display an error toast and disable the action button.

6. **SOCIAL-CLEANUP auto-expires stale drafts.** The approval queue is self-maintaining. Wave catcher drafts expire after 24h, pain prospector after 48h, other platforms after 5 days. The frontend does not need to handle expiry logic.

7. **Upsert deduplication.** When the same prospect is found again in a later scrape, their `last_seen_at` and scores are refreshed but their `status` and `classification` are preserved. Only truly new targets flow through the qualify/draft pipeline.

8. **APIFY budget is shared across all non-Reddit platforms.** The $39/month budget is tracked in `social_discovery_runs.cost_usd`. The backend auto-throttles at 75% and stops at 90%. Use `get_apify_monthly_spend` to show budget status in the UI.

9. **Voice settings and email are completely independent systems.** Social uses `social_voice_settings` + `social_voice_learning_log` + `social_voice_snapshots`. Email uses `outreach_voice_settings` + `voice_learning_log`. Different tables, different workflows, different learning loops.

---

## Related Documents

- **Frontend dashboard spec:** `docs/FRONTEND_SOCIAL_OUTREACH_SPEC.md`
- **Frontend updates (incremental):** `docs/FRONTEND_SOCIAL_UPDATES_NEEDED.md`
- **Social voice settings spec:** `docs/FRONTEND_SOCIAL_VOICE_SETTINGS_SPEC.md`
- **Full SQL migration:** `sql/session_social_outreach_schema.sql`
- **System overhaul handoff:** `docs/SESSION_HANDOFF_20260321_SOCIAL_SYSTEM_OVERHAUL.md`
- **APIFY fix handoff:** `docs/SESSION_HANDOFF_20260321_APIFY_FIX.md`
