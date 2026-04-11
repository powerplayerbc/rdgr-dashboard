# Frontend IO Contracts — Tier 4C: CRM + Social + Content + Blog + Twitter/Affiliate

**Generated:** 2026-03-28
**Scope:** 44 workflows enriched with io_schema in system_registry
**Total io_schemas after this tier:** 124 (80 prior + 44 new)

---

## How to Use

Query live schemas:
```sql
SELECT name, io_schema FROM system_registry WHERE io_schema IS NOT NULL ORDER BY name;
```

Each `io_schema` contains: trigger info, input envelope/fields, output envelope/branches/side_effects, and error_handler.

---

## CRM Domain (9 workflows)

### Frontend-Facing Webhooks

| Workflow | Webhook | Method | Response | Operations |
|----------|---------|--------|----------|------------|
| CRM-SEQUENCES | `crm-sequences` | POST | sync JSON | create_sequence, list_sequences, start_sequence, pause_sequence, cancel_sequence, evaluate_reply, get_due_enrollments |
| CRM-UNSUBSCRIBE | `crm-unsubscribe` | GET | HTML page | (single operation — unsubscribe link click) |

### Scheduled/Internal (no frontend webhook)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| CRM-ENGAGEMENT-DECAY | Daily 12:00 UTC | Auto-downgrades stale contact engagement scores |
| CRM-SENDGRID-LIMIT-MONITOR | Every 4h | Alerts when SendGrid sends reach 80/100 daily limit |
| CRM-SENDGRID-WEBHOOK | POST `crm-sendgrid-events` | Receives SendGrid event webhooks (open, click, bounce, etc.) |
| CRM-DAILY-SEND-RESET | Daily midnight PT | Resets daily send counts for email accounts |
| CRM-SEQUENCE-SENDER | Every 4h (INACTIVE) | Sends sequence emails via SendGrid with human review gates |
| CRM-SEQUENCE-TRACKER | Every 2h | Processes SendGrid events → updates send_log status |
| CRM-ERR | Error trigger (DEPRECATED) | Replaced by ERR-UTIL |

### CRM-SEQUENCES Payload Shape
```json
POST /webhook/crm-sequences
{
  "operation": "start_sequence|pause_sequence|cancel_sequence|create_sequence|list_sequences|evaluate_reply|get_due_enrollments",
  "brand_id": "carlton",
  "parameters": {
    // start_sequence: { sequence_id, contact_id|contact_ids[], start_at? }
    // pause/cancel: { enrollment_id }
    // create_sequence: { name, description?, steps[], target_segment?, status? }
    // evaluate_reply: { contact_id, sequence_id }
  }
}
→ { success, task_id, operation, result, error?, message }
```

### CRM-UNSUBSCRIBE Payload Shape
```
GET /webhook/crm-unsubscribe?contact_id=C_260316120350&channel=email
→ HTML confirmation page
Side effects: logs event, updates CRM contact DNC, cancels active sequences
```

---

## Social Domain (14 workflows)

### Frontend-Facing Webhooks

| Workflow | Webhook | Method | Response | Purpose |
|----------|---------|--------|----------|---------|
| SOCIAL-DISCOVER | `social-discover` | POST | sync JSON | Discovers prospects across IG/FB/TW/LI/Reddit |
| SOCIAL-QUALIFY | `social-qualify` | POST | sync JSON | GPT-scores social profiles for outreach |
| SOCIAL-DRAFT | `social-draft` | POST | sync JSON | Generates DM drafts via EMAIL-ASSEMBLY-UTIL |
| SOCIAL-ACT | `social-act` | POST | sync JSON | Executes social actions (like, comment, follow, DM) |
| SOCIAL-REPLY | `social-reply` | POST | sync JSON | Generates and sends reply messages |
| SOCIAL-CLEANUP | `social-cleanup` | POST | sync JSON | Auto-skips stale social drafts |

### Scheduled/Internal

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| SOCIAL-IG-ENRICH-ROUTE | Internal HTTP | Instagram 2-step enrichment (profile + posts) |
| SOCIAL-FB-PAGE-ROUTE | Internal HTTP | Facebook page enrichment via APIFY |
| SOCIAL-REDDIT-ORCH | Dual schedule | Reddit discovery (wave + pain subreddits) |
| SOCIAL-VOICE-LEARN | Schedule midnight (INACTIVE) | Social voice learning |
| SOCIAL-ORCHESTRATOR | Webhook (INACTIVE/DEPRECATED) | Replaced by PROSP-SOCIAL-BRIDGE pipeline |
| SOCIAL-ERR | Error trigger (DEPRECATED) | Replaced by ERR-UTIL |
| PROSP-ACTOR-SOCIAL | Internal HTTP (DEPRECATED) | Replaced by SOCIAL-DISCOVER + enrichment routes |

### SOCIAL-DISCOVER Payload Shape
```json
POST /webhook/social-discover
{
  "brand_id": "carlton",
  "platforms": ["instagram", "facebook", "twitter", "linkedin", "reddit"],
  "discovery_type": "wave|pain|competitor",
  "parameters": {
    "subreddits": ["smallbusiness"],
    "search_phrases": ["need help with marketing"],
    "max_results": 50
  }
}
→ { success, profiles_found, qualified_count, dispatched_to, message }
```

---

## Content Domain (6 workflows)

### Frontend-Facing Webhooks

| Workflow | Webhook | Method | Response | Purpose |
|----------|---------|--------|----------|---------|
| CONTENT-ORCHESTRATE | `content-orchestrate` | POST | sync JSON | Chains writing + media + Slides/Docs creation |
| CONTENT-POST-NEWSLETTER | `content-post-newsletter` | POST | sync JSON | Sends newsletter to subscriber list |

### Scheduled/Internal

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| CONTENT-DAILY-ENGINE | Schedule 8AM PT + webhook | Daily content generation (research → GPT → queue) |
| CONTENT-ENRICH | Internal webhook | SEO + image gen + routing to blog/newsletter |
| CONTENT-STRATEGIST | Mon 6AM + webhook (NEEDS_ACTIVATION) | Weekly editorial calendar generation |
| RDGR-TOOL-SEO-CONTENT | Internal (INACTIVE/DEPRECATED) | Old SEO tool, Responses API bug |

### CONTENT-ORCHESTRATE Payload Shape
```json
POST /webhook/content-orchestrate
{
  "brand_id": "carlton",
  "task_id": "260328-5",
  "content_type": "blog_post|social_post|email|presentation",
  "topic": "AI consulting for small businesses",
  "visual_effort": "high|medium|low",
  "generate_images": true,
  "parameters": { "tone": "professional", "length": "1200 words" }
}
→ { success, content, slides_url?, doc_url?, image_urls[], task_id }
```

**visual_effort routing:** high → Google Slides, medium → Google Doc, low → content JSON only

---

## Blog Domain (9 workflows)

### Frontend-Facing Webhooks

| Workflow | Webhook | Method | Response | Purpose |
|----------|---------|--------|----------|---------|
| BLOG-SETTINGS-BRIDGE | `blog-settings` | POST | sync JSON | Voice/prompt CRUD (6 operations) |
| CONTENT-POST-BLOG | `content-post-blog-v2` | POST | sync JSON | Publishes to blog.bradfordcarlton.com via GitHub |
| BLOG-PROMOTE | `blog-promote` | POST | sync JSON | Multi-platform social promotion |
| BLOG-VIDEO-GENERATE | `blog-video-generate` | POST | sync JSON | Video script from blog content |

### Scheduled/Internal

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| BLOG-ANALYTICS | Daily 6AM | Collects blog performance metrics |
| BLOG-VOICE-LEARN | Sun 10PM (INACTIVE) | Weekly voice learning |
| BLOG-ERR | Error trigger (DEPRECATED) | Replaced by ERR-UTIL |
| RDGR-TOOL-SOCIAL-CALENDAR | Webhook (INACTIVE) | AI social calendar generation |
| RDGR-SOCIAL-SCHEDULER | Schedule 15min + webhook | Multi-platform auto-publisher |
| RDGR-MEDIA | Internal webhook | Image generation (7 types via Gemini) |

### BLOG-SETTINGS-BRIDGE Operations
```json
POST /webhook/blog-settings
{
  "brand_id": "carlton",
  "operation": "save_settings|save_prompt|expand_text|preview_post|get_learning_suggestions|resolve_suggestion",
  "parameters": { ... }
}
```

---

## Twitter/Affiliate Domain (5 workflows)

### Frontend-Facing Webhooks

| Workflow | Webhook | Method | Response | Purpose |
|----------|---------|--------|----------|---------|
| x-rate-check | `x-rate-check` | POST | sync JSON | Check remaining tweet capacity |
| x-auto-post | `x-auto-post` | POST | sync JSON | Manual trigger for tweet posting |
| affiliate-product | `affiliate-product` | POST | sync JSON | Product CRUD + discovery |
| affiliate-pitch-gen | `affiliate-pitch` | POST | sync JSON | GPT pitch generation |
| affiliate-manage | `affiliate-manage` | POST | sync JSON | Affiliate system management |

### x-rate-check Response Shape
```json
{
  "can_post": true,
  "posts_used": 5,
  "posts_remaining": 12,
  "hard_cap": 17,
  "window_resets_at": "2026-03-26T14:30:00Z"
}
```

---

## Bug Summary

| Severity | Count | Details |
|----------|-------|---------|
| CRITICAL | 0 | No `require()` or `$env` usage found |
| HIGH | 3 | SOCIAL-ERR hardcoded API key (deprecated), BLOG-ERR hardcoded API key (deprecated), RDGR-TOOL-SEO-CONTENT Responses API output[0] bug (deprecated) |
| MEDIUM | 22 | `this.helpers.httpRequest` in Code nodes (6), `continueOnFail`+`onError` conflicts (8), IF/Switch missing `version:2` (3), direct `directive_tasks` inserts (2), dead-end paths (2), `.first()` in loop (1) |
| LOW | 8 | SQL interpolation (internal), placeholder scoring, legacy `.item.json`, misc |

**All 3 HIGH bugs are in deprecated/inactive workflows — no production impact.**

### Recurring Patterns for Future Refactoring
1. **Hardcoded Supabase keys in Code nodes** — 3 content workflows fetch `blog_voice_settings` with anon key instead of `predefinedCredentialType`
2. **Direct `directive_tasks` inserts** — CONTENT-DAILY-ENGINE and CONTENT-STRATEGIST should use Human Task utility
3. **`this.helpers.httpRequest` in Code nodes** — RDGR-MEDIA, CONTENT-ORCHESTRATE, SOCIAL-DISCOVER need refactoring to HTTP Request nodes

---

## Deprecated Workflows (4 total)

| Workflow | Registry ID | Deprecated By | Reason |
|----------|------------|---------------|--------|
| CRM-ERR | 196 | ERR-UTIL | Unified error handler consolidation |
| SOCIAL-ERR | 298 | ERR-UTIL | Unified error handler consolidation |
| BLOG-ERR | 373 | ERR-UTIL | Unified error handler consolidation |
| PROSP-ACTOR-SOCIAL | 234 | SOCIAL-DISCOVER pipeline | Legacy architecture replaced |

---

## Pipeline Diagrams

### CRM Email Sequence Pipeline
```
CRM-SEQUENCES (enroll) → CRM-SEQUENCE-SENDER (every 4h)
  → get_due_sends RPC → Get Sender Account → Render Template
  → Route by Review → [Human Task | Send via SendGrid]
  → Advance Enrollment → Log CRM Interaction
CRM-SENDGRID-WEBHOOK (events) → CRM-SEQUENCE-TRACKER (every 2h)
  → Group by message → Update status → Handle bounces
CRM-DAILY-SEND-RESET (midnight) → reset_daily_send_counts
CRM-SENDGRID-LIMIT-MONITOR (every 4h) → Alert if >= 80/100
```

### Social Outreach Pipeline
```
SOCIAL-DISCOVER → profiles[] → SOCIAL-QUALIFY (GPT score)
  → qualified → SOCIAL-DRAFT (EMAIL-ASSEMBLY-UTIL, system: social_dm)
  → human review (SOCIAL-APPROVED) → SOCIAL-ACT (execute)
  → SOCIAL-REPLY (respond to replies)
Platform enrichment: SOCIAL-IG-ENRICH-ROUTE, SOCIAL-FB-PAGE-ROUTE
Maintenance: SOCIAL-CLEANUP (auto-skip stale), SOCIAL-REDDIT-ORCH (scheduled discovery)
```

### Content Publishing Pipeline
```
CONTENT-STRATEGIST (weekly) → editorial calendar → CONTENT-DAILY-ENGINE (daily)
  → research + GPT → social_content_queue → CONTENT-APPROVE (human review)
  → CONTENT-ENRICH (SEO + images) → CONTENT-POST-BLOG (GitHub push)
  → BLOG-PROMOTE (multi-platform) + CONTENT-POST-NEWSLETTER
CONTENT-ORCHESTRATE (on-demand) → RDGR-WRITING + RDGR-MEDIA → Slides/Docs
```

### Twitter/Affiliate Pipeline
```
x-auto-post (hourly + webhook) → x-rate-check → POST-TWITTER
affiliate-product (discover/add) → affiliate-pitch-gen (GPT per platform)
  → affiliate-manage (list/update/delete)
```
