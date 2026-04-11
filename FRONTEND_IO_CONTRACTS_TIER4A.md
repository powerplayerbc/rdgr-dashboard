# Frontend IO Contracts -- Tier 4A (Utilities + Unified Error Handler)

**Generated:** 2026-03-28 | **Updated:** 2026-03-28 (deep audit complete + ERR-UTIL consolidation)
**Validated:** All 24 workflows deep-audited: every Code node read, all connections verified, 14 bugs found and fixed. Schemas validated against actual workflow code post-fix.
**Purpose:** Machine-readable input/output contracts for Tier 4A utility and error handler workflows.
**Source of truth:** `system_registry.io_schema` column in Supabase. This doc is a snapshot -- query the live column for the latest.

---

## How to Query Live Schemas

```javascript
// Get all workflows with IO schemas
const { data } = await supabase
  .from('system_registry')
  .select('name, category, io_schema')
  .not('io_schema', 'is', null)
  .order('name');

// Get a specific workflow's contract
const { data } = await supabase
  .from('system_registry')
  .select('name, io_schema')
  .eq('name', 'APIFY-UTIL')
  .single();
```

---

## Tier 4A Summary

| # | Workflow | Category | Trigger | Webhook Path | Status | Nodes | Frontend-Facing? |
|---|----------|----------|---------|--------------|--------|-------|-----------------|
| 1 | **ERR-UTIL** | utility | Error | (internal) | ACTIVE | 13 | No |
| 2 | POST-FACEBOOK | utility | Webhook | `rdgr-tool-post-facebook` | ACTIVE | 17 | No |
| 3 | POST-INSTAGRAM | utility | Webhook | `rdgr-tool-post-instagram` | ACTIVE | 17 | No |
| 4 | POST-LINKEDIN | utility | Webhook | `rdgr-tool-post-linkedin` | ACTIVE | 18 | No |
| 5 | POST-TWITTER | utility | Webhook | `rdgr-tool-post-twitter` | ACTIVE | 16 | No |
| 6 | APIFY-UTIL | utility | Webhook | `prosp-scrape` | ACTIVE | 15 | No |
| 7 | BRAND-UTIL | utility | Webhook | `rdgr-brand` | ACTIVE | 14 | No |
| 8 | COPYWRITE-UTIL | utility | Webhook | `copywrite-generate` | ACTIVE | ~15 | No |
| 9 | STRIPE-UTIL | utility | Webhook | `stripe-manage` | ACTIVE | 12 | No |
| 10 | DOC-CREATE | utility | Webhook | `create-google-doc` | ACTIVE | 21 | No |
| 11 | Create Google Form | utility | Webhook | `create-google-form` | ACTIVE | 14 | No |
| 12 | Create Google Slides | utility | Webhook | `create-google-slides` | ACTIVE | 20 | No |
| 13 | VOICE-LEARN-UTIL | utility | Dual | webhook + schedule | ACTIVE | 24 | No |
| 14 | RDGR: Knowledge Ingestion | utility | Webhook | `rdgr-knowledge-ingest` | ACTIVE | 14 | No |
| 15 | RDGR-KNOWLEDGE-QUERY | utility | Webhook | `rdgr-knowledge-query` | ACTIVE | 15 | **YES** (chat) |

**Deactivated (replaced by ERR-UTIL):** BLOG-ERR, BRAIN-ERR, CRM-ERR, DEFT-ERR, KM-ERR, MKTRES-ERR, OFFER-ERR, PRTN-ERR, PROSP-ERR, SOCIAL-ERR, STRIPE-ERR, INV-ERR

---

## ERR-UTIL -- Universal Error Handler

**Workflow ID:** `o7sItu0Gy6CuRdch` | **13 nodes** | **Replaces 12 individual ERR workflows**

All 264 registered workflows point to ERR-UTIL via their `settings.errorWorkflow` field. It is the single error handler for the entire system.

### Flow

```
Error Trigger → Classify Error → [Log to Supabase + Forward to AUTOFIX] (parallel)
  → Log to Sheets → Route by Severity
    ├── Transient → Retry Task (reset to ready in autonomous_task_queue)
    ├── Structural → Deactivate Source → Send Email → Generate Alert → Update Registry (broken)
    ├── Critical → Deactivate Source → Send Email → Generate Alert → Update Registry (broken)
    └── Fallback → Deactivate Source → Send Email → Generate Alert → Update Registry (broken)
```

### Classify Error Logic

| Feature | Details |
|---------|---------|
| **System detection** | 30+ prefix mappings from workflow name (BRAIN-* → brain, PROSP-* → prospecting, etc.) |
| **Severity classification** | Transient (timeout, rate limit, 429, 503), Critical (OOM, auth, credentials), Structural (default) |
| **brand_id extraction** | Tries Webhook Trigger, Webhook, Chat Trigger node data from execution context |
| **task_id extraction** | Webhook body `task_id` field, then regex: `RDGR-[A-Z]+-\d+`, `P_\d{12}`, `\d{12}-\d+` |

### Severity Actions

| Severity | Deactivate? | Email? | Registry Status | Task Queue |
|----------|-------------|--------|-----------------|------------|
| Transient | No | No | Unchanged | Reset to `ready` |
| Structural | Yes | Yes | `broken` | Unchanged |
| Critical | Yes | Yes | `broken` | Unchanged |
| Fallback | Yes | Yes | `broken` | Unchanged |

### Bugs Fixed During Audit

| Bug | Severity | Fix |
|-----|----------|-----|
| `$env.SUPABASE_KEY` in 3 HTTP nodes | CRITICAL | Replaced with `predefinedCredentialType: supabaseApi` credential |
| 8 standard ERR workflows: `$json.workflow_id` in Deactivate node after HTTP Request | CRITICAL | Was `undefined` — deactivation silently failed on every error |
| 2 lite ERR workflows: Wrong Error Trigger data paths | MEDIUM | `$json.execution?.workflow` → `$json.workflow` |
| 2 lite ERR workflows: SQL injection risk via exec_sql | MEDIUM | Switched to direct POST to `autonomous_execution_log` |
| No email notification in original RDGR-ERR | MEDIUM | Added Gmail node for all non-transient errors |
| No workflow deactivation in original RDGR-ERR | MEDIUM | Added n8n API deactivation call for non-transient errors |

---

## Social Posting Utilities (4 workflows)

All POST-* utilities share a common pattern and response format.

### Common Input Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `content_text` | string | Yes (FB/LI/TW) | Post text content |
| `post_type` | enum | No | Platform-specific (see below) |
| `hashtags` | string[] | No | Auto-appended to content |
| `media_urls` | string[] | No | Image URLs for media posts |
| `video_url` | string | No | Video URL for video posts |
| `brand_id` | string | No | Brand identifier |
| `task_id` | string | No | Task tracking ID |

### Common Response

```json
{
  "success": true,
  "post_id": "page_post_id",
  "post_url": "https://platform.com/...",
  "platform": "facebook|instagram|linkedin|twitter",
  "error": null
}
```

### Platform-Specific Details

| Platform | Webhook Path | Post Types | Extra Fields |
|----------|-------------|------------|--------------|
| **Facebook** | `rdgr-tool-post-facebook` | text, image, carousel, video | -- |
| **Instagram** | `rdgr-tool-post-instagram` | image, carousel, video, reel | media_urls required for all types |
| **LinkedIn** | `rdgr-tool-post-linkedin` | text, image, video, article, carousel | `link_url`, `post_as` (organization\|person) |
| **Twitter** | `rdgr-tool-post-twitter` | text, image, video, thread | `tweets[]` (for threads), `source` |

---

## Standalone Utilities (10 workflows)

### APIFY-UTIL
**Webhook:** `prosp-scrape` | **15 nodes** | **Long-running** (polls up to 20 min)

Runs APIFY web scraping actors. Resolves actor config from `apify_actor_registry`, starts run, polls for completion, fetches dataset results.

| Input Field | Type | Required | Notes |
|-------------|------|----------|-------|
| `actor_name` | string | * | Lookup name in registry |
| `actor_id` | string | * | Direct actor ID |
| `input` | object | No | Actor-specific input (field names vary per actor) |
| `brand_id` | string | No | Defaults to 'carlton' |
| `task_id` | string | No | Task tracking |

\* Either `actor_name` or `actor_id` required.

**Response:** `{success, actor_id, actor_name, run_id, dataset_id, brand_id, task_id, items_count, items[], source, run_stats}`

---

### BRAND-UTIL
**Webhook:** `rdgr-brand` | **14 nodes** | **5 operations**

CRUD for `autonomous_brands` table.

| Operation | Required Fields | Description |
|-----------|----------------|-------------|
| `create_brand` | brand_id, name | Creates brand with optional config/identity |
| `update_brand` | brand_id, updates | Patches allowed fields (config, identity, name, status) |
| `get_brand` | brand_id | Returns full brand record |
| `list_brands` | (none) | Returns all active brands |
| `archive_brand` | brand_id | Sets status to archived |

**Response:** `{success, operation, data}` or `{success, operation, error}`

---

### COPYWRITE-UTIL
**Webhook:** `copywrite-generate` | **~15 nodes**

Generates copy via GPT with brand voice/style settings.

| Input Field | Type | Required | Notes |
|-------------|------|----------|-------|
| `copy_type` | string | Yes | Determines prompt template |
| `context` | object | No | Additional context for generation |
| `brand_id` | string | No | Defaults to 'carlton' |
| `draft_id` | string | No | For revisions of existing drafts |
| `human_feedback` | string | No | User feedback for revision |
| `auto_feedback` | string | No | AI feedback for revision |
| `requested_by` | string | No | Defaults to 'system' |
| `revision_count` | number | No | Tracks revision depth |

**Response:** `{success, copy_type, draft_id, content, brand_id}`

---

### STRIPE-UTIL
**Webhook:** `stripe-manage` | **12 nodes** | **3 operations** | Uses **TEST** credential

| Operation | Required Fields | Description |
|-----------|----------------|-------------|
| `create_product` | name, amount_cents | Creates product + price + payment link, saves to Supabase |
| `create_payment_link` | stripe_price_id | Creates payment link for existing price |
| `get_product` | (none) | Placeholder -- returns advisory message |

**Response varies by operation** -- always includes `{success, operation, task_id}`

---

### DOC-CREATE
**Webhook:** `create-google-doc` | **21 nodes**

Creates formatted Google Docs with optional tables, sharing, and folder placement.

| Input Field | Type | Required | Notes |
|-------------|------|----------|-------|
| `title` | string | Yes | Document title |
| `content` | string | Yes | Text content (supports basic formatting) |
| `brand_id` | string | No | For brand theme styling |
| `folder_id` | string | No | Target Drive folder |
| `share_public` | boolean | No | Make publicly viewable |
| `tables` | object[] | No | Table definitions with headers and rows |

**Response:** `{success, document_id, document_url, title}`

---

### Create Google Form
**Webhook:** `create-google-form` | **14 nodes**

Creates Google Forms with 15+ question types, quiz grading, branching logic, sections.

| Input Field | Type | Required | Notes |
|-------------|------|----------|-------|
| `title` | string | Yes | Form title |
| `questions` | object[] | Yes | Question definitions |
| `description` | string | No | Form description |
| `folder_id` | string | No | Target Drive folder |
| `collect_email` | boolean | No | Require email from respondents |
| `is_quiz` | boolean | No | Enable quiz mode with grading |
| `sections` | object[] | No | Multi-page sections |
| `confirmation_message` | string | No | Post-submission message |
| `publish` | boolean | No | Make form accepting responses |

**Response:** `{success, form_id, form_url, edit_url, responder_url, title}`

---

### Create Google Slides
**Webhook:** `create-google-slides` | **20 nodes**

Creates Google Slides presentations with Layout Engine and brand theming.

| Input Field | Type | Required | Notes |
|-------------|------|----------|-------|
| `title` | string | Yes | Presentation title |
| `sections` | object[] | No | Slide content definitions |
| `brand_id` | string | No | For brand theme from autonomous_brands |
| `folder_id` | string | No | Target Drive folder |
| `orientation` | enum | No | landscape (default) or portrait |
| `theme` | object | No | Custom theme overrides |

**Response:** `{success, presentation_id, presentation_url, title}`

---

### VOICE-LEARN-UTIL
**Dual trigger:** Webhook + Nightly Schedule | **24 nodes**

Analyzes approved outreach drafts to learn voice/style patterns per platform.

| Input Field | Type | Required | Notes |
|-------------|------|----------|-------|
| `brand_id` | string | No | Brand to analyze |
| `context_type` | string | No | Context scope |
| `platforms` | string[] | No | Platforms to analyze |

**Response:** `{success, suggestions_count, platforms_analyzed, contexts_processed}`

---

### RDGR: Knowledge Ingestion
**Webhook:** `rdgr-knowledge-ingest` | **14 nodes**

Ingests knowledge entries into vector store (pgvector on Supabase).

| Input Field | Type | Required | Notes |
|-------------|------|----------|-------|
| `entries` | object[] | Yes | Knowledge entries to ingest |
| `brand_id` | string | No | Brand scope |
| `source` | string | No | Source identifier |
| `category` | string | No | Knowledge category |

**Response:** `{success, total, inserted, errors}`

---

### RDGR-KNOWLEDGE-QUERY
**Webhook:** `rdgr-knowledge-query` | **15 nodes** | **Frontend-facing** (chat interface)

RAG search: embeds query, vector-searches knowledge base, generates answer via GPT.

| Input Field | Type | Required | Notes |
|-------------|------|----------|-------|
| `query` | string | Yes | Natural language question |
| `brand_id` | string | No | Brand scope |
| `category` | string | No | Filter by knowledge category |
| `limit` | number | No | Max results from vector search |
| `similarity_threshold` | number | No | Min similarity score |

**Response:** `{success, answer, sources[], query}`

---

## Issues Found and Fixed During Deep Audit

| # | Workflow(s) | Issue | Severity | Fix Applied |
|---|-------------|-------|----------|-------------|
| 1 | Knowledge Ingestion | `.first()` in SplitInBatches loop — all entries after first ingested with wrong data | CRITICAL | Changed to `.last()` |
| 2 | 8 standard ERR workflows | `$json.workflow_id` undefined in Deactivate node — deactivation silently failed | CRITICAL | Changed to `$('Parse Error').first().json.workflow_id` |
| 3 | RDGR-ERR (now ERR-UTIL) | `$env.SUPABASE_KEY` in 3 HTTP nodes — Supabase calls silently failing | CRITICAL | Replaced with `predefinedCredentialType: supabaseApi` |
| 4 | POST-INSTAGRAM | Unescaped caption in jsonBody — captions with `"` or `\n` break API call | HIGH | Added `JSON.stringify()` for 3 container creation nodes |
| 5 | POST-LINKEDIN | `.first.json` missing `()` — video file size always hardcoded to 10MB | HIGH | Changed to `.first().json` |
| 6 | POST-TWITTER | Thread completion always returned `success: false` — SplitInBatches done output empty | HIGH | Added thread detection using `$('Track Reply Chain').all()` |
| 7 | STRIPE-UTIL | `}}` expression injection + unescaped fields in Save to Supabase jsonBody | HIGH | Added Code node for safe `JSON.stringify()`, rewired connections |
| 8 | STRIPE-UTIL | Build Response crashes on cross-path node references | HIGH | Added per-operation try-catch guards |
| 9 | COPYWRITE-UTIL | Build Voice Rules `.first().json` only gets first learned rule | MEDIUM | Changed to `.all().map(i => i.json)` |
| 10 | BRAND-UTIL | Switch conditions missing `version: 2` in options | MEDIUM | Added `version: 2` to all 5 conditions |
| 11 | BRAND-UTIL | Archive Brand sends literal `"now()"` string instead of timestamp | MEDIUM | Changed to `new Date().toISOString()` |
| 12 | BLOG-ERR, KM-ERR | Wrong Error Trigger data paths + SQL injection risk | MEDIUM | Rebuilt, then replaced by ERR-UTIL |
| 13 | RDGR-ERR | Missing deactivation + email notification | MEDIUM | Added both to unified ERR-UTIL |
| 14 | 12 ERR workflows | Fragmented error handling — each system had its own handler | ARCH | Consolidated into single ERR-UTIL; 264 workflows migrated |

**Architectural change:** 12 individual ERR workflows replaced by 1 unified ERR-UTIL. All 264 registered workflows now point to ERR-UTIL via `settings.errorWorkflow`. New systems get error handling for free — just register in system_registry.

**Remaining LOW issues (documented, not fixed):**
- FB/IG carousel staticData race condition on concurrent execution
- FB/IG fallback error bypasses Format Response (minor response shape inconsistency)
- TW thread staticData not cleared between executions
- Google Slides Layout Engine passes `color` but Build Slides Content reads `textColor` (table header text color not applied)
- DOC-CREATE missing error handling on Insert Table / Read Doc nodes
- VOICE-LEARN-UTIL nested SplitInBatches may malfunction on nightly 3-context runs

---

## Cross-References

- **Tier 1:** `docs/FRONTEND_IO_CONTRACTS_TIER1.md` -- Core utilities + approval workflows (14)
- **Tier 2:** `docs/FRONTEND_IO_CONTRACTS_TIER2.md` -- RDGR Pipeline (12)
- **Tier 3:** `docs/FRONTEND_IO_CONTRACTS_TIER3.md` -- Domain agents (14)
- **Tier 4A:** This document -- Utilities + unified error handler (15 active, 12 deactivated)

**Total enriched:** 54 workflows with io_schema in system_registry.
**Workflows audited:** 14 utilities + 10 ERR handlers = 24 workflows deep-audited.
**Bugs found and fixed:** 3 CRITICAL, 5 HIGH, 5 MEDIUM, 1 ARCH = 14 fixes applied.
**Bugs documented (LOW):** 6 remaining for future maintenance.
