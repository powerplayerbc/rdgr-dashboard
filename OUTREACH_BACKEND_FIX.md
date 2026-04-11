# Outreach Backend Fix: Draft Status Not Updating

## Problem

When a draft is approved or rejected from the CRM Outreach tab (`bradfordcarlton.com/crm` → Outreach), the `copy_drafts` record in Supabase never gets its `review_status` updated. Every draft stays as `review_status = 'draft'` regardless of the action taken.

**Frontend calls:** `POST https://n8n.carltonaiservices.com/webhook/prosp-outreach-approved`

**Payload sent:**
```json
{
  "draft_id": "4373b26f-f291-4263-ad47-e9d0f4c20e7a",
  "contact_id": "C_260319080337",
  "action": "approve",
  "reviewer_notes": "Looks good",
  "acted_by": "bradford"
}
```

`action` is either `"approve"` or `"reject"`.

---

## What's Broken

**Workflow:** PROSP-OUTREACH-APPROVED (`iD3GdoGvTTzGxKYf`, 10 nodes)

The workflow either:
1. Doesn't update `copy_drafts` at all, OR
2. Updates it using wrong column names / query format

**Evidence:** After multiple approvals and rejections from the UI, every row in `copy_drafts` still shows:
- `review_status = 'draft'`
- `approved_at = null`
- `approved_by = null`

Meanwhile, new revision drafts ARE being created (revision_count increments), so the workflow is partially working — it triggers the re-draft but skips the status update.

---

## What Needs to Happen

### On Approve (`action = 'approve'`)

Update the `copy_drafts` row:
```sql
UPDATE copy_drafts
SET review_status = 'approved',
    approved_at = NOW(),
    approved_by = 'bradford',
    review_feedback = 'Looks good'
WHERE id = '<draft_id>';
```

Update the contact lifecycle (may already work):
```sql
-- Via CRM-BRIDGE or direct update
UPDATE unified_contacts
SET lifecycle_stage = 'outreach_ready'
WHERE contact_id = '<contact_id>';
```

### On Reject (`action = 'reject'`)

Update the `copy_drafts` row:
```sql
UPDATE copy_drafts
SET review_status = 'rejected',
    review_feedback = '<reviewer_notes>'
WHERE id = '<draft_id>';
```

Then trigger a re-draft (this part seems to work already — new revisions appear with incremented `revision_count`). The new draft should set `parent_draft_id` to the rejected draft's ID:
```sql
INSERT INTO copy_drafts (...)
VALUES (..., parent_draft_id = '<rejected_draft_id>', revision_count = <old + 1>, ...);
```

---

## Table Schema (copy_drafts)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `review_status` | TEXT | `draft` / `approved` / `rejected` / `sent` |
| `review_feedback` | TEXT | Reviewer notes from the UI |
| `approved_at` | TIMESTAMPTZ | Set on approval |
| `approved_by` | TEXT | Who approved |
| `parent_draft_id` | UUID | Links to the draft this is a revision of |
| `revision_count` | INT | 0 = original, 1+ = revisions |
| `context` | JSONB | Contains `contact_id`, `company`, `email`, etc. |

---

## Frontend Impact

The CRM Outreach tab groups drafts by `contact_id` and shows only the latest revision in the "All" view. Status-specific filters (Approved/Rejected/Sent) currently show 0 results because no drafts ever get their status updated. Once the backend fix is in place:

- "All" shows latest revision per contact (already works)
- "Approved" shows approved drafts
- "Rejected" shows rejected drafts (including superseded ones)
- "Sent" shows drafts that were sent via COLD-OUTREACH-SENDER

---

## Workflow Reference

| Workflow | ID | Webhook |
|----------|-----|---------|
| PROSP-OUTREACH-APPROVED | `iD3GdoGvTTzGxKYf` | `prosp-outreach-approved` |
| PROSP-OUTREACH-DRAFT | `VYoXVz89mi7ZriEl` | `prosp-outreach-draft` |
| CRM-BRIDGE | `m4BDKhh4rbpJdF6N` | `rdgr-crm` |
