# Frontend Integration Spec: Email Voice & Style Settings

## Overview

A standalone Settings page for controlling how outreach email copy is written. The backend stores voice/tone configuration in Supabase, workflows read it when drafting emails, and a nightly learning system suggests improvements based on approve/reject patterns.

**This page is NOT embedded in crm.html** — it's a standalone page with its own route.

**Auth:** Same Supabase auth gate as crm.html (anon key + RLS).

---

## 1. Supabase Connection

```
SUPABASE_URL = https://yrwrswyjawmgtxrgbnim.supabase.co
SUPABASE_ANON_KEY = (same key used in crm.html)
```

All requests use headers:
```javascript
headers: {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
}
```

---

## 2. API Contracts

### 2a. Load Settings

```
GET /rest/v1/outreach_voice_settings?brand_id=eq.carlton&limit=1
```

Returns array with 0 or 1 rows. If empty, show defaults and create on first save.

**Response shape (single row):**
```json
{
  "id": 1,
  "brand_id": "carlton",
  "about_you": "",
  "signature_name": "Bradford",
  "company_name": "Carlton AI",
  "tone_warmth": 7,
  "tone_formality": 3,
  "tone_confidence": 8,
  "tone_humor": 4,
  "tone_salesiness": 3,
  "subject_style": "curiosity",
  "subject_max_length": 60,
  "subject_use_emoji": false,
  "keywords": ["automation", "efficiency", "revenue growth", "time savings"],
  "value_propositions": [
    "Saved clients 20+ hours per week through automation",
    "Built systems that generate revenue while you sleep"
  ],
  "banned_phrases": [
    "leverage", "synergy", "AI-powered", "game-changer", "disrupt",
    "circle back", "low-hanging fruit", "paradigm shift",
    "I hope this email finds you well"
  ],
  "max_paragraphs": 4,
  "max_sentences_per_paragraph": 3,
  "use_case_studies": true,
  "use_specific_numbers": true,
  "use_questions": true,
  "cta_style": "soft",
  "opening_style": "problem",
  "greeting_style": "casual",
  "greeting_custom": "",
  "signoff_style": "forward",
  "signoff_custom": "",
  "email_length": "short",
  "use_recipient_name": true,
  "personalization_depth": "light",
  "proof_style": "none",
  "subject_length_target": "short",
  "first_person_style": "i",
  "creativity": 7,
  "identify_as_sender": true,
  "include_value_props": true,
  "custom_instruction": "",
  "industry_match_proofs": true,
  "version": 9,
  "updated_at": "2026-03-20T07:09:08.042268+00:00",
  "created_at": "2026-03-20T05:43:31.455727+00:00"
}
```

### 2b. Save Settings (Partial Update)

Uses the `save_voice_settings` RPC. Supports partial updates (only send fields that changed). Version auto-increments.

```
POST /rest/v1/rpc/save_voice_settings
```

**Request body:**
```json
{
  "p_brand_id": "carlton",
  "p_settings": {
    "tone_warmth": 8,
    "about_you": "Updated about text...",
    "keywords": ["automation", "efficiency", "AI workflows"]
  }
}
```

**Response:**
```json
{ "success": true, "version": 2 }
```

**Important:** Array fields (`keywords`, `value_propositions`, `banned_phrases`) must be sent as complete arrays — the RPC replaces the entire array, not appending. Manage add/remove in the frontend and send the full updated array.

### 2c. Load Pending Suggestions

```
GET /rest/v1/voice_learning_log?brand_id=eq.carlton&status=eq.pending&order=created_at.desc
```

**Response shape (array):**
```json
[
  {
    "id": 5,
    "brand_id": "carlton",
    "analysis_date": "2026-03-21",
    "drafts_analyzed": 47,
    "approved_count": 32,
    "rejected_count": 15,
    "suggestion_type": "tone_adjustment",
    "setting_field": "tone_salesiness",
    "current_value": "5",
    "suggested_value": "3",
    "reasoning": "12 of 15 rejected drafts contained feedback about being 'too pushy' or 'too salesy'. Approved drafts used softer language.",
    "evidence": [
      { "draft_id": 142, "status": "rejected", "feedback_snippet": "too pushy, dial it back" },
      { "draft_id": 138, "status": "rejected", "feedback_snippet": "feels like a sales pitch" }
    ],
    "confidence": "high",
    "status": "pending",
    "created_at": "2026-03-21T06:30:00+00:00"
  }
]
```

### 2d. Accept/Dismiss Suggestion

```
POST /rest/v1/rpc/resolve_voice_suggestion
```

**Request body:**
```json
{
  "p_suggestion_id": 5,
  "p_action": "accepted"
}
```

Valid actions: `"accepted"` or `"dismissed"`.

**Response:**
```json
{ "success": true, "action": "accepted" }
```

When accepted: the frontend should also call `save_voice_settings` to apply the suggested value to the settings. The RPC only marks the suggestion as resolved — it does NOT auto-apply.

### 2e. AI Text Expansion

```
POST https://n8n.carltonaiservices.com/webhook/voice-expand
```

**Request body:**
```json
{
  "brand_id": "carlton",
  "field": "about_you",
  "input_text": "I help small businesses automate their operations using AI",
  "personality": "brand_guardian",
  "current_settings": { /* optional: pass current settings for context */ }
}
```

**Valid `field` values:** `about_you`, `value_propositions`, `keywords`, `banned_phrases`, `subject_line`

**Valid `personality` values:**

| Personality | Description | Best For |
|------------|-------------|----------|
| `brand_guardian` | Professional polish, brand consistency | About You, Company description |
| `content_creator` | Compelling copy, storytelling hooks | Value propositions, keywords |
| `growth_hacker` | Conversion-focused, action-oriented | CTAs, subject lines |
| `discovery_coach` | Problem-first framing, empathy-driven | Opening lines, pain points |

**Response:**
```json
{
  "success": true,
  "expanded_text": "I partner with small business owners who are drowning in manual work...",
  "alternatives": [
    "Alternative approach 1...",
    "Alternative approach 2..."
  ],
  "personality": "brand_guardian",
  "field": "about_you",
  "tokens_used": 448
}
```

Returns 1 primary expansion + 2 alternatives. Typical response time: 3-8 seconds.

### 2f. Recent Approval/Rejection Stats (for patterns display)

```
GET /rest/v1/copy_drafts?brand_id=eq.carlton&copy_type=eq.cold_outreach_email&review_status=in.(approved,rejected,skipped)&order=updated_at.desc&limit=50&select=id,review_status,human_feedback,updated_at
```

Compute stats client-side from the response.

---

## 3. Data Schema Reference

### outreach_voice_settings

| Column | Type | Range/Constraints | Default | UI Element |
|--------|------|-------------------|---------|------------|
| `about_you` | TEXT | Free text | `''` | Textarea (4-6 rows) |
| `signature_name` | TEXT | Free text | `'Bradford'` | Text input |
| `company_name` | TEXT | Free text | `'Carlton AI'` | Text input |
| `tone_warmth` | INT | 1-10 | 7 | Range slider |
| `tone_formality` | INT | 1-10 | 3 | Range slider |
| `tone_confidence` | INT | 1-10 | 8 | Range slider |
| `tone_humor` | INT | 1-10 | 4 | Range slider |
| `tone_salesiness` | INT | 1-10 | 3 | Range slider |
| `subject_style` | TEXT | curiosity, direct, question, statistic, personalized | `'curiosity'` | Radio pills / Select |
| `subject_max_length` | INT | 20-120 | 60 | Number input |
| `subject_use_emoji` | BOOLEAN | true/false | false | Toggle switch |
| `keywords` | TEXT[] | String array | 4 defaults | Chip/tag list with add/remove |
| `value_propositions` | TEXT[] | String array | 2 defaults | Chip/tag list with add/remove |
| `banned_phrases` | TEXT[] | String array | 9 defaults | Chip/tag list with add/remove |
| `max_paragraphs` | INT | 1-8 | 4 | Number input |
| `max_sentences_per_paragraph` | INT | 1-6 | 3 | Number input |
| `use_case_studies` | BOOLEAN | true/false | true | Toggle switch |
| `use_specific_numbers` | BOOLEAN | true/false | true | Toggle switch |
| `use_questions` | BOOLEAN | true/false | true | Toggle switch |
| `cta_style` | TEXT | soft, direct, question, none | `'soft'` | Radio pills / Select |
| `opening_style` | TEXT | problem, compliment, observation, statistic, story | `'problem'` | Radio pills / Select |
| `greeting_style` | TEXT | none, name, casual, formal, custom | `'none'` | Radio pills / Select |
| `greeting_custom` | TEXT | Free text (used when greeting_style='custom') | `''` | Text input (conditional) |
| `signoff_style` | TEXT | none, minimal, warm, forward, custom | `'warm'` | Radio pills / Select |
| `signoff_custom` | TEXT | Free text (used when signoff_style='custom') | `''` | Textarea (conditional, multiline) |
| `email_length` | TEXT | short, medium, long | `'medium'` | Radio pills / Select |
| `use_recipient_name` | BOOLEAN | true/false | true | Toggle switch |
| `personalization_depth` | TEXT | light, medium, deep | `'medium'` | Radio pills / Select |
| `proof_style` | TEXT | case_study, statistic, testimonial, none | `'case_study'` | Radio pills / Select |
| `subject_length_target` | TEXT | short, medium, long | `'medium'` | Radio pills / Select |
| `first_person_style` | TEXT | i, we | `'i'` | Radio pills / Toggle |
| `creativity` | INT | 1-10 | 7 | Range slider (maps to GPT temperature: 1=predictable, 10=creative) |
| `identify_as_sender` | BOOLEAN | true/false | true | Toggle (whether GPT says "I'm [name] from [company]") |
| `include_value_props` | BOOLEAN | true/false | true | Toggle (suppress value propositions section when off) |
| `custom_instruction` | TEXT | Free text | `''` | Textarea (appended to GPT prompt as additional guidance) |
| `industry_match_proofs` | BOOLEAN | true/false | true | Toggle (prefer proof bank entries matching lead's industry) |
| `version` | INT | Auto-incremented | 1 | Display only (read-only badge) |

### outreach_proof_bank (CRUD table)

| Column | Type | Constraints | Default | UI Element |
|--------|------|-------------|---------|------------|
| `id` | SERIAL | PK | auto | Hidden |
| `brand_id` | TEXT | | `'carlton'` | Hidden |
| `proof_type` | TEXT | case_study, statistic, testimonial, credential | required | Select dropdown |
| `title` | TEXT | required | | Text input |
| `content` | TEXT | required | | Textarea |
| `metrics` | TEXT | optional | null | Text input |
| `industry` | TEXT | optional | null | Text input |
| `client_name` | TEXT | optional | null | Text input |
| `is_public` | BOOLEAN | | true | Toggle |
| `is_active` | BOOLEAN | | true | Toggle |
| `sort_order` | INT | | 0 | Number / drag-to-reorder |

**Proof bank CRUD endpoints:**
- **Load:** `GET /rest/v1/outreach_proof_bank?brand_id=eq.carlton&is_active=eq.true&order=sort_order.asc`
- **Add:** `POST /rest/v1/outreach_proof_bank` with `{ brand_id, proof_type, title, content, ... }`
- **Update:** `PATCH /rest/v1/outreach_proof_bank?id=eq.{id}` with changed fields
- **Delete:** `DELETE /rest/v1/outreach_proof_bank?id=eq.{id}`

**Important:** Proof bank entries are real, verified case studies and credentials. The AI is instructed to ONLY reference these — never fabricate stats. The frontend should make it easy to add/edit/reorder entries.

---

## 4. UI Component Guidance

The designer has full creative control. These are suggested groupings and behaviors.

### Panel 1: About You & Your Company
- `about_you` textarea with an "Expand with AI" button (calls voice-expand with `field: "about_you"`)
- `signature_name` and `company_name` inline inputs
- When AI returns results, show primary expansion with "Use This" button, and 2 alternatives in a collapsible section

### Panel 2: Voice & Tone (5 sliders)
Each slider row should show:
- Left label (low end) - slider - Right label (high end) - current value

| Dimension | Left Label (1) | Right Label (10) |
|-----------|---------------|------------------|
| Warmth | Direct | Warm |
| Formality | Casual | Formal |
| Confidence | Humble | Bold |
| Humor | Serious | Witty |
| Salesiness | Genuine | Salesy |

Optional: show a preview of what the prompt text looks like for the current value (see tone mapping in Section 5).

### Panel 3: Greeting & Sign-off
These are applied **programmatically** (not by AI) — whatever is configured here appears verbatim.

**Greeting:**
- `greeting_style` radio pills: None / Name / Casual / Formal / Custom
  - **None**: email starts with body text, no greeting
  - **Name**: "Hi [FirstName]," (uses decision maker name if available, falls back to "Hi there,")
  - **Casual**: "Hey there,"
  - **Formal**: "Dear [Name]," or "Dear Team,"
  - **Custom**: shows a text input for `greeting_custom` (user types their own)
- Only show the `greeting_custom` input when "Custom" is selected

**Sign-off:**
- `signoff_style` radio pills: None / Minimal / Warm / Forward / Custom
  - **None**: email ends with last sentence, no sign-off
  - **Minimal**: just the name (e.g., "Bradford")
  - **Warm**: "Best, [name]"
  - **Forward**: "Looking forward to hearing from you, [name]"
  - **Custom**: shows a textarea for `signoff_custom` (user types full block, multiline supported)
- Only show `signoff_custom` textarea when "Custom" is selected
- The `signature_name` from Panel 1 is used in all non-custom sign-offs

**Preview:** Show a live preview of exactly what the greeting and sign-off will look like.

### Panel 4: Subject Lines
- `subject_style` selection (5 options): curiosity, direct, question, statistic, personalized
- `subject_length_target` selection (3 options): short (<40 chars), medium (40-60), long (60-80)
- `subject_max_length` number input (hard ceiling)
- `subject_use_emoji` toggle

### Panel 5: Email Structure
- `email_length` selection: Short (2-3 sentences) / Medium (3-4 paragraphs) / Long (4-5 paragraphs)
- `opening_style` selection (5 options): problem, compliment, observation, statistic, story
- `cta_style` selection (4 options): soft, direct, question, none
- `first_person_style` toggle: "I/my" vs "We/our"
- `use_recipient_name` toggle
- `personalization_depth` selection: light / medium / deep
- `max_paragraphs` and `max_sentences_per_paragraph` number inputs
- Toggle switches: `use_case_studies`, `use_specific_numbers`, `use_questions`
- `identify_as_sender` toggle: Whether GPT introduces itself as "[Name] from [Company]" in the email
- `include_value_props` toggle: Whether to inject value propositions into the prompt (disable to prevent GPT from referencing them)
- `industry_match_proofs` toggle: Whether to prefer proof bank entries matching the lead's industry

### Panel 5b: Creativity & Advanced
- `creativity` slider (1-10): Controls how varied/creative GPT's output is. Show the current label (e.g., "Balanced" at 5, "Creative" at 7). Preview: "Lower = more consistent emails, Higher = more unique approaches"
- `custom_instruction` textarea: Free-text field appended to every GPT prompt. Example: "Always reference the lead's city" or "Focus on how automation reduces hiring needs"
- Note: token budget auto-scales with email_length (short=512, medium=1024, long=2048)

### Panel 6: Proof Bank (CRUD table)
This is where real case studies, statistics, testimonials, and credentials are managed. The AI is instructed to ONLY use entries from this bank — never fabricate.

- Editable table/card list showing all `outreach_proof_bank` entries
- Each entry shows: type badge, title, content preview, metrics, industry
- Add button opens a form with: proof_type (select), title, content (textarea), metrics, industry, client_name
- Edit/delete on each entry
- Drag-to-reorder (updates `sort_order`)
- `is_active` toggle per entry (inactive entries are excluded from email prompts)
- `proof_style` setting (in Panel 5) controls which TYPE of proof is preferred in emails

### Panel 7: Keywords, Value Props & Banned Phrases
Three sections, each with:
- A list of existing items as removable chips/tags
- An input field to add new items (Enter key or Add button)
- An "Expand with AI" button to generate suggestions (calls voice-expand)

Suggested color coding:
- Keywords: accent/green tint
- Value propositions: info/blue tint
- Banned phrases: alert/red tint

### Panel 8: AI Suggestions (conditional)
Only visible when pending suggestions exist.
- Show count badge on section header
- Each suggestion as a card showing:
  - `suggestion_type` badge
  - `reasoning` text
  - `current_value` -> `suggested_value` comparison
  - Evidence count ("Based on X drafts")
  - Accept button (applies change to form + saves + resolves)
  - Dismiss button (resolves without changes)

### Panel 9: Recent Patterns (optional, informational)
- Last 7 days stats: total drafts, approved %, rejected %, skipped %
- Collapsible list of recent rejected drafts showing `human_feedback` text
- Read-only, no edit controls

### Save Behavior
- Save button (sticky or bottom of page) that collects all form values and calls `save_voice_settings` RPC
- Show toast/notification on success with new version number
- Consider auto-save on individual changes (e.g., slider release, chip add/remove) vs explicit save button — designer's choice

---

## 5. Tone Slider to Prompt Mapping (10 tiers per dimension)

Each slider value maps to a distinct prompt instruction. Show the current tier description as a preview label next to the slider.

### Warmth (1-10)
| Value | Label | Prompt Text |
|-------|-------|------------|
| 1 | Ice Cold | ice-cold and blunt — zero pleasantries |
| 2 | Very Direct | very direct — no small talk, facts only |
| 3 | Businesslike | businesslike and efficient — minimal warmth |
| 4 | Reserved | polite but reserved — professional distance |
| 5 | Neutral | neutral and balanced — neither cold nor warm |
| 6 | Friendly | friendly and personable — like a colleague |
| 7 | Warm | warm and approachable — genuine interest in them |
| 8 | Very Warm | very warm — like writing to someone you want to help |
| 9 | Caring | caring and empathetic — you genuinely want their success |
| 10 | Heartfelt | deeply personal and heartfelt — like writing to a friend |

### Formality (1-10)
| Value | Label | Prompt Text |
|-------|-------|------------|
| 1 | Text Message | extremely casual — like a text message |
| 2 | Very Informal | very informal — slang is fine, contractions everywhere |
| 3 | Relaxed | relaxed and conversational — easy-going |
| 4 | Casual Pro | casual professional — friendly but competent |
| 5 | Balanced | balanced — standard business communication |
| 6 | Polished | polished professional — clean and composed |
| 7 | Business Formal | business formal — structured and precise |
| 8 | Very Formal | very formal — corporate boardroom appropriate |
| 9 | Highly Formal | highly formal — no contractions, measured language |
| 10 | Executive | ultra-formal — executive correspondence level |

### Confidence (1-10)
| Value | Label | Prompt Text |
|-------|-------|------------|
| 1 | Tentative | extremely tentative — hedging everything |
| 2 | Unsure | very unsure — lots of qualifiers and maybes |
| 3 | Modest | modest — downplaying your expertise |
| 4 | Humble | humble — letting results speak quietly |
| 5 | Balanced | balanced — confident without overstatement |
| 6 | Self-Assured | self-assured — clear belief in your value |
| 7 | Confident | confident — strong claims backed by experience |
| 8 | Bold | bold — assertive statements, no hedging |
| 9 | Very Bold | very bold — commanding authority on the topic |
| 10 | Absolute | absolute conviction — unwavering certainty |

### Humor (1-10)
| Value | Label | Prompt Text |
|-------|-------|------------|
| 1 | Dead Serious | dead serious — no levity whatsoever |
| 2 | Strictly Pro | very serious — strictly professional |
| 3 | Mostly Serious | mostly serious — an occasional light touch |
| 4 | Dry Wit | professional with dry wit — subtle |
| 5 | Balanced | balanced — a light moment feels natural |
| 6 | Light-Hearted | light-hearted — warm humor throughout |
| 7 | Playful | playful — witty observations, fun analogies |
| 8 | Witty | witty — clever wordplay and personality |
| 9 | Very Humorous | very humorous — jokes and colorful language |
| 10 | Full Comedy | full comedy — entertaining above all else |

### Salesiness (1-10)
| Value | Label | Prompt Text |
|-------|-------|------------|
| 1 | Anti-Sales | anti-sales — purely helpful, zero pitch |
| 2 | Very Genuine | very genuine — sharing info with no agenda |
| 3 | Helpful First | helpful first — any business angle is incidental |
| 4 | Subtle | subtle — gently pointing toward a conversation |
| 5 | Balanced | balanced — clear value prop but no pressure |
| 6 | Lightly Persuasive | lightly persuasive — nudging toward a next step |
| 7 | Persuasive | persuasive — making a clear case for action |
| 8 | Sales-Forward | sales-forward — definite pitch with urgency |
| 9 | Aggressive | aggressive pitch — strong push for commitment |
| 10 | Hard Close | hard close — maximum urgency and pressure |

### Creativity Slider (1-10)
Maps to GPT temperature (controls output variability):

| Value | Label | GPT Temperature | Effect |
|-------|-------|----------------|--------|
| 1 | Predictable | 0.20 | Very consistent, safe, formulaic |
| 3 | Conservative | 0.38 | Reliable with minor variation |
| 5 | Balanced | 0.56 | Good mix of consistency and creativity |
| 7 | Creative | 0.73 | More varied language and approaches |
| 10 | Wild | 1.00 | Maximum creativity, least predictable |

---

## 6. Workflow Reference

| Workflow | ID | Webhook Path | Purpose |
|----------|-----|-------------|---------|
| VOICE-EXPAND | `Kyw1Mp0jHh9ekAkX` | `voice-expand` | AI text expansion with 4 personalities |
| VOICE-LEARN | `PUWdgIPKprlAkNOl` | (schedule 6:30 AM UTC daily) | Nightly pattern analysis, saves suggestions |
| PROSP-OUTREACH-DRAFT | `VYoXVz89mi7ZriEl` | `prosp-outreach-draft` | Reads settings when drafting emails |

---

## 7. Testing Checklist

- [ ] Load settings page — all fields populated from Supabase
- [ ] Adjust each tone slider — verify value updates
- [ ] Add/remove keywords — verify array updates on save
- [ ] Add/remove value propositions — verify array updates on save
- [ ] Add/remove banned phrases — verify array updates on save
- [ ] Change subject style, CTA style, opening style — verify save
- [ ] Toggle switches (case studies, numbers, questions, emoji) — verify save
- [ ] Edit about_you text, save, reload — verify persistence
- [ ] Click "Expand with AI" on about_you — verify expansion returns
- [ ] Try different AI personalities — verify different output styles
- [ ] Check AI Suggestions panel when suggestions exist — verify display
- [ ] Accept a suggestion — verify setting updates and suggestion resolves
- [ ] Dismiss a suggestion — verify it disappears without changing settings
- [ ] Version number increments on each save
- [ ] Page handles empty state (no settings row) gracefully
- [ ] **Greeting:** Set to "Casual" — verify emails start with "Hey there,"
- [ ] **Greeting:** Set to "Custom" with custom text — verify it appears verbatim
- [ ] **Greeting:** Set to "None" — verify no greeting in email
- [ ] **Sign-off:** Set to "Custom" with multiline text — verify exact output
- [ ] **Sign-off:** Set to "None" — verify email ends with body text only
- [ ] **Email length:** Set to "Short" — verify 2-3 sentences only
- [ ] **First person:** Toggle I vs We — verify pronoun usage changes
- [ ] **Proof bank:** Add a new proof entry — verify it saves
- [ ] **Proof bank:** Edit/delete entries — verify changes persist
- [ ] **Proof bank:** Deactivate entry — verify it's excluded from emails
- [ ] **Proof style:** Set to "none" — verify no proof points in email
- [ ] **Custom greeting/signoff inputs** only visible when "Custom" is selected
