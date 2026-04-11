# Frontend IO Contracts — Tier 4D: BRAIN + DEFT + HUB + Meetings + Voice

**Generated:** 2026-03-28
**Scope:** 55 workflows enriched with io_schema, 3 critical bugs fixed, 10 HUB workflows rewritten (Sheets→Supabase)
**Total io_schemas after this tier:** 179 (124 prior + 55 new)

---

## How to Use

Query live schemas:
```sql
SELECT name, io_schema FROM system_registry WHERE io_schema IS NOT NULL ORDER BY name;
```

Each `io_schema` contains: trigger info, input envelope/fields, output envelope/branches/side_effects, and error_handler.

---

## BREAKING CHANGES This Tier

### HUB System: Google Sheets → Supabase Migration

All HUB data operations now use **Supabase tables** instead of Google Sheets. If the frontend reads from the Hub Registry Spreadsheet directly, those reads must be migrated to Supabase queries.

**New Supabase tables (10):**

| Table | Purpose | Rows |
|-------|---------|------|
| `hub_files` | File registry | 657 |
| `hub_clients` | Client records | 1 |
| `hub_projects` | Project records | 47 |
| `hub_tasks` | Task records | 210 |
| `hub_folders` | Folder ID mapping (62 paths) | 62 |
| `hub_status_log` | Audit trail (append-only) | auto |
| `hub_tools` | Tool definitions for HUB-PLANNER | 5 |
| `hub_approval_events` | Approval event log | 8 |
| `hub_pattern_analysis` | AI-detected patterns | 2 |
| `hub_prompts` | Prompt location registry | 2 |

**All tables have RLS enabled:** anon read, service_role write.

### Bug Fixes That Changed Behavior

| Workflow | What Changed | Impact |
|----------|-------------|--------|
| **DEFT-AI** | Now routes on `operation` (was broken, routing on `action`) | AI features (suggest_meals, weekly_report, analyze_nutrition) now work |
| **VR-RDGR-BRIDGE** | CRM upsert expressions fixed | Voice receptionist calls now sync contacts to CRM |
| **VR-BC-POST-CHAT** | axios crash fixed, session filters added | Ready to reactivate (currently inactive) |

---

## Voice Domain (11 workflows)

### Frontend-Facing Webhooks

| Workflow | Webhook | Method | Response | Purpose |
|----------|---------|--------|----------|---------|
| VR-BC-MAIN | `bc-voice-receptionist` | POST | sync JSON (responseNode) | Bradford's voice receptionist — 7 actions |
| VR-GENERIC-V3 | `voice-receptionist-v3` | POST | sync JSON (responseNode) | Generic voice receptionist — 9 actions |
| VR-BC-CHATBOT | (Chat Trigger) | POST | streaming chat | Website chatbot with AI Agent + 7 tools |
| VR-KB-UPDATER | `vr-kb-update` | POST | sync JSON | Updates bc_knowledge RAG store |
| VR-RDGR-BRIDGE | `vr-rdgr-bridge` | POST | sync JSON | Routes VR interactions to RDGR system |
| VR-BC-POST-CALL | `bc-voice-post-call` | POST | sync JSON | ElevenLabs post-call processor (Bradford) |
| VR-GENERIC-POST-CALL | `voice-post-call` | POST | sync JSON | ElevenLabs post-call processor (generic) |

### Scheduled/Internal/Inactive

| Workflow | Trigger | Status | Purpose |
|----------|---------|--------|---------|
| VR-BC-POST-CHAT | Schedule (15 min) | **INACTIVE** (fixed, ready to reactivate) | Processes stale chat sessions |
| VR-GENERIC-V2 | webhook `voice-receptionist` | **INACTIVE** (superseded by V3) | Legacy voice receptionist |
| VR-SETUP | Manual trigger | **INACTIVE** | One-time spreadsheet setup for new VR deployments |
| VOICE-LEARN | Schedule (daily 6:30 AM UTC) | **INACTIVE** (superseded by VOICE-LEARN-UTIL) | Legacy nightly voice learning |

### VR-BC-MAIN Payload Shape (7 actions)
```json
POST /webhook/bc-voice-receptionist
Authorization: Bearer <token>

{
  "action": "check_availability|book_appointment|modify_appointment|cancel_appointment|lookup_contact|knowledge_search|log_message",
  "data": {
    "client_name": "John Smith",
    "client_phone": "+1234567890",
    "client_email": "john@example.com",
    "date": "2026-04-01",
    "time_slot": "10:00 AM",
    "timezone": "America/Los_Angeles"
  }
}

→ { "success": true, "data": {...}, "message": "..." }
→ { "success": false, "error": "...", "message": "..." }
```

### VR-RDGR-BRIDGE Payload Shape
```json
POST /webhook/vr-rdgr-bridge

{
  "brand_id": "carlton",
  "conversation_id": "conv_123",
  "caller_name": "John Smith",
  "caller_phone": "+1234567890",
  "caller_email": "john@example.com",
  "call_summary": "Interested in AI consulting services",
  "call_tags": ["sales", "ai-consulting"],
  "call_successful": true,
  "call_duration": 245,
  "unanswered_questions": ["What is your pricing for enterprise?"]
}

→ { "success": true, "is_lead": true, "lead_score": 85, "actions_taken": [...] }
```

---

## DEFT Domain (8 workflows)

### Frontend-Facing Webhooks

| Workflow | Webhook | Method | Response | Purpose |
|----------|---------|--------|----------|---------|
| DEFT-BRIDGE | `deft-bridge` | POST | sync JSON | Main router — 22 operations across 6 sub-workflows |

### Sub-Workflows (called via execute_workflow, not directly)

| Workflow | Operations | Status |
|----------|-----------|--------|
| DEFT-PROFILE | get_profile, update_profile | active |
| DEFT-RECIPES | add_recipe, search_recipes, get_recipe, update_recipe, delete_recipe, search_foods | active |
| DEFT-MEALS | log_meal, undo_meal, recommend_portion, get_daily_summary, log_water | active |
| DEFT-EXERCISE | log_exercise, get_exercises | active |
| DEFT-ANALYTICS | log_weight, get_analytics, get_keto_status | active |
| DEFT-AI | suggest_meals, weekly_report, analyze_nutrition | active (**FIXED** — was broken) |
| DEFT-ERR | (error handler) | **INACTIVE** (replaced by ERR-UTIL) |

### DEFT-BRIDGE Payload Shape
```json
POST /webhook/deft-bridge

{
  "brand_id": "carlton",
  "user_id": "bradford",
  "operation": "log_meal|get_daily_summary|suggest_meals|log_weight|...",
  "data": {
    // operation-specific fields
  }
}

→ { "success": true, "operation": "log_meal", "data": {...} }
→ { "success": false, "error": "Unknown operation: xyz" }
```

**Key operations for frontend:**
- `get_profile` → returns user profile with TDEE, macros, goals
- `get_daily_summary` → returns today's calories, macros, water, remaining budget
- `get_analytics` → returns weight/calorie/macro time-series data
- `suggest_meals` → AI meal suggestions based on remaining budget + preferences

---

## BRAIN Domain (11 workflows)

### Frontend-Facing Webhooks

| Workflow | Webhook | Method | Response | Purpose |
|----------|---------|--------|----------|---------|
| BRAIN-BRIDGE | `brain-bridge` | POST | sync JSON (responseNode) | Main router — 51 operations across 8 sub-domains |

### Sub-Workflows (called via execute_workflow)

| Workflow | Domain | Operations | Nodes |
|----------|--------|-----------|-------|
| BRAIN-PROFILE | profile | get_profile, create_profile, update_profile, get/add/update/delete_category, get/update_settings | 12 |
| BRAIN-ACTIVITIES | activities | log_activity, start/stop/get/cancel_timer, get_activities, edit/delete_activity, log_chain, update_chain_activity | 13 |
| BRAIN-SCORING | scoring | get_daily_score, recalculate_day, get/update_streak, get/check_achievements, get_level_info, award_directive_points | 11 |
| BRAIN-ANALYTICS | analytics | get_analytics, get_leaderboard, get_category_summary, get_weekly_report | 7 |
| BRAIN-CALENDAR | calendar | get_events, create/update/delete_event, sync_event_to_activity | 13 |
| BRAIN-AI | ai | smart_log, suggest_activities, daily_insight | 8 |
| BRAIN-HABITS | habits | get_habits, add/update/delete_habit, complete/uncomplete_habit, update_habit_completion, get_habit_completions | 11 |
| BRAIN-TASKS | tasks | get_tasks, add/update/delete_task, complete/uncomplete_task, get/update_task_rules, close_day, get_day_progress, ai_fill_task | 16 |

### Scheduled/Internal

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| BRAIN-NOTIFY | Every 30 min | Checks for stale timers (>4h or past bedtime), sends reminders |
| BRAIN-ERR | Error trigger | **INACTIVE** (replaced by ERR-UTIL) |

### BRAIN-BRIDGE Payload Shape
```json
POST /webhook/brain-bridge

{
  "brand_id": "carlton",
  "user_id": "bradford",
  "domain": "activities|profile|calendar|scoring|analytics|ai|habits|tasks",
  "operation": "<operation_name>",
  "data": {
    // operation-specific fields
  }
}

→ { "success": true, "operation": "log_activity", "data": {...} }
```

**Key operations for frontend dashboards:**
- `get_daily_score` → today's points, streak, level progress
- `get_analytics` → time-series activity data for charts
- `get_habits` + `get_habit_completions` → habit tracker grid
- `get_tasks` + `get_day_progress` → daily task list with completion %
- `get_leaderboard` → category rankings
- `close_day` → end-of-day scoring + summary

---

## Meetings Domain (11 workflows)

### Frontend-Facing Webhooks

| Workflow | Webhook | Method | Response | Purpose |
|----------|---------|--------|----------|---------|
| MTG-BRIDGE | `rdgr-meetings` | POST | sync JSON | RDGR integration — routes process_transcript, approve_meeting, get_meeting, prep_meeting |
| MTG-APPROVE | `mtg-approve` | POST | sync JSON | Approval handler — approve/reject/revision_requested for meeting summaries |
| MTG-PREP-SCAN | `mtg-prep-scan` | POST | sync JSON | Manual trigger for pre-meeting prep (also runs on schedule) |

### Scheduled/Internal

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| MTG-INGEST | Gmail poll | Watches for Google Meet transcript emails |
| MTG-PREP-SCAN | Schedule (6 AM ET weekdays) | Auto-scans calendar for upcoming meetings, generates prep docs |

### Pipeline: Transcript Processing
```
Gmail Email (transcript)
  → MTG-INGEST (extract transcript text)
    → MTG-PROCESS (orchestrator: validate, lookup client config, create folders)
      → MTG-EXTRACT (GPT-5.1 structured extraction)
      → MTG-DOCS (create internal + client Google Docs)
      → MTG-EMAIL (create Gmail draft with notes link)
    → Supabase: meeting_transcripts record
    → CRM-BRIDGE: upsert contact
```

### Pipeline: Pre-Meeting Prep
```
MTG-PREP-SCAN (scan calendar + match clients)
  → MTG-PREP-RETRIEVE (fetch last 5 meetings from Supabase)
  → MTG-PREP-ANALYZE (GPT-5.1 deep analysis + briefing)
  → MTG-PREP-DOCS (create internal brief + client agenda Google Docs)
```

### MTG-APPROVE Payload Shape
```json
POST /webhook/mtg-approve

{
  "meeting_id": "mtg_260328...",
  "action": "approve|reject|revision_requested",
  "feedback": "Optional reviewer notes",
  "actor": "bradford"
}

→ { "success": true, "meeting_id": "...", "action": "approve", "result": "email_sent" }
```

---

## HUB Domain (14 workflows + 1 updated)

**MAJOR CHANGE:** All data operations migrated from Google Sheets to Supabase. See "Breaking Changes" section above.

### Frontend-Facing Webhooks

| Workflow | Webhook | Method | Response | Purpose | Rewritten? |
|----------|---------|--------|----------|---------|-----------|
| HUB-BRIDGE | `rdgr-hub` | POST | sync JSON | RDGR router — 6 task types | io_schema updated |
| HUB-QUEUE-API | `hub-approval-queue` | **GET** | sync JSON + CORS | Portal: pending approval items | **YES** (Supabase) |
| HUB-ACTION-API | `hub-approval-action` | POST | sync JSON + CORS | Portal: approve/reject/rollback | No change (stateless) |
| HUB-FILEID | `hub-generate-file-id` | POST | sync JSON | Generate F_/C_/P_ IDs | **YES** (Supabase RPC) |
| HUB-REG | `hub-registry-update` | POST | sync JSON | Registry CRUD (6 operations) | **YES** (Supabase RPCs) |
| HUB-APPROVE | `hub-approval-pipeline` | POST | sync JSON | Approval pipeline (6 operations) | **YES** (Supabase) |
| HUB-ONBOARD | `hub-client-onboard` | POST | sync JSON | Client onboarding (creates Drive + registry) | Indirect (uses HUB-REG) |
| HUB-PLANNER | `hub-auto-plan` | POST | sync JSON | AI goal decomposition via GPT-5.1 | **YES** (Supabase reads) |
| HUB-UPLOAD | `hub-portal-upload` | POST | sync JSON | File upload handler | No change |
| HUB-NOTIFY | `hub-portal-notify` | POST | sync JSON | Email notifications | No change |
| HUB-AI-LOG | `hub-ai-log` | POST | sync JSON | Event logger | **YES** (Supabase insert) |
| HUB-AI-PRECHECK | `hub-ai-precheck` | POST | sync JSON | AI file risk assessment | **YES** (Supabase reads) |
| HUB-AI-ANALYTICS | `hub-ai-analytics` | **GET** | sync JSON + CORS | Analytics API (metrics, trends) | **YES** (Supabase reads) |

### Scheduled/Internal

| Workflow | Trigger | Purpose | Rewritten? |
|----------|---------|---------|-----------|
| HUB-AUDIT | Sunday 3AM UTC + manual | Drive vs registry reconciliation | **YES** (Supabase reads) |
| HUB-AI-PATTERNS | Monday 8AM UTC | Weekly pattern detection via GPT-4o | **YES** (Supabase read+write) |

### HUB-QUEUE-API Response Shape (Portal)
```json
GET /webhook/hub-approval-queue?status=pending_review&direction=client_reviews&reviewer=admin

→ {
  "items": [
    {
      "type": "file",
      "file_id": "F_260328...",
      "file_name": "Q1 Report Draft",
      "file_type": "document",
      "drive_url": "https://docs.google.com/...",
      "folder_path": "Clients/Acme/Deliverables",
      "category": "CLIENTS",
      "client_id": "C_260301...",
      "client_name": "Acme Corp",
      "summary": "Quarterly performance report",
      "status": "pending_review",
      "approval_status": "pending",
      "created_by": "claude",
      "created_at": "2026-03-28T...",
      "submitted_by": "admin",
      "review_direction": "client_reviews",
      "assigned_reviewer": "C_260301..."
    }
  ],
  "count": 1,
  "pending_count": 1,
  "review_count": 0,
  "timestamp": "2026-03-28T..."
}
```

### HUB-AI-ANALYTICS Response Shape (Dashboard)
```json
GET /webhook/hub-ai-analytics?period=30&category=CONTENT

→ {
  "period_days": 30,
  "total_events": 8,
  "rejection_rate": 0.125,
  "avg_turnaround_hours": 12.5,
  "median_turnaround_hours": 8.2,
  "p95_turnaround_hours": 36.0,
  "by_category": { "CONTENT": { "count": 5, "rejection_rate": 0.2 }, ... },
  "by_workflow": { "HUB-APPROVE": { "count": 8 } },
  "active_patterns": [
    { "pattern_id": "PAT_...", "type": "rejection_trend", "severity": "medium", "description": "..." }
  ],
  "timestamp": "2026-03-28T..."
}
```

### Supabase Direct Queries (for frontend that reads data directly)

If the frontend previously read from the Hub Registry Spreadsheet, switch to these Supabase queries:

```sql
-- Pending approval queue
SELECT f.*, c.client_name
FROM hub_files f
LEFT JOIN hub_clients c ON f.client_id = c.client_id
WHERE f.approval_status = 'pending'
ORDER BY f.created_at DESC;

-- Client list
SELECT * FROM hub_clients ORDER BY client_name;

-- Project list (with client name)
SELECT p.*, c.client_name
FROM hub_projects p
LEFT JOIN hub_clients c ON p.client_id = c.client_id
ORDER BY p.created_at DESC;

-- File search
SELECT * FROM hub_files
WHERE file_name ILIKE '%search_term%'
  OR summary ILIKE '%search_term%'
ORDER BY created_at DESC
LIMIT 50;

-- Approval event history
SELECT * FROM hub_approval_events
WHERE file_id = 'F_260328...'
ORDER BY created_at DESC;

-- Active patterns
SELECT * FROM hub_pattern_analysis
WHERE status != 'resolved'
ORDER BY detected_at DESC;
```

---

## Bug Summary

| Severity | Count | Key Items |
|----------|-------|-----------|
| **CRITICAL** | 2 (both fixed) | VR-BC-POST-CHAT axios crash (fixed), VR-RDGR-BRIDGE CRM upsert failure (fixed) |
| **HIGH** | 9 | DEFT-AI routing broken (**fixed**), hardcoded Supabase service_role keys (5 workflows), hardcoded n8n API key (1, inactive), VR-BC-POST-CALL field name mismatch |
| **MEDIUM** | 58 | Hardcoded Supabase anon keys (20+ workflows), SQL injection in exec_sql (3 BRAIN workflows), this.helpers.httpRequest chains (8 workflows), Switch/IF missing version:2 (7 workflows), .first() in loops (1) |
| **LOW** | 35 | Node count mismatches, debug fields in responses, non-standard webhookIds, wrong timezone references |

### Recurring Patterns (for future frontend-backend alignment)

1. **Hardcoded Supabase keys** across DEFT + BRAIN systems — not a frontend concern but may cause auth issues if keys rotate
2. **SQL injection in BRAIN** (activities, habits, tasks) — user_id from frontend input concatenated into SQL. Frontend should sanitize user_id before sending.
3. **DEFT-AI was completely broken** until this session — if the frontend had error handling for DEFT AI features, it can now be removed since the routing is fixed

---

## Deprecated Workflows

| Workflow | Registry ID | Status | Replaced By |
|----------|------------|--------|-------------|
| VR-GENERIC-V2 | 88 | inactive | VR-GENERIC-V3 |
| VR-SETUP | 94 | inactive | One-time utility, not replaced |
| VR-BC-POST-CHAT | 83 | inactive (fixed, ready to reactivate) | N/A |
| VOICE-LEARN | 297 | inactive | VOICE-LEARN-UTIL |
| DEFT-ERR | 309 | inactive | ERR-UTIL |
| BRAIN-ERR | 322 | inactive | ERR-UTIL |

---

## Complete Workflow Inventory (Tier 4D)

| # | Workflow | Registry ID | Webhook | Nodes | Status |
|---|----------|------------|---------|-------|--------|
| 1 | VR-BC-MAIN | 77 | `bc-voice-receptionist` | 70 | active |
| 2 | VR-BC-CHATBOT | 80 | (Chat Trigger) | 21 | active |
| 3 | VR-BC-POST-CHAT | 83 | `bc-post-chat-test` | 11 | inactive |
| 4 | VR-BC-POST-CALL | 87 | `bc-voice-post-call` | 20 | active |
| 5 | VR-GENERIC-V2 | 88 | `voice-receptionist` | 45 | inactive |
| 6 | VR-GENERIC-V3 | 90 | `voice-receptionist-v3` | 55 | active |
| 7 | VR-GENERIC-POST-CALL | 92 | `voice-post-call` | 19 | active |
| 8 | VR-SETUP | 94 | (manual) | 8 | inactive |
| 9 | VR-RDGR-BRIDGE | 113 | `vr-rdgr-bridge` | 12 | active |
| 10 | VR-KB-UPDATER | 114 | `vr-kb-update` | 7 | active |
| 11 | VOICE-LEARN | 297 | (schedule) | 11 | inactive |
| 12 | DEFT-ERR | 309 | (error) | 5 | inactive |
| 13 | DEFT-BRIDGE | 310 | `deft-bridge` | 11 | active |
| 14 | DEFT-PROFILE | 311 | (execute_workflow) | 11 | active |
| 15 | DEFT-RECIPES | 312 | (execute_workflow) | 10 | active |
| 16 | DEFT-MEALS | 313 | (execute_workflow) | 8 | active |
| 17 | DEFT-EXERCISE | 314 | (execute_workflow) | 5 | active |
| 18 | DEFT-ANALYTICS | 315 | (execute_workflow) | 6 | active |
| 19 | DEFT-AI | 316 | (execute_workflow) | 12 | active |
| 20 | BRAIN-ERR | 322 | (error) | 5 | inactive |
| 21 | BRAIN-BRIDGE | 323 | `brain-bridge` | 5 | active |
| 22 | BRAIN-PROFILE | 324 | (execute_workflow) | 12 | active |
| 23 | BRAIN-ACTIVITIES | 325 | (execute_workflow) | 13 | active |
| 24 | BRAIN-SCORING | 326 | (execute_workflow) | 11 | active |
| 25 | BRAIN-ANALYTICS | 327 | (execute_workflow) | 7 | active |
| 26 | BRAIN-CALENDAR | 328 | (execute_workflow) | 13 | active |
| 27 | BRAIN-AI | 329 | (execute_workflow) | 8 | active |
| 28 | BRAIN-NOTIFY | 330 | (schedule 30m) | 5 | active |
| 29 | BRAIN-HABITS | 417 | (execute_workflow) | 11 | active |
| 30 | BRAIN-TASKS | 418 | (execute_workflow) | 16 | active |
| 31 | MTG-INGEST | 121 | (Gmail poll) | 10 | active |
| 32 | MTG-BRIDGE | 122 | `rdgr-meetings` | 15 | active |
| 33 | MTG-PROCESS | 123 | `mtg-process` | 27 | active |
| 34 | MTG-EXTRACT | 124 | `mtg-extract` | 10 | active |
| 35 | MTG-DOCS | 125 | `mtg-docs` | 13 | active |
| 36 | MTG-EMAIL | 126 | `mtg-email` | 8 | active |
| 37 | MTG-APPROVE | 127 | `mtg-approve` | 18 | active |
| 38 | MTG-PREP-SCAN | 132 | `mtg-prep-scan` + schedule | 20 | active |
| 39 | MTG-PREP-RETRIEVE | 133 | `mtg-prep-retrieve` | 10 | active |
| 40 | MTG-PREP-ANALYZE | 134 | `mtg-prep-analyze` | 12 | active |
| 41 | MTG-PREP-DOCS | 135 | `mtg-prep-docs` | 17 | active |
| 42 | HUB-FILEID | 58 | `hub-generate-file-id` | 6 | active |
| 43 | HUB-REG | 59 | `hub-registry-update` | 36 | active |
| 44 | HUB-APPROVE | 60 | `hub-approval-pipeline` | 31 | active |
| 45 | HUB-AUDIT | 61 | (schedule Sun 3AM + manual) | 18 | active |
| 46 | HUB-ONBOARD | 63 | `hub-client-onboard` | 21 | active |
| 47 | HUB-PLANNER | 65 | `hub-auto-plan` | 27 | active |
| 48 | HUB-QUEUE-API | 67 | `hub-approval-queue` (GET) | 7 | active |
| 49 | HUB-ACTION-API | 69 | `hub-approval-action` | 14 | active |
| 50 | HUB-UPLOAD | 71 | `hub-portal-upload` | 10 | active |
| 51 | HUB-NOTIFY | 73 | `hub-portal-notify` | 11 | active |
| 52 | HUB-AI-LOG | 75 | `hub-ai-log` | 10 | active |
| 53 | HUB-AI-ANALYTICS | 78 | `hub-ai-analytics` (GET) | 7 | active |
| 54 | HUB-AI-PRECHECK | 81 | `hub-ai-precheck` | 9 | active |
| 55 | HUB-AI-PATTERNS | 85 | (schedule Mon 8AM) | 12 | active |
