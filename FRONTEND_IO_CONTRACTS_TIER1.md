# Frontend IO Contracts — Tier 1 (Utilities + Approval Workflows)

**Generated:** 2026-03-28 | **Validated:** 2026-03-28 (all schemas verified against actual workflow code)
**Purpose:** Machine-readable input/output contracts for all Tier 1 workflows, so the frontend developer can build against canonical schemas.
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
  .eq('name', 'PROSP-OUTREACH-APPROVED')
  .single();
```

---

## Approval Workflows (Frontend-Facing)

These are the workflows the frontend calls directly when a user takes action on a review item.

### 1. PROSP-OUTREACH-APPROVED

**Webhook:** `POST /webhook/prosp-outreach-approved`

**Input:**
| Field | Required | Type | Default | Notes |
|-------|----------|------|---------|-------|
| `action` | YES | enum | — | `approve`, `reject`, `edit`, `skip` (also accepts past tense + `rewrite`) |
| `draft_id` | YES | string | — | Outreach draft ID. Must be provided by frontend |
| `entity_id` | no | string | `''` | Contact ID. **Alias:** `contact_id` also works |
| `brand_id` | no | string | `carlton` | |
| `task_id` | no | string | `''` | **Alias:** `human_task_id` also works |
| `feedback` | no | string | `''` | Reviewer notes. **Alias:** `reviewer_notes` also works |
| `edited_content` | no | string | `null` | Direct content edits |
| `acted_by` | no | string | `system` | User identifier |

**Action normalization:** All inputs are normalized to past tense internally:
- `approve`, `approved` → `approved`
- `reject`, `rejected`, `edit`, `edited`, `rewrite` → `edited`
- `skip`, `skipped` → `skipped`

**Also accepts `body.parameters.*`** as fallback for all fields (canonical envelope).

**Branches:**
| Normalized Action | What Happens | Downstream | Side Effects |
|--------|-------------|------------|--------------|
| `approved` | Draft approved, contact updated, queued for send | Supabase Query Utility | `copy_drafts.review_status=approved`, `outreach_send_queue` INSERT, `unified_contacts` UPDATE |
| `edited` | GPT rewrites with feedback, new draft + review task created | HUMAN-TASK-UTIL | New `copy_drafts` row inserted, `directive_tasks` created. **Note:** Original draft status is NOT updated |
| `skipped` | Draft marked skipped | — | `copy_drafts.review_status=skipped` |
| fallback | Unknown action, no side effects | — | — |

**Response:** `{"success": true, "action": "approved|edited|skipped|unknown", "entity_id": "...", "result": "approved|skipped|unknown"}`

---

### 2. SOCIAL-APPROVED

**Webhook:** `POST /webhook/social-approved`

**Input:**
| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `action` | YES | enum | `approve`, `reject`, `edit`, `skip` |
| `draft_id` | YES | string | Social media draft ID |
| `platform` | no | enum | `instagram`, `facebook`, `twitter`, `linkedin` |
| `contact_id` | no | string | Contact ID |
| `feedback` | no | string | Reviewer notes |
| `edited_content` | no | string | Direct content edits (for edit action) |
| `override_type` | no | string | Override classification (DM vs Engagement) |
| `brand_id` | no | string | Defaults to `carlton` |

**Branches:**
| Action | What Happens | Downstream |
|--------|-------------|------------|
| `approve` | Draft approved via RPC | `approve_social_draft(action=approve)` |
| `reject` | Triggers AI redraft | Calls SOCIAL-DRAFT webhook |
| `edit` | Applies edits + approves | `approve_social_draft(action=edit)` |
| `skip` | Draft skipped | `approve_social_draft(action=skip)` |

**Response:**
```json
{"success": true, "action": "approved|redraft_triggered|edited_and_approved|skipped", "draft_id": "..."}
```

---

### 3. RDGR-DIRECTIVE-ACTION

**Webhook:** `POST /webhook/rdgr-directive-action`

**Input:**
| Field | Required | Type | Default | Notes |
|-------|----------|------|---------|-------|
| `directive_id` | YES | string | — | Must start with `DIR-` or `P_` |
| `action` | YES | enum | — | `approve` or `deny` (lowercased + trimmed) |
| `feedback` | no | string | `''` | Notes (especially for denials) |
| `reviewer_name` | no | string | `Unknown` | |

**Validation errors:**
| Condition | HTTP Status |
|-----------|------------|
| `action` not `approve`/`deny` | 400 |
| `directive_id` missing or invalid prefix | 400 |
| Directive not found in DB | 404 |
| Directive status != `pending_approval` | 409 |

**Branches:**
| Action | What Happens | Downstream | Side Effects |
|--------|-------------|------------|--------------|
| `approve` | Directive set to active, decomposed into tasks, BRAIN points | BRAIN-BRIDGE, RDGR-THINKING (decompose), Update Spreadsheet | `autonomous_directives.status=active` |
| `deny` | Denial recorded, escalation to RDGR-THINKING | RDGR-THINKING (escalate), BRAIN-BRIDGE, Update Spreadsheet | `autonomous_directives.status=denied`, `directive_outcomes` INSERT. If escalation returns `revise`, status resets to `pending_approval` |

**Response:**
```json
// Approve: {"success": true, "directive_id": "...", "action": "approve", "previous_status": "...", "new_status": "active", "message": "..."}
// Deny: {"success": true, "directive_id": "...", "action": "deny", "new_status": "denied", "escalation_triggered": true, "escalation_decision": "..."}
// Error: {"success": false, "error": "...", "statusCode": 400|404|409}
```

---

### 4. OFFER-BUILD

**Webhook:** `POST /webhook/offer-build`

**Input:**
| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `brand_id` | YES | string | Brand identifier (multi-brand ready) |
| `operation` | no | enum | `create_from_proposal`, `continue_build`, `launch`, or empty (normal create) |
| `offer_id` | no | string | Required for existing offers. Routing is based on offer_id presence |
| `proposal_id` | no | string | Required for `create_from_proposal` |
| `review_feedback` | no | string | For review/reject operations (future expansion) |
| `edited_offer` | no | string | For applying human edits (future expansion) |
| `approval_notes` | no | string | For approve operation (future expansion) |

**Response shapes:**
```json
// Step completed: {"success": true, "offer_id": "...", "status": "step_completed", "step_completed": "...", "message": "..."}
// All done: {"success": true, "offer_id": "...", "status": "all_completed", "message": "..."}
// Waiting: {"success": true, "offer_id": "...", "status": "awaiting_human", "message": "..."}
// Blocked: {"success": true, "offer_id": "...", "status": "blocked", "message": "..."}
```

---

### 5. HUMAN-ACTION-UTIL (Human Task Resolution)

**Webhook:** `POST /webhook/human-action`

**Input:**
| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `task_id` | YES | string | Directive task ID |
| `action` | YES | enum | `approve`, `reject`, `edit`, `request_changes`, `acknowledge`, `mark_complete` |
| `feedback` | no | string | Notes from reviewer |
| `edited_content` | no | string | For edit action |
| `acted_by` | no | string | User identifier |

**Response:**
```json
{"success": true, "task_id": "...", "action": "approve", "task_status": "completed|failed|pending", "callback_fired": true, "message": "Task approved successfully"}
```

---

## Core Utilities (Called by Backend, Not Frontend)

These are backend-to-backend contracts. Listed here for completeness — the frontend does NOT call these directly.

### HUMAN-TASK-UTIL (Task Creation)
- **Webhook:** `POST /webhook/create-human-task`
- **Required:** `domain`, `operation` (only these two are validated)
- **Optional with defaults:** `human_action_type` (default: `approval`), `entity_id` (default: `""`), `entity_type` (default: `unknown`), `brand_id` (default: `carlton`), `context` (default: `{}`), `review_content` (default: `null`), `action_options` (default: `["approve","reject"]`)
- **Response:** `{success, task_id, title}`
- **Side effect:** Inserts into `directive_tasks`

### Supabase Query Utility
- **Webhook:** `POST /webhook/supabase-query`
- **Dispatch:** `operation` field routes to: `select`, `insert`, `update`, `delete`, `rpc`
- **Response:** `{success, operation, table, data, statusCode, count}`

### CRM-BRIDGE
- **Webhook:** `POST /webhook/rdgr-crm`
- **Dispatch:** `operation` field routes to 13 operations: `upsert_contact`, `search_contacts`, `log_interaction`, `update_lifecycle`, `get_contact_360`, `compute_engagement`, `merge_contacts`, `bulk_import`, `get_pipeline`, `attribution_report`, `check_dnc`, `delete_contact`, `export_contact_data`
- **Envelope:** Universal Request (brand_id, task_id, domain, operation, parameters)
- **Response:** Universal Response (success, task_id, operation, result, error)

### Google Calendar Utility
- **Webhook:** `POST /webhook/google-calendar-utility`
- **Operations:** `check_availability`, `create_event`, `list_events`, `get_event`, `update_event`, `delete_event`

### HUB-BRIDGE
- **Webhook:** `POST /webhook/rdgr-hub`
- **Operations:** `register_file`, `submit_approval`, `onboard_client`, `plan_goals`, `audit_report`, `search_registry`

### EMAIL-ASSEMBLY-UTIL
- **Webhook:** `POST /webhook/email-assembly`
- **Required:** `brand_id`, `contact_id`
- **Response:** `{success, subject, body, assembly_log_id, composition_name, pieces_used, variables_filled}`

### Create Google Spreadsheet
- **Webhook:** `POST /webhook/create-google-sheet-v2`
- **Optional:** `title` (default: `Untitled Sheet`), `folder_id` or `folderId` (both accepted), `sheets[]`, `data[]`, `headers`+`rows`
- **Response:** `{success, spreadsheet_id, spreadsheetId, url, title, folder_id, folderId, moved_to_folder, summary, sheets}`
- **Note:** Response includes both snake_case and camelCase for ID fields

### Update Google Spreadsheet
- **Webhook:** `POST /webhook/update-google-sheet`
- **Operations:** `get_structure`, `append`, `update`, `find_and_update`, `delete_rows`
- **All require:** `spreadsheetId`

### Google Drive Folders
- **Webhook:** `POST /webhook/drive-create-folders`
- **Required:** `path` (slash-separated, e.g. `Clients/Acme/Deliverables`)
- **Optional:** `root_folder_id` or `rootFolderId` (both accepted, default: `root`)
- **Response:** `{success, folder_id, folderId, folder_name, folder_url, folderUrl, path, root_folder_id, rootFolderId, segments}`
- **Note:** Response includes both snake_case and camelCase for ID fields. `folder_name` is the name of the deepest created/found folder.

---

## Migration Notes for Frontend

### Current Frontend Action Names vs Backend

| Frontend Current | Backend Accepts | Workflow | Notes |
|-----------------|----------------|----------|-------|
| `reject` (email) | `approve`, `reject`, `edit`, `skip` (+ past tense + `rewrite`) | PROSP-OUTREACH-APPROVED | `reject` and `edit` both normalize to `edited` path |
| `reject` (social) | `approve`, `reject`, `edit`, `skip` | SOCIAL-APPROVED | `reject` triggers AI redraft, `edit` applies human edits |
| `approve`/`deny` (directive) | `approve`, `deny` ONLY | RDGR-DIRECTIVE-ACTION | Strictly validated. `reject` will return 400 |

### Critical Frontend Notes
1. **Email outreach:** `reject` and `edit` are interchangeable — both route to the rewrite path. But `edit` is the canonical action name going forward.
2. **Social outreach:** `reject` and `edit` are DIFFERENT actions. `reject` = AI redraft. `edit` = apply human's edited_content.
3. **Directives:** Must send `deny`, not `reject`. The workflow validates strictly and returns HTTP 400.
4. **All panels:** Include `acted_by` field for audit trail. Use `feedback` (not `reviewer_notes`) as the canonical field name.
5. **Field casing:** Google utility workflows now accept BOTH `folder_id` (snake_case) and `folderId` (camelCase). Responses include both casings. Use snake_case going forward for consistency with the rest of the system.

### Known Inconsistency: Table Name
The email outreach system uses `copy_drafts` table (not `outreach_drafts`). The `review_status` column (not `status`) is what gets updated on approve/skip. The `edited` path does NOT update the original draft status — it creates a new draft row instead.

---

## Schema Version

All io_schema entries use `version: 1`. The meta-schema definition is in `system_registry` under:
- **Category:** `config`
- **Name:** `standardization_io_schema_spec`
