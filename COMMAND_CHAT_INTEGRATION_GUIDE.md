# RDGR Command Chat — Backend Integration Guide

## Overview

The Command Chat is a Slack-like threaded conversation interface embedded in the RDGR Dashboard. It allows Bradford, Dianna, and Brianna to interact with the RDGR backend system conversationally — issuing directives, querying status, attaching files, and receiving AI-powered responses that can delegate to any domain agent or utility in the RDGR ecosystem.

**This document specifies exactly what the n8n `rdgr-chat` workflow must do** — what it receives from the frontend, what it must write to Supabase, how it should route to domain agents, and what it must return.

---

## Architecture

```
Frontend (Browser)                          Backend (n8n)
─────────────────                          ──────────────

  ┌─ Direct Supabase Reads ──────────────────────────────┐
  │  command_threads   (GET)  ← list/filter threads      │
  │  command_messages  (GET)  ← load message history     │
  │  command_thread_memory (GET) ← load thread context   │
  └──────────────────────────────────────────────────────┘

  ┌─ Direct Supabase Writes ─────────────────────────────┐
  │  command_threads  (POST)   ← create new thread       │
  │  command_threads  (PATCH)  ← rename, archive         │
  └──────────────────────────────────────────────────────┘

  ┌─ n8n Webhook (rdgr-chat) ────────────────────────────┐
  │  POST /webhook/rdgr-chat                             │
  │    → Insert human message to command_messages        │
  │    → Update command_threads metadata                 │
  │    → Route to AI / domain agents / utilities         │
  │    → Insert AI response to command_messages          │
  │    → Update command_thread_memory (periodic)         │
  │    ← Return AI reply to frontend                     │
  └──────────────────────────────────────────────────────┘
```

**Key principle:** The frontend reads directly from Supabase (fast, no n8n overhead). All AI interactions go through the `rdgr-chat` webhook (where routing, context assembly, and agent delegation happen).

---

## Supabase Tables

**Instance:** `https://yrwrswyjawmgtxrgbnim.supabase.co`

### `command_threads`

| Column | Type | Description |
|--------|------|-------------|
| `thread_id` | TEXT PK | Hub format `CT_YYMMDDHHmmss` (e.g. `CT_260316143022`) |
| `title` | TEXT | Thread title, default `'New Chat'`, auto-renamed to first message |
| `created_by` | TEXT | `'bradford'`, `'dianna'`, or `'brianna'` |
| `status` | TEXT | `'active'` or `'archived'` |
| `last_message_at` | TIMESTAMPTZ | Timestamp of most recent message |
| `message_count` | INTEGER | Total messages in thread |
| `preview_text` | TEXT | Last message content truncated to ~100 chars |
| `created_at` | TIMESTAMPTZ | Thread creation time |
| `updated_at` | TIMESTAMPTZ | Last modification time |

**Frontend reads:** `GET /rest/v1/command_threads?created_by=eq.{user}&status=eq.active&order=last_message_at.desc.nullsfirst,created_at.desc&limit=50`

**Frontend writes directly:** POST (create), PATCH (rename/archive)

**Backend must update:** `last_message_at`, `message_count`, `preview_text` after processing each message

### `command_messages`

| Column | Type | Description |
|--------|------|-------------|
| `message_id` | TEXT PK | `CM_YYMMDDHHmmss_NNN` (e.g. `CM_260316143022_001`) |
| `thread_id` | TEXT FK | References `command_threads.thread_id` |
| `sender` | TEXT | `'bradford'`, `'dianna'`, `'brianna'`, `'ai'`, or `'system'` |
| `sender_type` | TEXT | `'human'`, `'ai'`, or `'system'` |
| `content` | TEXT | Message body (plain text or markdown) |
| `content_type` | TEXT | `'text'` or `'markdown'` |
| `attachments` | JSONB | Array of `{filename, mimeType, size, base64_or_url}` or null |
| `metadata` | JSONB | AI messages: `{model, tokens_used, processing_time_ms, sources_referenced, delegated_to}` |
| `status` | TEXT | `'sent'` |
| `created_at` | TIMESTAMPTZ | Message timestamp |

**Frontend reads:** `GET /rest/v1/command_messages?thread_id=eq.{id}&order=created_at.asc&limit=200`

**Backend must write:** Both the human message AND the AI response as separate rows

### `command_thread_memory`

| Column | Type | Description |
|--------|------|-------------|
| `thread_id` | TEXT PK | References `command_threads.thread_id` |
| `memory_summary` | TEXT | AI-generated summary of the full conversation (200-300 words) |
| `key_facts` | JSONB | Array of `{fact, timestamp}` — decisions, entities, action items |
| `context_window` | JSONB | Last 10 messages serialized for quick reload |
| `total_tokens` | INTEGER | Approximate token count of context_window |
| `updated_at` | TIMESTAMPTZ | Last memory update time |

**Frontend reads:** `GET /rest/v1/command_thread_memory?thread_id=eq.{id}`

**Backend must write/update:** UPSERT after every 10th message in a thread (or on explicit `summarize_thread` operation)

---

## Webhook Specification

### Endpoint

```
POST https://n8n.carltonaiservices.com/webhook/rdgr-chat
Content-Type: application/json
```

**Response Mode:** `responseNode` (synchronous — return the AI reply directly)

---

### Operation: `send_message`

This is the primary operation. The frontend sends a human message and expects an AI reply back.

#### Request Payload

```json
{
  "thread_id": "CT_260316143022",
  "brand_id": "carlton",
  "domain": "chat",
  "operation": "send_message",
  "sender": "bradford",
  "parameters": {
    "content": "What's the status of our LinkedIn outreach? Can we increase the weekly connection target to 75?",
    "content_type": "text",
    "attachments": [
      {
        "filename": "outreach-data.csv",
        "mimeType": "text/csv",
        "size": 15360,
        "base64_or_url": "bmFtZSxlbWFpbCxzdGF0dXMK..."
      }
    ],
    "session_started_at": "2026-03-16T14:30:22.000Z",
    "session_duration_seconds": 342,
    "thread_context": {
      "message_count": 5,
      "memory_summary": "Bradford asked about LinkedIn strategy. Discussed current 50/week target. Reviewed Q1 results showing 23% response rate.",
      "key_facts": [
        {"fact": "Current target: 50 connections/week", "timestamp": "2026-03-16T14:31:00Z"},
        {"fact": "Q1 response rate: 23%", "timestamp": "2026-03-16T14:32:15Z"}
      ],
      "recent_messages": [
        {
          "sender": "bradford",
          "sender_type": "human",
          "content": "How are we doing on LinkedIn outreach?",
          "created_at": "2026-03-16T14:31:00.000Z"
        },
        {
          "sender": "ai",
          "sender_type": "ai",
          "content": "Current LinkedIn outreach is at 50 connections/week with a 23% response rate...",
          "created_at": "2026-03-16T14:31:15.000Z"
        }
      ]
    }
  }
}
```

#### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `thread_id` | string | Yes | Thread this message belongs to |
| `brand_id` | string | Yes | Always `"carlton"` |
| `domain` | string | Yes | Always `"chat"` |
| `operation` | string | Yes | `"send_message"` |
| `sender` | string | Yes | `"bradford"`, `"dianna"`, or `"brianna"` |
| `parameters.content` | string | Yes | The user's message text |
| `parameters.content_type` | string | Yes | `"text"` |
| `parameters.attachments` | array\|null | No | File attachments (base64 encoded, max 5MB each, max 3) |
| `parameters.session_started_at` | ISO8601 | Yes | When user opened the chat tab |
| `parameters.session_duration_seconds` | number | Yes | How long user has been in chat |
| `parameters.thread_context.message_count` | number | Yes | Total messages in this thread |
| `parameters.thread_context.memory_summary` | string\|null | No | Summary from `command_thread_memory` (null if no memory yet) |
| `parameters.thread_context.key_facts` | array\|null | No | Key facts from `command_thread_memory` |
| `parameters.thread_context.recent_messages` | array | Yes | Last 10 messages in chronological order |

#### Required Backend Steps

**Step 1: Insert human message to `command_messages`**

```sql
INSERT INTO command_messages (message_id, thread_id, sender, sender_type, content, content_type, attachments, created_at)
VALUES (
  'CM_260316143522_001',           -- Generate: CM_ + timestamp + _NNN
  'CT_260316143022',               -- From request.thread_id
  'bradford',                       -- From request.sender
  'human',                          -- Always 'human' for user messages
  'What''s the status of...',      -- From request.parameters.content
  'text',                           -- From request.parameters.content_type
  '[{"filename":"outreach-data.csv","mimeType":"text/csv","size":15360,"base64_or_url":"..."}]',
  NOW()
);
```

**Step 2: Update `command_threads` metadata**

```sql
UPDATE command_threads
SET last_message_at = NOW(),
    message_count = message_count + 1,
    preview_text = LEFT('What''s the status of our LinkedIn outreach?...', 100),
    updated_at = NOW()
WHERE thread_id = 'CT_260316143022';
```

**Step 3: Assemble AI context and determine routing**

Build the AI system prompt + context. This is where the intelligence lives. The workflow should:

1. Use `parameters.thread_context.memory_summary` for long-term context
2. Use `parameters.thread_context.recent_messages` for immediate conversation
3. Use `parameters.content` as the current user input
4. Determine if the message requires:
   - **Direct AI response** (questions, status queries, brainstorming)
   - **Domain agent delegation** (action requests that need RDGR-QUEUE/domain agents)
   - **Utility function** (one-off operations like creating a spreadsheet, sending an email)
   - **Project/task management** (creating directives, modifying tasks)

**Step 4: Generate AI response**

Call OpenAI (GPT-4o or equivalent) with the assembled context. The AI should:
- Answer the user's question directly when possible
- Explain what actions it's taking or recommending
- Report results from delegated operations
- Ask clarifying questions when the request is ambiguous

**Step 5: Insert AI response to `command_messages`**

```sql
INSERT INTO command_messages (message_id, thread_id, sender, sender_type, content, content_type, metadata, created_at)
VALUES (
  'CM_260316143525_002',
  'CT_260316143022',
  'ai',
  'ai',
  'Current LinkedIn outreach is performing well at 50/week with 23% response rate. I can create a directive to increase the target to 75/week. This would require...',
  'text',
  '{"model": "gpt-4o", "tokens_used": 847, "processing_time_ms": 2340, "delegated_to": null}',
  NOW()
);
```

**Step 6: Update `command_threads` again (for the AI reply)**

```sql
UPDATE command_threads
SET last_message_at = NOW(),
    message_count = message_count + 1,
    preview_text = LEFT('Current LinkedIn outreach is performing well...', 100),
    updated_at = NOW()
WHERE thread_id = 'CT_260316143022';
```

**Step 7: Conditionally update `command_thread_memory`**

If `message_count` is now a multiple of 10 (every 10th message), trigger a summarization:

```sql
INSERT INTO command_thread_memory (thread_id, memory_summary, key_facts, context_window, total_tokens, updated_at)
VALUES ('CT_260316143022', 'Summary text...', '[...]', '[...]', 1200, NOW())
ON CONFLICT (thread_id) DO UPDATE SET
  memory_summary = EXCLUDED.memory_summary,
  key_facts = EXCLUDED.key_facts,
  context_window = EXCLUDED.context_window,
  total_tokens = EXCLUDED.total_tokens,
  updated_at = NOW();
```

#### Success Response

```json
{
  "success": true,
  "thread_id": "CT_260316143022",
  "message_id": "CM_260316143525_002",
  "reply": {
    "content": "Current LinkedIn outreach is performing well at 50/week with 23% response rate. I can create a directive to increase the target to 75/week. This would require adjusting the RDGR-OUTBOUND agent's parameters and updating the prospecting cadence.\n\nWould you like me to:\n1. Create a directive to increase the target?\n2. Draft the updated outreach parameters first for your review?",
    "content_type": "text",
    "metadata": {
      "model": "gpt-4o",
      "tokens_used": 847,
      "processing_time_ms": 2340,
      "sources_referenced": ["unified_contacts", "contact_interactions"],
      "delegated_to": null
    }
  },
  "memory_updated": false,
  "timestamp": "2026-03-16T14:35:25.000Z"
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Failed to process message: OpenAI API timeout",
  "thread_id": "CT_260316143022"
}
```

#### Frontend Response Handling

The frontend checks these fields in this exact order:

```javascript
if (result && result.success && result.reply) {
    // SUCCESS PATH:
    // result.reply.content     → rendered as message text (supports **bold**, `code`, \n→<br>)
    // result.reply.content_type → 'text' or 'markdown'
    // result.reply.metadata    → stored but not displayed (future use)
    // result.message_id        → used as message_id (falls back to generated ID)
    // result.timestamp         → used as created_at (falls back to NOW)
} else {
    // ERROR PATH:
    // result.error             → displayed as a system message in the chat
    // Falls back to: "Failed to get a response. The backend may not be configured yet."
}
```

**Critical:** The frontend has a **30-second timeout**. If the webhook takes longer than 30s, the frontend aborts the request and shows "Request timed out (30s). Try again." The n8n workflow must respond within this window.

---

### Operation: `create_thread`

Optional — the frontend currently creates threads directly via Supabase POST. This operation exists if the backend needs to handle thread creation (e.g., with initial system messages).

#### Request

```json
{
  "thread_id": "CT_260316143022",
  "brand_id": "carlton",
  "domain": "chat",
  "operation": "create_thread",
  "sender": "bradford",
  "parameters": {
    "title": "New Chat"
  }
}
```

#### Response

```json
{
  "success": true,
  "thread_id": "CT_260316143022"
}
```

---

### Operation: `summarize_thread`

Trigger an on-demand re-summarization of thread memory.

#### Request

```json
{
  "thread_id": "CT_260316143022",
  "brand_id": "carlton",
  "domain": "chat",
  "operation": "summarize_thread",
  "sender": "bradford",
  "parameters": {}
}
```

#### Response

```json
{
  "success": true,
  "thread_id": "CT_260316143022",
  "memory_updated": true
}
```

---

### Operation: `archive_thread`

Optional — the frontend currently archives directly via Supabase PATCH.

---

## Agent Delegation Architecture

This is where the Command Chat becomes powerful. The AI doesn't just chat — it can take action by delegating to the existing RDGR agent network.

### Delegation Model

The `rdgr-chat` workflow acts as an **intelligent router**. Based on the user's message, it determines whether to:

1. **Respond directly** — answer questions, provide status, brainstorm
2. **Delegate to a domain agent** — execute a task via the existing RDGR-QUEUE pipeline
3. **Call a utility workflow** — one-off operations (create spreadsheet, check calendar, etc.)
4. **Manage projects/tasks** — write to `autonomous_directives` or `directive_tasks` directly

### How Delegation Works in Practice

When the user says something actionable (e.g., "Create a LinkedIn outreach campaign targeting CFOs"), the workflow should:

1. **AI decides the routing** — the LLM call includes a system prompt that instructs it to classify the intent and output structured actions alongside the natural language reply
2. **Execute inline or create tasks** — depending on complexity:
   - **Simple/instant:** Call utility webhook directly, include result in reply
   - **Complex/async:** Create a directive or task in Supabase, tell the user it's been queued
3. **Return the reply** — always return a human-readable reply explaining what was done or what's happening

### Delegation to Domain Agents via RDGR-QUEUE

To delegate work that needs to flow through the normal RDGR pipeline:

**Option A: Create a directive (for multi-step initiatives)**

Insert into `autonomous_directives`:

```sql
INSERT INTO autonomous_directives (
  directive_id, title, description, priority, risk_level,
  status, source, created_at
) VALUES (
  'P_260316144500',
  'Increase LinkedIn outreach to 75/week',
  'Adjust RDGR-OUTBOUND parameters to increase weekly LinkedIn connection target from 50 to 75. Update prospecting cadence and review response rate targets.',
  2,
  'medium',
  'pending_approval',   -- Goes to dashboard for Bradford's approval
  'command_chat',        -- Track that this came from chat
  NOW()
);
```

Then tell the user: "I've created directive P_260316144500 for your approval in the Dashboard. Switch to the Dashboard tab to review and approve it."

**Option B: Create tasks directly (for specific, approved actions)**

Insert into `directive_tasks`:

```sql
INSERT INTO directive_tasks (
  task_id, directive_id, brand_id, domain, operation,
  title, description, parameters, priority, status,
  requires_human, created_at
) VALUES (
  '260316144500-1',
  'P_260316144500',    -- or NULL for standalone tasks
  'carlton',
  'research',          -- domain agent: research, email, writing, sales, etc.
  'analyze',           -- operation: research, draft, analyze, create, send, update, review
  'Analyze LinkedIn response rates by industry',
  'Pull response rate data from contact_interactions for LinkedIn outreach over the past 90 days, segmented by industry.',
  '{"timeframe": "90d", "channel": "social", "platform": "linkedin"}',
  2,
  'ready',             -- RDGR-QUEUE picks up 'ready' tasks every 15 minutes
  false,
  NOW()
);
```

### Delegation to Utility Workflows

For instant, one-off operations, call the utility webhooks directly from within the n8n workflow and return the result in the chat reply.

**Available utilities (registered in `system_registry`):**

| Utility | Webhook | What It Does |
|---------|---------|--------------|
| Calendar Check | `POST /webhook/utility-calendar` | Check availability, create/update events |
| Drive Folders | `POST /webhook/utility-drive-folders` | Create folder hierarchies in Google Drive |
| Spreadsheet Create | `POST /webhook/utility-spreadsheet` | Create formatted Google Spreadsheets |
| Sheets Update | `POST /webhook/utility-sheets-update` | Read/append/update rows in existing sheets |
| Google Forms | `POST /webhook/utility-google-forms` | Create Google Forms with all question types |
| Google Slides | `POST /webhook/utility-google-slides` | Create Google Slides presentations |

**Example: User asks "What's on my calendar tomorrow?"**

The workflow should:
1. Call the calendar utility inline
2. Format the result
3. Return it as the chat reply content

```json
// Call within n8n workflow:
POST https://n8n.carltonaiservices.com/webhook/utility-calendar
{
  "operation": "list_events",
  "parameters": {
    "start": "2026-03-17T00:00:00Z",
    "end": "2026-03-17T23:59:59Z"
  }
}

// Then include the result in the AI reply:
{
  "success": true,
  "reply": {
    "content": "Here's your calendar for tomorrow (March 17):\n\n- **9:00 AM** — Team standup (30 min)\n- **11:00 AM** — Client call with Acme Corp (1 hr)\n- **2:00 PM** — Strategy review (45 min)\n\nYou have 3 meetings and ~2.25 hours committed. Want me to block focus time around these?",
    "content_type": "text",
    "metadata": {
      "model": "gpt-4o",
      "tokens_used": 423,
      "processing_time_ms": 1850,
      "delegated_to": "utility-calendar"
    }
  }
}
```

### Delegation to CRM Operations

For CRM-related requests, call the existing `rdgr-crm` webhook:

```json
POST https://n8n.carltonaiservices.com/webhook/rdgr-crm
{
  "task_id": "chat-260316144500",
  "brand_id": "carlton",
  "domain": "crm",
  "operation": "search_contacts",
  "parameters": {
    "query": "CFO",
    "filters": { "lifecycle_stage": "lead" }
  }
}
```

Available CRM operations: `upsert_contact`, `search_contacts`, `contact_360`, `log_interaction`, `update_lifecycle`, `compute_engagement`, `check_dnc`, `attribution_report`

### Creating New Projects via Chat

When a user says "Start a new project for X", the workflow should:

1. Generate a `P_yymmddhhmmss` directive ID
2. Insert the directive into `autonomous_directives` with `status: 'pending_approval'` (so it appears in the Dashboard's Directive Approvals panel)
3. Optionally pre-generate skeleton tasks via the RDGR-THINKING pattern
4. Reply with confirmation and the directive ID

### Modifying Existing Projects/Tasks

When a user says "Update task X to change the priority" or "Add a research task to project P_260314111245":

**Update a task:**
```sql
UPDATE directive_tasks
SET priority = 1, updated_at = NOW()
WHERE task_id = '260314111245-3';
```

**Add a task to an existing project:**
```sql
INSERT INTO directive_tasks (task_id, directive_id, brand_id, domain, operation, title, description, priority, status, created_at)
VALUES ('260314111245-8', 'P_260314111245', 'carlton', 'research', 'research', 'New task title', 'Description', 3, 'ready', NOW());
```

Reply with what was changed and the affected IDs.

---

## AI System Prompt Template

The n8n workflow should build a prompt like this for the LLM call:

```
You are RDGR, the autonomous operating system for Carlton AI Services. You are speaking with {sender} (one of the company's principals) through the Command Chat interface.

## Your Capabilities
- Answer questions about the business, strategy, and operations
- Query and report on data from Supabase tables (contacts, tasks, directives, execution logs)
- Create new directives (projects) that go to the Dashboard for approval
- Create individual tasks assigned to domain agents (research, email, writing, sales, calendar, finance, thinking, toolbuild)
- Call utility workflows (calendar, spreadsheets, forms, drive folders)
- Manage CRM contacts and interactions
- Provide strategic advice and brainstorm ideas

## Current Context
Thread Memory: {memory_summary or "No prior context — this is a new conversation"}
Key Facts: {key_facts as bullet list, or "None yet"}

## Recent Conversation
{recent_messages formatted as:
[timestamp] sender: content
[timestamp] sender: content
...}

## Current Message
{sender}: {content}

## Instructions
- Be direct and actionable. Bradford/Dianna/Brianna are executives — they want results, not hedging.
- When you take an action (create task, query data, etc.), explain what you did and include relevant IDs.
- When you can't do something immediately, explain what you'll set up and when they'll see results.
- If the request is ambiguous, ask a focused clarifying question rather than guessing.
- Format responses with **bold** for emphasis, bullet lists for multiple items, and `code` for IDs and technical references.
- Keep responses concise but complete — 2-4 paragraphs max for most replies.
```

---

## Response Content Formatting

The frontend supports basic markdown in AI replies:

| Syntax | Renders As |
|--------|-----------|
| `**bold**` | **bold** |
| `` `code` `` | Inline code with monospace background |
| `\n` | Line break |

No support for: headers (#), links, images, lists (use plain text bullets with `-` or `1.`), or block code fences. Keep it simple.

---

## Metadata Field Conventions

The `metadata` JSONB field on AI messages should include:

```json
{
  "model": "gpt-4o",
  "tokens_used": 847,
  "processing_time_ms": 2340,
  "sources_referenced": ["unified_contacts", "directive_tasks"],
  "delegated_to": "utility-calendar",
  "actions_taken": [
    {
      "type": "query",
      "target": "unified_contacts",
      "description": "Searched for CFO contacts"
    },
    {
      "type": "create_directive",
      "target": "autonomous_directives",
      "id": "P_260316144500",
      "description": "Created LinkedIn outreach expansion directive"
    }
  ]
}
```

This metadata is stored but not currently rendered in the frontend — it's for future dashboarding and debugging.

---

## Thread Memory Summarization

Every 10th message in a thread, the workflow should re-summarize the conversation:

1. Fetch all messages: `SELECT * FROM command_messages WHERE thread_id = '{id}' ORDER BY created_at ASC`
2. Call the LLM with a summarization prompt:
   - "Summarize this conversation in 200-300 words. Focus on decisions made, actions taken, and outstanding questions."
   - "Extract key facts as a JSON array of {fact, timestamp} objects. Include decisions, numbers, names, and commitments."
3. UPSERT to `command_thread_memory`:

```sql
INSERT INTO command_thread_memory (thread_id, memory_summary, key_facts, context_window, total_tokens, updated_at)
VALUES (
  'CT_260316143022',
  'Bradford discussed LinkedIn outreach strategy. Current target is 50 connections/week with 23% response rate. Decided to increase to 75/week. Created directive P_260316144500 for approval. Also reviewed Q1 financial results...',
  '[{"fact": "LinkedIn target increased from 50 to 75/week", "timestamp": "2026-03-16T14:35:00Z"}, {"fact": "Q1 response rate: 23%", "timestamp": "2026-03-16T14:32:15Z"}]',
  '[...last 10 messages as JSON array...]',
  1200,
  NOW()
)
ON CONFLICT (thread_id) DO UPDATE SET
  memory_summary = EXCLUDED.memory_summary,
  key_facts = EXCLUDED.key_facts,
  context_window = EXCLUDED.context_window,
  total_tokens = EXCLUDED.total_tokens,
  updated_at = NOW();
```

---

## Timing Constraints

| Constraint | Value | Reason |
|------------|-------|--------|
| Frontend timeout | 30 seconds | AbortController in sendChatMessage() |
| n8n webhook response | Must return < 30s | Or frontend shows timeout error |
| Auto-refresh (dashboard) | 5 minutes | Dashboard polls Supabase every 5m — chat messages persist regardless |
| Max attachment size | 5MB per file | Validated client-side before sending |
| Max attachments | 3 per message | Validated client-side |
| Thread fetch limit | 50 threads | Most recent 50 active threads per user |
| Message fetch limit | 200 messages | Per thread, oldest first |

---

## ID Format Reference

| Entity | Format | Example |
|--------|--------|---------|
| Thread | `CT_YYMMDDHHmmss` | `CT_260316143022` |
| Message | `CM_YYMMDDHHmmss_NNN` | `CM_260316143022_001` |
| Directive/Project | `P_YYMMDDHHmmss` | `P_260316144500` |
| Task | `YYMMDDHHmmss-N` | `260316144500-1` |
| Contact | `C_YYMMDDHHmmss` | `C_260316150000` |

Generate IDs server-side in the n8n workflow to avoid collisions.

---

## n8n Workflow Build Checklist

### Nodes needed:

1. **Webhook node** — `POST /webhook/rdgr-chat`, response mode `responseNode`
2. **Switch node** — Route by `operation` field (`send_message`, `create_thread`, `summarize_thread`, `archive_thread`)
3. **Supabase node (insert)** — Insert human message to `command_messages`
4. **Supabase node (update)** — Update `command_threads` metadata
5. **Code node** — Assemble AI prompt from thread context, memory, and current message
6. **Switch node (intent router)** — Determine if delegation is needed based on AI classification
7. **HTTP Request nodes** — Call utility webhooks, CRM, or create directives/tasks as needed
8. **OpenAI node** — Generate AI response with assembled context
9. **Supabase node (insert)** — Insert AI response to `command_messages`
10. **Supabase node (update)** — Update `command_threads` with AI message metadata
11. **Code node (conditional)** — Check if message_count % 10 === 0, trigger memory summarization
12. **Respond to Webhook node** — Return `{success, reply, message_id, timestamp}` to frontend

### Error handling:

- Wrap the main flow in a try/catch (n8n error workflow or onError setting)
- On any failure, still return `{success: false, error: "descriptive message"}` so the frontend shows the error as a system message rather than hanging
- Log errors to `autonomous_execution_log` for the System Health panel

---

## Example Conversation Flows

### Flow 1: Status Query (Direct Response)

**User:** "What tasks are currently blocked?"

**Workflow:**
1. Query `directive_tasks` where `status = 'blocked'`
2. Format results
3. Return as AI reply — no delegation needed

### Flow 2: Action Request (Inline Utility)

**User:** "Check my calendar for next Tuesday"

**Workflow:**
1. Call `utility-calendar` with list_events for next Tuesday
2. Format calendar data
3. Return as AI reply with `delegated_to: "utility-calendar"`

### Flow 3: Project Creation (Delegation)

**User:** "I want to start a content marketing campaign focused on AI consulting thought leadership"

**Workflow:**
1. AI generates a directive title + description from the request
2. Insert directive into `autonomous_directives` with `status: 'pending_approval'`
3. Reply: "I've created directive **P_260316150000** — 'AI Consulting Thought Leadership Campaign'. It's in your Dashboard approval queue. Once you approve it, RDGR-THINKING will decompose it into tasks and RDGR-QUEUE will start executing."
4. Metadata: `actions_taken: [{type: "create_directive", id: "P_260316150000"}]`

### Flow 4: Task Modification (Direct DB Update)

**User:** "Bump task 260314111245-3 to priority 1, it's urgent"

**Workflow:**
1. Update `directive_tasks` SET `priority = 1` WHERE `task_id = '260314111245-3'`
2. Reply: "Done — task `260314111245-3` is now P1 (Critical). It will be picked up in the next RDGR-QUEUE cycle (runs every 15 minutes)."

### Flow 5: Multi-Step with Clarification

**User:** "Send an email to John about the proposal"

**Workflow:**
1. AI recognizes ambiguity — which John? Which proposal?
2. Optionally search `unified_contacts` for contacts named John
3. Reply: "I found 3 contacts named John:\n- **John Smith** (Acme Corp, CFO) — last contacted March 10\n- **John Chen** (Beta Inc, CTO) — active sequence\n- **John Rivera** (prospect)\n\nWhich John, and which proposal should I reference?"

---

## Testing the Integration

### Manual test (no n8n workflow):

The frontend already handles errors gracefully. Without the n8n workflow running, sending a message will show a system error message after the network request fails. This is expected.

### Stub workflow (minimal n8n):

Create a minimal n8n workflow that echoes back:

1. Webhook node (POST /webhook/rdgr-chat)
2. Code node:
```javascript
const body = $input.first().json.body;
return [{
  json: {
    success: true,
    thread_id: body.thread_id,
    message_id: 'CM_' + Date.now() + '_echo',
    reply: {
      content: `Echo: ${body.parameters?.content || '(no content)'}`,
      content_type: 'text',
      metadata: { model: 'echo-stub', tokens_used: 0, processing_time_ms: 0 }
    },
    timestamp: new Date().toISOString()
  }
}];
```
3. Respond to Webhook node

This lets you verify the full frontend flow (optimistic UI, typing indicator, response rendering) before building the real AI routing.

### Full integration test:

1. Create Supabase tables (run the SQL from `supabase_chat_tables.sql`)
2. Deploy the n8n workflow
3. Open the dashboard, authenticate, click "Command Chat"
4. Select Bradford, create a new thread, send a message
5. Verify: message appears immediately, typing indicator shows, AI reply renders
6. Verify: thread title auto-updates to first message
7. Verify: switching to Dianna shows empty thread list
8. Verify: switching back to Dashboard preserves all dashboard state
