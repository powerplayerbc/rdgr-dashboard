# Unified CRM System — Frontend Integration Guide

> **Built:** 2026-03-16 | **Author:** Claude (Opus 4.6) + Bradford Carlton
> **Purpose:** Reference for frontend developers building UI on top of the Carlton AI Unified CRM

---

## What Was Built

A complete CRM system that unifies all contact data across 7+ acquisition channels into a single Supabase-backed database, exposed through an n8n webhook API and direct Supabase PostgREST access.

### System Architecture

```
Frontend (React/Next.js/etc.)
    |
    |--- READ operations ---> Supabase PostgREST (direct, fast)
    |                          https://yrwrswyjawmgtxrgbnim.supabase.co/rest/v1/
    |
    |--- WRITE operations --> CRM-BRIDGE webhook (validates, deduplicates, logs)
                              POST https://n8n.carltonaiservices.com/webhook/rdgr-crm
```

**Read directly from Supabase** for dashboard displays, lists, and search. **Write through CRM-BRIDGE** for any contact creation, updates, interaction logging, or lifecycle changes — it handles deduplication, engagement scoring, and audit trails.

---

## Authentication

### Supabase (for reads)
```javascript
const SUPABASE_URL = 'https://yrwrswyjawmgtxrgbnim.supabase.co';
const SUPABASE_ANON_KEY = '<anon-key-from-supabase-dashboard>';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};
```

### CRM-BRIDGE (for writes)
No authentication required on the webhook — it's an internal service. Just POST JSON:
```javascript
const CRM_URL = 'https://n8n.carltonaiservices.com/webhook/rdgr-crm';
// No API key needed — webhook is open (secured by network)
```

---

## Database Tables

### unified_contacts (Primary CRM table)
The single source of truth for all contacts.

| Column | Type | Description |
|--------|------|-------------|
| `contact_id` | TEXT | Primary ID: `C_yymmddhhmmss` |
| `email` | TEXT | Email (primary dedup key) |
| `phone` | TEXT | Phone number |
| `first_name` | TEXT | First name |
| `last_name` | TEXT | Last name |
| `company` | TEXT | Company name |
| `business_name` | TEXT | Business name (alias) |
| `title` | TEXT | Job title |
| `address` | TEXT | Full address |
| `acquisition_source` | TEXT | How they entered: `inbound_call`, `prospecting`, `organic`, etc. |
| `offer_interest` | TEXT | `low_ticket`, `mid_ticket`, `high_ticket`, `unknown` |
| `lifecycle_stage` | TEXT | `subscriber`, `lead`, `mql`, `sql`, `opportunity`, `customer`, `evangelist`, `churned` |
| `engagement_level` | TEXT | `inactive`, `cold`, `warm`, `active`, `hot` (computed) |
| `engagement_score` | INT | 0-100 composite score (computed) |
| `contact_type` | TEXT | `prospect`, `lead`, `customer`, `partner`, `partner_contact`, `internal`, `vendor` |
| `tags` | TEXT[] | Free-form tag array |
| `do_not_contact` | BOOLEAN | Hard DNC flag |
| `dnc_channels` | TEXT[] | Per-channel opt-out |
| `opted_in` | BOOLEAN | Marketing consent |
| `total_revenue` | NUMERIC | Lifetime revenue |
| `ltv_estimate` | NUMERIC | Estimated lifetime value |
| `last_interaction_at` | TIMESTAMPTZ | When last touched |
| `interaction_count` | INT | Total interactions |
| `created_at` | TIMESTAMPTZ | First entered system |
| `updated_at` | TIMESTAMPTZ | Last modified |

### contact_interactions (Touchpoint log)
Every email, call, meeting, chat, social interaction.

| Column | Type | Description |
|--------|------|-------------|
| `interaction_id` | TEXT | `INT_yymmddhhmmss_NNN` |
| `contact_id` | TEXT | FK to unified_contacts |
| `channel` | TEXT | `email_inbound`, `email_outbound`, `phone_inbound`, `phone_outbound`, `website_chat`, `meeting`, `social`, `manual`, etc. |
| `interaction_type` | TEXT | `sent`, `received`, `answered`, `booked`, `attended`, etc. |
| `direction` | TEXT | `inbound`, `outbound`, `internal` |
| `summary` | TEXT | Human-readable description |
| `details` | JSONB | Channel-specific metadata |
| `created_at` | TIMESTAMPTZ | When it happened |

### contact_lifecycle_log (Stage transitions)
Audit trail of every lifecycle change.

| Column | Type | Description |
|--------|------|-------------|
| `contact_id` | TEXT | FK to unified_contacts |
| `from_stage` | TEXT | Previous stage |
| `to_stage` | TEXT | New stage |
| `changed_by` | TEXT | Who/what made the change |
| `reason` | TEXT | Why |
| `created_at` | TIMESTAMPTZ | When |

### crm_email_sequences / crm_sequence_enrollments
Drip campaign definitions and contact enrollments.

---

## Frontend Read Patterns (Direct Supabase)

### Contact List with Filters
```javascript
// All contacts, sorted by engagement score
const contacts = await fetch(
  `${SUPABASE_URL}/rest/v1/unified_contacts?` +
  `merged_into=is.null&` +
  `order=engagement_score.desc&` +
  `select=contact_id,first_name,last_name,email,phone,company,` +
  `lifecycle_stage,engagement_level,engagement_score,tags,` +
  `last_interaction_at,acquisition_source,offer_interest&` +
  `limit=50`,
  { headers }
).then(r => r.json());
```

### Filter by Lifecycle Stage
```javascript
// All SQLs (Sales Qualified Leads)
const sqls = await fetch(
  `${SUPABASE_URL}/rest/v1/unified_contacts?` +
  `lifecycle_stage=eq.sql&merged_into=is.null&` +
  `order=engagement_score.desc`,
  { headers }
).then(r => r.json());
```

### Filter by Engagement Level
```javascript
// Hot leads (engagement score 75+)
const hotLeads = await fetch(
  `${SUPABASE_URL}/rest/v1/unified_contacts?` +
  `engagement_level=eq.hot&merged_into=is.null`,
  { headers }
).then(r => r.json());
```

### Search by Name/Email/Company
```javascript
// Free-text search (use CRM-BRIDGE for complex search)
const results = await fetch(CRM_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task_id: `ui-search-${Date.now()}`,
    brand_id: 'carlton',
    domain: 'crm',
    operation: 'search_contacts',
    parameters: { query: 'Carlton', limit: 20 }
  })
}).then(r => r.json());
// results.result.contacts = [...]
// results.result.total_count = N
```

### Contact Detail (360 View)
```javascript
const profile = await fetch(CRM_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task_id: `ui-360-${Date.now()}`,
    brand_id: 'carlton',
    domain: 'crm',
    operation: 'get_contact_360',
    parameters: { contact_id: 'C_260316020316' }
  })
}).then(r => r.json());

// profile.result.contact = { full contact record }
// profile.result.interactions = [ last 20 interactions ]
// profile.result.pipeline_deals = [ active deals ]
// profile.result.lifecycle_history = [ stage transitions ]
// profile.result.engagement_summary = { total, channels, first/last touch }
```

### Interaction Timeline (for a contact)
```javascript
const timeline = await fetch(
  `${SUPABASE_URL}/rest/v1/contact_interactions?` +
  `contact_id=eq.C_260316020316&` +
  `order=created_at.desc&` +
  `limit=50`,
  { headers }
).then(r => r.json());
```

### Dashboard Metrics (Plan Snapshot)
```javascript
const snapshot = await fetch(
  `${SUPABASE_URL}/rest/v1/rpc/crm_plan_snapshot`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_brand_id: 'carlton' })
  }
).then(r => r.json());

// snapshot.total_contacts = 4
// snapshot.new_contacts_24h = 4
// snapshot.by_lifecycle_stage = { sql: 2, lead: 1, subscriber: 1 }
// snapshot.by_engagement_level = { cold: 2, warm: 1, active: 1 }
// snapshot.by_acquisition_source = { inbound_call: 1, prospecting: 1, ... }
// snapshot.hot_leads = [ top 10 hot leads ]
```

### Attribution Report
```javascript
const attribution = await fetch(CRM_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task_id: `ui-attr-${Date.now()}`,
    brand_id: 'carlton',
    domain: 'crm',
    operation: 'attribution_report',
    parameters: { date_from: '2026-01-01', date_to: '2026-03-31' }
  })
}).then(r => r.json());

// attribution.result.report = [
//   { acquisition_source: 'inbound_call', contact_count: 1, customer_count: 0,
//     total_revenue: 0, avg_engagement_score: 72, hot_count: 0, pipeline_count: 1 }
// ]
```

---

## Frontend Write Patterns (CRM-BRIDGE Webhook)

All writes go through `POST https://n8n.carltonaiservices.com/webhook/rdgr-crm`.

### Create/Update Contact
```javascript
async function upsertContact(contactData) {
  const resp = await fetch(CRM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: `ui-upsert-${Date.now()}`,
      brand_id: 'carlton',
      domain: 'crm',
      operation: 'upsert_contact',
      parameters: { contact: contactData }
    })
  });
  const data = await resp.json();
  // data.result.contact_id = 'C_260316020316'
  // data.result.is_new = true/false
  // data.result.match_method = 'none'/'email'/'phone'/'name_company'
  return data;
}

// Usage:
await upsertContact({
  email: 'john@acme.com',
  first_name: 'John',
  last_name: 'Smith',
  company: 'Acme Inc',
  phone: '+15551234567',
  acquisition_source: 'website_chat',
  lifecycle_stage: 'lead',
  tags: ['website-inquiry']
});
```

### Log Interaction
```javascript
async function logInteraction(contactId, channel, type, direction, summary, details = {}) {
  return fetch(CRM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: `ui-interaction-${Date.now()}`,
      brand_id: 'carlton',
      domain: 'crm',
      operation: 'log_interaction',
      parameters: {
        contact_id: contactId,
        channel,        // 'email_outbound', 'phone_inbound', 'meeting', 'social', etc.
        interaction_type: type,  // 'sent', 'received', 'booked', 'attended', etc.
        direction,      // 'inbound', 'outbound'
        summary,
        details
      }
    })
  }).then(r => r.json());
}
```

### Update Lifecycle Stage
```javascript
async function updateLifecycle(contactId, newStage, reason) {
  return fetch(CRM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: `ui-lifecycle-${Date.now()}`,
      brand_id: 'carlton',
      domain: 'crm',
      operation: 'update_lifecycle',
      parameters: {
        contact_id: contactId,
        new_stage: newStage,  // 'lead', 'mql', 'sql', 'opportunity', 'customer', etc.
        changed_by: 'dashboard_user',
        reason
      }
    })
  }).then(r => r.json());
}
```

### Recompute Engagement Score
```javascript
// Call after logging interactions to refresh the score
async function refreshEngagement(contactId) {
  return fetch(CRM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: `ui-engage-${Date.now()}`,
      brand_id: 'carlton',
      domain: 'crm',
      operation: 'compute_engagement',
      parameters: { contact_id: contactId }
    })
  }).then(r => r.json());
}
```

### Check DNC Before Outbound
```javascript
async function checkDNC(contactId) {
  const resp = await fetch(CRM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: `ui-dnc-${Date.now()}`,
      brand_id: 'carlton',
      domain: 'crm',
      operation: 'check_dnc',
      parameters: { contact_id: contactId }
    })
  }).then(r => r.json());
  return {
    canContact: !resp.result.do_not_contact && resp.result.opted_in,
    blockedChannels: resp.result.dnc_channels || []
  };
}
```

---

## Human Task System (Dashboard Integration)

The RDGR system creates tasks that require human action. The dashboard should display these and allow completion/refusal.

### Fetch Human Tasks
```javascript
const humanTasks = await fetch(
  `${SUPABASE_URL}/rest/v1/directive_tasks?` +
  `requires_human=eq.true&` +
  `status=in.(ready,awaiting_human,in_progress)&` +
  `order=created_at.desc`,
  { headers }
).then(r => r.json());
```

### Complete a Human Task
```javascript
async function completeHumanTask(taskId, directiveId, notes, channel, platform) {
  const payload = {
    task_id: taskId,
    directive_id: directiveId,
    brand_id: 'carlton',
    domain: 'human',
    success: true,
    status: 'completed',
    result: {
      summary: `Human completed: ${notes.substring(0, 100)}`,
      details: notes,
      artifacts: [],
      metrics: { completed_by: 'human', channel, platform }
    },
    source_table: 'directive_tasks'
  };

  // Log CRM interaction if channel + contact provided
  if (channel && taskPayload?.parameters?.contact_id) {
    await fetch(CRM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: `human-${Date.now()}`,
        brand_id: 'carlton',
        domain: 'crm',
        operation: 'log_interaction',
        parameters: {
          contact_id: taskPayload.parameters.contact_id,
          channel,
          interaction_type: 'task_completed',
          direction: channel.includes('outbound') ? 'outbound' : 'inbound',
          summary: notes,
          details: { platform, task_id: taskId }
        }
      })
    });
  }

  return fetch('https://n8n.carltonaiservices.com/webhook/rdgr-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json());
}
```

### Refuse a Human Task
```javascript
async function refuseHumanTask(taskId, directiveId, reason) {
  return fetch('https://n8n.carltonaiservices.com/webhook/rdgr-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      directive_id: directiveId,
      brand_id: 'carlton',
      domain: 'human',
      success: false,
      status: 'refused',
      result: {
        summary: `Human refused: ${reason.substring(0, 100)}`,
        details: reason,
        metrics: { refused_by: 'human', reason }
      },
      source_table: 'directive_tasks'
    })
  }).then(r => r.json());
}
```

---

## Engagement Score System

Scores are computed automatically by `crm_compute_engagement` RPC.

### Formula (0-100)
| Component | Max Points | How It Works |
|-----------|-----------|-------------|
| **Recency** | 40 | Last interaction: <7d=40, <14d=30, <30d=20, <60d=10, >60d=0 |
| **Frequency** | 30 | `min(interactions_in_30d * 6, 30)` |
| **Depth** | 30 | Channel variety: meeting=10, call=10, email_reply=5, social=5, email_send=2, chat=3 (capped at 30) |

### Engagement Levels
| Level | Score Range | Color Suggestion |
|-------|------------|-----------------|
| `hot` | 75-100 | Red/Orange |
| `active` | 50-74 | Green |
| `warm` | 25-49 | Yellow |
| `cold` | 1-24 | Blue |
| `inactive` | 0 | Grey |

### Auto-Decay
CRM-ENGAGEMENT-DECAY runs daily at 7:00 AM PT. It re-scores contacts whose engagement has gone stale, automatically downgrading them as time passes without interactions.

---

## Unsubscribe Flow

All outbound emails should include an unsubscribe link:

```
https://n8n.carltonaiservices.com/webhook/crm-unsubscribe?contact_id=C_260316020316&channel=email
```

When clicked, the system:
1. Sets `opted_in: false` on the contact
2. Logs the unsubscribe event
3. Cancels any active email sequence enrollments
4. Shows a branded HTML confirmation page

---

## Suggested Frontend Pages

### 1. Contact List / CRM Dashboard
- Table view with sortable columns (name, company, stage, engagement, source)
- Filter sidebar: lifecycle stage, engagement level, acquisition source, tags
- Search bar (calls `search_contacts`)
- Engagement score as a colored badge
- Quick actions: change stage, log interaction, view 360

### 2. Contact 360 View
- Header: name, company, title, phone, email, tags
- Engagement score + level badge + breakdown (recency/frequency/depth)
- Lifecycle stage timeline (from `contact_lifecycle_log`)
- Interaction timeline (from `contact_interactions`)
- Active sequence enrollments
- Pipeline deals
- DNC status
- Notes section

### 3. Pipeline Board (Kanban)
- Columns: subscriber, lead, mql, sql, opportunity, customer
- Cards: contact name, company, engagement badge, last interaction date
- Drag-and-drop to change lifecycle stage (calls `update_lifecycle`)

### 4. Attribution Dashboard
- Bar chart: contacts by acquisition source
- Table: source, contact count, customer count, avg engagement, pipeline count
- Date range picker

### 5. Human Tasks Panel
- Pending tasks requiring human action
- "Mark Complete" with notes + interaction logging
- "Refuse" with reason
- Badge count in nav bar

### 6. Email Sequences Manager
- List of sequences with status (draft/active/paused)
- Enrollment count per sequence
- Step timeline visualization
- Enroll/pause/cancel buttons

---

## Key Endpoints Summary

| Action | Method | URL | Auth |
|--------|--------|-----|------|
| Read contacts | GET | `{SUPABASE}/rest/v1/unified_contacts?...` | Supabase anon key |
| Read interactions | GET | `{SUPABASE}/rest/v1/contact_interactions?...` | Supabase anon key |
| Read lifecycle log | GET | `{SUPABASE}/rest/v1/contact_lifecycle_log?...` | Supabase anon key |
| Read human tasks | GET | `{SUPABASE}/rest/v1/directive_tasks?requires_human=eq.true&...` | Supabase anon key |
| CRM plan snapshot | POST | `{SUPABASE}/rest/v1/rpc/crm_plan_snapshot` | Supabase anon key |
| Create/update contact | POST | `{N8N}/webhook/rdgr-crm` | None |
| Log interaction | POST | `{N8N}/webhook/rdgr-crm` | None |
| Update lifecycle | POST | `{N8N}/webhook/rdgr-crm` | None |
| Search contacts | POST | `{N8N}/webhook/rdgr-crm` | None |
| Get contact 360 | POST | `{N8N}/webhook/rdgr-crm` | None |
| Compute engagement | POST | `{N8N}/webhook/rdgr-crm` | None |
| Check DNC | POST | `{N8N}/webhook/rdgr-crm` | None |
| GDPR export | POST | `{N8N}/webhook/rdgr-crm` | None |
| GDPR delete | POST | `{N8N}/webhook/rdgr-crm` | None |
| Complete human task | POST | `{N8N}/webhook/rdgr-complete` | None |
| Refuse human task | POST | `{N8N}/webhook/rdgr-complete` | None |
| Create sequence | POST | `{N8N}/webhook/crm-sequences` | None |
| Enroll in sequence | POST | `{N8N}/webhook/crm-sequences` | None |
| Unsubscribe | GET | `{N8N}/webhook/crm-unsubscribe?contact_id=...&channel=email` | None |
| Attribution report | POST | `{N8N}/webhook/rdgr-crm` | None |

Where:
- `{SUPABASE}` = `https://yrwrswyjawmgtxrgbnim.supabase.co`
- `{N8N}` = `https://n8n.carltonaiservices.com`

---

## All Times in Pacific Time (PT)

The system stores timestamps in UTC. When displaying to users, convert to PT:

```javascript
function toPT(utcString) {
  return new Date(utcString).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
}
// toPT('2026-03-16T02:36:16.085134+00:00') => "Mar 15, 2026, 7:36 PM"
```
