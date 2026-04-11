# Frontend Spec: Social Outreach Dashboard

## Overview

A page within the Carlton AI Hub approval-portal for managing social media outreach across 5 platforms (LinkedIn, Instagram, Facebook, Twitter/X, Reddit). Two queue types (DM + Engagement) with approval and action sub-queues, daily action counters per platform, and per-platform voice settings.

**Route:** `/social-outreach` (within `approval-portal/src/app/(portal)/social-outreach/page.tsx`)
**Auth:** Same Supabase auth gate as other portal pages

---

## 1. Supabase Connection

```
SUPABASE_URL = https://yrwrswyjawmgtxrgbnim.supabase.co
SUPABASE_ANON_KEY = (same key used in portal)
```

---

## 2. Page Structure

```
HEADER: "Social Outreach" | Daily Counter Strip | Settings gear
TAB BAR: [DM Queue] [Engagement Queue]
SUB-TABS: [Needs Approval] [Ready to Act]
PLATFORM FILTERS: [All] [LinkedIn] [Instagram] [Facebook] [X] [Reddit]
BULK ACTIONS: (visible when items selected) [Approve All] [Skip All] [Clear]
QUEUE CARDS: scrollable list
```

---

## 3. API Contracts (all via Supabase RPCs)

### Load Daily Counters
```javascript
rpc('get_social_daily_counts', { p_brand_id: 'carlton' })
// Returns array: [{ platform, display_name, dm_count, dm_limit, engagement_count, engagement_limit, ... }]
```

### Load Queue Items
```javascript
rpc('get_pending_social_drafts', {
  p_brand_id: 'carlton',
  p_queue_type: 'approval' | 'action',
  p_platform: null | 'linkedin' | 'instagram' | 'facebook' | 'twitter' | 'reddit',
  p_outreach_type: 'dm' | 'engagement',
  p_limit: 50,
  p_offset: 0
})
// Returns { success, queue_type, total, drafts: [...] }
```

### Approve/Reject/Edit/Skip
```javascript
rpc('approve_social_draft', {
  p_draft_id: 123,
  p_action: 'approve' | 'reject' | 'edit' | 'redraft' | 'skip',
  p_brand_id: 'carlton',
  p_notes: 'optional feedback',
  p_edited_content: 'edited text (for edit action)',
  p_override_type: 'dm' | 'engagement' | null  // flip classification
})
```

### Mark Acted Upon
```javascript
rpc('increment_social_action', {
  p_brand_id: 'carlton',
  p_platform: 'linkedin',
  p_outreach_type: 'dm' | 'engagement',
  p_draft_id: 123,
  p_engagement_subtype: 'comment' | null
})
// Returns { success, dm_count, dm_limit, engagement_count, engagement_limit }
// Returns { success: false, error: 'Daily limit reached' } if at limit
```

### Redraft via Workflow
```javascript
// After marking as 'redraft' in DB, trigger the SOCIAL-APPROVED callback:
POST https://n8n.carltonaiservices.com/webhook/social-approved
{ action: 'reject', draft_id: 123, feedback: 'feedback text', brand_id: 'carlton' }
```

---

## 4. Queue Card Layout

### Approval Queue Card
```
[checkbox] [Platform Icon] Target Name, Title     [DM/ENG toggle] [Profile Link]
           Company | 2.4K followers | 150 posts | Score: 72

DRAFT MESSAGE (editable textarea when editing)
"Hi John, I noticed your recent post about..."

AI Reasoning (collapsible >) "John posted about needing better scheduling..."

[Approve] [Edit] [Redraft (1/3)] [Skip]     [Copy]
```

### Action Queue Card
```
[Platform Icon] Target Name                      [Profile Link]

FINAL MESSAGE
"Hi John, I noticed..."

[Copy to Clipboard] [Mark Acted Upon]
```

### Reddit Card Variant
Shows thread title, subreddit badge (r/smallbusiness), upvote count, and "Replying to:" context snippet.

---

## 5. Daily Counter Strip

Always visible in header. Per-platform badges showing `sent/limit today`.

**Color coding:**
- Green: < 70% of limit
- Amber: 70-99% of limit
- Red: at limit (shows "locked")

**Reset:** Implicit — date-based queries filter by `CURRENT_DATE` in Pacific Time. No cron needed.

---

## 6. Actions

| Action | Queue | Effect |
|--------|-------|--------|
| Approve | Approval | Sets `approval_status='approved'`, moves to action queue |
| Edit | Approval | Inline edit, then approve with `edited_content` |
| Redraft | Approval | Sends feedback to SOCIAL-APPROVED, triggers new GPT draft |
| Skip | Approval | Sets `approval_status='skipped'`, removed from queue |
| Copy | Both | `navigator.clipboard.writeText()`, toast confirmation |
| Flip DM/ENG | Approval | Toggles `outreach_type`, updates target too |
| Mark Acted Upon | Action | Increments daily counter, sets `action_status='acted'` |
| Bulk Approve | Approval | Approves all selected items |
| Bulk Skip | Approval | Skips all selected items |

---

## 7. Workflow IDs (for reference)

| Workflow | ID | Webhook |
|----------|-----|---------|
| SOCIAL-DISCOVER | `sOhP31ZCahnff6Am` | `social-discover` |
| SOCIAL-QUALIFY | `PIwk0KGM99ltC6Hc` | `social-qualify` |
| SOCIAL-DRAFT | `fZRUzqHCqUH5Vdnn` | `social-draft` |
| SOCIAL-APPROVED | `ZOx9x467QsOtsQ2D` | `social-approved` |
| SOCIAL-ACT | `ULiiG31R3AxCZEoW` | `social-act` |
| SOCIAL-ORCHESTRATOR | `iHz3BEBwQxqLbYWk` | `social-orchestrator` |
| SOCIAL-ERR | `7hcojpajgasufNMA` | (error trigger) |
| SOCIAL-REPLY | `dvVajZYblCluW14J` | `social-reply` |

---

## 8. Active Conversations View (Third Sub-Tab)

Add a third sub-tab alongside "Needs Approval" and "Ready to Act":

**Sub-tabs:** `[Needs Approval] [Ready to Act] [Active Conversations]`

### Query
```javascript
rpc('get_active_conversations', { p_brand_id: 'carlton', p_platform: filterPlatform || null })
// Returns { total, conversations: [...] }
```

### Card Layout (Active Conversation)
```
[Platform Icon] Primary_Ad_8130                    [Open Thread →]
               r/smallbusiness | 1 reply received | Last: 2h ago

YOUR MESSAGE (collapsible)
"Have you explored any integration options..."

THEIR REPLY
"That's a really good point. We're a small HVAC company..."

[pending_replies > 0?]
  DRAFTED RESPONSE (editable, needs approval)
  "Thanks for sharing a bit about your setup..."
  [Approve Response] [Edit] [Redraft] [Skip]

[Log New Reply]  ← opens modal to paste new reply text
```

### "Log New Reply" Modal
When the user receives a new reply on the platform, they:
1. Click "Log New Reply" on the conversation card
2. Paste the reply text into a textarea
3. Optionally enter the author name
4. Toggle "Auto-draft response" (default: on)
5. Submit → POST to `/webhook/social-reply`

```javascript
// Log a reply and get an auto-drafted response
const result = await fetch('https://n8n.carltonaiservices.com/webhook/social-reply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    draft_id: conversation.draft_id,
    reply_text: pastedText,
    author: authorName,
    platform: conversation.platform,
    brand_id: 'carlton',
    generate_response: true  // auto-draft a GPT response
  })
});
// Returns { success, reply_logged, response_drafted, draft_reply, conversation_id }
```

### Approving a Response Draft
Response drafts from `social_conversations` where `author_is_us=true AND approval_status='pending_review'` appear on the card. The user can:
- **Approve**: Update `social_conversations` row → `approval_status='approved'`
- **Edit**: Modify text inline, then approve
- **Redraft**: Re-call SOCIAL-REPLY with feedback
- **Copy**: Copy the response text to clipboard
- **Mark Sent**: After pasting on the platform, mark `action_status='acted'`

```javascript
// Approve a response draft
await supabase.from('social_conversations')
  .update({ approval_status: 'approved', approved_at: new Date().toISOString() })
  .eq('id', conversationId);

// Mark response as sent (after user pastes on platform)
await supabase.from('social_conversations')
  .update({ action_status: 'acted', acted_at: new Date().toISOString() })
  .eq('id', conversationId);
```

---

## 9. CRM Integration (Contact Social Tab)

The CRM contact detail page should include a **Social Activity** section/tab.

### Query (by contact_id or target_id)
```javascript
rpc('get_contact_social_timeline', {
  p_contact_id: 'C_260321070000',  // OR p_target_id: 18
  p_brand_id: 'carlton'
})
// Returns: { contact, targets[], drafts[], conversations[], total_outreach, total_replies }
```

### CRM Social Timeline Layout
```
SOCIAL ACTIVITY                                    [Log Reply]
─────────────────────────────────────────────────
[Reddit] r/smallbusiness                          Score: 70
  YOU commented on "Is automated software still..."
  → They replied: "We're a small HVAC company..."
  → YOUR DRAFT REPLY: "Thanks for sharing..." [Approve] [Copy]

[LinkedIn] connection request                     Score: 85
  YOU sent: "Hi Jane, noticed your work on..."
  → No response yet
─────────────────────────────────────────────────
Total: 2 outreach | 1 reply | Engagement Score: 65
```

### "Log Reply" from CRM
Same modal as the social tab, but uses `contact_id` instead of `draft_id`:

```javascript
await fetch('https://n8n.carltonaiservices.com/webhook/social-reply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contact_id: 'C_260321070000',  // finds most recent acted draft
    reply_text: pastedText,
    author: 'Their Name',
    brand_id: 'carlton',
    generate_response: true
  })
});
```

The workflow automatically:
1. Looks up the most recent acted draft for that contact
2. Logs the inbound reply
3. Bumps engagement score (+15)
4. Auto-promotes prospect → lead if applicable
5. Drafts a GPT response using full conversation history

---

## 10. Conversion Funnel Dashboard

### Query
```javascript
rpc('get_social_conversion_funnel', {
  p_brand_id: 'carlton',
  p_days: 30,
  p_platform: null  // or specific platform
})
```

### Returns
```json
{
  "funnel": {
    "discovered": 26,
    "classified": 4,
    "drafted": 1,
    "approved": 1,
    "acted": 1,
    "conversations_started": 1
  },
  "response_rates": [
    { "platform": "reddit", "total_acted": 1, "responses_received": 1, "response_rate_pct": 100.0 }
  ],
  "platform_roi": [
    { "platform": "reddit", "targets": 26, "conversations": 1, "engagement_rate_pct": 3.8 }
  ],
  "time_to_act": {
    "avg_hours_to_approve": 0.0,
    "avg_hours_to_act": 0.0,
    "avg_hours_total": 0.0
  }
}
```

### Suggested Dashboard Widgets
1. **Funnel bar chart**: Discovered → Classified → Drafted → Approved → Acted → Conversations
2. **Response rate badges**: Per-platform response rate %
3. **Platform ROI table**: Targets vs conversations vs engagement rate
4. **Time-to-act metric**: Average hours from draft to action
