# Frontend IO Contracts — Tier 3 (Domain Agents, Bridges & Content System)

**Generated:** 2026-03-28 | **Validated:** All schemas built from actual workflow Code nodes
**Purpose:** Machine-readable input/output contracts for all Tier 3 domain agent, bridge, utility agent, and content system workflows.
**Source of truth:** `system_registry.io_schema` column in Supabase. This doc is a snapshot — query the live column for the latest.

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
  .eq('name', 'RDGR-WRITING')
  .single();
```

---

## Tier 3 Summary

| # | Workflow | Trigger | Webhook Path | Status | Nodes | Frontend-Facing? |
|---|----------|---------|--------------|--------|-------|-----------------|
| 1 | RDGR-CALENDAR | Webhook | `rdgr-calendar` | ACTIVE | 6 | No |
| 2 | RDGR-FINANCE | Webhook | `rdgr-finance` | ACTIVE | 11 | No |
| 3 | RDGR-EMAIL | Webhook | `rdgr-email` | INACTIVE | 17 | No |
| 4 | RDGR-WRITING | Webhook | `rdgr-writing` | ACTIVE | 32 | No |
| 5 | RDGR-SALES v2 | Webhook | `rdgr-sales` | ACTIVE | 12 | No |
| 6 | RDGR-RESEARCH | Webhook | `rdgr-research` | ACTIVE | 40 | No |
| 7 | PROSP-RDGR-ROUTER | Webhook | `prosp-rdgr-router` | ACTIVE | 13 | No |
| 8 | SMCA-RDGR-ROUTER | Webhook | `smca-rdgr-router` | ACTIVE | 14 | No |
| 9 | RDGR-REVENUE | Dual | `rdgr-revenue` | ACTIVE | 16 | **YES** (dashboard) |
| 10 | RDGR-TOOLBUILD | Webhook | `rdgr-toolbuild` | ACTIVE | 23 | No |
| 11 | RDGR-CONTENT | Webhook | `rdgr-content` | ACTIVE | 23 | No |
| 12 | RDGR-TOOL-SOCIAL | Webhook | `rdgr-tool-social` | ACTIVE | 23 | No |
| 13 | IMG-UTIL | Dual | `gemini-image` | ACTIVE | 21 | **YES** (image dashboard) |
| 14 | RDGR-THINKING | Webhook | `rdgr-thinking` | ACTIVE | 63 | No |

---

## Domain Agent Dispatch Pattern

All domain agents in Tier 3 are dispatched by RDGR-QUEUE. They follow a common pattern:

```
Webhook Trigger → Parse Input → [Optional: Call RDGR-IDENTITY] → Route by task_type/operation
  → [Domain-specific processing via OpenAI/Perplexity/APIs]
  → Format Result → [Optional: Token logging] → Report to RDGR-COMPLETE → Respond to Webhook
```

**Common input fields** (universal request envelope):
- `task_id` — required for most agents
- `brand_id` — defaults to `carlton`
- `task_type` or `operation` — dispatch/routing field
- `title`, `description`, `parameters` — task context
- `directive_id`, `dossier_brief` — directive context

---

## Frontend-Facing Workflows

### 1. RDGR-REVENUE — Revenue Pipeline Dashboard

**Webhook:** `POST /webhook/rdgr-revenue`

The dashboard can call this to get real-time revenue metrics.

**Input:**
| Field | Required | Type | Default | Notes |
|-------|----------|------|---------|-------|
| `brand_id` | no | string | `carlton` | |
| `task_id` | no | string | — | Auto-generated if omitted |

**Response:**
```json
{
  "success": true,
  "brand_id": "carlton",
  "task_id": "...",
  "metrics": {
    "total_revenue": 0, "target": 100000, "remaining_to_target": 100000,
    "progress_percent": 0, "days_remaining": 33, "days_elapsed": 20,
    "daily_velocity": 0, "weekly_velocity": 0, "velocity_trend_percent": 0,
    "projected_total": 0, "required_daily_velocity": 3030.30, "on_track": false
  },
  "pipeline": {
    "total_deals": 0, "pipeline_value": 0,
    "deals_in_progress": 0, "deals_closed_won": 0, "deals_closed_lost": 0,
    "by_stage": {}
  },
  "alerts": [
    { "severity": "high", "type": "off_track", "message": "..." }
  ],
  "snapshot_saved": true
}
```

### 2. IMG-UTIL — Image Generation

**Webhook:** `POST /webhook/gemini-image`

**Input:**
| Field | Required | Type | Default | Notes |
|-------|----------|------|---------|-------|
| `prompt` | YES | string | — | Image description |
| `enhance` | no | boolean | `true` | AI-enhance the prompt |
| `aspectRatio` | no | enum | `1:1` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4` |
| `sessionId` | no | string | — | Continue existing session |
| `uploadToDrive` | no | boolean | `false` | Upload to Google Drive |
| `folderId` | no | string | — | Drive folder for upload |
| `brand_id` | no | string | `carlton` | |

**Response:**
```json
{
  "success": true,
  "image_url": "https://...",
  "drive_url": "https://docs.google.com/...",
  "session_id": "...",
  "prompt_used": "Enhanced prompt text"
}
```

---

## Backend-Only Workflows (Reference)

### RDGR-CALENDAR — Calendar Operations
- **9 operations:** check_availability, find_slots, find_mutual_time, create_event, block_time, list_events, get_event, update_event, delete_event
- **Special:** Supports `person` parameter (bradford/dianna/both) for multi-calendar operations
- **Delegates to:** Calendar Utility (`google-calendar-utility`)

### RDGR-FINANCE — Financial Tracking
- **4 operations:** log_lead, update_pipeline, log_revenue, generate_report
- **Side effects:** Writes to `autonomous_revenue_pipeline`, `autonomous_financial_snapshots`, Financial Tracker spreadsheet

### RDGR-EMAIL — Email Agent (INACTIVE)
- **4 operations:** send_email (via RDGR-REVIEW), draft_email (via RDGR-IDENTITY + OpenAI), read_inbox, search_emails
- **Downstream:** RDGR-REVIEW, RDGR-IDENTITY, CRM-BRIDGE

### RDGR-WRITING — Content Writing
- **6 operations:** long_write, short_write, script, lead_magnet, edit, generate_ad_copy
- **Output routing:** visual_effort determines doc format (legacy GDoc, DOC-CREATE, SLIDES-CREATE)
- **content_only=true** returns raw content without doc creation

### RDGR-SALES v2 — Sales Orchestrator
- **Orchestrator pattern:** Classifies by operation then delegates to specialist workflows
- **24 operations** mapped to 7 specialists: PROSP-RDGR-ROUTER, CRM-BRIDGE, RDGR-EMAIL, CRM-SEQUENCES, RDGR-RESEARCH, RDGR-CALENDAR
- **Fallback:** GPT-4.1 as Billy Mays CSO persona

### RDGR-RESEARCH — Deep Research
- **3 operations:** quick_search (Perplexity sonar), competitive_intel (sonar-pro + GPT), deep_research (multi-stage pipeline)
- **Knowledge cache:** Checks `bc_knowledge_search` before researching; auto-ingests results back to KB

### PROSP-RDGR-ROUTER — Prospecting Bridge
- **4 operations:** run_scraper, google_maps_search, qualify_leads, prospect_search (chained gmaps→qualify)
- **Conditional COMPLETE:** Only calls RDGR-COMPLETE if task_id is not empty

### SMCA-RDGR-ROUTER — Social Media Analytics Bridge
- **6 operations:** ingest_data, content_analysis, score_content, generate_report, check_dms, get_insights
- **Note:** Only `get_insights` is functional (Supabase query). Others pending platform credentials.

### RDGR-CONTENT — Content Router
- **10 task_types:** seo_content, long_write, lead_magnet, short_write, script, edit_draft, content_repurpose, social_post, image_generation, content_calendar
- **Agent personas:** seo_specialist or content_creator (auto-selected from task_type)
- **Delegates:** social_post → RDGR-TOOL-SOCIAL, image_generation → IMG-UTIL

### RDGR-TOOL-SOCIAL — Social Post Orchestrator
- **Modes:** post, story, reel
- **Platforms:** linkedin, facebook, instagram, twitter
- **AI generation:** When `content.generate=true` or `content.topic` provided

### RDGR-TOOLBUILD — Workflow Builder
- **3 tiers:** Tier 1 (auto-build via OpenAI + n8n API), Tier 2 (Claude Code prompt), Tier 3 (requirements doc)
- **Auto-registers:** Created workflows are registered in system_registry

### RDGR-THINKING — Strategy & Decomposition (63 nodes)
- **7 operations:** brainstorm, evaluate_options, generate_workflow_prompt, growth_experiment, validate_plan, decompose_directive, escalate_directive
- **decompose_directive:** Two-stage process (skeleton + persona-based elaboration) with dossier creation

---

## Issues Found During Enrichment

| Issue | Workflow | Severity | Notes |
|-------|----------|----------|-------|
| `continueOnFail` + `onError` conflict | RDGR-EMAIL (CRM Log Email Sent) | Medium | INACTIVE workflow, not urgent |
| `continueOnFail` + `onError` conflict (4 nodes) | RDGR-SALES v2 | Medium | Call RDGR-IDENTITY, Call OpenAI Fallback, Call Specialist, Report to RDGR-COMPLETE |
| Node count mismatch vs workflow map | RDGR-EMAIL (17 vs 13), RDGR-WRITING (32 vs 14), RDGR-RESEARCH (40 vs 19), RDGR-REVENUE (16 vs 14) | Info | Workflows grew since map was written |

---

## Cross-References

- **Tier 1 contracts:** [FRONTEND_IO_CONTRACTS_TIER1.md](FRONTEND_IO_CONTRACTS_TIER1.md)
- **Tier 2 contracts:** [FRONTEND_IO_CONTRACTS_TIER2.md](FRONTEND_IO_CONTRACTS_TIER2.md)
- **IO Schema spec:** [STANDARDIZATION_SPEC.md](STANDARDIZATION_SPEC.md) (lines 259-318)
- **Workflow architecture:** [RDGR_WORKFLOW_MAP.md](RDGR_WORKFLOW_MAP.md)
- **Approval process:** [CANONICAL_APPROVAL_PROCESS_SPEC.md](CANONICAL_APPROVAL_PROCESS_SPEC.md)
