# RDGR Dashboard — Frontend/Backend Integration Status

## Date: 2026-03-17

---

## 1. Command Chat (WORKING)

**Backend:** RDGR-CHAT workflow `y03eJLCtdNMX3gZa` (22 nodes, ACTIVE)
**Webhook:** `POST https://n8n.carltonaiservices.com/webhook/rdgr-chat`

**Status:** Fully operational. Routes through GPT-5.1 classifier with full capabilities awareness (utilities, domain agents, CRM, task management). Domain agents execute inline (15-120s) and return results directly in chat. No directives created for routine chat — only when user explicitly creates a project/task via `task_management` route.

**Frontend changes needed:** See `COMMAND_CHAT_FRONTEND_CHANGES.md`
- Extend timeout from 30s to 180s
- Add elapsed time counter to typing indicator
- Render clickable URLs in AI responses

---

## 2. New Task Button (WORKING — was broken, now fixed)

**Backend:** RDGR-INTAKE workflow `Y9ROV7fKNemxerbz` (ACTIVE)
**Webhook:** `POST https://n8n.carltonaiservices.com/webhook/rdgr-intake`

**Bug fixed:** The `autonomous_task_queue` table had a check constraint on the `source` column that didn't include `user_input`. Constraint updated to allow: `rdgr_plan`, `rdgr_intake`, `rdgr_queue`, `manual`, `user_input`, `command_chat`, `api`.

**Payload format:**
```json
{
  "task_type": "research|writing|email|calendar|sales|finance|thinking|toolbuild",
  "title": "Brief task title",
  "description": "Detailed description of what needs to be done",
  "priority": 1-5,
  "dependencies": [],
  "metadata": {}
}
```

**Response format:**
```json
{
  "success": true,
  "brand_id": "carlton",
  "task_id": "USR-1773735981855",
  "title": "...",
  "domain": "thinking",
  "priority": 5,
  "status": "ready",
  "integrate_with_plan": true,
  "message": "Task USR-... created and strategic replan triggered"
}
```

**What happens:** Task is created in `autonomous_task_queue`, then RDGR-PLAN is triggered for strategic replanning. The task gets picked up by RDGR-QUEUE on its next 15-minute cycle.

**Frontend requirements:**
- POST to the webhook with the payload above
- Show success/error based on response
- Display the task_id in the confirmation
- The `task_type` field maps to domain agents (research, writing, etc.)

---

## 3. Social Media Post Request (WORKING)

**Backend:** RDGR-TOOL-SOCIAL workflow `sgoCsyldvBLiVZIs` (ACTIVE)
**Webhook:** `POST https://n8n.carltonaiservices.com/webhook/rdgr-tool-social`

**Returns:** HTTP 200 on success.

**Available platforms:**
| Platform | Workflow | Status |
|----------|----------|--------|
| LinkedIn | RDGR-TOOL-POST-LINKEDIN (`E8fZ8eah83VrnN8p`) | ACTIVE |
| Facebook | RDGR-TOOL-POST-FACEBOOK (`g7sKwfePnpKS6CAc`) | ACTIVE |
| Instagram | RDGR-TOOL-POST-INSTAGRAM (`xNCxMwOwmOXBOyir`) | ACTIVE |
| Twitter/X | RDGR-TOOL-POST-TWITTER (`P4x9LB2Wl0AK7P77`) | ACTIVE |

**Payload format** (POST to rdgr-tool-social):
```json
{
  "platform": "linkedin|facebook|instagram|twitter",
  "content": "The post text content",
  "parameters": {
    "image_url": "optional image URL",
    "hashtags": ["optional", "hashtags"]
  }
}
```

**Note:** SMCA (Social Media Content Analytics) is a SEPARATE system for post-publish analytics — it is NOT the social posting tool. SMCA is INACTIVE pending platform credentials.

**Frontend requirements:**
- Form with: platform selector, content textarea, optional image upload
- POST to the webhook
- Show success/error

---

## 4. Directive/Task Dashboard Panel

**Issue resolved:** Chat interactions were creating `in_progress` directives that never completed, cluttering the dashboard. This has been fixed:
- 10 stuck test directives cleaned up (set to `cancelled`)
- Chat no longer creates directives for routine interactions
- Only the `task_management` route creates directives (when user explicitly asks)
- The `autonomous_task_queue_source_check` constraint was updated to allow `user_input` and `command_chat` sources

---

## Backend Webhook Quick Reference

| Feature | Webhook URL | Method |
|---------|-------------|--------|
| Command Chat | `/webhook/rdgr-chat` | POST |
| New Task | `/webhook/rdgr-intake` | POST |
| Social Post | `/webhook/rdgr-tool-social` | POST |
| CRM Operations | `/webhook/rdgr-crm` | POST |

All URLs prefixed with `https://n8n.carltonaiservices.com`
