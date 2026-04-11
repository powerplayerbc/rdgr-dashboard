# Backend Issue: Council Advisors Need a Supabase Table

**Status:** NEEDS BACKEND WORK
**Date:** 2026-03-26
**Filed by:** Frontend developer

---

## Problem

The Advisory Council page (`/council`) currently has 6 advisors hardcoded in the HTML:

```javascript
const BUILTIN_ADVISORS = [
    { name: 'Warren', expertise: 'Finance & Investment', color: '#1E3A5F' },
    { name: 'Steve', expertise: 'Innovation & Product', color: '#7A7A7D' },
    { name: 'Sun Tzu', expertise: 'Strategy & Competition', color: '#8B1A1A' },
    { name: 'Maya', expertise: 'Ethics & Social Impact', color: '#E87461' },
    { name: 'Ada', expertise: 'Technology & Engineering', color: '#7B2D8E' },
    { name: 'Russell', expertise: 'Marketing & Brand', color: '#0D8B7D' },
];
```

Custom advisors are currently stored in `localStorage`, which means they don't persist across devices or users.

## What's Needed

### 1. Supabase Table: `council_advisors`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `brand_id` | text | e.g., `'carlton'` |
| `name` | text | Advisor display name |
| `expertise` | text | Area of expertise |
| `color` | text | Hex color for avatar (e.g., `'#1E3A5F'`) |
| `is_active` | boolean | Whether advisor is available for selection (default true) |
| `is_builtin` | boolean | Whether this is a system advisor vs user-created (default false) |
| `created_by` | text | User ID who created this advisor (null for builtins) |
| `created_at` | timestamptz | |

### 2. Seed the 6 built-in advisors as rows with `is_builtin = true`

### 3. RLS Policy
- SELECT: Allow anon role (filtered by `brand_id`)
- INSERT: Allow anon role (for user-created advisors)
- UPDATE: Allow anon role on rows where `is_builtin = false`
- DELETE: Allow anon role on rows where `is_builtin = false`

## Frontend Changes (after table exists)

Once the table is created and seeded, the frontend will:

1. Replace `BUILTIN_ADVISORS` constant with a Supabase fetch:
   ```javascript
   const advisors = await sbSelect('council_advisors',
     `brand_id=eq.carlton&is_active=eq.true&select=*&order=is_builtin.desc,name`
   );
   ```

2. Replace localStorage custom advisor storage with Supabase INSERT/DELETE

3. The "Add Advisor" form will POST to `council_advisors` table

4. The "Remove Advisor" button will DELETE from `council_advisors` (only for `is_builtin = false`)

## Current Workaround

Custom advisors are stored in `localStorage['rdgr-custom-advisors']` until the table is created. This works for single-user/single-device use but needs to be migrated.
