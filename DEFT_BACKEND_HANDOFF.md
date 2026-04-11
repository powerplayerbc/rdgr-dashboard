# DEFT Backend Handoff — Bridge 400 Errors

**Date:** 2026-04-08
**Reported by:** Frontend developer
**Priority:** High — frontend fallbacks are in place but bypass server-side logic

---

## What's Broken

The DEFT-BRIDGE webhook (`POST https://n8n.carltonaiservices.com/webhook/deft-bridge`) is returning 400 errors for at least two operations:

### 1. `log_weight` (Confirmed)

User clicks "Save Weight" in the Weigh In modal and sees a red toast: **"Request failed with status code 400"**.

**Routed to:** DEFT-ANALYTICS sub-workflow (system_registry ID 315)

**Exact payload the frontend sends:**
```json
{
  "operation": "log_weight",
  "user_id": "<uuid from localStorage>",
  "data": {
    "weight_lbs": 185.5,
    "weigh_date": "2026-04-08",
    "notes": "Morning weigh-in"
  }
}
```

**Response received:**
```json
{
  "success": false,
  "error": "Request failed with status code 400"
}
```

### 2. `log_meal` (Inferred — Silent Failure)

The Quick Log feature calls `log_meal` with `{ silent: true }`, so the user never sees the error toast. However, the bridge call returns `null` (failure), triggering the Supabase direct-write fallback. This means the bridge is likely also failing for `log_meal`.

**Routed to:** DEFT-MEALS sub-workflow (system_registry ID 313)

**Exact payload the frontend sends (quick log):**
```json
{
  "operation": "log_meal",
  "user_id": "<uuid>",
  "data": {
    "food_id": "<uuid from deft_food_database>",
    "food_name": "Chicken Breast",
    "servings": 1.5,
    "meal_type": "lunch",
    "meal_number": 2,
    "nutrition_consumed": {
      "calories": 248,
      "total_fat_g": 5.4,
      "protein_g": 46.5,
      "total_carbs_g": 0,
      "fiber_g": 0,
      "net_carbs_g": 0
    }
  }
}
```

**Exact payload the frontend sends (recipe log):**
```json
{
  "operation": "log_meal",
  "user_id": "<uuid>",
  "data": {
    "recipe_id": "<uuid from deft_recipes>",
    "servings": 1,
    "meal_type": "dinner",
    "meal_number": 3
  }
}
```

---

## Expected Response Format

**Success:**
```json
{
  "success": true,
  "operation": "log_weight",
  "data": { ... }
}
```

**Failure:**
```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

---

## The Error Pattern

The error message `"Request failed with status code 400"` looks like an Axios/HTTP-node error message, suggesting the n8n workflow itself is making an HTTP call (likely to Supabase PostgREST) that returns a 400. The workflow is passing that raw error message through to the frontend response.

---

## Suggested Investigation Steps

1. **Check n8n execution logs** for the DEFT-ANALYTICS workflow (ID 315) — look for recent failed executions of `log_weight`
2. **Check n8n execution logs** for DEFT-MEALS workflow (ID 313) — look for recent failed executions of `log_meal`
3. **Verify Supabase table schemas match** what the workflow sends:
   - `deft_weight_history` table: Does it have columns `user_id`, `weigh_date`, `weight_lbs`? Are there extra required columns (like `body_fat_pct`) that the workflow isn't sending?
   - `deft_meal_entries` table: Does it have all the columns the workflow tries to write?
4. **Check RLS policies** — are there Row Level Security policies on `deft_weight_history` or `deft_meal_entries` that might reject the insert?
5. **Check for column type mismatches** — e.g., is `weigh_date` expected as `date` type but receiving a string? Is `weight_lbs` expected as `numeric` but receiving a float?
6. **Test the webhook directly** with a curl call using the exact payloads above

---

## Frontend Workarounds Applied

The frontend now has direct Supabase fallback writes for both operations:

### `log_weight` fallback:
- Writes to `deft_weight_history` directly (POST)
- Updates or creates `deft_daily_logs` entry with `weight_lbs`
- **What it skips:** Any server-side logic the DEFT-ANALYTICS workflow performs (e.g., trend calculations, analytics updates)

### `log_meal` fallback (already existed):
- Writes to `deft_meal_entries` directly (POST)
- **What it skips:** The atomic update of `deft_daily_logs.consumed_totals` that the DEFT-MEALS workflow performs
- The frontend now compensates for this by calculating consumed totals client-side from `deft_meal_entries` records

### Impact of fallbacks:
- Users can log weight and food successfully
- The `deft_daily_logs.consumed_totals` field may not be updated when the bridge is down, which could affect the Analytics/Trends tab since it reads from that field
- Historical weight trend data in `deft_weight_history` is populated correctly by the fallback

**The backend fix is still needed** to restore the bridge's server-side logic and ensure `deft_daily_logs` stays consistent.

---

## Related Frontend Code

All in `sites/rdgr-dashboard/deft.html`:
- `deftApi()` function: line ~3133 — the bridge caller
- `submitWeighIn()`: line ~3652 — weight save with fallback
- `confirmQuickLogFood()`: line ~5368 — quick log with fallback
- `calcConsumedFromMeals()`: line ~3371 — new client-side macro calculator
