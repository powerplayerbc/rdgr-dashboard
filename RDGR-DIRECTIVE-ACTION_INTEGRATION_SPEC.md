# RDGR-DIRECTIVE-ACTION Integration Spec

## Overview

**Workflow ID:** `HRFRgPyzjWvTIdyL`
**Webhook Path:** `rdgr-directive-action`
**URL:** `https://n8n.carltonaiservices.com/webhook/rdgr-directive-action`
**Method:** POST
**Response Mode:** Synchronous (responseNode)
**Registry ID:** 189

Handles approve/deny actions for RDGR autonomous directives. Updates directive status in
Supabase, captures reviewer feedback, writes denial outcomes for the planning feedback loop,
and triggers an immediate replan cycle (via RDGR-PLAN) on denial.

---

## Request Payload

```json
{
  "action": "approve" | "deny",
  "directive_id": "DIR-...",
  "feedback": "string (required for deny, optional for approve)",
  "reviewer_name": "string (defaults to 'Unknown')"
}
```

### Field Details

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `action` | string | Yes | Must be `"approve"` or `"deny"` (case-insensitive) |
| `directive_id` | string | Yes | Must start with `DIR-` |
| `feedback` | string | Required for deny | Reviewer's reasoning or suggested changes |
| `reviewer_name` | string | No | Defaults to `"Unknown"` |

### Validation Rules

- `action` must be `"approve"` or `"deny"`
- `directive_id` must start with `"DIR-"`
- `feedback` is required when `action` is `"deny"`
- Directive must exist in `autonomous_directives` table
- Directive must have `status = "pending_approval"` (prevents re-approving/re-denying)

---

## Response Formats

### Success — Approve (200)

```json
{
  "success": true,
  "directive_id": "DIR-1773448949981-1",
  "action": "approve",
  "previous_status": "pending_approval",
  "new_status": "active",
  "message": "Directive approved and queued for execution.",
  "timestamp": "2026-03-14T01:11:03.658Z"
}
```

### Success — Deny (200)

```json
{
  "success": true,
  "directive_id": "DIR-1773448949981-4",
  "action": "deny",
  "previous_status": "pending_approval",
  "new_status": "denied",
  "replan_triggered": true,
  "message": "Directive denied. Replan cycle initiated with your feedback.",
  "timestamp": "2026-03-14T01:15:45.386Z"
}
```

### Validation Error (400)

```json
{
  "success": false,
  "error": "action must be approve or deny",
  "statusCode": 400
}
```

### Not Found (404)

```json
{
  "success": false,
  "error": "Directive not found: DIR-nonexistent-123",
  "statusCode": 404
}
```

### Conflict (409)

```json
{
  "success": false,
  "error": "Directive status is active, expected pending_approval",
  "statusCode": 409
}
```

---

## Data Flow

### Approve Path

1. Validate input and fetch directive from Supabase
2. PATCH `autonomous_directives`: `status` -> `"active"`, set `approval_notes`, `approved_by`, `approved_at`
3. Update Dashboard spreadsheet "Human Review" tab (fire-and-forget)
4. Return success response
5. RDGR-QUEUE picks up the now-active directive on its next 15-minute cycle

### Deny Path

1. Validate input and fetch directive from Supabase
2. PATCH `autonomous_directives`: `status` -> `"denied"`, set `approval_notes`, `approved_by`, `approved_at`
3. POST to `directive_outcomes`: status `"denied_by_human"`, feedback in `outcomes` and `blockers`
4. POST to RDGR-PLAN webhook (`/webhook/rdgr-plan`) to trigger immediate replan (30s timeout, fire-and-forget)
5. Update Dashboard spreadsheet "Human Review" tab (fire-and-forget)
6. Return success response

---

## Supabase Tables Modified

| Table | Operation | When |
|-------|-----------|------|
| `autonomous_directives` | PATCH | Always — updates status, approval_notes, approved_by, approved_at |
| `directive_outcomes` | INSERT | Deny only — creates denial record with feedback |

### Directive Status Transitions

```
pending_approval --[approve]--> active      (RDGR-QUEUE picks it up)
pending_approval --[deny]----> denied       (replan triggered)
```

### directive_outcomes Record (Deny)

```json
{
  "directive_id": "DIR-...",
  "brand_id": "carlton",
  "domain": "thinking",
  "attempt_number": 0,
  "status": "denied_by_human",
  "outcomes": {
    "action": "denied",
    "feedback": "user's feedback text",
    "reviewer": "Bradford"
  },
  "blockers": ["Human denied: user's feedback text"],
  "tokens_used": 0
}
```

---

## Downstream Effects

### On Approve

- Directive status becomes `active`
- RDGR-QUEUE dispatches it to the appropriate domain agent on its next cycle (every 15 min)
- RDGR-PLAN-DISPATCH includes it in the state summary with `approval_notes`

### On Deny

- Directive status becomes `denied`
- RDGR-PLAN-DISPATCH **excludes** denied directives from state summary (filter: `status=not.in.(archived,cancelled,denied)`)
- Denial feedback appears in `directive_outcomes` (last 48h), which RDGR-PLAN-DISPATCH includes in `recent_outcomes`
- RDGR-PLAN fires immediately, reads state summary (now without the denied directive but WITH the denial feedback), and generates new directives informed by the feedback
- GPT-5.1 sees the feedback via the `blockers` field in `recent_outcomes`

---

## Node Architecture (22 nodes)

```
Webhook (POST /rdgr-directive-action)
  -> Parse & Validate Input
  -> Validation OK? (IF)
     |-- false -> Build Validation Error -> Respond Error
     |-- true  -> Fetch Current Directive (Supabase GET)
                   -> Validate Directive
                   -> Directive Valid? (IF)
                      |-- false -> Build Directive Error -> Respond Directive Error
                      |-- true  -> Update Directive Status (prepare PATCH)
                                   -> PATCH Directive (Supabase PATCH)
                                   -> Prepare Response Data
                                   -> Is Denial? (IF)
                                      |-- true  -> Write Denial Outcome -> Trigger Replan
                                      |           -> Build Deny Response -> Respond Deny + Update Spreadsheet
                                      |-- false -> Build Approve Response -> Respond Approve + Update Spreadsheet
```

---

## Credential Dependencies

| Credential | ID | Used By |
|-----------|-----|---------|
| Supabase | `72jeHpXtJfX3ZJ7O` | Fetch/PATCH directive, Write outcome |

---

## Integration Examples

### From frontend (JavaScript)

```javascript
const response = await fetch('https://n8n.carltonaiservices.com/webhook/rdgr-directive-action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'deny',
    directive_id: 'DIR-1773448949981-4',
    feedback: 'Focus on advisory services first',
    reviewer_name: 'Bradford'
  })
});
const result = await response.json();
```

### From n8n workflow

Use HTTP Request node:
```json
{
  "method": "POST",
  "url": "https://n8n.carltonaiservices.com/webhook/rdgr-directive-action",
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ action: 'approve', directive_id: $json.directive_id, reviewer_name: 'System' }) }}"
}
```

### From curl

```bash
curl -X POST https://n8n.carltonaiservices.com/webhook/rdgr-directive-action \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "directive_id": "DIR-123", "reviewer_name": "Bradford"}'
```

---

## System Registry

| Entry | Category | ID |
|-------|----------|-----|
| RDGR-DIRECTIVE-ACTION | workflow | 189 |

