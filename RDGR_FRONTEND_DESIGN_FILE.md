# RDGR Dashboard System — Master Design Document

**Live URL:** `bradfordcarlton.com`
**Source:** `sites/rdgr-dashboard/` (index.html, crm.html)
**Deploy repo:** `~/Documents/carlton-ai-services-deploy/`
**Last updated:** 2026-03-19

---

## System Overview

The RDGR Dashboard is a multi-page autonomous operations center with 6 interconnected views:

| Page | Path | Source | Lines | Purpose |
|------|------|--------|-------|---------|
| Dashboard + Chat | `/rdgr` | `index.html` | ~3,560 | Task management, directives, command chat |
| CRM | `/crm` | `crm.html` → `crm/index.html` | ~2,700 | Contact management, outreach, prospecting |
| Org Map | `/org-chart` | `org-chart.html` | ~1,608 | Agent hierarchy, build backlog |
| Workflows | `/our-workflows` | `our-workflows.html` | ~896 | System registry browser |
| Social | `/social-dashboard` | `social-dashboard.html` | ~1,988 | Content queue, calendar, approvals |

All pages share: auth gate (`Advance1!`), dark theme, Tailwind CDN, Supabase anon key, same color system.

---

## Shared Infrastructure

### Authentication
- Password: `Advance1!`
- Session key: `sessionStorage['registry-auth']`
- URL param: `?auth=rdgr` passed between page links
- No persistent login — cleared on browser close

### Supabase
- **Instance:** `https://yrwrswyjawmgtxrgbnim.supabase.co`
- **Anon key:** embedded in each HTML file
- **Access:** PostgREST (REST API) — no Supabase JS client library
- **Pattern:** Reads via GET, writes via POST/PATCH/DELETE with `Prefer: return=representation`

### n8n Webhooks
- **Base:** `https://n8n.carltonaiservices.com/webhook/`
- **Pattern:** POST with JSON body, retry on 5xx (2 retries, exponential backoff)

### Theme
| Token | Hex | Usage |
|-------|-----|-------|
| `base` | `#08090D` | Page background |
| `surface` | `#11131A` | Panels |
| `surface-el` | `#1A1D28` | Elevated surfaces |
| `border` | `#2A2E3D` | Borders |
| `accent` | `#06D6A0` | Brand green |
| `alert` | `#FF6B6B` | Error red |
| `warn` | `#FFD93D` | Warning yellow |
| `info` | `#4CC9F0` | Info blue |
| `txt` | `#E8ECF1` | Primary text |
| `txt-2` | `#8A95A9` | Secondary text |
| `txt-3` | `#525E73` | Muted text |

### Typography
| Role | Font |
|------|------|
| Headings | Chakra Petch |
| Body | IBM Plex Sans |
| Mono | JetBrains Mono |

### Visual Effects
- SVG noise grain overlay (fixed, 0.04 opacity)
- Custom 6px scrollbar
- Pulse dot for system status

### Shared CSS Classes
| Class | Purpose |
|-------|---------|
| `.panel` / `.panel-header` / `.panel-body` | Card containers |
| `.badge` + variants | Status indicators |
| `.btn-primary/approve/deny/modify/ghost/warn` | Buttons |
| `.form-input` | Input fields |
| `.modal-backdrop` / `.modal-content` | Modal system |
| `.toast-success` / `.toast-error` | Notifications |
| `.stat-chip` / `.stat-value` / `.stat-label` | Metric display |
| `.empty-state` | No-data placeholder |
| `.skeleton` | Loading shimmer |
| `.task-tab` | Nav pill tabs |

---

## Page 1: Dashboard + Chat (`index.html`)

### Navigation
```
[pulse] RDGR Command Center  |  Dashboard | Chat | Org Map | Workflows | Social | CRM  |  [New Task] [Refresh]
```

### Dashboard View (`#dashboardView`)

#### Stats Bar
| ID | Label | Source |
|----|-------|--------|
| `#statActive` | Active | `directive_tasks` count (in_progress) |
| `#statReview` | Needs Review | `directive_tasks` count (requires_human) |
| `#statCompleted` | Completed Today | `autonomous_execution_log` count |
| `#statFailed` | Failed Today | `autonomous_execution_log` count |
| `#statBlocked` | Blocked | `directive_tasks` count (blocked) |

#### Workflow Control (`#wfPanel`)
- Collapsible panel with quick-activate buttons (All/Core/Infrastructure)
- Grid of individual workflow toggles from `system_registry`
- Calls `rdgr-activate` webhook

#### Directive Approvals (`#directivePanel`)
- Pending directives from `autonomous_directives` (status: pending_approval)
- Cards show: title, objective, risk level, priority (P1-P5), acceptance criteria, target domains, context (why_now, constraints, resources)
- Actions: Approve / Reject with feedback textarea
- Calls `rdgr-directive-action` webhook
- Active directives panel + decision history (collapsible)

#### Human Tasks (`#humanTasksPanel`)
- From `directive_tasks` where `requires_human=true, status in (pending, in_progress)`
- Dynamic action buttons from `parameters.action_options`
- Review content rendering (text, URL, comparison, document types)
- Inline CRM logging option (channel + platform selectors)
- Calls `human-action` webhook

#### Dashboard Grid
| Panel | ID | Source Table |
|-------|----|-------------|
| Human Review Queue | `#reviewPanel` | `human_review_queue` |
| Task Queue | `#taskPanel` | `directive_tasks` (filterable by status + domain) |
| Recent Activity | `#activityPanel` | `autonomous_execution_log` |
| System Health | `#healthPanel` | `autonomous_execution_log` (success/error rates) |
| Revenue | `#revenuePanel` | `autonomous_financial_snapshots` |

#### New Task Modal (`#taskModal`)
Two modes:
- **General Task:** title, description, domain dropdown, priority, notes → `rdgr-intake` webhook
- **Social Post:** topic, platform multi-select, tone, image prompt, notes → `rdgr-tool-social` webhook

### Chat View (`#chatView`)

#### Sidebar (`#chatSidebar`)
- Operator selector: bradford / dianna / brianna
- Theme toggle (dark/light mode)
- New Thread button
- Thread list from `command_threads` (ordered by last_message_at desc)

#### Chat Area
| Element | ID | Purpose |
|---------|----|---------|
| Header | `#chatHeader` | Thread title, rename, archive buttons |
| Messages | `#messageList` | Scrollable feed (human right-aligned, AI left-aligned) |
| Typing | `#typingIndicator` | 3-dot pulse animation |
| Input | `#chatInput` | Auto-resizing textarea |
| Attachments | `#chatFileInput` | File upload (5MB max, 3 files max) |

#### Chat Data Flow
```
User types → POST /webhook/rdgr-chat → GPT-5.1 processes → response saved to command_messages → frontend polls/renders
```

#### Chat Tables
| Table | Purpose | Access |
|-------|---------|--------|
| `command_threads` | Thread metadata | Direct Supabase read/write |
| `command_messages` | Message content | Direct Supabase read, webhook write |
| `command_thread_memory` | Context summaries | Direct Supabase read |

Thread ID format: `CT_YYMMDDHHmmss`
Message ID format: `CM_YYMMDDHHmmss_NNN`

### Dashboard Webhooks
| Webhook | Path | Purpose |
|---------|------|---------|
| `rdgr-intake` | `/webhook/rdgr-intake` | Submit new tasks |
| `rdgr-activate` | `/webhook/rdgr-activate` | Activate/deactivate workflows |
| `rdgr-directive-action` | `/webhook/rdgr-directive-action` | Approve/deny directives |
| `human-action` | `/webhook/human-action` | Human task actions |
| `rdgr-chat` | `/webhook/rdgr-chat` | Command chat messages |
| `rdgr-tool-social` | `/webhook/rdgr-tool-social` | Social media post tasks |
| `rdgr-crm` | `/webhook/rdgr-crm` | CRM operations |
| `rdgr-complete` | `/webhook/rdgr-complete` | Task completion (legacy) |

### Dashboard Supabase Tables
| Table | Purpose |
|-------|---------|
| `directive_tasks` | Tasks requiring action |
| `autonomous_directives` | Strategic directives |
| `autonomous_execution_log` | Activity log |
| `autonomous_financial_snapshots` | Revenue metrics |
| `human_review_queue` | Items for human review |
| `system_registry` | Workflow registry |
| `command_threads` | Chat threads |
| `command_messages` | Chat messages |
| `command_thread_memory` | Chat context |

---

## Page 2: CRM (`crm.html`)

### CRM Tab Bar
```
Contacts | Pipeline | Attribution | Sequences | Outreach | Prospecting
```

### Contacts Tab (`#view-contacts`)
- Table: Name, Company, Stage, Engagement, Source, Last Touch, Actions
- Search via `crmBridge('search_contacts')`
- Filters: lifecycle stage, engagement level
- 50 per page with Load More
- Row click → 360 slide-out panel
- Sort by clicking column headers (client-side)

### Pipeline Tab (`#view-pipeline`)
- Kanban board: Subscriber → Prospect → Lead → MQL → SQL → Opportunity → Customer
- HTML5 drag-and-drop between columns
- Drop calls `crmBridge('update_lifecycle')`
- Stage colors: subscriber=#9CA3AF, prospect=#2DD4BF, lead=#60A5FA, mql=#4CC9F0, sql=#A855F7, opportunity=#FFD93D, customer=#06D6A0

### Attribution Tab (`#view-attribution`)
- Date range picker → `crmBridge('attribution_report')`
- Bar chart + table by acquisition source

### Sequences Tab (`#view-sequences`)
- List from `crm_email_sequences` — name, status, step count

### Outreach Tab (`#view-outreach`)
**Filter pills:** Pending (default) | Approved | Rejected | Skipped | Sent | All

- Drafts from `copy_drafts` table
- Cards: status badge, recipient info (from context JSONB), subject, body preview
- Card click → email preview modal
- Quick actions: Approve / Reject / Skip (with stopPropagation)
- "All" view de-duplicates by contact_id (shows only latest revision)
- Email preview modal shows: To, Subject, Score, Website (fetched from `unified_contacts`), Body, Reviewer Notes
- Actions call `prosp-outreach-approved` webhook

### Prospecting Tab (`#view-prospecting`)
Four panels, direct Supabase CRUD:

| Section | Table | Columns |
|---------|-------|---------|
| Target Locations | `prosp_target_locations` | city, state_abbr, zone_type, weight, is_active |
| Target Categories | `prosp_target_categories` | industry_group, search_term, sub_category, keywords[], weight, is_active |
| Linked Sheets | `prosp_linked_sheets` | label, sheet_url, sheet_name, last_checked_at, last_row_count, is_active |
| Lead Import | webhook | JSON array or Google Sheets URL → `prosp-lead-import` |

### 360 Slide-Out Panel
- `#panel360` (75% width, max 900px, slides from right)
- Sections: Contact info, Engagement score breakdown (recency/frequency/depth), Lifecycle history, Interaction timeline, Action buttons

### CRM Modals
| ID | Purpose |
|----|---------|
| `#logInteractionModal` | Log interaction (channel, direction, summary) |
| `#changeStageModal` | Change lifecycle stage (dropdown + reason) |
| `#emailPreviewModal` | Full email preview + approve/reject/skip |

### CRM Stats Bar
| ID | Label | Source |
|----|-------|--------|
| `#statContacts` | Contacts | `crm_plan_snapshot` RPC |
| `#statNew24h` | New (24h) | `crm_plan_snapshot` RPC |
| `#statHot` | Hot Leads | `crm_plan_snapshot` RPC |
| `#statSequences` | Sequences | `crm_email_sequences` count |
| `#statOutreach` | Drafts Pending | `copy_drafts` count |

### CRM Webhooks
| Webhook | Purpose |
|---------|---------|
| `rdgr-crm` | CRM-BRIDGE (search, 360, log interaction, update lifecycle, attribution) |
| `prosp-outreach-approved` | Approve/reject/skip outreach drafts |
| `prosp-lead-import` | Import leads from JSON or Google Sheets |

### CRM Supabase Tables
| Table | Access | Purpose |
|-------|--------|---------|
| `unified_contacts` | Read | Contact data, pipeline, website lookup |
| `copy_drafts` | Read | Outreach email drafts |
| `crm_email_sequences` | Read | Email sequences |
| `prosp_target_locations` | Read/Write | Prospecting locations |
| `prosp_target_categories` | Read/Write | Prospecting categories |
| `prosp_linked_sheets` | Read/Write | Linked Google Sheets |

### CRM-BRIDGE Operations
| Operation | Parameters |
|-----------|-----------|
| `search_contacts` | `{ query, limit }` |
| `get_contact_360` | `{ contact_id }` |
| `log_interaction` | `{ contact_id, channel, direction, summary, interaction_type, details }` |
| `compute_engagement` | `{ contact_id }` |
| `update_lifecycle` | `{ contact_id, new_stage, changed_by, reason }` |
| `attribution_report` | `{ date_from, date_to }` |

---

## Page 3: Org Map (`org-chart.html`)

- D3.js-based organization chart
- Data from `get_org_chart` RPC
- Agent roles with workflow associations from `agent_role_workflows` (joined with `system_registry`)
- Build backlog from `get_build_backlog` RPC
- Build prompt generator via `generate_build_prompt` RPC

### Key Functions
| Function | Purpose |
|----------|---------|
| `refreshData()` | Fetches org chart + role workflows + build backlog |
| `generateBuildPrompt(roleKey)` | Gets AI-generated build prompt for a role |

### Tables
| Table | Purpose |
|-------|---------|
| `agent_role_workflows` | Role → workflow mappings |
| `system_registry` | Workflow metadata |
| `get_org_chart` (RPC) | Hierarchical org data |
| `get_build_backlog` (RPC) | Pending builds by department |
| `generate_build_prompt` (RPC) | AI build prompt generation |

---

## Page 4: Workflows (`our-workflows.html`)

- System registry browser
- Fetches all entries from `system_registry` ordered by category + name
- Displays: name, category, status, metadata
- Read-only view — no CRUD from this page

### Tables
| Table | Purpose |
|-------|---------|
| `system_registry` | All registered workflows, credentials, utilities, capabilities |

---

## Page 5: Social Dashboard (`social-dashboard.html`)

- Social media content queue management
- Calendar configuration
- Post approval/denial/retry workflow

### Key Functions
| Function | Purpose |
|----------|---------|
| `refreshData()` | Fetches content queue + calendar config |
| `writeApi(action, payload)` | Webhook-based write operations |
| `approvePost(id)` | Approve pending social post |
| `denyPost(id)` | Deny post |
| `retryPost(id)` | Retry failed post |
| `deletePost(id)` | Delete post |
| `saveEdit(id)` | Save edited post content |
| `confirmSchedule()` | Schedule post for future |
| `bulkApprove()` | Approve all pending posts |
| `loadBase64Image(sessionId, el)` | Load AI-generated images from `image_sessions` |

### Tables
| Table | Access | Purpose |
|-------|--------|---------|
| `social_content_queue` | Read/Write | Posts pending approval, scheduled, published |
| `social_calendar_config` | Read | Calendar settings (posting schedule) |
| `image_sessions` | Read | AI-generated images (base64) |

---

## Complete Supabase Table Reference

### Dashboard Tables
| Table | Used By | Access |
|-------|---------|--------|
| `directive_tasks` | Dashboard, CRM (human tasks) | Read |
| `autonomous_directives` | Dashboard | Read |
| `autonomous_execution_log` | Dashboard | Read |
| `autonomous_financial_snapshots` | Dashboard | Read |
| `human_review_queue` | Dashboard | Read |
| `system_registry` | Dashboard, Workflows, Org Map | Read |
| `command_threads` | Chat | Read/Write |
| `command_messages` | Chat | Read |
| `command_thread_memory` | Chat | Read |

### CRM Tables
| Table | Used By | Access |
|-------|---------|--------|
| `unified_contacts` | CRM (contacts, pipeline, 360, outreach) | Read (via CRM-BRIDGE for writes) |
| `contact_interactions` | CRM (360 panel) | Via CRM-BRIDGE |
| `contact_lifecycle_log` | CRM (360 panel) | Via CRM-BRIDGE |
| `copy_drafts` | CRM (outreach) | Read |
| `crm_email_sequences` | CRM (sequences) | Read |

### Prospecting Tables
| Table | Used By | Access |
|-------|---------|--------|
| `prosp_target_locations` | CRM (prospecting) | Read/Write |
| `prosp_target_categories` | CRM (prospecting) | Read/Write |
| `prosp_linked_sheets` | CRM (prospecting) | Read/Write |

### Social Tables
| Table | Used By | Access |
|-------|---------|--------|
| `social_content_queue` | Social Dashboard | Read/Write |
| `social_calendar_config` | Social Dashboard | Read |
| `image_sessions` | Social Dashboard | Read |

### Org Map Tables
| Table | Used By | Access |
|-------|---------|--------|
| `agent_role_workflows` | Org Map | Read |

### RPCs
| Function | Used By | Purpose |
|----------|---------|---------|
| `crm_plan_snapshot` | CRM stats | Dashboard metrics |
| `get_org_chart` | Org Map | Hierarchical org data |
| `get_build_backlog` | Org Map | Pending builds |
| `generate_build_prompt` | Org Map | AI prompt generation |

---

## Complete Webhook Reference

| Webhook Path | Used By | Purpose |
|-------------|---------|---------|
| `/webhook/rdgr-intake` | Dashboard | Submit new tasks |
| `/webhook/rdgr-activate` | Dashboard | Activate/deactivate workflows |
| `/webhook/rdgr-directive-action` | Dashboard | Approve/deny directives |
| `/webhook/human-action` | Dashboard, CRM | Human task actions |
| `/webhook/rdgr-chat` | Chat | Process chat messages |
| `/webhook/rdgr-tool-social` | Dashboard | Submit social post tasks |
| `/webhook/rdgr-crm` | CRM | CRM-BRIDGE operations |
| `/webhook/rdgr-complete` | Dashboard | Task completion (legacy) |
| `/webhook/prosp-outreach-approved` | CRM | Draft approve/reject/skip |
| `/webhook/prosp-lead-import` | CRM | Import leads (JSON/Sheets) |
| `/webhook/crm-sequences` | CRM | Email sequence operations |

---

## Constants

### Lifecycle Stages
```
subscriber → prospect → lead → mql → sql → opportunity → customer → evangelist
                                                              ↓
                                                           churned
```

### Outreach Draft Statuses
`draft` → `approved` / `rejected` / `skipped` / `sent`

### Engagement Score Tiers
| Tier | Range | Color |
|------|-------|-------|
| Hot | 75-100 | `#EF4444` |
| Active | 50-74 | `#06D6A0` |
| Warm | 25-49 | `#FFD93D` |
| Cold | 1-24 | `#60A5FA` |
| Inactive | 0 | `#6B7280` |

### Industry Groups (Prospecting)
`healthcare`, `legal`, `real_estate`, `home_services`, `professional_services`, `hospitality`, `auto`, `fitness`, `education`

### Chat Operators
`bradford`, `dianna`, `brianna`

### Domains (Task System)
`email`, `calendar`, `research`, `writing`, `sales`, `finance`, `thinking`, `toolbuild`, `crm`, `prospecting`

---

## Known Issues

| Issue | Impact | Status |
|-------|--------|--------|
| Draft `review_status` not updating after approve/reject | Outreach filter counts show 0 for Approved/Rejected/Sent | Backend fix needed in PROSP-OUTREACH-APPROVED workflow |
| `parent_draft_id` not set on revision drafts | Frontend works around this by grouping by contact_id | Backend fix needed |
| Attribution tab returns empty data | No attribution data shown | May be CRM-BRIDGE routing issue |
| Pipeline drag-and-drop on mobile | Touch devices can't use kanban | HTML5 Drag API limitation |
| Chat 30-second timeout | Long responses may be cut off | AbortController timeout |
| No Supabase Realtime | Data stale until manual refresh or 5-min auto-refresh | Could add subscriptions |

---

## Deployment

| Step | Command |
|------|---------|
| Serve locally | `node serve.mjs rdgr-dashboard` → localhost:3000 |
| Screenshot | `node screenshot.mjs rdgr-dashboard <label>` |
| Copy to deploy repo | `cp sites/rdgr-dashboard/<file> ~/Documents/carlton-ai-services-deploy/<path>` |
| Commit + push | `cd ~/Documents/carlton-ai-services-deploy && git add . && git commit && git push` |
| Trigger deploy | `curl -sk -X POST "$COOLIFY_URL/api/v1/applications/jggowccs84ccgcswcg8cwcos/restart" -H "Authorization: Bearer $COOLIFY_API_KEY"` |

**Coolify App UUID:** `jggowccs84ccgcswcg8cwcos`
**GitHub repo:** `powerplayerbc/carlton-ai-services`

### Deploy Path Mapping
| Source | Deploy Path | Live URL |
|--------|------------|----------|
| `index.html` | `rdgr/index.html` | `/rdgr` |
| `crm.html` | `crm/index.html` | `/crm` |
| `org-chart.html` | `org-chart.html` | `/org-chart` |
| `our-workflows.html` | `our-workflows.html` | `/our-workflows` |
| `social-dashboard.html` | `social-dashboard.html` | `/social-dashboard` |

---

## Related Documents

| Document | Location | Purpose |
|----------|----------|---------|
| CRM Integration Guide | `sites/rdgr-dashboard/CRM_FRONTEND_INTEGRATION_GUIDE.md` | CRM API patterns |
| Command Chat Guide | `sites/rdgr-dashboard/COMMAND_CHAT_INTEGRATION_GUIDE.md` | Chat webhook spec |
| Frontend Status | `sites/rdgr-dashboard/FRONTEND_BACKEND_STATUS.md` | Integration tracker |
| Outreach Backend Fix | `sites/rdgr-dashboard/OUTREACH_BACKEND_FIX.md` | Draft status fix spec |
| Human Task Integration | `sites/rdgr-dashboard/FRONTEND_HUMAN_TASK_INTEGRATION.md` | Task review patterns |
| Directive Action Spec | `sites/rdgr-dashboard/RDGR-DIRECTIVE-ACTION_INTEGRATION_SPEC.md` | Directive approve/deny |
| New Task Integration | `sites/rdgr-dashboard/NewTask_Integration.md` | Task submission API |
| CRM Schema | `Agentic Workflows/sql/crm_unified_schema.sql` | Database schema + RPCs |
| Session Schema | `Agentic Workflows/sql/session_20260317_schema.sql` | Zip codes, enrichment, copy_drafts |
| RDGR Workflow Map | `Agentic Workflows/docs/RDGR_WORKFLOW_MAP.md` | Full workflow architecture |
| Session Handoff (03-18) | `sites/rdgr-dashboard/SESSION_HANDOFF_20260318_PROSP_REBUILD.md` | PROSP rebuild context |
| Session Handoff (03-19) | `Agentic Workflows/docs/SESSION_HANDOFF_20260319_PROSP_PIPELINE_COMPLETION.md` | Pipeline completion |
