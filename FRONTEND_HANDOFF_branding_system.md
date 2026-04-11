# Frontend Handoff: Branding System (PPP Branding Engine)

## Status: Backend Complete, Ready for Frontend Integration

**Date**: 2026-03-28
**Backend Developer**: Claude (Backend)
**For**: Frontend Developer (Dashboard Integration)

---

## 1. System Overview

The branding system is a 3-workflow engine that discovers Bradford's brand identity through deep questioning, generates brand-native template pieces and compositions for outreach, and produces formatted brand documents.

### Data Flow

```
 BRAND-DISCOVERY                    BRAND-TEMPLATE-GEN              Outreach System
 +-----------------+               +--------------------+          +------------------+
 | 15 categories   |               | generate_pieces    |          | EMAIL-ASSEMBLY   |
 | 97 seed Qs      |  synthesize   | generate_composition  render  | PROSP-OUTREACH   |
 | depth analysis  | -----------> | audit_existing     | -------> | SOCIAL-DRAFT     |
 | follow-up Qs    |   writes to   |                    |  uses    | CRM-SEQUENCE     |
 +-----------------+  autonomous   +--------------------+ pieces   +------------------+
        |              _brands          |                    |
        v              .identity        v                    v
 +------------------+           +-----------------+   +------------------+
 | brand_discovery  |           | outreach_email  |   | outreach_send    |
 | _sessions        |           | _templates      |   | _queue           |
 | brand_discovery  |           | email_          |   | cold_outreach    |
 | _questions       |           | compositions    |   | _send_log        |
 +------------------+           +-----------------+   +------------------+
                                        |
                              BRAND-DOC-GEN
                              +-------------------+
                              | positioning_doc   |
                              | voice_guide       |
                              | culture_playbook  |  --> Google Docs
                              | one_pager         |
                              | email_playbook    |
                              | content_strategy  |
                              +-------------------+
```

### Webhooks

| Workflow | Webhook URL | Method |
|----------|-------------|--------|
| BRAND-DISCOVERY | `POST https://n8n.carltonaiservices.com/webhook/brand-discovery` | POST |
| BRAND-TEMPLATE-GEN | `POST https://n8n.carltonaiservices.com/webhook/brand-template-gen` | POST |
| BRAND-DOC-GEN | `POST https://n8n.carltonaiservices.com/webhook/brand-doc-gen` | POST |

### Workflow IDs

| Workflow | n8n ID | Nodes | Registry ID |
|----------|--------|-------|-------------|
| BRAND-DISCOVERY | `D7TeOHZtpept3IVc` | 25 | 436 |
| BRAND-TEMPLATE-GEN | `NwuYK281hFbcDjy3` | 17 | 437 |
| BRAND-DOC-GEN | `uKCnoqKspq5nBH35` | 9 | 438 |

---

## 2. BRAND-DISCOVERY IO Contract

### Operation: `start_session`

Starts (or resumes) a brand discovery session for a specific category.

**Request:**
```json
{
  "operation": "start_session",
  "brand_id": "carlton",
  "category": "origin_story"
}
```

**Response (new session):**
```json
{
  "success": true,
  "operation": "start_session",
  "action": "created",
  "session_id": "uuid-here",
  "category": "origin_story",
  "total_questions": 6,
  "first_question": {
    "seed_id": 1,
    "type": "open",
    "question": "What was the moment everything changed for you professionally?",
    "context": "Expert Secrets: Attractive Character origin story",
    "options": null,
    "dimensions_tested": null,
    "answer": null,
    "depth_score": null,
    "follow_up_asked": false
  },
  "depth_target": 0.85
}
```

**Response (existing in-progress session):**
```json
{
  "success": true,
  "operation": "start_session",
  "action": "resumed",
  "session_id": "uuid-here",
  "category": "origin_story",
  "status": "in_progress",
  "progress": {
    "answered": 3,
    "depth": 0.72,
    "target": 0.85
  }
}
```

**Notes:**
- If an in-progress session exists for the category, it resumes instead of creating a new one
- After resuming, call `get_next_question` to get the current question
- `category` must be one of the 15 valid categories (see Section 3)

---

### Operation: `submit_answer`

Submits an answer to the current question. The backend runs AI depth analysis and may insert follow-up questions.

**Request (open question):**
```json
{
  "operation": "submit_answer",
  "brand_id": "carlton",
  "session_id": "uuid-here",
  "answer": "I was sitting in a corporate meeting and realized I was building someone else's dream..."
}
```

**Request (this_or_that question):**
```json
{
  "operation": "submit_answer",
  "brand_id": "carlton",
  "session_id": "uuid-here",
  "selected": "a"
}
```

**Request (approve_deny question):**
```json
{
  "operation": "submit_answer",
  "brand_id": "carlton",
  "session_id": "uuid-here",
  "verdict": "close_but",
  "adjustment": "I'd say it's more about freedom than just money"
}
```

**Request (ranking question):**
```json
{
  "operation": "submit_answer",
  "brand_id": "carlton",
  "session_id": "uuid-here",
  "rankings": ["Practical problem-solver", "Industry insider", "Reluctant hero", "Guide/mentor"]
}
```

**Response:**
```json
{
  "success": true,
  "operation": "submit_answer",
  "session_id": "uuid-here",
  "category": "origin_story",
  "depth_analysis": {
    "score": 0.65,
    "feedback": "This is good, but can you go deeper...",
    "insight": null
  },
  "next_question": {
    "seed_id": null,
    "type": "open",
    "question": "You mentioned building someone else's dream. What specifically about that moment made it undeniable?",
    "context": "AI-generated follow-up to deepen: What was the moment everything changed...",
    "options": null,
    "answer": null
  },
  "is_complete": false,
  "progress": {
    "answered": 1,
    "total": 7,
    "avg_depth": 0.65,
    "target": 0.85
  }
}
```

**Notes:**
- Only send the fields relevant to the question type. For `open`, send `answer`. For `this_or_that`, send `selected`. Etc.
- When `depth_analysis.score < 0.7`, the backend auto-inserts a follow-up question (notice `total` went from 6 to 7)
- When `depth_analysis.score >= 0.7`, the response includes an `insight` instead of a follow-up
- When `is_complete: true`, the category is done -- call `synthesize_category` next
- The `feedback` field is a human-friendly message suitable for display

---

### Operation: `get_progress`

Returns progress across all 15 discovery categories for a brand.

**Request:**
```json
{
  "operation": "get_progress",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "get_progress",
  "brand_id": "carlton",
  "summary": {
    "completed": 0,
    "in_progress": 1,
    "not_started": 14,
    "total": 15
  },
  "overall_completion": 0,
  "categories": [
    {
      "category": "origin_story",
      "status": "in_progress",
      "session_id": "uuid-here",
      "answered": 1,
      "total": 7,
      "avg_depth": 0.75,
      "target": 0.85
    },
    {
      "category": "identity_type",
      "status": "not_started",
      "answered": 0,
      "total": 0,
      "avg_depth": 0,
      "target": 0
    }
  ]
}
```

**Notes:**
- `overall_completion` is a percentage (0-100) based on completed categories
- Categories with `status: "not_started"` have no session_id
- This is the main data source for the progress dashboard

---

### Operation: `synthesize_category`

After a category session is complete, this synthesizes all Q&A into structured brand identity data and writes it to `autonomous_brands.identity`.

**Request:**
```json
{
  "operation": "synthesize_category",
  "brand_id": "carlton",
  "session_id": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "synthesize_category",
  "session_id": "uuid-here",
  "category": "origin_story",
  "identity_section": "attractive_character",
  "synthesized_data": {
    "backstory": {
      "origin_moment": "...",
      "turning_point": "..."
    },
    "character_type": "reluctant_hero"
  },
  "write_result": {}
}
```

**Notes:**
- The `identity_section` is the target key within `autonomous_brands.identity` JSONB (see Section 3 mapping)
- Call this ONLY when `is_complete: true` from a submit_answer response
- The frontend should show a "Synthesizing..." state while this runs (takes 5-10 seconds)

---

### Operation: `get_next_question`

Returns the current question for a session. Use after resuming a session.

**Request:**
```json
{
  "operation": "get_next_question",
  "brand_id": "carlton",
  "session_id": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "get_next_question",
  "session_id": "uuid-here",
  "category": "origin_story",
  "status": "in_progress",
  "current_question": {
    "seed_id": 2,
    "type": "open",
    "question": "What did you believe about business before that moment, and what do you believe now?",
    "context": "Expert Secrets: Belief shift revelation",
    "options": null,
    "dimensions_tested": null,
    "answer": null
  },
  "question_index": 1,
  "progress": {
    "answered": 1,
    "total": 7,
    "avg_depth": 0.75,
    "target": 0.85
  },
  "is_complete": false
}
```

---

## 3. The 15 Discovery Categories

Based on Expert Secrets + DotCom Secrets frameworks:

| Category | Identity Section | Depth Target | Seed Qs | Description |
|----------|-----------------|-------------|---------|-------------|
| `origin_story` | `attractive_character` | 0.85 | 6 | Your professional transformation moment |
| `identity_type` | `attractive_character` | 0.80 | 6 | Leader, Adventurer, Reporter, or Reluctant Hero |
| `epiphany_bridge` | `epiphany_bridge` | 0.90 | 6 | The story that leads to your big realization |
| `new_opportunity` | `new_opportunity` | 0.85 | 5 | What new opportunity you offer (not improvement) |
| `beliefs` | `beliefs` | 0.90 | 4 | Vehicle, internal, and external false beliefs |
| `big_domino` | `beliefs` | 0.90 | 4 | The one thing that makes everything else inevitable |
| `mass_movement` | `mass_movement` | 0.85 | 5 | Tribal identity, shared cause, us-vs-them |
| `frameworks` | `ppp_framework` | 0.85 | 7 | Your proprietary processes and systems |
| `value_ladder` | `value_ladder` | 0.80 | 5 | Free through high-ticket offer progression |
| `audience_deep_profile` | `audience` | 0.85 | 7 | Dream customer avatar, objections, triggers |
| `competitive_positioning` | `positioning` | 0.80 | 5 | Category, competitive gaps, unique mechanism |
| `content_pillars` | `content_pillars` | 0.75 | 4 | Core topics and thought leadership angles |
| `ppp_framework` | `ppp_framework` | 0.85 | 9 | Produce/Promote/Profit 9-phase breakdown |
| `communication_sequences` | `communication_sequences` | 0.80 | 6 | Soap Opera, Seinfeld, Hook-Story-Offer |
| `voice_calibration` | `voice` | 0.85 | 18 | Tone, style rules, banned phrases, channel guidance |

**Category-to-identity mapping note:** Two categories (`origin_story` + `identity_type`) both map to `attractive_character`. Two categories (`beliefs` + `big_domino`) both map to `beliefs`. Two categories (`frameworks` + `ppp_framework`) both map to `ppp_framework`. Data is merged, not overwritten.

---

## 4. Question Types & Frontend Rendering

Each question in a session has a `type` field. Render differently based on type:

### `open` — Free-form text answer

```
+---------------------------------------------------+
| Q: What was the moment everything changed for you  |
|    professionally?                                  |
|                                                     |
| Context: Expert Secrets: Attractive Character       |
|          origin story                               |
|                                                     |
| +-----------------------------------------------+  |
| | [textarea - min 2-3 sentences encouraged]      |  |
| |                                                |  |
| +-----------------------------------------------+  |
|                                                     |
|                              [ Submit Answer ]      |
+---------------------------------------------------+
```

**Submit payload:** `{ answer: "text..." }`

---

### `this_or_that` — Two-option card selection

```
+---------------------------------------------------+
| Q: Which better describes your communication style? |
|                                                     |
|  +---------------------+  +---------------------+  |
|  |                     |  |                     |  |
|  |  Option A:          |  |  Option B:          |  |
|  |  Direct and to      |  |  Story-driven       |  |
|  |  the point          |  |  and narrative       |  |
|  |                     |  |                     |  |
|  |    [ Select A ]     |  |    [ Select B ]     |  |
|  +---------------------+  +---------------------+  |
+---------------------------------------------------+
```

**Data structure:** `question.options = { a: "Direct and to the point", b: "Story-driven and narrative" }`
**Submit payload:** `{ selected: "a" }` or `{ selected: "b" }`

---

### `approve_deny` — Statement with 3 verdict buttons

```
+---------------------------------------------------+
| Q: Does this statement capture your brand voice?    |
|                                                     |
| "I help businesses automate their workflows so      |
|  they can focus on what matters."                   |
|                                                     |
|  [ Approve ]  [ Close, But... ]  [ Wrong Direction ]|
|                                                     |
|  (if "Close, But..." selected:)                     |
|  +-----------------------------------------------+  |
|  | What would you adjust?                         |  |
|  | [textarea]                                     |  |
|  +-----------------------------------------------+  |
|                              [ Submit ]             |
+---------------------------------------------------+
```

**Submit payload:**
- Approve: `{ verdict: "approve" }`
- Close but: `{ verdict: "close_but", adjustment: "I'd frame it more as..." }`
- Wrong direction: `{ verdict: "wrong_direction", adjustment: "This misses the mark because..." }`

---

### `ranking` — Drag-to-reorder list

```
+---------------------------------------------------+
| Q: Rank these values from most to least important   |
|    to your brand:                                   |
|                                                     |
|  ☰ 1. Practical problem-solver                     |
|  ☰ 2. Industry insider                             |
|  ☰ 3. Reluctant hero                               |
|  ☰ 4. Guide/mentor                                 |
|                                                     |
|  (drag handles to reorder)                          |
|                                                     |
|                              [ Submit Rankings ]    |
+---------------------------------------------------+
```

**Data structure:** `question.options = ["Practical problem-solver", "Industry insider", "Reluctant hero", "Guide/mentor"]`
**Submit payload:** `{ rankings: ["Guide/mentor", "Practical problem-solver", "Industry insider", "Reluctant hero"] }`

---

## 5. Voice Calibration Dimensions

The voice_calibration category (18 seed questions) calibrates 8 dimensions tracked in `brand_discovery_sessions.voice_dimensions`:

| Dimension | Source | Scale | Description |
|-----------|--------|-------|-------------|
| `specificity` | GPT depth analysis | 0.0-1.0 | Uses concrete examples vs. generic statements |
| `emotional_depth` | GPT depth analysis | 0.0-1.0 | Reveals motivation, vulnerability, conviction |
| `uniqueness` | GPT depth analysis | 0.0-1.0 | Distinctive voice vs. could-be-anyone language |
| `actionability` | GPT depth analysis | 0.0-1.0 | Provides clear next steps vs. abstract advice |
| `warmth` | this_or_that / ranking | 0.0-1.0 | Friendly and approachable vs. formal and reserved |
| `formality` | this_or_that / ranking | 0.0-1.0 | Professional register vs. casual conversation |
| `confidence` | this_or_that / ranking | 0.0-1.0 | Bold claims vs. hedged suggestions |
| `humor` | this_or_that / ranking | 0.0-1.0 | Playful and witty vs. straightforward and serious |

**Frontend display:** Show these as a spider/radar chart once voice_calibration category is complete. The first 4 dimensions are computed automatically from depth analysis; the last 4 are derived from the user's explicit choices.

---

## 6. BRAND-TEMPLATE-GEN IO Contract

### Operation: `generate_pieces`

Generates brand-native template pieces using the brand identity and saves them to `outreach_email_templates`.

**Request:**
```json
{
  "operation": "generate_pieces",
  "brand_id": "carlton",
  "message_type": "cold_outreach",
  "categories": ["subject", "greeting", "opening", "body", "question", "cta", "signoff", "ps"],
  "channel": "cold_email",
  "count_per_category": 8,
  "energy_level": null,
  "tone": "neutral"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "generate_pieces",
  "brand_id": "carlton",
  "message_type": "cold_outreach",
  "pieces_generated": 64,
  "inserted": 64
}
```

**Notes:**
- `message_type` determines the style/framing of generated pieces. Valid values: `cold_outreach`, `partner_pitch`, `jv_opportunity`, `speaking_engagement`, `interview_request`, `friendly_outreach`, `social_dm`, `social_engagement`
- `categories` defaults to all 8 email categories. For social, use: `["greeting", "opening", "body", "cta"]`
- `channel` maps to the `channel` column: `cold_email`, `social_dm`, `social_engagement`
- Requires minimum brand identity completeness: `voice.banned_phrases` and `credentials.headline_stats` must exist
- Takes 15-30 seconds depending on count

---

### Operation: `generate_composition`

Creates a composition template (recipe for assembling pieces) for a message type.

**Request:**
```json
{
  "operation": "generate_composition",
  "brand_id": "carlton",
  "message_type": "partner_pitch"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "generate_composition",
  "brand_id": "carlton",
  "composition_name": "Partner Pitch - Professional",
  "system": "partner_pitch",
  "sections": 6,
  "inserted": { "id": 11, "name": "Partner Pitch - Professional", "..." : "..." }
}
```

**Valid message_type values with pre-built composition templates:**
- `partner_pitch` — 6 sections (subject, greeting, opening, body, cta, signoff)
- `jv_opportunity` — 7 sections (adds question between body and cta)
- `speaking_engagement` — 6 sections
- `interview_request` — 6 sections
- `friendly_outreach` — 5 sections (no subject line)

**Notes:**
- `cold_outreach`, `social_dm`, `social_engagement` compositions already exist (10 total from the composable system). This operation is for the 5 additional message types.
- Each composition's `sections` array uses the same format as the existing composable system (see `docs/BACKEND_HANDOFF_composable_outreach_templates.md`)

---

### Operation: `audit_existing`

Audits active template pieces against brand identity and returns alignment scores.

**Request:**
```json
{
  "operation": "audit_existing",
  "brand_id": "carlton",
  "system": "cold_outreach"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "audit_existing",
  "total_audited": 45,
  "on_brand": 38,
  "off_brand": 7,
  "off_brand_pieces": [
    {
      "id": "uuid-here",
      "category": "opening",
      "alignment_score": 0.35,
      "is_off_brand": true,
      "reason": "Uses banned phrase 'leverage' and sounds generic/AI-generated"
    }
  ],
  "all_results": [
    {
      "id": "uuid-here",
      "category": "subject",
      "alignment_score": 0.92,
      "is_off_brand": false,
      "reason": null
    }
  ]
}
```

**Notes:**
- Audits max 50 active pieces per system per call
- `system` filter values: `cold_outreach`, `crm_sequence`, `offer`, `social_dm`, `social_engagement`, `all`
- Scoring is based on: voice match, banned phrase compliance, value alignment

---

## 7. The 8 Message Types

| Message Type | Channel | Has Composition? | Description |
|-------------|---------|-----------------|-------------|
| `cold_outreach` | cold_email | Yes (3 variants) | Cold email to prospects |
| `partner_pitch` | cold_email | Via generate_composition | Partnership proposals |
| `jv_opportunity` | cold_email | Via generate_composition | Joint venture outreach |
| `speaking_engagement` | cold_email | Via generate_composition | Event organizer outreach |
| `interview_request` | cold_email | Via generate_composition | Podcast/interview pitches |
| `friendly_outreach` | cold_email | Via generate_composition | Warm no-agenda connection |
| `social_dm` | social_dm | Yes (4 variants) | Direct messages on social |
| `social_engagement` | social_engagement | Yes (2 variants) | Reply/comment engagement |

---

## 8. BRAND-DOC-GEN IO Contract

### Operation: `generate_document`

Generates a formatted brand document via OpenAI and saves it as a Google Doc.

**Request:**
```json
{
  "operation": "generate_document",
  "brand_id": "carlton",
  "document_type": "positioning_doc",
  "folder_id": "optional-google-drive-folder-id",
  "options": {}
}
```

**Response:**
```json
{
  "success": true,
  "operation": "generate_document",
  "document_type": "positioning_doc",
  "title": "Brand Positioning Document",
  "brand_id": "carlton",
  "document_id": "google-doc-id",
  "document_url": "https://docs.google.com/document/d/..."
}
```

**Notes:**
- Takes 10-20 seconds (OpenAI generation + Google Doc creation)
- If `folder_id` is null, doc is created in the default Brand Documents folder
- The document content is semantic HTML (h2, p, ul, li, strong) converted to Google Doc format
- Uses `get_brand_context` RPC internally to load identity data

---

## 9. The 6 Document Types

| `document_type` | Title | Contents |
|-----------------|-------|----------|
| `positioning_doc` | Brand Positioning Document | Purpose, mission, core values, 3+ customer avatars, emotional hooks, personality (3-word method), differentiators, positioning statement, brand promise, tone of voice |
| `voice_guide` | Brand Voice & Style Guide | Voice overview, tone variations by context, messaging pillars, words to use/avoid, dos/don'ts with examples, voice in action (on-brand vs off-brand), content guidelines by touchpoint |
| `culture_playbook` | Community-Driven Brand Playbook | Community philosophy, shared values, audience-to-advocate journey, rituals, engagement tactics, branded experiences, ambassador strategy |
| `one_pager` | Brand One-Pager | Positioning statement, headline stats, unique mechanism, value ladder summary, key differentiators, compelling CTA |
| `email_playbook` | Email Communication Playbook | Soap Opera Sequence (5 emails), Seinfeld-style daily email guidelines, Hook-Story-Offer patterns, cold email best practices, follow-up templates, subject line patterns |
| `content_strategy` | Content Strategy Document | Content pillars with topic lists, 4 core stories per pillar, content calendar framework, platform-specific guidelines, thought leadership angles |

---

## 10. Database Tables

### `autonomous_brands`

The master brand configuration table.

| Column | Type | Description |
|--------|------|-------------|
| `brand_id` | TEXT PK | e.g., "carlton" |
| `name` | TEXT | Display name |
| `config` | JSONB | Operational config (hub, bookkeeper, partnership, prospecting, email_sender, social_media, voice_profile, revenue targets) |
| `identity` | JSONB | Brand identity data (see below) |
| `status` | TEXT | "active" / "inactive" |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**`identity` JSONB structure** (15 sections, populated by discovery):

| Section Key | Populated By Category | Description |
|-------------|----------------------|-------------|
| `voice` | voice_calibration | Style rules, banned phrases, tone spectrum, channel guidance |
| `beliefs` | beliefs + big_domino | Vehicle/internal/external false beliefs, big domino statement |
| `audience` | audience_deep_profile | Primary/secondary audience, objections, triggers, drivers |
| `credentials` | (manual/existing) | Case studies, testimonials, headline stats, enterprise logos |
| `personality` | identity_type | 3-word personality, archetype, expert phase |
| `positioning` | competitive_positioning | Category, competitive gaps, unique mechanism |
| `value_ladder` | value_ladder | Free through high-ticket offer progression |
| `mass_movement` | mass_movement | Manifesto, tribal name, social mission |
| `ppp_framework` | frameworks + ppp_framework | 3 phases (Produce/Promote/Profit), 9 steps |
| `content_pillars` | content_pillars | Core topics, thought leadership angles |
| `epiphany_bridge` | epiphany_bridge | The revelation story structure |
| `new_opportunity` | new_opportunity | What new opportunity the brand offers |
| `attractive_character` | origin_story + identity_type | Backstory, character type, transformation |
| `communication_sequences` | communication_sequences | Soap Opera, Seinfeld, Hook-Story-Offer patterns |
| `secret_formula` | (manual) | Dream customer, bait, result, unique mechanism |

---

### `brand_discovery_sessions`

Tracks progress through each discovery category.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Auto-generated |
| `brand_id` | TEXT FK | References autonomous_brands |
| `category` | TEXT | One of 15 categories |
| `status` | TEXT | "in_progress" / "complete" |
| `current_question_index` | INT | Index into questions array |
| `questions` | JSONB[] | Array of question objects (see below) |
| `synthesized_insights` | JSONB | AI-synthesized insights after completion |
| `depth_target` | FLOAT | Target depth score (0.75-0.90) |
| `avg_depth_score` | FLOAT | Running average depth across answered Qs |
| `voice_dimensions` | JSONB | Voice calibration dimension scores |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Question object structure** (within `questions` array):
```json
{
  "seed_id": 1,
  "type": "open",
  "question": "What was the moment everything changed for you professionally?",
  "context": "Expert Secrets: Attractive Character origin story",
  "options": null,
  "dimensions_tested": null,
  "answer": "I was sitting in a corporate meeting...",
  "depth_score": 0.75,
  "follow_up_asked": false,
  "selected": null,
  "verdict": null,
  "adjustment": null,
  "rankings": null,
  "insight": "Strong origin moment with clear before/after contrast"
}
```

---

### `brand_discovery_questions`

Seed question bank (97 questions, 15 categories).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | Auto-increment |
| `category` | TEXT | One of 15 categories |
| `question_type` | TEXT | "open", "this_or_that", "approve_deny", "ranking" |
| `question_text` | TEXT | The question to display |
| `context` | TEXT | Framework reference / context hint |
| `options` | JSONB | For this_or_that: `{a, b}`. For ranking: `["opt1", "opt2", ...]`. Null for open/approve_deny |
| `dimensions_tested` | JSONB | Which voice dimensions this Q calibrates |
| `depth_weight` | FLOAT | Weight for depth scoring |
| `sort_order` | INT | Display order within category |
| `is_seed` | BOOL | true = original question, false = AI follow-up |
| `is_active` | BOOL | Soft delete flag |
| `created_at` | TIMESTAMPTZ | |

---

### Cross-Reference: Outreach Tables

Template pieces and compositions are documented in `docs/BACKEND_HANDOFF_composable_outreach_templates.md`. Key tables:

| Table | Purpose | Doc Reference |
|-------|---------|---------------|
| `outreach_email_templates` | 113+ template pieces across 9 categories | Section 2 of composable handoff |
| `email_compositions` | 10 composition recipes | Section 2 of composable handoff |
| `email_assembly_log` | Per-email piece attribution | Section 5 of composable handoff |
| `contact_template_history` | Prevents repeating pieces to same contact | Section 5 of composable handoff |

---

## 11. RPCs

### Branding RPCs (created for this system)

| RPC | Parameters | Returns | Used By |
|-----|-----------|---------|---------|
| `get_brand_context` | `p_brand_id` TEXT, `p_channel` TEXT | JSONB: full identity + channel_guidance | BRAND-TEMPLATE-GEN, BRAND-DOC-GEN, COPYWRITE-GENERATE, EMAIL-ASSEMBLY-UTIL |
| `update_identity_section` | `p_brand_id` TEXT, `p_section` TEXT, `p_data` JSONB | void | BRAND-DISCOVERY (synthesize_category) |
| `get_identity_section` | `p_brand_id` TEXT, `p_section` TEXT | JSONB | BRAND-UTIL, dashboard reads |
| `update_voice_dimension` | `p_brand_id` TEXT, `p_dimension` TEXT, `p_value` NUMERIC | void | BRAND-DISCOVERY (voice_calibration) |
| `get_voice_calibration_status` | `p_brand_id` TEXT | JSONB: 8 dimensions with scores | Dashboard voice calibration view |

### `get_brand_context` return structure

```json
{
  "success": true,
  "brand_id": "carlton",
  "channel": "cold_email",
  "voice": { "style_rules": [...], "banned_phrases": [...], "tone_spectrum": {...} },
  "personality": { "three_words": ["authentic", "direct", "practical"], "archetype": "..." },
  "credentials": { "headline_stats": [...], "enterprise_logos": [...], "case_studies": [...] },
  "positioning": { "category": "...", "unique_mechanism": "...", "competitive_gaps": [...] },
  "big_domino": { "statement": "..." },
  "attractive_character": { "backstory": {...}, "character_type": "..." },
  "audience": { "primary": {...}, "objections": [...] },
  "ppp_framework": { "produce": {...}, "promote": {...}, "profit": {...} },
  "content_pillars": [...],
  "new_opportunity": { "description": "..." },
  "epiphany_bridge_short": "...",
  "epiphany_bridge_full": {...},
  "channel_guidance": "Specific writing guidance for the requested channel..."
}
```

**`p_channel` valid values:** `cold_email`, `partnership`, `jv_opportunity`, `speaking_engagement`, `interview_request`, `friendly_outreach`, `social_post`, `blog_content`, `sales`, `general`

### Composable System RPCs (cross-reference)

| RPC | Purpose |
|-----|---------|
| `get_template_pieces(p_brand_id, p_category, p_system, p_active_only)` | List pieces with optional filters |
| `upsert_template_piece(p_brand_id, p_piece)` | Create/update a piece |
| `delete_template_piece(p_brand_id, p_piece_id)` | Soft-delete (sets is_active=false) |
| `get_compositions(p_brand_id, p_system)` | List compositions |
| `upsert_email_composition(p_brand_id, p_composition)` | Create/update a composition |
| `render_composition_preview(p_brand_id, p_composition_id, p_example_variables)` | Preview with sample data |
| `select_template_pieces(p_brand_id, ...)` | Round-robin selection with contact dedup |
| `log_email_assembly(...)` | Records which pieces were used |
| `update_piece_metrics(...)` | Attributes open/click/reply to pieces |
| `get_piece_performance(p_brand_id, p_category, p_min_sends)` | Performance dashboard data |

---

## 12. System Flow Diagram

```
                        FRONTEND PAGES
                        ==============

    Brand Discovery Page          Template Manager          Brand Documents
    +------------------+         +----------------+        +---------------+
    | Progress grid    |         | Pieces tab     |        | Doc type grid |
    | Category cards   |         | Compositions   |        | Generate btn  |
    | Q&A interface    |         | Audit results  |        | Doc links     |
    +--------+---------+         +-------+--------+        +-------+-------+
             |                           |                         |
             v                           v                         v
    brand-discovery              brand-template-gen          brand-doc-gen
    webhook                      webhook                     webhook
             |                           |                         |
             v                           v                         v
                        BACKEND WORKFLOWS
                        =================

    BRAND-DISCOVERY              BRAND-TEMPLATE-GEN         BRAND-DOC-GEN
    +------------------+         +------------------+       +------------------+
    | start_session    |         | generate_pieces  |       | generate_document|
    | submit_answer    |-------->| generate_comp    |       |                  |
    | get_progress     | synth   | audit_existing   |       |                  |
    | synthesize_cat   | writes  |                  |       |                  |
    | get_next_q       |  to     |                  |       |                  |
    +--------+---------+  |      +--------+---------+       +--------+---------+
             |            |               |                          |
             v            v               v                          v
                        SUPABASE
                        ========

    brand_discovery    autonomous    outreach_email      Google Docs API
    _sessions          _brands      _templates           (via DOC-CREATE
    brand_discovery    .identity    email_                 utility)
    _questions          JSONB       compositions

                                          |
                                          v
                              OUTREACH SYSTEM (existing)
                              ==========================
                              EMAIL-ASSEMBLY-UTIL
                              PROSP-OUTREACH-DRAFT-V2
                              COLD-OUTREACH-SENDER
                              SOCIAL-DRAFT workflows
```

---

## 13. Integration Points

### With Composable Email System

BRAND-TEMPLATE-GEN writes pieces to the same `outreach_email_templates` table used by EMAIL-ASSEMBLY-UTIL. Generated pieces are immediately available for outreach assembly with no additional wiring needed.

- Pieces use the same schema: `category`, `channel`, `tone`, `system`, `template_text`, `variables`
- The `system` field on generated pieces matches the `message_type` parameter
- Compositions use the same `email_compositions` table with identical `sections` JSONB format

### With Channel Routing

The composable system's channel routing (`assign_outreach_channel`, `unified_contacts.primary_outreach_channel`) determines which composition type gets selected for each contact. Brand-generated pieces flow into both email and social channels.

### With Social Outreach

Social DM and engagement pieces (generated with `channel: "social_dm"` or `channel: "social_engagement"`) are used by:
- PROSP-SOCIAL-BRIDGE for social outreach
- Per-platform sub-workflows (Instagram, Facebook, Twitter, LinkedIn)
- Batch caps apply per platform

### With Human Task System

When compositions are assembled, they go through the human task review system (`create-human-task` webhook) before sending. Bradford approves/edits assembled messages, and feedback can inform future piece audits.

### With RDGR Autonomous System

RDGR-PLAN can trigger `start_session` to initiate discovery sessions autonomously. The branding domain is registered in `autonomous_domain_registry` (webhook: `brand-discovery`, concurrency: 1). RDGR-CHAT has a `/brand` tool for brand identity queries.

---

## 14. Suggested Frontend Pages

### Brand Discovery Page (`/brand-discovery`)

**Layout:**
1. **Progress Dashboard** — Grid of 15 category cards showing status (not_started/in_progress/complete), depth score bar, question count. Call `get_progress` on page load.
2. **Active Session** — When user clicks a category card, start or resume session. Show one question at a time with appropriate renderer (Section 4). Show depth progress bar, feedback messages.
3. **Synthesis View** — When category completes, show "Synthesizing..." then the generated identity data. Option to review/edit before confirming.
4. **Voice Radar Chart** — Spider chart of 8 voice dimensions (visible after voice_calibration starts).

### Template Studio Page (`/template-studio`)

**Layout:**
1. **Generate Tab** — Select message_type, categories, count. "Generate Pieces" button calls `generate_pieces`. Show progress and results.
2. **Audit Tab** — Select system, click "Audit". Shows alignment scores per piece, off-brand pieces highlighted red.
3. **Compositions Tab** — List existing compositions. "Generate Composition" for new message types. Preview assembly.

### Brand Documents Page (`/brand-documents`)

**Layout:**
1. **Document Grid** — 6 cards for each document type. "Generate" button. Shows link to Google Doc if already generated.
2. **Options** — Optional folder_id selection for Google Drive organization.
