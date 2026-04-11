# Backend Handoff: Page Builder Purchase & Funnel Management System

**From:** Frontend Developer (Claude Built Websites)
**To:** Backend Developer (n8n / Agentic Workflows)
**Date:** 2026-03-25
**Status:** Frontend complete, backend integration needed

---

## Overview

We built a visual drag-and-drop page builder (`editor.bradfordcarlton.com`) that produces HTML pages with standardized `data-*` attributes on every interactive element. The backend needs to:

1. **Receive form submissions** from published pages via webhooks
2. **Process payments** through Stripe
3. **Manage purchase flows** (cart → checkout → upsell → confirmation)
4. **Route leads** into email sequences
5. **Track visitor behavior** via an analytics/tracking pixel
6. **Handle timed completions** (countdown expirations, delayed captures)

---

## 1. Frontend Data Contract

Every form/interactive block on a published page has `data-*` attributes that tell the backend what to do. This is the contract between frontend and backend.

### 1.1 Form Blocks

All forms POST to the URL specified in `data-endpoint`.

```html
<div data-module="form" data-endpoint="https://n8n.example.com/webhook/xyz" data-type="checkout">
  <form>
    <!-- named input fields -->
  </form>
</div>
```

| Attribute | Values | Meaning |
|-----------|--------|---------|
| `data-module` | `form` | This is a form block |
| `data-endpoint` | URL | Webhook to POST form data to |
| `data-type` | `lead`, `checkout`, `upsell`, `downsell` | What kind of form this is |

### 1.2 Form Field Names by Type

**Lead capture forms** (`data-type="lead"` or no type):
```
first_name, email
```

**Checkout forms** (`data-type="checkout"`):
```
first_name, last_name, email, phone
card_number, card_expiry, card_cvv, card_name
ship_address, ship_city, ship_state, ship_zip
billing_same (checkbox: "true" or absent)
bill_address, bill_city, bill_state, bill_zip
```

**Upsell/Downsell forms** (`data-type="upsell"` or `data-type="downsell"`):
```
action: "accept" or "decline"
```
These are Yes/No button clicks. The page should POST `{ action: "accept", page_url, session_id }` or `{ action: "decline" }`.

### 1.3 Countdown Timer Events

```html
<div data-module="countdown"
     data-countdown-hours="24"
     data-countdown-redirect="https://site.com/expired"
     data-countdown-webhook="https://n8n.example.com/webhook/timer-expired">
```

**Webhook payload at zero:**
```json
{
  "event": "countdown_expired",
  "page": "https://site.com/offer",
  "timer_hours": 24,
  "expired_at": "2026-03-25T18:30:00.000Z"
}
```

### 1.4 VSL / Video Tracking (future)

```html
<div data-module="vsl" data-youtube="https://youtube.com/watch?v=...">
```
Future: Track play events, watch time, completion rate.

### 1.5 Data Table Modules

```html
<div data-module="table" data-source="supabase" data-table="leads" data-columns="name,email,status">
```
Backend workflows generate the JS code to query Supabase and render the table at deploy time.

---

## 2. Purchase Flow Architecture

### 2.1 The Full Funnel Flow

```
LANDING PAGE (lead magnet / VSL)
    ↓ email capture → webhook → add to email sequence
    ↓ redirect to sales page

SALES PAGE (pricing table / product card)
    ↓ "Buy Now" click → redirect to checkout page

CHECKOUT PAGE (checkout form + order summary + order bump)
    ↓ form submit → webhook
    ↓ backend: validate → create Stripe PaymentIntent → charge
    ↓ if order bump checked: add line item
    ↓ on success → redirect to upsell page
    ↓ on failure → show error, stay on checkout

UPSELL PAGE (one-time offer + countdown)
    ↓ "Yes" click → webhook → charge additional Stripe payment (use saved payment method)
    ↓ "No" click → webhook → skip, redirect to next step
    ↓ countdown expires → webhook + redirect to downsell

DOWNSELL PAGE (reduced offer)
    ↓ "Yes" → webhook → charge reduced amount
    ↓ "No" → redirect to confirmation

CONFIRMATION PAGE
    ↓ display order summary
    ↓ backend: send receipt email, fulfill order, update CRM
```

### 2.2 Session Tracking

The frontend needs to pass a session identifier through the entire funnel so the backend can link steps together. Recommended approach:

1. **On first page load:** Generate a `funnel_session_id` (UUID) and store in `localStorage`
2. **On every form POST:** Include `funnel_session_id` in the payload
3. **On every redirect:** Append `?sid={funnel_session_id}` to the URL
4. Backend uses this to group all events from one visitor into a single purchase session

**The frontend will add this.** The backend needs to:
- Accept `funnel_session_id` in all webhook payloads
- Use it to look up the visitor's Stripe customer ID, cart contents, and state
- Store session state in a Supabase table (see schema below)

---

## 3. Backend Workflows Needed

### 3.1 Lead Capture Webhook

**Trigger:** Form POST with `data-type="lead"` or no type
**Input:** `{ first_name, email, funnel_session_id, page_url }`
**Actions:**
1. Upsert contact in CRM (`crm_contacts` table)
2. Add to email sequence based on `page_url` or a `data-sequence` attribute
3. Tag the contact with the lead magnet name
4. Return `{ success: true, redirect_url: "/sales-page" }` (or empty for no redirect)

### 3.2 Checkout Webhook

**Trigger:** Form POST with `data-type="checkout"`
**Input:** Full checkout payload (see field names above)
**Actions:**
1. Validate required fields
2. Create or retrieve Stripe Customer (by email)
3. Create Stripe PaymentMethod from card details (or use Stripe.js tokenization — see note below)
4. Create Stripe PaymentIntent with the order total
5. Confirm the payment
6. If order bump was checked (`order_bump: true` in payload), add that line item to the charge
7. Store the order in `orders` table (Supabase)
8. Store the Stripe PaymentMethod ID for potential upsell charges
9. Return `{ success: true, redirect_url: "/upsell-1", order_id: "..." }`
10. On failure: Return `{ success: false, error: "Card declined" }`

**IMPORTANT — Stripe Tokenization Note:**
Raw card numbers should NOT be sent through our webhook. Instead:
- **Option A (recommended):** Add Stripe.js to the checkout page. The frontend tokenizes the card into a `payment_method_id` and sends THAT to the webhook. The backend charges the PaymentMethod via Stripe API.
- **Option B (simpler but less secure):** Send card details to the webhook over HTTPS. The n8n workflow creates the PaymentMethod via Stripe API and immediately charges it. Card data is never stored.

The frontend will implement Option A when Stripe integration is ready. For now, the webhook receives raw field values.

### 3.3 Upsell/Downsell Webhook

**Trigger:** Button click POST with `data-type="upsell"` or `data-type="downsell"`
**Input:** `{ action: "accept"|"decline", funnel_session_id, page_url, offer_id }`
**Actions if accepted:**
1. Look up `funnel_session_id` → get stored Stripe PaymentMethod
2. Create new Stripe PaymentIntent for the upsell amount
3. Charge using the stored PaymentMethod (no re-entry of card details)
4. Add to the order record
5. Return `{ success: true, redirect_url: "/next-step" }`

**Actions if declined:**
1. Log the decline
2. Return `{ redirect_url: "/downsell" }` or `{ redirect_url: "/confirmation" }`

### 3.4 Timer Expiration Webhook

**Trigger:** Countdown timer hits zero
**Input:** `{ event: "countdown_expired", page, timer_hours, expired_at }`
**Actions:**
1. Look up any pending sessions for that page
2. Optionally: cancel any unpurchased offers
3. Optionally: send a "you missed it" email
4. Log the expiration event

### 3.5 Delayed Purchase Completion

**Scenario:** User fills out checkout but we want to wait until they hit the confirmation page (after upsells) before finalizing the charge.

**Approach:**
1. Checkout webhook creates a Stripe PaymentIntent with `capture_method: "manual"` (authorized but not captured)
2. Upsell/downsell webhooks modify the pending PaymentIntent amount (add upsell charges)
3. Confirmation page webhook captures the final PaymentIntent
4. If user never reaches confirmation within X minutes (e.g., 5-10 min), a scheduled n8n workflow auto-captures with whatever was authorized

**Alternative approach:**
1. Capture checkout immediately
2. Upsells are separate charges on the stored PaymentMethod
3. Simpler but creates multiple charges on the customer's statement

### 3.6 Email Sequence Routing

Different form submissions should route to different email sequences:

| Source | Sequence |
|--------|----------|
| Lead magnet download | Nurture sequence (education → soft sell) |
| Webinar registration | Event reminder → replay → offer sequence |
| Checkout completed | Receipt → onboarding → usage tips |
| Upsell accepted | Premium onboarding sequence |
| Upsell declined | Downsell offer → second chance sequence |
| Cart abandoned (started checkout but didn't complete) | Abandoned cart recovery sequence |

The frontend will include a `data-sequence` attribute on form blocks so the backend knows which sequence to use. The backend should also have default routing based on `data-type`.

---

## 4. Tracking Pixel Spec

Bradford wants a tracking pixel on every published page that captures:

### 4.1 Page View Events
```json
{
  "event": "page_view",
  "page_url": "https://site.com/sales",
  "funnel_session_id": "uuid",
  "referrer": "https://google.com/...",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "spring-sale",
  "timestamp": "2026-03-25T18:30:00Z",
  "user_agent": "...",
  "screen_width": 1920
}
```

### 4.2 Scroll Depth Events
```json
{
  "event": "scroll_depth",
  "page_url": "...",
  "funnel_session_id": "...",
  "depth_percent": 75,
  "max_depth_percent": 75,
  "time_on_page_seconds": 45
}
```
Fire at 25%, 50%, 75%, 100% scroll milestones.

### 4.3 Element Interaction Events
```json
{
  "event": "element_click",
  "page_url": "...",
  "funnel_session_id": "...",
  "element_type": "button",
  "element_text": "Buy Now",
  "element_data_module": "form",
  "timestamp": "..."
}
```

### 4.4 Funnel Flow Events
```json
{
  "event": "funnel_step",
  "funnel_session_id": "...",
  "step": "checkout",
  "step_number": 2,
  "previous_step": "sales-page",
  "timestamp": "..."
}
```

### 4.5 Implementation Plan
1. **Backend creates a tracking webhook** endpoint that ingests all events
2. **Frontend will auto-inject a tracking script** (like the FAQ/countdown scripts) into every published page
3. The script sends events to the webhook via `navigator.sendBeacon()` (non-blocking)
4. Backend stores events in a `funnel_analytics` Supabase table
5. Dashboard queries can then show: conversion rates per step, drop-off points, scroll engagement, time on page

---

## 5. Suggested Supabase Schema

### `funnel_sessions`
```sql
CREATE TABLE funnel_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    email TEXT,
    stripe_customer_id TEXT,
    stripe_payment_method_id TEXT,
    funnel_name TEXT,
    current_step TEXT,
    cart_total_cents INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active', -- active, completed, abandoned, expired
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);
```

### `orders`
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT REFERENCES funnel_sessions(session_id),
    email TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    stripe_charge_id TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'pending', -- pending, authorized, captured, refunded, failed
    line_items JSONB DEFAULT '[]',
    shipping_address JSONB,
    billing_address JSONB,
    order_bumps JSONB DEFAULT '[]',
    upsells JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `funnel_analytics`
```sql
CREATE TABLE funnel_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT,
    event TEXT NOT NULL,
    page_url TEXT,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_analytics_session ON funnel_analytics(session_id);
CREATE INDEX idx_analytics_event ON funnel_analytics(event);
CREATE INDEX idx_analytics_page ON funnel_analytics(page_url);
```

---

## 6. Workflow Priority Order

Build these in order — each one unlocks the next:

| Priority | Workflow | Depends On |
|----------|----------|------------|
| **P1** | Lead capture webhook → CRM upsert + email sequence | CRM tables (already exist) |
| **P2** | Tracking pixel webhook → funnel_analytics table | New table |
| **P3** | Checkout webhook → Stripe charge → order record | Stripe API key, funnel_sessions + orders tables |
| **P4** | Upsell/downsell webhook → charge stored PaymentMethod | P3 (needs stored payment method) |
| **P5** | Abandoned cart detection → recovery email | P3 + P2 (needs session state + timing) |
| **P6** | Delayed capture workflow (manual capture after upsells) | P3 + P4 |
| **P7** | Timer expiration handling | Countdown blocks deployed on live pages |
| **P8** | Analytics dashboard queries | P2 (needs accumulated data) |

---

## 7. Open Questions for Backend Developer

1. **Stripe account:** Is there an existing Stripe account with API keys? If not, need to set up test mode first.
2. **Email provider:** Which sequences system? SendGrid? Existing n8n email workflows? Need to know the sequence trigger mechanism.
3. **Stripe.js tokenization:** Should the frontend embed Stripe.js and tokenize cards client-side (PCI compliant), or should the backend handle raw card data via HTTPS (simpler but less compliant)?
4. **Funnel session TTL:** How long should a funnel session stay "active" before being marked abandoned? Suggested: 30 minutes of inactivity.
5. **Multi-currency:** USD only, or do we need to support other currencies?
6. **Refund workflow:** Should there be an admin-triggered refund workflow, or handle via Stripe dashboard?

---

## 8. Frontend Responsibilities (Still TODO)

These will be built on the frontend side once the backend endpoints are ready:

- [ ] Add `funnel_session_id` generation + propagation to all form submissions
- [ ] Build and auto-inject tracking pixel script into published pages
- [ ] Add Stripe.js tokenization to checkout form (replaces raw card fields)
- [ ] Add `data-sequence` attribute to form blocks (configurable in Settings tab)
- [ ] Add `data-product-id` and `data-price` attributes to checkout/upsell blocks
- [ ] Build confirmation page template with order summary pulled from backend
- [ ] Add `data-funnel-name` and `data-step` attributes for funnel flow tracking
