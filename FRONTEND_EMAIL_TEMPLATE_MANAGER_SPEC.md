# Frontend Spec: Outreach Template Manager + Channel Routing

## Overview

The composable outreach system replaces slider-based voice settings with pre-written template **pieces** that are assembled into messages. This applies to **all outreach channels** — email, Instagram DMs, Facebook messages, LinkedIn messages, and Twitter DMs. Users manage pieces (building blocks), **compositions** (recipes), and **channel routing** (which channel each prospect gets).

**Route:** `/outreach-templates` (in approval-portal)

---

## 1. Page Layout

```
+-----------------------------------------------------------+
| OUTREACH TEMPLATES                       [+ New Template]  |
+-----------------------------------------------------------+
| [Pieces]  [Templates]  [Performance]  [Channel Routing] tabs
+-----------------------------------------------------------+
|                                                            |
|  (Tab content renders below)                               |
|                                                            |
+-----------------------------------------------------------+
```

Four tabs:
1. **Pieces** — CRUD for template pieces by category and channel
2. **Templates** — Composition editor (the "Template Builder")
3. **Performance** — Per-piece metrics dashboard
4. **Channel Routing** — View/override channel assignments per contact

---

## 2. Tab: Pieces

### Layout
```
+-----------------------------------------------------------+
| Channel: [All v] [Email] [Instagram] [Facebook]           |
|          [LinkedIn] [Twitter]             filter chips     |
+-----------------------------------------------------------+
| Category: [All v] [greeting][opening][body][question]      |
|           [cta][subject][signoff][footer][ps]              |
+-----------------------------------------------------------+
|                                                            |
| GREETING (5 pieces)                    [+ Add Piece]       |
| +-------------------------------------------------------+ |
| | "Hi {first_name},"                                    | |
| | Channel: all | Tone: warm | Needs research: No        | |
| | Used: 3 | Sent: 12 | Open: 58% | Reply: 8%           | |
| | [Edit] [Deactivate]                                   | |
| +-------------------------------------------------------+ |
| ...                                                        |
+-----------------------------------------------------------+
```

### Add/Edit Piece Modal

```
+-------------------------------------------+
| ADD TEMPLATE PIECE                        |
|                                           |
| Category: [dropdown: greeting, opening,   |
|            body, question, cta, subject,  |
|            signoff, footer, ps]           |
|                                           |
| Template Text:                            |
| [textarea with {variable} highlighting]   |
| "Your {observation} at {company} caught   |
|  my eye."                                 |
|                                           |
| Channel: [dropdown: all, cold_email,      |
|           social_dm, social_engagement]   |
|                                           |
| Tone: [dropdown: neutral, warm, direct,   |
|        witty, formal]                     |
|                                           |
| System: [dropdown: all, cold_outreach,    |
|          crm_sequence, offer]             |
|                                           |
| Lead Categories: [chip input]             |
| [coaching] [consulting] [local_service] + |
|                                           |
| Needs Research: [auto-detected from vars] |
|                                           |
| Preview with example:                     |
| "Your no online booking at Ace Plumbing   |
|  caught my eye."                          |
|                                           |
| [Cancel]                      [Save]      |
+-------------------------------------------+
```

### Supabase API Calls

**List pieces:**
```javascript
const { data } = await supabase.rpc('get_template_pieces', {
  p_brand_id: 'carlton',
  p_category: selectedCategory || null,
  p_system: selectedSystem || null,
  p_active_only: true
});
// Returns: { success, pieces: [...], count }
```

**Create/update piece:**
```javascript
const { data } = await supabase.rpc('upsert_template_piece', {
  p_brand_id: 'carlton',
  p_piece: {
    id: existingId || null,      // null = create new
    category: 'opening',
    template_text: 'Your {observation} at {company} caught my eye.',
    channel: 'cold_email',       // or 'social_dm', 'all'
    tone: 'warm',
    system: 'all',
    lead_categories: ['coaching', 'consulting'],
    variables: ['{observation}', '{company}'],
    requires_research: true,
    sort_order: 0
  }
});
// Returns: { success, action: 'created'|'updated', id }
```

**Deactivate piece:**
```javascript
const { data } = await supabase.rpc('delete_template_piece', {
  p_brand_id: 'carlton',
  p_piece_id: 'uuid-here'
});
// Returns: { success, id, action: 'deactivated' }
```

---

## 3. Tab: Templates (Composition Editor)

A "template" is a **composition** — a recipe defining which pieces combine into a complete message. Works for email AND social.

### Layout
```
+-----------------------------------------------------------+
| TEMPLATES                               [+ New Template]   |
+-----------------------------------------------------------+
| System: [All v] [Cold Outreach] [CRM Sequence] [Offer]    |
|         [Social DM] [Social Engagement]                    |
+-----------------------------------------------------------+
|                                                            |
| +-------------------------------------------------------+ |
| | Default Cold Outreach              [DEFAULT] [ACTIVE]  | |
| | System: cold_outreach | 7 sections                    | |
| | [Edit] [Preview] [Duplicate]                           | |
| +-------------------------------------------------------+ |
| | LinkedIn DM - Warm Opener                     [ACTIVE] | |
| | System: social_dm | 4 sections                         | |
| | [Edit] [Preview] [Duplicate]                           | |
| +-------------------------------------------------------+ |
|                                                            |
+-----------------------------------------------------------+
```

### Composition Editor (opens on Edit/New)

```
+-----------------------------------------------------------+
| EDIT: Default Cold Outreach                                |
+-----------------------------------------------------------+
| Name: [Default Cold Outreach          ]                    |
| Description: [Standard cold outreach...]                   |
| System: [Cold Outreach v]                                  |
| [x] Set as Default    [x] Active                          |
+-----------------------------------------------------------+
| SECTIONS                          | LIVE PREVIEW           |
|                                   |                        |
| 1. Subject  [Auto v]             | Subject:               |
|    Pool: 5 pieces available       | plumbing services at   |
|                                   | Ace Plumbing           |
| 2. Greeting [Auto v]             |                        |
|    Pool: 5 pieces available       | Hi John,               |
|                                   |                        |
| 3. Opening  [Pin: v ]            | Your no online booking |
|    Pinned: "Your {observation}    | at Ace Plumbing caught |
|    at {company} caught my eye."   | my eye.                |
|                                   |                        |
| 4. Body     [Auto v]             | From what I can see,   |
|    Pool: 10 pieces available      | Ace Plumbing has built |
|                                   | something real...      |
| 5. Question [Auto v] (optional)  |                        |
|    Pool: 14 pieces available      | How does scheduling    |
|    [x] Required                   | workflow run when you  |
|                                   | are away for a bit?    |
| 6. CTA      [Auto v]             |                        |
|    Pool: 10 pieces available      | I am curious to hear   |
|                                   | your take.             |
| 7. Signoff  [Auto v]             |                        |
|    Pool: 5 pieces available       | Best,                  |
|                                   | Bradford               |
| [+ Add Section] [Remove Last]    |                        |
|                                   | [Shuffle Preview]      |
| EXAMPLE VARIABLES                 |                        |
| company: [Ace Plumbing    ]       |                        |
| first_name: [John         ]       |                        |
| observation: [no online   ]       |                        |
|   [booking                ]       |                        |
| specific_thing: [scheduling]      |                        |
|   [workflow                ]       |                        |
+-----------------------------------------------------------+
| [Cancel]                                   [Save Template] |
+-----------------------------------------------------------+
```

### Social DM Composition Example

Social compositions use fewer sections (no subject line, shorter body):

```
Sections for "LinkedIn DM - Warm":
1. greeting (required) — "Hey {first_name},"
2. opening (required) — "{company}'s approach to {specific_thing} stood out."
3. cta (required) — "Would love to connect and hear how you handle it."
```

### Supabase API Calls

**List compositions:**
```javascript
const { data } = await supabase.rpc('get_compositions', {
  p_brand_id: 'carlton',
  p_system: selectedSystem || null  // 'cold_outreach', 'social_dm', etc.
});
```

**Preview composition:**
```javascript
const { data } = await supabase.rpc('render_composition_preview', {
  p_brand_id: 'carlton',
  p_composition_id: 1,
  p_example_variables: {
    company: 'Ace Plumbing',
    first_name: 'John',
    observation: 'no online booking',
    specific_thing: 'scheduling workflow'
  }
});
// Returns: { success, subject, body, pieces_shown, composition_name, variables_used }
```

**Create/update composition:**
```javascript
const { data } = await supabase.rpc('upsert_email_composition', {
  p_brand_id: 'carlton',
  p_composition: {
    id: existingId || null,
    name: 'LinkedIn DM - Warm Opener',
    description: 'Short warm DM for LinkedIn connections',
    system: 'social_dm',
    sections: [
      { category: 'greeting', count: 1, required: true, pinned_piece_id: null },
      { category: 'opening', count: 1, required: true, pinned_piece_id: null },
      { category: 'cta', count: 1, required: true, pinned_piece_id: null }
    ],
    example_variables: { company: 'Ace Plumbing', first_name: 'John' },
    is_default: false,
    is_active: true
  }
});
```

---

## 4. Tab: Performance

### Layout
```
+-----------------------------------------------------------+
| PERFORMANCE                                                |
+-----------------------------------------------------------+
| Category: [All v]   Channel: [All v]   Min Sends: [5 v]   |
+-----------------------------------------------------------+
|                                                            |
| Category | Channel | Piece Text (truncated)| Sent | Reply% |
| ---------|---------|----------------------|------|--------|
| opening  | email   | "Your {observation}…"|   42 |   12%  |
| opening  | email   | "{company}'s app…"   |   38 |    8%  |
| cta      | email   | "I am curious…"      |   35 |   14%  |
| opening  | social  | "Noticed your…"      |   20 |   18%  |
| ...                                                        |
+-----------------------------------------------------------+
```

### Supabase API Call

```javascript
const { data } = await supabase.rpc('get_piece_performance', {
  p_brand_id: 'carlton',
  p_category: selectedCategory || null,
  p_min_sends: minSends || 5
});
// Returns: { success, pieces: [...], count }
```

---

## 5. Tab: Channel Routing

This shows how prospects are distributed across channels and lets Bradford override routing decisions.

### Layout
```
+-----------------------------------------------------------+
| CHANNEL ROUTING                                            |
+-----------------------------------------------------------+
| Distribution Summary:                                      |
| Email: 45 (52%)  |  FB: 18 (21%)  |  LI: 15 (17%)       |
| IG: 5 (6%)  |  TW: 3 (3%)  |  No channel: 1 (1%)        |
+-----------------------------------------------------------+
| Filter: [All v]  [Email] [Facebook] [LinkedIn] [No Channel]|
| Status: [All v]  [Selected] [Attempted] [No Response]      |
+-----------------------------------------------------------+
|                                                            |
| Contact           | Channels          | Primary  | Status  |
| ------------------|-------------------|----------|---------|
| Ace Plumbing      | email,fb,li       | email    | selected|
|   [Switch to: [Facebook v] [Go]]                          |
| XYZ Consulting    | email,li          | linkedin | attempted|
|   [Switch to: [Email v] [Go]]                             |
| Solo Coach Inc    | fb                | facebook | selected|
|   (only channel)                                           |
| No-Web Corp       | —                 | —        | no_channels|
|   (no outreach possible)                                   |
+-----------------------------------------------------------+
```

### Key Interactions

- **"Switch to" button** — Calls `switch_outreach_channel` RPC. Marks old channel as `exhausted`, new one as `selected`. Use case: email sequence finished with no response, try LinkedIn DM.
- **Distribution chart** — Shows fair rotation is working. If one channel is heavily over-represented, user can adjust by pinning some contacts to other channels.
- **No Channel contacts** — These need manual research to find contact info.

### Supabase API Calls

**List contacts with channel data:**
```javascript
const { data } = await supabase
  .from('unified_contacts')
  .select('contact_id, business_name, email, available_channels, primary_outreach_channel, outreach_channel_status')
  .eq('brand_id', 'carlton')
  .not('available_channels', 'eq', '{}')
  .order('created_at', { ascending: false })
  .range(offset, offset + limit);
```

**Switch channel:**
```javascript
const { data } = await supabase.rpc('switch_outreach_channel', {
  p_brand_id: 'carlton',
  p_contact_id: 'C_260324090338',
  p_new_channel: 'facebook'
});
// Returns: { success, old_channel, new_channel, action: 'switched' }
```

**Update channel status (called by workflows, shown in UI):**
```javascript
const { data } = await supabase.rpc('update_outreach_channel_status', {
  p_brand_id: 'carlton',
  p_contact_id: 'C_260324090338',
  p_channel: 'email',
  p_status: 'no_response',  // available | selected | attempted | responded | no_response | exhausted
  p_details: { sequence_completed_at: '2026-03-27' }
});
```

**Distribution summary:**
```javascript
const { data } = await supabase
  .from('unified_contacts')
  .select('primary_outreach_channel')
  .eq('brand_id', 'carlton')
  .not('primary_outreach_channel', 'is', null);
// Group client-side for counts
```

---

## 6. Draft Review Updates

When reviewing outreach drafts (email or social), show which template pieces were used:

### Pieces Attribution Panel (below draft content)

```
+-------------------------------------------+
| TEMPLATE PIECES USED                      |
| Composition: Default Cold Outreach        |
| Assembly: #42 | GPT Role: variable_fill   |
+-------------------------------------------+
| [greeting]  "Hi {first_name},"            |
| [opening]   "Your {observation} at..."    |
| [body]      "From what I can see..."      |
| [question]  "How does {specific_thing}…"  |
| [cta]       "I am curious to hear…"       |
| [signoff]   "Best, Bradford"              |
+-------------------------------------------+
| Variables Filled:                         |
| company: "Ace Plumbing"                   |
| observation: "no online booking system"   |
+-------------------------------------------+
```

### Channel Badge

Each draft in the review queue should show a channel badge:
```
[EMAIL]  Review Outreach Draft for Ace Plumbing
[LI DM]  Review DM Draft for XYZ Consulting
[FB]     Review Engagement Draft for Solo Coach
```

### Supabase Query for Assembly Info
```javascript
const { data: assembly } = await supabase
  .from('email_assembly_log')
  .select('id, pieces_used, variables_filled, gpt_role, composition_id')
  .eq('draft_id', draftId)
  .single();
```

---

## 7. Database Tables Reference

### Template System
| Table | Purpose |
|-------|---------|
| `outreach_email_templates` | Template pieces (all channels). Key: id, category, channel, template_text, tone, system, metrics |
| `email_compositions` | Template recipes. Key: id, name, system, sections (JSONB with pinned_piece_id), example_variables |
| `email_assembly_log` | Per-message piece attribution. Key: id, contact_id, draft_id, pieces_used, outcome |
| `contact_template_history` | Round-robin dedup. Key: contact_id, template_id |

### Channel Routing (on `unified_contacts`)
| Column | Type | Purpose |
|--------|------|---------|
| `available_channels` | TEXT[] | All channels this contact can be reached on: `[email, facebook, linkedin]` |
| `primary_outreach_channel` | TEXT | Channel selected by router (or manually switched) |
| `outreach_channel_status` | JSONB | Per-channel status object with timestamps |

### Channel Status Values
`available` → `selected` → `attempted` → `responded` / `no_response` → `exhausted`

### Valid Categories
`greeting`, `opening`, `body`, `question`, `cta`, `subject`, `signoff`, `footer`, `ps`

### Valid Systems
`cold_outreach`, `crm_sequence`, `offer`, `social_dm`, `social_engagement`, `all`

### Valid Channels (on pieces)
`cold_email`, `social_dm`, `social_engagement`, `all`

### Valid Tones
`neutral`, `warm`, `direct`, `witty`, `formal`

---

## 8. Channel Routing RPCs

| Function | Purpose | Called By |
|----------|---------|----------|
| `assign_outreach_channel(p_brand_id, p_contact_id)` | Detects available channels from email + metadata.social_platforms, picks one fairly via global count balancing, stores on CRM | PROSP-SEARCH-EXECUTE (automated) |
| `update_outreach_channel_status(p_brand_id, p_contact_id, p_channel, p_status, p_details)` | Updates per-channel status with timestamps | Sending workflows, reply detection |
| `switch_outreach_channel(p_brand_id, p_contact_id, p_new_channel)` | Marks old channel exhausted, selects new one | Frontend "Switch" button, or automated after sequence completes with no response |

**Fair rotation logic:** `assign_outreach_channel` counts how many contacts are assigned to each channel brand-wide, then picks the channel with the fewest assignments from the contact's available channels. This naturally distributes across channels without hard percentages.

---

## 9. Real-time Updates

```javascript
const channel = supabase
  .channel('template-pieces')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'outreach_email_templates',
    filter: 'brand_id=eq.carlton'
  }, handlePieceChange)
  .subscribe();

const compChannel = supabase
  .channel('compositions')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'email_compositions',
    filter: 'brand_id=eq.carlton'
  }, handleCompositionChange)
  .subscribe();
```

---

## 10. Pre-Built Inventory (as of 2026-03-27)

### Template Pieces: 113 Total

**Email (cold_email channel): 79 pieces**

| Category | Count | Example Pieces |
|----------|-------|---------------|
| subject | 10 | `"{topic} at {company}"`, `"re: your {thing}"`, `"quick question about {observation}"`, `"thought about {company}"`, `"noticed something at {company}"` |
| greeting | 5 | `"Hi {first_name},"`, `"Hey {first_name},"`, `"{first_name},"`, `"Hey there,"`, `"Hi there,"` |
| opening | 16 | `"Your {observation} at {company} caught my eye."`, `"Running a {category} business solo means you ARE the bottleneck"`, `"I noticed {company} while looking into {category} businesses"`, `"I work with small businesses on the operations side, and I came across {company}"` (5 require research, 11 work without it) |
| body | 15 | `"From what I can see, {company} has built something real..."`, `"Most businesses I work with hit a point where operations limits growth"`, `"I build backend systems that let a business keep growing without adding headcount"` |
| question | 14 | `"How does {specific_thing} run when you are away for a bit?"`, `"If demand doubled next month, what breaks first?"`, `"How are handoffs between projects handled today?"` |
| cta | 10 | `"I am curious to hear your take."`, `"I would be interested to hear your perspective."`, `"I wanted to get your perspective on it."` |
| signoff | 5 | `"Best, Bradford"`, `"Talk soon, Bradford"`, `"Looking forward to connecting, Bradford"`, `"Cheers, Bradford"`, `"To your success, Bradford"` |
| ps | 4 | `"P.S. No pressure at all..."`, `"P.S. Happy to share a few examples..."`, `"P.S. If the timing is off, no worries..."` |

**Social DM (social_dm channel): 21 pieces**

| Category | Count | Example Pieces |
|----------|-------|---------------|
| greeting | 4 | `"Hey {first_name} --"`, `"Hi {first_name},"`, `"{first_name} --"`, `"Hey there --"` |
| opening | 6 | `"Came across {company} and really liked how you are approaching {specific_thing}."`, `"Your work with {company} caught my attention -- especially {observation}."`, `"I work with {category} businesses on the operational side and {company} caught my eye."` |
| body | 5 | `"I help businesses like yours get their systems working without being the bottleneck."`, `"I build backend automations for businesses that have outgrown their current setup."`, `"A lot of what I do is build systems that let the business run without everything going through one person."` |
| cta | 6 | `"Would love to connect and hear how you are handling things."`, `"Open to connecting?"`, `"No pitch, just genuinely curious about your approach."`, `"If you are ever up for a quick chat about it, I am around."` |

**Social Engagement (social_engagement channel): 13 pieces**

| Category | Count | Example Pieces |
|----------|-------|---------------|
| opening | 5 | `"Great point about {specific_thing} -- this is something I see a lot in the {category} space."`, `"This is spot on. {specific_thing} is exactly where most businesses hit a wall."`, `"Solid thread. The {specific_thing} part especially resonates."` |
| body | 4 | `"The ones that figure it out early tend to build systems around it instead of adding more hands."`, `"Most of the time it comes down to how information flows between the steps -- not the steps themselves."` |
| cta | 4 | `"Curious how you ended up approaching it."`, `"Would be interesting to compare notes on this."`, `"Appreciate you sharing this -- following for more."` |

### Compositions: 10 Total

**Email Compositions (cold_outreach system): 4**

| ID | Name | Sections | Tone Filter | Use Case |
|----|------|----------|-------------|----------|
| 1 | Default Cold Outreach | subject, greeting, opening, body, question, cta, signoff (7) | none | Standard first-touch email with full structure |
| 2 | Cold Outreach - Short & Direct | subject, greeting, opening, body, cta, signoff (6) | direct | Busy executives, keep it tight, no question |
| 3 | Cold Outreach - Full with PS | subject, greeting, opening, body, question, cta, signoff, ps (8) | none | Leads with strong research data, personal touch |
| 4 | Follow-Up - Brief Check-In | subject, greeting, body, cta, signoff (5) | warm | No-response follow-up, skip the opening |

**Social DM Compositions (social_dm system): 4**

| ID | Name | Sections | Tone Filter | Use Case |
|----|------|----------|-------------|----------|
| 5 | LinkedIn DM - Professional | greeting, opening, body (opt), cta (3-4) | neutral | Professional LinkedIn connection messages |
| 6 | Instagram DM - Casual | greeting, opening, cta (3) | warm | Short, friendly IG DMs |
| 7 | Facebook DM - Warm Intro | greeting, opening, body (opt), cta (3-4) | warm | Warm Facebook messages |
| 8 | Twitter DM - Quick & Sharp | greeting, opening, cta (3) | direct | Ultra-short Twitter DMs |

**Social Engagement Compositions (social_engagement system): 2**

| ID | Name | Sections | Use Case |
|----|------|----------|----------|
| 9 | Engagement - Thoughtful Reply | opening, body (opt), cta (2-3) | Reply with value to someone's post, add insight |
| 10 | Engagement - Quick Validation | opening, cta (2) | Short validating comment, high-volume engagement |

### Combinatorial Variety

With the current piece counts and the default email composition (7 sections):
- **10 subjects x 5 greetings x 16 openings x 15 bodies x 14 questions x 10 CTAs x 5 signoffs = 84,000,000** unique email combinations

With the LinkedIn DM composition (3-4 sections):
- **4 greetings x 6 openings x 5 bodies x 6 CTAs = 720** unique DM combinations

The round-robin system ensures even distribution across all pieces, and per-contact history prevents any contact from receiving the same piece twice.
