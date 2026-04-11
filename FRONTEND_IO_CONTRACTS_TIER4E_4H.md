# Frontend IO Contracts -- Tiers 4e-4h

**Generated:** 2026-03-28
**Workflows:** 57 total (57 with io_schema)
**Coverage:** Offers, Page Publishing, Command System, Partnerships, Market Research, Council, Content, Safety
**Total io_schemas after this tier:** 236 (179 prior + 57 new)

---

## How to Use

Query live schemas from Supabase:
```sql
SELECT name, io_schema FROM system_registry WHERE io_schema IS NOT NULL ORDER BY name;
```

Each `io_schema` contains: trigger info, input fields (required/optional), output envelope, branches/routing, calls_out, tables_written, and notes.

---

## Bug Summary

| Severity | Count | Details |
|----------|-------|---------|
| CRITICAL | 8 | Hardcoded Supabase keys, circular error handler |
| HIGH | 0 | -- |
| MEDIUM | 35 | this.helpers.httpRequest patterns, hardcoded IDs, field mismatches |

### Critical Bugs (fix immediately)

- **RDGR-CHAT:** CRITICAL: 4 Code nodes contain hardcoded Supabase secret key (sb_secret_...) - Persist Human Message, Execute Task DB Write, Persist AI and Build Response, Save Memory and Respond. Must migrate to HTTP Request nodes with predefinedCredentialType supabaseApi
- **RDGR-CHAT:** CRITICAL: 4 Code nodes use this.helpers.httpRequest for Supabase calls - vulnerable to 60s task runner timeout
- **MKTRES-BRIDGE:** CRITICAL: Hardcoded Supabase key in Activate Niche and Get Status nodes - must use predefinedCredentialType: supabaseApi
- **MKTRES-DISCOVER:** CRITICAL: Hardcoded Supabase key in 5 HTTP Request nodes - must use predefinedCredentialType: supabaseApi
- **MKTRES-VALIDATE:** CRITICAL: Hardcoded Supabase key in 3 HTTP Request nodes - must use predefinedCredentialType: supabaseApi
- **MKTRES-SCORE:** CRITICAL: Hardcoded Supabase key in 2 HTTP Request nodes - must use predefinedCredentialType: supabaseApi
- **MKTRES-PRESENT:** CRITICAL: Hardcoded Supabase key in 2 HTTP Request nodes - must use predefinedCredentialType: supabaseApi
- **RDGR-AUTOFIX:** CRITICAL: errorWorkflow set to ERR-UTIL is CIRCULAR -- must be removed

---

## Webhook Quick Reference

| Workflow | Webhook Path | Method | Trigger |
|----------|-------------|--------|---------|
| OFFER-BRIDGE | `rdgr-offers` | POST | webhook |
| OFFER-DELIVER | `offer-deliver` | POST | webhook |
| OFFER-IDEATE | `offer-ideate` | POST | webhook |
| OFFER-INTELLIGENCE | `offer-intelligence` | POST | webhook+schedule |
| LP-GENERATE | `lp-generate` | POST | webhook |
| LP-APPROVE | `lp-approve` | POST | webhook |
| LP-PUBLISH | `lp-publish` | POST | webhook |
| LP-ANALYTICS | `-` | - | schedule |
| PAGE-CREATE | `page-create` | POST | webhook |
| PAGE-FORM | `page-form` | POST | webhook |
| PAGE-TRACK | `page-track` | POST | webhook |
| PROMO-MANAGE | `promo-manage` | POST | webhook |
| PROMO-EXPIRE | `-` | - | schedule |
| METRICS-UPDATE | `-` | - | schedule |
| STRIPE-HOOK | `stripe-events` | POST | webhook |
| STRIPE-WEBHOOK | `stripe-webhook` | POST | webhook |
| TESTIMONIAL-INGEST | `testimonial-ingest` | POST | webhook |
| TESTIMONIAL-POLISH | `testimonial-polish` | POST | webhook |
| TESTIMONIAL-APPROVE | `testimonial-approve` | POST | webhook |
| TESTIMONIAL-DISTRIBUTE | `testimonial-distribute` | POST | webhook |
| SCORECARD-PROCESS | `scorecard-process` | POST | webhook |
| RDGR-CHAT | `rdgr-chat` | POST | webhook |
| RDGR-OUTBOUND | `rdgr-outbound` | POST | webhook |
| RDGR-PLAN-DISPATCH | `rdgr-plan-dispatch` | POST | webhook |
| BKAI-BRIDGE | `rdgr-bookkeeper` | POST | webhook |
| RDGR-REPORT-COLLECT | `rdgr-report-collect` | POST | webhook+schedule |
| RDGR-REPORT-GENERATE | `rdgr-report-generate` | POST | webhook |
| RDGR-REPORT-DELIVER | `rdgr-report-deliver` | POST | webhook |
| RDGR-HEALTH-CHECK | `rdgr-health-check` | POST | webhook |
| CRED-HEALTH-CHECK | `cred-health-check-test` | - | schedule |
| RDGR-INTROSPECT | `rdgr-introspect` | - | schedule |
| RDGR-INTERACTIVE-MAP | `rdgr-interactive-map` | POST | webhook |
| RDGR-TOOL-ENRICH | `rdgr-tool-enrich` | POST | webhook |
| RDGR-TOOL-METRICS | `rdgr-tool-metrics` | POST | webhook |
| RDGR-TOOL-SCORE | `rdgr-tool-score` | POST | webhook |
| RDGR-TOOL-SEQUENCE | `rdgr-tool-sequence` | POST | webhook |
| RDGR-JOURNAL | `rdgr-journal` | - | schedule |
| PRTN-RDGR-ROUTER | `rdgr-partnership` | POST | webhook |
| PRTN-INIT | `partnership-init` | POST | webhook |
| PRTN-001 | `partnership-discover` | POST | webhook |
| PRTN-002 | `partnership-outreach` | POST | webhook |
| PRTN-003 | `-` | - | schedule |
| PRTN-004 | `-` | - | schedule |
| MKTRES-BRIDGE | `mktres-bridge` | POST | webhook |
| MKTRES-DISCOVER | `mktres-discover` | POST | webhook |
| MKTRES-VALIDATE | `mktres-validate` | POST | webhook |
| MKTRES-SCORE | `mktres-score` | POST | webhook |
| MKTRES-PRESENT | `mktres-present` | POST | webhook |
| RDGR-COUNCIL | `rdgr-council` | POST | webhook |
| COUNCIL-SESSION | `council-session` | POST | webhook |
| COPYWRITE-REVIEW | `copywrite-review` | POST | webhook |
| COPYWRITE-APPROVE | `copywrite-approve` | POST | webhook |
| STYLE-LEARNER | `style-learner` | POST | webhook |
| KM-DRAFT | `knowledge-manager-draft` | POST | webhook |
| CONTACT-IMPORT | `contact-import` | POST | webhook |
| RDGR-AUTOFIX | `rdgr-autofix` | POST | webhook |
| RDGR-TOOL-LONG-WRITE | `rdgr-tool-long-write` | POST | webhook |

---

## Section 1: Offers + Page Publishing (21 workflows)

Revenue capture, landing pages, promotions, Stripe, testimonials, and scorecards.

#### Offers

### OFFER-BRIDGE
> Offer Factory domain agent - routes offer operations to sub-workflows and handles lifecycle status changes

- **Trigger:** Webhook: POST `/rdgr-offers`
- **Nodes:** 14

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task_id` | `string` | No | Task ID for RDGR pipeline tracking |
| `brand_id` | `string` | No | Brand identifier, defaults to carlton |
| `operation` | `string` | **Yes** | Operation to perform: propose_offer, build_offer, approve_offer, launch_offer, pause_offer, retire_offer, get_intelligence, log_ad_performance |
| `parameters` | `object` | No | Operation-specific parameters including offer_id, proposal_id, template_key, title, niche, target_audience, price_cents, pain_points, platform, campaign_name, ad_data |

**Output:**

- **Error:** `{ success, error, domain }`
- **Success:** `{ success, brand_id, task_id, domain, operation, result, error, metadata }`

**Branches:**

- `fallback`: Unknown operations go directly to Build Completion
- `build_offer`: Dispatches to OFFER-BUILD for offer construction -> calls: OFFER-BUILD
- `pause_offer`: Updates offer status to paused in Supabase offers table
- `launch_offer`: Updates offer status to live in Supabase offers table
- `retire_offer`: Updates offer status to retired in Supabase offers table
- `approve_offer`: Updates offer status to approved in Supabase offers table
- `propose_offer`: Dispatches to OFFER-IDEATE for AI proposal generation -> calls: OFFER-IDEATE
- `get_intelligence`: Dispatches to OFFER-INTELLIGENCE for performance analysis -> calls: OFFER-INTELLIGENCE
- `log_ad_performance`: Inserts ad performance data into Supabase ad_performance table

**Implementation Notes:**

- Clean architecture - proper Switch routing with named outputs
- All Supabase calls use predefinedCredentialType
- Logs every execution to autonomous_execution_log
- Reports completion to RDGR-COMPLETE pipeline

---

### OFFER-DELIVER
> Post-purchase product delivery - sends template-specific content (form email, workshop access, or live session invite) and enrolls in follow-up sequence

- **Trigger:** Webhook: POST `/offer-deliver`
- **Nodes:** 14

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brand_id` | `string` | No | Brand identifier, defaults to carlton |
| `offer_id` | `string` | **Yes** | ID of the offer to deliver |
| `contact_id` | `string` | No | CRM contact ID for interaction logging |
| `purchase_id` | `string` | No | Purchase ID for delivery status tracking |
| `customer_email` | `string` | **Yes** | Customer email for delivery |

**Output:**

- **Error:** `{ error, _valid }`
- **Success:** `{ success, offer_id, template_key, delivery_method, customer_email }`

**Branches:**

- `fallback`: Unknown template_key - goes directly to Update Delivery Status
- `scorecard`: Sends assessment form email with link to landing page form -> calls: RDGR-EMAIL
- `live_session`: Creates Google Calendar event then sends session invite email -> calls: GOOGLE-CALENDAR-UTILITY, RDGR-EMAIL
- `recorded_workshop`: Sends workshop access email with recording + materials links -> calls: RDGR-EMAIL

**Implementation Notes:**

- Clean template-based routing via Switch node
- Properly uses HUMAN-TASK-UTIL pattern for CRM logging (via rdgr-crm webhook)
- Enrolls customers in post-purchase follow-up sequences via crm-sequences webhook
- All Supabase calls use predefinedCredentialType

---

### OFFER-IDEATE
> AI offer proposal generator - analyzes market data, CRM insights, and existing offer performance to propose new offers with template-specific content plans

- **Trigger:** Webhook: POST `/offer-ideate`
- **Nodes:** 11

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `niche` | `string` | No | Target niche/industry for the offer |
| `context` | `string` | No | Additional context for proposal generation |
| `task_id` | `string` | No | Task ID for RDGR pipeline tracking |
| `brand_id` | `string` | **Yes** | Brand identifier |
| `budget_hint` | `string` | No | Pricing guidance |
| `pain_points` | `array` | No | List of audience pain points |
| `template_key` | `string` | No | Offer template type (scorecard, recorded_workshop, live_session, ai_propose for auto-selection, etc.) - supports 25+ template types |
| `target_audience` | `string` | No | Who the offer is for |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ success, proposal_id, proposed_title, confidence_score, template_key, message }`

**Implementation Notes:**

- Supports 25+ template types with detailed generation instructions per type
- ai_propose mode lets GPT choose the best template type based on market analysis
- Uses gpt-4o for proposal generation with JSON response format
- Properly uses HUMAN-TASK-UTIL webhook for approval tasks (not direct directive_tasks insert)
- Filters proposals by confidence_score >= 0.5
- Clean linear pipeline: Parse -> Load Data -> AI -> Parse -> Insert -> Human Task -> Response

---

### OFFER-INTELLIGENCE
> Weekly performance analysis - aggregates offer metrics, revenue dashboard, ad performance, and CRM insights then uses GPT to generate intelligence report with new offer proposals

- **Trigger:** Webhook + Schedule: POST `/offer-intelligence`
- **Nodes:** 13

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task_id` | `string` | No | Task ID for pipeline tracking |
| `brand_id` | `string` | No | Brand identifier, defaults to carlton |

**Output:**

- **Error:** `{ success, error }`
- **Success:** `{ success, summary, proposals_count, recommendations }`

**Implementation Notes:**

- BUG (MEDIUM): Inserts directly into directive_tasks table instead of using HUMAN-TASK-UTIL webhook - should use create-human-task webhook instead
- Dual trigger: weekly schedule + on-demand webhook from OFFER-BRIDGE
- Uses gpt-4o-mini for analysis with JSON response format
- Filters AI proposals by confidence_score >= 0.6 before inserting
- Loads data from 4 sources: offer intelligence RPC, revenue dashboard RPC, ad_performance table, unified_contacts table
- All Supabase calls use predefinedCredentialType

---

#### Landing Pages

### LP-GENERATE
> AI landing page content generator - loads offer details, testimonials, and templates then uses GPT-5.1 to generate full page content with hero, benefits, how-it-works, testimonials, pricing, FAQ, and CTA sections

- **Trigger:** Webhook: POST `/lp-generate`
- **Nodes:** 15

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `niche` | `string` | No | Industry/niche for testimonial matching |
| `title` | `string` | No | Page title/offer title |
| `task_id` | `string` | No | Task ID for RDGR pipeline tracking |
| `cta_text` | `string` | No | Call-to-action button text, defaults to Get Started |
| `feedback` | `string` | No | Revision feedback for regenerate operation |
| `offer_id` | `string` | No | Offer ID to load details from offers table |
| `operation` | `string` | No | Operation: generate (default) or regenerate (with feedback) |
| `pain_points` | `array` | No | List of audience pain points |
| `price_cents` | `number` | No | Price in cents for display |
| `template_type` | `string` | No | Landing page template type (generic, scorecard, etc.), defaults to generic |
| `target_audience` | `string` | No | Target audience description |
| `stripe_payment_link` | `string` | No | Stripe payment URL for CTA |

**Output:**

- **Error:** `{ success, error }`
- **Success:** `{ success, operation, page_id, slug, preview_url, message }`

**Implementation Notes:**

- Uses gpt-5.1 (premium model) for landing page content generation
- Loads testimonials from TESTIMONIAL-DISTRIBUTE webhook for social proof
- Loads template section structure from landing_page_templates table
- Properly uses HUMAN-TASK-UTIL webhook (create-human-task) for approval task creation
- Creates page via PAGE-CREATE webhook, not direct Supabase insert
- Reports completion to RDGR-COMPLETE for pipeline tracking
- IF Save false path correctly sends error response with 400 status code
- All Supabase calls use predefinedCredentialType

---

### LP-APPROVE
> Landing page approval gate - lists pending pages, approves/rejects/requests changes, triggers publish or regenerate on approval actions

- **Trigger:** Webhook: POST `/lp-approve`
- **Nodes:** 12

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `page_id` | `string` | No | Landing page ID (required for approve/request_changes/reject) |
| `brand_id` | `string` | No | Brand identifier, defaults to carlton |
| `feedback` | `string` | No | Feedback text for request_changes or reject operations |
| `operation` | `string` | **Yes** | Operation: list_pending, approve, request_changes, reject |

**Output:**

- **Error:** `{ error, _valid }`
- **Success:** `{ success, operation, pages, count, message }`

**Branches:**

- `reject`: Sets approval_status=rejected with rejection reason
- `approve`: Sets approval_status=approved then triggers LP-PUBLISH webhook -> calls: LP-PUBLISH
- `fallback`: Unknown operation goes directly to Build Response
- `list_pending`: Lists all landing pages with approval_status=pending from Supabase
- `request_changes`: Sets approval_status=changes_requested then triggers LP-GENERATE regenerate -> calls: LP-GENERATE

**Implementation Notes:**

- Clean multi-operation approval workflow with proper Switch routing
- All Supabase calls use predefinedCredentialType
- Trigger Publish and Fire Regenerate both have onError: continueRegularOutput for resilience
- IF Valid false path correctly sends error response via Respond to Webhook

---

### LP-PUBLISH
> Publishes, unpublishes, or updates landing page content with CDN revalidation

- **Trigger:** Webhook: POST `/lp-publish`
- **Nodes:** 10

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | `string` | No | URL slug for the page |
| `content` | `object` | No | Content payload for update_content operation |
| `page_id` | `string` | **Yes** | Landing page identifier |
| `operation` | `string` | **Yes** | Action to perform: publish, unpublish, or update_content |

**Output:**

- **Error:** `{ error, _valid }`
- **Success:** `{ success, operation, page_id, message, published_url }`

**Branches:**

- `publish`: Fetches slug from DB, sets status=published with published_at/published_url, triggers CDN revalidation
- `fallback`: Unknown operations go directly to Build Response
- `unpublish`: Sets page status to archived, triggers CDN revalidation
- `update_content`: Routes to publish path (shares Get Page Slug node) for content updates

**Known Issues:**

- MEDIUM: Hardcoded revalidation secret 'carlton-landing-revalidate-2026' in Trigger Revalidation jsonBody expression

**Implementation Notes:**

- Switch update_content and publish both route to Get Page Slug -> Publish Page path â€” update_content may incorrectly set status to 'published'
- Clean: Uses predefinedCredentialType supabaseApi for all Supabase calls
- Clean: All Code nodes use $('NodeName').first() pattern correctly
- Trigger Revalidation has onError: continueRegularOutput â€” graceful degradation if CDN is down

---

### LP-ANALYTICS
> Hourly landing page metrics aggregator - iterates published pages, calls get_landing_page_analytics RPC per page, and saves aggregated metrics via update_landing_page_metrics RPC

- **Trigger:** Schedule (cron)
- **Nodes:** 6

**Input:**

No input parameters (scheduled or parameterless).

**Output:**



**Implementation Notes:**

- BUG (MEDIUM): Save Metrics node uses $('Loop Pages').first().json.page_id inside SplitInBatches loop - should use .last() to get current iteration's page_id. Currently may pass wrong page_id if batch size > 1
- IF No Pages true path is intentionally a dead-end (no-op when no published pages exist)
- SplitInBatches done output (output[1]) is also a dead-end - loop just stops, which is correct
- No Code nodes - pure HTTP/Supabase RPC pipeline
- All Supabase calls use predefinedCredentialType

---

#### Pages + Forms + Tracking

### PAGE-CREATE
> Universal page publisher that creates landing pages in Supabase with auto-generated page_id, slug, and optional CDN revalidation

- **Trigger:** Webhook: POST `/page-create`
- **Nodes:** 9

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | `string` | No | URL slug (auto-generated from title/headline if not provided, max 80 chars) |
| `title` | `string` | No | Page title (at least one of slug/title/headline required) |
| `status` | `string` | No | Initial status: draft or published (default: draft) |
| `page_id` | `string` | No | Custom page ID (auto-generated as LP_yymmddhhmmss if not provided) |
| `brand_id` | `string` | No | Brand identifier (default: carlton) |
| `cta_text` | `string` | No | Call-to-action button text (default: Get Started) |
| `headline` | `string` | No | Page headline |
| `offer_id` | `string` | No | Associated offer identifier |
| `page_type` | `string` | No | Page type: landing, offer, blog, etc. (default: landing) |
| `body_sections` | `array` | No | Array of page content sections |
| `template_type` | `string` | No | Template variant (default: generic) |

**Output:**

- **Error:** `{ success, error }`
- **Success:** `{ success, page_id, slug, status, brand_id, page_type, preview_url, public_url, revalidated }`

**Branches:**

- `draft`: If status=draft, skips revalidation and builds response directly
- `published`: If status=published, triggers CDN revalidation at pages.bradfordcarlton.com before building response

**Known Issues:**

- MEDIUM: Hardcoded revalidation secret 'carlton-landing-revalidate-2026' in Trigger Revalidation jsonBody

**Implementation Notes:**

- At least one of slug, title, or headline is required (soft required)
- Clean: Uses predefinedCredentialType supabaseApi for all Supabase calls
- Clean: All Code nodes use $input.first() and $('NodeName').first() correctly
- Trigger Revalidation has onError: continueRegularOutput for graceful CDN failure handling
- IF Valid false path correctly routes to Respond Error with 400 status

---

### PAGE-FORM
> Handles form submissions from landing pages: lead capture with CRM upsert + sequence enrollment, checkout with Stripe payment + order recording, upsell/downsell accept/decline

- **Trigger:** Webhook: POST `/page-form`
- **Nodes:** 26

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | `string` | No | Customer email address |
| `action` | `string` | No | For upsell/downsell: accept or decline |
| `offer_id` | `string` | No | Product/offer identifier for purchase recording |
| `data_type` | `string` | No | Form type: lead (default), checkout, upsell, or downsell |
| `last_name` | `string` | No | Customer last name |
| `first_name` | `string` | No | Customer first name |
| `sequence_id` | `string` | No | Email sequence to enroll lead into after CRM upsert |
| `amount_cents` | `integer` | No | Payment amount in cents |
| `funnel_session_id` | `string` | No | Funnel session tracking ID |
| `payment_method_id` | `string` | No | Stripe payment method ID for checkout/upsell |

**Output:**

- **Lead Success:** `{ success, message, contact_id }`
- **Accept Success:** `{ success, purchase_id, redirect_url }`
- **Checkout Error:** `{ success, error }`
- **Decline Success:** `{ success, message }`
- **Checkout Success:** `{ success, purchase_id, payment_status, redirect_url }`

**Branches:**

- `lead`: CRM upsert contact via rdgr-crm webhook, then optionally enroll in email sequence via crm-sequences webhook -> calls: CRM-BRIDGE, CRM-SEQUENCE
- `accept`: Lookup funnel session for stored payment method, charge upsell via Stripe off-session, record in offer_purchases
- `decline`: Returns decline acknowledgment with redirect URL
- `unknown`: Returns error for unrecognized form types
- `checkout`: Create Stripe customer, create PaymentIntent, record order in offer_purchases, upsert funnel_sessions -> calls: Stripe API

**Known Issues:**

- MEDIUM: Uses Stripe TEST credential (vSby0zZ4l1Rq1zlQ) for both Create Customer and Create PaymentIntent â€” verify before going live
- MEDIUM: Build Seq Payload uses $('Parse Form').first().json which is correct here (not in a loop)

**Implementation Notes:**

- Clean: All Stripe HTTP nodes and Supabase nodes have onError: continueRegularOutput for graceful failure
- Clean: Uses predefinedCredentialType supabaseApi for all Supabase calls
- Clean: Uses predefinedCredentialType stripeApi for Stripe calls
- Build Upsell PI uses $input.all() pattern correctly to handle potential multiple session results
- Order bump amounts are correctly added to total in Build PI Body
- 5 distinct response paths: Lead Response, Checkout Success, Checkout Error, Accept Response, Decline Response, Error Response

---

### PAGE-TRACK
> Ingests frontend analytics events (page views, scroll depth, clicks, form steps) into landing_page_events table

- **Trigger:** Webhook: POST `/page-track`
- **Nodes:** 4

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | `string` | No | Event name: page_view, scroll_depth, cta_click, form_step, checkout_complete, etc. (default: page_view) |
| `page_id` | `string` | No | Page identifier (falls back to page_url if not set) |
| `brand_id` | `string` | No | Brand identifier (default: carlton) |
| `variant_key` | `string` | No | A/B test variant key |
| `depth_percent` | `number` | No | Scroll depth percentage â€” auto-mapped to scroll_25/50/75/100 event types |
| `funnel_session_id` | `string` | No | Visitor/session identifier |

**Output:**

- **Success:** `{ success }`

**Implementation Notes:**

- Clean: Simple 4-node pipeline with no anti-patterns
- Clean: Uses predefinedCredentialType supabaseApi
- scroll_depth events are automatically bucketed into scroll_25/50/75/100 event types
- Insert Event has onError: continueRegularOutput â€” always returns success even if insert fails (fire-and-forget pattern for analytics)
- All input fields are optional â€” minimal payload of just {event: 'page_view'} works

---

#### Promotions + Metrics

### PROMO-MANAGE
> Full CRUD manager for page promotions (banners, interstitials) with 7 operations: create, update, pause, activate, delete, list, expire

- **Trigger:** Webhook: POST `/promo-manage`
- **Nodes:** 10

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | No | Promotion title (required for create) |
| `ends_at` | `string` | No | ISO timestamp for promotion end |
| `updates` | `object` | No | Key-value pairs for update operation |
| `brand_id` | `string` | No | Brand identifier for list filtering (default: carlton) |
| `page_ids` | `array` | No | Target specific page IDs |
| `priority` | `integer` | No | Display priority 1-10 (default: 5, lower = higher priority) |
| `operation` | `string` | **Yes** | Action: create, update, pause, activate, delete, list, or expire |
| `placement` | `string` | No | Display placement: banner_top, interstitial, etc. (default: banner_top) |
| `starts_at` | `string` | No | ISO timestamp for promotion start |
| `promotion_id` | `string` | No | Promotion ID (auto-generated as PROMO_yymmddhhmmss for create; required for update/pause/activate/delete) |
| `template_types` | `array` | No | Target specific template types |

**Output:**

- **Error:** `{ success, error }`
- **List Success:** `{ success, operation, promotions, count }`
- **Create Success:** `{ success, operation, promotion_id, data }`
- **Expire Success:** `{ success, operation, message, data }`
- **Update Success:** `{ success, operation, promotion_id, message }`

**Branches:**

- `list`: GETs all promotions for brand_id ordered by priority asc, created_at desc
- `pause`: PATCHes status to 'paused' by promotion_id
- `create`: Generates promotion_id, builds full record, POSTs to page_promotions with return=representation
- `delete`: DELETEs promotion by promotion_id
- `expire`: Calls expire_promotions RPC to batch-expire all past-due promotions
- `update`: PATCHes page_promotions with updates object by promotion_id
- `activate`: PATCHes status to 'active' by promotion_id

**Known Issues:**

- MEDIUM: jsonBody sends '{}' even for GET/DELETE operations where body is not needed (harmless but unnecessary)

**Implementation Notes:**

- Clean: Uses predefinedCredentialType supabaseApi for all Supabase calls
- Clean: All Code nodes use $input.first() and $('NodeName').first() correctly
- Dynamic HTTP method/URL pattern in Execute Supabase node â€” method and URL are expressions from Build HTTP Request code node
- Two-level validation: IF Valid checks operation parsing, IF Request Valid checks operation-specific requirements (e.g., title for create, promotion_id for update)
- Both false paths (IF Valid, IF Request Valid) correctly route to separate error response nodes with 400 status
- Build Response list operation uses $('Execute Supabase').all() correctly for multi-item results

---

### PROMO-EXPIRE
> Daily scheduled job (7am UTC) that calls expire_promotions RPC to deactivate promotions past their expiry date

- **Trigger:** Schedule (cron)
- **Nodes:** 2

**Input:**

No input parameters (scheduled or parameterless).

**Output:**



**Implementation Notes:**

- Clean: Simple 2-node workflow with no Code nodes
- Clean: Uses predefinedCredentialType supabaseApi for RPC call
- 30-second timeout on the RPC call
- Runs at 7am UTC which is midnight Pacific time â€” appropriate for daily expiry checks

---

### METRICS-UPDATE
> Hourly scheduled job that calls update_sequence_metrics RPC to refresh email sequence performance metrics

- **Trigger:** Schedule (cron)
- **Nodes:** 2

**Input:**

No input parameters (scheduled or parameterless).

**Output:**



**Implementation Notes:**

- Clean: Simple 2-node workflow with no Code nodes
- Clean: Uses predefinedCredentialType supabaseApi for RPC call
- 30-second timeout on the RPC call â€” appropriate for aggregate computation

---

#### Stripe Integration

### STRIPE-HOOK
> Receives Stripe webhook events, logs to stripe_events table, routes by event type to update purchases or subscriptions

- **Trigger:** Webhook: POST `/stripe-events`
- **Nodes:** 10

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | **Yes** | Stripe event ID |
| `data` | `object` | **Yes** | Stripe event data with nested object |
| `type` | `string` | **Yes** | Stripe event type e.g. payment_intent.succeeded |

**Output:**

- **Error:** `{ received }`
- **Success:** `{ received }`

**Branches:**

- `payment`: Updates offer_purchases payment_status based on event type then marks event processed
- `fallback`: Marks event as processed without additional action
- `subscription`: Updates unified_contacts subscription_status then marks event processed

**Implementation Notes:**

- Clean workflow - no expression injection issues found
- All Supabase calls use predefinedCredentialType supabaseApi
- Only 1 Code node for parsing - rest is HTTP Request nodes with expressions
- Uses ignore-duplicates on event insert for idempotency
- Switch has proper fallback output for unhandled event types

---

### STRIPE-WEBHOOK
> Advanced Stripe event processor with idempotency check, event-type routing to Supabase RPCs, delivery triggering for checkout completions, and refund alerting

- **Trigger:** Webhook: POST `/stripe-webhook`
- **Nodes:** 16

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | **Yes** | Stripe event ID for idempotency |
| `data` | `object` | **Yes** | Stripe event data with nested object containing customer metadata |
| `type` | `string` | **Yes** | Stripe event type |

**Output:**

- **Error:** `{ received }`
- **Success:** `{ received }`

**Branches:**

- `fallback`: Marks event processed without additional action
- `invoice_paid`: Calls process_stripe_payment RPC without delivery trigger
- `charge_refunded`: Calls process_stripe_refund RPC then sends alert email via RDGR-EMAIL -> calls: RDGR-EMAIL
- `already_processed`: Returns 200 immediately if event already exists in stripe_events
- `customer_subscription`: Calls process_stripe_subscription RPC
- `checkout_session_completed`: Calls process_stripe_payment RPC then triggers offer-deliver webhook -> calls: OFFER-DELIVER

**Implementation Notes:**

- Clean workflow - no expression injection found
- Proper idempotency via stripe_event_id lookup before processing
- All Supabase calls use predefinedCredentialType supabaseApi
- Delegates heavy processing to Supabase RPCs
- Sticky note references old error workflow C4cQlVsokKlfR8p5 but settings correctly point to ERR-UTIL o7sItu0Gy6CuRdch

---

#### Testimonials

### TESTIMONIAL-INGEST
> Ingests testimonials in text/video/image format, supports bulk import and candidate suggestion, triggers AI polishing for text testimonials

- **Trigger:** Webhook: POST `/testimonial-ingest`
- **Nodes:** 15

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brand_id` | `string` | No | Brand ID defaults to carlton |
| `raw_text` | `string` | No | Testimonial text for ingest_text |
| `image_url` | `string` | No | Image URL for ingest_image |
| `operation` | `string` | **Yes** | One of: ingest_text ingest_video ingest_image bulk_import suggest_candidates |
| `video_url` | `string` | No | Video URL for ingest_video |
| `testimonials` | `array` | No | Array of testimonial objects for bulk_import |
| `attribution_name` | `string` | No | Name of person giving testimonial |

**Output:**

- **Error:** `{ success, error }`
- **Success:** `{ success, operation, testimonial_id, message, candidates, count }`

**Branches:**

- `invalid`: Returns 400 for missing operation
- `bulk_import`: Splits testimonials into batches and upserts each via RPC
- `ingest_text`: Upserts text testimonial via RPC then triggers TESTIMONIAL-POLISH -> calls: TESTIMONIAL-POLISH
- `ingest_image`: Upserts image testimonial via RPC
- `ingest_video`: Upserts video testimonial via RPC
- `suggest_candidates`: Calls get_testimonial_candidates RPC

**Implementation Notes:**

- Clean workflow - no anti-patterns
- All Supabase calls use predefinedCredentialType supabaseApi
- Uses SplitInBatches for bulk import correctly
- Trigger Polish has onError continueRegularOutput for resilience

---

### TESTIMONIAL-POLISH
> AI-polishes raw testimonials via OpenAI to fix grammar while preserving voice, extracts headline and short version, creates human approval task

- **Trigger:** Webhook: POST `/testimonial-polish`
- **Nodes:** 11

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brand_id` | `string` | No | Brand ID defaults to carlton |
| `raw_text` | `string` | **Yes** | Original testimonial text to polish |
| `testimonial_id` | `string` | **Yes** | Testimonial ID to update with polished text |
| `attribution_name` | `string` | No | Name of person for prompt context |

**Output:**

- **Error:** `{ success, error }`
- **Success:** `{ success, testimonial_id, headline, message }`

**Branches:**

- `valid`: Builds prompt then calls OpenAI gpt-4o-mini then parses response then upserts via RPC then creates human approval task -> calls: HUMAN-TASK-CREATE
- `invalid`: Returns 400 for missing testimonial_id or raw_text

**Implementation Notes:**

- Clean workflow - no anti-patterns
- Uses gpt-4o-mini with temperature 0.3 and json_object response format
- Creates human task with comparison review content showing original vs polished
- Callback webhook points back to testimonial-polish for approval results
- Uses upsert_testimonial RPC for data persistence
- OpenAI call has onError continueRegularOutput for graceful degradation

---

### TESTIMONIAL-APPROVE
> Approval gate for testimonials with list_pending, approve, reject, and edit_and_approve operations

- **Trigger:** Webhook: POST `/testimonial-approve`
- **Nodes:** 11

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brand_id` | `string` | No | Brand ID defaults to carlton |
| `feedback` | `string` | No | Rejection reason for reject operation |
| `operation` | `string` | **Yes** | One of: list_pending approve reject edit_and_approve |
| `edited_text` | `string` | No | Replacement polished_text for edit_and_approve |
| `testimonial_id` | `string` | No | Required for approve reject edit_and_approve |

**Output:**

- **Error:** `{ success, error }`
- **Success:** `{ success, operation, message, testimonials, count }`

**Branches:**

- `reject`: Sets approval_status to rejected with rejection_reason
- `approve`: Sets approval_status to approved with approved_by and timestamp
- `invalid`: Returns error response for missing operation
- `fallback`: Passes through to Build Response for unknown operations
- `list_pending`: Returns all pending testimonials from crm_testimonials
- `edit_and_approve`: Updates polished_text then approves

**Implementation Notes:**

- Clean workflow - follows canonical approval pattern
- All Supabase calls use predefinedCredentialType supabaseApi
- IF false path properly connected to Respond to Webhook
- Switch fallback properly connected to Build Response

---

### TESTIMONIAL-DISTRIBUTE
> Supplies formatted testimonials for different channels: email, landing page, proposal, and social media

- **Trigger:** Webhook: POST `/testimonial-distribute`
- **Nodes:** 12

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tags` | `array` | No | Filter by tags |
| `limit` | `number` | No | Max results defaults to 4 |
| `brand_id` | `string` | No | Brand ID defaults to carlton |
| `industry` | `string` | No | Filter by industry |
| `operation` | `string` | No | One of: get_for_email get_for_landing_page get_for_proposal get_for_social. Defaults to get_for_landing_page |
| `min_rating` | `number` | No | Min rating filter defaults to 3 |
| `service_type` | `string` | No | Filter by service type |

**Output:**

- **Error:** `{ success, error }`
- **Success:** `{ success, operation, data, testimonial_ids, count }`

**Branches:**

- `fallback`: Falls through to get_for_landing_page format
- `get_for_email`: Returns single best testimonial with quote and attribution
- `get_for_social`: Returns single testimonial formatted as social post text
- `get_for_proposal`: Returns top 3 rated 4+ testimonials with quote headline name company
- `get_for_landing_page`: Returns up to 6 testimonials with full details

**Implementation Notes:**

- Clean workflow - no anti-patterns
- Uses search_testimonials RPC for filtering
- Records testimonial usage via record_testimonial_usage RPC
- Respond to Webhook references Save Format Result node which preserves data through Record Usage

---

#### Scorecards

### SCORECARD-PROCESS
> Processes scorecard/quiz/calculator/assessment form submissions, scores via OpenAI, generates Google Doc report, emails results to customer

- **Trigger:** Webhook: POST `/scorecard-process`
- **Nodes:** 15

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `form_id` | `string` | No | Form identifier |
| `brand_id` | `string` | No | Brand ID defaults to carlton |
| `offer_id` | `string` | No | Offer ID to load scoring rubric |
| `form_type` | `string` | No | scorecard quiz calculator or assessment |
| `responses` | `array` | **Yes** | Array of question/answer objects |
| `purchase_id` | `string` | No | Purchase ID for delivery tracking |
| `customer_name` | `string` | No | Customer name |
| `customer_email` | `string` | **Yes** | Customer email address |

**Output:**

- **Error:** `{ success, error }`
- **Success:** `{ success, overall_score, grade, doc_url, pdf_url }`

**Branches:**

- `valid`: Scores via OpenAI then creates Google Doc and emails report and updates delivery and upserts CRM -> calls: RDGR-EMAIL, CRM-BRIDGE
- `invalid`: Returns 400 for missing email or responses

**Implementation Notes:**

- Clean workflow no anti-patterns
- Uses predefinedCredentialType for all creds
- CRM upsert runs parallel with scoring pipeline
- 4 form types with type-specific AI prompts

---


## Section 2: Command System + RDGR Tools (16 workflows)

Rodger autonomous agent command infrastructure, reporting, health checks, and tool workflows.

#### Command + Chat

### RDGR-CHAT
> Chat interface for RDGR - routes messages through GPT-5.1 router, executes utility/CRM/task operations, generates contextual AI responses, persists conversation history

- **Trigger:** Webhook: POST `/rdgr-chat`
- **Nodes:** ?

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sender` | `string` | No | Message sender identifier |
| `message` | `string` | No | User message text (required for send_message) |
| `brand_id` | `string` | No | Brand identifier |
| `metadata` | `object` | No | Additional context metadata |
| `operation` | `string` | **Yes** | send_message|create_thread|summarize_thread|list_threads |
| `thread_id` | `string` | No | Conversation thread identifier |

**Output:**

- **Error:** `{ success, error }`
- **Success:** `{ success, thread_id, message_id, response, route, domain, operation_result }`

**Branches:**

- `simple_ops`: create_thread, summarize_thread, list_threads - handled directly
- `memory_save`: After every 5th message, summarizes thread and saves to rdgr_memories
- `chat_message_crm`: Router classifies as CRM operation - calls CRM-BRIDGE -> calls: CRM-BRIDGE
- `chat_message_direct`: Direct response - no external call needed, goes to Response Agent
- `chat_message_task_db`: Router classifies as task DB write - writes to directive_tasks/task_queue
- `chat_message_utility`: Router classifies as utility call - executes via webhook URL from router

**Known Issues:**

- CRITICAL: 4 Code nodes contain hardcoded Supabase secret key (sb_secret_...) - Persist Human Message, Execute Task DB Write, Persist AI and Build Response, Save Memory and Respond. Must migrate to HTTP Request nodes with predefinedCredentialType supabaseApi
- CRITICAL: 4 Code nodes use this.helpers.httpRequest for Supabase calls - vulnerable to 60s task runner timeout

**Implementation Notes:**

- GPT-5.1 Router classifies messages into: direct_response, utility_call, crm_call, task_db_write, knowledge_query, advisory_council
- Persists all messages to rdgr_chat_messages table, memory summaries to rdgr_memories
- 22 nodes total

---

### RDGR-OUTBOUND
> Outbound sequence generator - enriches prospect, fetches brand identity, generates multi-channel outreach sequence via GPT-5.1, schedules via RDGR-TOOL-SEQUENCE

- **Trigger:** Webhook: POST `/rdgr-outbound`
- **Nodes:** ?

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signal` | `string` | No | Buying signal or outreach trigger context |
| `task_id` | `string` | No | Task identifier, auto-generated if missing |
| `brand_id` | `string` | No | Brand identifier, defaults to carlton |
| `prospect` | `object` | No | Prospect details: name, company, role, email, linkedin |
| `operation` | `string` | No | Operation type, defaults to single_prospect |

**Output:**

- **Error:** `{ success, error }`
- **Success:** `{ success, task_id, prospect, tier, icp_score, sequence }`

**Implementation Notes:**

- Clean workflow, no anti-patterns detected
- Linear pipeline: Parse Input -> Enrich -> Identity -> Build Prompt -> GPT-5.1 -> Parse -> Schedule -> Log -> Complete -> Respond
- Calls RDGR-TOOL-ENRICH for prospect research, RDGR-IDENTITY for brand seed doc
- GPT-5.1 generates tier-specific multi-channel sequence (email, LinkedIn, phone) over 10 days
- Parse & Prepare Sequence correctly handles output_text and output[0].content[0].text fallbacks
- Reports completion to RDGR-COMPLETE
- Logs to autonomous_execution_log via predefinedCredentialType supabaseApi
- 11 nodes total

---

### RDGR-PLAN-DISPATCH
> Data access layer for RDGR-PLAN with 8 query actions: state summary, expand directives/domain/failures/contacts/pipeline/knowledge, and submit directive validation

- **Trigger:** Webhook: POST `/rdgr-plan-dispatch`
- **Nodes:** 31

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | `get_state_summary` / `expand_directives` / `expand_domain` / `expand_failures` / `expand_contacts` / `expand_pipeline` / `expand_knowledge` / `submit_directives` | **Yes** | Which data action to perform |
| `params` | `object` | No | Action-specific parameters (e.g. params.domain for expand_domain, params.topic for expand_knowledge, params.directives[] for submit_directives) |
| `brand_id` | `string` (default: `carlton`) | No |  |

**Output:**

- **Error:** `{ response.success, response.data, response.error }`
- **Success:** `{ response.success, response.data, response.error }`

**Branches:**

- `expand_domain`: Tasks filtered by params.domain
- `expand_contacts`: Contact list with engagement data
- `expand_failures`: Execution log failures from last 48h
- `expand_pipeline`: Full revenue pipeline ordered by value
- `expand_knowledge`: Knowledge base entries optionally filtered by params.topic
- `expand_directives`: Full directive details with nested outcomes
- `get_state_summary`: Fetches directives, outcomes, plan, pipeline, tasks, financial and assembles compact summary
- `submit_directives`: Validates directive objects, assigns IDs (DIR-timestamp-idx format), does NOT write to DB

**Known Issues:**

- MEDIUM: Validate Directives generates DIR-timestamp IDs which conflicts with standardized P_yymmddhhmmss format

**Implementation Notes:**

- All Supabase calls use predefinedCredentialType supabaseApi -- correct pattern
- SS path chains 7 sequential HTTP calls to build state summary -- potential latency concern

---

### BKAI-BRIDGE
> BookkeeperAI integration bridge - normalizes RDGR-QUEUE and Hub Planner payloads, dispatches to BKAI webhooks, reports results

- **Trigger:** Webhook: POST `/rdgr-bookkeeper`
- **Nodes:** ?

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | `string` | No | Source system identifier |
| `context` | `object` | No | Hub Planner context params |
| `task_id` | `string` | No | Task identifier, auto-generated if missing |
| `brand_id` | `string` | No | Brand identifier, defaults to carlton |
| `priority` | `string` | No | Priority level, defaults to normal |
| `task_type` | `string` | No | RDGR-QUEUE format: finance_report|invoice_create|payment_check|expense_record|tax_export|reconcile |
| `tool_type` | `string` | No | Hub Planner format: bookkeeping_report|bookkeeping_invoice|bookkeeping_payment|bookkeeping_expense|bookkeeping_tax|bookkeeping_reconcile |
| `parameters` | `object` | No | RDGR-QUEUE operation params |

**Output:**

- **Error:** `{ success, task_id, task_type, error, completed_at }`
- **Success:** `{ success, task_id, task_type, result, error, completed_at }`

**Branches:**

- `failure_path`: On failure: reports to RDGR-AUTOFIX, logs to execution_log -> calls: RDGR-AUTOFIX
- `success_path`: On success: reports to RDGR-COMPLETE, logs to execution_log -> calls: RDGR-COMPLETE

**Known Issues:**

- MEDIUM: Dispatch to BKAI Code node uses this.helpers.httpRequest instead of HTTP Request node - should be refactored for task runner 60s timeout safety

**Implementation Notes:**

- Accepts 3 input formats: RDGR-QUEUE (task_type), Hub Planner (tool_type), Direct (type)
- Maps 6 task types to BKAI webhook endpoints: generate-report, ar-create, record-payment, ap-approve, tax-export, reconcile
- 9 nodes total

---

#### Reporting

### RDGR-REPORT-COLLECT
> Collects data from 8 Supabase tables (tasks, pipeline, contacts, exec log, plans, financial snapshots, partners, outreach), compiles 24h report payload, then calls RDGR-REPORT-GENERATE

- **Trigger:** Webhook + Schedule: POST `/rdgr-report-collect`
- **Nodes:** 15
- **Tables Read:** `autonomous_task_queue`, `autonomous_revenue_pipeline`, `autonomous_contacts`, `autonomous_execution_log`, `autonomous_strategic_plans`, `autonomous_financial_snapshots`, `partnership_partners`, `partnership_outreach`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brand_id` | `string` (default: `carlton`) | No | Brand to collect report data for |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ brand_id, report_date, period, tasks, pipeline, new_contacts, execution, capabilities, approval_queue, partnerships, financial, strategic }`

**Known Issues:**

- HIGH: Compile Report uses this.helpers.httpRequest to call update-google-sheet webhook -- should use HTTP Request node instead
- HIGH: Compile Report uses $env.RDGR_DASHBOARD_ID which is likely unset (n8n $env vars are not configured)
- MEDIUM: Fetches entire tables without date filters for tasks/pipeline/contacts -- potential performance issue at scale

**Implementation Notes:**

- All Supabase HTTP nodes use predefinedCredentialType supabaseApi -- correct pattern
- Schedule trigger at 12:00 UTC = 5AM PDT, not 7AM EST as node name suggests

---

### RDGR-REPORT-GENERATE
> Generates daily report using GPT via OpenAI Responses API, saves as Google Doc, registers in Hub, then calls RDGR-REPORT-DELIVER for email delivery

- **Trigger:** Webhook: POST `/rdgr-report-generate`
- **Nodes:** 15

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tasks` | `object` | **Yes** |  |
| `period` | `object` | No |  |
| `brand_id` | `string` (default: `carlton`) | **Yes** |  |
| `pipeline` | `object` | **Yes** |  |
| `financial` | `object` | **Yes** |  |
| `strategic` | `object` | No |  |
| `report_date` | `string` | **Yes** |  |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ report_markdown, report_html, report_text, report_date, doc_url }`

**Implementation Notes:**

- Uses OpenAI Responses API (v1/responses) -- must parse output[0].content[0].text (or find message type)
- Calls RDGR-IDENTITY for SOUL personality document
- Creates Google Doc via Drive API and uploads HTML content
- Token usage tracked to autonomous_token_usage table
- All credentials use predefinedCredentialType -- correct pattern

---

### RDGR-REPORT-DELIVER
> Formats report HTML into RFC 2822 MIME email with base64-encoded parts and sends via Gmail API to Bradford and Dianna, then logs delivery to Supabase

- **Trigger:** Webhook: POST `/rdgr-report-deliver`
- **Nodes:** 7

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brand_id` | `string` (default: `carlton`) | No |  |
| `report_date` | `string` | **Yes** |  |
| `report_html` | `string` | **Yes** | Full HTML report content |
| `report_text` | `string` | No | Plain text fallback |
| `report_doc_url` | `string` | No | Google Doc URL for link in email |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ delivered, email_sent, brand_id, report_date, report_doc_url }`

**Known Issues:**

- MEDIUM: Hardcoded recipient emails -- should be configurable per brand

**Implementation Notes:**

- Uses Gmail OAuth2 credential (kqflG7RoOGMC88lU) via predefinedCredentialType -- correct
- Builds RFC 2822 multipart/alternative MIME with base64 encoding for proper emoji/UTF-8 support
- Respond to Webhook uses $node['Prepare Log Data'] bracket syntax -- works in expressions but not Code nodes
- Logs to autonomous_execution_log via Supabase with predefinedCredentialType -- correct

---

#### Health + Introspection

### RDGR-HEALTH-CHECK
> Simple health check endpoint - returns status ok with version and uptime

- **Trigger:** Webhook: POST `/rdgr-health-check`
- **Nodes:** ?

**Input:**

No input parameters (scheduled or parameterless).

**Output:**

- **Error:** `{ error }`
- **Success:** `{ status, version, timestamp, uptimeSeconds }`

**Implementation Notes:**

- Clean workflow, no anti-patterns detected
- 3 nodes total: Webhook -> Build Health Check Data -> Respond to Webhook
- Returns static version 1.0.0 and process uptime

---

### CRED-HEALTH-CHECK
> Checks Gmail OAuth2 credentials health every 6 hours, alerts on failures via email, creates human task for re-auth

- **Trigger:** Schedule (cron)
- **Nodes:** ?

**Input:**

No input parameters (scheduled or parameterless).

**Output:**

- **Error:** `{ error }`
- **Success:** `{ total_checked, healthy, failed, has_failures, results, failures, timestamp }`

**Branches:**

- `all_healthy`: When all credentials pass: logs success to execution_log
- `failures_detected`: When credentials fail: sends SendGrid alert email, creates directive_tasks entry, logs to execution_log

**Known Issues:**

- MEDIUM: Creates human task by directly inserting into directive_tasks table instead of using Human Task utility (create-human-task webhook)

**Implementation Notes:**

- Schedule: every 6 hours (0 */6 * * *)
- Checks 4 Gmail OAuth2 credentials: bradford@bradfordcarlton.com, Bradford/BradfordC/BradfordCarlton@aivibemasters.com
- Uses SendGrid for alert emails
- Also has a test webhook trigger at cred-health-check-test
- 13 nodes total

---

### RDGR-INTROSPECT
> Daily self-awareness profile updater - reads yesterday's journal, sends 6 parallel GPT analyses for different dimensions, upserts profile updates to rdgr_self_profile

- **Trigger:** Schedule (cron)
- **Nodes:** ?

**Input:**

No input parameters (scheduled or parameterless).

**Output:**

- **Error:** `{ error }`
- **Success:** `{ updated_dimensions, timestamp }`

**Branches:**

- `parallel_analysis`: 6 parallel OpenAI calls for dimensions: operational_capabilities, growth_edges, domain_mastery, execution_patterns, strategic_awareness, human_dependencies

**Known Issues:**

- HIGH: Prepare Context for Agents Code node uses $node['Fetch Yesterday Journal'] bracket syntax instead of $('Fetch Yesterday Journal') - silently returns undefined in Code nodes per error prevention rules

**Implementation Notes:**

- Schedule: daily at 2:00 AM (0 2 * * *)
- Also has test webhook trigger at rdgr-introspect
- Reads from rdgr_daily_journal and rdgr_self_profile tables
- 6 parallel OpenAI Responses API calls (one per dimension) using predefinedCredentialType openAiApi
- Parse All Updates uses output.find for message type correctly
- SplitInBatches loop to upsert each dimension individually
- 18 nodes total (15 functional + 3 sticky/notes)
- All Supabase calls use predefinedCredentialType supabaseApi correctly

---

### RDGR-INTERACTIVE-MAP
> Live workflow visualization dashboard - fetches system_registry data, builds Mermaid dependency graph and searchable HTML table

- **Trigger:** Webhook: POST `/rdgr-interactive-map`
- **Nodes:** ?

**Input:**

No input parameters (scheduled or parameterless).

**Output:**

- **Error:** `{ error }`

**Implementation Notes:**

- Clean workflow, no anti-patterns detected
- GET webhook - serves HTML page directly
- 5 nodes total (4 functional + 1 sticky note): Webhook GET -> Fetch Registry Data -> Build HTML Page -> Respond to Webhook
- Reads system_registry entries where category in (workflow, utility, integration)
- Builds Mermaid graph from metadata.calls relationships
- Features: search, status/category/system filters, detail panel, stats counters
- Uses predefinedCredentialType supabaseApi correctly

---

#### RDGR Tools

### RDGR-TOOL-ENRICH
> Prospect enrichment tool using Perplexity sonar-pro for company/person research, calculates ICP score (0-100) with tier classification, tracks token usage

- **Trigger:** Webhook: POST `/rdgr-tool-enrich`
- **Nodes:** 9

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | **Yes** | Contact/person name to research |
| `signal` | `string` | No | Buying signal context (e.g. 'funding', 'hiring') |
| `company` | `string` | **Yes** | Company name to research |
| `task_id` | `string` (default: `tool-enrich-{timestamp}`) | No |  |
| `brand_id` | `string` (default: `carlton`) | No |  |
| `research_depth` | `quick` | No | Research depth (only quick currently implemented) |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ success, profile.name, profile.company, profile.research, profile.icp_score, profile.tier, profile.scoring_breakdown, brand_id, task_id }`

**Known Issues:**

- MEDIUM: Does NOT accept Universal Request Envelope (operation/parameters) -- uses flat name/company/signal fields directly
- MEDIUM: Parse Input reads from $input.first().json.body -- direct webhook format only, not routed via QUEUE

**Implementation Notes:**

- Uses Perplexity predefinedCredentialType -- correct pattern
- Token usage logged to autonomous_token_usage via Supabase predefinedCredentialType -- correct
- ICP scoring is keyword-based on raw research text, not structured data -- fragile

---

### RDGR-TOOL-METRICS
> Returns current business metrics snapshot: revenue vs goal, pipeline value, 7-day task completion rates, velocity projection. Queries 3 Supabase tables sequentially.

- **Trigger:** Webhook: POST `/rdgr-tool-metrics`
- **Nodes:** 8
- **Tables Read:** `autonomous_financial_snapshots`, `autonomous_revenue_pipeline`, `autonomous_execution_log`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brand_id` | `string` (default: `carlton`) | No | Brand to fetch metrics for |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ success, metrics.actual_revenue, metrics.revenue_goal, metrics.revenue_gap, metrics.days_remaining, metrics.pipeline_value, metrics.weighted_pipeline, metrics.active_deals, metrics.task_completion_7d, metrics.task_failure_7d, metrics.task_total_7d, metrics.success_rate_7d, metrics.velocity_per_week, metrics.on_track, metrics.snapshot_date }`

**Known Issues:**

- MEDIUM: Does NOT accept Universal Request Envelope (operation/parameters) -- uses flat brand_id only
- MEDIUM: Hardcoded revenue_goal of 100000 in Calculate Metrics code -- should come from config/plan
- MEDIUM: Fetch Execution Stats fetches all logs from last 7 days without limit -- potential large result set
- MEDIUM: HTTP nodes chained sequentially (snapshot -> pipeline -> exec_log) but could run in parallel

**Implementation Notes:**

- All Supabase calls use predefinedCredentialType supabaseApi -- correct pattern
- Called by RDGR-THINKING for growth_experiment grounding

---

### RDGR-TOOL-SCORE
> MEDDPICC deal scoring tool: scores 8 sales methodology elements (0-2 each, max 16), classifies deal health (GREEN/YELLOW/RED), flags velocity risks, and provides top-3 actionable recommendations

- **Trigger:** Webhook: POST `/rdgr-tool-score`
- **Nodes:** 5

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deal` | `object` | **Yes** |  |
| `task_id` | `string` (default: `tool-score-{timestamp}`) | No |  |
| `brand_id` | `string` (default: `carlton`) | No |  |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ success, deal_name, meddpicc_scores, meddpicc_total, health, velocity_flags, recommendations, brand_id, task_id }`

**Known Issues:**

- MEDIUM: Does NOT accept Universal Request Envelope (operation/parameters) -- uses flat deal/brand_id/task_id fields

**Implementation Notes:**

- Parse Deal accepts both deal.identified and deal.economic_buyer_identified -- aliased input fields
- Parse Deal accepts both deal.discussed and deal.decision_criteria_discussed -- aliased input fields
- No external API calls or database writes -- pure computation workflow
- No token usage tracking needed (no LLM calls)

---

### RDGR-TOOL-SEQUENCE
> Email sequence scheduling tool: parses touchpoint sequence, upserts contact, stages in pipeline, logs to execution log, schedules first calendar event via RDGR-CALENDAR

- **Trigger:** Webhook: POST `/rdgr-tool-sequence`
- **Nodes:** 8

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task_id` | `string` (default: `tool-seq-{timestamp}`) | No |  |
| `brand_id` | `string` (default: `carlton`) | No |  |
| `prospect` | `object` | **Yes** |  |
| `sequence` | `array` | **Yes** |  |
| `start_date` | `string` (default: `today`) | No |  |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ success, task_id, brand_id, prospect, sequence_summary.total_steps, sequence_summary.start_date, sequence_summary.end_date, sequence_summary.channels, sequence_summary.touchpoints }`

**Known Issues:**

- HIGH: Writes directly to autonomous_contacts instead of using CRM-BRIDGE -- violates unified CRM architecture
- MEDIUM: Does NOT accept Universal Request Envelope (operation/parameters) -- uses flat prospect/sequence fields
- MEDIUM: Only schedules calendar event for FIRST touchpoint -- subsequent steps have no scheduling mechanism
- MEDIUM: Upsert uses resolution=merge-duplicates but autonomous_contacts may not have proper unique constraint for this

**Implementation Notes:**

- All Supabase calls use predefinedCredentialType supabaseApi -- correct pattern
- Calls RDGR-CALENDAR via internal webhook -- correct pattern

---

#### Journal

### RDGR-JOURNAL
> Daily execution journal - reads today's execution log and task stats from Supabase, generates reflective journal entry via GPT-4.1, upserts to rdgr_daily_journal

- **Trigger:** Schedule (cron)
- **Nodes:** ?

**Input:**

No input parameters (scheduled or parameterless).

**Output:**

- **Error:** `{ error }`
- **Success:** `{ date, journal, task_count, error_count, revenue_impact, domains_active, blockers_identified }`

**Implementation Notes:**

- Clean workflow, no anti-patterns detected
- Schedule: daily at 11:55 PM (55 23 * * *)
- Also has test webhook trigger at rdgr-journal
- Reads from autonomous_execution_log and autonomous_task_queue tables
- GPT-4.1 via OpenAI Responses API generates reflective first-person journal entry
- Parse Response correctly uses output.find(o => o.type === 'message') pattern
- Upserts to rdgr_daily_journal with on_conflict=date
- All Supabase calls use predefinedCredentialType supabaseApi correctly
- 9 nodes total (8 functional + 1 sticky note)
- Timezone set to America/New_York in settings (should ideally be America/Los_Angeles per Bradford's location)

---


## Section 3: Partnerships + Market Research + Council (13 workflows)

Partnership management pipeline, market niche research, and advisory council system.

#### Partnerships

### PRTN-RDGR-ROUTER
> RDGR domain router for partnerships - receives RDGR tasks, fetches brand config, routes by task_type to PRTN-001/002/003/004 via Switch

- **Trigger:** Webhook: POST `/rdgr-partnership`
- **Nodes:** 17
- **Calls:** `partnership-discover`, `partnership-outreach`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task_id` | `string` | No | Task tracking ID |
| `brand_id` | `string` | No | Brand identifier, defaults to carlton |
| `task_type` | `string` | **Yes** | discover|outreach|follow_up|dashboard|score|research |
| `parameters` | `object` | No | Task-type-specific parameters |

**Output:**

- **Error:** `{ success, error, task_id }`
- **Success:** `{ success, task_id, task_type, result, completed_at }`

**Branches:**

- `discover`: Calls PRTN-001 -> calls: PRTN-001
- `outreach`: Calls PRTN-002 -> calls: PRTN-002
- `dashboard`: Calls PRTN-004 -> calls: PRTN-004
- `follow_up`: Calls PRTN-003 -> calls: PRTN-003

**Implementation Notes:**

- Uses predefinedCredentialType: supabaseApi for brand config fetch - CORRECT pattern
- Switch node routes by task_type with fallback error response

---

### PRTN-INIT
> One-time partnership system initializer - creates Google Drive folder, Partnership_MasterDB spreadsheet with 8 tabs, seeds config and email templates

- **Trigger:** Webhook: POST `/partnership-init`
- **Nodes:** 3
- **Calls:** `drive-create-folders`, `create-google-sheet-v2`, `update-google-sheet`

**Input:**

No input parameters (scheduled or parameterless).

**Output:**

- **Error:** `{ error }`
- **Success:** `{ status, message, spreadsheetId, spreadsheetUrl, folderId, steps }`

**Known Issues:**

- MEDIUM: Uses this.helpers.httpRequest chains in Code node (5 sequential HTTP calls)

**Implementation Notes:**

- Uses Google Sheets as database (Partnership_MasterDB)
- Config seeds reference PRTN-ERR but errorWorkflow correctly points to ERR-UTIL
- 3 nodes, run-once initializer

---

### PRTN-001
> Partner discovery and research - accepts partner list, researches via Perplexity, scores via GPT-5.1, saves to Sheets + Supabase

- **Trigger:** Webhook: POST `/partnership-discover`
- **Nodes:** 13
- **Calls:** `update-google-sheet`, `supabase-query`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task_id` | `string` | No | Task tracking ID |
| `brand_id` | `string` | No | Brand identifier, defaults to carlton |
| `partners` | `array` | **Yes** | Array of {company_name, website?, industry?, notes?} |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ success, partners_processed, partners_added, partners_scored, errors, spreadsheet_id }`

**Branches:**

- `save`: Dual-write to Sheets + Supabase
- `score`: GPT-5.1 scoring per partner
- `research`: Perplexity research per partner

**Known Issues:**

- MEDIUM: Uses this.helpers.httpRequest chains extensively
- MEDIUM: Hardcoded spreadsheet ID in code

**Implementation Notes:**

- Uses Perplexity credential for research, OpenAI for scoring
- Dual-writes to Google Sheets and Supabase (partnership_partners, partnership_contacts)

---

### PRTN-002
> Outreach email engine - loads partner/contact/research data from Sheets, generates personalized email via GPT-5.1, sends via Gmail, logs to Sheets + Supabase + CRM

- **Trigger:** Webhook: POST `/partnership-outreach`
- **Nodes:** 12
- **Calls:** `update-google-sheet`, `rdgr-crm`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contact_id` | `string` | No | Contact ID, falls back to primary contact |
| `email_type` | `string` | No | Initial|Follow-Up-1|Follow-Up-2|Follow-Up-3|Follow-Up-4, defaults to Initial |
| `partner_id` | `string` | **Yes** | Partner ID from Partners sheet |

**Output:**

- **Error:** `{ success, error, message, data }`
- **Success:** `{ success, message, data }`

**Branches:**

- `send_email`: GPT generates email, Gmail sends, Sheets+Supabase+CRM log
- `rate_limit_exceeded`: IF daily count >= 20, returns error response

**Known Issues:**

- MEDIUM: Uses this.helpers.httpRequest for 5 Sheets reads in Load Partner Data
- MEDIUM: Hardcoded spreadsheet ID
- MEDIUM: CRM Log Outreach field name mismatch (snake_case vs camelCase)

**Implementation Notes:**

- Rate limit: 20 emails/day from ActivityLog tab
- Dual-writes: Sheets + Supabase + CRM interaction

---

### PRTN-003
> Daily follow-up scheduler and response tracker - checks Gmail threads for replies, updates Sheets + Supabase, sends due follow-ups via PRTN-002, emails daily summary

- **Trigger:** Schedule (cron)
- **Nodes:** 8
- **Calls:** `update-google-sheet`, `supabase-query`, `partnership-outreach`

**Input:**

No input parameters (scheduled or parameterless).

**Output:**

- **Error:** `{ error }`
- **Success:** `{ repliesFound, followUpsSent, errors, details, replyDetails, timestamp }`

**Branches:**

- `no_work`: IF no threads or follow-ups, sends minimal summary
- `has_work`: IF threadCheckCount > 0 OR followUpCount > 0, processes replies and follow-ups

**Known Issues:**

- MEDIUM: Process Replies and Follow-Ups uses this.helpers.httpRequest extensively
- MEDIUM: Hardcoded spreadsheet ID

**Implementation Notes:**

- Schedule: daily at 14:00 UTC (7am PDT), weekdays only
- Checks Gmail threads for replies by matching gmail_thread_id
- Max 5 follow-ups per partner (sequence_number tracking)

---

### PRTN-004
> Weekly partnership dashboard - gathers data from 11 spreadsheet tabs, calculates KPIs, GPT-4.1 generates executive summary, emails HTML report

- **Trigger:** Schedule (cron)
- **Nodes:** 6
- **Calls:** `update-google-sheet`

**Input:**

No input parameters (scheduled or parameterless).

**Output:**

- **Error:** `{ error }`
- **Success:** `{ htmlEmail, subject }`

**Known Issues:**

- MEDIUM: Gather All Data uses this.helpers.httpRequest to read 11 tabs sequentially (timeout risk)
- MEDIUM: Hardcoded spreadsheet ID

**Implementation Notes:**

- Schedule: Mondays at 13:00 UTC (6am PDT)
- Reads: Partners, Contacts, Outreach, Research, ActivityLog, Pipeline, Onboarding, Commissions, Conflicts, Scorecards, TierConfig
- GPT-4.1 generates HTML executive summary
- Emails to bradford@bradfordcarlton.com

---

#### Market Research

### MKTRES-BRIDGE
> Market research bridge router - routes task_type to MKTRES-DISCOVER/VALIDATE/SCORE/PRESENT, handles activate_niche and get_status inline

- **Trigger:** Webhook: POST `/mktres-bridge`
- **Nodes:** 13
- **Calls:** `mktres-discover`, `mktres-validate`, `mktres-score`, `mktres-present`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `payload` | `object` | No | Operation-specific payload, passed to downstream workflow |
| `task_id` | `string` | No | Task tracking ID |
| `task_type` | `string` | **Yes** | discover_niches|validate_niche|score_niches|present_results|activate_niche|get_status |

**Output:**

- **Error:** `{ success, error, valid_types }`
- **Success:** `{ success, task_id, task_type, result, completed_at }`

**Branches:**

- `score`: Calls MKTRES-SCORE -> calls: MKTRES-SCORE
- `status`: Inline GET from market_research_niches
- `present`: Calls MKTRES-PRESENT -> calls: MKTRES-PRESENT
- `activate`: Inline PATCH to market_research_niches (activates niche for prospecting)
- `discover`: Calls MKTRES-DISCOVER -> calls: MKTRES-DISCOVER
- `validate`: Calls MKTRES-VALIDATE -> calls: MKTRES-VALIDATE

**Known Issues:**

- CRITICAL: Hardcoded Supabase key in Activate Niche and Get Status nodes - must use predefinedCredentialType: supabaseApi

**Implementation Notes:**

- Switch node v3.2 with 6 routes + fallback

---

### MKTRES-DISCOVER
> Niche discovery - AI-generates or manually adds niche candidates to market_research_niches table

- **Trigger:** Webhook: POST `/mktres-discover`
- **Nodes:** 15

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | `string` | No | ai_generate (default) or manual_add |
| `name` | `string` | No | Niche name (required for manual_add) |
| `count` | `number` | No | Number of niches to generate, defaults to 15 |
| `criteria` | `object` | No | Custom criteria with focus field for AI discovery |
| `description` | `string` | No | Niche description (for manual_add) |

**Output:**

- **Error:** `{ success, message, existing_status }`
- **Success:** `{ success, mode, batch_id, candidates_created, niches }`

**Branches:**

- `manual_add`: Checks if niche exists, inserts if not
- `ai_generate`: Fetches existing niches, builds GPT-5.1 prompt excluding them, parses response, inserts candidates

**Known Issues:**

- CRITICAL: Hardcoded Supabase key in 5 HTTP Request nodes - must use predefinedCredentialType: supabaseApi

**Implementation Notes:**

- GPT-5.1 for niche generation with JSON response format
- Dedup: checks existing niches before insert

---

### MKTRES-VALIDATE
> Niche validation - researches 5 dimensions (market_size, competition, pricing, acquisition_cost, ai_readiness) via RDGR-RESEARCH, extracts structured data via GPT-5-nano, updates niche record

- **Trigger:** Webhook: POST `/mktres-validate`
- **Nodes:** 14
- **Calls:** `rdgr-research`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `niche_id` | `string` | No | Niche ID to validate |
| `niche_name` | `string` | No | Niche name to validate (alternative to niche_id) |

**Output:**

- **Error:** `{ error, message }`
- **Success:** `{ success, niche_id, status, dimensions_researched }`

**Branches:**

- `research_loop`: SplitInBatches loops 5 research queries through RDGR-RESEARCH with 3s delay

**Known Issues:**

- CRITICAL: Hardcoded Supabase key in 3 HTTP Request nodes - must use predefinedCredentialType: supabaseApi

**Implementation Notes:**

- Uses SplitInBatches with Wait 3s for rate limiting research calls
- GPT-5-nano for structured data extraction (cheap model for parsing)
- Sets niche status: candidate -> researching -> validated

---

### MKTRES-SCORE
> Niche scoring engine - fetches validated niches, scores across 5 dimensions with configurable weights, updates scores to Supabase, returns ranked list

- **Trigger:** Webhook: POST `/mktres-score`
- **Nodes:** 8

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `weights` | `object` | No | Custom scoring weights {market_size, competition, pricing, acquisition, ai_readiness} summing to 100 |
| `niche_id` | `string` | No | Score single niche (if null, scores all validated/pending_review niches) |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ success, total_scored, rankings, top_niche }`

**Branches:**

- `score_loop`: SplitInBatches updates each niche score to Supabase individually

**Known Issues:**

- CRITICAL: Hardcoded Supabase key in 2 HTTP Request nodes - must use predefinedCredentialType: supabaseApi

**Implementation Notes:**

- Algorithmic scoring (no AI): parseNumeric handles billions/millions/thousands
- Default weights: ai_readiness 30, market_size 20, pricing 20, competition 15, acquisition 15
- Sets status to pending_review after scoring

---

### MKTRES-PRESENT
> Results presentation - fetches scored niches, creates Google Spreadsheet with rankings + top-5 detail sheets, creates Google Slides deck, patches artifact URLs back to niches

- **Trigger:** Webhook: POST `/mktres-present`
- **Nodes:** 11
- **Calls:** `create-google-sheet-v2`, `create-google-slides`

**Input:**

No input parameters (scheduled or parameterless).

**Output:**

- **Error:** `{ error }`
- **Success:** `{ success, artifacts, niches_included, message }`

**Branches:**

- `update_loop`: SplitInBatches patches spreadsheet_url and slides_url back to each niche record

**Known Issues:**

- CRITICAL: Hardcoded Supabase key in 2 HTTP Request nodes - must use predefinedCredentialType: supabaseApi

**Implementation Notes:**

- Creates spreadsheet with Rankings tab + up to 5 detail tabs (one per top niche)
- Creates slides deck with title, rankings, per-niche details, and recommendation
- Output folder: 1VYEMANNEfT5XKxfFWoka5icnT1IM2ldN

---

#### Advisory Council

### RDGR-COUNCIL
> Advisory council orchestrator - loads advisors from Supabase, fans out to COUNCIL-SESSION per advisor, synthesizes all opinions via GPT-5.1, stores session. Also supports get_session and list_sessions.

- **Trigger:** Webhook: POST `/rdgr-council`
- **Nodes:** 20
- **Calls:** `council-session`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | `number` | No | For list_sessions, defaults to 20 |
| `offset` | `number` | No | For list_sessions pagination |
| `question` | `string` | **Yes** | Question for the advisory council |
| `research` | `boolean` | No | If true, each advisor gets RDGR-RESEARCH context |
| `operation` | `string` | No | convene_council (default)|get_session|list_sessions |
| `session_id` | `string` | No | For get_session operation |
| `advisor_names` | `array` | No | Array of advisor names to consult (null = all default advisors) |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ success, domain, operation, session_id, question, advisor_count, responses, synthesis, status }`

**Branches:**

- `get_session`: Fetch single session by ID from council_sessions
- `list_sessions`: Fetch paginated session list from council_sessions
- `convene_council`: Load advisors -> create session -> fan out to COUNCIL-SESSION -> collect -> synthesize -> update session -> calls: COUNCIL-SESSION

**Implementation Notes:**

- Clean implementation - uses predefinedCredentialType: supabaseApi for all Supabase calls
- Fan-out pattern: HTTP Request node with batching (batchSize:1, 1s interval) calls COUNCIL-SESSION per advisor
- GPT-5.1 synthesis identifies consensus, disagreements, strongest argument, overall recommendation
- Switch v3 with fallbackOutput: none (unmatched operations silently drop)
- Supabase tables: council_advisors, council_sessions

---

### COUNCIL-SESSION
> Single advisor session - receives question + advisor config, optionally researches via RDGR-RESEARCH, generates advisor opinion via GPT-5.1 with JSON response

- **Trigger:** Webhook: POST `/council-session`
- **Nodes:** 10
- **Calls:** `rdgr-research`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `advisor` | `object` | **Yes** | Advisor object with name, expertise, system_prompt fields |
| `question` | `string` | **Yes** | Question to ask the advisor |
| `research` | `boolean` | No | If true, calls RDGR-RESEARCH for context before asking advisor |
| `session_id` | `string` | No | Session ID for tracking |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ advisor_name, expertise, opinion, key_points, recommendation, confidence, dissenting_note, research_used }`

**Branches:**

- `research_path`: IF research=true, calls RDGR-RESEARCH then merges results -> calls: RDGR-RESEARCH
- `skip_research`: IF research=false, passes through directly

**Implementation Notes:**

- Clean implementation - no hardcoded keys, uses OpenAI credential properly
- GPT-5.1 with JSON response format for structured advisor opinions
- Called by RDGR-COUNCIL (one call per advisor)

---


## Section 4: Content + Safety + Other (7 workflows)

Copywriting approval pipeline, style learning, knowledge management, contact import, safety infrastructure, and long-form writing.

#### Copywriting Pipeline

### COPYWRITE-REVIEW
> AI compliance and quality review gate for copy drafts -- GPT checks HR/legal/quality/voice/CTA issues, auto-revises up to 2x, then escalates to human

- **Trigger:** Webhook: POST `/copywrite-review`
- **Nodes:** 18
- **Tables Written:** `copy_drafts`, `directive_tasks`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brand_id` | `string` (default: `carlton`) | No | Brand identifier |
| `draft_id` | `string` | **Yes** | ID of the copy draft in copy_drafts table |

**Output:**

- **Error:** `{ error }`
- **Success:** `{ success, draft_id, action, message, issues_found }`

**Branches:**

- `auto_revision`: Draft fails review but revision_count < 2, calls COPYWRITE-GENERATE with auto_feedback -> calls: COPYWRITE-GENERATE
- `review_passed`: Draft passes GPT review, creates human approval task, sets status to pending_human
- `flagged_for_human`: Draft fails review and max auto-revisions reached, creates human review task

**Known Issues:**

- MEDIUM: Direct directive_tasks INSERT in 2 nodes - should use Human Task utility

**Implementation Notes:**

- Uses gpt-5-nano for review with temperature 0.1
- Review checks 5 dimensions: HR issues, legal issues, quality issues, voice match, CTA quality

---

### COPYWRITE-APPROVE
> Human approval flow for AI-generated copy drafts with 3-action routing, destination-aware activation, and style learning feedback loop

- **Trigger:** Webhook: POST `/copywrite-approve`
- **Nodes:** 24
- **Tables Written:** `copy_drafts`, `directive_tasks`, `cold_outreach_templates`, `crm_sequence_steps`, `social_content_queue`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | `approve` / `request_edits` / `reject` | **Yes** | Approval action to take |
| `brand_id` | `string` (default: `carlton`) | No | Brand identifier |
| `draft_id` | `string` | **Yes** | ID of the copy draft in copy_drafts table |
| `feedback` | `string` | No | Human feedback text for revisions |

**Output:**

- **Error:** `{ error, message }`
- **Success:** `{ success, draft_id, action, message }`

**Branches:**

- `reject`: Updates draft to rejected, marks task completed, triggers STYLE-LEARNER -> calls: STYLE-LEARNER
- `approve`: Updates draft status to approved, activates copy to destination, marks task completed, triggers STYLE-LEARNER -> calls: STYLE-LEARNER
- `request_edits`: Updates draft to revision_requested, checks max revisions (<3), calls COPYWRITE-GENERATE for auto-revision -> calls: COPYWRITE-GENERATE

**Known Issues:**

- MEDIUM: Direct directive_tasks PATCH in 3 nodes - should use Human Task utility

**Implementation Notes:**

- Switch by Destination has 4 outputs: cold_outreach_templates, crm_sequence_steps, social_content_queue, and skip/none

---

### STYLE-LEARNER
> Extracts reusable writing style rules from human feedback/edits on copy drafts, with confidence scoring and graduation tracking

- **Trigger:** Webhook: POST `/style-learner`
- **Nodes:** 12
- **Tables Read:** `voice_learned_rules`
- **Tables Written:** `voice_learned_rules`, `voice_feedback_log`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | `string` | No | The approval action taken (approve/request_edits/reject) |
| `purpose` | `string` | No | Copy purpose (awareness, lead_gen, nurture, conversion, retention) |
| `brand_id` | `string` (default: `carlton`) | No | Brand identifier |
| `draft_id` | `string` | No | ID of the copy draft |
| `platform` | `string` | No | Target platform (twitter, linkedin, email, etc.) |
| `copy_type` | `string` | No | Type of copy (cold_email_sequence, blog_post, social_post, etc.) |
| `product_id` | `string` | No | Product identifier if applicable |
| `edited_content` | `string` | No | Human-edited version (truncated to 2000 chars) |
| `human_feedback` | `string` | No | Explicit feedback text from human reviewer |
| `original_content` | `string` | **Yes** | Original copy content (truncated to 2000 chars) |

**Output:**

- **Skipped:** `{ success, learned, skipped, reason }`
- **Success:** `{ success, rules_extracted, rules_new, rules_reinforced, persist_inserted, persist_updated, persist_errors, graduated_count, graduated_rules }`

**Branches:**

- `skip`: Pure approve with no edits or feedback -- nothing to learn, returns immediately
- `learn`: Extracts rules via GPT, deduplicates against existing, persists new/reinforced rules, logs feedback, checks graduation

**Known Issues:**

- MEDIUM: Persist Rules node uses this.helpers.httpRequest to call Supabase Query utility

**Implementation Notes:**

- Rules capped at 5 per event, confidence clamped to 0.3-0.9 range
- Graduation criteria: confidence >= 0.9, reinforced 3+ times
- GPT extracts rules across 6 categories: tone, structure, vocabulary, format, content, platform

---

#### Knowledge Management

### KM-DRAFT
> Knowledge management drafting - takes user suggestion for claude_knowledge or system_registry entry, generates AI draft via GPT-5.1 Responses API with structured JSON output

- **Trigger:** Webhook: POST `/knowledge-manager-draft`
- **Nodes:** 10
- **Tables Read:** `claude_knowledge`
- **Tables Written:** `km_conversations`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `table` | `claude_knowledge` / `system_registry` | **Yes** | Target table to edit |
| `action` | `draft_update` | **Yes** | Action type (only draft_update supported) |
| `item_id` | `string` | **Yes** | ID of the entry to edit |
| `chat_history` | `array` | No | Previous conversation messages [{role, content}] |
| `user_profile` | `object` | No | User profile with id and name fields |
| `current_content` | `string` | **Yes** | Current content of the entry |
| `user_suggestion` | `string` | **Yes** | Human suggestion for what to change |

**Output:**

- **Error:** `{ success, error, agent_message }`
- **Success:** `{ success, draft, agent_message }`

**Branches:**

- `valid`: Input validated, fetches table-specific prompt, calls GPT-5.1, saves conversation
- `invalid`: Validation failed, returns 400 with error details

**Implementation Notes:**

- Uses OpenAI Responses API (v1/responses) with json_schema structured output
- Correctly uses .find(o => o.type === 'message') for Responses API format
- Conversation save happens AFTER webhook response (async)

---

#### Contact Import

### CONTACT-IMPORT
> Bulk contact import via JSON payload or Google Sheets URL with field normalization, dedup, and async callback support

- **Trigger:** Webhook: POST `/contact-import`
- **Nodes:** 21
- **Tables Written:** `unified_contacts`, `autonomous_execution_log`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `leads` | `array` | No | Array of lead objects with flexible field names (business_name/company, email/email_address, etc.) |
| `source` | `string` (default: `manual_import`) | No | Acquisition source for imported contacts |
| `brand_id` | `string` (default: `carlton`) | No | Brand identifier |
| `contacts` | `array` | No | Alias for leads array |
| `sheet_name` | `string` (default: `Sheet1`) | No | Sheet tab name when using sheets_url mode |
| `sheets_url` | `string` | No | Google Sheets URL to import from (alternative to JSON leads) |
| `callback_webhook` | `string` | No | Webhook path to call with import results when complete |

**Output:**

- **Error:** `{ error, import_id }`
- **Success:** `{ success, import_id, mode, count, message }`

**Branches:**

- `callback`: If callback_webhook provided, fires POST to n8n webhook with import results -> calls: (dynamic callback)
- `json_mode`: Leads provided inline as JSON array, normalizes field names, sends to CRM bulk import RPC -> calls: supabase-query
- `sheets_mode`: Reads leads from Google Sheet via update-google-sheet utility, parses response, then normalizes and imports -> calls: update-google-sheet, supabase-query

**Implementation Notes:**

- Field normalization supports 13 field types with multiple aliases each
- Uses crm_bulk_import_v2 RPC for dedup-aware import into unified_contacts
- Minimum viable contact: at least one of business_name, email, or phone required
- Logs both success and skip results to autonomous_execution_log

---

#### Safety Infrastructure

### RDGR-AUTOFIX
> Circuit breaker and diagnostic reporter -- analyzes error patterns, deactivates non-protected workflows, sends diagnostic email with Claude Code fix prompt

- **Trigger:** Webhook: POST `/rdgr-autofix`
- **Nodes:** 22
- **Tables Read:** `system_registry`
- **Tables Written:** `system_registry`, `autonomous_execution_log`
- **Thresholds:** long_window: 20 errors in 24 hours, short_window: 5 errors in 15 minutes
- **Protected IDs:** `os8mqybvR2AyGw2U`, `ofsMJAjxDwbrLeOF`, `o7sItu0Gy6CuRdch`, `kcJaA19TcwT0FuHA`
- **External APIs:** n8n API (executions list, workflow deactivate), Gmail API (send alert email)

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | `string` | No | RDGR domain of the workflow |
| `task_id` | `string` | No | Associated task ID if applicable |
| `brand_id` | `string` (default: `carlton`) | No | Brand identifier |
| `severity` | `string` (default: `structural`) | No | Error severity level |
| `error_node` | `string` | No | Name of the node that failed |
| `error_type` | `string` | No | Error classification (e.g., timeout, connection, syntax) |
| `workflow_id` | `string` | **Yes** | n8n workflow ID that errored |
| `execution_id` | `string` | No | n8n execution ID of the error |
| `error_message` | `string` | **Yes** | Error message text |
| `workflow_name` | `string` | No | Human-readable workflow name |
| `reporting_workflow` | `string` | No | Name of the workflow that forwarded this error (usually ERR-UTIL) |

**Output:**

- **Success:** `{ success, workflow_id, action, short_errors, long_errors, is_protected }`

**Branches:**

- `below_threshold`: Error count below thresholds -- logs error and returns monitoring status
- `protected_alert`: Error threshold exceeded on protected workflow -- sends alert email but does NOT deactivate
- `circuit_breaker_trip`: Error threshold exceeded -- deactivates workflow, updates system_registry to status:broken, sends diagnostic email

**Known Issues:**

- CRITICAL: errorWorkflow set to ERR-UTIL is CIRCULAR -- must be removed

**Implementation Notes:**

- Uses n8n API with predefinedCredentialType n8nApi for execution history and workflow deactivation
- Diagnostic email includes Claude Code prompt for investigating the broken workflow
- Read-merge-patch pattern used correctly for system_registry metadata updates

---

#### Long-Form Writing

### RDGR-TOOL-LONG-WRITE
> Two-pass long-form article generation -- outline via gpt-5-mini, full article via gpt-5.1, with token usage logging for cost tracking

- **Trigger:** Webhook: POST `/rdgr-tool-long-write`
- **Nodes:** 12
- **Tables Written:** `autonomous_token_usage`

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | No | Article title (alias for topic) |
| `topic` | `string` | No | Article topic (falls back to title, then AI automation) |
| `task_id` | `string` | No | Task ID for token logging attribution |
| `brand_id` | `string` (default: `carlton`) | No | Brand identifier for token logging |
| `word_count` | `number` (default: `2000`) | No | Target word count for the article |
| `system_prompt` | `string` | **Yes** | System prompt defining voice, style, and expertise for the article |

**Output:**

- **Success:** `{ success, task_type, result, model_used }`
  - `result` contains: `{ content, word_count, title, meta_description, cta }`

**Branches:**

- `linear`: Single linear pipeline: parse input -> outline (gpt-5-mini) -> log tokens -> article (gpt-5.1) -> log tokens -> format response

**Known Issues:**

- MEDIUM: Build Article Prompt reads output[0].content[0].text which may be reasoning block
- MEDIUM: Format Response also reads output[0] with same issue

**Implementation Notes:**

- Uses OpenAI Responses API with json_object format for both outline and article
- Token cost tracking with COST_TABLE covering gpt-5.1, gpt-5-mini, sonar-pro

---

