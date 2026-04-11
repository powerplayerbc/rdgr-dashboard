# RDGR Dashboard — Frontend Reference for Backend Developer

**Date:** 2026-03-26
**Purpose:** Accurate snapshot of the current frontend so backend suggestions align with what's actually built.

> **Important:** Several older spec files in this folder (e.g., `FRONTEND_SPEC_dashboard_restructure.md`) describe a Next.js/React app with a sidebar, routes like `/queue` and `/submissions`, and Supabase Auth SSR. **None of that exists.** This is a static HTML site. Use this document as the source of truth for the frontend.

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | None — vanilla HTML/CSS/JS, single-file pages |
| Styling | Tailwind CSS via CDN (`cdn.tailwindcss.com`) + CSS custom properties for theming |
| Backend data | Supabase PostgREST API (direct `fetch()` calls) |
| Backend actions | n8n webhooks (`POST` to `https://n8n.carltonaiservices.com/webhook/*`) |
| Auth | localStorage password gate (no Supabase Auth, no JWT, no sessions) |
| Hosting | Static files on Coolify (Hostinger VPS) via GitHub deploy repo |
| Domain | `rdgr.bradfordcarlton.com` |

---

## 2. All Pages & Routes

| Page | Source File | Deployed Route | In Nav? |
|------|-----------|----------------|---------|
| Dashboard | `index.html` | `/` and `/rdgr` | Yes |
| Chat | `chat.html` | `/chat` | Yes |
| Org Map | `org-chart.html` | `/org-chart` | Yes |
| Workflows | `our-workflows.html` | `/our-workflows` | Yes |
| Social | `social-dashboard.html` | `/social-dashboard` | Yes |
| CRM | `crm.html` | `/crm` | Yes |
| Offers | `offer-studio.html` | `/offer-studio` | Yes |
| DEFT | `deft.html` | `/deft` | Yes |
| BRAIN | `brain.html` | `/brain` | Yes |
| Settings Directory | `settings-directory.html` | `/settings` | Gear icon |
| Voice Settings | `settings.html` | `/email-voice-settings` | Sub-page |
| DEFT Settings | `deft-settings.html` | `/deft-settings` | Sub-page |
| Social Voice Settings | `social-voice-settings.html` | `/social-voice-settings` | Sub-page |
| Scraper Settings | `scraper-settings.html` | `/scraper-settings` | Sub-page |
| Appearance | `appearance.html` | `/appearance` | Sub-page |
| Profile | `profile.html` | `/profile` | Sub-page |
| Page Builder | `page-builder.html` | Separate domain (`editor.bradfordcarlton.com`) | No |

---

## 3. Navigation Structure

**Horizontal tab bar** at the top of every page (not a sidebar):

```
Dashboard | Chat | Org Map | Workflows | Social | CRM | Offers | DEFT | BRAIN   [gear icon]
```

- Active tab highlighted based on current URL path
- Settings pages accessed via gear icon → settings directory → sub-pages
- Navigation HTML is copy-pasted into every page (no shared component)

---

## 4. Authentication

**No Supabase Auth. No JWT. No server sessions.**

| Aspect | Detail |
|--------|--------|
| Gate | Full-screen overlay with password input + profile selector |
| Password | Hardcoded: `Advance1!` |
| Session storage | `localStorage['rdgr-session']` → `{ authenticated: true, ts: <timestamp> }` |
| Profile storage | `localStorage['rdgr-active-profile']` → `{ id: <userId>, name: <displayName> }` |
| Profile source | `deft_user_profiles` table (SELECT user_id, display_name, email) |
| Profile cache | `localStorage['rdgr-profiles-cache']` with 5-minute TTL |
| Flash prevention | `<head>` script adds `rdgr-authed` class to `<html>` before body renders |
| Sign out | Clears `rdgr-session` + `rdgr-active-profile`, reloads page |

**Every Supabase query and webhook call uses `activeProfileId` from localStorage as the user identifier.** If no profile is selected, most features fail silently.

---

## 5. Webhook Endpoints (by page)

Base URL: `https://n8n.carltonaiservices.com/webhook`

All webhooks use `POST` with `Content-Type: application/json`.

### Dashboard (`index.html`)
| Endpoint | Purpose |
|----------|---------|
| `/rdgr-approve` | Approve tasks/directives |
| `/rdgr-intake` | New intake/request creation |
| `/rdgr-activate` | Activate profiles/status changes |
| `/rdgr-directive-action` | Directive-specific actions |
| `/rdgr-complete` | Mark tasks complete |
| `/human-action` | General human task handler |
| `/rdgr-crm` | CRM-related operations |
| `/rdgr-tool-social` | Social media tool integration |

### Chat (`chat.html`)
| Endpoint | Purpose |
|----------|---------|
| `/rdgr-chat` | Chat message send/receive |

### BRAIN (`brain.html`)
| Endpoint | Purpose |
|----------|---------|
| `/brain-bridge` | Core gateway — points, achievements, timer stop, activity logging, calendar sync |

Health check: pings `/brain-bridge/` on page load. If unavailable, falls back to direct Supabase reads (webhook used only for writes).

### DEFT (`deft.html`)
| Endpoint | Purpose |
|----------|---------|
| `/deft-bridge` | Voice settings, profile updates, directive management |

### CRM (`crm.html`)
| Endpoint | Purpose |
|----------|---------|
| `/rdgr-crm` | CRM operations, contact management |
| `/rdgr-complete` | Task completion |
| `/human-action` | Human workflow actions |
| `/crm-sequences` | Email/outreach sequence management |
| `/prosp-outreach-approved` | Approved prospect outreach triggers |
| `/social-reply` | Social media reply handling |
| `/prosp-lead-import` | Bulk lead import (Google Sheets or CSV) |

### Offer Studio (`offer-studio.html`)
| Endpoint | Purpose |
|----------|---------|
| `/human-action` | Offer proposal actions |
| `/page-create` | Landing page creation |
| `/promo-manage` | Promotional campaign management |
| `/offer-ideate` | AI offer ideation/generation |
| `/testimonial-ingest` | Testimonial ingestion |
| `/lp-publish` | Landing page publish/update |

### Social Dashboard (`social-dashboard.html`)
| Endpoint | Purpose |
|----------|---------|
| `/social-orchestrator` | Social post orchestration trigger |
| `/social-reddit-orch` | Reddit-specific orchestration |
| `/social-approved` | Approve queued social posts |
| `/social-reply` | Reply to social comments |

### Scraper Settings (`scraper-settings.html`)
| Endpoint | Purpose |
|----------|---------|
| `/social-orchestrator` | Trigger social scraping |
| `/social-reddit-orch` | Trigger Reddit scraping |

### Voice Settings (`settings.html`)
| Endpoint | Purpose |
|----------|---------|
| `/voice-expand` | Expand/generate voice setting variations |

### Page Builder (`page-builder.html`)
| Endpoint | Purpose |
|----------|---------|
| `/page-track` | Analytics/visitor tracking |
| `/page-form` | Form submissions (lead capture, checkout, upsell, downsell) |

---

## 6. Supabase Tables (by page)

Instance: `https://yrwrswyjawmgtxrgbnim.supabase.co`
All queries use the anon key via PostgREST REST API (`/rest/v1/<table>`).

### BRAIN module
| Table | Operations | Used By |
|-------|-----------|---------|
| `brain_user_profiles` | SELECT, PATCH | brain.html — points, streaks, levels, XP |
| `brain_categories` | SELECT (filter `is_active=eq.true`) | brain.html — activity categories |
| `brain_timers` | SELECT | brain.html — active/completed timers |
| `brain_daily_scores` | SELECT, INSERT | brain.html — daily point totals by `score_date` |
| `brain_activities` | SELECT, INSERT | brain.html — activity logs with durations and points |
| `brain_achievements` | SELECT | brain.html — earned achievements |

### CRM / Contacts
| Table | Operations | Used By |
|-------|-----------|---------|
| `unified_contacts` | SELECT, INSERT, PATCH | crm.html — contact data |
| `voice_settings_snapshots` | SELECT (filter `brand_id=eq.carlton`, `status=eq.pending`) | index.html, crm.html |

### Chat
| Table | Operations | Used By |
|-------|-----------|---------|
| `command_threads` | SELECT (filter `created_by`, `status=eq.active`) | chat.html — thread history |

### Offers / Revenue
| Table | Operations | Used By |
|-------|-----------|---------|
| `offers` | SELECT | offer-studio.html |
| `tasks` | SELECT | offer-studio.html |
| `proposals` | SELECT | offer-studio.html |
| `templates` | SELECT | offer-studio.html |
| `testimonials` | SELECT | offer-studio.html |
| `landing_pages` | SELECT | offer-studio.html |
| `revenue` | SELECT | offer-studio.html |
| `purchases` | SELECT | offer-studio.html |
| `product_performance` | SELECT | offer-studio.html |
| `email_sequences` | SELECT | offer-studio.html |
| `promotions` | SELECT | offer-studio.html |

### Social
| Table | Operations | Used By |
|-------|-----------|---------|
| `social_content_queue` | SELECT, INSERT, PATCH, DELETE | social-dashboard.html |
| `social_outreach_drafts` | SELECT | social-dashboard.html |
| `image_sessions` | SELECT (filter `session_id`) | social-dashboard.html |

### User / Profile
| Table | Operations | Used By |
|-------|-----------|---------|
| `deft_user_profiles` | SELECT, PATCH | All pages (auth gate, theme, preferences) |
| `platform_users` | SELECT | brain.html (fallback for display names) |

### RPC Functions
| Function | Used By | Purpose |
|----------|---------|---------|
| `crm_plan_snapshot` | crm.html | Generate CRM plan snapshot |
| `get_contact_social_timeline` | crm.html | Fetch contact's social timeline |

---

## 7. Theming System

Themes are applied via CSS custom properties on `document.documentElement`.

| Detail | Value |
|--------|-------|
| Storage key | `localStorage['deft-theme-' + (profileId \|\| 'default')]` |
| Load timing | Applied in `<head>` before body renders (no flash) |
| Persistence | localStorage + async sync to `deft_user_profiles.preferences` |
| Presets | `forest`, `sunrise`, `ocean`, `berry`, `rdgr` (default) |

### CSS Variables Set
```
--deft-accent, --deft-accent-dim, --deft-accent-warm
--deft-base, --deft-surface, --deft-surface-el, --deft-surface-hi
--deft-border
--deft-success, --deft-warning, --deft-danger
--deft-txt, --deft-txt-2, --deft-txt-3
--deft-heading-font, --deft-body-font, --deft-font-scale
```

All pages reference these variables. New pages must use them for visual consistency.

---

## 8. Data Flow Patterns

### Reads (page load)
```
Page loads → check localStorage auth → fetch from Supabase PostgREST → render
```

### Writes (user actions)
```
User action → POST to n8n webhook → webhook processes + writes to Supabase → frontend re-fetches from Supabase → re-renders
```

### Fallback (BRAIN & DEFT only)
```
Page loads → health-check webhook → if DOWN, read directly from Supabase (read-only mode)
```

### Real-time
Only `brain.html` uses Supabase Realtime subscriptions (via `window.supabase.createClient()`). All other pages use manual refresh or re-fetch after actions.

---

## 9. What New Pages / Webhooks Need

Any new backend feature that needs a frontend page should:

1. **Be a single `.html` file** in `sites/rdgr-dashboard/` — not a React component
2. **Include the standard auth gate** (copy from any existing page)
3. **Include the theme loader** in `<head>` (copy from any existing page)
4. **Include the nav bar** with the same tab links
5. **Use CSS variables** (`--deft-*`) for all colors and fonts
6. **Call Supabase via PostgREST** (`fetch()` with anon key headers)
7. **Call n8n via webhook POST** for any write/action operations
8. **Identify user by** `localStorage['rdgr-active-profile'].id` — this is the `user_id` sent to all endpoints

---

## 10. Outdated Specs to Ignore

These files in `sites/rdgr-dashboard/` describe a **different architecture that was never built**:

| File | Why It's Wrong |
|------|---------------|
| `FRONTEND_SPEC_dashboard_restructure.md` | Describes Next.js 16, Sidebar.tsx, routes that don't exist (`/queue`, `/submissions`, `/files`) |
| `FRONTEND_OFFER_STUDIO_SPEC.md` | May reference React components — offer-studio.html already exists as static HTML |
| `FRONTEND_PAGE_SYSTEM_SPEC.md` | References a framework-based page system |

Always cross-reference against this document and the actual HTML files.
