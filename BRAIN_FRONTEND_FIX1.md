# BRAIN Frontend Developer Handoff


> Updated: 2026-03-22 | Status: Backend 14/14 operations passing
> This supersedes BRAIN_FRONTEND_FIX1.md


---


## What changed since your last build


The backend is now fully operational. All 14 operations pass E2E testing. Here's what was
fixed:


1. **Switch node routing** -- all sub-workflows now use Switch v2 (v3.4 had a bug routing
   everything to output 0)
2. **Code node mode** -- all converted from `runOnceForEachItem` (crashes task runner with
   empty input) to `runOnceForAllItems` with `$input.all()` + try/catch
3. **Supabase Query dependency** -- this is the critical one (see below)


### Known fragility: Supabase Query utility


ALL backend operations depend on workflow `IWfIRcWfFHDD8PV6` (webhook: `supabase-query`)
being active. If another developer deactivates it or it errors out, EVERY BRAIN operation
returns `{"error": "Node execution failed"}`. This is why the webhook was completely broken
when you tested.


**Your direct-Supabase-read approach was the right call and should remain the primary data
access pattern.** The webhook should be used only for operations that genuinely need
server-side logic.


---


## Architecture: Hybrid reads + webhook writes


```
READS (fast, reliable -- use these for all display):
  Frontend --> Supabase PostgREST (anon key) --> brain_* tables


WRITES (use webhook only when server-side logic is needed):
  Frontend --> POST /webhook/brain-bridge --> n8n sub-workflows --> Supabase
```


### Why this hybrid approach


| Approach | Pro | Con |
|----------|-----|-----|
| Direct Supabase reads | Always works, fast, real-time subscriptions | Can't do calculations |
| Webhook writes | Points, achievements, streaks, AI, Google Calendar | Depends on n8n uptime + supabase-query utility |


---


## Supabase connection


```javascript
const SUPABASE_URL = 'https://yrwrswyjawmgtxrgbnim.supabase.co'
const SUPABASE_ANON_KEY = '<your anon key>'  // public, safe for frontend


const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```


## Users


| User | UUID | Calendar |
|------|------|----------|
| Bradford | `00000000-0000-0000-0000-000000000001` | Connected |
| Dianna | `00000000-0000-0000-0000-000000000002` | Connected |
| Brianna | `00000000-0000-0000-0000-000000000003` | Not connected |


```javascript
// User selection (no auth, localStorage persistence)
const USERS = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Bradford' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Dianna' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Brianna' },
]
const currentUserId = localStorage.getItem('brain_user_id') || USERS[0].id
```


---


## Data access: what to read directly vs what needs the webhook


### DIRECT SUPABASE READS (use these for all display)


```javascript
// Profile
const { data: profile } = await supabase
  .from('brain_user_profiles')
  .select('*')
  .eq('user_id', userId)
  .single()


// Platform user info (display_name, avatar, timezone)
const { data: platformUser } = await supabase
  .from('platform_users')
  .select('display_name, avatar_url, timezone')
  .eq('user_id', userId)
  .single()


// Categories (IMPORTANT: filter by user_id -- table has all users' categories)
const { data: categories } = await supabase
  .from('brain_categories')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true)
  .order('sort_order')


// Active timer
const { data: timer } = await supabase
  .from('brain_timers')
  .select('*, brain_categories(name, slug, color, icon)')
  .eq('user_id', userId)
  .maybeSingle()


// Today's activities
const today = new Date().toISOString().split('T')[0]
const { data: activities } = await supabase
  .from('brain_activities')
  .select('*, brain_categories(name, slug, color, icon)')
  .eq('user_id', userId)
  .gte('started_at', `${today}T00:00:00`)
  .order('started_at', { ascending: false })


// Today's score
const { data: dailyScore } = await supabase
  .from('brain_daily_scores')
  .select('*')
  .eq('user_id', userId)
  .eq('score_date', today)
  .maybeSingle()


// Achievements
const { data: achievements } = await supabase
  .from('brain_achievements')
  .select('*')
  .eq('user_id', userId)
  .order('earned_at', { ascending: false })


// Settings (achievement definitions, directive points config)
const { data: settings } = await supabase
  .from('brain_settings')
  .select('*')


// Leaderboard (all users' profiles sorted by points)
const { data: leaderboard } = await supabase
  .from('brain_user_profiles')
  .select('user_id, total_points, current_streak, longest_streak, level, xp')
  .order('total_points', { ascending: false })
// Join with platform_users for display_name:
const { data: allUsers } = await supabase
  .from('platform_users')
  .select('user_id, display_name, avatar_url')


// Historical scores (for charts)
const { data: scoreHistory } = await supabase
  .from('brain_daily_scores')
  .select('*')
  .eq('user_id', userId)
  .gte('score_date', startDate)
  .lte('score_date', endDate)
  .order('score_date')


// Directive points history
const { data: directivePoints } = await supabase
  .from('brain_directive_points')
  .select('*')
  .eq('user_id', userId)
  .order('awarded_at', { ascending: false })
```


### DIRECT SUPABASE WRITES (safe to do from frontend)


These operations don't require server-side calculations:


```javascript
// Start timer (just an INSERT -- no points involved)
await supabase.from('brain_timers').insert({
  user_id: userId,
  category_id: selectedCategoryId,
  title: timerTitle || 'Untitled Activity',
  started_at: new Date().toISOString(),
  notes: null,
  people: null
})


// Cancel timer (just a DELETE -- no points involved)
await supabase.from('brain_timers').delete().eq('user_id', userId)


// Update profile settings
await supabase.from('brain_user_profiles').update({
  daily_goal_points: newGoal,
  wake_time: newWakeTime,
  sleep_time: newSleepTime
}).eq('user_id', userId)


// Update platform user info
await supabase.from('platform_users').update({
  display_name: newName,
  timezone: newTimezone
}).eq('user_id', userId)


// Add category
await supabase.from('brain_categories').insert({
  user_id: userId,
  name: 'Meditation', slug: 'meditation',
  color: '#8B5CF6', icon: 'brain',
  points_per_minute: 2.0, bonus_multiplier: 1.0,
  sort_order: 99
})


// Update category
await supabase.from('brain_categories').update({
  points_per_minute: 3.0, color: '#10B981'
}).eq('category_id', catId)


// Soft-delete category
await supabase.from('brain_categories').update({
  is_active: false
}).eq('category_id', catId)


// Update settings (admin)
await supabase.from('brain_settings').update({
  setting_value: newValue,
  updated_by: 'dashboard'
}).eq('setting_key', 'directive_points')
```


### WEBHOOK-ONLY OPERATIONS (need server-side logic)


```javascript
const BRAIN_WEBHOOK = 'https://n8n.carltonaiservices.com/webhook/brain-bridge'


async function brainApi(operation, userId, data = {}) {
  try {
    const res = await fetch(BRAIN_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, user_id: userId, data })
    })
    const json = await res.json()
    if (json.error === 'Node execution failed') {
      throw new Error('Backend unavailable')
    }
    return json
  } catch (err) {
    console.warn(`BRAIN webhook ${operation} failed:`, err.message)
    return { success: false, error: err.message, fallback: true }
  }
}
```


**Operations that MUST go through webhook:**


```javascript
// STOP TIMER -- calculates points, updates daily score, profile totals
// Returns: { success, operation, data: {}, timestamp }
// NOTE: data object is empty in current response -- read updated values from Supabase after
const result = await brainApi('stop_timer', userId, {
  notes: 'Session notes here',
  people: ['Person 1'],      // optional
  connections: ['New contact'] // optional
})
// After stop_timer succeeds, re-fetch from Supabase:
//   brain_user_profiles (updated total_points, xp)
//   brain_daily_scores (updated totals)
//   brain_activities (new activity row)


// LOG ACTIVITY -- calculates points based on category rate
// Returns: { success, operation, data: {}, timestamp }
const result = await brainApi('log_activity', userId, {
  category_slug: 'business',    // required
  title: 'Client meeting',       // required
  duration_min: 45,              // required
  started_at: '2026-03-22T09:00:00-07:00', // optional, defaults to now - duration
  description: 'Optional details',
  people: ['John Smith'],
  connections: ['John Smith'],
  notes: 'Follow up next week'
})


// LOG CHAIN -- distributes time across multiple activities
const result = await brainApi('log_chain', userId, {
  chain_start: '2026-03-22T14:00:00-07:00',
  chain_end: '2026-03-22T17:00:00-07:00',
  distribution: 'even',  // 'even' | 'weighted' | 'manual'
  activities: [
    { category_slug: 'exercise', title: 'Workout' },
    { category_slug: 'study', title: 'Reading' },
    { category_slug: 'household', title: 'Cleaning' }
  ]
})


// SMART LOG -- AI parses natural language into activity
const result = await brainApi('smart_log', userId, {
  text: 'Just finished a 45 minute run with Dianna'
})
// Returns: { success, data: { parsed: {category, title, duration_min, people}, activity: {...} } }


// SUGGEST ACTIVITIES -- AI recommendations based on today's balance
const result = await brainApi('suggest_activities', userId)
// Returns: { success, data: { suggestions: [{category, category_slug, color, reason}], daily_summary: {...} } }


// DAILY INSIGHT -- AI-generated text summary
const result = await brainApi('daily_insight', userId)
// Returns: { success, data: { insight: "text...", summary: {...} } }


// GET EVENTS -- Google Calendar (requires OAuth credential on backend)
const result = await brainApi('get_events', userId, {
  start_date: '2026-03-22',
  end_date: '2026-03-28'
})
// Returns: { success, data: { events: [{event_id, title, start, end, duration_min, suggested_category}] } }


// SYNC EVENT TO ACTIVITY -- converts calendar event to scored activity
const result = await brainApi('sync_event_to_activity', userId, {
  event_id: 'gcal_event_id',
  title: 'Team Meeting',
  duration_min: 60,
  start: '2026-03-22T09:00:00-07:00',
  category_slug: 'business'
})


// CREATE/UPDATE/DELETE CALENDAR EVENTS
await brainApi('create_event', userId, {
  title: 'Meeting', start: 'ISO8601', end: 'ISO8601', description: '...'
})
await brainApi('update_event', userId, { event_id: 'gcal_id', title: 'New title' })
await brainApi('delete_event', userId, { event_id: 'gcal_id' })


// AWARD DIRECTIVE POINTS (typically called by other workflows, not frontend)
await brainApi('award_directive_points', userId, {
  directive_id: 'DIR-123', action_type: 'approve', description: 'Approved task'
})
```


### FRONTEND FALLBACK for stop_timer


If the webhook is down, your current client-side points calculation is fine as a fallback.
The formula is:


```javascript
function calculatePoints(durationMin, category) {
  return Math.round(durationMin * category.points_per_minute * category.bonus_multiplier * 10) / 10
}


// Fallback stop_timer (when webhook fails):
async function stopTimerFallback(userId, timer, category, notes) {
  const now = new Date()
  const durationMin = Math.max(1, Math.round((now - new Date(timer.started_at)) / 60000))
  const points = calculatePoints(durationMin, category)


  // Insert activity
  await supabase.from('brain_activities').insert({
    user_id: userId,
    category_id: timer.category_id,
    title: timer.title,
    duration_min: durationMin,
    started_at: timer.started_at,
    ended_at: now.toISOString(),
    status: 'completed',
    points_earned: points,
    notes: notes,
    source: 'timer'
  })


  // Update profile totals
  await supabase.rpc('exec_sql', {
    query: `UPDATE brain_user_profiles SET total_points = total_points + ${points}, xp = xp + ${points} WHERE user_id = '${userId}'`
  })


  // Delete timer
  await supabase.from('brain_timers').delete().eq('user_id', userId)


  // NOTE: This fallback skips achievement checks, streak updates, and daily score
  // recalculation. Those will catch up next time the webhook works.
}
```


---


## Real-time subscriptions


```javascript
// Timer changes (critical for live stopwatch across tabs/devices)
supabase.channel('brain-timer')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'brain_timers',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    if (payload.eventType === 'INSERT') startStopwatch(payload.new)
    if (payload.eventType === 'DELETE') stopStopwatch()
  })
  .subscribe()


// New activities (live feed on dashboard)
supabase.channel('brain-activities')
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'brain_activities',
    filter: `user_id=eq.${userId}`
  }, (payload) => addActivityToList(payload.new))
  .subscribe()


// Score updates
supabase.channel('brain-scores')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'brain_daily_scores',
    filter: `user_id=eq.${userId}`
  }, (payload) => updateScoreDisplay(payload.new))
  .subscribe()


// Achievement unlocked (show toast/modal)
supabase.channel('brain-achievements')
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'brain_achievements',
    filter: `user_id=eq.${userId}`
  }, (payload) => showAchievementToast(payload.new))
  .subscribe()
```


---


## Scoring system


```
points = duration_min x points_per_minute x bonus_multiplier
```


| Category | pts/min | Color | Icon |
|----------|---------|-------|------|
| Business | 1.5 | #2563EB | briefcase |
| Study | 1.5 | #7C3AED | book |
| Exercise | 2.0 | #16A34A | dumbbell |
| Household | 1.0 | #EA580C | home |
| Family | 1.0 | #DC2626 | heart |
| General | 0.5 | #6B7280 | clock |


**Leveling:** `level = Math.floor(Math.sqrt(xp / 100)) + 1`
**XP for next level:** `(level) ^ 2 * 100`


**Achievements** (from `brain_settings` where `setting_key = 'achievement_definitions'`):


| Key | Title | XP | Condition |
|-----|-------|-----|-----------|
| first_activity | First Steps | 10 | Log 1 activity |
| streak_3 | Hat Trick | 25 | 3-day streak |
| streak_7 | Weekly Warrior | 50 | 7-day streak |
| streak_30 | Monthly Master | 200 | 30-day streak |
| 100_points_day | Century | 50 | 100+ pts in a day |
| 500_points_day | Five Hundred Club | 100 | 500+ pts in a day |
| all_categories | Well Rounded | 75 | Activity in every category in one day |
| early_bird | Early Bird | 15 | Activity before 6 AM |
| marathon_session | Marathon | 30 | 120+ min single activity |
| social_butterfly | Social Butterfly | 20 | 5+ people in one activity |


**Daily goal:** stored in `brain_user_profiles.daily_goal_points` (default 100)
**Streak:** consecutive days where `brain_daily_scores.daily_goal_met = true`


---


## Dashboard pages


### 1. Home Dashboard
- Daily score ring (progress toward `daily_goal_points`)
- Active timer banner with live stopwatch (subscribe to `brain_timers`)
- Today's activity feed (from `brain_activities`)
- Category breakdown donut chart (from `brain_daily_scores.category_breakdown`)
- Streak fire icon + counter
- Level badge + XP progress bar
- Quick-start timer buttons (one per category, colored)


### 2. Timer
- Grid of category buttons (name, icon, color from `brain_categories`)
- Click: prompts for title, calls start_timer (direct Supabase INSERT)
- Running timer: large stopwatch, category color background
- Stop: prompts for notes/people, calls webhook `stop_timer`
- Cancel: direct Supabase DELETE on `brain_timers`


### 3. Activity Log
- Date range picker
- Cards: title, category badge (color), duration, points, people tags, source badge
- Edit button: all fields editable (direct Supabase UPDATE, then webhook `recalculate_day`)
- Delete: direct Supabase DELETE + webhook `recalculate_day`
- "Log Activity" form: category dropdown, title, duration, time, people, notes -> webhook
- "Log Chain" wizard: time window + add activities + choose distribution -> webhook
- Chain badge on grouped activities (filter by `chain_id`)


### 4. Calendar
- Month/week/day view populated from webhook `get_events`
- "Log as Activity" button per event -> webhook `sync_event_to_activity`
- Green checkmark on events already linked (check `brain_activities.calendar_event_id`)
- Event CRUD via webhook


### 5. Leaderboard
- Period tabs: Today / Week / Month / All Time
- For Today/Week/Month: aggregate from `brain_daily_scores` with date range filter
- For All Time: read `brain_user_profiles.total_points` directly
- Join with `platform_users` for display names
- Gold/silver/bronze for top 3


### 6. Achievements
- Grid layout. Read definitions from `brain_settings` where `setting_key = 'achievement_definitions'`
- Earned: full color, date shown (from `brain_achievements`)
- Unearned: grayed out, show progress where possible


### 7. Analytics
- Points trend line chart (from `brain_daily_scores` over date range)
- Category stacked bar chart (from `category_breakdown` JSON field)
- Period selector: 7d / 30d / 90d
- Stats cards: total points, avg daily, best day, days goal met
- Weekly comparison (this week vs last week from `brain_daily_scores`)


### 8. Settings
- Profile: display_name, avatar, timezone (direct Supabase writes)
- Schedule: wake_time, sleep_time pickers (direct Supabase writes)
- Daily goal: number input (direct Supabase write)
- Categories: sortable list, each with name/slug/color/icon/pts_per_min/multiplier
  (direct Supabase writes for add/edit/delete)
- Google Calendar ID input (stored in `brain_user_profiles.google_calendar_id`)
- Directive point values (admin, from `brain_settings`)


---


## Important data quirks


1. **Categories return ALL users** -- `get_categories` via webhook returns all 18 (6 per
   user). Always filter `WHERE user_id = currentUserId` client-side, or use the direct
   Supabase query with `.eq('user_id', userId)`.


2. **stop_timer and log_activity webhook responses have empty `data: {}`** -- the operation
   succeeds but returns no detail. Re-read from Supabase after these calls to get the
   updated activity/score/profile.


3. **Timer: one per user** -- `brain_timers` has `UNIQUE(user_id)`. Starting a timer when
   one is running will fail. Check for existing timer before starting.


4. **Timezone** -- all `started_at`/`ended_at` are stored as UTC (`timestamptz`). The RPCs
   use `America/Los_Angeles` for date calculations. Display times in the user's
   `platform_users.timezone`.


5. **chain_id** -- activities that are part of a chained event group share a `chain_id`.
   Use this to group them visually and enable the "edit chain" feature.


---


## Webhook health check


Before relying on the webhook, do a quick health check:


```javascript
async function isBrainWebhookHealthy() {
  try {
    const res = await fetch(BRAIN_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'get_settings',
        user_id: '00000000-0000-0000-0000-000000000001',
        data: {}
      }),
      signal: AbortSignal.timeout(5000)
    })
    const json = await res.json()
    return json.success === true
  } catch {
    return false
  }
}


// On app load:
const webhookAvailable = await isBrainWebhookHealthy()
// If false, disable AI features and calendar, use fallback for stop_timer
```


---


## Test commands (verify backend works)


```bash
# Quick health check
curl -s -X POST "https://n8n.carltonaiservices.com/webhook/brain-bridge" \
  -H "Content-Type: application/json" \
  -d '{"operation":"get_settings","user_id":"00000000-0000-0000-0000-000000000001","data":{}}'


# Start timer
curl -s -X POST "https://n8n.carltonaiservices.com/webhook/brain-bridge" \
  -H "Content-Type: application/json" \
  -d '{"operation":"start_timer","user_id":"00000000-0000-0000-0000-000000000001","data":{"category_slug":"business","title":"Test"}}'


# Stop timer
curl -s -X POST "https://n8n.carltonaiservices.com/webhook/brain-bridge" \
  -H "Content-Type: application/json" \
  -d '{"operation":"stop_timer","user_id":"00000000-0000-0000-0000-000000000001","data":{}}'


# Get daily score
curl -s -X POST "https://n8n.carltonaiservices.com/webhook/brain-bridge" \
  -H "Content-Type: application/json" \
  -d '{"operation":"get_daily_score","user_id":"00000000-0000-0000-0000-000000000001","data":{}}'
```


If any of these return `{"error":"Node execution failed"}`, the Supabase Query utility
workflow (`IWfIRcWfFHDD8PV6`) has gone inactive. Reactivate it in the n8n dashboard.



