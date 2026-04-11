# Frontend Human Task Integration Guide

## Overview

The human task system allows Bradford (or any human operator) to review, approve, reject, or edit items that autonomous workflows produce. This guide covers everything the frontend needs to display tasks and take action on them.

---

## 1. Data Source

**Table:** `directive_tasks` in Supabase (`https://yrwrswyjawmgtxrgbnim.supabase.co`)

### Query for Pending Tasks

```sql
SELECT * FROM directive_tasks
WHERE requires_human = true
  AND status IN ('pending', 'in_progress')
  AND brand_id = 'carlton'
ORDER BY created_at DESC
```

### Supabase JS Client

```javascript
const { data, error } = await supabase
  .from('directive_tasks')
  .select('*')
  .eq('requires_human', true)
  .in('status', ['pending', 'in_progress'])
  .eq('brand_id', 'carlton')
  .order('created_at', { ascending: false });
```

### Real-time Subscriptions

Subscribe via Supabase Realtime for live updates when tasks are created or resolved:

```javascript
const channel = supabase
  .channel('human-tasks')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'directive_tasks',
    filter: 'requires_human=eq.true'
  }, (payload) => {
    // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    // payload.new: the updated row
    // payload.old: the previous row (on UPDATE/DELETE)
    handleTaskChange(payload);
  })
  .subscribe();
```

---

## 2. Task Display

Each task row from `directive_tasks` contains a `parameters` JSONB column with all the rendering information.

### Key Fields

| Field | Location | Description |
|-------|----------|-------------|
| `title` | `directive_tasks.title` | Main heading for the task |
| `description` | `directive_tasks.description` | Subheading / context |
| `domain` | `directive_tasks.domain` | System area (offers, testimonials, landing_pages, etc.) |
| `human_action_type` | `directive_tasks.human_action_type` | Determines icon/category |
| `parameters.review_content` | JSONB | The content the human needs to review |
| `parameters.action_options` | JSONB array | Available action buttons |
| `parameters.callback_webhook` | JSONB | Callback URL (internal, not needed by frontend) |

### Rendering Review Content

The `parameters.review_content` object determines what UI component to render:

```javascript
const reviewContent = task.parameters?.review_content;

switch (reviewContent?.type) {
  case 'text':
    // Render in a text/markdown viewer
    // reviewContent.data contains the full text content
    return <MarkdownViewer content={reviewContent.data} />;

  case 'url':
    // Render in an iframe or link to preview page
    // reviewContent.data or reviewContent.preview_url contains the URL
    return <IframePreview url={reviewContent.preview_url || reviewContent.data} />;

  case 'comparison':
    // Render side-by-side diff (e.g., raw vs polished testimonial)
    // reviewContent.data = { original: "...", polished: "...", headline: "...", short_version: "..." }
    return <ComparisonView original={reviewContent.data.original} revised={reviewContent.data.polished} />;

  case 'document':
    // Link to Google Doc/Sheet
    // reviewContent.data contains the document URL
    return <DocumentLink url={reviewContent.data} />;

  default:
    // Fallback: render raw JSON
    return <pre>{JSON.stringify(reviewContent, null, 2)}</pre>;
}
```

### Rendering Action Buttons

The `parameters.action_options` array defines which actions the human can take:

```javascript
const actionOptions = task.parameters?.action_options || ['approve', 'reject'];

// Render a button for each option
actionOptions.map(action => (
  <ActionButton
    key={action}
    action={action}
    label={formatActionLabel(action)} // "Approve", "Reject", "Edit", "Request Changes"
    variant={getActionVariant(action)} // primary, danger, warning, secondary
    onClick={() => handleAction(task.task_id, action)}
  />
));
```

Suggested button styling:

| Action | Label | Color/Variant | Icon |
|--------|-------|---------------|------|
| `approve` | Approve | Green / primary | Checkmark |
| `reject` | Reject | Red / danger | X |
| `edit` | Edit & Approve | Blue / secondary | Pencil |
| `request_changes` | Request Changes | Orange / warning | Refresh |
| `acknowledge` | Acknowledge | Gray / neutral | Eye |
| `mark_complete` | Mark Complete | Green / primary | Checkmark |

### Grouping and Filtering

- **Group by `domain`** to show tasks organized by system area (offers, testimonials, etc.)
- **Filter by `human_action_type`** for category-specific views
- **Sort by `created_at` DESC** to show newest first
- **Badge count** on the nav item showing total pending tasks

---

## 3. Taking Action

When the human clicks an action button, POST to the HUMAN-ACTION-UTIL webhook:

```javascript
async function takeAction(taskId, action, feedback = null, editedContent = null) {
  const response = await fetch('https://n8n.carltonaiservices.com/webhook/human-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      action: action,           // 'approve', 'reject', 'edit', 'request_changes'
      feedback: feedback,       // optional human notes
      edited_content: editedContent, // optional, for 'edit' action
      acted_by: 'bradford'      // who is taking the action
    })
  });

  const result = await response.json();
  // result shape:
  // {
  //   success: true,
  //   task_id: "260318015254-HT",
  //   action: "approve",
  //   task_status: "completed",
  //   callback_fired: true,
  //   message: "Task approved successfully — workflow callback triggered"
  // }

  return result;
}
```

### Response Handling

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the action was processed |
| `task_id` | string | The task that was acted on |
| `action` | string | The action that was taken |
| `task_status` | string | New status: `completed`, `failed`, or `pending` (for request_changes) |
| `callback_fired` | boolean | Whether the originating workflow was notified |
| `message` | string | Human-readable status message |

---

## 4. Task Types Reference

| human_action_type | Domain | What to Show | Available Actions |
|-------------------|--------|-------------|-------------------|
| `approve_content` | offers | Scorecard questions, scripts, outlines | approve, reject, edit, request_changes |
| `approve_landing_page` | landing_pages | Preview URL in iframe | approve, reject, request_changes |
| `approve_offer_proposal` | offers | Proposal title, niche, rationale, confidence score | approve, reject |
| `approve_testimonial` | testimonials | Raw text vs polished text side-by-side comparison | approve, reject, edit_and_approve |
| `approve_emails` | offers | Email sequence (subject lines, bodies, timing) | approve, reject, edit, request_changes |
| `review_intelligence` | offers | Weekly performance report | acknowledge |
| `record_video` | offers | Recording instructions + script link | mark_complete |

---

## 5. Directive Approvals vs Human Tasks

The system has two types of items requiring human attention:

### Human Tasks (directive_tasks)
- **Source:** `directive_tasks WHERE requires_human = true`
- **Purpose:** Review specific content, take action (approve/reject/edit)
- **Examples:** Review a blog post, approve a landing page, edit generated copy
- **Resolution:** POST to `/webhook/human-action`

### Directive Approvals (autonomous_directives)
- **Source:** `autonomous_directives WHERE status = 'pending_approval'`
- **Purpose:** Approve or reject strategic plans/directives
- **Examples:** Approve a new sales outreach campaign, approve a content calendar
- **Resolution:** Should also route through HUMAN-ACTION-UTIL for resolution

### Unified "Action Required" View

The frontend should show **both** types in a single unified view:

```javascript
// Fetch human tasks
const { data: humanTasks } = await supabase
  .from('directive_tasks')
  .select('*')
  .eq('requires_human', true)
  .in('status', ['pending', 'in_progress'])
  .eq('brand_id', 'carlton')
  .order('created_at', { ascending: false });

// Fetch directive approvals
const { data: directiveApprovals } = await supabase
  .from('autonomous_directives')
  .select('*')
  .eq('status', 'pending_approval')
  .eq('brand_id', 'carlton')
  .order('created_at', { ascending: false });

// Combine into unified list
const actionItems = [
  ...humanTasks.map(t => ({ ...t, item_type: 'human_task' })),
  ...directiveApprovals.map(d => ({ ...d, item_type: 'directive_approval' }))
].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
```

---

## 6. Real-time Updates

### After Taking Action

1. The task status changes in Supabase immediately (your Realtime subscription will fire)
2. If `callback_fired: true` in the response, the originating workflow is already resuming automatically
3. Show a success toast: **"Approved -- workflow continuing automatically"**
4. The task moves from "pending" to "completed" (or "failed" for reject) in the UI
5. If the workflow creates a follow-up task (e.g., next build step), it will appear via Realtime

### Optimistic UI Updates

For a snappy experience:

```javascript
async function handleAction(taskId, action, feedback, editedContent) {
  // Optimistic: immediately move task to "processing" state in UI
  updateTaskInUI(taskId, { status: 'processing' });

  try {
    const result = await takeAction(taskId, action, feedback, editedContent);

    if (result.success) {
      // Remove from pending list or update status
      updateTaskInUI(taskId, { status: result.task_status });
      showToast(`${formatAction(action)} -- ${result.callback_fired ? 'workflow continuing automatically' : 'task updated'}`);
    } else {
      // Revert optimistic update
      updateTaskInUI(taskId, { status: 'pending' });
      showError(result.error);
    }
  } catch (err) {
    updateTaskInUI(taskId, { status: 'pending' });
    showError('Failed to process action: ' + err.message);
  }
}
```

---

## 7. Edit Flow

When the action is "edit", the human modifies the content before approving:

### UI Flow

1. Human clicks "Edit" button on a task
2. Show an editor pre-populated with the current content:
   - For `review_content.type = 'text'`: show a textarea or rich text editor with `review_content.data`
   - For `review_content.type = 'comparison'`: show editable fields for the polished version
   - For other types: show a JSON editor or appropriate form
3. Human makes edits and clicks "Save & Approve"
4. Capture the edited content and send it in the action payload:

```javascript
async function handleEditAndApprove(taskId, editedContent, feedback) {
  const result = await takeAction(taskId, 'edit', feedback, editedContent);
  // editedContent can be a string (for text) or an object (for structured data)
}
```

### What Happens Server-Side

- The `edited_content` is stored in the task's `result` field in `directive_tasks`
- The `edited_content` is passed through the callback to the originating workflow
- The originating workflow receives the edits in `parameters.edited_content` and uses them instead of the original generated content
- Example: if a blog post was edited, CONTENT-POST-BLOG receives the edited version and publishes that instead

### Editor Component Suggestions

| Content Type | Editor Component | Pre-populated With |
|-------------|-----------------|-------------------|
| `text` | Textarea / Markdown editor | `review_content.data` |
| `comparison` | Side-by-side with editable right panel | `review_content.data.polished` |
| `url` | Not directly editable (use feedback field for change requests) | N/A |
| `document` | Link to Google Doc (edit there, then approve here) | N/A |

---

## 8. Error Handling

### Common Error Responses

| HTTP Status | Error | Cause |
|-------------|-------|-------|
| 400 | `Missing task_id or action` | Required fields not provided |
| 400 | `Invalid action` | Action not one of: approve, reject, edit, request_changes |
| 200 (with error in body) | `Task not found: <task_id>` | Task ID does not exist in directive_tasks |

### Retry Logic

- If the webhook returns a network error, retry once after 2 seconds
- If the webhook returns a 400, do not retry (fix the payload)
- If the webhook returns a 500, retry up to 2 times with exponential backoff

---

## 9. Complete Task Card Example

```
+-------------------------------------------------------+
| [offers]                        2 min ago              |
|                                                        |
| Review AI Readiness Scorecard Questions                |
| 8 assessment questions with scoring rubric for         |
| dental practices                                       |
|                                                        |
| +-------------------------------------------------+    |
| | 1. How do you currently manage patient records? |    |
| | 2. What percentage of your scheduling is...     |    |
| | 3. Do you use AI for any diagnostic...          |    |
| | ...                                             |    |
| +-------------------------------------------------+    |
|                                                        |
| [Approve]  [Reject]  [Edit]  [Request Changes]        |
+-------------------------------------------------------+
```

### Data Mapping for the Card

- **Domain badge:** `task.domain`
- **Timestamp:** `task.created_at` (convert to relative time)
- **Title:** `task.title` (AI-generated by HUMAN-TASK-UTIL)
- **Description:** `task.description`
- **Content area:** `task.parameters.review_content` (render by type)
- **Action buttons:** `task.parameters.action_options`
