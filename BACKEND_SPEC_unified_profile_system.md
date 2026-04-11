# Backend Spec: Unified Profile & Settings System

**Created**: 2026-03-23
**Priority**: High — current system loses settings silently and has no cross-page persistence
**Affects**: All RDGR Command Center pages (DEFT, BRAIN, Voice, Social Voice, Scraper, Offer Studio)

---

## Problem Statement

The RDGR Command Center has 3 users (Bradford, Dianna, Brianna) across 6+ pages, each storing settings in different tables with different patterns. Settings are lost when:

1. **Webhooks fail** — BRAIN saves go through `brain-bridge` webhook with no database fallback. If n8n is down, edits vanish silently.
2. **Tab switching reloads data** — Navigating between sub-tabs re-fetches from the API and overwrites unsaved form state with defaults.
3. **No single source of truth** — DEFT profile data is in `deft_user_profiles`, BRAIN settings go through a webhook, voice settings are brand-wide in `outreach_voice_settings`, scraper inputs are in `social_discovery_inputs`. There's no unified place to query "what are all of Bradford's settings?"
4. **Brand-wide vs per-user is unclear** — Voice settings and scraper inputs are shared across all users, which is intentional for a shared brand voice but isn't documented or enforced consistently.

---

## Current Data Layout

| Data | Table | Scoped By | Save Method | Fallback on Failure |
|------|-------|-----------|-------------|---------------------|
| User profile (name, email) | `deft_user_profiles` | `user_id` | Direct Supabase | N/A (direct write) |
| DEFT health (weight, macros, diet) | `deft_user_profiles` | `user_id` | Webhook → Supabase fallback | Yes |
| DEFT daily logs (meals, water) | `deft_daily_logs` | `user_id` + `log_date` | Webhook → Supabase fallback | Yes (just fixed) |
| DEFT theme/appearance | `deft_user_profiles.preferences` | `user_id` | Direct Supabase | N/A |
| BRAIN categories | `brain_categories` | `user_id` (via webhook) | Webhook only | **None** |
| BRAIN activities/timers | `brain_activities`, `brain_timers` | `user_id` (via webhook) | Webhook only | **None** |
| BRAIN profile (wake/sleep/goal) | `brain_user_profiles` | `user_id` (via webhook) | Webhook → Supabase fallback | Yes (just fixed) |
| BRAIN directive points | `brain_user_profiles` or webhook | `user_id` | Webhook → preferences fallback | Yes (just fixed) |
| Email voice settings | `outreach_voice_settings` | `brand_id` | RPC `save_voice_settings` | **None** |
| Social voice settings | `social_platform_config` | `brand_id` + `platform` | RPC `save_social_voice_settings` | **None** |
| Scraper inputs | `social_discovery_inputs` | `brand_id` | Direct Supabase | **None** |

### Key Problems with This Layout

1. **`brain_user_profiles` vs `deft_user_profiles`** — Are these the same table? The BRAIN frontend queries `brain_user_profiles` but the actual table might be `deft_user_profiles` with the BRAIN webhook providing an abstraction layer. If the webhook is down, we don't know which table to fall back to.

2. **No settings versioning** — When settings change, the old values are overwritten. There's no history or rollback (except for the broken voice snapshots feature).

3. **Webhook-only paths have zero resilience** — BRAIN categories, activities, and timers have no Supabase fallback. If the webhook is down, those features are completely inoperable.

---

## Proposed Solution: Unified `user_settings` Table

### New Table: `user_settings`

```sql
CREATE TABLE user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES deft_user_profiles(user_id),
    domain TEXT NOT NULL,           -- 'deft', 'brain', 'voice', 'social_voice', 'scraper', 'offers'
    setting_key TEXT NOT NULL,      -- 'profile', 'macro_targets', 'directive_points', 'theme', etc.
    setting_value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by TEXT,                -- 'frontend', 'brain-bridge', 'voice-learn', etc.
    UNIQUE(user_id, domain, setting_key)
);

-- Index for fast lookups
CREATE INDEX idx_user_settings_user_domain ON user_settings(user_id, domain);

-- Auto-update timestamp
CREATE TRIGGER update_user_settings_timestamp
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### How It Works

Each setting is a row with a `{user_id, domain, setting_key}` composite key and a `setting_value` JSONB blob. This gives us:

- **Per-user isolation** — Every user has their own settings rows
- **Domain separation** — DEFT settings don't collide with BRAIN settings
- **Expandable** — Adding a new feature just means writing to a new `domain`/`setting_key` combination, no schema changes needed
- **Queryable** — "Get all of Bradford's settings" is one query: `WHERE user_id = '...'`
- **Auditable** — `updated_at` and `updated_by` show when and what changed each setting

### Example Data

```
user_id     | domain       | setting_key        | setting_value
------------|-------------|--------------------|--------------------------
bradford    | deft        | macro_targets      | {"calories":2000,"fat_g":155,...}
bradford    | deft        | theme              | {"primary":"#06D6A0","font":"Inter",...}
bradford    | brain       | profile            | {"daily_goal_points":100,"wake_time":"06:00",...}
bradford    | brain       | directive_points   | {"approve":5,"deny":10,...}
bradford    | brain       | categories         | [{"name":"Deep Work","color":"#06D6A0",...},...]
brianna     | deft        | macro_targets      | {"calories":1800,"fat_g":120,...}
brianna     | brain       | profile            | {"daily_goal_points":80,"wake_time":"07:00",...}
dianna      | deft        | macro_targets      | {"calories":1600,"fat_g":100,...}
```

### Brand-Wide Settings Stay Separate

Settings that are intentionally shared across all users (voice, scraper) stay in their existing tables:

| Setting | Table | Why it's brand-wide |
|---------|-------|-------------------|
| Email voice | `outreach_voice_settings` | One company voice for all outreach |
| Social voice | `social_platform_config` | One brand personality per platform |
| Scraper inputs | `social_discovery_inputs` | One discovery strategy per brand |

These are **not** per-user settings — they define how the AI represents the brand. The profile switcher on these pages should either be hidden or display a note: "These settings apply to the entire brand."

---

## RPC Functions Needed

### 1. `get_user_settings(p_user_id, p_domain)`

Returns all settings for a user in a given domain. If `p_domain` is null, returns all domains.

```sql
CREATE OR REPLACE FUNCTION get_user_settings(
    p_user_id UUID,
    p_domain TEXT DEFAULT NULL
) RETURNS JSONB AS $$
    SELECT jsonb_object_agg(setting_key, setting_value)
    FROM user_settings
    WHERE user_id = p_user_id
      AND (p_domain IS NULL OR domain = p_domain);
$$ LANGUAGE sql STABLE;
```

**Frontend calls:**
```javascript
// Load all BRAIN settings for Bradford
const settings = await supabaseRPC('get_user_settings', {
    p_user_id: activeProfileId,
    p_domain: 'brain'
});
// Returns: { "profile": {...}, "directive_points": {...}, "categories": [...] }
```

### 2. `save_user_setting(p_user_id, p_domain, p_setting_key, p_setting_value)`

Upserts a single setting. Uses `ON CONFLICT` to insert or update.

```sql
CREATE OR REPLACE FUNCTION save_user_setting(
    p_user_id UUID,
    p_domain TEXT,
    p_setting_key TEXT,
    p_setting_value JSONB,
    p_updated_by TEXT DEFAULT 'frontend'
) RETURNS JSONB AS $$
    INSERT INTO user_settings (user_id, domain, setting_key, setting_value, updated_by)
    VALUES (p_user_id, p_domain, p_setting_key, p_setting_value, p_updated_by)
    ON CONFLICT (user_id, domain, setting_key)
    DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
    RETURNING jsonb_build_object(
        'user_id', user_id,
        'domain', domain,
        'setting_key', setting_key,
        'updated_at', updated_at
    );
$$ LANGUAGE sql;
```

**Frontend calls:**
```javascript
// Save Bradford's directive points
await supabaseRPC('save_user_setting', {
    p_user_id: activeProfileId,
    p_domain: 'brain',
    p_setting_key: 'directive_points',
    p_setting_value: { approve: 5, deny: 10, edit: 15 }
});
```

### 3. `get_all_user_settings(p_user_id)`

Returns everything for a user, grouped by domain. Used on page load.

```sql
CREATE OR REPLACE FUNCTION get_all_user_settings(p_user_id UUID)
RETURNS JSONB AS $$
    SELECT jsonb_object_agg(
        domain,
        (SELECT jsonb_object_agg(setting_key, setting_value)
         FROM user_settings us2
         WHERE us2.user_id = p_user_id AND us2.domain = us1.domain)
    )
    FROM (SELECT DISTINCT domain FROM user_settings WHERE user_id = p_user_id) us1;
$$ LANGUAGE sql STABLE;
```

**Returns:**
```json
{
  "deft": {
    "macro_targets": {"calories": 2000, ...},
    "theme": {"primary": "#06D6A0", ...}
  },
  "brain": {
    "profile": {"daily_goal_points": 100, ...},
    "directive_points": {"approve": 5, ...}
  }
}
```

---

## Migration Plan

### Phase 1: Create Table + RPCs (Backend)

1. Create `user_settings` table with the schema above
2. Create the 3 RPC functions
3. Enable RLS (Row Level Security) — users can only read/write their own settings
4. Migrate existing data:

```sql
-- Migrate DEFT macro targets from deft_user_profiles
INSERT INTO user_settings (user_id, domain, setting_key, setting_value, updated_by)
SELECT user_id, 'deft', 'macro_targets', macro_targets, 'migration'
FROM deft_user_profiles
WHERE macro_targets IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migrate DEFT preferences (theme, timezone, etc.)
INSERT INTO user_settings (user_id, domain, setting_key, setting_value, updated_by)
SELECT user_id, 'deft', 'preferences', preferences, 'migration'
FROM deft_user_profiles
WHERE preferences IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migrate BRAIN profile settings
INSERT INTO user_settings (user_id, domain, setting_key, setting_value, updated_by)
SELECT user_id, 'brain', 'profile',
    jsonb_build_object(
        'daily_goal_points', daily_goal_points,
        'wake_time', wake_time,
        'sleep_time', sleep_time,
        'timezone', timezone
    ), 'migration'
FROM brain_user_profiles
ON CONFLICT DO NOTHING;
```

### Phase 2: Frontend Reads from `user_settings` (Frontend)

Update each page to use `get_user_settings` RPC as the primary read, with existing table reads as fallback during transition:

```javascript
// New pattern for loading settings
async function loadSettings(domain) {
    // Primary: unified settings table
    const settings = await supabaseRPC('get_user_settings', {
        p_user_id: activeProfileId,
        p_domain: domain
    });
    if (settings) return settings;

    // Fallback: legacy table (during migration)
    return await legacyLoadSettings(domain);
}
```

### Phase 3: Frontend Writes to `user_settings` (Frontend)

Update save functions to write to `user_settings` directly — no webhook dependency for settings persistence:

```javascript
// New pattern for saving settings
async function saveSetting(domain, key, value) {
    // Always write to Supabase first (reliable)
    const result = await supabaseRPC('save_user_setting', {
        p_user_id: activeProfileId,
        p_domain: domain,
        p_setting_key: key,
        p_setting_value: value
    });

    if (!result) {
        toast('Failed to save', 'error');
        return false;
    }

    // Also notify webhook for any side effects (optional, non-blocking)
    webhookNotify(domain, key, value).catch(() => {});

    toast('Saved', 'success');
    return true;
}
```

### Phase 4: Remove Legacy Paths

Once `user_settings` is proven stable:
- Stop reading from `deft_user_profiles.preferences` for settings (keep profile identity data)
- Stop reading from `brain_user_profiles` for settings
- Remove webhook-only save paths
- Keep `deft_user_profiles` for identity data (name, email, user_id) and health data (height, weight, age)

---

## How Settings Persistence Should Work

### On Page Load
```
1. Read activeProfileId from localStorage
2. Call get_user_settings(activeProfileId, domain) — one Supabase RPC
3. Populate form fields from response
4. Cache in memory so tab switches don't re-fetch
```

### On Save
```
1. Collect form values
2. Call save_user_setting(activeProfileId, domain, key, value) — one Supabase RPC
3. Update in-memory cache
4. Show success toast
5. Optionally notify webhook for side effects (non-blocking)
```

### On Profile Switch
```
1. Update activeProfileId in localStorage
2. Clear in-memory settings cache
3. Call get_user_settings(newProfileId, domain) — reload for new user
4. Repopulate form fields
```

### Cross-Page Consistency
```
- All pages read from the same user_settings table
- Profile switch on any page updates localStorage
- Next page load reads the new profile's settings from Supabase
- No stale data because reads always go to the database
```

---

## Webhook Relationship

Webhooks should be **notifiers**, not the primary save path:

| Action | Primary (always works) | Secondary (optional) |
|--------|----------------------|---------------------|
| Save setting | `save_user_setting` RPC → Supabase | Webhook notification for side effects |
| Load setting | `get_user_settings` RPC → Supabase | Webhook for computed/derived data |
| Log activity | `save_user_setting` RPC → Supabase | Webhook to update scores/streaks |
| Log water | Direct Supabase write to `deft_daily_logs` | Webhook for daily summary recalc |

The principle: **the database is the source of truth, webhooks are event handlers.** If the webhook is down, the user's data still saves. The webhook can process it later.

---

## What This Enables Going Forward

1. **New features** — Add a new settings domain (e.g., `offers`, `crm_preferences`) without schema changes
2. **Settings export/import** — Query all of a user's settings in one call
3. **Settings audit trail** — `updated_at` + `updated_by` on every row
4. **Multi-device sync** — All reads go to Supabase, not localStorage
5. **Admin view** — A settings overview page showing all users' configurations
6. **Onboarding** — Clone a "template" user's settings for new users
7. **A/B testing** — Compare settings configurations across users

---

## Supabase Tables Reference

### Keep (Identity + Domain Data)
| Table | Purpose | Changes Needed |
|-------|---------|----------------|
| `deft_user_profiles` | User identity (name, email, user_id) + health data | Remove `preferences` JSONB after migration |
| `deft_daily_logs` | Daily nutrition/water tracking | None |
| `outreach_voice_settings` | Brand-wide email voice | None (brand-scoped by design) |
| `social_platform_config` | Brand-wide social voice per platform | None |
| `social_discovery_inputs` | Brand-wide scraper inputs | None |

### New
| Table | Purpose |
|-------|---------|
| `user_settings` | Unified per-user settings across all domains |

### Deprecate (after migration)
| Table | Replaced By |
|-------|-------------|
| `brain_user_profiles` | `user_settings` (domain='brain', key='profile') |
| `deft_user_profiles.preferences` | `user_settings` (domain='deft', key='preferences') |
| `deft_user_profiles.macro_targets` | `user_settings` (domain='deft', key='macro_targets') |

---

## Priority

1. **Immediate** — Create `user_settings` table + RPCs (enables frontend to save reliably)
2. **Next** — Migrate existing data from legacy tables
3. **Then** — Frontend updates to use new RPCs (can be done page-by-page)
4. **Finally** — Deprecate legacy paths once stable
