# Backend Integration Guide: Composable Outreach Template System

**Date**: 2026-03-27
**From**: Frontend Developer
**For**: Backend Developer (n8n workflows)
**Status**: Frontend fully deployed. Backend partially integrated (see Section 8).

---

## 1. Executive Summary

The outreach system has been rebuilt around **composable template pieces** instead of slider-based voice settings. Instead of GPT writing emails from scratch using tone parameters, the system now:

1. Selects a **composition** (a recipe defining which piece categories to use)
2. Picks one **template piece** per section from the database (round-robin, no repeats per contact)
3. Fills `{variables}` using the contact's research data
4. Optionally sends the assembled message through GPT for light polishing

The frontend manages all pieces, compositions, and prompts. The backend needs to consume them when generating drafts.

**Current inventory**: 142 active pieces, 10 compositions, 4 prompt templates (2 email, 2 social).

---

## 2. What the Frontend Manages

### 2.1 Template Pieces

**Table**: `outreach_email_templates`

142 active pieces across 3 channels:

| Channel | greeting | opening | body | question | cta | subject | signoff | ps | Total |
|---------|----------|---------|------|----------|-----|---------|---------|-----|-------|
| cold_email | 5 | 16 | 15 | 14 | 10 | 10 | 5 | 4 | **79** |
| social_dm | 8 | 10 | 7 | -- | 8 | -- | 5 | -- | **38** |
| social_engagement | -- | 9 | 7 | -- | 8 | -- | -- | -- | **24** |
| all | -- | 1 | -- | -- | -- | -- | -- | -- | **1** |

Each piece has these columns (full table schema):

```
id              UUID PK
brand_id        TEXT ('carlton')
category        TEXT (greeting, opening, body, question, cta, subject, signoff, footer, ps, or CUSTOM)
channel         TEXT (cold_email, social_dm, social_engagement, all)
tone            TEXT (neutral, warm, direct, witty, formal)
system          TEXT (all, cold_outreach, crm_sequence, offer, social_dm, social_engagement)
template_text   TEXT (the actual message with {variable} placeholders)
variables       TEXT[] (detected variables: ['{company}', '{observation}'])
requires_research BOOLEAN (true if piece uses {observation} or {specific_thing})
lead_categories TEXT[] (e.g. ['coaching', 'consulting'] — empty means all)
is_active       BOOLEAN (false = soft-deleted, hidden from frontend)
sort_order      INTEGER
usage_count     INTEGER
times_sent      INTEGER
times_opened    INTEGER
times_replied   INTEGER
open_rate       FLOAT
reply_rate      FLOAT
click_rate      FLOAT
last_used_at    TIMESTAMPTZ
```

**Custom categories**: The `category` column is plain TEXT with no CHECK constraint (the backend already dropped it). Users can create categories like `hook`, `disclaimer`, `intro` from the frontend. The backend should treat category as a free-text field, not validate against a fixed enum.

#### Example Pieces

**Email opening (requires research)**:
```
category: opening
channel: cold_email
tone: warm
template_text: "Your {observation} at {company} caught my eye."
variables: ["{observation}", "{company}"]
requires_research: true
```

**Social DM CTA (no research needed)**:
```
category: cta
channel: social_dm
tone: warm
template_text: "No agenda -- just thought it would be worth connecting."
variables: []
requires_research: false
```

**Social engagement opening**:
```
category: opening
channel: social_engagement
tone: direct
template_text: "This right here. {specific_thing} is the part most people skip and then wonder why nothing scales."
variables: ["{specific_thing}"]
requires_research: true
```

### 2.2 Compositions

**Table**: `email_compositions`

10 compositions define how pieces combine:

| ID | Name | System | Sections | Default |
|----|------|--------|----------|---------|
| 1 | Default Cold Outreach | cold_outreach | subject > greeting > opening > body > question > cta > signoff | YES |
| 2 | Cold Outreach - Short & Direct | cold_outreach | subject > greeting > opening > body > cta > signoff | no |
| 3 | Cold Outreach - Full with PS | cold_outreach | subject > greeting > opening > body > question > cta > signoff > ps | no |
| 4 | Follow-Up - Brief Check-In | cold_outreach | subject > greeting > body > cta > signoff | no |
| 5 | LinkedIn DM - Professional | social_dm | greeting > opening > body > cta | YES |
| 6 | Instagram DM - Casual | social_dm | greeting > opening > cta | no |
| 7 | Facebook DM - Warm Intro | social_dm | greeting > opening > body > cta | no |
| 8 | Twitter DM - Quick & Sharp | social_dm | greeting > opening > cta | no |
| 9 | Engagement - Thoughtful Reply | social_engagement | opening > body > cta | YES |
| 10 | Engagement - Quick Validation | social_engagement | opening > cta | no |

Each composition's `sections` field is JSONB:
```json
[
  { "category": "subject", "count": 1, "required": true, "pinned_piece_id": null },
  { "category": "greeting", "count": 1, "required": true, "pinned_piece_id": null },
  { "category": "opening", "count": 1, "required": true, "pinned_piece_id": "uuid-or-null" },
  { "category": "body", "count": 1, "required": true, "pinned_piece_id": null },
  { "category": "question", "count": 1, "required": false, "pinned_piece_id": null },
  { "category": "cta", "count": 1, "required": true, "pinned_piece_id": null },
  { "category": "signoff", "count": 1, "required": true, "pinned_piece_id": null }
]
```

- `pinned_piece_id`: If set, always use this specific piece (skip random selection)
- `required: false`: Section may be omitted if no suitable pieces available
- `count`: Always 1 (reserved for future multi-piece sections)

### 2.3 Prompt Templates

**Table**: `outreach_prompt_templates`

| Channel | Type | Version | Chars | Description |
|---------|------|---------|-------|-------------|
| cold_email | system | v1 | 1186 | Email system prompt with template piece injection |
| cold_email | user | v1 | 455 | Lead data for email draft |
| social_dm | system | v1 | 1630 | Social DM + engagement system prompt |
| social_dm | user | v1 | 438 | Prospect data for social draft |

The system prompts contain `{{variable}}` placeholders that the backend must fill:

**Email system prompt variables**:
- `{{tone_descriptions}}` — from outreach_voice_settings
- `{{identity_block}}` — about_you field
- `{{style_rules}}` — from voice settings
- `{{keywords_block}}` — keywords array
- `{{value_props_block}}` — value_propositions array
- `{{banned_block}}` — banned_phrases array
- `{{proof_block}}` — from outreach_proof_bank
- `{{subject_block}}` — subject line settings
- `{{custom_instruction}}` — free-text instruction
- `{{opening_templates}}` — all active opening pieces for this channel
- `{{body_templates}}` — all active body pieces
- `{{question_templates}}` — all active question pieces
- `{{cta_templates}}` — all active CTA pieces
- `{{subject_templates}}` — all active subject pieces (email only)

**Social system prompt variables** (same pattern plus):
- `{{platform}}` — linkedin, instagram, facebook, twitter, reddit
- `{{outreach_mode}}` — DM or ENGAGEMENT
- `{{greeting_templates}}` — greeting pieces
- `{{signoff_templates}}` — signoff pieces

**User prompt variables** (filled from contact record):
- `{{business_name}}`, `{{contact_name}}`, `{{category}}`, `{{score}}`, `{{website}}`, `{{email}}`, `{{address}}`, `{{decision_makers}}`, `{{research_content}}`, `{{platform}}`, `{{profile_url}}`, `{{observation}}`, `{{specific_thing}}`, `{{post_content}}`

**DB constraint note**: The `channel` column on `outreach_prompt_templates` has a CHECK constraint. Currently only `cold_email` and `social_dm` are allowed. If separate `social_engagement` prompts are needed, run:
```sql
ALTER TABLE outreach_prompt_templates DROP CONSTRAINT outreach_prompt_templates_channel_check;
ALTER TABLE outreach_prompt_templates ADD CONSTRAINT outreach_prompt_templates_channel_check
  CHECK (channel IN ('cold_email', 'social_dm', 'social_engagement'));
```

### 2.4 Voice Settings (Still Active)

**Table**: `outreach_voice_settings`

These fields are still actively used and editable from the Prompts tab on the Email Outreach page:

| Field | Current Value |
|-------|---------------|
| signature_name | Bradford Carlton |
| keywords | ['operational bottleneck', 'owner dependency', 'scaling friction', 'backend systems', 'delivery infrastructure'] |
| banned_phrases | 21 phrases including 'leverage', 'synergy', 'AI-powered', 'game-changer', etc. |
| value_propositions | (array of proof points) |
| about_you | (Bradford's bio/positioning statement) |
| custom_instruction | (additional GPT guidance) |

**Deprecated fields** (no longer on the frontend): tone_warmth, tone_formality, tone_confidence, tone_humor, tone_salesiness, creativity, greeting_style, signoff_style, subject_style, email_length, opening_style, cta_style, personalization_depth, proof_style, all toggle switches. Tone is now controlled per-piece.

---

## 3. What the Frontend Displays

### 3.1 Email Outreach Page (`/email-outreach`)

7 tabs:

| Tab | What It Shows | Data Source |
|-----|---------------|-------------|
| **Drafts** | Draft cards with channel badges (EMAIL, LI DM, FB, etc.) + piece attribution panel in preview modal | `copy_drafts` + `email_assembly_log` |
| **Compose** | Manual email composition | Webhook: send-outreach-email |
| **Templates** | Pieces sub-tab (filter by channel/category, CRUD, deactivate/reactivate) + Compositions sub-tab (CRUD, live preview, section editor) | `outreach_email_templates` + `email_compositions` |
| **Prompts** | System/user prompt editors + About You, Proof Bank, Keywords, Value Props, Banned Phrases, Example Emails | `outreach_prompt_templates` + `outreach_voice_settings` + `outreach_proof_bank` |
| **Sequences** | Email sequence builder | `crm_email_sequences` |
| **Performance** | Per-piece metrics table: Category, Channel, Piece Text, Sent, Open%, Reply% | `get_piece_performance` RPC |
| **Routing** | Channel distribution summary + contact table with Switch-to controls | `unified_contacts` + `switch_outreach_channel` RPC |

### 3.2 Social Dashboard (`/social-dashboard`)

Outreach section has 4 sub-tabs:

| Sub-tab | What It Shows |
|---------|---------------|
| **DM Queue** | Social DM drafts needing approval (existing) |
| **Engagement Queue** | Engagement comment drafts (existing) |
| **Templates** | Social-filtered pieces (social_dm + social_engagement channels) + social compositions. Read-only view — CRUD redirects to Email Outreach. |
| **Prompts** | Social system/user prompt editors. Loads from `outreach_prompt_templates` WHERE channel = 'social_dm'. Saves via direct PATCH. |

### 3.3 Draft Preview — Piece Attribution Panel

When viewing a draft in the preview modal, the frontend queries `email_assembly_log` for the draft's ID and displays:

- Composition name
- Each piece used, labeled by category: `[greeting] Hi {first_name},` / `[opening] Your {observation}...`
- Variables filled: `company: "Ace Plumbing"`, `observation: "no online booking"`

**If assembly log has no entry for a draft**, the frontend falls back to the `templates_used` UUID array on `copy_drafts` and looks up each piece directly.

---

## 4. Database Tables the Backend Must Write To

### 4.1 `email_assembly_log` — Per-Draft Attribution

**Current state**: 3 entries exist (from E2E testing).

When the backend creates a draft, it MUST also write an assembly log entry:

```sql
INSERT INTO email_assembly_log (brand_id, draft_id, contact_id, composition_id, pieces_used, variables_filled, gpt_role)
VALUES (
  'carlton',
  '<new-draft-uuid>',
  '<contact_id>',
  1,  -- composition ID used
  '{"subject": "plumbing services at Ace Plumbing", "greeting": "Hi John,", "opening": "Your no online booking at Ace Plumbing caught my eye.", "body": "From what I can see...", "cta": "I am curious to hear your take.", "signoff": "Best, Bradford"}',
  '{"company": "Ace Plumbing", "first_name": "John", "observation": "no online booking", "specific_thing": "scheduling workflow"}',
  'variable_fill'
);
```

Without this entry, the frontend's attribution panel shows nothing.

### 4.2 `contact_template_history` — Round-Robin Dedup

**Current state**: 3 entries exist.

After selecting pieces for a draft, record which pieces were used for this contact:

```sql
INSERT INTO contact_template_history (contact_id, template_id, brand_id)
VALUES ('<contact_id>', '<piece_uuid>', 'carlton');
```

When selecting pieces, EXCLUDE already-used pieces:
```sql
WHERE id NOT IN (
  SELECT template_id FROM contact_template_history WHERE contact_id = '<contact_id>'
)
```

### 4.3 `copy_drafts` — The Draft Record

The backend must include these fields when creating drafts:

```sql
INSERT INTO copy_drafts (brand_id, copy_type, content, context, review_status, composition_id, templates_used)
VALUES (
  'carlton',
  'cold_outreach_email',  -- or 'social_dm', 'social_engagement'
  '{"subject": "...", "body": "..."}',
  '{"contact_id": "C_...", "company": "Ace Plumbing", "email": "john@ace.com", "name": "John", "outreach_channel": "email", "composition_id": 1}',
  'draft',
  1,          -- composition.id (INTEGER)
  ARRAY['uuid1', 'uuid2', 'uuid3']::uuid[]  -- piece IDs used
);
```

**Critical**: `composition_id` and `templates_used` must be populated. The frontend's draft cards and attribution panel depend on them.

### 4.4 Piece Metrics — Performance Tracking

When an email is **sent**:
```sql
UPDATE outreach_email_templates
SET times_sent = COALESCE(times_sent, 0) + 1,
    last_used_at = NOW(),
    usage_count = COALESCE(usage_count, 0) + 1
WHERE id = ANY($piece_ids);
```

When an email is **opened**:
```sql
UPDATE outreach_email_templates SET times_opened = COALESCE(times_opened, 0) + 1 WHERE id = ANY($piece_ids);
```

When a **reply** is received:
```sql
UPDATE outreach_email_templates SET times_replied = COALESCE(times_replied, 0) + 1 WHERE id = ANY($piece_ids);
```

The `open_rate` and `reply_rate` fields should be recomputed:
```sql
UPDATE outreach_email_templates
SET open_rate = CASE WHEN times_sent > 0 THEN times_opened::float / times_sent ELSE 0 END,
    reply_rate = CASE WHEN times_sent > 0 THEN times_replied::float / times_sent ELSE 0 END
WHERE id = ANY($piece_ids);
```

The Performance tab reads these directly. Without them, the table shows "--" for all metrics.

---

## 5. Known RPC Bug

### `get_template_pieces` Does NOT Return the `channel` Field

The RPC returns these fields:
```
approval_rate, category, click_rate, id, is_active, last_used_at, lead_categories,
open_rate, reply_rate, requires_research, sort_order, system, template_text, tone,
total_sent, usage_count, variables
```

**Missing**: `channel`

**Impact**: The frontend cannot filter pieces by channel (Email vs Social DM vs Engagement) when using this RPC. The frontend has been patched to use a direct REST query instead:
```
GET /rest/v1/outreach_email_templates?brand_id=eq.carlton&is_active=eq.true&select=id,category,channel,tone,...
```

**Fix**: Update the `get_template_pieces` function in Supabase to include `channel` in the return type/SELECT.

---

## 6. Draft Generation Flow (What the Backend Should Do)

```
CONTACT READY FOR OUTREACH
  |
  v
[1] DETERMINE CHANNEL
    - Read unified_contacts.primary_outreach_channel
    - If null: call assign_outreach_channel(brand_id, contact_id)
  |
  v
[2] SELECT COMPOSITION
    - email → email_compositions WHERE system='cold_outreach' AND is_default=true
    - linkedin DM → WHERE system='social_dm' (pick by platform or default)
    - engagement → WHERE system='social_engagement'
  |
  v
[3] FOR EACH SECTION IN composition.sections:
    - If pinned_piece_id → use that piece
    - Else → query outreach_email_templates WHERE:
        category = section.category
        AND channel IN (composition channel, 'all')
        AND is_active = true
        AND (lead_categories IS NULL OR contact's category = ANY(lead_categories))
        AND id NOT IN (SELECT template_id FROM contact_template_history WHERE contact_id = ?)
      Pick ONE (round-robin: ORDER BY usage_count ASC, random())
    - If requires_research AND no research data → pick a different piece
    - If section.required = false AND no pieces → skip section
  |
  v
[4] FILL VARIABLES
    {company} → contact.business_name
    {first_name} → first word of contact.contact_name, or "there"
    {observation} → from research/scraper data
    {specific_thing} → from research
    {category} → contact.lead_category
    {topic} → derived from category
    {platform} → target platform name
  |
  v
[5] ASSEMBLE
    Email: subject line separate, body = greeting + opening + body + question + cta + signoff [+ ps]
    Social DM: message = greeting + opening + [body] + cta [+ signoff]
    Engagement: comment = opening + [body] + cta
  |
  v
[6] GPT POLISH (optional)
    Send assembled message through GPT with instruction:
    "Smooth transitions between sections. Do NOT rewrite content.
     Do NOT add sentences. Keep variable values exactly as provided."
    Use voice settings (identity, keywords, banned phrases) for context.
  |
  v
[7] WRITE copy_drafts (with composition_id + templates_used)
[8] WRITE email_assembly_log (pieces_used JSONB + variables_filled JSONB)
[9] WRITE contact_template_history (one row per piece used)
[10] UPDATE piece metrics (usage_count, times_sent on send)
```

---

## 7. Variable Mapping Reference

| Variable | Source | Required |
|----------|--------|----------|
| `{company}` | `unified_contacts.business_name` | Always available |
| `{first_name}` | First word of `unified_contacts.contact_name` | Fallback: "there" |
| `{observation}` | Research/scraper data — e.g. "no online booking system" | Only if research exists |
| `{specific_thing}` | Research — e.g. "scheduling workflow" | Only if research exists |
| `{category}` | `unified_contacts.lead_category` or context | Always available |
| `{topic}` | Derived from category — e.g. "plumbing services" | Always available |
| `{platform}` | Target social platform name | Social only |

If a variable can't be filled, pick a different piece that doesn't need it (`requires_research = false`).

---

## 8. Current Backend Status

According to the `composable-outreach-system` knowledge entry (last updated 2026-03-27 by the backend developer):

**Already built and E2E tested**:
- `EMAIL-ASSEMBLY-UTIL` (workflow `soYPOA3t9AQXZwOq`) — assembles emails from compositions
- `PROSP-OUTREACH-DRAFT-V2` (workflow `QWsVl6RRfbO2PO7n`) — new draft generation using compositions
- `SOCIAL-DRAFT` modified (workflow `fZRUzqHCqUH5Vdnn`) — social draft generation
- Channel routing backfilled (302 contacts)
- Category CHECK constraint already dropped for custom categories
- `templates_used` UUID[] column added to `copy_drafts`
- Voice settings injected into GPT prompt
- Piece metrics incrementing (7 pieces have total_sent=1, total_opened=1 from E2E test)

**What the frontend session changed that the backend may need to catch up on**:
1. **28 new social pieces added** (was 34, now 62 social pieces). Backend should see these automatically since it queries the DB.
2. **Social prompt templates added** to `outreach_prompt_templates` (channel='social_dm', both system and user). If the social draft workflow reads prompts from this table, it will now find them.
3. **`get_template_pieces` RPC bug**: Frontend bypassed it with direct REST because `channel` is missing from the return. The RPC should be fixed to include `channel`.
4. **Frontend now uses direct REST** for piece loading instead of `get_template_pieces` RPC. If any backend code depends on the RPC's return format, this is a non-issue — the backend can continue using the RPC or switch to direct queries.

---

## 9. Frontend Pages and Deploy Paths

| Page | URL | Deploy Path | What It Does |
|------|-----|-------------|--------------|
| Email Outreach | `/email-outreach` | `email-outreach/index.html` | All email template/piece/composition management, drafts, prompts, performance, routing |
| Social Dashboard | `/social-dashboard` | `social-dashboard.html` | Social templates (read-only), social prompts (editable), DM/engagement queues |
| Email Voice Settings | `/email-voice-settings` | `email-voice-settings.html` | DEPRECATED — has banner pointing to Email Outreach |
| Social Voice Settings | `/social-voice-settings` | `social-voice-settings.html` | DEPRECATED — has banner pointing to Social Dashboard |
| Settings Directory | `/settings` | `settings/index.html` | Updated card descriptions noting legacy status |

---

## 10. Supabase RPCs Reference

| RPC | Purpose | Used By |
|-----|---------|---------|
| `get_template_pieces(p_brand_id, p_category, p_system, p_active_only)` | List pieces (BUG: missing `channel` in output) | Frontend (bypassed), Backend |
| `upsert_template_piece(p_brand_id, p_piece)` | Create/update piece | Frontend |
| `delete_template_piece(p_brand_id, p_piece_id)` | Soft-delete (is_active=false) | Frontend |
| `get_compositions(p_brand_id, p_system)` | List compositions | Frontend, Backend |
| `upsert_email_composition(p_brand_id, p_composition)` | Create/update composition | Frontend |
| `render_composition_preview(p_brand_id, p_composition_id, p_example_variables)` | Assemble preview from composition | Frontend, potentially Backend |
| `get_piece_performance(p_brand_id, p_category, p_min_sends)` | Per-piece metrics | Frontend (Performance tab) |
| `get_prompt_templates(p_brand_id, p_channel)` | Get system+user prompts | Frontend |
| `assign_outreach_channel(p_brand_id, p_contact_id)` | Fair-rotation channel assignment | Backend (prospecting) |
| `switch_outreach_channel(p_brand_id, p_contact_id, p_new_channel)` | Manual channel override | Frontend (Routing tab) |
| `update_outreach_channel_status(p_brand_id, p_contact_id, p_channel, p_status, p_details)` | Track channel attempt status | Backend (sending workflows) |

---

## 11. Testing Checklist

After any backend changes, verify:

- [ ] Draft for a known contact includes `composition_id` and `templates_used` in `copy_drafts`
- [ ] `email_assembly_log` has a row for the draft with `pieces_used` JSONB and `variables_filled` JSONB
- [ ] `contact_template_history` has rows for each piece used
- [ ] Two drafts for the same contact use different pieces (round-robin working)
- [ ] Frontend Drafts tab shows the draft with a channel badge
- [ ] Clicking the draft shows the piece attribution panel with composition name + pieces + variables
- [ ] Performance tab shows piece metrics after sending (times_sent > 0)
- [ ] Social pieces (social_dm, social_engagement channels) appear on the Social Dashboard Templates tab
- [ ] Custom category pieces appear in both the Email Templates tab and the Composition editor dropdown
