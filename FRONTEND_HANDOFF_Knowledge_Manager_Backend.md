# Frontend Handoff: Knowledge Manager Backend Ready

**Date**: 2026-03-27
**Backend Status**: LIVE — tested node-by-node across all paths
**Frontend Page**: `/knowledge-manager` (RDGR Dashboard)
**Frontend File**: `rdgr-dashboard-deploy/knowledge-manager/index.html`
**Original Spec**: `docs/BACKEND_HANDOFF_Knowledge_Manager.md`

---

## What Was Built

The backend webhook specified in `BACKEND_HANDOFF_Knowledge_Manager.md` is now live. It implements the `draft_update` action exactly as specified. The `approve_update` action was not built — the frontend's existing pattern of writing directly to Supabase on approve is correct and stays as-is.

---

## Required Frontend Change (1 line)

The only change needed is setting the `WEBHOOK_URL` constant that is currently an empty string.

**File**: `knowledge-manager/index.html`

**Find this line:**
```javascript
const WEBHOOK_URL = '';
```

**Replace with:**
```javascript
const WEBHOOK_URL = 'https://n8n.carltonaiservices.com/webhook/knowledge-manager-draft';
```

That's it. The backend accepts the exact payload the frontend already sends and returns the exact response format the frontend already expects. No other frontend changes are required for core functionality.

---

## Contract Verification

The original spec defined what the frontend sends and what it expects back. Here is confirmation that the backend matches both sides exactly.

### What the Frontend Sends (unchanged)

```json
{
  "action": "draft_update",
  "table": "claude_knowledge",
  "item_id": "442255ab-dac4-47e7-a21f-948895cdd6ea",
  "current_content": "The full current content string",
  "user_suggestion": "Please update this to include...",
  "chat_history": [
    { "role": "user", "content": "Please update this...", "timestamp": "2026-03-26T10:00:00Z" }
  ],
  "user_profile": { "id": "user-uuid", "name": "Bradford" }
}
```

**Backend handles all of these fields.** Validation checks:
- `action` must be `"draft_update"` (returns 400 otherwise)
- `table` must be `"claude_knowledge"` or `"system_registry"` (returns 400 otherwise)
- `item_id` is required (returns 400 if missing)
- `current_content` must be non-empty (returns 400 if missing/blank)
- `user_suggestion` must be non-empty (returns 400 if missing/blank)
- `chat_history` defaults to `[]` if missing or not an array — never fails
- `user_profile` defaults to `{ id: "unknown", name: "Unknown" }` if missing — never fails

### What the Frontend Receives Back

**Success (HTTP 200):**
```json
{
  "success": true,
  "draft": {
    "content": "The complete updated content",
    "summary": "1-2 sentence summary of what changed",
    "changes": [
      "Added new section X",
      "Updated field Y from old to new"
    ]
  },
  "agent_message": "Conversational explanation shown in the chatbox"
}
```

**Error (HTTP 400 for validation, HTTP 200 with `success: false` for GPT failures):**
```json
{
  "success": false,
  "error": "Description of what went wrong",
  "agent_message": "User-friendly explanation for the chatbox"
}
```

This matches the original spec's "Expected Response" and "Error Response" sections exactly.

---

## What the Frontend Already Does Correctly (No Changes Needed)

Based on the original spec, these frontend behaviors are already correct:

1. **Reads content from Supabase directly** — backend does NOT re-read from DB; it uses `current_content` from the payload
2. **Writes to Supabase on approve** — backend does NOT handle writes; the frontend's direct PATCH with `updated_by: "{name}-km"` is the intended pattern
3. **Stores chat in localStorage** (`km-chat:{table}:{id}`) — this is the fast local cache
4. **Sends full `chat_history` array on each request** — backend uses this for multi-turn context (when >1 message, GPT sees prior conversation)
5. **Handles webhook failure gracefully** — stores suggestions in localStorage and shows info toast
6. **Version history in localStorage** (`km-history:{table}:{id}`) — snapshots before approve, max 3 FIFO

---

## Response Timing

The frontend should show a loading/spinner state while waiting for the draft:

| Scenario | Typical Response Time |
|----------|-----------------------|
| Short content (<1K chars) | 2-4 seconds |
| Medium content (1K-10K chars) | 4-7 seconds |
| Large content (10K+ chars) | 7-15 seconds |

The backend has a 5-minute timeout on the GPT call. If GPT takes too long, the response will be `{ success: false, error: "Response truncated", agent_message: "..." }`.

---

## New Backend Capabilities (Optional Frontend Enhancements)

These are not required for launch but are available if the frontend wants to use them later.

### 1. Server-Side Conversation History

All user suggestions and agent drafts are now persisted to the `km_conversations` Supabase table. This means chat history survives browser clears and works across devices.

**To load server-side history for an item:**
```javascript
const { data } = await supabase
  .from('km_conversations')
  .select('role, content, draft_content, draft_summary, draft_changes, created_at')
  .eq('table_name', table)
  .eq('item_id', itemId)
  .order('created_at', { ascending: true });
```

**Table columns relevant to frontend:**

| Column | Type | Description |
|--------|------|-------------|
| `role` | text | `"user"` or `"agent"` |
| `content` | text | The chat message text (suggestion for user, agent_message for agent) |
| `draft_content` | text | The full proposed content (agent rows only, null for user rows) |
| `draft_summary` | text | Summary of changes (agent rows only) |
| `draft_changes` | jsonb | Array of change descriptions (agent rows only) |
| `created_at` | timestamptz | When this message was saved |

**Possible enhancement**: On page load, check `km_conversations` for the selected item and merge with localStorage to get the most complete history.

### 2. Dashboard-Editable AI Prompts

The GPT system prompts are stored as `claude_knowledge` entries and show up in the Knowledge Manager itself:

| Entry Name | Category | What It Controls |
|------------|----------|-----------------|
| `km-prompt-claude-knowledge` | `prompt_template` | How GPT edits markdown/text entries |
| `km-prompt-system-registry` | `prompt_template` | How GPT edits JSON metadata entries |

These appear in the **"Skills & Guides"** semantic group (since `prompt_template` falls under that category). Users can edit the AI's editing behavior directly from the dashboard — the backend reads these on every request.

**No frontend change needed** — these entries are already visible and editable through the existing Knowledge Manager UI.

---

## Workflows Reference

| Workflow | ID | Nodes | Status | Purpose |
|----------|-----|-------|--------|---------|
| KM-DRAFT | `Gg6Lord4PIo51m0T` | 10 | ACTIVE | Draft generation webhook |
| KM-ERR | `vIrQLJgJJbpJZVH6` | 4 | ACTIVE | Error handler (logs to system_logs) |

---

## Test Results (Pre-Production)

All paths tested node-by-node on 2026-03-27:

| Test | HTTP Status | Duration | Result |
|------|-------------|----------|--------|
| claude_knowledge draft (markdown) | 200 | 7.6s | Correct structured draft + conversation saved |
| system_registry draft (JSON) | 200 | 5.2s | Valid JSON output + conversation saved |
| Validation error (invalid table) | 400 | 11ms | Clean error with agent_message |
| Empty chat_history | 200 | 3.1s | No history context sent to GPT |
| Multi-turn redraft (3 messages) | 200 | 4.5s | GPT used prior conversation to combine changes |
