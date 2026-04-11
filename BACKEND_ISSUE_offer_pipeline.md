# Backend Issue: Offer Build Pipeline Not Executing

**Reported**: 2026-03-23
**Severity**: Feature non-functional
**Affected UI**: Offer Studio (`/offer-studio`) — Offers tab, Landing Pages tab

---

## What's Wrong

The offer build pipeline creates the correct 9-step plan but **never executes it**. All steps remain `pending`/`ready`, no artifacts are produced, and a "Final Review" human task was created prematurely with empty content. The frontend Offer Studio is built and waiting for data — it just has nothing meaningful to display.

### Current Data State

**Offer:** `O_260322080344` — "AI Lead Machine Scorecard for Solo Las Vegas Agents"

| Step | Key | Title | Status | Result | Artifacts |
|------|-----|-------|--------|--------|-----------|
| 1 | `research_market` | Research market and competition | `ready` | null | [] |
| 2 | `write_questions` | Write scorecard questions and scoring rubric | `pending` | null | [] |
| 3 | `approve_content` | Review questions and scoring (HUMAN) | `pending` | null | [] |
| 4 | `build_form` | Build intake questionnaire | `pending` | null | [] |
| 5 | `write_landing_copy` | Generate landing page content | `pending` | null | [] |
| 6 | `approve_landing` | Review landing page (HUMAN) | `pending` | null | [] |
| 7 | `write_emails` | Write delivery and follow-up emails | `pending` | null | [] |
| 8 | `setup_stripe` | Create Stripe product and payment link | `pending` | null | [] |
| 9 | `final_review` | Final review before launch (HUMAN) | `pending` | null | [] |

**Problem 1:** Step 1 is `ready` but nothing picked it up. The orchestrator workflow never started executing.

**Problem 2:** A human task `260322085247-HT` ("Final Review of Offer for Launch Approval") was created with this as the review content:
```
"All build steps completed for offer . Ready for final review and launch."
```
This is a hollow placeholder — missing the offer name, and there's nothing to actually review because no steps ran.

---

## How This Should Work

### The Build Pipeline Flow

When an offer is approved (proposal status → `approved`, offer created), the backend should **execute steps sequentially**, respecting `depends_on_step` dependencies:

```
Step 1: Research market (AI)
    ↓ writes result + artifacts
Step 2: Write scorecard questions (AI, uses Step 1 output)
    ↓ writes result + artifacts
Step 3: Human reviews questions ← HUMAN TASK with actual content
    ↓ human approves/edits
Step 4: Build intake form (AI, uses approved questions)
    ↓ writes result + artifacts
Step 5: Generate landing page (AI, uses approved content)
    ↓ writes result + artifacts
Step 6: Human reviews landing page ← HUMAN TASK with preview URL
    ↓ human approves/edits
Step 7: Write emails (AI)
    ↓ writes result + artifacts
Step 8: Setup Stripe (AI/integration)
    ↓ writes result + artifacts (payment link)
Step 9: Final human review ← HUMAN TASK with links to everything
    ↓ human approves → offer goes LIVE
```

### What Each Step Must Do

For every step, the orchestrator workflow must:

1. **Update `offer_build_steps`** — set `status: 'in_progress'`, then `status: 'completed'`
2. **Write `result`** — a JSON object summarizing what was produced
3. **Write `artifacts`** — an array of deliverables with URLs/content

Example for Step 2 (write questions):
```json
// offer_build_steps.result
{
  "summary": "Created 12 scorecard questions across 4 categories with weighted scoring rubric",
  "question_count": 12,
  "categories": ["Lead Generation", "Follow-up Systems", "AI Tool Usage", "Content & Social"]
}

// offer_build_steps.artifacts
[
  {
    "type": "document",
    "label": "Scorecard Questions & Rubric",
    "url": "https://docs.google.com/document/d/...",
    "format": "google_doc"
  },
  {
    "type": "text",
    "label": "Question Summary",
    "content": "1. How do you currently generate new leads? (0-3 scale)\n2. ..."
  }
]
```

### What the `offers` Row Must Update

As steps complete, update the `offers` table:
- `steps_completed` — increment as each step finishes
- `current_step` — the title of the currently executing step
- `status` — transition through: `ideation` → `approved` → `building` → `review` (when waiting for human) → `ready` (after final review) → `live`
- `landing_page_url` — set when landing page is generated (Step 5)
- `stripe_payment_link` — set when Stripe is configured (Step 8)

**Currently broken:** `steps_completed` is `0` even though the RPC `get_dashboard_offers` returns it, confirming nothing has run.

---

## Human Tasks — Rich Content Required

When a build step has `requires_human: true`, the workflow must create a human task in `directive_tasks` with **meaningful review content**. The frontend renders this content — if it's empty, Bradford has nothing to review.

### Step 3: Review Questions & Scoring

Create a human task with:
```json
{
  "title": "Review Scorecard Questions: AI Lead Machine Scorecard",
  "description": "Review the AI-generated scorecard questions and scoring rubric for the Las Vegas real estate agent offer. Edit or approve to proceed to form building.",
  "domain": "offers",
  "requires_human": true,
  "human_action_type": "approve_content",
  "parameters": {
    "review_content": {
      "type": "document",
      "data": "https://docs.google.com/document/d/..."
    },
    "action_options": ["approve", "edit", "request_changes"],
    "context": {
      "offer_id": "O_260322080344",
      "offer_title": "AI Lead Machine Scorecard for Solo Las Vegas Agents",
      "step_key": "approve_content",
      "previous_step_summary": "12 questions created across 4 categories..."
    }
  }
}
```

If the content is text (not a document), use:
```json
"review_content": {
  "type": "text",
  "data": "1. How do you currently generate new leads?\n   Score: 0 = No system, 1 = Occasional referrals..."
}
```

### Step 6: Review Landing Page

```json
{
  "review_content": {
    "type": "url",
    "data": "https://offers.bradfordcarlton.com/preview/ai-lead-machine-scorecard"
  },
  "context": {
    "offer_id": "O_260322080344",
    "headline": "Is Your Lead Gen AI-Ready?",
    "step_key": "approve_landing"
  }
}
```

### Step 9: Final Review

This is the big one — it should aggregate everything:
```json
{
  "title": "Final Review: AI Lead Machine Scorecard — Ready for Launch?",
  "description": "All components are built. Review everything below and approve to go live.",
  "parameters": {
    "review_content": {
      "type": "text",
      "data": "OFFER SUMMARY\n=============\nTitle: AI Lead Machine Scorecard for Solo Las Vegas Agents\nPrice: $47.00 (one-time)\nTemplate: Scorecard\n\nCOMPONENTS BUILT\n================\n✓ Market research completed\n✓ 12 scorecard questions + rubric\n✓ Intake questionnaire form\n✓ Landing page: https://offers.bradfordcarlton.com/ai-lead-machine-scorecard\n✓ Delivery + follow-up email sequence (3 emails)\n✓ Stripe payment link: https://buy.stripe.com/...\n\nREADY TO LAUNCH\nApprove to set status to 'live' and activate the payment link."
    },
    "action_options": ["approve", "reject", "request_changes"],
    "context": {
      "offer_id": "O_260322080344",
      "landing_page_url": "https://offers.bradfordcarlton.com/preview/...",
      "stripe_link": "https://buy.stripe.com/...",
      "artifacts_count": 6
    }
  }
}
```

---

## Proposals — Approval Flow

The `offer_proposals` table has a row with `status: 'approved'` but `reviewed_at: null`. The approval happened automatically (or was never actually reviewed).

**Expected flow:**
1. Proposal created with `status: 'pending'`
2. Human task created for proposal review (showing rationale + supporting data)
3. Human approves → `status: 'approved'`, `reviewed_at` set, offer created
4. Human rejects → `status: 'rejected'`, `human_feedback` set

The frontend Offer Studio now shows proposals with their rationale and supporting data, and has approve/reject buttons for pending proposals. The backend just needs to:
- Create human tasks for pending proposals with `review_content` containing the rationale
- Handle the `/webhook/human-action` response to update proposal status

---

## Offer Studio Frontend — What's Ready

The frontend is built and waiting for data. Here's what it displays and where data comes from:

| Frontend Section | Data Source | What it needs |
|-----------------|-------------|---------------|
| Offer Pipeline cards | `get_dashboard_offers` RPC | `steps_completed` to increment, `current_step` to update, `status` to transition, links to populate |
| Build step timeline (expandable) | `offer_build_steps` table | `status`, `result`, `artifacts` per step |
| Pending Tasks | `get_offer_studio_tasks` RPC | Rich `review_content` with actual deliverables |
| Proposals | `offer_proposals` table | Approval flow tasks for pending proposals |
| Landing Pages | `get_dashboard_landing_pages` RPC | Landing page rows created during Step 5 |
| Revenue | `get_revenue_summary` RPC + `offer_purchases` table | Populated when offers go live and get purchases |

### Realtime Subscriptions Active

The frontend subscribes to Postgres changes on: `offers`, `offer_build_steps`, `directive_tasks`, `landing_pages`, `crm_testimonials`. As the backend writes data, the frontend will update live.

---

## Priority Actions

1. **Fix the orchestrator workflow** to execute build steps sequentially starting from Step 1 (`ready` status)
2. **Populate `result` and `artifacts`** on each step as it completes
3. **Create human tasks with rich `review_content`** at Steps 3, 6, and 9
4. **Update `offers` row** (`steps_completed`, `current_step`, `status`) as pipeline progresses
5. **Delete or replace** the premature human task `260322085247-HT` — it has no content to review
6. **Wire up proposal approval** — create human tasks for pending proposals

---

## Supabase Tables Reference

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `offers` | offer_id, status, steps_completed, current_step, landing_page_url, stripe_payment_link | Offer master record |
| `offer_build_steps` | offer_id, step_key, step_sequence, status, result, artifacts, requires_human | Build pipeline steps |
| `offer_proposals` | proposal_id, status, rationale, supporting_data, confidence_score, human_feedback | AI-generated proposals |
| `offer_templates` | template_key, display_name, description, default_price_cents | Template definitions |
| `directive_tasks` | task_id, title, description, parameters (review_content, action_options), requires_human | Human review tasks |
| `landing_pages` | page_id, slug, title, status, preview_url, public_url, page_views, conversions | Landing page records |
| `offer_purchases` | purchase_id, offer_id, customer_email, amount_cents, payment_status | Sales records |

## Webhook Endpoints (already configured)

| Endpoint | Purpose |
|----------|---------|
| `POST /webhook/offer-ideate` | Create new offer idea → proposal → offer |
| `POST /webhook/human-action` | Handle approve/reject/edit from frontend |
| `POST /webhook/testimonial-ingest` | Add testimonial → polish workflow |
| `POST /webhook/lp-publish` | Publish/unpublish landing page |
