# Frontend IO Contracts — Tier 2 (RDGR Pipeline Workflows)

**Generated:** 2026-03-28 | **Validated:** All schemas verified against actual workflow Code nodes
**Purpose:** Machine-readable input/output contracts for all Tier 2 RDGR Pipeline workflows.
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
  .eq('name', 'RDGR-COMPLETE')
  .single();
```

---

## Tier 2 Summary

| # | Workflow | Trigger | Webhook Path | Frontend-Facing? |
|---|----------|---------|--------------|-----------------|
| 1 | RDGR-ERR | Error Trigger | — | No |
| 2 | RDGR-IDENTITY | Webhook | `rdgr-identity` | No |
| 3 | RDGR-COSTWATCH | Dual (schedule+webhook) | `rdgr-costwatch` | No |
| 4 | RDGR-OVERWATCH | Dual (schedule+webhook) | `rdgr-overwatch` | No |
| 5 | RDGR-BRIEF | Webhook | `rdgr-brief` | No |
| 6 | RDGR-PLAN | Dual (schedule+webhook) | `rdgr-plan` | No |
| 7 | RDGR-REPLAN | Dual (schedule+webhook) | `rdgr-replan` | No |
| 8 | RDGR-INTAKE | Webhook | `rdgr-intake` | **YES** |
| 9 | RDGR-REVIEW | Webhook | `rdgr-review` | No |
| 10 | RDGR-APPROVE | Webhook | `rdgr-approve` | No |
| 11 | RDGR-QUEUE | Dual (schedule+webhook) | `rdgr-queue` | No |
| 12 | RDGR-COMPLETE | Webhook | `rdgr-complete` | **YES** (indirect) |

---

## Frontend-Facing Workflows

### 1. RDGR-INTAKE — Manual Task Submission

**Webhook:** `POST /webhook/rdgr-intake`

The dashboard calls this when a user manually submits a new task.

**Input:**
| Field | Required | Type | Default | Notes |
|-------|----------|------|---------|-------|
| `title` | YES | string | — | Task title |
| `description` | YES | string | — | Task description |
| `brand_id` | no | string | `carlton` | |
| `domain` | no | enum | `thinking` | `thinking`, `writing`, `research`, `email`, `calendar`, `sales`, `finance`, `hub`, `outbound` |
| `priority` | no | number | 3 | 1=highest, 5=lowest |
| `deadline` | no | string | — | ISO timestamp |
| `type` | no | string | — | Task type |
| `context` | no | object | — | Additional context |
| `image` | no | string | — | Image URL |
| `integrate_with_plan` | no | boolean | `true` | If true, triggers RDGR-PLAN after intake |

**Response (success):**
```json
{
  "success": true,
  "task_id": "USR-260328014500",
  "message": "Task queued successfully",
  "domain": "thinking",
  "priority": 3,
  "integrate_with_plan": true
}
```

**Response (validation error):**
```json
{
  "success": false,
  "error": "Missing required fields: title, description"
}
```

---

### 2. RDGR-COMPLETE — Task Completion (Indirect)

**Webhook:** `POST /webhook/rdgr-complete`

Not typically called by frontend directly — called by RDGR-APPROVE and domain agents. But understanding its contract is important for the dashboard's task status display.

**Input:**
| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `task_id` | YES | string | Task or directive task ID |
| `brand_id` | no | string | Default: `carlton` |
| `success` | no | boolean | Whether task succeeded |
| `status` | no | string | `completed` or `failed` |
| `result` | no | object | Task output/result data |
| `output_artifacts` | no | array | File artifacts produced |
| `revenue_amount` | no | number | Revenue generated |
| `error_message` | no | string | Error details if failed |
| `domain` | no | string | Source domain |
| `contact_id` | no | string | For CRM engagement update |

**Routing logic:** Routes by `task_id` format:
- Contains `-` → directive task path (updates `directive_tasks`, appends to dossier)
- No `-` → ATQ task path (updates `autonomous_task_queue`, unblocks dependents)

---

## Backend-Only Workflows (Reference)

These are not called by the frontend but are documented for completeness.

### RDGR-ERR — Error Handler
- **Trigger:** n8n Error Trigger (automatic)
- **Classifies** errors as transient/structural/critical
- **Always forwards** to RDGR-AUTOFIX
- **Side effects:** Logs to Supabase + Sheets, updates registry status to `broken`

### RDGR-IDENTITY — Identity Loader
- **Trigger:** Webhook `rdgr-identity`
- **Returns** SOUL/SEED/CAPABILITIES docs from `autonomous_brands`
- **Supports** section-level SEED filtering and capabilities update
- **Called by:** PLAN, WRITING, SALES, THINKING, EMAIL, REVIEW, REPORT-GENERATE

### RDGR-COSTWATCH — Token Usage Monitor
- **Trigger:** Every 30 minutes + webhook
- **Monitors** OpenAI token spend velocity
- **Auto-deactivates** runaway workflows on threshold breach

### RDGR-OVERWATCH — Execution Storm Detector
- **Trigger:** Every 5 minutes + webhook
- **Detects** abnormal execution rates
- **Auto-deactivates** storm-causing workflows

### RDGR-BRIEF — Directive Research Clerk
- **Trigger:** Webhook `rdgr-brief`
- **Assembles** context from directives, tasks, dossier docs
- **Called by:** PLAN, THINKING, QUEUE

### RDGR-PLAN — CEO Strategic Planner
- **Trigger:** Daily at 11:00 UTC + webhook
- **Creates** directives with `P_yymmddhhmmss` IDs
- **Auto-approves** LOW risk, holds MEDIUM/HIGH for review
- **Calls:** IDENTITY, BRIEF, CRM snapshot, checkpoints, standing ops

### RDGR-REPLAN — Progress Monitor
- **Trigger:** Every 4 hours + webhook
- **Evaluates** 7 replan triggers (revenue, pipeline, velocity, etc.)
- **Calls** RDGR-PLAN when replan needed

### RDGR-REVIEW — Reality Checker
- **Trigger:** Webhook `rdgr-review`
- **AI-scores** task results via GPT-5-mini
- **Routes:** PASS → APPROVE, NEEDS_WORK → retry, ESCALATE → human review

### RDGR-APPROVE — Approval Gate
- **Trigger:** Webhook `rdgr-approve`
- **Marks** tasks completed and calls RDGR-COMPLETE

### RDGR-QUEUE — Task Dispatcher
- **Trigger:** Hourly at :05 + webhook
- **Phase A:** Picks directive → sends to THINKING for decomposition
- **Phase B:** Dispatches ready tasks to domain agent webhooks
- **Respects** concurrency limits from `autonomous_domain_registry`

---

## Pipeline Flow Diagram

```
PLAN (daily) / INTAKE (manual)
    ↓ creates directives + tasks
QUEUE (hourly)
    ├── THINKING (decompose directive → tasks)
    ├── BRIEF (assemble context)
    └── Domain Agent (execute task)
           ↓
       REVIEW (AI quality check)
           ├── PASS → APPROVE → COMPLETE
           ├── NEEDS_WORK → retry (back to QUEUE)
           └── ESCALATE → human review
                              ↓
COMPLETE (universal handler)
    ├── Update task status
    ├── Unblock dependent tasks
    ├── Append to directive dossier
    ├── Check directive completion
    ├── Revenue tracking
    └── CRM engagement update
```

---

## Cross-References

- **Tier 1 contracts:** [FRONTEND_IO_CONTRACTS_TIER1.md](FRONTEND_IO_CONTRACTS_TIER1.md)
- **IO Schema spec:** [STANDARDIZATION_SPEC.md](STANDARDIZATION_SPEC.md) (lines 259-318)
- **Workflow architecture:** [RDGR_WORKFLOW_MAP.md](RDGR_WORKFLOW_MAP.md)
- **Approval process:** [CANONICAL_APPROVAL_PROCESS_SPEC.md](CANONICAL_APPROVAL_PROCESS_SPEC.md)

---

## Issues Found During Enrichment — ALL FIXED (2026-03-28)

| Issue | Workflow | Fix Applied |
|-------|----------|-------------|
| No error handler | RDGR-PLAN | Added `errorWorkflow: o7sItu0Gy6CuRdch` to settings |
| `require('axios')` | RDGR-COMPLETE | Replaced with `this.helpers.httpRequest()` in Prepare Success Log node |
| Checkpoint bug | RDGR-REPLAN | Evaluate Replan Triggers now loops through ALL qualifying checkpoints via Supabase Query utility |
| Misleading label | RDGR-QUEUE | Renamed schedule trigger from "Every 15 Minutes" to "Every Hour (:05)" |
| Fragile routing | RDGR-COMPLETE | Parse Completion Data now uses `directive_id` field as primary discriminator, regex as fallback |
