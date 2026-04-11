# BRAIN System - Frontend Integration Guide

> Time Management & Gamification System
> Version: 1.0 | Date: 2026-03-22

---

## Architecture

```
Frontend App (React/Next.js)
  |
  +-- Supabase Client (direct reads, real-time subscriptions)
  |   |  URL: https://yrwrswyjawmgtxrgbnim.supabase.co
  |   |  Key: ANON_KEY (public, safe for frontend)
  |   |
  |   +-- platform_users          (read: display_name, avatar, timezone)
  |   +-- brain_user_profiles     (read: points, streak, level, wake/sleep)
  |   +-- brain_categories        (read: categories for dropdowns/buttons)
  |   +-- brain_activities        (read: activity log, date-filtered)
  |   +-- brain_activity_chains   (read: chain metadata)
  |   +-- brain_daily_scores      (read: daily scores, leaderboard)
  |   +-- brain_achievements      (read: earned/available achievements)
  |   +-- brain_timers            (read: active timer, SUBSCRIBE for real-time)
  |   +-- brain_settings          (read: system config for settings page)
  |   +-- brain_directive_points  (read: directive action point history)
  |
  +-- BRAIN-BRIDGE Webhook (all writes + calculations)
      POST https://n8n.carltonaiservices.com/webhook/brain-bridge
      Content-Type: application/json
      Body: { "operation": "...", "user_id": "uuid", "data": { ... } }
```

---

## User Identity (No Auth Required)

No Supabase Auth — users are identified by selecting from a user list:

```javascript
// On app load, fetch all platform users with BRAIN access
const { data: users } = await supabase
  .from('platform_users')
  .select('user_id, display_name, avatar_url')

// User selects their profile (or auto-selects if saved in localStorage)
const currentUserId = localStorage.getItem('brain_user_id') || users[0]?.user_id

// For productized version: replace with Supabase Auth registration flow
```

**User IDs:**
| User | UUID |
|------|------|
| Bradford | `00000000-0000-0000-0000-000000000001` |
| Dianna | `00000000-0000-0000-0000-000000000002` |
| Brianna | `00000000-0000-0000-0000-000000000003` |

---

## Supabase Tables Reference

| Table | Read Pattern | Purpose |
|-------|-------------|---------|
| `platform_users` | `WHERE user_id = ?` | User identity (shared with DEFT) |
| `brain_user_profiles` | `WHERE user_id = ?` | Points, streak, level, wake/sleep, calendar config |
| `brain_categories` | `WHERE user_id = ? AND is_active = true ORDER BY sort_order` | Category list |
| `brain_activities` | `WHERE user_id = ? AND started_at >= ? ORDER BY started_at DESC` | Activity log |
| `brain_activity_chains` | `WHERE chain_id = ?` | Chain metadata for grouped activities |
| `brain_daily_scores` | `WHERE user_id = ? AND score_date = ?` | Daily score for dashboard |
| `brain_daily_scores` | `JOIN platform_users ORDER BY total_points DESC` | Leaderboard |
| `brain_achievements` | `WHERE user_id = ?` | Achievement grid |
| `brain_timers` | `WHERE user_id = ?` | Active timer (subscribe for real-time) |
| `brain_settings` | `SELECT *` | System config (directive points, achievements, level formula) |
| `brain_directive_points` | `WHERE user_id = ? ORDER BY awarded_at DESC` | Point history from directive actions |

---

## n8n Workflows Reference

| Workflow | ID | Purpose |
|----------|----|---------|
| BRAIN-BRIDGE | `f3NTXVZcjeVJiymi` | Main router (webhook: `brain-bridge`) |
| BRAIN-PROFILE | `bNDxVmbFVl9nv36H` | Profile CRUD, categories, settings |
| BRAIN-ACTIVITIES | `buVehJdROV6KOPcX` | Activity logging, timer, chained events |
| BRAIN-SCORING | `h3vb1AzB4c97RrvZ` | Scores, streaks, achievements, leveling |
| BRAIN-ANALYTICS | `iVkEhcPSktICOmc0` | Charts, leaderboard, reports |
| BRAIN-CALENDAR | `4Fi7be0WU7WEIQn8` | Google Calendar CRUD + sync |
| BRAIN-AI | `c0dQG1gkBZD2Qae9` | NL parsing, suggestions, insights |
| BRAIN-NOTIFY | `p8wKI6U0sEP04ZeT` | Stale timer reminders (30-min schedule) |
| BRAIN-ERR | `RdrRSvPcRy7usTnI` | Error handler |

---

## API Helper Function

```javascript
async function brainApi(operation, userId, data = {}) {
  const res = await fetch('https://n8n.carltonaiservices.com/webhook/brain-bridge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, user_id: userId, data })
  })
  return res.json()
}

// Response format (all operations):
// { success: true, operation: "...", data: { ... }, timestamp: "ISO8601" }
// { success: false, error: "...", timestamp: "ISO8601" }
```

---

## Complete Operation Reference

### Profile Operations

```javascript
// Dashboard init: profile + categories + timer + today's summary
await brainApi('get_profile', userId)
// { profile: {...}, categories: [...], daily_summary: {...} }

// First-time registration
await brainApi('create_profile', userId, {
  display_name: 'Bradford',
  email: 'bradford@bradfordcarlton.com',
  daily_goal_points: 100,
  wake_time: '06:00',
  sleep_time: '22:00'
})

// Update settings
await brainApi('update_profile', userId, {
  daily_goal_points: 150,
  wake_time: '05:30',
  sleep_time: '23:00'
})

// Category management
await brainApi('get_categories', userId)
await brainApi('add_category', userId, {
  name: 'Meditation', slug: 'meditation',
  color: '#8B5CF6', icon: 'brain',
  points_per_minute: 2.0, bonus_multiplier: 1.0
})
await brainApi('update_category', userId, {
  category_id: 'uuid', points_per_minute: 3.0, color: '#10B981'
})
await brainApi('delete_category', userId, { category_id: 'uuid' })

// System settings (admin)
await brainApi('get_settings', userId)
await brainApi('update_settings', userId, {
  setting_key: 'directive_points',
  setting_value: { approve: 5, deny: 10, edit: 15, review_social: 3, review_email: 5, review_crm: 5 }
})
```

### Timer Operations

```javascript
// Start timer (one per user, pre-configured buttons per category)
await brainApi('start_timer', userId, {
  category_slug: 'exercise', title: 'Morning run'
})
// { success, timer_id, category, started_at }

// Get current timer
await brainApi('get_timer', userId)
// { timer: { timer_id, title, category_id, started_at, ... } | null }

// Stop timer (creates activity + calculates points)
await brainApi('stop_timer', userId, {
  notes: 'Good pace today', people: ['Dianna'], connections: []
})
// { success, activity_id, title, category, duration_min, points_earned }

// Cancel timer (no points)
await brainApi('cancel_timer', userId)
```

### Activity Operations

```javascript
// Log completed activity
await brainApi('log_activity', userId, {
  category_slug: 'business',
  title: 'Client strategy session',
  duration_min: 45,
  started_at: '2026-03-22T09:00:00-07:00',  // optional
  description: 'Q2 roadmap discussion',
  people: ['John Smith', 'Jane Doe'],
  connections: ['John Smith'],
  notes: 'Follow up next week'
})
// { success, activity_id, points_earned, category, duration_min }

// Get activities for date range
await brainApi('get_activities', userId, {
  start_date: '2026-03-22', end_date: '2026-03-22'
})

// Edit any field on past activity
await brainApi('edit_activity', userId, {
  activity_id: 'uuid', title: 'Updated', duration_min: 60,
  category_slug: 'study', notes: 'Changed category'
})

// Delete activity (recalculates scores)
await brainApi('delete_activity', userId, { activity_id: 'uuid' })
```

### Chained Events Operations

```javascript
// EVEN distribution: 3 activities across 3 hours = 60 min each
await brainApi('log_chain', userId, {
  chain_start: '2026-03-22T14:00:00-07:00',
  chain_end: '2026-03-22T17:00:00-07:00',
  distribution: 'even',
  activities: [
    { category_slug: 'exercise', title: 'Workout' },
    { category_slug: 'study', title: 'Reading' },
    { category_slug: 'household', title: 'Cleaning' }
  ]
})

// WEIGHTED distribution
await brainApi('log_chain', userId, {
  chain_start: '...', chain_end: '...',
  distribution: 'weighted',
  activities: [
    { category_slug: 'exercise', title: 'Workout', weight: 50 },
    { category_slug: 'study', title: 'Reading', weight: 30 },
    { category_slug: 'household', title: 'Cleaning', weight: 20 }
  ]
})

// MANUAL distribution (durations must sum to total)
await brainApi('log_chain', userId, {
  chain_start: '...', chain_end: '...',
  distribution: 'manual',
  activities: [
    { category_slug: 'exercise', title: 'Workout', duration_min: 90 },
    { category_slug: 'study', title: 'Reading', duration_min: 60 },
    { category_slug: 'household', title: 'Cleaning', duration_min: 30 }
  ]
})

// Adjust one activity in chain (siblings auto-redistribute)
await brainApi('update_chain_activity', userId, {
  activity_id: 'uuid', new_duration_min: 90
})
```

### Scoring Operations

```javascript
// Today's score
await brainApi('get_daily_score', userId, { date: '2026-03-22' })
// { date, total_points, total_minutes, activities_count, category_breakdown,
//   directive_points, daily_goal, daily_goal_met, goal_progress_pct }

// Streak info
await brainApi('get_streak', userId)
// { current_streak, longest_streak }

// Achievements
await brainApi('get_achievements', userId)
// { earned: [...], available: [...] }

// Level info
await brainApi('get_level_info', userId)
// { level, xp, xp_for_current_level, xp_for_next_level, progress_pct }
```

### Calendar Operations

```javascript
// Get Google Calendar events
await brainApi('get_events', userId, {
  start_date: '2026-03-22', end_date: '2026-03-28'
})
// { events: [{ event_id, title, start, end, duration_min, suggested_category, ... }] }

// Create/update/delete events
await brainApi('create_event', userId, {
  title: 'Meeting', start: 'ISO8601', end: 'ISO8601', description: '...'
})
await brainApi('update_event', userId, { event_id: 'gcal_id', title: 'Updated' })
await brainApi('delete_event', userId, { event_id: 'gcal_id' })

// Sync calendar event as BRAIN activity (earn points)
await brainApi('sync_event_to_activity', userId, {
  event_id: 'gcal_id', title: 'Team Meeting',
  duration_min: 60, start: 'ISO8601',
  category_slug: 'business'  // override auto-detected category
})
```

### Analytics Operations

```javascript
// Time-series for charts
await brainApi('get_analytics', userId, {
  metric: 'points',  // 'points' | 'minutes' | 'categories'
  start_date: '2026-03-15', end_date: '2026-03-22'
})
// { metric, period, series: [{date, value, goal_met}], stats: {total_points, avg_daily, ...} }

// Leaderboard
await brainApi('get_leaderboard', userId, { period: 'week' })
// { period, leaderboard: [{ display_name, avatar_url, level, period_points, active_days }] }

// Category summary (pie chart)
await brainApi('get_category_summary', userId, { start_date: '...', end_date: '...' })

// Weekly report
await brainApi('get_weekly_report', userId)
// { this_week, last_week, comparison: { points_diff, points_trend: 'up'|'down'|'flat' } }
```

### AI Operations

```javascript
// Natural language activity logging
await brainApi('smart_log', userId, {
  text: 'Just finished a 45 minute run with Dianna at the park'
})
// AI parses -> logs activity -> { parsed: {category, title, duration_min, people}, points_earned }

// Suggestions based on today's balance
await brainApi('suggest_activities', userId)
// { suggestions: [{ category, category_slug, color, reason }], daily_summary }

// Daily insight
await brainApi('daily_insight', userId)
// { insight: "You've earned 195 pts across 6 activities...", summary }
```

---

## Scoring Formula

```
points = duration_min * category.points_per_minute * category.bonus_multiplier
```

| Category | pts/min | Default 60 min |
|----------|---------|----------------|
| Business | 1.5 | 90 pts |
| Study | 1.5 | 90 pts |
| Exercise | 2.0 | 120 pts |
| Household | 1.0 | 60 pts |
| Family | 1.0 | 60 pts |
| General | 0.5 | 30 pts |

**Leveling:** `Level = floor(sqrt(total_xp / 100)) + 1`

**Achievements:** first_activity (10xp), streak_3 (25xp), streak_7 (50xp), streak_30 (200xp), 100_points_day (50xp), 500_points_day (100xp), all_categories (75xp), early_bird (15xp), marathon_session (30xp), social_butterfly (20xp)

---

## Real-Time Subscriptions

```javascript
// Timer state (critical for live stopwatch)
supabase.channel('brain-timer')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'brain_timers',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    if (payload.eventType === 'INSERT') showTimer(payload.new)
    if (payload.eventType === 'DELETE') hideTimer()
  })
  .subscribe()

// Daily score updates
supabase.channel('brain-scores')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'brain_daily_scores',
    filter: `user_id=eq.${userId}`
  }, (payload) => updateDashboard(payload.new))
  .subscribe()

// New activities
supabase.channel('brain-activities')
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'brain_activities',
    filter: `user_id=eq.${userId}`
  }, (payload) => prependActivity(payload.new))
  .subscribe()

// Achievement unlocked (toast notification)
supabase.channel('brain-achievements')
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'brain_achievements',
    filter: `user_id=eq.${userId}`
  }, (payload) => showAchievementToast(payload.new))
  .subscribe()
```

---

## Dashboard Pages Specification

### 1. Dashboard (Home)
- **Daily score ring**: circular progress (`goal_progress_pct`)
- **Active timer banner**: live stopwatch from `brain_timers.started_at` with stop button
- **Today's activities**: list from `brain_activities` grouped by category color
- **Category breakdown donut**: from `brain_daily_scores.category_breakdown`
- **Streak counter**: fire icon + `current_streak` days
- **Level badge**: level number + XP progress bar
- **Leaderboard snippet**: top 3 users
- **Quick actions**: start timer buttons per category

### 2. Timer Page
- **Category buttons grid**: one button per active category (name + icon + color)
- **Click to start**: calls `start_timer`, prompts for optional title
- **Active timer display**: large stopwatch, category color background
- **Stop button**: prompts for notes/people/connections
- **Cancel button**: no points awarded

### 3. Activity Log
- **Date picker**: filter by date/range
- **Activity cards**: title, category badge, duration, points, people tags, source badge
- **Edit/Delete**: all fields editable, delete recalculates scores
- **Chain badge**: activities with `chain_id` show chain icon, click to see/edit group
- **"Log Activity" button**: form with category, title, duration, time, people, notes
- **"Log Chain" button**: chained events wizard (time window + activities + distribution)

### 4. Calendar
- **Calendar view**: monthly/weekly/daily with Google Calendar events
- **Event cards**: title, time, duration, `suggested_category` badge
- **"Log as Activity" button**: per event, calls `sync_event_to_activity`
- **Already-linked badge**: green checkmark + points earned for synced events
- **Create/Edit/Delete**: standard calendar event CRUD

### 5. Leaderboard
- **Period tabs**: Today / This Week / This Month / All Time
- **User cards**: avatar, name, level badge, period points, active days, streak
- **Rank treatment**: gold/silver/bronze for top 3
- **Your position**: highlighted card for current user

### 6. Achievements
- **Grid of tiles**: icon, title, XP value
- **Earned**: full color with earned_at date
- **Unearned**: grayed out with progress indicator (e.g., "3/7 days" for streak_7)

### 7. Analytics
- **Points trend chart**: line chart with daily goal overlay
- **Category breakdown**: stacked bar chart
- **Minutes chart**: bar chart
- **Period selector**: 7/30/90 days or custom
- **Stats cards**: total points, avg daily, best day, days goal met
- **Weekly report**: AI comparison to prior week

### 8. Settings
- **Profile**: display name, avatar, timezone
- **Schedule**: wake time picker, sleep time picker
- **Daily goal**: number input
- **Categories**: sortable list with name, slug, color picker, icon picker, points/min, multiplier, active toggle, add/delete
- **Google Calendar**: calendar ID input, test connection
- **Directive Points (admin)**: table of action types + point values
- **Achievement Definitions (admin)**: list of achievement configs

---

## Directive Points Integration

When humans approve/deny/edit directives, CRM entries, social posts, or emails, the RDGR-DIRECTIVE-ACTION workflow automatically awards BRAIN points. The frontend can show a "points badge" on each reviewable item indicating how many points the action is worth.

**Point values** (configurable via settings page):
| Action | Default Points |
|--------|--------|
| Approve directive | 5 |
| Deny directive (with feedback) | 10 |
| Edit directive | 15 |
| Review social post | 3 |
| Review email | 5 |
| Review CRM contact | 5 |

---

## Command Chat Integration

Users can interact with BRAIN via the Command Chat (RDGR-CHAT) using natural language:

- "brain start timer exercise" -> starts exercise timer
- "brain log 30 min study" -> AI-parsed activity logging
- "brain score" -> today's score summary
- "brain leaderboard" -> current standings
- "brain stop timer" -> stops active timer

---

## Google Calendar

**Per-user calendars:**
| User | Calendar ID | Credential |
|------|------------|------------|
| Bradford | primary | `m4OhzejHgA6vvU1Z` |
| Dianna | primary | `tpf39SzYvlzpX53X` |
| Brianna | not connected | - |

The calendar credential ID is stored in `brain_user_profiles.google_credential_id`. The BRAIN-CALENDAR sub-workflow uses this to make authenticated Google Calendar API calls.

**Note:** Currently all calendar operations use Bradford's credential. Per-user credential selection requires the CALENDAR sub-workflow to dynamically choose credentials based on user_id (planned for v2).
