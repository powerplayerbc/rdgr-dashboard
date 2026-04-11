# Bug Fix Handoff: Brand Discovery Webhook Unregistered

**Date**: 2026-03-31
**Reporter**: Frontend Developer
**Severity**: Critical — entire Brand Discovery page is non-functional
**Affects**: `https://rdgr.bradfordcarlton.com/brand-discovery`

---

## What Happened

The user was actively filling out the Brand Discovery "Origin Story" segment (9 questions). They answered questions 1–8 successfully, meaning the webhook WAS working at some point. On the final question (9/9), the submit returned: **"Failed to submit: connection error. Your progress is saved — try again."**

After refreshing the page, Origin Story showed "Not Started" (meaning `get_progress` also failed), and clicking it returned **"Failed to Start Session: Connection error."**

## Root Cause

The n8n server at `n8n.carltonaiservices.com` is running (container is up, 13GB RAM available, load 0.15) but the **`/webhook/brand-discovery` endpoint is unregistered**. All POST requests to it are being rejected by n8n because the workflow's webhook node isn't registered.

The n8n logs show it being flooded with POST requests to the unregistered endpoint — these are the frontend's normal API calls (page load + user clicks) plus 1 retry each.

### Verification (run from any terminal)

```bash
curl -s -w "\nHTTP: %{http_code}" -X POST https://n8n.carltonaiservices.com/webhook/brand-discovery \
  -H "Content-Type: application/json" \
  -d '{"operation":"get_progress","brand_id":"carlton"}'
```

Expected when fixed: HTTP 200 with JSON `{ "success": true, ... }`
Current: HTTP 000 (connection refused) or 404 (unregistered webhook)

---

## What Needs to Be Fixed

### Step 1: Activate the BRAND-DISCOVERY workflow

- **n8n Workflow ID**: `D7TeOHZtpept3IVc`
- **System Registry ID**: 436
- **Webhook URL**: `https://n8n.carltonaiservices.com/webhook/brand-discovery`

Open the workflow in the n8n editor and **activate it** (toggle to active). This registers the webhook endpoint with n8n so incoming POST requests are routed to the workflow.

If the workflow doesn't exist or is corrupted, it needs to be rebuilt. See the operation specs below.

### Step 2: Verify all 7 operations respond

The frontend sends all requests as POST to the same webhook URL, differentiated by the `operation` field in the JSON body. Every response MUST include `{ "success": true }` on success or `{ "success": false, "error": "reason" }` on failure.

Test each operation:

```bash
# 1. get_progress — called on every page load
curl -X POST https://n8n.carltonaiservices.com/webhook/brand-discovery \
  -H "Content-Type: application/json" \
  -d '{"operation":"get_progress","brand_id":"carlton"}'

# 2. start_session — called when user clicks a category
curl -X POST https://n8n.carltonaiservices.com/webhook/brand-discovery \
  -H "Content-Type: application/json" \
  -d '{"operation":"start_session","brand_id":"carlton","category":"origin_story"}'

# 3. submit_answer — called when user submits an answer
# (requires a valid session_id from start_session)
curl -X POST https://n8n.carltonaiservices.com/webhook/brand-discovery \
  -H "Content-Type: application/json" \
  -d '{"operation":"submit_answer","brand_id":"carlton","session_id":"<UUID>","answer":"test answer"}'

# 4. get_next_question — called to fetch current question
curl -X POST https://n8n.carltonaiservices.com/webhook/brand-discovery \
  -H "Content-Type: application/json" \
  -d '{"operation":"get_next_question","brand_id":"carlton","session_id":"<UUID>"}'

# 5. synthesize_category — called after category completion
curl -X POST https://n8n.carltonaiservices.com/webhook/brand-discovery \
  -H "Content-Type: application/json" \
  -d '{"operation":"synthesize_category","brand_id":"carlton","session_id":"<UUID>"}'

# 6. get_session_review — called to review answered questions
curl -X POST https://n8n.carltonaiservices.com/webhook/brand-discovery \
  -H "Content-Type: application/json" \
  -d '{"operation":"get_session_review","brand_id":"carlton","session_id":"<UUID>"}'

# 7. re_answer — called when user wants to redo a question
curl -X POST https://n8n.carltonaiservices.com/webhook/brand-discovery \
  -H "Content-Type: application/json" \
  -d '{"operation":"re_answer","brand_id":"carlton","session_id":"<UUID>","question_index":0}'
```

### Step 3: Verify database prerequisites

These tables and data must exist in Supabase:

1. **`autonomous_brands`** — must have a row with `brand_id = 'carlton'`
2. **`brand_discovery_sessions`** — table must exist (may have existing session rows from before the crash)
3. **`brand_discovery_questions`** — must contain 97 seed questions across 15 categories

```sql
-- Check autonomous_brands
SELECT brand_id, name, status FROM autonomous_brands WHERE brand_id = 'carlton';

-- Check sessions (the user had an active origin_story session)
SELECT id, brand_id, category, status, current_question_index, avg_depth_score
FROM brand_discovery_sessions
WHERE brand_id = 'carlton'
ORDER BY updated_at DESC;

-- Check seed questions exist
SELECT category, COUNT(*) as q_count
FROM brand_discovery_questions
WHERE is_seed = true AND is_active = true
GROUP BY category
ORDER BY category;
-- Expected: 15 rows totaling 97 questions
```

### Step 4: Check the user's existing Origin Story session

The user answered 8 out of 9 questions in Origin Story before the crash. Their session data may still be in `brand_discovery_sessions`. The workflow should be able to **resume** this session (the `start_session` operation returns `action: "resumed"` for existing sessions).

Check if the session is intact:

```sql
SELECT id, category, status, current_question_index,
       jsonb_array_length(questions::jsonb) as total_questions,
       avg_depth_score, depth_target
FROM brand_discovery_sessions
WHERE brand_id = 'carlton' AND category = 'origin_story'
ORDER BY updated_at DESC
LIMIT 1;
```

If `current_question_index` is 8 (0-indexed) and the 9th question has no answer, the session is recoverable. The user should be able to resume and submit their final answer.

---

## Operation Specs (What Each Operation Must Do)

### `get_progress`
**Input**: `{ operation, brand_id }`
**Logic**: Query `brand_discovery_sessions` for all sessions matching `brand_id`. For each of the 15 categories, determine status (`not_started` / `in_progress` / `complete`).
**Output**:
```json
{
  "success": true,
  "summary": { "completed": 0, "in_progress": 1, "not_started": 14, "total": 15 },
  "overall_completion": 3,
  "categories": [
    {
      "category": "origin_story",
      "status": "in_progress",
      "answered": 8,
      "total": 9,
      "avg_depth": 0.72,
      "target": 0.85
    }
  ]
}
```

### `start_session`
**Input**: `{ operation, brand_id, category }`
**Logic**: Check if session exists for this brand_id + category. If yes, resume it. If no, create new session, load seed questions from `brand_discovery_questions`.
**Output (new)**:
```json
{
  "success": true,
  "action": "created",
  "session_id": "uuid",
  "total_questions": 6,
  "depth_target": 0.85,
  "first_question": {
    "type": "open",
    "question": "What was the defining moment...",
    "context": "Russell Brunson's Attractive Character framework...",
    "options": null
  }
}
```
**Output (resumed)**:
```json
{
  "success": true,
  "action": "resumed",
  "session_id": "uuid",
  "status": "in_progress",
  "progress": { "answered": 8, "total": 9, "avg_depth": 0.72, "target": 0.85 }
}
```

### `submit_answer`
**Input**: `{ operation, brand_id, session_id, answer|selected|verdict|rankings }`
**Logic**:
1. Save answer to the current question in the session's `questions` JSONB array
2. Run AI depth analysis on the answer (score 0.0–1.0, feedback text, optional insight)
3. If `depth_score < 0.7`, auto-generate a follow-up question and insert it next
4. Update `avg_depth_score` (running average across all answered questions)
5. Determine if category is complete (all questions answered AND avg_depth >= target)
6. If not complete, prepare next question
**Output**:
```json
{
  "success": true,
  "depth_analysis": {
    "score": 0.75,
    "feedback": "Good detail on the transformation moment...",
    "insight": "Your origin story centers on a reluctant hero archetype..."
  },
  "next_question": { "type": "open", "question": "...", "context": "...", "options": null },
  "is_complete": false,
  "progress": { "answered": 9, "total": 9, "avg_depth": 0.73, "target": 0.85 }
}
```
When `is_complete: true`, omit `next_question`.

### `get_next_question`
**Input**: `{ operation, brand_id, session_id }`
**Logic**: Return the current unanswered question for this session.
**Output**:
```json
{
  "success": true,
  "current_question": { "type": "open", "question": "...", "context": "...", "options": null },
  "question_index": 8,
  "progress": { "answered": 8, "total": 9, "avg_depth": 0.72, "target": 0.85 },
  "is_complete": false
}
```

### `synthesize_category`
**Input**: `{ operation, brand_id, session_id }`
**Logic**: Take all Q&A from the completed session, synthesize into structured brand identity data using AI, write to `autonomous_brands.identity` under the appropriate section key.
**Output**:
```json
{
  "success": true,
  "category": "origin_story",
  "identity_section": "attractive_character",
  "synthesized_data": {
    "backstory": { "origin_moment": "...", "turning_point": "..." },
    "character_type": "reluctant_hero"
  },
  "write_result": { "updated": true }
}
```

### `get_session_review`
**Input**: `{ operation, brand_id, session_id }`
**Logic**: Return all questions and answers for review.

### `re_answer`
**Input**: `{ operation, brand_id, session_id, question_index }`
**Logic**: Clear the answer for the specified question and return it as the current question so the user can re-answer it.

---

## The 15 Categories & Their Depth Targets

| Category Key | Identity Section | Depth Target | Seed Questions |
|-------------|-----------------|-------------|----------------|
| `origin_story` | `attractive_character` | 0.85 | 6 |
| `identity_type` | `attractive_character` | 0.80 | 6 |
| `epiphany_bridge` | `epiphany_bridge` | 0.90 | 6 |
| `new_opportunity` | `new_opportunity` | 0.85 | 5 |
| `beliefs` | `beliefs` | 0.90 | 4 |
| `big_domino` | `beliefs` | 0.90 | 4 |
| `mass_movement` | `mass_movement` | 0.85 | 5 |
| `frameworks` | `ppp_framework` | 0.85 | 7 |
| `value_ladder` | `value_ladder` | 0.80 | 5 |
| `audience_deep_profile` | `audience` | 0.85 | 7 |
| `competitive_positioning` | `positioning` | 0.80 | 5 |
| `content_pillars` | `content_pillars` | 0.75 | 4 |
| `ppp_framework` | `ppp_framework` | 0.85 | 9 |
| `communication_sequences` | `communication_sequences` | 0.80 | 6 |
| `voice_calibration` | `voice` | 0.85 | 18 |

---

## Supabase RPCs Used by the Workflow

| RPC | Parameters | Purpose |
|-----|-----------|---------|
| `update_identity_section` | `p_brand_id`, `p_section`, `p_data` | Write synthesized data to `autonomous_brands.identity` |
| `get_identity_section` | `p_brand_id`, `p_section` | Read identity section |
| `update_voice_dimension` | `p_brand_id`, `p_dimension`, `p_value` | Update individual voice dimension score |
| `get_voice_calibration_status` | `p_brand_id` | Read all 8 voice dimension scores |

---

## Frontend Changes Already Applied

The frontend (`brand-discovery.html`) was updated this session with:

1. **Optimistic error recovery**: When `submit_answer` fails, the frontend now calls `get_next_question` to verify if the answer was actually saved before showing the error. This prevents the user from getting stuck when the backend saves the answer but the response is lost.

2. **Auto-redirect on completion**: When a category is complete (`is_complete: true`), the frontend now shows a success toast and auto-redirects back to the category grid after 2 seconds, instead of showing a celebration screen. Synthesis runs in the background.

These changes are already deployed to `rdgr.bradfordcarlton.com`.

---

## Success Criteria

The fix is complete when:

1. `curl -X POST .../webhook/brand-discovery -d '{"operation":"get_progress","brand_id":"carlton"}'` returns `{ "success": true, "categories": [...] }`
2. The user can load `/brand-discovery` and see their Origin Story progress restored (8/9 answered)
3. The user can resume Origin Story, submit question 9/9, and get depth analysis back
4. After completion, the user is returned to the grid and can start another category
5. All 7 operations respond correctly (test with the curl commands above)

---

## Related Files

- **Frontend**: `sites/rdgr-dashboard/brand-discovery.html`
- **Previous backend issue doc**: `sites/rdgr-dashboard/BACKEND_ISSUE_brand_discovery_progress.md`
- **Full branding system spec**: `sites/rdgr-dashboard/FRONTEND_HANDOFF_branding_system.md`
- **n8n Workflow ID**: `D7TeOHZtpept3IVc`
- **System Registry ID**: 436
