# Frontend Spec: New Pages for RDGR Dashboard

**Status:** READY FOR IMPLEMENTATION
**Date:** 2026-03-26 (revised v3)
**Reference:** `docs/FRONTEND_REFERENCE_FOR_BACKEND.md` — source of truth for frontend architecture

---

## 1. Current Architecture

The RDGR Dashboard is a **static HTML site** at `rdgr.bradfordcarlton.com`. Each page is a standalone `.html` file using Tailwind CSS via CDN, direct Supabase PostgREST `fetch()` calls for reads, and n8n webhook POSTs for writes. Auth is a localStorage password gate (`Advance1!`) with profile selector from `deft_user_profiles`.

### Current Navigation (horizontal tab bar)
```
Dashboard | Chat | Org Map | Workflows | Social | CRM | Offers | DEFT | BRAIN   [gear icon]
```

**9 main tabs + gear icon** (settings directory with sub-pages).

### Current Pages
| Tab | File | Route |
|-----|------|-------|
| Dashboard | `index.html` | `/` |
| Chat | `chat.html` | `/chat` |
| Org Map | `org-chart.html` | `/org-chart` |
| Workflows | `our-workflows.html` | `/our-workflows` |
| Social | `social-dashboard.html` | `/social-dashboard` |
| CRM | `crm.html` | `/crm` |
| Offers | `offer-studio.html` | `/offer-studio` |
| DEFT | `deft.html` | `/deft` |
| BRAIN | `brain.html` | `/brain` |
| Settings | `settings-directory.html` | `/settings` (gear icon) |

---

## 2. New Pages to Add

Three new pages have backend support ready from Wave 4:

| Page | File | Route | Backend |
|------|------|-------|---------|
| Council | `council.html` | `/council` | RDGR-COUNCIL webhook + `council_sessions` table |
| Content | `content.html` | `/content` | Blog, newsletter, copy via Supabase + webhooks |
| Media | `media.html` | `/media` | `image_sessions` table + `gemini-image` webhook |

---

## 3. Navigation Options

### Option A: Add 3 tabs (12 total)
```
Dashboard | Chat | Org Map | Workflows | Social | CRM | Offers | Content | Media | Council | DEFT | BRAIN  [gear]
```
**12 tabs.** Getting crowded on smaller screens.

### Option B: Group Content + Media under one tab
```
Dashboard | Chat | Org Map | Workflows | Social | CRM | Offers | Content | Council | DEFT | BRAIN  [gear]
```
**11 tabs.** Content page has sub-tabs: `Blog | Newsletter | Copy | Calendar | Media`. Media is a sub-section rather than standalone.

### Option C: Move admin-ish tabs to gear menu
```
Dashboard | Chat | Social | CRM | Offers | Content | Media | Council | DEFT | BRAIN  [gear]
```
**10 tabs.** Org Map and Workflows move to the gear icon settings area (they're reference/admin tools, not daily-use). Keeps the main nav focused on actionable pages.

**Recommendation:** Option B — keeps tab count at 11, groups related content features naturally, and every tab is a daily-use page.

---

## 4. Building New Pages

Per the reference doc, each new page must:

1. **Be a single `.html` file** in the deploy repo
2. **Include the standard auth gate** (copy from any existing page)
3. **Include the theme loader** in `<head>` (the `--deft-*` CSS variables)
4. **Include the nav bar** with the same horizontal tab links (add new tabs)
5. **Use CSS variables** for all colors and fonts
6. **Call Supabase via PostgREST** `fetch()` with anon key headers
7. **Call n8n via webhook POST** for write/action operations
8. **Identify user by** `localStorage['rdgr-active-profile'].id`

### Supabase Connection (same for all pages)
```javascript
const SB_URL = 'https://yrwrswyjawmgtxrgbnim.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8';
const headers = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };
```

### Webhook Base URL
```
https://n8n.carltonaiservices.com/webhook
```

---

## 5. Council Page (`council.html`)

### Layout
```
[Nav bar]
┌─────────────────────────────────────────────────────┐
│ Advisory Council                    [New Session]    │
├──────────────┬──────────────────────────────────────┤
│ ADVISORS     │  SESSION LIST                         │
│              │  ┌──────────────────────────────────┐ │
│ ☑ Warren     │  │ Should we expand to EU?  [done]  │ │
│ ☑ Steve      │  │ 2026-03-26 • 6 advisors         │ │
│ ☑ Sun Tzu    │  ├──────────────────────────────────┤ │
│ ☑ Maya       │  │ Real estate niche?     [done]    │ │
│ ☑ Ada        │  │ 2026-03-26 • 6 advisors         │ │
│ ☑ Russell    │  └──────────────────────────────────┘ │
│              │                                       │
│ [Research ◉] │  SESSION DETAIL (when clicked)        │
│              │  Question: ...                        │
│              │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│              │  │ Warren  │ │ Steve   │ │ Sun Tzu │ │
│              │  │ Finance │ │ Product │ │Strategy │ │
│              │  │ Opinion │ │ Opinion │ │ Opinion │ │
│              │  └─────────┘ └─────────┘ └─────────┘ │
│              │  SYNTHESIS                            │
│              │  • Consensus: ...                     │
│              │  • Recommendation: ...                │
└──────────────┴──────────────────────────────────────┘
```

### Supabase Reads
```javascript
// Load session list
const resp = await fetch(
  `${SB_URL}/rest/v1/council_sessions?brand_id=eq.carlton&select=id,question,status,advisor_names,synthesis,created_at,completed_at&order=created_at.desc&limit=50`,
  { headers }
);
const sessions = await resp.json();

// Load session detail (responses + synthesis are JSONB in same row)
const resp = await fetch(
  `${SB_URL}/rest/v1/council_sessions?id=eq.${sessionId}&select=*`,
  { headers }
);
const session = (await resp.json())[0];
// session.responses = JSONB array of advisor opinions
// session.synthesis = { consensus: [], disagreements: [], strongest_argument: {}, overall_recommendation: "", summary: "" }
```

### Webhook (start session)
```javascript
const resp = await fetch('https://n8n.carltonaiservices.com/webhook/rdgr-council', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'convene_council',
    question: questionText,
    advisor_names: selectedAdvisors,  // e.g. ["Warren", "Steve"] or null for all
    research: includeResearch,        // boolean
    brand_id: 'carlton'
  })
});
// Returns: { success, session_id, ... }
// Poll council_sessions by session_id until status = 'completed' (every 5s)
```

### Advisor Registry
| Name | Expertise | Card Color |
|------|-----------|-----------|
| Warren | Finance & Investment | Navy |
| Steve | Innovation & Product | Silver |
| Sun Tzu | Strategy & Competition | Crimson |
| Maya | Ethics & Social Impact | Coral |
| Ada | Technology & Engineering | Purple |
| Russell | Marketing & Brand | Teal |

---

## 6. Content Page (`content.html`)

### Layout
```
[Nav bar]
┌─────────────────────────────────────────────────┐
│ Content Management                               │
│ [Blog] [Newsletter] [Copy] [Calendar] [Media]   │
├─────────────────────────────────────────────────┤
│ (sub-tab content area)                           │
└─────────────────────────────────────────────────┘
```

### Blog Sub-tab
```javascript
// Blog posts
const resp = await fetch(
  `${SB_URL}/rest/v1/landing_page_events?brand_id=eq.carlton&event_type=eq.blog_publish&select=*&order=created_at.desc`,
  { headers }
);
```

### Copy Sub-tab
```javascript
// Copy drafts
const resp = await fetch(
  `${SB_URL}/rest/v1/copy_drafts?brand_id=eq.carlton&select=*&order=created_at.desc`,
  { headers }
);

// Approve/reject
await fetch('https://n8n.carltonaiservices.com/webhook/copywrite-approve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ draft_id: id, action: 'approve', feedback: '' })
});
```

### Calendar Sub-tab
```javascript
// Content calendar
const resp = await fetch(
  `${SB_URL}/rest/v1/social_content_queue?brand_id=eq.carlton&scheduled_for=gte.${startOfMonth}&scheduled_for=lte.${endOfMonth}&select=*&order=scheduled_for`,
  { headers }
);
```

### Media Sub-tab (if Option B chosen)
See section 7 below — same content, embedded as a sub-tab instead of standalone page.

---

## 7. Media Page (`media.html` or Content sub-tab)

### Layout
```
[Nav bar]  (or sub-tab within Content)
┌─────────────────────────────────────────────────┐
│ Media Gallery                  [Generate Image]  │
│ [All] [Icons] [Logos] [UGC] [Product] [People]  │
├─────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│ │ img │ │ img │ │ img │ │ img │               │
│ │logo │ │icon │ │ugc  │ │gen  │               │
│ │date │ │date │ │date │ │date │               │
│ └─────┘ └─────┘ └─────┘ └─────┘               │
└─────────────────────────────────────────────────┘
```

### Supabase Reads
```javascript
// Gallery (with optional image_type filter)
const filter = imageType !== 'all' ? `&image_type=eq.${imageType}` : '';
const resp = await fetch(
  `${SB_URL}/rest/v1/image_sessions?brand_id=eq.carlton&status=eq.complete${filter}&select=*&order=created_at.desc&limit=50`,
  { headers }
);
const images = await resp.json();
```

### Webhook (generate image)
```javascript
const resp = await fetch('https://n8n.carltonaiservices.com/webhook/gemini-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brand_id: 'carlton',
    image_type: selectedType,     // general, icon, logo, ugc, product_mockup, person, bradford
    prompt: promptText,
    aspect_ratio: selectedRatio   // 1:1, 16:9, 9:16, 4:3
  })
});
// Returns: { success, image_url, file_id }
```

---

## 8. Nav Bar Update

When adding new pages, update the nav HTML in **every existing `.html` file** (nav is copy-pasted, not a shared component).

### New tab entries to add:
```html
<!-- Add between Offers and DEFT (or wherever chosen) -->
<a href="/content" class="nav-tab" data-page="content">Content</a>
<a href="/media" class="nav-tab" data-page="media">Media</a>
<a href="/council" class="nav-tab" data-page="council">Council</a>
```

Active tab detection uses the current URL path — each page checks `window.location.pathname` and adds the active class to the matching tab.

---

## 9. Checklist

- [ ] Create `council.html` with auth gate, theme loader, nav bar
- [ ] Create `content.html` with sub-tabs (Blog, Newsletter, Copy, Calendar, Media)
- [ ] Create `media.html` (if standalone) or integrate into Content sub-tab
- [ ] Update nav bar HTML in ALL existing pages (add new tabs)
- [ ] Deploy to GitHub repo → Coolify auto-deploys to `rdgr.bradfordcarlton.com`
- [ ] Test auth gate, theme, and data loading on each new page
