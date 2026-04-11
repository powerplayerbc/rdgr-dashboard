# Frontend Handoff: BRAIN Habits & Tasks Backend Implementation

**Date:** 2026-03-28
**Status:** All 19 operations deployed and E2E tested
**Reference:** `docs/BACKEND_HANDOFF_brain_habits_tasks.md` (the original spec from frontend)

---

## What Was Built

### Database (5 new tables — all live in Supabase)

| Table | Purpose | RLS | Realtime |
|-------|---------|-----|----------|
| `brain_habits` | Habit definitions (name, frequency, points, icon) | anon policy | No |
| `brain_habit_completions` | Daily completion records linked to activities | anon policy | Yes |
| `brain_tasks` | Tasks with heat levels, deadlines, scheduled dates | anon policy | Yes |
| `brain_task_rules` | System + user config (AI prompts, defaults) | anon policy | No |
| `brain_day_closures` | Day closure records with completion stats | anon policy | No |

All tables match the schemas in the handoff doc exactly, with one addition:
- `brain_habits` has an `updated_at` column (omitted from handoff but needed for consistency with other BRAIN tables and the auto-update trigger)

The `brain_activities.source` CHECK constraint was updated to allow `'habit'` and `'task'` values.

3 system default task rules were seeded:
- `default_estimate_minutes`: `{"value": 30}`
- `ai_fill_prompt`: (the full prompt from the handoff spec)
- `category_defaults`: `{"Business": 30, "Study": 45, "Exercise": 45, "Household": 20, "Family": 30, "General": 15}`

### Workflows (2 new sub-workflows + 2 updated)

| Workflow | ID | Nodes | Status |
|----------|-----|-------|--------|
| **BRAIN-HABITS** | `cIlm5T2ulxmW0XsF` | 11 | Active |
| **BRAIN-TASKS** | `qd9xZ0S06J9t1Paz` | 16 | Active |
| **BRAIN-BRIDGE** (updated) | `f3NTXVZcjeVJiymi` | 5 | Active — added `habits` and `tasks` routes |
| **BRAIN-SCORING** (updated) | `h3vb1AzB4c97RrvZ` | 11 | Active — added 4 achievement checks |

### All 19 Operations via BRAIN-BRIDGE webhook

All calls go through: `POST https://n8n.carltonaiservices.com/webhook/brain-bridge`

Payload format: `{ "operation": "<name>", "user_id": "<uuid>", "data": { ... } }`

---

## Operation Reference (with actual response shapes)

### Habit Operations (8)

#### `get_habits`
- **Input:** `{ user_id }`
- **Response:**
```json
{
  "success": true,
  "operation": "get_habits",
  "data": { "habits": [ { habit_id, user_id, name, category_id, icon, points_value, frequency, sort_order, is_active, created_at, updated_at } ] },
  "timestamp": "ISO string"
}
```

#### `add_habit`
- **Input:** `{ user_id, data: { name, category_id?, icon?, points_value?, frequency?, sort_order? } }`
- **Defaults:** icon="star", points_value=15, frequency="daily", sort_order=0
- **Response:** `{ success, data: { habit_id } }`

#### `update_habit`
- **Input:** `{ user_id, data: { habit_id, name?, category_id?, icon?, points_value?, frequency?, sort_order? } }`
- **Response:** `{ success, data: { updated: true } }`

#### `delete_habit`
- **Input:** `{ user_id, data: { habit_id } }`
- **Response:** `{ success, data: { deleted: true } }`
- **Note:** Soft delete — sets `is_active = false`

#### `complete_habit`
- **Input:** `{ user_id, data: { habit_id, date, actual_minutes?, notes? } }`
- **Response:** `{ success, data: { points_earned, activity_id } }`
- **Logic:** Awards MAX(habit.points_value, time-based calculation). Creates `brain_activities` row with `source = 'habit'`. Updates profile points + daily scores.

#### `uncomplete_habit`
- **Input:** `{ user_id, data: { habit_id, date } }`
- **Response:** `{ success, data: { uncompleted: true } }` or `{ success, data: { message: "No completion found" } }`
- **Logic:** Deletes completion, deletes linked activity, subtracts points, recalculates daily scores.

#### `update_habit_completion`
- **Input:** `{ user_id, data: { habit_id, date, actual_minutes?, notes? } }`
- **Response:** `{ success, data: { updated: true } }`
- **Logic:** If actual_minutes changes, recalculates points using the higher-of logic and updates the linked activity.

#### `get_habit_completions`
- **Input:** `{ user_id, data: { start_date, end_date } }`
- **Response:** `{ success, data: { completions: [ { completion_id, habit_id, user_id, completion_date, completed_at, actual_minutes, notes, points_earned, activity_id } ] } }`

---

### Task Operations (8)

#### `get_tasks`
- **Input:** `{ user_id, data: { date } }`
- **Response:**
```json
{
  "success": true,
  "operation": "get_tasks",
  "data": { "tasks": [ { task_id, user_id, title, description, category_id, estimated_minutes, actual_minutes, deadline, scheduled_date, status, heat_level, original_date, completed_at, notes, points_earned, activity_id, calendar_event_id, created_at, updated_at } ] },
  "timestamp": "ISO string"
}
```
- **Sorting:** `heat_level DESC, deadline ASC NULLS LAST, created_at ASC`
- **Filter:** `status != 'pushed'`

#### `add_task`
- **Input:** `{ user_id, data: { title, description?, category_id?, estimated_minutes?, scheduled_date?, deadline?, original_date? } }`
- **Defaults:** estimated_minutes=30, scheduled_date=today (Pacific), original_date=scheduled_date, status="pending", heat_level=0
- **Response:** `{ success, data: { task_id, estimated_minutes, category_id } }`

#### `update_task`
- **Input:** `{ user_id, data: { task_id, title?, category_id?, estimated_minutes?, scheduled_date?, deadline?, notes?, description? } }`
- **Response:** `{ success, data: { updated: true } }`

#### `delete_task`
- **Input:** `{ user_id, data: { task_id } }`
- **Response:** `{ success, data: { deleted: true } }`
- **Logic:** Cleans up linked calendar event + activity, subtracts points, recalculates scores.

#### `complete_task`
- **Input:** `{ user_id, data: { task_id, actual_minutes? } }`
- **Response:** `{ success, data: { points_earned, activity_id, calendar_event_id } }`
- **Logic:** Creates activity (source='task'), creates retroactive Google Calendar event, updates profile points + daily scores.

#### `uncomplete_task`
- **Input:** `{ user_id, data: { task_id } }`
- **Response:** `{ success, data: { uncompleted: true } }`
- **Logic:** Deletes calendar event, deletes activity, resets task to pending, subtracts points.

#### `get_task_rules`
- **Input:** `{ user_id }`
- **Response:**
```json
{
  "success": true,
  "operation": "get_task_rules",
  "data": {
    "default_estimate_minutes": { "value": 30 },
    "ai_fill_prompt": { "prompt": "..." },
    "category_defaults": { "Business": 30, "Study": 45, ... }
  }
}
```
- **Note:** User overrides merge on top of system defaults.

#### `update_task_rules`
- **Input:** `{ user_id, data: { rule_key, rule_value } }`
- **Response:** `{ success, data: { updated: true } }`

---

### Day Operations (2)

#### `close_day`
- **Input:** `{ user_id, data: { date } }`
- **Response:** `{ success, data: { tasks_pushed, completion_pct, total_habits, done_habits, total_tasks, done_tasks } }`
- **Heat level increments:**
  - Base: +1 for every push
  - Overdue (deadline < today): +3
  - Due tomorrow (deadline - today <= 1): +2
  - Due within 3 days (deadline - today <= 3): +1
- **Frequency filtering:** Weekday-only habits don't count on weekends, weekend-only habits don't count on weekdays.

#### `get_day_progress`
- **Input:** `{ user_id, data: { date } }`
- **Response:** `{ success, data: { total_habits, done_habits, total_tasks, done_tasks, completion_pct } }`

---

### AI Operation (1)

#### `ai_fill_task`
- **Input:** `{ user_id, data: { title, description? } }`
- **Response:** `{ success, data: { estimated_minutes, category_id, category_slug } }`
- **Model:** gpt-4.1-nano with JSON response format

---

## Differences from Handoff Spec

### 1. Response Wrapping

All responses include `operation` and `timestamp` fields not in the original spec:

```json
// Handoff spec expected:
{ "success": true, "data": { ... } }

// Actual response:
{ "success": true, "operation": "get_habits", "data": { ... }, "timestamp": "2026-03-28T02:28:14.856Z" }
```

This matches the existing BRAIN operations (get_profile, get_activities, etc.), so if the frontend already works with BRAIN, this is consistent.

### 2. List Responses Are Nested Under Named Keys

```json
// Handoff spec expected:
{ "success": true, "data": [ ...habit objects... ] }

// Actual response:
{ "success": true, "data": { "habits": [ ...habit objects... ] } }
```

This applies to: `get_habits` (data.habits), `get_tasks` (data.tasks), `get_habit_completions` (data.completions).

Again, this matches existing BRAIN conventions (e.g., `get_activities` returns `data.activities`).

**Frontend fix (if needed):** Change `response.data` to `response.data.habits`, `response.data.tasks`, `response.data.completions` respectively.

### 3. `ai_fill_task` Returns `category_slug` Instead of `priority`

```json
// Handoff spec expected:
{ "estimated_minutes": 30, "category_id": "uuid", "priority": "high" }

// Actual response:
{ "estimated_minutes": 30, "category_id": "uuid-or-null", "category_slug": "exercise" }
```

- `category_slug` is returned because it's what GPT outputs (it matches against user category slugs)
- `category_id` is resolved from the slug when a match is found, `null` otherwise
- `priority` is not returned — it wasn't clear what values were expected (1-5? high/medium/low?)

**Frontend fix (if needed):** Use `category_slug` for display and `category_id` for storage. If priority is needed, we can add it to the AI prompt.

### 4. `add_task` Does Not Auto-Call `ai_fill_task` Inline

The handoff spec said `add_task` should auto-fill missing fields via AI. In practice, `add_task` applies static defaults (30 min estimate) but does NOT make an AI call.

**Recommended frontend pattern:**
```javascript
// If user leaves fields empty, call ai_fill first:
if (!estimated_minutes || !category_id) {
    const fill = await brainBridge('ai_fill_task', { title, description });
    estimated_minutes = fill.data.estimated_minutes;
    category_id = fill.data.category_id;
}
const task = await brainBridge('add_task', { title, estimated_minutes, category_id, ... });
```

This gives the frontend control over when AI is invoked (and lets you show a loading spinner during the AI call).

### 5. `close_day` Response Has Extra Fields

```json
// Handoff spec expected:
{ "tasks_pushed": 2, "completion_pct": 40 }

// Actual response:
{ "tasks_pushed": 2, "completion_pct": 40, "total_habits": 2, "done_habits": 1, "total_tasks": 3, "done_tasks": 1 }
```

The extra fields are additive and can be used by the frontend for the closure summary UI. No breaking change.

---

## Direct Supabase Access (Frontend Reads)

Per Section 6 of the handoff, the frontend reads tables directly via Supabase REST. All tables are accessible via the anon key with these filter patterns:

| Table | Filter |
|-------|--------|
| `brain_habits` | `user_id=eq.{id}&is_active=eq.true&order=sort_order,created_at` |
| `brain_habit_completions` | `user_id=eq.{id}&completion_date=gte.{start}&completion_date=lte.{end}` |
| `brain_tasks` | `user_id=eq.{id}&scheduled_date=eq.{date}&status=neq.pushed&order=heat_level.desc,deadline.asc.nullslast` |
| `brain_task_rules` | `or=(user_id.eq.{id},user_id.is.null)&order=user_id.asc.nullsfirst` |
| `brain_day_closures` | `user_id=eq.{id}&closure_date=eq.{date}` |

Realtime subscriptions are enabled on `brain_habit_completions` and `brain_tasks`.

---

## Achievements (4 new)

Added to BRAIN-SCORING, checked after any activity/completion event:

| Key | Name | XP | Trigger |
|-----|------|-----|---------|
| `habit_streak_7` | Week Warrior | 50 | Any single habit completed 7 consecutive days |
| `habit_streak_30` | Monthly Master | 200 | Any single habit completed 30 consecutive days |
| `perfect_day` | Perfect Day | 75 | 100% habits + tasks complete for the day |
| `task_crusher` | Task Crusher | 100 | 10+ tasks completed in a single day |

Achievement definitions are also stored in `brain_settings` as `achievement_habit_streak_7`, etc.

---

## Summary for Frontend Developer

**If your frontend already follows existing BRAIN conventions** (e.g., `response.data.activities` pattern), everything should work as-is.

**If your frontend was built strictly to the handoff spec**, these are the changes needed:
1. Access list data via `response.data.habits` / `response.data.tasks` / `response.data.completions` instead of `response.data` directly
2. Use `category_slug` from `ai_fill_task` instead of `priority` (or request backend add priority)
3. Call `ai_fill_task` separately before `add_task` when you want AI auto-fill
4. Handle the extra `operation` and `timestamp` fields in responses (just ignore them)
