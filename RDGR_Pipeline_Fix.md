# RDGR Dashboard — Pipeline Status & Backend/Frontend Alignment

## Status: Current State (2026-03-15, post-backend-fixes)

**Data reset:** All test data cleared from 6 tables (2026-03-15 01:41 UTC). Clean slate.

**ID Convention:** All IDs now use Hub format — `P_yymmddhhmmss` (projects/directives), `{yymmddhhmmss}-N` (tasks).

| Dashboard Section | Data Source | Frontend Status | Backend Status |
|---|---|---|---|
| **Directive Approvals** | `autonomous_directives` (pending) + active/in_progress | **DONE** | **FIXED** — PLAN now generates `P_yymmddhhmmss` IDs, sets `approved_at`/`approved_by` on auto-approvals |
| **Decision History** | `autonomous_directives` (approved_at not null) | **DONE** | **FIXED** — auto-approved directives now have `approved_at` set |
| **Human Review** | `human_review_queue` table | **DONE** | **FIXED** — AUTOFIX now writes task failures to human_review_queue when max retries exceeded |
| **Task Queue** | `directive_tasks` + `autonomous_task_queue` | **DONE** | **FIXED** — THINKING assigns 7 operation types (not "execute"), task_ids use Hub format |
| **Recent Activity** | Both task tables (completed/failed) | **DONE** | **FIXED** — COMPLETE now updates `directive_tasks` (not just `autonomous_task_queue`) |
| **Status Bar** | Computed from merged `taskData` | **DONE** | Working |
| **System Health** | `autonomous_execution_log` | **WORKING** | Working |
| **Revenue** | `autonomous_financial_snapshots` | **WORKING** | Table empty — no snapshots generated yet |

### Frontend note: ID format change
Task IDs changed from `DT-DIR-xxx-N` to `{yymmddhhmmss}-N` (e.g., `260314111245-5`).
Directive IDs changed from `DIR-{timestamp}-{index}` to `P_yymmddhhmmss` (e.g., `P_260314111245`).
The "DIR: {directive_id}" label on tasks should still work — just shows the new format.

---

## Frontend Work Completed (No Action Needed)

All of the following have been implemented and deployed to `bradfordcarlton.com/rdgr`:

- **Direct Supabase reads** — All read operations use `supabaseSelect()` with PostgREST. No n8n webhook proxying for reads.
- **Cache-busting headers** — `no-cache, no-store, must-revalidate` meta tags in place
- **5-minute polling interval** — `setInterval(refreshAll, 300000)`
- **Human Review migrated from Google Sheets to Supabase** — reads `human_review_queue`, writes decisions via PATCH, calls `rdgr-approve` webhook for backend processing
- **Infrastructure request rendering** — `content_type === 'infrastructure/install_request'` items render with INFRASTRUCTURE badge, risk level, integrations list, "Requires Manual Approval" label, and "Justification" instead of "Content"
- **Dual task table reading** — `fetchTaskQueue()` and `fetchActivity()` query both `directive_tasks` and `autonomous_task_queue` via `Promise.all`, normalize, merge, sort by `created_at`
- **Active Directives section** — Shows `active` and `in_progress` directives inside the Directive Approvals panel (previously invisible since they weren't `pending_approval` and had no `approved_at`)
- **Decision History panel** — Separated into its own collapsible panel (was previously a hidden sub-section inside Directive Approvals). Shows directives with `approved_at` set, with status badges (Decomposing, In Progress, Completed, Rejected)
- **Panel collapse behavior** — Directive Approvals collapse arrow hides/shows both pending approvals and active directives together. Decision History has its own independent collapse
- **RLS on `directive_tasks`** — Anon SELECT policy added (2026-03-15)
- **Directive source labels** — Tasks from `directive_tasks` show "DIR: {directive_id}" label

### What the Dashboard Calls (n8n webhooks — WRITE operations only)

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `approveDirective()` | POST `/webhook/rdgr-directive-action` | Approve directive (action: "approve") |
| `rejectDirective()` | POST `/webhook/rdgr-directive-action` | Deny directive (action: "deny") |
| `submitDecision()` | PATCH Supabase + POST `/webhook/rdgr-approve` | Human review decision |
| `confirmModify()` | PATCH Supabase + POST `/webhook/rdgr-approve` | Human review modify |

All READ operations go directly to Supabase PostgREST (no n8n involvement).

---

## Backend Fixes Applied (2026-03-15)

All 6 backend issues from the previous version of this document have been resolved:

### RESOLVED: Issues #1-#6

| # | Issue | Fix | Workflow |
|---|-------|-----|----------|
| 1 | `operation` always "execute" | THINKING now assigns 7 types: `research`, `draft`, `analyze`, `create`, `send`, `update`, `review`. GPT prompt constrained + `normalizeOperation()` mapper with 30+ synonyms | RDGR-THINKING |
| 2 | `DT-undefined-XXX` task IDs | Task IDs now use Hub format `{yymmddhhmmss}-N` (e.g., `260314111245-5`). Fixed undefined `directive_id` bug in DD Parse Skeleton/Actions | RDGR-THINKING |
| 3 | Auto-approved `approved_at: null` | PLAN now sets `approved_at` + `approved_by: "RDGR-PLAN (auto-approved)"` for low-risk directives | RDGR-PLAN |
| 4 | Tasks not completing in `directive_tasks` | COMPLETE now routes by task_id regex (`/^\d{12}-\d+$/`) to `directive_tasks`. Uses parsed status (not hardcoded). Added 4 new nodes for `directive_tasks` unblocking | RDGR-COMPLETE |
| 5 | No `pending_approval` directives | Data reset done. PLAN will create new directives with `P_yymmddhhmmss` IDs on next run | RDGR-PLAN |
| 6 | Revenue table empty | Not yet addressed — no financial snapshot workflow configured | — |

### Additional fix: RDGR-AUTOFIX "unknown workflow" emails

**Problem:** COMPLETE called AUTOFIX for task failures but sent no `workflow_id`, causing all-unknown escalation emails.

**Fix:** AUTOFIX now has dual-mode handling:
- `type: "task_failure"` → skips OpenAI diagnosis, logs failure, checks retry eligibility, re-queues or escalates to `human_review_queue`
- `type: "structural"` → existing workflow diagnosis flow
- Fixed broken expression in `Query Previous Fixes` node (missing node reference)
- Escalation emails now include task_id and domain

### RESOLVED: RDGR-PLAN RPC write failures (2026-03-15 03:00-04:00 UTC)

**Problem:** PLAN generated directives via GPT-5.1 but `write_rdgr_plan_outputs` RPC consistently failed with "no unique or exclusion constraint matching ON CONFLICT specification". Multiple root causes found and fixed:

| # | Root Cause | Fix |
|---|-----------|-----|
| 1 | `SECURITY DEFINER` function missing `SET search_path = public` — couldn't resolve UNIQUE constraints | Added `SET search_path = public` to function declaration |
| 2 | `autonomous_strategic_plans` missing UNIQUE on `plan_id` | Added `autonomous_strategic_plans_plan_id_key` constraint |
| 3 | `deadline` column NOT NULL but no default in function | Added `COALESCE(..., '2026-04-30'::date)` |
| 4 | `autonomous_planning_summaries` column name mismatch: function used `summary_text`/`metrics`, table has `summary`/`domain_breakdown` + 8 specific counter columns | Rewrote summary INSERT to match actual schema |

**Result:** PLAN now writes directives, strategic plans, summaries, and execution logs atomically via single RPC call. 10 directives generated on first successful run (9 `pending_approval`, 1 auto-approved).

**Infrastructure built:** `TEMP-SQL-Executor` workflow (`TPbJWBfWh8szashr`) using Postgres credential — can execute arbitrary SQL from Claude without manual SQL Editor paste.

### RESOLVED: RDGR-DIRECTIVE-ACTION rejecting P_ IDs (2026-03-15 04:00 UTC)

**Problem:** Frontend sent `directive_id: "P_260315035452"` but webhook validated `startsWith('DIR-')` only.

**Fix:** Updated "Parse & Validate Input" node to accept both `DIR-` and `P_` prefixes:
```javascript
if (!directive_id || !(directive_id.startsWith('DIR-') || directive_id.startsWith('P_'))) { ... }
```

### Remaining issue: Revenue snapshots

`autonomous_financial_snapshots` is empty. No workflow exists to generate financial snapshots yet. This is a future build item.

**Where to fix:** Whatever workflow is responsible for generating financial snapshots hasn't run or hasn't been configured yet.

---

## Pipeline Flow Reference

```
RDGR-PLAN creates directives → status: pending_approval (med/high risk)
                              → status: active (low risk, auto-approved)
                                         ↓
              Bradford approves → rdgr-directive-action webhook
                                         ↓
              Status set to 'active' → RDGR-THINKING decompose_directive called
                                         ↓
              GPT-5.1 Phase 1: skeleton tasks → Phase 2: flesh out each skeleton
                                         ↓
              Tasks written to directive_tasks (status='ready')
              Directive updated to status='in_progress'
                                         ↓
              RDGR-QUEUE polls every 15 min → dispatches 'ready' tasks
                                         ↓
              Domain agents execute → RDGR-COMPLETE reports back
                                         ↓
              Dashboard shows progress in Task Queue + Recent Activity
```

### Denial Flow
```
Bradford denies → rdgr-directive-action webhook
                           ↓
        Status set to 'denied' → directive_outcomes record created
                           ↓
        RDGR-THINKING escalate_directive called (with user feedback if provided)
                           ↓
        GPT-5.1 decides: revise | decompose | reassign | accept_with_limitations | defer
                           ↓
        Decision applied to Supabase (may create revised directives for re-approval)
```

---

## Frontend → Backend Contract

### 1. Directive Approval/Denial

**Endpoint:** `POST https://n8n.carltonaiservices.com/webhook/rdgr-directive-action`

**Request payload:**
```json
{
  "action": "approve",
  "directive_id": "P_260314111245",
  "feedback": "Optional notes from reviewer",
  "reviewer_name": "bradford"
}
```

| Field | Required | Notes |
|---|---|---|
| `action` | Yes | `"approve"` or `"deny"` |
| `directive_id` | Yes | Hub format: `P_yymmddhhmmss`. Backend accepts both `P_` and legacy `DIR-` prefixes (fixed 2026-03-15 04:00 UTC) |
| `feedback` | No | Optional for both approve and deny. For denials, feedback guides the AI escalation review |
| `reviewer_name` | No | Defaults to `"Unknown"` |

**Response on approve:**
```json
{
  "success": true,
  "directive_id": "P_260314111245",
  "action": "approve",
  "previous_status": "pending_approval",
  "new_status": "active",
  "message": "Directive approved and queued for execution.",
  "timestamp": "2026-03-14T07:00:00.000Z"
}
```

**Response on deny:**
```json
{
  "success": true,
  "directive_id": "P_260314111245",
  "action": "deny",
  "previous_status": "pending_approval",
  "new_status": "denied",
  "escalation_triggered": true,
  "message": "Directive denied. AI escalation review initiated with your feedback.",
  "timestamp": "2026-03-14T07:00:00.000Z"
}
```

**Error responses:**
- `400` — invalid action, missing/invalid directive_id
- `404` — directive not found
- `409` — directive not in `pending_approval` status (already approved/denied)

### 2. Task Tables (Dashboard reads both)

| Table | Contains | Current Data |
|-------|----------|-------------|
| `directive_tasks` | Tasks from THINKING decomposition | **0 rows** (reset 2026-03-15) |
| `autonomous_task_queue` | Legacy tasks | **0 rows** (reset 2026-03-15) |

**`directive_tasks` columns:**

| Column | Type | Description |
|--------|------|-------------|
| `task_id` | TEXT | Format: `{yymmddhhmmss}-N` (e.g., `260314111245-5`) |
| `directive_id` | TEXT | Links back to source directive |
| `title` | TEXT | Task name for display |
| `domain` | TEXT | e.g., `finance`, `research`, `writing`, `thinking` |
| `status` | TEXT | `ready`, `in_progress`, `completed`, `failed` |
| `operation` | TEXT | One of: `research`, `draft`, `analyze`, `create`, `send`, `update`, `review` |
| `agent_persona` | TEXT | Which AI persona handles this |
| `description` | TEXT | Detailed action description |
| `parameters` | JSONB | Task-specific input parameters |
| `expected_output` | TEXT | What success looks like |
| `success_criteria` | TEXT | Measurable criteria |
| `sequence` | INT | Ordering within the directive |
| `depends_on` | TEXT[] | Task IDs this depends on |
| `created_at` | TIMESTAMPTZ | When created |

### 3. Human Review (Dashboard reads + writes)

**Read:** `supabaseSelect('human_review_queue', 'decision=is.null&order=submitted_at.desc&limit=100')`

**Write (decision):** PATCH to `human_review_queue?task_id=eq.{taskId}` with `decision`, `decided_at`, `updated_at`, optionally `reviewer_notes` and `modified_content`.

**Then:** POST to `/webhook/rdgr-approve` with `{ trigger: 'dashboard', task_id: taskId }` for backend processing.

### 4. System Health

No changes needed. Same query:
```
Table: autonomous_execution_log
Query: SELECT * ORDER BY timestamp DESC LIMIT 50
```

---

## Supabase SQL: Fix Check Constraints

Run this in the Supabase SQL editor to allow all registered domains in the task queue:

```sql
-- Drop and recreate domain check to include all registered domains
ALTER TABLE autonomous_task_queue
  DROP CONSTRAINT IF EXISTS autonomous_task_queue_domain_check;

ALTER TABLE autonomous_task_queue
  ADD CONSTRAINT autonomous_task_queue_domain_check
  CHECK (domain IN (
    'email', 'calendar', 'research', 'writing', 'sales',
    'finance', 'thinking', 'toolbuild', 'bookkeeper', 'hub',
    'meetings', 'outbound', 'prospecting', 'social_media', 'content'
  ));

-- Also drop and recreate source check to allow future source types
ALTER TABLE autonomous_task_queue
  DROP CONSTRAINT IF EXISTS autonomous_task_queue_source_check;

ALTER TABLE autonomous_task_queue
  ADD CONSTRAINT autonomous_task_queue_source_check
  CHECK (source IN ('autonomous', 'manual', 'directive', 'intake'));
```

---

## Execution Logging Requirement

For the System Health panel to show accurate data, **every RDGR workflow execution must write to `autonomous_execution_log`**:

```json
{
  "workflow": "RDGR-QUEUE",
  "result": "success",
  "timestamp": "2026-03-14T06:15:00.000Z",
  "error_message": null,
  "task_id": "TQ-xxx",
  "tokens_used": 0
}
```

RDGR-QUEUE already does this. Domain agents should also log on completion.

---

## NEW: Human Tasks Section (2026-03-16)

**Frontend builder:** Add a "Human Tasks" section to the RDGR dashboard at `bradfordcarlton.com/rdgr`.

### Data Source

Query `directive_tasks` for tasks requiring human action:

```javascript
// Fetch human tasks
const humanTasks = await supabaseSelect(
  'directive_tasks',
  'task_id,directive_id,title,description,operation,parameters,status,created_at',
  'requires_human=eq.true&status=in.(ready,awaiting_human,in_progress)&order=created_at.desc'
);
```

Note: `requires_human` and `human_action_type` columns will be added to `directive_tasks` when RDGR-THINKING is updated. Until then, tasks with `operation=eq.review` or `operation=eq.approve` can serve as human tasks.

### UI Components

**Task card** (for each human task):
- Title + description
- Parent directive ID (clickable link to directive)
- Urgency badge (from task priority)
- Contact info (if `parameters.contact_id` exists, show contact name from CRM)
- `human_action_type` badge: `approve`, `execute`, `review`, `decide`

**"Mark Complete" button:**
- Opens modal with:
  - **Notes field** (textarea) — what was done
  - **Interaction logging** (optional):
    - Channel dropdown: `social`, `phone_outbound`, `phone_inbound`, `in_person`, `email_outbound`, `manual`
    - Platform field (if channel=social): `instagram`, `linkedin`, `facebook`, `twitter`
  - **Submit** button
- On submit: POST to `/webhook/rdgr-complete`:

```javascript
async function completeHumanTask(taskId, directiveId, notes, channel, platform) {
  const payload = {
    task_id: taskId,
    directive_id: directiveId,
    brand_id: 'carlton',
    domain: 'human',
    success: true,
    status: 'completed',
    result: {
      summary: 'Human task completed: ' + notes.substring(0, 100),
      details: notes,
      artifacts: [],
      metrics: { completed_by: 'human', channel: channel || null, platform: platform || null }
    },
    source_table: 'directive_tasks'
  };

  // If interaction logging provided, also call CRM-BRIDGE
  if (channel && taskPayload.parameters?.contact_id) {
    await fetch('/webhook/rdgr-crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: 'human-' + Date.now(),
        brand_id: 'carlton',
        domain: 'crm',
        operation: 'log_interaction',
        parameters: {
          contact_id: taskPayload.parameters.contact_id,
          channel: channel,
          interaction_type: 'task_completed',
          direction: channel.includes('outbound') ? 'outbound' : 'inbound',
          summary: notes,
          details: { platform: platform, task_id: taskId }
        }
      })
    });
  }

  const resp = await fetch('/webhook/rdgr-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return resp.json();
}
```

**"Refused" button:**
- Opens modal with:
  - **Reason field** (textarea) — why the task was declined
  - **Submit** button
- On submit: POST to `/webhook/rdgr-complete`:

```javascript
async function refuseHumanTask(taskId, directiveId, reason) {
  const payload = {
    task_id: taskId,
    directive_id: directiveId,
    brand_id: 'carlton',
    domain: 'human',
    success: false,
    status: 'refused',
    result: {
      summary: 'Human refused task: ' + reason.substring(0, 100),
      details: reason,
      artifacts: [],
      metrics: { refused_by: 'human', reason: reason }
    },
    source_table: 'directive_tasks'
  };
  const resp = await fetch('/webhook/rdgr-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return resp.json();
}
```

### Placement

Add the "Human Tasks" section:
- **Position:** After "Directive Approvals" and before "Task Queue"
- **Default state:** Expanded (not collapsed) — human tasks need visibility
- **Badge:** Show count of pending human tasks in the section header
- **Empty state:** "No tasks requiring human action" (grey text)

---

## Remaining Work

1. **Revenue snapshots** — `autonomous_financial_snapshots` is empty. Need a workflow to generate periodic financial snapshots. Future build item.

2. **E2E verification** — All backend fixes applied (2026-03-15). Need to run PLAN, approve a directive, watch THINKING decompose, QUEUE dispatch, domain agent execute, COMPLETE report back, and verify the dashboard shows the full lifecycle with correct Hub IDs.

3. **RDGR-COMPLETE concurrency check** — When COMPLETE sends tasks back to THINKING (for result analysis), it should check if THINKING is already running before dispatching. Prevents concurrent THINKING instances.

4. **Emma v3 CRM integration** — Add 3-4 nodes to Emma v3 to check sender against unified_contacts, log interactions, detect sequence replies, and route sales-relevant emails to RDGR-INTAKE. Designed in plan, needs careful node insertion.

5. **RDGR-EMAIL CRM logging** — Add interaction logging to RDGR-EMAIL after email sends. Same careful insertion needed.

6. **RDGR-THINKING `requires_human` flag** — Add `requires_human: true` and `human_action_type` fields to task decomposition. Add `requires_human BOOLEAN DEFAULT false` and `human_action_type TEXT` columns to `directive_tasks` table.
