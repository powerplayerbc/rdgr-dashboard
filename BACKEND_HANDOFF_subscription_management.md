# Backend Handoff: Subscription Management System

**From:** Frontend Developer (Claude Built Websites)
**To:** Backend Developer (n8n / Agentic Workflows)
**Date:** 2026-03-29
**Status:** Frontend blocks built, backend endpoints needed

---

## Overview

We're building a subscription management system with two interfaces:

1. **Customer-facing account page** — built with page-builder blocks, accessed via token link in email
2. **Admin subscriber management page** — in RDGR dashboard, uses existing rdgr-session auth

Both interfaces need STRIPE-UTIL to support 6 new operations on the existing `stripe-manage` webhook. The customer-facing page also needs a token-based authentication mechanism.

**Design philosophy:** Cancellation and pause must be easy and visible. No exit mazes, no guilt trips. Pause is offered before cancel. Cancel uses `cancel_at_period_end` so customers keep access until their billing period ends. See `lesson-saas-cancellation-best-practices` in claude_knowledge for full rationale.

---

## 1. New STRIPE-UTIL Operations

Expand the existing STRIPE-UTIL workflow (`stripe-manage` webhook, currently 3 operations, 12 nodes, uses **TEST** credential) with 7 new operations. All follow the same pattern: POST to `https://n8n.carltonaiservices.com/webhook/stripe-manage` with `operation` field.

**Existing operations (do not modify):**
| Operation | Description |
|-----------|-------------|
| `create_product` | Creates product + price + payment link, saves to Supabase |
| `create_payment_link` | Creates payment link for existing Stripe price |
| `get_product` | Placeholder — returns advisory message |

**New operations to add (7 total):**

### 1.1 `get_customer_subscriptions`

Retrieves all subscriptions for a customer. Used by both the customer-facing account page and the admin page.

**Input:**
```json
{
  "operation": "get_customer_subscriptions",
  "customer_id": "cus_abc123",
  "token": "eyJ...",
  "brand_id": "carlton",
  "task_id": "optional"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `operation` | string | Yes | `"get_customer_subscriptions"` |
| `customer_id` | string | Yes* | Stripe customer ID. *If `token` is provided, extract from token instead |
| `token` | string | Yes* | Signed JWT for customer-facing requests. *Either `customer_id` or `token` required |
| `brand_id` | string | No | Defaults to `"carlton"` |

**Response:**
```json
{
  "success": true,
  "operation": "get_customer_subscriptions",
  "customer": {
    "id": "cus_abc123",
    "email": "jane@example.com",
    "name": "Jane Doe"
  },
  "subscriptions": [
    {
      "subscription_id": "sub_xyz789",
      "status": "active",
      "plan_name": "Growth Plan",
      "price_cents": 4900,
      "interval": "month",
      "current_period_start": "2026-03-01T00:00:00Z",
      "current_period_end": "2026-04-01T00:00:00Z",
      "cancel_at_period_end": false,
      "pause_collection": null,
      "created_at": "2025-12-01T00:00:00Z"
    }
  ]
}
```

**Subscription status values:** `active`, `past_due`, `unpaid`, `canceled`, `incomplete`, `trialing`, `paused`

**Stripe API:** `GET /v1/customers/{customer_id}/subscriptions?status=all&expand[]=data.plan.product`

Expand `plan.product` so we can return the human-readable `plan_name` (from `product.name`).

---

### 1.2 `pause_subscription`

Pauses invoice collection on a subscription. The subscription stays technically active but no further charges are made.

**Input:**
```json
{
  "operation": "pause_subscription",
  "subscription_id": "sub_xyz789",
  "token": "eyJ...",
  "brand_id": "carlton",
  "task_id": "optional"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `operation` | string | Yes | `"pause_subscription"` |
| `subscription_id` | string | Yes | Stripe subscription ID |
| `token` | string | Yes* | Required for customer-facing requests |
| `brand_id` | string | No | Defaults to `"carlton"` |

**Response:**
```json
{
  "success": true,
  "operation": "pause_subscription",
  "subscription_id": "sub_xyz789",
  "status": "active",
  "pause_collection": {
    "behavior": "void"
  },
  "current_period_end": "2026-04-01T00:00:00Z",
  "message": "Billing paused. Your access continues until April 1, 2026."
}
```

**Stripe API:** `POST /v1/subscriptions/{subscription_id}` with body `{ pause_collection: { behavior: "void" } }`

**`behavior: "void"`** means invoices are voided (not created) while paused. Alternative `"mark_uncollectible"` creates but doesn't charge — we want `void` for clean UX.

**After pausing:** Update `unified_contacts` where `stripe_customer_id` matches — set `subscription_status` to `paused`.

---

### 1.3 `resume_subscription`

Resumes a paused subscription. Clears the pause_collection flag.

**Input:**
```json
{
  "operation": "resume_subscription",
  "subscription_id": "sub_xyz789",
  "token": "eyJ...",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "resume_subscription",
  "subscription_id": "sub_xyz789",
  "status": "active",
  "pause_collection": null,
  "message": "Billing resumed. Your next charge is on April 1, 2026."
}
```

**Stripe API:** `POST /v1/subscriptions/{subscription_id}` with body `{ pause_collection: "" }` (empty string clears it)

**After resuming:** Update `unified_contacts` — set `subscription_status` back to `active`.

---

### 1.4 `cancel_subscription`

Cancels a subscription at the end of the current billing period. Customer keeps access until then.

**Input:**
```json
{
  "operation": "cancel_subscription",
  "subscription_id": "sub_xyz789",
  "token": "eyJ...",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "cancel_subscription",
  "subscription_id": "sub_xyz789",
  "status": "active",
  "cancel_at_period_end": true,
  "current_period_end": "2026-04-01T00:00:00Z",
  "message": "Subscription cancelled. You still have access until April 1, 2026."
}
```

**Stripe API:** `POST /v1/subscriptions/{subscription_id}` with body `{ cancel_at_period_end: true }`

**IMPORTANT:** Do NOT use `DELETE /v1/subscriptions/{id}` — that cancels immediately. We always cancel at period end so the customer gets what they paid for.

**After canceling:** Update `unified_contacts` — set `subscription_status` to `canceling`.

---

### 1.5 `reactivate_subscription`

Reverses a pending cancellation (undo cancel_at_period_end). Only works if the subscription hasn't actually ended yet.

**Input:**
```json
{
  "operation": "reactivate_subscription",
  "subscription_id": "sub_xyz789",
  "token": "eyJ...",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "reactivate_subscription",
  "subscription_id": "sub_xyz789",
  "status": "active",
  "cancel_at_period_end": false,
  "message": "Welcome back! Your subscription is active again."
}
```

**Stripe API:** `POST /v1/subscriptions/{subscription_id}` with body `{ cancel_at_period_end: false }`

**After reactivating:** Update `unified_contacts` — set `subscription_status` back to `active`.

---

### 1.6 `create_portal_session`

Creates a Stripe Customer Portal session for payment method updates only. The portal URL is short-lived (expires after one use or ~24 hours).

**Input:**
```json
{
  "operation": "create_portal_session",
  "customer_id": "cus_abc123",
  "return_url": "https://offers.bradfordcarlton.com/account?token=eyJ...",
  "token": "eyJ...",
  "brand_id": "carlton"
}
```

**Response:**
```json
{
  "success": true,
  "operation": "create_portal_session",
  "portal_url": "https://billing.stripe.com/p/session/..."
}
```

**Stripe API:** `POST /v1/billing_portal/sessions` with body `{ customer: "cus_abc123", return_url: "..." }`

**Prerequisite:** The Stripe Customer Portal must be configured in the Stripe Dashboard:
- Enable payment method updates: YES
- Enable subscription cancellation: NO (we handle this ourselves)
- Enable subscription pause: NO (we handle this ourselves)
- Branding: Match the client's brand colors

---

## 2. Token-Based Customer Authentication

Customer-facing account pages need a way to identify the customer without a full login system.

### 2.1 Token Format

Use a signed JWT or HMAC token containing:
```json
{
  "customer_id": "cus_abc123",
  "brand_id": "carlton",
  "exp": 1711929600,
  "iat": 1711843200
}
```

| Field | Purpose |
|-------|---------|
| `customer_id` | Stripe customer ID |
| `brand_id` | Which brand's subscription system |
| `exp` | Expiry timestamp (24 hours from generation) |
| `iat` | Issued-at timestamp |

### 2.2 Token Generation

New operation needed (or a separate lightweight webhook):

**Trigger:** Admin clicks "Send Account Link" in subscribers page, OR customer replies to an email asking to manage their subscription.

**Process:**
1. Look up customer by email in `unified_contacts`
2. Get their `stripe_customer_id`
3. Sign a JWT with the customer_id + 24h expiry
4. Return the full URL: `https://offers.bradfordcarlton.com/account?token=eyJ...`

### 2.3 Token Validation

Every customer-facing STRIPE-UTIL request that includes a `token` field should:
1. Verify the JWT signature
2. Check `exp` hasn't passed
3. Extract `customer_id` from the token
4. Use that `customer_id` for the Stripe API call (ignore any `customer_id` in the request body — the token is authoritative)

### 2.4 Security Notes

- Tokens are **single-purpose** (account management only) and **time-limited** (24h)
- Do NOT allow token-authenticated requests to create charges, change plans, or perform any write action beyond pause/cancel/resume
- Rate limit token-authenticated endpoints (e.g., 10 requests per token per minute)
- Log all subscription state changes with the token's customer_id for audit trail

---

## 3. Webhook Event Updates

The existing STRIPE-WEBHOOK at `/stripe-events` already handles `customer.subscription.*` events. Verify/update these handlers:

| Stripe Event | Expected Action |
|-------------|-----------------|
| `customer.subscription.updated` with `pause_collection` set | Set `unified_contacts.subscription_status` = `paused` |
| `customer.subscription.updated` with `cancel_at_period_end: true` | Set `subscription_status` = `canceling` |
| `customer.subscription.updated` with `cancel_at_period_end: false` and no `pause_collection` | Set `subscription_status` = `active` |
| `customer.subscription.deleted` | Set `subscription_status` = `canceled`, set `lifecycle_stage` = `churned` |

Also ensure each transition is logged in `contact_lifecycle_log` if that table exists.

---

## 4. Frontend Data Contract

### 4.1 Account Blocks

Published account pages use `data-module="account"` with various `data-type` values:

```html
<div data-module="account" data-type="subscription-status"
     data-endpoint="https://n8n.carltonaiservices.com/webhook/stripe-manage">
  <!-- Populated by runtime JS -->
</div>
```

| Attribute | Values | Meaning |
|-----------|--------|---------|
| `data-module` | `account` | This is an account management block |
| `data-endpoint` | URL | STRIPE-UTIL webhook URL |
| `data-type` | `subscription-status`, `pause-billing`, `cancel-subscription`, `manage-payment`, `reactivation` | Which account block |

### 4.2 Runtime JS Flow

The page's runtime JS (injected by page-builder on export):

1. Reads `token` from URL: `new URLSearchParams(window.location.search).get('token')`
2. Calls `get_customer_subscriptions` with the token
3. Populates status cards with subscription data
4. Wires up action buttons to call pause/cancel/resume/portal operations
5. Updates UI state after each action (no page reload needed)

---

## 5. Admin Endpoint (RDGR Dashboard)

The admin subscribers page calls the same STRIPE-UTIL operations but authenticates via `rdgr-session` (existing dashboard auth) instead of customer tokens.

**Additional admin-only operation needed:**

### 5.1 `generate_account_link`

Generates a customer account management URL with signed token.

**Input:**
```json
{
  "operation": "generate_account_link",
  "email": "jane@example.com",
  "brand_id": "carlton",
  "send_email": true
}
```

**Response:**
```json
{
  "success": true,
  "operation": "generate_account_link",
  "account_url": "https://offers.bradfordcarlton.com/account?token=eyJ...",
  "email_sent": true,
  "expires_at": "2026-03-31T01:00:00Z"
}
```

If `send_email: true`, the backend also sends a pre-formatted email to the customer with the link.

---

## 6. Supabase Schema Notes

### unified_contacts — subscription_status values

Current values: likely just `active` and whatever Stripe sends. Expand to:

| Status | Meaning |
|--------|---------|
| `active` | Subscription is active and billing normally |
| `paused` | Billing paused via pause_collection |
| `canceling` | Set to cancel at period end, still has access |
| `canceled` | Subscription ended |
| `past_due` | Payment failed, in retry period |
| `trialing` | In free trial period |

### New column needed (if not present)

- `unified_contacts.stripe_subscription_id` — to link contacts to their Stripe subscription without re-querying Stripe each time

---

## 7. Testing Checklist

- [ ] `get_customer_subscriptions` returns correct data for a test customer
- [ ] `pause_subscription` sets pause_collection on Stripe and updates unified_contacts
- [ ] `resume_subscription` clears pause_collection and updates unified_contacts
- [ ] `cancel_subscription` sets cancel_at_period_end and updates unified_contacts
- [ ] `reactivate_subscription` clears cancel_at_period_end and updates unified_contacts
- [ ] `create_portal_session` returns a valid Stripe portal URL
- [ ] `generate_account_link` creates a signed token URL and optionally sends email
- [ ] Token validation rejects expired tokens
- [ ] Token validation rejects tampered tokens
- [ ] Webhook events correctly update subscription_status in unified_contacts
- [ ] All operations use the LIVE Stripe credential (not TEST) for production
