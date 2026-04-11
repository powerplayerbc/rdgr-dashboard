# Frontend Handoff: Business Systems Intake (BSI)

## Status: Session 8 Complete -- Full BSI System Built + Branding Integration (10 Workflows)

**Date**: 2026-03-29
**Backend Developer**: Claude (Backend)
**For**: Frontend Developer (Dashboard Integration)

---

## 1. System Overview

The Business Systems Intake is the operational counterpart to the Branding System. Where branding captures the "feeling and mission" (who we are), BSI captures the "nitty gritty" (what we do, what we refuse to do, and the rules we follow). It uses the same discovery session pattern as BRAND-DISCOVERY.

### Data Flow

```
 BSI-DISCOVERY                         (Future)
 +------------------+                  SLAGATHORE-CHECK
 | 12 categories    |                  +--------------------+
 | ~130 seed Qs     |  synthesize      | Loads rules        |
 | depth analysis   | ────────────┐    | Checks content     |
 | follow-up Qs     |             |    | Routes by verdict  |
 +------------------+             |    +--------------------+
        |                         |
        v                         v
 +------------------+    +-----------------+
 | bsi_discovery    |    | bsi_policy_rules|
 | _sessions        |    | (rule store)    |
 | bsi_discovery    |    +-----------------+
 | _questions       |
 +------------------+    (Future) BSI-DOC-GEN
                         +--------------------+
 autonomous_brands       | 8 document types   |
 .policies (JSONB)       | Google Docs output  |
                         +--------------------+
```

### Webhooks

| Workflow | Webhook URL | Method |
|----------|-------------|--------|
| BSI-DISCOVERY | `POST https://n8n.carltonaiservices.com/webhook/bsi-discovery` | POST |
| BSI-DOC-GEN | `POST https://n8n.carltonaiservices.com/webhook/bsi-doc-gen` | POST |
| BSI-LIFECYCLE | `POST https://n8n.carltonaiservices.com/webhook/bsi-lifecycle` | POST |
| SLAGATHORE-CHECK | `POST https://n8n.carltonaiservices.com/webhook/slagathore-check` | POST |
| SLAGATHORE-REDRAFT | `POST https://n8n.carltonaiservices.com/webhook/slagathore-redraft` | POST |
| SLAGATHORE-AUDIT | `POST https://n8n.carltonaiservices.com/webhook/slagathore-audit` | POST |
| SLAGATHORE-QUEUE | `POST https://n8n.carltonaiservices.com/webhook/slagathore-queue` | POST |
| SLAGATHORE-SUBMIT | `POST https://n8n.carltonaiservices.com/webhook/slagathore-submit` | POST |
| DOC-SCANNER | `POST https://n8n.carltonaiservices.com/webhook/doc-scanner` | POST |
| GAP-ANALYZER | `POST https://n8n.carltonaiservices.com/webhook/gap-analyzer` | POST |

### Workflow IDs

| Workflow | n8n ID | Nodes | Registry ID |
|----------|--------|-------|-------------|
| BSI-DISCOVERY | `wh2nv8h8JAyz3Zui` | 29 | 443 |
| BSI-DOC-GEN | `YEYYbSa8lmVVgkKa` | 16 | 444 |
| BSI-LIFECYCLE | `6ZLYM2dt9xYfeoSm` | 20 | 445 |
| SLAGATHORE-CHECK | `WsXSqcwkU6NXTezk` | 17 | 446 |
| SLAGATHORE-REDRAFT | `M8apnfjAQFv0kRhA` | 9 | 447 |
| SLAGATHORE-AUDIT | `fXWgyBH7J3uOAsM4` | 12 | 448 |
| SLAGATHORE-QUEUE | `2zTixmmCwqpIdzZd` | 15 | 449 |
| SLAGATHORE-SUBMIT | `KMltirSaYQ1YfoUn` | 4 | 450 |
| DOC-SCANNER | `kjoCymEwoCVlX6gU` | 20 | 451 |
| GAP-ANALYZER | `C6iMQNpby7ubBatA` | 20 | 452 |

---

## 2. BSI-DISCOVERY IO Contract

### Operation: `start_session`

Starts (or resumes) a BSI discovery session for a specific category.

**Request:**
```json
{
  "operation": "start_session",
  "brand_id": "carlton",
  "category": "service_scope"
}
```

**Response (new session):**
```json
{
  "success": true,
  "operation": "start_session",
  "action": "created",
  "session_id": "5501cb09-f288-47dd-baca-9b13e14451e9",
  "category": "service_scope",
  "total_questions": 12,
  "first_question": {
    "seed_id": 1,
    "type": "open",
    "question": "What specific services does your company offer, and are there any you explicitly refuse to provide?",
    "context": "Core scope definition",
    "options": null,
    "source": "seed",
    "answer": null,
    "depth_score": null,
    "follow_up_asked": false,
    "selected": null,
    "verdict": null,
    "adjustment": null,
    "rankings": null,
    "insight": null
  },
  "depth_target": 0.85
}
```

**Response (resumed session):**
```json
{
  "success": true,
  "operation": "start_session",
  "action": "resumed",
  "session_id": "uuid",
  "category": "service_scope",
  "status": "in_progress",
  "progress": { "answered": 3, "depth": 0.72, "target": 0.85 }
}
```

### Operation: `submit_answer`

Submit an answer to the current question. Backend runs GPT depth analysis and may generate follow-up questions.

**Request (open question):**
```json
{
  "operation": "submit_answer",
  "brand_id": "carlton",
  "session_id": "uuid",
  "answer": "We offer AI automation consulting, n8n workflow development..."
}
```

**Request (this_or_that):**
```json
{
  "operation": "submit_answer",
  "brand_id": "carlton",
  "session_id": "uuid",
  "selected": "a"
}
```

**Request (approve_deny):**
```json
{
  "operation": "submit_answer",
  "brand_id": "carlton",
  "session_id": "uuid",
  "verdict": "close_but",
  "adjustment": "True for most cases, but we make exceptions for strategic partners"
}
```

**Request (ranking):**
```json
{
  "operation": "submit_answer",
  "brand_id": "carlton",
  "session_id": "uuid",
  "rankings": ["Alignment with expertise", "Strategic value", "Profitability", "Client relationship potential", "Time commitment"]
}
```

**Response:**
```json
{
  "success": true,
  "operation": "submit_answer",
  "session_id": "uuid",
  "category": "service_scope",
  "depth_analysis": {
    "score": 0.58,
    "dimensions": {
      "specificity": 0.45,
      "completeness": 0.40,
      "actionability": 0.65,
      "consistency": 0.85
    },
    "feedback": "Can you be more specific...",
    "insight": "The answer clearly defines offered services..."
  },
  "next_question": {
    "seed_id": null,
    "type": "this_or_that",
    "question": "Would you prefer a strict no on-site policy, or a flexible approach?",
    "context": "AI follow-up to deepen: What specific services...",
    "options": {
      "a": "Strict no on-site: all work delivered remotely",
      "b": "Flexible: allow limited on-site with approval"
    },
    "source": "depth_followup"
  },
  "is_complete": false,
  "progress": {
    "answered": 1,
    "total": 13,
    "avg_depth": 0.58,
    "target": 0.85
  }
}
```

**Note:** `next_question` is null when `is_complete` is true. The `total` may increase as follow-up questions are inserted.

### Operation: `get_progress`

Returns progress across all 12 BSI categories.

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
    "completed": 2,
    "in_progress": 1,
    "not_started": 9,
    "total": 12
  },
  "overall_completion": 17,
  "categories": [
    {
      "category": "service_scope",
      "status": "in_progress",
      "session_id": "uuid",
      "answered": 5,
      "total": 14,
      "avg_depth": 0.72,
      "target": 0.85
    },
    {
      "category": "non_negotiables",
      "status": "not_started",
      "answered": 0,
      "total": 0,
      "avg_depth": 0,
      "target": 0
    }
  ]
}
```

### Operation: `synthesize_category`

Synthesizes a completed category into structured policy data AND discrete rules.

**Request:**
```json
{
  "operation": "synthesize_category",
  "brand_id": "carlton",
  "session_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "synthesize_category",
  "session_id": "uuid",
  "category": "service_scope",
  "policy_section": "service_boundaries",
  "synthesized_data": { "...structured policy JSON..." },
  "rules_extracted": 8,
  "contradictions": [],
  "upsert_result": { "inserted": 8, "deactivated": 0 }
}
```

### Operation: `get_next_question`

Fetch the current question for a session.

**Request:**
```json
{
  "operation": "get_next_question",
  "brand_id": "carlton",
  "session_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "get_next_question",
  "session_id": "uuid",
  "category": "service_scope",
  "status": "in_progress",
  "current_question": {
    "type": "this_or_that",
    "question": "When a client asks for something adjacent...",
    "options": { "a": "Expand to accommodate", "b": "Refer to specialist" },
    "source": "seed"
  },
  "question_index": 2,
  "progress": { "answered": 2, "total": 14, "avg_depth": 0.68, "target": 0.85 },
  "is_complete": false
}
```

### Operation: `pending_preferences`

Returns system-generated questions awaiting human answers (from Slagathore, gap analyzer, etc.).

**Request:**
```json
{
  "operation": "pending_preferences",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "pending_preferences",
  "total_pending": 3,
  "by_source": {
    "slagathore": [{ "id": 131, "category": "contract_terms", "question_type": "this_or_that", "question_text": "..." }],
    "gap_analyzer": [{ "id": 132, "category": "data_handling", "question_type": "open", "question_text": "..." }]
  },
  "questions": [...]
}
```

---

## 3. Question Types (same as Branding System)

| Type | Input Field | UI Component |
|------|-------------|-------------|
| `open` | `answer` (text) | Multi-line textarea |
| `this_or_that` | `selected` ("a" or "b") | Two card buttons with `options.a` and `options.b` text |
| `approve_deny` | `verdict` + optional `adjustment` | Statement with 3 verdict buttons: `approve`, `close_but`, `wrong_direction`. If `close_but`, show text input for adjustment |
| `ranking` | `rankings` (ordered array) | Drag-to-reorder list of items from `options` array |

---

## 4. The 12 Discovery Categories

| Category | Display Name | Depth Target | Seed Questions |
|----------|-------------|-------------|----------------|
| `service_scope` | Service Scope | 0.85 | 12 |
| `non_negotiables` | Non-Negotiables | 0.90 | 8 |
| `contract_terms` | Contract Terms | 0.85 | 12 |
| `pricing_philosophy` | Pricing Philosophy | 0.85 | 10 |
| `client_engagement` | Client Engagement | 0.80 | 12 |
| `communication_protocols` | Communication Protocols | 0.80 | 10 |
| `quality_standards` | Quality Standards | 0.85 | 12 |
| `hr_policies` | HR Policies | 0.85 | 12 |
| `legal_compliance` | Legal Compliance | 0.90 | 10 |
| `business_methods` | Business Methods | 0.80 | 12 |
| `data_handling` | Data Handling | 0.90 | 10 |
| `risk_management` | Risk Management | 0.85 | 10 |

---

## 5. Direct Supabase Queries (Frontend Can Read Directly)

### Get all BSI sessions with progress
```javascript
const { data } = await supabase
  .from('bsi_discovery_sessions')
  .select('id, category, status, avg_depth_score, depth_target, current_question_index, questions')
  .eq('brand_id', 'carlton');
```

### Get active policy rules
```javascript
const { data } = await supabase
  .from('bsi_policy_rules')
  .select('*')
  .eq('brand_id', 'carlton')
  .eq('is_active', true)
  .order('severity', { ascending: true });
```

### Get policy JSONB sections
```javascript
const { data } = await supabase
  .from('autonomous_brands')
  .select('policies')
  .eq('brand_id', 'carlton')
  .single();
```

### Get generated documents
```javascript
const { data } = await supabase
  .from('bsi_documents')
  .select('*')
  .eq('brand_id', 'carlton')
  .eq('status', 'current');
```

### Real-time subscription for new questions (compliance page)
```javascript
const channel = supabase
  .channel('bsi-questions')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'bsi_discovery_questions',
    filter: 'source=neq.seed'
  }, (payload) => {
    // New system-generated question needs answering
    handleNewQuestion(payload.new);
  })
  .subscribe();
```

---

## 6. Suggested Frontend Pages

### `/bsi-discovery` -- Business Policy Discovery

**Layout:**
1. **Progress Grid** -- 12 category cards in a grid, showing:
   - Category name
   - Status badge (not_started / in_progress / complete)
   - Depth score bar (avg_depth vs target)
   - Questions answered count (e.g., "5/14")
   - Click to enter session

2. **Active Session View** -- When a category is selected:
   - Current question with appropriate renderer (4 types)
   - Depth analysis feedback after each answer
   - Progress bar (answered/total, depth score)
   - "Synthesize" button when session is complete

3. **Overall completion** banner at top: "42% Complete -- 5 of 12 categories done"

### `/compliance` (Future -- Slagathore + BSI Rules)

**Sections:**
1. **Needs Your Input** -- Pending preference questions from system (pending_preferences operation)
2. **Active Rules** -- Filterable table of bsi_policy_rules
3. **Compliance Dashboard** -- (Future: Slagathore check stats)

### `/bsi-documents` -- Policy Documents

**Layout:**
1. **Document Grid** -- 8 cards, one per document type:
   - Title, status badge (generated / not yet generated)
   - "Generate" button for missing docs
   - "View" link (Google Docs URL) + "Regenerate" button for existing docs
   - Version number and generation date
2. **Missing types** highlighted with a subtle prompt to generate

---

## 7. Depth Analysis Dimensions (BSI-specific)

The depth analysis returns 4 dimension scores used to evaluate answer quality:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| `specificity` | 0.30 | Concrete rules vs. vague aspirations (numbers, thresholds, lists) |
| `completeness` | 0.25 | Edge cases and exceptions addressed |
| `actionability` | 0.25 | Can be directly implemented/enforced without interpretation |
| `consistency` | 0.20 | Does not conflict with previously stated policies |

Display these as a mini radar/spider chart or 4 horizontal bars after each answer submission.

---

## 8. Rule Types Reference

When displaying rules from `bsi_policy_rules`:

| `rule_type` | Display | Color |
|-------------|---------|-------|
| `must_do` | Required | Green |
| `must_not_do` | Prohibited | Red |
| `conditional` | Conditional | Yellow |
| `preference` | Preference | Blue |

| `severity` | Display | Color |
|------------|---------|-------|
| `critical` | Critical | Red |
| `standard` | Standard | Gray |
| `advisory` | Advisory | Light gray |

| `enforcement` | Display | Description |
|---------------|---------|-------------|
| `hard_block` | Hard Block | Slagathore auto-rejects content |
| `ai_review` | AI Review | Slagathore checks and may redraft |
| `advisory_only` | Advisory | Suggestion only, not enforced |

---

## 9. BSI-DOC-GEN IO Contract

### Operation: `generate_document`

Generate a policy document as a Google Doc.

**Request:**
```json
{
  "operation": "generate_document",
  "brand_id": "carlton",
  "document_type": "operations_manual",
  "folder_id": "optional-google-drive-folder-id"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "generate_document",
  "document_type": "operations_manual",
  "title": "Operations Manual -- carlton",
  "brand_id": "carlton",
  "document_id": "1abc123...",
  "document_url": "https://docs.google.com/document/d/1abc123.../edit",
  "record_id": 1
}
```

### 8 Document Types

| `document_type` | Title | Policy Categories Used |
|-----------------|-------|----------------------|
| `operations_manual` | Operations Manual | service_boundaries, methods_processes, quality_slas |
| `client_contract_template` | Client Contract Template | contracts, pricing, non_negotiables |
| `pricing_guide` | Pricing Guide & Policy | pricing, service_boundaries |
| `client_onboarding_guide` | Client Onboarding Guide | client_engagement, communications, quality_slas |
| `employee_handbook` | Employee & Contractor Handbook | hr_policies, communications, non_negotiables |
| `compliance_overview` | Legal & Compliance Overview | legal_compliance, data_handling, risk_management |
| `sla_document` | SLA Template | quality_slas, communications, client_engagement |
| `risk_policy` | Risk Management Policy | risk_management, data_handling, legal_compliance |

### Operation: `list_documents`

**Request:**
```json
{
  "operation": "list_documents",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "list_documents",
  "brand_id": "carlton",
  "documents": [
    { "id": 1, "document_type": "operations_manual", "title": "Operations Manual -- carlton", "google_doc_url": "https://...", "version": 1, "created_at": "..." }
  ],
  "generated_count": 1,
  "missing_types": ["client_contract_template", "pricing_guide", "..."],
  "total_types": 8
}
```

### Operation: `regenerate_document`

Marks existing document as superseded, generates fresh version.

**Request:**
```json
{
  "operation": "regenerate_document",
  "brand_id": "carlton",
  "document_type": "operations_manual"
}
```

---

## 10. BSI-LIFECYCLE IO Contract

### Operation: `full_audit`

Comprehensive audit: gap detection + staleness check + rule health.

**Request:**
```json
{
  "operation": "full_audit",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "full_audit",
  "brand_id": "carlton",
  "completeness_score": 25,
  "completed_categories": 3,
  "total_categories": 12,
  "gaps": [
    { "category": "non_negotiables", "issue": "not_started", "severity": "high", "detail": "No discovery session exists" },
    { "category": "service_scope", "issue": "incomplete", "severity": "medium", "detail": "Session in progress, depth: 0.58" }
  ],
  "stale_categories": [
    { "category": "contract_terms", "days_since_update": 95, "detail": "Last updated 95 days ago" }
  ],
  "rule_health": {
    "total_active": 24,
    "global_over_soft": false,
    "by_category": {
      "service_scope": { "count": 8, "over_soft": false, "over_hard": false }
    },
    "categories_over_hard_limit": []
  },
  "needs_attention": true,
  "summary": { "gaps_found": 5, "stale_found": 1, "rule_issues": 0 }
}
```

### Operation: `get_lifecycle_status`

Lightweight dashboard data.

**Request:**
```json
{
  "operation": "get_lifecycle_status",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "get_lifecycle_status",
  "brand_id": "carlton",
  "completeness": 25,
  "categories": { "completed": 3, "in_progress": 1, "not_started": 8, "total": 12 },
  "rules": { "total": 24, "by_category": { "service_scope": 8, "contract_terms": 6 } },
  "recent_events": [
    { "event_type": "audit", "details": { "completeness": 25, "gaps": 5 }, "triggered_by": "lifecycle", "created_at": "..." }
  ],
  "last_audit": "2026-03-29T08:08:27Z"
}
```

### Operation: `consolidate_rules`

GPT reviews all active rules for duplicates, contradictions, and merge opportunities.

**Request:**
```json
{
  "operation": "consolidate_rules",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "consolidate_rules",
  "brand_id": "carlton",
  "issues_found": 2,
  "duplicates": [
    { "rule_ids": [5, 12], "reason": "Both state the same payment term requirement", "keep_id": 12 }
  ],
  "contradictions": [],
  "mergeable": [
    { "rule_ids": [3, 7, 9], "merged_text": "All deliverables require peer review and QA testing before client delivery", "reason": "Three rules describing the same quality gate" }
  ],
  "action_required": true
}
```

### Rule Governance Guardrails

| Guardrail | Limit | Action |
|-----------|-------|--------|
| Per-category soft limit | 15 rules | Advisory warning in audit |
| Per-category hard limit | 25 rules | Forces consolidation before new rules added |
| Global soft limit | 150 rules | Creates "simplify policies" human task |
| Staleness threshold | 90 days | Flags category for re-review |

---

## 11. SLAGATHORE-CHECK IO Contract

Slagathore is the compliance content interceptor. Any workflow producing public-facing content calls this webhook to check it against business policy rules before dispatch.

### Check Content

**Request:**
```json
{
  "brand_id": "carlton",
  "content_type": "email",
  "content": "Hi John, I noticed your company...",
  "entity_id": "DRAFT-123",
  "entity_type": "cold_email",
  "source_workflow": "PROSP-OUTREACH-DRAFT-V2",
  "callback_webhook": "https://n8n.carltonaiservices.com/webhook/prosp-outreach-approved",
  "callback_payload_template": { "draft_id": "DRAFT-123", "action": "approve" },
  "max_redrafts": 3
}
```

**Response (compliant):**
```json
{
  "success": true,
  "check_id": "CC_260329081813",
  "verdict": "compliant",
  "approved": true,
  "action_taken": "auto_approved",
  "rules_checked": 3,
  "rules_passed": 3,
  "rules_failed": 0,
  "overall_assessment": "The email complies with all applicable rules.",
  "processing_time_ms": 5200,
  "questions_generated": 0
}
```

**Response (violations found):**
```json
{
  "success": true,
  "check_id": "CC_260329081836",
  "verdict": "major_issues",
  "approved": false,
  "action_taken": "routed_to_human",
  "rules_checked": 3,
  "rules_failed": 3,
  "violations": [
    {
      "rule_id": 1,
      "rule_text": "Never make income guarantees...",
      "severity": "critical",
      "enforcement": "hard_block",
      "explanation": "The email includes a specific income guarantee: '$10,000 in your first month'",
      "suggestion": "Remove income guarantees; use cautious, non-guaranteed language"
    }
  ],
  "human_task_created": true,
  "task_id": "260329081836-HT",
  "processing_time_ms": 15800
}
```

### Verdict Values

| Verdict | Meaning | Default Action |
|---------|---------|----------------|
| `compliant` | No violations | Auto-approve |
| `minor_issues` | Low-severity violations | Auto-redraft (up to max_redrafts) |
| `major_issues` | High-severity violations | Route to human (Bradford) |
| `legal_concern` | Legal rule violations | Route to attorney |
| `financial_concern` | Financial rule violations | Route to accountant |

### Content Types Slagathore Accepts

| `content_type` | Source Workflows |
|----------------|-----------------|
| `email` | PROSP-OUTREACH-DRAFT-V2, CRM-SEQUENCE-SENDER |
| `social_post` | SOCIAL-DRAFT |
| `landing_page` | LP-GENERATE |
| `proposal` | OFFER-IDEATE |
| `blog` | CONTENT-POST-BLOG |
| `contract` | (future) |

---

## 12. Compliance Dashboard (Frontend Page: `/compliance`)

### Sections

1. **Compliance Status Bar** -- Total checks, pass rate, violations this week
2. **Recent Checks** -- Table from `compliance_checks`, sortable by date/verdict
3. **Needs Your Input** -- Pending BSI questions from Slagathore (source='slagathore')
4. **Active Rules** -- Filterable table from `bsi_policy_rules`
5. **Violation Trends** -- Chart showing violations over time by severity

### Direct Supabase Queries

```javascript
// Recent compliance checks
const { data } = await supabase
  .from('compliance_checks')
  .select('*')
  .eq('brand_id', 'carlton')
  .order('created_at', { ascending: false })
  .limit(50);

// Pass rate stats
const { data: stats } = await supabase
  .from('compliance_checks')
  .select('verdict')
  .eq('brand_id', 'carlton')
  .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

// Slagathore-generated questions needing answers
const { data: questions } = await supabase
  .from('bsi_discovery_questions')
  .select('*')
  .eq('source', 'slagathore')
  .eq('is_active', true)
  .order('created_at', { ascending: false });
```

### Real-time Subscription

```javascript
// Subscribe to new compliance checks
const channel = supabase
  .channel('compliance-checks')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'compliance_checks'
  }, (payload) => {
    handleNewCheck(payload.new);
  })
  .subscribe();
```

---

## 13. SLAGATHORE-AUDIT IO Contract

Retroactive audit -- re-checks previously approved content against current rules. Catches drift when rules change.

### Audit Recent

**Request:**
```json
{
  "operation": "audit_recent",
  "brand_id": "carlton",
  "days_back": 7,
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "operation": "audit_recent",
  "brand_id": "carlton",
  "total_audited": 15,
  "still_compliant": 14,
  "now_non_compliant": 1,
  "non_compliant_details": [
    {
      "check_id": "CC_260325081200",
      "entity_id": "DRAFT-456",
      "content_type": "email",
      "new_violations": [
        { "rule_id": 5, "explanation": "New rule requires disclaimer on all automation claims" }
      ]
    }
  ],
  "rules_used": 12,
  "message": "1 previously-approved items now violate current rules"
}
```

**Schedule**: Runs automatically every Monday at 11:00 UTC (1 hour after BSI-LIFECYCLE audit). Also callable on-demand via webhook.

---

## 14. Compliance Config (autonomous_brands.config.compliance)

The compliance system is configured per-brand in `autonomous_brands.config.compliance`:

```json
{
  "enabled": true,
  "auto_approve_threshold": 0.95,
  "max_auto_redrafts": 3,
  "default_reviewer": "bradford",
  "content_types_monitored": ["email", "social_post", "landing_page", "proposal", "blog"],
  "content_type_overrides": {
    "contract": {
      "auto_approve_threshold": 1.0,
      "max_auto_redrafts": 0,
      "always_route_to": "attorney"
    },
    "email": { "max_auto_redrafts": 3 },
    "social_post": { "max_auto_redrafts": 2 }
  }
}
```

Frontend can read this via:
```javascript
const { data } = await supabase
  .from('autonomous_brands')
  .select('config->compliance')
  .eq('brand_id', 'carlton')
  .single();
```

---

## 15. Complete System Summary

| Component | Workflow | What It Does |
|-----------|---------|--------------|
| **Discovery** | BSI-DISCOVERY | 12 categories, 130 seed questions, depth analysis, rule extraction |
| **Documents** | BSI-DOC-GEN | 8 policy document types as Google Docs |
| **Governance** | BSI-LIFECYCLE | Gap analysis, staleness detection, rule consolidation |
| **Compliance Check** | SLAGATHORE-CHECK | Real-time content interception + rule checking |
| **Auto-Fix** | SLAGATHORE-REDRAFT | GPT rewrites non-compliant content |
| **Retroactive Audit** | SLAGATHORE-AUDIT | Weekly re-check of approved content vs current rules |
| **Queue Processor** | SLAGATHORE-QUEUE | Scheduled queue processor (every 10 min) |
| **Submit Utility** | SLAGATHORE-SUBMIT | Standard async submission endpoint |
| **Doc Scanner** | DOC-SCANNER | Upload docs, extract rules, human confirm |
| **Gap Analyzer** | GAP-ANALYZER | Completeness analysis, AI policy suggestions |

### Data Flow

```
 Human answers questions          Content workflows generate drafts
        |                                    |
        v                                    v
  BSI-DISCOVERY                      SLAGATHORE-CHECK
  (depth analysis)                   (rules loaded from DB)
        |                                    |
        v                           +--------+--------+
  synthesize_category               |        |        |
  (policy JSONB +                approve  redraft  human
   discrete rules)                  |        |      task
        |                           |        v        |
        v                           |  SLAGATHORE-    |
  bsi_policy_rules  <--------------+  REDRAFT        |
  (Slagathore reads)                   (auto-fix)     |
        |                                             |
        v                                             |
  BSI-DOC-GEN                    SLAGATHORE-AUDIT     |
  (Google Docs)                  (weekly re-check) ---|
        |                                             |
        v                                             v
  BSI-LIFECYCLE                            compliance_checks
  (gap + stale audit)                      (full audit trail)
```

---

## 16. SLAGATHORE-SUBMIT IO Contract (Standard Submission)

This is the universal interface for submitting content to Slagathore. Any workflow calls this -- it returns immediately with a queue_id. Processing happens async every 10 minutes.

### Submit Content

**Request:**
```json
{
  "brand_id": "carlton",
  "content_type": "email",
  "content": "Hi John, ...",
  "entity_id": "DRAFT-500",
  "entity_type": "cold_email",
  "source_workflow": "PROSP-OUTREACH-DRAFT-V2",
  "callback_webhook": "https://n8n.carltonaiservices.com/webhook/prosp-outreach-approved",
  "callback_payload_template": { "draft_id": "DRAFT-500", "action": "approve" },
  "max_redrafts": 3
}
```

**Response (immediate):**
```json
{
  "success": true,
  "queue_id": "CQ_26032908382440_411",
  "status": "pending_review",
  "message": "Content submitted for compliance review. Slagathore will process it shortly.",
  "estimated_processing": "Within 10 minutes"
}
```

### How It Works (Architecture)

1. Any workflow calls SLAGATHORE-SUBMIT with content
2. Content is inserted into `compliance_queue` table (status: pending_review)
3. SLAGATHORE-QUEUE runs every 10 minutes (or on-demand via webhook)
4. Queue processor claims items atomically (FOR UPDATE SKIP LOCKED -- no double-pickup)
5. GPT batch-checks claimed items against bsi_policy_rules
6. Results written back to queue + compliance_checks audit trail
7. Callbacks fired for compliant items

### Frontend: Compliance Queue View

```javascript
// Current queue items
const { data } = await supabase
  .from('compliance_queue')
  .select('*')
  .eq('brand_id', 'carlton')
  .order('submitted_at', { ascending: false })
  .limit(50);

// Real-time subscription
const channel = supabase
  .channel('compliance-queue')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'compliance_queue'
  }, (payload) => {
    handleQueueChange(payload);
  })
  .subscribe();
```

### Queue Status Values

| Status | Meaning |
|--------|---------|
| pending_review | Waiting for Slagathore to process |
| processing | Currently being checked |
| compliant | Passed all rules |
| non_compliant | Failed checks |
| redrafting | Auto-fix in progress |
| routed_to_human | Sent to human for review |
| routed_to_attorney | Legal concern escalated |
| routed_to_accountant | Financial concern escalated |
| failed | Processing error |

---

## 17. DOC-SCANNER IO Contract

### Upload Document

**Request:**
```json
{
  "operation": "upload",
  "brand_id": "carlton",
  "filename": "contractor_agreement.txt",
  "file_type": "text",
  "drive_file_id": "optional-google-drive-id",
  "drive_url": "optional-google-drive-url"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "upload",
  "scan_id": "DS_260329084433",
  "filename": "contractor_agreement.txt",
  "status": "pending",
  "message": "Document registered. Call process operation with scan_id to extract content.",
  "next_step": { "operation": "process", "scan_id": "DS_260329084433" }
}
```

### Process Document

**Request:**
```json
{
  "operation": "process",
  "brand_id": "carlton",
  "scan_id": "DS_260329084433",
  "text_content": "CONTRACTOR AGREEMENT\n\n1. Payment Terms: ..."
}
```

**Response:**
```json
{
  "success": true,
  "operation": "process",
  "scan_id": "DS_260329084433",
  "filename": "contractor_agreement.txt",
  "items_extracted": 11,
  "categories_found": ["contract_terms", "legal_compliance", "data_handling", "service_scope", "communication_protocols", "quality_standards"],
  "review_task_id": "260329084732-HT",
  "status": "extracted",
  "message": "Document processed. 11 items extracted. Human review task created."
}
```

### Confirm Extraction

**Request (callback from human review):**
```json
{
  "operation": "confirm",
  "scan_id": "DS_260329084433",
  "confirmed_items": ["...items from review..."],
  "confirmed_by": "bradford"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "confirm",
  "scan_id": "DS_260329084433",
  "rules_created": 8,
  "items_confirmed": 11,
  "message": "8 rules created from confirmed document items."
}
```

### Frontend: Document Upload Page

```javascript
// List all scanned documents
const { data } = await supabase
  .from('document_scans')
  .select('*')
  .eq('brand_id', 'carlton')
  .order('created_at', { ascending: false });

// Show extraction results for review
const { data: scan } = await supabase
  .from('document_scans')
  .select('extracted_items, total_items_count, mapped_categories')
  .eq('scan_id', 'DS_260329084433')
  .single();
```

---

## 18. GAP-ANALYZER IO Contract

### Full Analysis

Compares checklist items against actual sessions/rules, calculates completeness score.

**Request:**
```json
{
  "operation": "full_analysis",
  "brand_id": "carlton",
  "generate_tasks": true
}
```

**Response:**
```json
{
  "success": true,
  "operation": "full_analysis",
  "run_id": "GA_260329085604",
  "brand_id": "carlton",
  "completeness_score": 25,
  "categories": { "complete": 3, "partial": 1, "missing": 8, "total": 12 },
  "gaps": {
    "required": 20, "recommended": 8, "total": 28,
    "by_priority": { "critical": 8, "high": 6, "medium": 10, "low": 4 }
  },
  "category_details": {
    "contract_terms": {
      "status": "missing", "session_status": "not_started", "depth_score": 0,
      "rules_count": 0, "checklist_total": 8, "required_total": 5,
      "required_missing": 5, "recommended_missing": 3, "priority": 1
    }
  },
  "tasks_generated": 5,
  "top_gaps": [
    { "category": "data_handling", "title": "Encryption Standards", "importance": "required", "priority": 1, "action": "start_discovery_session" }
  ],
  "message": "Found 20 required gaps across 8 categories. Created 5 human tasks."
}
```

### Suggest Policies

GPT generates suggested default policies for missing required items.

**Request:**
```json
{
  "operation": "suggest_policies",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "suggest_policies",
  "brand_id": "carlton",
  "suggestions": [
    {
      "item_key": "contract_terms/ip_ownership",
      "category": "Contracts: IP and Ownership",
      "suggested_policy": "Deliverables are owned by the client upon acceptance and full payment...",
      "rationale": "Balances client value with consultant rights to reuse non-client-specific assets",
      "confidence": 0.80
    }
  ],
  "total_suggestions": 15,
  "message": "15 policy suggestions generated for missing items"
}
```

### Get Status

Lightweight dashboard data.

**Request:**
```json
{
  "operation": "get_status",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "get_status",
  "brand_id": "carlton",
  "last_run": {
    "run_id": "GA_260329085604",
    "completeness_score": 25,
    "complete_categories": 3,
    "partial_categories": 1,
    "missing_categories": 8,
    "created_at": "2026-03-29T..."
  },
  "checklist": {
    "total_items": 70,
    "by_status": { "missing": 50, "partial": 5, "complete": 12, "not_applicable": 3 },
    "by_importance": {
      "required": { "total": 39, "missing": 25 },
      "recommended": { "total": 22, "missing": 15 },
      "optional": { "total": 9, "missing": 7 }
    }
  }
}
```

### Gap Priority Levels

| Priority | Categories | Meaning |
|----------|-----------|---------|
| 1 (Critical) | contract_terms, non_negotiables, legal_compliance, data_handling | Legal/financial risk |
| 2 (High) | service_scope, pricing_philosophy, quality_standards, risk_management | Revenue-impacting |
| 3 (Medium) | client_engagement, communication_protocols, hr_policies, business_methods | Operational |

### Frontend: Completeness Dashboard

```javascript
// Get latest gap analysis
const { data } = await supabase
  .from('gap_analysis_runs')
  .select('*')
  .eq('brand_id', 'carlton')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

// Get checklist progress
const { data: checklist } = await supabase
  .from('bsi_checklist')
  .select('category, item_key, title, importance, status')
  .eq('brand_id', 'carlton')
  .order('category, importance');
```

---

## 19. Unified Brand Context

The `get_brand_full_context` RPC returns everything about a brand in one call -- both the branding identity and the business policies.

```javascript
// Get complete brand context (identity + policies + config)
const { data } = await supabase.rpc('get_brand_full_context', { p_brand_id: 'carlton' });

// Returns:
// {
//   brand_id: "carlton",
//   identity: { ... all 15 branding sections ... },
//   policies: { ... all 12 BSI policy sections ... },
//   config: { ... compliance config, hub config, etc. ... },
//   combined_context: {
//     has_identity: true/false,
//     has_policies: true/false,
//     identity_sections: ["attractive_character", "voice", ...],
//     policy_sections: ["service_boundaries", "contracts", ...]
//   }
// }
```

### Compliance Domain Registration

The `compliance` domain is registered in `autonomous_domain_registry`:
- **Webhook**: `slagathore-submit`
- **Operations**: submit_content, check_content, audit_recent, scan_document, analyze_gaps, suggest_policies
- **Concurrency**: 3

This means RDGR-QUEUE can dispatch compliance tasks to Slagathore via the standard domain routing system.

### BRAND-DISCOVERY Preference Learning (Updated)

The Depth Analysis and Synthesis nodes in BRAND-DISCOVERY now extract voice dimensions from this_or_that answers:
- **warmth** (0-1): friendly/approachable vs professional/measured
- **formality** (0-1): formal register vs casual conversation
- **confidence** (0-1): bold claims vs hedged suggestions
- **humor** (0-1): playful/witty vs straightforward

These dimensions are stored in `autonomous_brands.identity.voice.dimensions` via the `update_voice_dimension` RPC, and are consumed by BRAND-TEMPLATE-GEN to calibrate generated copy tone.
