# DEFT Frontend Integration Guide

Complete guide for frontend developers building the Diet, Exercise, Food Tracker UI.

---

## Architecture Overview

```
Frontend App (React/Next.js/etc.)
    |
    ├── Direct Supabase Reads (real-time, fast)
    │   └── @supabase/supabase-js client
    │
    └── DEFT-BRIDGE Webhook (writes, calculations, AI)
        └── POST https://n8n.carltonaiservices.com/webhook/deft-bridge
```

**Reads**: Direct from Supabase (instant, supports real-time subscriptions)
**Writes/Logic**: Through DEFT-BRIDGE webhook (ensures business logic, atomic operations)

---

## Authentication

### Supabase Auth Setup

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://yrwrswyjawmgtxrgbnim.supabase.co',
  'YOUR_ANON_KEY'  // Supabase anon/public key (NOT service role key)
)

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password'
})

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password'
})

// Magic link (passwordless)
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com'
})

// Get current session
const { data: { session } } = await supabase.auth.getSession()
// session.access_token = JWT for API calls
// session.user.id = UUID (matches user_id in all DEFT tables)
```

### Calling DEFT-BRIDGE with Auth

```javascript
const response = await fetch('https://n8n.carltonaiservices.com/webhook/deft-bridge', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    operation: 'log_meal',
    user_id: session.user.id,
    data: { recipe_id: '...', servings: 1, meal_type: 'lunch' }
  })
})
const result = await response.json()
```

---

## Supabase Tables (Direct Read Access)

All tables have Row-Level Security (RLS). Users can only read their own data.
The `deft_food_database` table is public-read (shared across all users).

### Table Schema Reference

#### `deft_user_profiles`
| Column | Type | Description |
|--------|------|-------------|
| `user_id` | uuid (PK) | = auth.uid() |
| `email` | text | User email |
| `display_name` | text | Display name |
| `height_inches` | numeric | Height in inches |
| `current_weight_lbs` | numeric | Current weight |
| `target_weight_lbs` | numeric | Goal weight |
| `age` | integer | Age in years |
| `sex` | text | 'male' or 'female' |
| `activity_level` | text | sedentary/lightly_active/moderately_active/very_active/extra_active |
| `diet_type` | text | keto/standard/low_carb/paleo/zone/custom |
| `macro_targets` | jsonb | `{ calories, fat_g, protein_g, net_carbs_g, fiber_g, sugar_limit_g }` |
| `meal_count_default` | integer | Default meals per day |
| `preferences` | jsonb | `{ timezone, unit_system, allergens[], avoid_ingredients[] }` |

#### `deft_recipes`
| Column | Type | Description |
|--------|------|-------------|
| `recipe_id` | uuid (PK) | Auto-generated |
| `user_id` | uuid (FK) | Owner |
| `name` | text | Recipe name |
| `servings` | numeric | Total servings |
| `nutrition_per_serving` | jsonb | Per-serving nutrition (see Nutrition JSONB below) |
| `keto_analysis` | jsonb | `{ is_keto_friendly, net_carb_rating, fat_calories_pct }` |
| `tags` | text[] | Array of tags |
| `is_favorite` | boolean | Favorited |
| `status` | text | 'active' or 'archived' |

#### `deft_ingredients`
| Column | Type | Description |
|--------|------|-------------|
| `ingredient_id` | uuid (PK) | Auto-generated |
| `recipe_id` | uuid (FK) | Parent recipe |
| `name` | text | Ingredient name |
| `quantity` | numeric | Amount |
| `unit` | text | g, oz, cup, tbsp, tsp, piece, ml, lb |
| `nutrition` | jsonb | Nutrition for this ingredient amount |
| `sort_order` | integer | Display order |

#### `deft_daily_logs`
| Column | Type | Description |
|--------|------|-------------|
| `log_id` | uuid (PK) | Auto-generated |
| `user_id` | uuid (FK) | Owner |
| `log_date` | date | Calendar date |
| `weight_lbs` | numeric | Morning weigh-in |
| `target_calories` | numeric | Calorie target for the day |
| `target_macros` | jsonb | Snapshot of macro targets |
| `consumed_totals` | jsonb | Running totals: `{ calories, fat_g, protein_g, net_carbs_g, fiber_g, sugar_g }` |
| `exercise_calories` | numeric | Total calories burned |
| `meal_count_planned` | integer | Planned meals |
| `meals_logged` | integer | Logged so far |
| `adherence_score` | numeric | 0-100 end-of-day score |
| `water_oz` | numeric | Water intake |

#### `deft_meal_entries`
| Column | Type | Description |
|--------|------|-------------|
| `meal_id` | uuid (PK) | Auto-generated |
| `log_id` | uuid (FK) | Parent daily log |
| `user_id` | uuid | Owner |
| `meal_type` | text | breakfast/lunch/dinner/snack |
| `meal_number` | integer | 1-based meal count |
| `recipe_id` | uuid (FK) | Linked recipe |
| `recipe_name` | text | Denormalized name |
| `servings_consumed` | numeric | How much eaten |
| `nutrition_consumed` | jsonb | Actual nutrition after portion |
| `logged_at` | timestamptz | When logged |

#### `deft_exercise_entries`
| Column | Type | Description |
|--------|------|-------------|
| `exercise_id` | uuid (PK) | Auto-generated |
| `log_id` | uuid (FK) | Parent daily log |
| `exercise_type` | text | cardio/strength/flexibility/sports/other |
| `exercise_name` | text | e.g., "Running" |
| `duration_min` | integer | Duration |
| `calories_burned` | numeric | Calories burned |
| `intensity` | text | low/moderate/high/max |
| `details` | jsonb | `{ distance_miles, sets, reps, weight_lbs, heart_rate_avg }` |

#### `deft_weight_history`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `user_id` | uuid (FK) | Owner |
| `weigh_date` | date | Date of weigh-in |
| `weight_lbs` | numeric | Weight |
| `body_fat_pct` | numeric | Optional body fat % |

#### `deft_food_database` (PUBLIC READ)
| Column | Type | Description |
|--------|------|-------------|
| `food_id` | uuid (PK) | Auto-generated |
| `name` | text | Food name |
| `brand` | text | Brand (if any) |
| `serving_size` | text | "4 oz", "1 cup", etc. |
| `nutrition_per_serving` | jsonb | Nutrition data |
| `category` | text | protein/dairy/fat/nuts/vegetable/condiment/beverage/keto_specialty/fruit |
| `is_keto_friendly` | boolean | Keto filter |
| `keto_tier` | text | excellent/good/moderate/avoid |

### Nutrition JSONB Structure

Used in `nutrition_per_serving`, `nutrition_consumed`, `nutrition`, etc.:

```json
{
  "calories": 450,
  "total_fat_g": 35,
  "saturated_fat_g": 12,
  "cholesterol_mg": 85,
  "sodium_mg": 620,
  "total_carbs_g": 8,
  "fiber_g": 3,
  "sugar_g": 2,
  "net_carbs_g": 5,
  "protein_g": 28,
  "potassium_mg": 450,
  "calcium_mg": 120,
  "iron_mg": 3
}
```

**Key formula**: `net_carbs_g = total_carbs_g - fiber_g`

---

## Direct Supabase Queries (Read)

### Today's Dashboard

```javascript
// Get today's daily log
const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
const { data: dailyLog } = await supabase
  .from('deft_daily_logs')
  .select('*')
  .eq('log_date', today)
  .single()

// Get today's meals
const { data: meals } = await supabase
  .from('deft_meal_entries')
  .select('*, deft_recipes(name, nutrition_per_serving)')
  .gte('logged_at', `${today}T00:00:00`)
  .lt('logged_at', `${tomorrow}T00:00:00`)
  .order('logged_at', { ascending: true })

// Get today's exercises
const { data: exercises } = await supabase
  .from('deft_exercise_entries')
  .select('*')
  .gte('logged_at', `${today}T00:00:00`)
  .lt('logged_at', `${tomorrow}T00:00:00`)
```

### Recipe Browser

```javascript
// All active recipes
const { data: recipes } = await supabase
  .from('deft_recipes')
  .select('recipe_id, name, servings, nutrition_per_serving, keto_analysis, tags, is_favorite')
  .eq('status', 'active')
  .order('name')

// Recipe with ingredients
const { data: recipe } = await supabase
  .from('deft_recipes')
  .select('*, deft_ingredients(*)')
  .eq('recipe_id', recipeId)
  .single()

// Search by name (fuzzy)
const { data } = await supabase
  .from('deft_recipes')
  .select('*')
  .textSearch('name', query)
  .eq('status', 'active')

// Filter by tag
const { data } = await supabase
  .from('deft_recipes')
  .select('*')
  .contains('tags', ['keto'])
```

### Weight Chart Data

```javascript
const { data: weights } = await supabase
  .from('deft_weight_history')
  .select('weigh_date, weight_lbs, body_fat_pct')
  .gte('weigh_date', startDate)
  .lte('weigh_date', endDate)
  .order('weigh_date', { ascending: true })
```

### Food Database Search

```javascript
// Search foods by name
const { data: foods } = await supabase
  .from('deft_food_database')
  .select('*')
  .ilike('name', `%${query}%`)
  .eq('is_keto_friendly', true)
  .limit(20)

// Browse by category
const { data: proteins } = await supabase
  .from('deft_food_database')
  .select('*')
  .eq('category', 'protein')
  .order('name')
```

### Real-Time Subscriptions

```javascript
// Subscribe to daily log changes (live dashboard updates)
const channel = supabase
  .channel('daily-log')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'deft_daily_logs',
    filter: `log_date=eq.${today}`
  }, (payload) => {
    // Update dashboard with new consumed_totals, exercise_calories, etc.
    updateDashboard(payload.new)
  })
  .subscribe()
```

---

## DEFT-BRIDGE API (Write Operations)

All write operations go through `POST https://n8n.carltonaiservices.com/webhook/deft-bridge`.

### Standard Request

```javascript
async function deftApi(operation, data = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch('https://n8n.carltonaiservices.com/webhook/deft-bridge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      operation,
      user_id: session.user.id,
      data
    })
  })
  return response.json()
}
```

### Standard Response

```json
{
  "success": true,
  "operation": "log_meal",
  "data": { ... },
  "timestamp": "2026-03-20T12:00:00.000Z"
}
```

### All Operations

#### Profile
```javascript
// Get profile + TDEE
await deftApi('get_profile')

// Update profile
await deftApi('update_profile', {
  current_weight_lbs: 208,
  activity_level: 'very_active',
  macro_targets: { calories: 2000, fat_g: 155, protein_g: 130, net_carbs_g: 20 }
})
```

#### Recipes
```javascript
// Add recipe with ingredients
await deftApi('add_recipe', {
  name: 'Keto Salad',
  servings: 1,
  tags: ['keto', 'lunch', 'quick'],
  ingredients: [
    { name: 'Romaine Lettuce', quantity: 2, unit: 'cup', nutrition: { calories: 16, total_fat_g: 0.3, protein_g: 1.2, total_carbs_g: 3.1, fiber_g: 2, sugar_g: 1.1, net_carbs_g: 1.1 } },
    { name: 'Grilled Chicken', quantity: 4, unit: 'oz', nutrition: { calories: 187, total_fat_g: 4.1, protein_g: 35.3, total_carbs_g: 0, fiber_g: 0, sugar_g: 0, net_carbs_g: 0 } },
    { name: 'Ranch Dressing', quantity: 2, unit: 'tbsp', nutrition: { calories: 129, total_fat_g: 13.4, protein_g: 0.4, total_carbs_g: 1.8, fiber_g: 0, sugar_g: 1.2, net_carbs_g: 1.8 } }
  ]
})

// Search recipes
await deftApi('search_recipes', { query: 'salad', tags: ['keto'], max_net_carbs_g: 10 })

// Get recipe with ingredients
await deftApi('get_recipe', { recipe_id: 'uuid-here' })

// Archive recipe
await deftApi('delete_recipe', { recipe_id: 'uuid-here' })

// Search food database
await deftApi('search_foods', { query: 'chicken', keto_only: true })
```

#### Meals
```javascript
// Get portion recommendation BEFORE logging
const rec = await deftApi('recommend_portion', {
  recipe_id: 'uuid-of-salad',
  meal_number: 2,      // This is meal 2 of the day
  total_meals: 3       // Planning 3 meals today
})
// rec.data.recommended_servings = 0.85
// rec.data.limiting_factor = "net_carbs"
// rec.data.would_consume = { calories: 282, fat_g: 15, protein_g: 31, net_carbs_g: 2.5 }

// Log the meal (user accepts recommendation or enters custom amount)
await deftApi('log_meal', {
  recipe_id: 'uuid-of-salad',
  servings: 0.85,       // Or user's custom amount
  meal_type: 'lunch',
  meal_number: 2
})

// Get daily summary
await deftApi('get_daily_summary', { date: '2026-03-20' })

// Undo a meal
await deftApi('undo_meal', { meal_id: 'uuid-of-meal' })

// Log water
await deftApi('log_water', { amount_oz: 16 })
```

#### Exercise
```javascript
await deftApi('log_exercise', {
  exercise_name: 'Running',
  exercise_type: 'cardio',
  duration_min: 30,
  calories_burned: 350,
  intensity: 'moderate',
  details: { distance_miles: 3.1 }
})

await deftApi('get_exercises', { date: '2026-03-20' })
```

#### Analytics (Charts/Graphs)
```javascript
// Weight trend chart
const weightData = await deftApi('get_analytics', {
  metric: 'weight',
  start_date: '2026-02-20',
  end_date: '2026-03-20'
})
// weightData.data.series = [{ date: "2026-02-20", value: 215 }, ...]
// weightData.data.stats = { start_value: 215, end_value: 208, change: -7, trend_direction: "decreasing" }

// Calorie tracking chart
const calData = await deftApi('get_analytics', {
  metric: 'calories',
  start_date: '2026-03-13',
  end_date: '2026-03-20'
})
// calData.data.series = [{ date, consumed, target, exercise, net }, ...]

// Macro breakdown chart
const macroData = await deftApi('get_analytics', {
  metric: 'macros',
  start_date: '2026-03-13',
  end_date: '2026-03-20'
})
// macroData.data.series = [{ date, fat_g, protein_g, net_carbs_g, fiber_g, sugar_g }, ...]

// Available metrics: weight, calories, macros, adherence, exercise, net_carbs, water
```

#### Keto Status
```javascript
const keto = await deftApi('get_keto_status', { days: 7 })
// keto.data.current_day = { net_carbs_g: 12, in_keto_range: true, fat_calories_pct: 72, ... }
// keto.data.trailing = { avg_net_carbs_g: 16.5, keto_adherence_pct: 86, trend: "stable" }
```

#### AI Features
```javascript
// Get meal suggestions based on remaining macros
const suggestions = await deftApi('ai_analyze', {
  action: 'suggest_meals',
  use_existing_recipes: true
})

// Weekly nutrition report
const report = await deftApi('ai_analyze', { action: 'weekly_report' })

// Analyze a food/recipe
const analysis = await deftApi('ai_analyze', {
  action: 'analyze_nutrition',
  food_description: 'grilled chicken caesar salad with croutons'
})
```

---

## Recommended UI Pages

### 1. Dashboard (Home)
- **Macro ring charts**: Calories, Fat, Protein, Net Carbs (consumed/target)
- **Today's meals list**: From `deft_meal_entries`
- **Quick actions**: Log meal, Log water, Log exercise
- **Keto status badge**: Green/yellow/red based on net carbs
- **Data source**: Direct Supabase read from `deft_daily_logs`

### 2. Recipes
- **Recipe browser**: Grid/list with search, tag filters, favorites
- **Add recipe form**: Name, servings, ingredients (with food database autocomplete)
- **Recipe detail**: Nutrition facts, keto analysis, ingredient list
- **Data source**: Direct Supabase read + DEFT-BRIDGE for writes

### 3. Log Meal
- **Recipe selector**: Pick from saved recipes
- **Smart portion**: Show recommended portion before logging
- **Meal details**: Type (breakfast/lunch/dinner/snack), meal number, custom servings
- **After logging**: Show updated daily summary
- **Data source**: DEFT-BRIDGE (`recommend_portion` then `log_meal`)

### 4. Exercise
- **Log form**: Name, type, duration, calories, intensity
- **Today's exercises**: List from `deft_exercise_entries`
- **Calorie adjustment**: Show how exercise affects daily budget
- **Data source**: DEFT-BRIDGE for writes, Supabase for reads

### 5. Analytics
- **Weight chart**: Line graph with 7-day rolling average
- **Calorie chart**: Consumed vs target bar chart
- **Macro breakdown**: Stacked bar or pie chart
- **Keto adherence**: Days under 20g net carbs streak
- **Date range picker**: 7d, 30d, 90d, custom
- **Data source**: DEFT-BRIDGE (`get_analytics`)

### 6. Profile/Settings
- **Body stats**: Height, weight, age, sex
- **Diet settings**: Diet type, macro targets, meal count
- **TDEE calculator**: Shows BMR and TDEE with activity level
- **Preferences**: Timezone, unit system, allergens
- **Data source**: DEFT-BRIDGE (`get_profile`, `update_profile`)

---

## Keto-Specific UI Elements

### Net Carb Tracker (always visible)
```
Net Carbs: 12g / 20g  [====------] 60%
                       ↑ green if < 80%, yellow if 80-100%, red if > 100%
```

### Macro Ratio Display
```
Fat: 72% | Protein: 23% | Carbs: 5%
Target: 70-75% | 20-25% | <5%
```

### Keto Tier Badges (on foods/recipes)
- Excellent (<2g net carbs): Green badge
- Good (2-5g): Light green
- Moderate (5-10g): Yellow
- Avoid (>10g): Red

### Portion Recommendation Card
```
Recommended: 0.85 servings
Limiting factor: Net Carbs
Would consume: 282 cal | 15g fat | 31g protein | 2.5g net carbs
Remaining after: 518 cal | 30g fat | 29g protein | 5.5g net carbs
[Log This Amount] [Customize]
```

---

## Error Handling

All DEFT-BRIDGE responses include `success: boolean`. Handle errors:

```javascript
const result = await deftApi('log_meal', data)
if (!result.success) {
  showError(result.error || 'Something went wrong')
  return
}
// Success — update UI
```

Common errors:
- `"Recipe not found"` — Invalid recipe_id
- `"Profile not found"` — User hasn't completed onboarding
- `"Meal entry not found"` — Invalid meal_id for undo

---

## Supabase Connection Details

| Setting | Value |
|---------|-------|
| Project URL | `https://yrwrswyjawmgtxrgbnim.supabase.co` |
| Anon Key | (get from Supabase dashboard → Settings → API) |
| DEFT-BRIDGE URL | `https://n8n.carltonaiservices.com/webhook/deft-bridge` |
