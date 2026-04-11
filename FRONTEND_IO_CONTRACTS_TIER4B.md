# Frontend IO Contracts — Tier 4B: Prospecting Pipeline

**Generated:** 2026-03-28 (Final — all bugs fixed + architectural refactors applied)
**Source of Truth:** `system_registry.io_schema` column (query Supabase for latest)
**Scope:** 28 workflows — the complete prospecting pipeline from lead discovery through cold email sending
**Bug Fix + Refactor Session:** 9 bugs fixed (1 CRITICAL, 2 HIGH, 5 MEDIUM, 1 LOW). 3 architectural refactors (SEARCH-EXECUTE 13→20, EMAIL-ENRICH 28→31, WEB-ENRICH 13→17). Zero remaining known issues.

---

## How to Query Live Schemas

```javascript
// All Tier 4B schemas
const { data } = await supabase
  .from('system_registry')
  .select('name, io_schema, metadata')
  .or('name.like.PROSP-%,name.like.COLD-%,name.like.VOICE-EXPAND%')
  .not('io_schema', 'is', null)
  .order('name');
```

---

## Summary Table

| # | Workflow | Nodes | Trigger | Webhook Path | Response | Frontend-Facing? |
|---|---------|-------|---------|-------------|----------|-----------------|
| 1 | PROSP-ORCHESTRATOR | 15 | schedule+webhook | `prosp-orchestrator` | sync/202 | No (internal) |
| 2 | PROSP-ZIP-SEEDER | 12 | webhook | `prosp-zip-seeder` | sync | No (internal) |
| 3 | PROSP-QUERY-BUILDER | 8 | webhook | `prosp-query-builder` | sync | No (internal) |
| 4 | PROSP-SEARCH-EXECUTE | 20 | webhook | `prosp-search-execute` | sync | No (internal) |
| 5 | PROSP-RDGR-ROUTER | 12 | webhook | `prosp-rdgr-router` | sync | No (RDGR bridge) |
| 6 | PROSP-GMAPS | 10 | webhook | `prosp-gmaps` | sync | No (internal) |
| 7 | PROSP-QUALIFY | 14 | webhook | `prosp-qualify` | sync | **Yes** (manual qualify) |
| 8 | PROSP-ENRICH-SCHEDULER | 8 | schedule | — | none | No (scheduler) |
| 9 | PROSP-WEB-ENRICH-SCHEDULER | 5 | schedule | — | none | No (scheduler) |
| 10 | PROSP-WEB-ENRICH | 17 | webhook | `prosp-web-enrich` | 202 async | No (internal) |
| 11 | PROSP-EMAIL-ENRICH | 31 | webhook | `prosp-email-enrich` | 200/500 async | No (internal) |
| 12 | PROSP-SOCIAL-BRIDGE | 13 | webhook | `prosp-social-bridge` | 202 async | No (internal) |
| 13 | PROSP-ENRICH-TW | 7 | webhook | `prosp-enrich-tw` | sync | No (internal) |
| 14 | PROSP-ENRICH-FB | 8 | webhook | `prosp-enrich-fb` | sync | No (internal) |
| 15 | PROSP-ENRICH-IG | 10 | webhook | `prosp-enrich-ig` | sync | No (internal) |
| 16 | PROSP-ENRICH-LI | 17 | webhook | `prosp-enrich-li` | sync | No (internal) |
| 17 | PROSP-SOCIAL-ENRICH | 22 | webhook | `prosp-social-enrich` | sync | No (internal) |
| 18 | PROSP-ACTOR-JOBS | 19 | schedule+webhook | `prosp-actor-jobs` | sync | No (internal) |
| 19 | PROSP-ACTOR-ENRICH | 23 | schedule+webhook | `prosp-actor-enrich` | sync | No (internal) |
| 20 | PROSP-ACTOR-LEADS | 26 | schedule+webhook | `prosp-actor-leads` | sync | No (internal) |
| 21 | PROSP-LEAD-IMPORT | 7 | webhook | `prosp-lead-import` | 202 async | **Yes** (frontend import) |
| 22 | PROSP-SHEETS-WATCHER | 8 | schedule | — | none | No (scheduler) |
| 23 | PROSP-OUTREACH-DRAFT-V2 | 16 | webhook | `prosp-outreach-draft-v2` | 202 async | No (internal) |
| 24 | PROSP-OUTREACH-DRAFT | 19 | webhook | `prosp-outreach-draft` | 202 async | No (DEPRECATED) |
| 25 | PROSP-OUTREACH-APPROVED | 12 | webhook | `prosp-outreach-approved` | sync | **Yes** (approval UI) |
| 26 | COLD-OUTREACH-ENROLLER | 12 | webhook | `cold-outreach-enroller` | sync | No (internal) |
| 27 | COLD-OUTREACH-SENDER | 18 | schedule+webhook | `cold-outreach-sender-test` | none | No (scheduler) |
| 28 | VOICE-EXPAND | 7 | webhook | `voice-expand` | sync | **Yes** (settings UI) |

**Frontend-facing workflows:** PROSP-QUALIFY, PROSP-LEAD-IMPORT, PROSP-OUTREACH-APPROVED (already in Tier 1), VOICE-EXPAND

---

## Pipeline Flow

```
PROSP-ORCHESTRATOR (daily 7AM PT)
  → PROSP-ZIP-SEEDER (Perplexity zip generation)
  → PROSP-QUERY-BUILDER (GPT search combo selection)
  → PROSP-SEARCH-EXECUTE (GMAPS + qualify + channel routing)
    → PROSP-GMAPS (Google Places API)
    → PROSP-QUALIFY (GPT scoring, batch-of-20)
    → PROSP-EMAIL-ENRICH (website scraping for emails)
      → PROSP-OUTREACH-DRAFT-V2 (composable email assembly)
        → COLD-OUTREACH-ENROLLER (DNC check + queue)
          → COLD-OUTREACH-SENDER (3-Gmail rotation, every 4h)
    → PROSP-SOCIAL-BRIDGE (platform router)
      → PROSP-ENRICH-{IG|FB|TW|LI} (APIFY enrichment)
      → SOCIAL-QUALIFY → SOCIAL-DRAFT

Parallel paths:
  PROSP-ENRICH-SCHEDULER (every 2h) → PROSP-EMAIL-ENRICH
  PROSP-WEB-ENRICH-SCHEDULER (every 4h) → PROSP-WEB-ENRICH
  PROSP-ACTOR-LEADS (daily 10AM) → PROSP-SCRAPE → PROSP-QUALIFY
  PROSP-ACTOR-ENRICH (daily 12PM) → PROSP-SCRAPE → update contacts
  PROSP-ACTOR-JOBS (weekly Mon 11AM) → PROSP-SCRAPE → human review
  PROSP-SHEETS-WATCHER (every 4h) → PROSP-LEAD-IMPORT
  PROSP-SOCIAL-ENRICH (GPT-based, older approach)
```

---

## Frontend-Facing Workflow Contracts

### PROSP-LEAD-IMPORT
**Webhook:** POST `prosp-lead-import` | **7 nodes** | **Async (202)**

| Input Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `leads` | object[] | Yes | — | `{business_name, email, phone, website, address, category}` |
| `brand_id` | string | No | `carlton` | |
| `source` | string | No | — | Import source label |
| `source_type` | string | No | — | `json`, `sheets`, `csv` |

**Response (202):** `{success, message, leads_count}`

### PROSP-QUALIFY (manual trigger)
**Webhook:** POST `prosp-qualify` | **14 nodes** | **Sync**

| Input Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `leads` | object[] | Yes | — | Lead objects (accepts field aliases) |
| `brand_id` | string | No | `carlton` | |
| `source_type` | string | No | `unknown` | |
| `task_id` | string | No | null | |

| `scoring_context` | string | No | `""` | Custom scoring criteria appended to GPT prompt |

**Response:** `{success, total_leads, qualified_count, pipeline_count, high_value_count, contact_ids, storage, storage_error, pipeline_error, scored_leads, qualified_leads, high_value_leads, ...}`

**New fields (2026-03-28):** `storage_error` (string|null) — non-null if CRM bulk import failed. `pipeline_error` (string|null) — non-null if pipeline storage failed. Previously these failures were masked as `success:true`.

### VOICE-EXPAND
**Webhook:** POST `voice-expand` | **7 nodes** | **Sync**

| Input Field | Type | Required | Default |
|---|---|---|---|
| `text` | string | Yes | — |
| `persona` | enum | Yes | — | `bradford|carlton|professional|casual` |
| `brand_id` | string | No | `carlton` |
| `max_length` | number | No | — |
| `tone` | string | No | — |

**Response:** `{success, expanded_text, persona, original_length, expanded_length}`

---

## Bugs Fixed (2026-03-28)

| Severity | Workflow | Fix Applied |
|----------|---------|-------------|
| **CRITICAL** | PROSP-SEARCH-EXECUTE | Assign Channels now reads `contact_ids` (was looking for nonexistent `qualified_contacts`). Channel assignment now works. |
| **HIGH** | PROSP-SEARCH-EXECUTE | IF node replaced with parallel execution — both email AND social enrichment now run for each batch. |
| **HIGH** | COLD-OUTREACH-ENROLLER | SplitInBatches connections fixed — done output[0]→Build Response, loop output[1]→Check DNC (were swapped). |
| **MEDIUM** | PROSP-EMAIL-ENRICH | `.first()`→`.last()` in Parse GPT Response + Prepare Log Data. Was corrupting all contacts after first in loop. |
| **MEDIUM** | PROSP-EMAIL-ENRICH | Check Found Email changed from `notEquals ''` (loose) to `notEmpty` (strict). Prevents null email overwrites. |
| **MEDIUM** | PROSP-ZIP-SEEDER | Build Response uses `$('Parse Perplexity').all()` instead of `$input.all()` on done output. `zips_seeded` count now accurate. |
| **MEDIUM** | PROSP-QUALIFY | `scoring_context` input now properly wired to GPT prompt (was reading nonexistent `brand_config`). |
| **MEDIUM** | PROSP-QUALIFY | Format Response exposes `storage_error` + `pipeline_error` fields. CRM/pipeline failures no longer masked. |
| **LOW** | PROSP-WEB-ENRICH-SCHEDULER | Log Result aggregates across all chunks using `.all()`. |

**Total fixed: 1 CRITICAL, 2 HIGH, 5 MEDIUM, 1 LOW = 9 bugs fixed**

## Architectural Refactors Applied (2026-03-28)

All Code-node-with-HTTP-loop anti-patterns and hardcoded Supabase keys have been eliminated:

| Workflow | Before | After | What Changed |
|----------|--------|-------|-------------|
| PROSP-SEARCH-EXECUTE | 13 nodes | 20 nodes | GMAPS Code loop → SplitInBatches+HTTP. Assign Channels Code loop → SplitInBatches+HTTP with `predefinedCredentialType`. Extract Qualify Results → logic-only. All hardcoded keys removed. |
| PROSP-EMAIL-ENRICH | 28 nodes | 31 nodes | Scrape Website Pages Code (4 HTTP calls) → Build Page URLs+Fetch Page HTTP+Collect pattern. Added Check Fetch Success guard (returns 500 not false 200). |
| PROSP-WEB-ENRICH | 13 nodes | 17 nodes | All Supabase calls moved from Code to HTTP Request nodes with `predefinedCredentialType:supabaseApi`. Parse GPT Store → logic-only. Fixed `continueOnFail` conflicts. |

**Architectural principle applied:** HTTP Request nodes for all external API/DB calls (uses credentials, no task runner timeout). Code nodes for logic/transformation only.

## Remaining Known Issues

None of the original HIGH/MEDIUM/LOW architectural issues remain. All have been refactored.

**Zero remaining known issues in the prospecting pipeline.**

---

## Deprecated Workflows

| Workflow | Status | Replacement | Action Needed |
|----------|--------|-------------|---------------|
| PROSP-OUTREACH-DRAFT | Active (should be deactivated) | PROSP-OUTREACH-DRAFT-V2 | Deactivate + set registry status to `inactive` |
| PROSP-ACTOR-SOCIAL | Already inactive | PROSP-SOCIAL-BRIDGE + individual enrichers | None |
| PROSP-ERR | Already inactive | ERR-UTIL | None |
| PROSP-SCHEDULER / V2 | Already deprecated | PROSP-ORCHESTRATOR | None |

---

## Cross-References

- **Tier 1:** `docs/FRONTEND_IO_CONTRACTS_TIER1.md` — Core utilities + approval workflows (includes PROSP-OUTREACH-APPROVED)
- **Tier 2:** `docs/FRONTEND_IO_CONTRACTS_TIER2.md` — RDGR Pipeline
- **Tier 3:** `docs/FRONTEND_IO_CONTRACTS_TIER3.md` — Domain agents (includes PROSP-RDGR-ROUTER)
- **Tier 4A:** `docs/FRONTEND_IO_CONTRACTS_TIER4A.md` — Utilities + ERR-UTIL
- **Standardization:** `docs/STANDARDIZATION_SPEC.md` — io_schema format reference

## Dashboard Impact (Frontend Action Items)

The following changes may affect the RDGR dashboard:

### PROSP-QUALIFY Response Change
**New fields added to response:** `storage_error` (string|null) and `pipeline_error` (string|null).
- If `storage_error` is non-null, the CRM import failed — display a warning to the user
- If `pipeline_error` is non-null, pipeline storage failed — display a warning
- Previously these failures were silently masked as `success: true` with 0 contacts

**Action:** If the dashboard displays PROSP-QUALIFY results, check for these new error fields and display appropriate warnings.

### PROSP-SEARCH-EXECUTE Now Runs Both Channels
Previously, channel routing was broken (email enrichment never triggered from this path). Now both email AND social enrichment run in parallel after each search batch.
- **Impact:** More drafts will appear in the email outreach review queue
- **Impact:** Social enrichment tasks will now be created alongside email tasks
- **No frontend changes needed** — both paths feed into existing review queues

### COLD-OUTREACH-ENROLLER Now Functional
The enrollment workflow was broken for multi-lead batches (SplitInBatches connections were swapped). It now correctly processes all leads in a batch.
- **Impact:** Enrollment counts in response will now be accurate
- **No frontend changes needed** — the response shape is unchanged

### PROSP-EMAIL-ENRICH Data Accuracy + Error Handling
Previously, all contacts after the first in each enrichment batch were getting email data attributed to the wrong contact. This is now fixed. Additionally:
- **New:** If Supabase is unavailable when fetching contacts, the webhook now returns **HTTP 500** with error details instead of a false **HTTP 200** "started" message
- **Impact:** Historical email enrichment data may have incorrect attributions for multi-contact batches
- **Frontend action:** If calling `prosp-email-enrich` directly, handle 500 responses (previously always returned 200)

---

**NOTE:** This doc is a snapshot as of 2026-03-28. Query `system_registry.io_schema` for the latest contracts.
