# Backend Handoff: BRAIN Habits & Tasks System

## Overview

The frontend for the BRAIN Habits & Tasks system has been built in `brain.html`. It adds a new "Habits" sub-tab with daily/weekly views, a task system with priority warming, day closure mechanics, and a dashboard progress widget. This document specifies what the backend needs to support.

---

## 1. New Supabase Tables

### `brain_habits`

```sql
CREATE TABLE brain_habits (
    habit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES platform_users(user_id),
    name TEXT NOT NULL,
    category_id UUID REFERENCES brain_categories(category_id),
    icon TEXT DEFAULT 'star',
    points_value NUMERIC DEFAULT 15,
    frequency TEXT DEFAULT 'daily',  -- 'daily', 'weekdays', 'weekends'
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_brain_habits_user ON brain_habits(user_id, is_active);
```

### `brain_habit_completions`

```sql
CREATE TABLE brain_habit_completions (
    completion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id UUID NOT NULL REFERENCES brain_habits(habit_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES platform_users(user_id),
    completion_date DATE NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT now(),
    actual_minutes INTEGER,  -- optional, if user expanded to log time
    notes TEXT,
    points_earned NUMERIC NOT NULL,
    activity_id UUID REFERENCES brain_activities(activity_id),
    UNIQUE(habit_id, completion_date)
);

CREATE INDEX idx_brain_habit_comp_user_date ON brain_habit_completions(user_id, completion_date);
```

### `brain_tasks`

```sql
CREATE TABLE brain_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES platform_users(user_id),
    title TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES brain_categories(category_id),
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    deadline DATE,
    scheduled_date DATE NOT NULL,
    status TEXT DEFAULT 'pending',  -- 'pending', 'completed', 'pushed'
    heat_level INTEGER DEFAULT 0,
    original_date DATE NOT NULL,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    points_earned NUMERIC,
    activity_id UUID REFERENCES brain_activities(activity_id),
    calendar_event_id TEXT,  -- Google Calendar event ID
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_brain_tasks_user_date ON brain_tasks(user_id, scheduled_date, status);
```

### `brain_task_rules`

```sql
CREATE TABLE brain_task_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES platform_users(user_id),  -- NULL = system default
    rule_key TEXT NOT NULL,
    rule_value JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, rule_key)
);

-- Seed system defaults
INSERT INTO brain_task_rules (user_id, rule_key, rule_value) VALUES
    (NULL, 'default_estimate_minutes', '{"value": 30}'),
    (NULL, 'ai_fill_prompt', '{"prompt": "Given a task title, estimate the duration in minutes and suggest the most appropriate category from the user''s available categories. Consider common task types: meetings (30-60min), emails (15min), phone calls (15-30min), documentation (45-60min), coding tasks (60-120min), quick fixes (15-20min)."}'),
    (NULL, 'category_defaults', '{"Business": 30, "Study": 45, "Exercise": 45, "Household": 20, "Family": 30, "General": 15}');
```

### `brain_day_closures`

```sql
CREATE TABLE brain_day_closures (
    closure_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES platform_users(user_id),
    closure_date DATE NOT NULL,
    total_items INTEGER NOT NULL,
    completed_items INTEGER NOT NULL,
    completion_pct NUMERIC NOT NULL,
    tasks_pushed INTEGER DEFAULT 0,
    closed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, closure_date)
);
```

### Enable Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE brain_habit_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE brain_tasks;
```

---

## 2. New BRAIN-BRIDGE Webhook Operations

All operations go through the existing `brain-bridge` webhook. Add these to the BRAIN-BRIDGE router:

### Habit Operations

#### `get_habits`
- **Input:** `{ user_id }`
- **Output:** `{ success: true, data: [habit objects] }`
- **Logic:** Select from `brain_habits` where `user_id` and `is_active = true`, order by `sort_order, created_at`

#### `add_habit`
- **Input:** `{ user_id, name, category_id?, icon, points_value, frequency, sort_order }`
- **Output:** `{ success: true, data: { habit_id } }`
- **Logic:** Insert into `brain_habits`

#### `update_habit`
- **Input:** `{ habit_id, name, category_id?, icon, points_value, frequency }`
- **Output:** `{ success: true }`
- **Logic:** Update `brain_habits` where `habit_id`

#### `delete_habit`
- **Input:** `{ habit_id }`
- **Output:** `{ success: true }`
- **Logic:** Set `is_active = false` on `brain_habits` (soft delete)

#### `complete_habit`
- **Input:** `{ habit_id, date, points?, actual_minutes?, notes? }`
- **Output:** `{ success: true, data: { points_earned, activity_id } }`
- **Logic:**
  1. Look up the habit to get `points_value` and `category_id`
  2. If `actual_minutes` provided AND category exists:
     - Calculate time-based points: `actual_minutes * category.points_per_minute * category.bonus_multiplier`
     - Award **whichever is higher**: fixed `points_value` OR time-based calculation
  3. Create a `brain_activities` row with `source = 'habit'`, duration = actual_minutes or 15 (default), points = calculated
  4. Insert into `brain_habit_completions` with the `activity_id`
  5. Update `brain_daily_scores` for the date
  6. Check streak/achievement triggers

#### `uncomplete_habit`
- **Input:** `{ habit_id, date }`
- **Output:** `{ success: true }`
- **Logic:**
  1. Find the `brain_habit_completions` row
  2. If it has an `activity_id`, delete the `brain_activities` row
  3. Delete the completion row
  4. Recalculate `brain_daily_scores` for the date

#### `update_habit_completion`
- **Input:** `{ habit_id, date, actual_minutes?, notes? }`
- **Output:** `{ success: true }`
- **Logic:**
  1. Update `brain_habit_completions` with `actual_minutes` and `notes`
  2. If `actual_minutes` changed, recalculate points (whichever-is-higher logic) and update the linked `brain_activities` row

#### `get_habit_completions`
- **Input:** `{ user_id, start_date, end_date }`
- **Output:** `{ success: true, data: [completion objects] }`

### Task Operations

#### `get_tasks`
- **Input:** `{ user_id, date }`
- **Output:** `{ success: true, data: [task objects] }`
- **Logic:** Select from `brain_tasks` where `user_id`, `scheduled_date = date`, `status != 'pushed'`, order by `heat_level DESC, deadline ASC NULLS LAST, created_at`

#### `add_task`
- **Input:** `{ user_id, title, description?, category_id?, estimated_minutes?, scheduled_date, deadline?, original_date }`
- **Output:** `{ success: true, data: { task_id } }`
- **Logic:**
  1. If `estimated_minutes` or `category_id` are null, call AI auto-fill (see `ai_fill_task`)
  2. Insert into `brain_tasks`

#### `update_task`
- **Input:** `{ task_id, title?, category_id?, estimated_minutes?, scheduled_date?, deadline?, notes? }`
- **Output:** `{ success: true }`

#### `delete_task`
- **Input:** `{ task_id }`
- **Output:** `{ success: true }`
- **Logic:**
  1. If task has `calendar_event_id`, delete the Google Calendar event
  2. If task has `activity_id`, delete the brain_activity
  3. Delete the task
  4. Recalculate daily scores if points were earned

#### `complete_task`
- **Input:** `{ task_id, actual_minutes? }`
- **Output:** `{ success: true, data: { points_earned, activity_id, calendar_event_id } }`
- **Logic:**
  1. Update task: `status = 'completed'`, `completed_at = now()`, `actual_minutes = actual_minutes || estimated_minutes`
  2. Calculate points: `duration * category.points_per_minute * category.bonus_multiplier` (or flat rate if no category)
  3. Create `brain_activities` row with `source = 'task'`
  4. **Create retroactive Google Calendar event:**
     - `end = completed_at`
     - `start = completed_at - estimated_minutes (or actual_minutes)`
     - Title = task title
     - If task already has `calendar_event_id`, update that event instead
  5. Store the `calendar_event_id` on the task
  6. Update `brain_daily_scores`
  7. Check achievement triggers

#### `uncomplete_task`
- **Input:** `{ task_id }`
- **Output:** `{ success: true }`
- **Logic:**
  1. If task has auto-created `calendar_event_id`, delete the calendar event
  2. If task has `activity_id`, delete the activity
  3. Reset: `status = 'pending'`, `completed_at = null`, `points_earned = null`, `activity_id = null`
  4. Recalculate `brain_daily_scores`

### Day Closure

#### `close_day`
- **Input:** `{ user_id, date }`
- **Output:** `{ success: true, data: { tasks_pushed, completion_pct } }`
- **Logic:**
  1. Find all `brain_tasks` where `user_id`, `scheduled_date = date`, `status = 'pending'`
  2. Calculate tomorrow's date
  3. For each pending task:
     - Increment `heat_level` by 1
     - Add deadline bonus:
       - If deadline exists and `deadline < today`: `heat_level += 3` (overdue)
       - If deadline exists and `deadline - today <= 1`: `heat_level += 2`
       - If deadline exists and `deadline - today <= 3`: `heat_level += 1`
     - Set `scheduled_date = tomorrow`
     - Set `updated_at = now()`
     - If task has `calendar_event_id`, update the calendar event to the new date
  4. Count habits: total active habits, completed today
  5. Count tasks: total tasks for date, completed
  6. Insert into `brain_day_closures`
  7. Return stats

#### `get_day_progress`
- **Input:** `{ user_id, date }`
- **Output:** `{ success: true, data: { total_habits, done_habits, total_tasks, done_tasks, completion_pct } }`

### AI Auto-Fill

#### `ai_fill_task`
- **Input:** `{ user_id, title, description? }`
- **Output:** `{ success: true, data: { estimated_minutes, category_id, priority } }`
- **Logic:**
  1. Load user's task rules from `brain_task_rules` (user-specific with system default fallback)
  2. Load user's categories from `brain_categories`
  3. Send to OpenAI/Claude with the AI fill prompt from rules + task title + category list
  4. Parse response for estimated_minutes, suggested category_id, priority level
  5. Apply `default_estimate_minutes` and `category_defaults` as fallbacks if AI doesn't return values

### Task Rules

#### `get_task_rules`
- **Input:** `{ user_id }`
- **Output:** `{ success: true, data: { default_estimate_minutes, ai_fill_prompt, category_defaults } }`
- **Logic:** Select from `brain_task_rules` where `user_id` or `user_id IS NULL`, merge (user overrides system)

#### `update_task_rules`
- **Input:** `{ user_id, rule_key, rule_value }`
- **Output:** `{ success: true }`
- **Logic:** Upsert into `brain_task_rules`

---

## 3. Multi-Source Task Creation

Tasks can be created from multiple entry points. All should use the `add_task` operation:

### Source 1: Direct (Habits View)
User clicks "+ Task" in the Habits view. Frontend sends `add_task` with user-provided fields. Missing fields get AI auto-filled.

### Source 2: Chat
When the chat system detects a task-like intent (e.g., "I need to send the proposal by Friday"), it should call `add_task` with:
- `title` extracted from the message
- `deadline` if mentioned
- Let AI auto-fill the rest

### Source 3: Directives / Project Tasks
When a directive or project creates an actionable task, it should call `add_task` with:
- `title` from the directive/task description
- `category_id` matching the directive's domain
- `deadline` from the directive's due date
- `scheduled_date` = today or the directive's start date

---

## 4. New Achievements

Add these to the `brain_settings` achievements list:

| Key | Name | Description | XP |
|-----|------|-------------|-----|
| `habit_streak_7` | Week Warrior | Complete any habit 7 days in a row | 50 |
| `habit_streak_30` | Monthly Master | Complete any habit 30 days in a row | 200 |
| `perfect_day` | Perfect Day | Complete 100% of habits and tasks in a single day | 75 |
| `task_crusher` | Task Crusher | Complete 10+ tasks in a single day | 100 |

---

## 5. Integration with Existing Workflows

### BRAIN-SCORING Sub-workflow
- Must handle new activity sources: `'habit'` and `'task'`
- Habit streak calculation: count consecutive days with completions for a specific habit
- Day closure should NOT break the activity streak (it's a different concept — activity streak = any brain activity logged)

### BRAIN-CALENDAR Sub-workflow
- `complete_task` creates retroactive calendar events
- `close_day` may need to update calendar events for pushed tasks
- Use the user's Google credential from `brain_user_profiles.google_credential_id`

### BRAIN-NOTIFY Sub-workflow
- Consider adding a daily reminder to close the day (e.g., at user's configured sleep time)
- Consider reminding about overdue tasks (heat_level >= 5)

---

## 6. Frontend Data Access Patterns

The frontend reads these tables directly via Supabase REST API (PostgREST):

| Table | Operations | Filter Pattern |
|-------|-----------|----------------|
| `brain_habits` | SELECT | `user_id=eq.{id}&is_active=eq.true` |
| `brain_habit_completions` | SELECT, POST, PATCH, DELETE | `user_id=eq.{id}&completion_date=gte.{start}&completion_date=lte.{end}` |
| `brain_tasks` | SELECT, POST, PATCH, DELETE | `user_id=eq.{id}&scheduled_date=eq.{date}&status=neq.pushed` |
| `brain_task_rules` | SELECT, POST, PATCH | `or=(user_id.eq.{id},user_id.is.null)` |
| `brain_day_closures` | SELECT, POST | `user_id=eq.{id}&closure_date=eq.{date}` |

**RLS Policies needed:** All tables should have Row Level Security policies matching the user_id pattern used by the anon key. Since this system uses a shared anon key with user_id filtering, at minimum ensure the tables are accessible via the anon role.

---

## 7. Realtime Subscriptions

The frontend subscribes to these Supabase realtime channels:

```javascript
// Habit completions (INSERT, UPDATE, DELETE)
supabaseClient.channel('brain-habit-completions-' + userId)
    .on('postgres_changes', {
        event: '*', schema: 'public', table: 'brain_habit_completions',
        filter: `user_id=eq.${userId}`
    }, callback)

// Tasks (INSERT, UPDATE, DELETE)
supabaseClient.channel('brain-tasks-' + userId)
    .on('postgres_changes', {
        event: '*', schema: 'public', table: 'brain_tasks',
        filter: `user_id=eq.${userId}`
    }, callback)
```

Ensure these tables are added to the `supabase_realtime` publication.
