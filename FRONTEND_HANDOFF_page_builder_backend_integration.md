# Frontend Handoff: Backend Endpoints for Page Builder Integration

**From:** Backend Developer (n8n / Agentic Workflows)
**To:** Frontend Developer (Claude Built Websites)
**Date:** 2026-03-25
**Status:** All endpoints LIVE and ready for integration

---

## Overview

Three new webhook endpoints are ready for published pages to connect to:

| Endpoint | URL | Purpose |
|----------|-----|---------|
| **PAGE-FORM** | `https://n8n.carltonaiservices.com/webhook/page-form` | All form submissions (lead, checkout, upsell, downsell) |
| **PAGE-TRACK** | `https://n8n.carltonaiservices.com/webhook/page-track` | Tracking pixel events (page views, scroll, clicks) |
| **STRIPE-HOOK** | `https://n8n.carltonaiservices.com/webhook/stripe-events` | Stripe webhook events (configure in Stripe dashboard) |

All endpoints accept **POST** with **JSON body** and return JSON responses.

---

## 1. PAGE-FORM — Form Submission Endpoint

**URL:** `https://n8n.carltonaiservices.com/webhook/page-form`
**Method:** POST
**Content-Type:** application/json

This is the single endpoint for ALL form types. Set `data-endpoint` on every form block to this URL. The `data_type` field in the payload tells the backend how to process it.

### 1.1 Lead Capture (`data_type: "lead"`)

**When:** User submits an email capture / lead magnet form.

**Payload:**
```json
{
  "data_type": "lead",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "555-1234",
  "page_url": "https://offers.bradfordcarlton.com/free-guide",
  "funnel_session_id": "uuid-from-localstorage",
  "brand_id": "carlton",
  "data_sequence": "seq_lead_magnet_nurture",
  "redirect_url": "/sales-page"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `data_type` | Yes | Must be `"lead"` (or omit — defaults to lead) |
| `email` | Yes | Contact email |
| `first_name` | Yes | |
| `last_name` | No | |
| `phone` | No | |
| `page_url` | No | Current page URL for attribution |
| `funnel_session_id` | Yes | UUID from localStorage (see Section 4) |
| `brand_id` | No | Defaults to `"carlton"` |
| `data_sequence` | No | Sequence ID to auto-enroll contact (see Section 5) |
| `redirect_url` | No | Where to redirect after success |

**Response (success):**
```json
{
  "success": true,
  "redirect_url": "/sales-page"
}
```

**What happens on the backend:**
1. Contact upserted in CRM (deduped by email)
2. If `data_sequence` provided, contact enrolled in that email sequence
3. Contact tagged with `acquisition_source: "page_form"`

---

### 1.2 Checkout (`data_type: "checkout"`)

**When:** User submits the checkout form with payment details.

**IMPORTANT: Stripe.js Required.** The frontend MUST tokenize card details into a `payment_method_id` using Stripe.js before sending. **Never send raw card numbers.** Use Stripe's publishable key to create the PaymentMethod client-side.

**Payload:**
```json
{
  "data_type": "checkout",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "555-1234",
  "payment_method_id": "pm_1234567890abcdef",
  "amount_cents": 4999,
  "offer_id": "OFF_260325120000",
  "order_bump": true,
  "order_bump_amount_cents": 1999,
  "ship_address": "123 Main St",
  "ship_city": "Las Vegas",
  "ship_state": "NV",
  "ship_zip": "89101",
  "billing_same": true,
  "funnel_session_id": "uuid-from-localstorage",
  "brand_id": "carlton",
  "redirect_url": "/upsell-1"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `data_type` | Yes | Must be `"checkout"` |
| `email` | Yes | |
| `first_name` | Yes | |
| `last_name` | Yes | |
| `payment_method_id` | Yes | From Stripe.js `stripe.createPaymentMethod()` |
| `amount_cents` | Yes | Base price in cents (e.g., 4999 = $49.99) |
| `offer_id` | Yes | The offer being purchased |
| `order_bump` | No | `true` if order bump checkbox checked |
| `order_bump_amount_cents` | No | Additional cents for order bump |
| `ship_address`, `ship_city`, `ship_state`, `ship_zip` | No | Shipping address |
| `billing_same` | No | `true` = billing matches shipping |
| `bill_address`, `bill_city`, `bill_state`, `bill_zip` | No | Only if `billing_same` is not `true` |
| `funnel_session_id` | Yes | For linking checkout → upsell flow |
| `redirect_url` | No | Where to go on success (e.g., upsell page) |

**Response (success):**
```json
{
  "success": true,
  "redirect_url": "/upsell-1",
  "order_id": "PUR_260325120000"
}
```

**Response (failure — e.g., card declined):**
```json
{
  "success": false,
  "error": "Your card was declined."
}
```

**What happens on the backend:**
1. Stripe Customer created (with email + payment method attached)
2. Stripe PaymentIntent created and confirmed (amount = base + order bump)
3. Purchase recorded in `offer_purchases` table
4. Funnel session updated with Stripe customer/payment method IDs (for upsells)

---

### 1.3 Upsell/Downsell Accept (`data_type: "upsell"` or `"downsell"`, `action: "accept"`)

**When:** User clicks "Yes" on an upsell/downsell offer.

**No card re-entry needed.** The backend charges the payment method stored during checkout.

**Payload:**
```json
{
  "data_type": "upsell",
  "action": "accept",
  "amount_cents": 2999,
  "offer_id": "OFF_UPSELL_001",
  "funnel_session_id": "uuid-from-localstorage",
  "redirect_url": "/confirmation"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `data_type` | Yes | `"upsell"` or `"downsell"` |
| `action` | Yes | `"accept"` |
| `amount_cents` | Yes | Upsell price in cents |
| `offer_id` | No | Offer being upsold |
| `funnel_session_id` | Yes | Must match the checkout session |
| `redirect_url` | No | Next page |

**Response:**
```json
{
  "success": true,
  "redirect_url": "/confirmation"
}
```

---

### 1.4 Upsell/Downsell Decline (`action: "decline"`)

**When:** User clicks "No Thanks" on an upsell/downsell.

**Payload:**
```json
{
  "data_type": "upsell",
  "action": "decline",
  "funnel_session_id": "uuid-from-localstorage",
  "redirect_url": "/downsell"
}
```

**Response:**
```json
{
  "success": true,
  "redirect_url": "/downsell"
}
```

No charge is made. The backend just logs the decline.

---

## 2. PAGE-TRACK — Tracking Pixel Endpoint

**URL:** `https://n8n.carltonaiservices.com/webhook/page-track`
**Method:** POST
**Recommended transport:** `navigator.sendBeacon()` (non-blocking)

### 2.1 Event Types

| Event | When to Fire | Key Fields |
|-------|-------------|------------|
| `page_view` | On page load | `page_url`, `referrer`, UTM params, `screen_width` |
| `scroll_depth` | At 25%, 50%, 75%, 100% milestones | `depth_percent`, `time_on_page_seconds` |
| `element_click` | On button/link clicks | `element_type`, `element_text`, `element_data_module` |
| `funnel_step` | On funnel page transitions | `step`, `step_number`, `previous_step` |
| `cta_click` | CTA button clicked | `element_text` |
| `form_submit` | Form submitted (before redirect) | |
| `bounce` | On page exit without interaction | `time_on_page_seconds` |

### 2.2 Payload Format

**Page view:**
```json
{
  "event": "page_view",
  "page_id": "PAGE_260322080344",
  "page_url": "https://offers.bradfordcarlton.com/free-guide",
  "funnel_session_id": "uuid-from-localstorage",
  "referrer": "https://google.com/search?q=...",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "spring-sale",
  "user_agent": "Mozilla/5.0...",
  "screen_width": 1920,
  "timestamp": "2026-03-25T18:30:00.000Z"
}
```

**Scroll depth:**
```json
{
  "event": "scroll_depth",
  "page_id": "PAGE_260322080344",
  "page_url": "https://offers.bradfordcarlton.com/free-guide",
  "funnel_session_id": "uuid-from-localstorage",
  "depth_percent": 75,
  "max_depth_percent": 75,
  "time_on_page_seconds": 45,
  "timestamp": "2026-03-25T18:30:45.000Z"
}
```

**Element click:**
```json
{
  "event": "element_click",
  "page_id": "PAGE_260322080344",
  "page_url": "https://offers.bradfordcarlton.com/free-guide",
  "funnel_session_id": "uuid-from-localstorage",
  "element_type": "button",
  "element_text": "Get Your Free Guide",
  "element_data_module": "form",
  "timestamp": "2026-03-25T18:31:00.000Z"
}
```

**Funnel step:**
```json
{
  "event": "funnel_step",
  "page_id": "PAGE_260322080344",
  "page_url": "https://offers.bradfordcarlton.com/checkout",
  "funnel_session_id": "uuid-from-localstorage",
  "step": "checkout",
  "step_number": 2,
  "previous_step": "sales-page",
  "timestamp": "2026-03-25T18:32:00.000Z"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `event` | Yes | Event type (see table above) |
| `page_id` | Yes | The `page_id` from the page's metadata (matches `landing_pages.page_id`) |
| `page_url` | Yes | Full URL of the page |
| `funnel_session_id` | Yes | UUID from localStorage |
| `timestamp` | Yes | ISO 8601 timestamp |
| Other fields | Varies | See examples above |

**Response:** `{"success": true}` (200 OK). The frontend should fire-and-forget with `sendBeacon`.

### 2.3 Recommended Frontend Implementation

```javascript
// tracking.js — auto-injected into every published page
(function() {
  const TRACK_URL = 'https://n8n.carltonaiservices.com/webhook/page-track';
  const pageId = document.querySelector('meta[name="page-id"]')?.content || '';
  const sessionId = localStorage.getItem('funnel_session_id')
    || (localStorage.setItem('funnel_session_id', crypto.randomUUID()),
        localStorage.getItem('funnel_session_id'));

  function track(event, extra) {
    const data = {
      event,
      page_id: pageId,
      page_url: window.location.href,
      funnel_session_id: sessionId,
      timestamp: new Date().toISOString(),
      ...extra
    };
    navigator.sendBeacon(TRACK_URL, new Blob([JSON.stringify(data)], {type: 'text/plain'}));
  }

  // Page view
  track('page_view', {
    referrer: document.referrer,
    utm_source: new URLSearchParams(location.search).get('utm_source'),
    utm_medium: new URLSearchParams(location.search).get('utm_medium'),
    utm_campaign: new URLSearchParams(location.search).get('utm_campaign'),
    user_agent: navigator.userAgent,
    screen_width: screen.width
  });

  // Scroll depth
  let maxScroll = 0;
  const milestones = [25, 50, 75, 100];
  const firedMilestones = new Set();
  window.addEventListener('scroll', () => {
    const pct = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
    if (pct > maxScroll) maxScroll = pct;
    milestones.forEach(m => {
      if (pct >= m && !firedMilestones.has(m)) {
        firedMilestones.add(m);
        track('scroll_depth', {
          depth_percent: m,
          max_depth_percent: maxScroll,
          time_on_page_seconds: Math.round((Date.now() - performance.timing.navigationStart) / 1000)
        });
      }
    });
  });

  // Element clicks
  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, a, [data-module]');
    if (!el) return;
    track('element_click', {
      element_type: el.tagName.toLowerCase(),
      element_text: el.textContent?.trim().slice(0, 100),
      element_data_module: el.closest('[data-module]')?.dataset.module || ''
    });
  });

  window.__track = track; // expose for manual funnel_step calls
})();
```

**Usage note:** Use `text/plain` Content-Type (not `application/json`) to avoid CORS preflight with `sendBeacon`. The backend handles both.

---

## 3. STRIPE-HOOK — Stripe Webhook (Backend-Only)

**URL:** `https://n8n.carltonaiservices.com/webhook/stripe-events`

This is configured in the **Stripe Dashboard** (not called by frontend code). Set it up under:
- Stripe Dashboard → Developers → Webhooks → Add Endpoint
- URL: `https://n8n.carltonaiservices.com/webhook/stripe-events`
- Events to listen for:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.refunded`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

The backend logs all events to `stripe_events` table, then:
- Payment events: Updates `offer_purchases.payment_status`
- Subscription events: Updates `unified_contacts.subscription_status`

---

## 4. Session Tracking (funnel_session_id)

The frontend must generate and propagate a `funnel_session_id` through the entire funnel. This is how the backend links lead capture → checkout → upsell into one purchase session.

### Rules

1. **On first page load:** Generate a UUID and store in `localStorage`:
   ```javascript
   if (!localStorage.getItem('funnel_session_id')) {
     localStorage.setItem('funnel_session_id', crypto.randomUUID());
   }
   ```

2. **On every form POST:** Include `funnel_session_id` in the JSON payload.

3. **On every redirect:** Append `?sid={funnel_session_id}` to the URL. On the next page, if `sid` is in the URL, store it in localStorage (supports cross-subdomain funnels).

4. **Backend uses it to:** Look up stored Stripe customer/payment method for upsell charges.

---

## 5. Email Sequence IDs

When a form has a `data-sequence` attribute (or `data_sequence` in the payload), the backend enrolls the contact in that email sequence.

Sequences are stored in the `crm_email_sequences` table. Use the `sequence_id` value:

| Suggested Sequence ID | Trigger | Description |
|----------------------|---------|-------------|
| `seq_lead_magnet_nurture` | Lead form submission | Education → soft sell |
| `seq_webinar_reminder` | Webinar registration | Event reminder → replay → offer |
| `seq_post_purchase` | Checkout completed | Receipt → onboarding → usage tips |
| `seq_upsell_onboarding` | Upsell accepted | Premium onboarding |
| `seq_downsell_recovery` | Upsell declined | Second chance → downsell offer |
| `seq_abandoned_cart` | Checkout started, not completed | Cart recovery (future) |

**Note:** These sequence IDs need to be created in the `crm_email_sequences` table with their step definitions. The enrollment webhook is ready; the sequences themselves need content.

---

## 6. Stripe.js Integration

The checkout form MUST use Stripe.js to tokenize card details client-side. Here's how:

### Setup

Add to the checkout page `<head>`:
```html
<script src="https://js.stripe.com/v3/"></script>
```

### Tokenize Card

```javascript
const stripe = Stripe('pk_test_XXXXXXXXXXXXXXXXXXXXXXXX'); // publishable key
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

// On form submit:
async function handleCheckout(formData) {
  const { paymentMethod, error } = await stripe.createPaymentMethod({
    type: 'card',
    card: cardElement,
    billing_details: {
      name: formData.first_name + ' ' + formData.last_name,
      email: formData.email,
    }
  });

  if (error) {
    showError(error.message);
    return;
  }

  // Send to PAGE-FORM with payment_method_id instead of raw card data
  const response = await fetch('https://n8n.carltonaiservices.com/webhook/page-form', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data_type: 'checkout',
      payment_method_id: paymentMethod.id,
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      amount_cents: formData.amount_cents,
      offer_id: formData.offer_id,
      funnel_session_id: localStorage.getItem('funnel_session_id'),
      redirect_url: '/upsell-1',
      // ... other fields
    })
  });

  const result = await response.json();
  if (result.success) {
    window.location.href = result.redirect_url;
  } else {
    showError(result.error);
  }
}
```

**Stripe publishable key:** Ask Bradford for the test/live publishable keys. The backend uses the secret key (already configured).

---

## 7. Supabase Tables (Reference)

These tables exist and are used by the backend. The frontend may read from them for display purposes (e.g., order confirmation page).

### `funnel_sessions` (NEW)
```
session_id      TEXT UNIQUE     -- the funnel_session_id from localStorage
email           TEXT
stripe_customer_id TEXT
current_step    TEXT            -- 'checkout_complete', etc.
cart_total_cents INTEGER
status          TEXT            -- 'active', 'completed', 'abandoned', 'expired'
metadata        JSONB
```

### `offer_purchases` (existing, expanded)
```
purchase_id                 TEXT UNIQUE     -- 'PUR_260325120000'
offer_id                    TEXT            -- references offers table
customer_email              TEXT
amount_cents                INTEGER
stripe_payment_intent_id    TEXT
payment_status              TEXT            -- 'pending', 'completed', 'refunded', 'failed'
funnel_session_id           TEXT            -- links to funnel_sessions
line_items                  JSONB           -- [{offer_id, amount_cents}]
shipping_address            JSONB
billing_address             JSONB
order_bumps                 JSONB           -- [{amount_cents}]
upsells                     JSONB           -- [{purchase_id, amount_cents}]
```

### `landing_page_events` (existing, expanded)
```
page_id         TEXT            -- references landing_pages.page_id
event_type      TEXT            -- page_view, scroll_25, scroll_50, scroll_75, scroll_100,
                                -- element_click, funnel_step, cta_click, form_submit,
                                -- bounce, conversion, download, purchase
visitor_id      TEXT            -- funnel_session_id
source          TEXT            -- utm_source
medium          TEXT            -- utm_medium
campaign        TEXT            -- utm_campaign
metadata        JSONB           -- event-specific fields stored here
```

---

## 8. Answers to Open Questions

| Question | Answer |
|----------|--------|
| Stripe account? | YES. TEST credential ready. LIVE credential exists (needs Bradford approval to use). |
| Email provider? | Gmail (cold outreach, 3 accounts) + SendGrid (sequences/newsletters). Domain: aivibemasters.com |
| Stripe.js tokenization? | **Option A confirmed.** Frontend tokenizes client-side, sends `payment_method_id`. Backend charges via Stripe API. |
| Funnel session TTL? | 30 minutes recommended. Future: scheduled workflow to mark abandoned sessions. |
| Multi-currency? | USD only for now. |
| Refund workflow? | Handle via Stripe Dashboard. STRIPE-HOOK will auto-update `offer_purchases.payment_status` to `"refunded"` when Stripe sends the refund event. |

---

## 9. Frontend TODO Checklist

These items need to be built on the frontend to connect to the backend endpoints:

- [ ] Generate `funnel_session_id` in localStorage on first page load
- [ ] Propagate `funnel_session_id` via `?sid=` param on all redirects
- [ ] Set `data-endpoint="https://n8n.carltonaiservices.com/webhook/page-form"` on all form blocks
- [ ] Auto-inject tracking pixel script (`PAGE-TRACK`) into every published page
- [ ] Add Stripe.js to checkout pages and tokenize card into `payment_method_id`
- [ ] Add `data-sequence` attribute to form blocks (configurable in Settings tab)
- [ ] Add `data-product-id` and `data-price` attributes to checkout/upsell blocks
- [ ] Build confirmation page template that reads `offer_purchases` by `funnel_session_id`
- [ ] Add `<meta name="page-id" content="PAGE_xxx">` to every published page for tracking
- [ ] Add `data-funnel-name` and `data-step` attributes for funnel flow tracking
- [ ] Get Stripe publishable key from Bradford for test/live environments

---

## 10. Testing

### Test the lead path:
```bash
curl -X POST https://n8n.carltonaiservices.com/webhook/page-form \
  -H "Content-Type: application/json" \
  -d '{"data_type":"lead","email":"test@example.com","first_name":"Test","funnel_session_id":"test-123"}'
```

### Test the tracking pixel:
```bash
curl -X POST https://n8n.carltonaiservices.com/webhook/page-track \
  -H "Content-Type: application/json" \
  -d '{"event":"page_view","page_id":"TEST","page_url":"https://test.com","funnel_session_id":"test-123","timestamp":"2026-03-25T12:00:00Z"}'
```

### Test the decline path:
```bash
curl -X POST https://n8n.carltonaiservices.com/webhook/page-form \
  -H "Content-Type: application/json" \
  -d '{"data_type":"upsell","action":"decline","funnel_session_id":"test-123","redirect_url":"/confirmation"}'
```

Checkout and upsell-accept paths require a real Stripe.js `payment_method_id` from the frontend.
