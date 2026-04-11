# Session Handoff: PROSP System Rebuild — 2026-03-18

## Summary
This session activated the full RDGR autonomous agent system + prospecting pipeline, then diagnosed and rebuilt the broken PROSP-SCHEDULER-V2 (49-node monolith with 7 empty IF nodes, broken HTTP calls, and a city/state parsing bug) into 4 focused sub-workflows. The pipeline now successfully finds leads via Google Maps, scores them with GPT, and stores them in the CRM — but CRM storage at scale and email enrichment still need fixes.

---

## What Was Accomplished

### 1. RDGR System Activation
- Activated 63 RDGR + PROSP workflows via REST API `/activate` endpoint
- Deactivated RDGR-EMAIL (no outbound emails per Bradford's request)
- Deactivated RDGR-QUEUE, RDGR-PLAN, RDGR-REPLAN (Bradford requested during debugging)
- RDGR-PLAN was tested: created 6 strategic directives (2 auto-approved, 4 pending)
- RDGR-TOOLBUILD old ID was deleted; updated to new ID `hAmCpv9I6lZxTOUk`

### 2. RDGR-BRIEF Fix
- "Fetch System Capabilities" node had `limit=60`, missing 152 of 212 registry entries
- Fixed: `limit=300`, added `integration` and `credential` categories to filter
- Node ID: `e5f6a7b8-c9d0-1234-efab-345678901234` in workflow `OILilZvrqHSrs10e`

### 3. PROSP-SCHEDULER-V2 Diagnosis
Root causes found in the old monolith (`PltgW2S9JNPAp19b`):
- **City/state parsing bug**: `geo_zones` config has `name: "Denver CO"` but code used it as-is, falling back to `state_abbr: "NV"` for all non-NV cities
- **Missing `state` column**: `city_zip_codes` table requires `state TEXT NOT NULL` but Parse Perplexity node didn't include it — all zip inserts silently failed
- **7 empty IF nodes**: No conditions set on Has Capacity?, Has Cached Zips?, Check Has Combos, Check Capacity Met, Check Has Leads, Is Webhook Test?
- **Broken HTTP calls**: Get Today Capacity called non-existent RPC, Store Contacts referenced non-existent `crm_payload` field

### 4. Zip Code Seeding
- Seeded 105 zip codes (15 per city) for: Denver, Dallas, Los Angeles, Miami, Nashville, Atlanta, Chicago
- Used background agent with web search for real census data
- Existing data kept: Las Vegas (38), Henderson (9), Phoenix (37)
- Total: 189 zip codes across 10 cities
- Added `DEFAULT ''` to `city_zip_codes.state` column

### 5. PROSP System Rebuild — 4 New Workflows
Replaced PROSP-SCHEDULER-V2 with:

| Workflow | ID | Registry Name | Nodes | Status |
|----------|-----|---------------|-------|--------|
| PROSP-ORCHESTRATOR | `7IZBSdLl3y761cGU` | PROSP-ORCHESTRATOR | 15 | ACTIVE |
| PROSP-ZIP-SEEDER | `kLcr9OL9LYiXI6bh` | PROSP-ZIP-SEEDER | 12 | ACTIVE |
| PROSP-QUERY-BUILDER | `57uzBl6SElfXfYDM` | PROSP-QUERY-BUILDER | 8 | ACTIVE |
| PROSP-SEARCH-EXECUTE | `BuODQdroqvFPrgwt` | PROSP-SEARCH-EXECUTE | 8 | ACTIVE |

Old PROSP-SCHEDULER-V2 (`PltgW2S9JNPAp19b`) is **DEACTIVATED**, registry set to `deprecated`.

### 6. PROSP-QUALIFY Fix
- Replaced broken "Store Contacts" + "Store Pipeline" HTTP nodes with "Store & Collect IDs" Code node
- New node loops through contacts, calls CRM-BRIDGE for each, collects `contact_ids`
- Updated "Format Response" to include `contact_ids` array in output
- Node ID: `store-and-collect` in workflow `4tYezSM6GAllGwxc`

### 7. PROSP-RDGR-ROUTER Fix
- Updated "Format RDGR Response" to pass through `contact_ids` from QUALIFY response
- Node ID: `node-format-response` in workflow `PlCQEF9vSECLPNDN`

### 8. CRM-BRIDGE Fix
- Removed `task_id` as a gatekeeper — now auto-generates `"direct-{timestamp}"` if not provided
- Node ID: `0b8301a9-e74a-43a2-90d7-aea9ba34ddb6` in workflow `m4BDKhh4rbpJdF6N`

### 9. Domain Registry Fix
- `autonomous_domain_registry` prospecting domain set to `status: 'active'`
- Multiple `system_registry` entries updated (JOURNAL, INTROSPECT, EMAIL, SCHEDULER-V2, PROSP actors, TOOLBUILD)

---

## Current State — What Works

```
PROSP-ORCHESTRATOR
  → PROSP-ZIP-SEEDER (seeds zips via Perplexity) .............. ✅ TESTED
  → PROSP-QUERY-BUILDER (GPT picks search queries) ............ ✅ TESTED
  → PROSP-SEARCH-EXECUTE
      → Search All GMAPS (Code node, 8 queries) ............... ✅ 160 results
      → Qualify All Leads (HTTP → ROUTER → QUALIFY → GPT) ..... ✅ Scores leads
      → QUALIFY → Store & Collect IDs → CRM-BRIDGE ............ ⚠️  TIMES OUT (see below)
      → Call Email Enrichment ................................. ❌ Never reached (no contact_ids)
      → Build Response ........................................ ✅ Returns summary
```

**Last E2E test result**: 160 leads found from Google Maps, GPT scored them, but CRM storage timed out in the Code node.

---

## Current Issues (In Priority Order)

### Issue 1: CRM Storage Timeout (BLOCKING)
**Where**: PROSP-QUALIFY → "Store & Collect IDs" Code node
**Problem**: Code node has a hard 60-second execution timeout (`N8N_RUNNERS_TASK_TIMEOUT`). With 100+ qualified contacts, calling CRM-BRIDGE one-by-one via `this.helpers.httpRequest` exceeds 60s.
**Fix needed**: CRM-BRIDGE needs a `bulk_upsert` operation that accepts an array of contacts and inserts them in one Supabase RPC call. The `crm_upsert_contact` function handles one contact at a time — need a new `crm_bulk_upsert` function that loops internally in PL/pgSQL.
**Alternative**: Replace the Code node with SplitInBatches that calls CRM-BRIDGE per contact (each HTTP node has its own timeout). But this is slow for 200+ contacts.

### Issue 2: Email Enrichment Never Fires
**Where**: PROSP-SEARCH-EXECUTE → "Call Email Enrichment" HTTP node
**Problem**: QUALIFY's Store & Collect IDs times out before returning `contact_ids`, so the array is empty. Enrichment is skipped.
**Dependency**: Fix Issue 1 first. Once contact_ids flow, enrichment should work.
**Secondary issue**: PROSP-EMAIL-ENRICH itself has the same one-by-one scraping pattern — each contact requires a website scrape + GPT extraction. This will be slow at 50+ contacts. Should run as background/async job.

### Issue 3: Orchestrator Summary Shows Zeros
**Where**: PROSP-ORCHESTRATOR → "Build Summary" Code node
**Problem**: Reads `searchResults.lead_count` etc. from SEARCH-EXECUTE response, but SEARCH-EXECUTE returns fields like `total_results`, `total_qualified`, `queries_executed` — field name mismatch.
**Fix**: Update Build Summary to read the correct field names from SEARCH-EXECUTE's Build Response output.

### Issue 4: Pipeline Storage Fails (400)
**Where**: PROSP-QUALIFY → "Store & Collect IDs" → pipeline insert
**Problem**: `"pipeline: Request failed with status code 400"` — the `autonomous_revenue_pipeline` insert via Supabase Query utility fails. Likely column/format mismatch.
**Priority**: Low — CRM storage is more important than pipeline tracking.

---

## Workflow Reference (Full PROSP System)

### New Orchestration Layer (built this session)
| Name | Workflow ID | Webhook Path | Status |
|------|------------|--------------|--------|
| PROSP-ORCHESTRATOR | `7IZBSdLl3y761cGU` | `prosp-orchestrator` | ACTIVE |
| PROSP-ZIP-SEEDER | `kLcr9OL9LYiXI6bh` | `prosp-zip-seeder` | ACTIVE |
| PROSP-QUERY-BUILDER | `57uzBl6SElfXfYDM` | `prosp-query-builder` | ACTIVE |
| PROSP-SEARCH-EXECUTE | `BuODQdroqvFPrgwt` | `prosp-search-execute` | ACTIVE |

### Existing Pipeline Workflows (modified this session)
| Name | Workflow ID | Webhook Path | Status | Changes |
|------|------------|--------------|--------|---------|
| PROSP-RDGR-ROUTER | `PlCQEF9vSECLPNDN` | `prosp-rdgr-router` | ACTIVE | Added `contact_ids` passthrough |
| PROSP-QUALIFY | `4tYezSM6GAllGwxc` | `prosp-qualify` | ACTIVE | Replaced Store Contacts with Store & Collect IDs |
| PROSP-GMAPS | `QQ4bNI12uFQG7hOh` | `prosp-gmaps` | ACTIVE | No changes |
| PROSP-EMAIL-ENRICH | `eydHcu8WFVveuxh9` | `prosp-email-enrich` | ACTIVE | No changes (but never successfully called) |
| CRM-BRIDGE | `m4BDKhh4rbpJdF6N` | `rdgr-crm` | ACTIVE | Removed task_id gating |

### Deprecated
| Name | Workflow ID | Status |
|------|------------|--------|
| PROSP-SCHEDULER-V2 | `PltgW2S9JNPAp19b` | DEACTIVATED/DEPRECATED |
| PROSP-SCHEDULER v1 | `5rQDgDodWFTA4zBf` | DEACTIVATED/DEPRECATED |

### Support Workflows
| Name | Workflow ID | Status |
|------|------------|--------|
| PROSP-ERR | `KQmbf7BjGnDXIWi5` | ACTIVE |
| PROSP-SCRAPE | `aV58hNbw8ZwH1vwf` | ACTIVE |
| PROSP-SOCIAL-ENRICH | `imJ3ULC5S8VmEVAU` | ACTIVE |
| PROSP-ACTOR-LEADS | `wX5l8Egcp968510X` | ACTIVE |
| PROSP-ACTOR-SOCIAL | `JcVA6MIt1QheUQ5E` | ACTIVE |
| PROSP-ACTOR-ENRICH | `YhPbDpRBgSy3KCQd` | ACTIVE |
| PROSP-ACTOR-JOBS | `EK0tfjZlqM0vjF9g` | ACTIVE |

---

## RDGR System State

### Deactivated During Session (Bradford requested)
- **RDGR-QUEUE** (`hgiJatA5xwOEBuhB`) — DEACTIVATED
- **RDGR-PLAN** (`dsT7TTikzkpwJG0u`) — DEACTIVATED
- **RDGR-REPLAN** (`v6LT0fFbr9FWgy8R`) — DEACTIVATED
- **RDGR-EMAIL** (`EKoBe5E8grwo4qnz`) — DEACTIVATED (no outbound emails)

### Still Active
All other RDGR workflows remain active (COMPLETE, THINKING, REVIEW, APPROVE, RESEARCH, WRITING, etc.)

---

## Key Documents to Review

| Document | Path | Purpose |
|----------|------|---------|
| CLAUDE.md | `CLAUDE.md` | Master project instructions, credentials, rules |
| Memory index | `memory/MEMORY.md` | Index of all project memory files |
| CRM schema | `sql/crm_unified_schema.sql` | `crm_upsert_contact` function (line 287), `unified_contacts` table |
| Zip/search schema | `sql/session_20260317_schema.sql` | `city_zip_codes`, `zip_search_tracking`, `get_unsearched_zip_categories` RPC |
| RDGR workflow map | `docs/RDGR_WORKFLOW_MAP.md` | Architecture diagram of all RDGR workflows |
| Revenue ops memory | `memory/project_revenue_standing_ops.md` | PROSP system history and context |

---

## What Bradford Wants to Build

### Immediate Goal
A **production prospecting pipeline** that runs daily (7AM Pacific, Mon-Fri) and:
1. Searches Google Maps for businesses in 10+ target cities across 9 industry groups
2. GPT-qualifies leads on a 100-point scale
3. Stores qualified contacts in the CRM (unified_contacts via CRM-BRIDGE)
4. Scrapes websites to find email addresses (PROSP-EMAIL-ENRICH)
5. Drafts outreach emails for human approval before sending

### Scale Target
- **200+ leads/day** from Google Maps (currently gets 160 per run)
- **30-50 qualified leads** to reach out to daily
- Zip-code-level search tracking so the same business/area isn't searched twice
- Performance tracking: which industries/cities yield the best leads

### Architecture Concerns Bradford Raised
- "This single workflow is attempting to do too much at once" → Led to the 4-workflow decomposition
- "Will this scale to handle hundreds at a time?" → Current Code node pattern won't scale past ~20 CRM upserts due to 60s timeout
- "Will we be making too many repeated calls to downstream workflows that could be better served with SplitInBatches?" → Yes, CRM-BRIDGE needs a bulk operation

### Key Design Decisions Made
1. Use `google_maps_search` operation for new searches, then `qualify_leads` separately — NOT `prospect_search` (which queries existing DB)
2. IF nodes are fine when built via `n8n_create_workflow` with full JSON — partial updates don't reliably set conditions
3. Code nodes have a hard 60s timeout — any multi-step process exceeding this must use separate HTTP Request nodes
4. CRM-BRIDGE should not gate on `task_id` — direct calls (without RDGR task context) are valid
5. Prospecting domain is `status: 'active'` in `autonomous_domain_registry`

---

## Suggested Next Steps

1. **Build `crm_bulk_upsert` RPC** — PL/pgSQL function that loops through a JSONB array of contacts, calls `crm_upsert_contact` for each, returns array of contact_ids. Single Supabase call replaces 100+ HTTP calls.
2. **Update PROSP-QUALIFY's Store & Collect IDs** to call bulk_upsert instead of looping
3. **Fix orchestrator Build Summary** field name mapping
4. **Make email enrichment async** — don't block the pipeline; run as a follow-up job
5. **Re-enable RDGR-QUEUE, PLAN, REPLAN** once PROSP pipeline is stable
6. **Register all new workflows** in `system_registry` with proper `calls`/`called_by` metadata
7. **Update memory files** with session findings

---

## Credentials Reference
| Credential | ID | Type |
|---|---|---|
| Supabase | `72jeHpXtJfX3ZJ7O` | supabaseApi |
| OpenAI | `8D9TfytCskgt0wxN` | openAiApi |
| Perplexity | `F1EuM5wQwKreSHwM` | perplexityApi |
| Google Maps API key | In PROSP-GMAPS workflow | httpQueryAuth |

## Supabase Instance
- URL: `https://yrwrswyjawmgtxrgbnim.supabase.co`
- Supabase Query Utility: workflow `IWfIRcWfFHDD8PV6` (webhook: `supabase-query`)
