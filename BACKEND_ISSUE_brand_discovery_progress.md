# Backend Issues: Branding System

## Status: Needs Backend Investigation

**Date**: 2026-03-29
**Reporter**: Frontend Developer
**Severity**: High — Page is non-functional without this

---

## Problem

The Brand Discovery frontend page (`/brand-discovery`) calls the `get_progress` operation on the `brand-discovery` webhook, but the response is either:
- An error response (`success: false`)
- A null/empty response (webhook not responding)
- A non-JSON response

The frontend has been updated to show an empty state (all 15 categories as "Not Started") when this fails, but the page cannot function properly until `get_progress` returns valid data.

## Expected Behavior

```
POST https://n8n.carltonaiservices.com/webhook/brand-discovery
{
  "operation": "get_progress",
  "brand_id": "carlton"
}
```

Should return:
```json
{
  "success": true,
  "operation": "get_progress",
  "brand_id": "carlton",
  "summary": {
    "completed": 0,
    "in_progress": 0,
    "not_started": 15,
    "total": 15
  },
  "overall_completion": 0,
  "categories": [
    { "category": "origin_story", "status": "not_started", "answered": 0, "total": 0, "avg_depth": 0, "target": 0 },
    ...
  ]
}
```

## Things to Check

1. **Is the BRAND-DISCOVERY workflow active?** (n8n ID: `D7TeOHZtpept3IVc`, registry ID: 436)
2. **Does the webhook URL respond?** Test with curl:
   ```bash
   curl -X POST https://n8n.carltonaiservices.com/webhook/brand-discovery \
     -H "Content-Type: application/json" \
     -d '{"operation":"get_progress","brand_id":"carlton"}'
   ```
3. **Does `brand_discovery_sessions` table exist?** The workflow queries this table.
4. **Does the `brand_discovery_questions` seed data exist?** The 97 seed questions should be pre-loaded.
5. **Is the `autonomous_brands` row for `carlton` present?** The workflow references `brand_id=carlton`.

## Frontend Workaround Applied

The frontend now gracefully handles the failure by rendering all 15 categories in "Not Started" state. Users can still see the page and understand the discovery flow, but cannot actually start sessions until the backend is working.

## Related Files

- Frontend: `sites/rdgr-dashboard/brand-discovery.html`
- Backend spec: `sites/rdgr-dashboard/FRONTEND_HANDOFF_branding_system.md`
- Workflow registry: ID 436 (BRAND-DISCOVERY)

---

## Issue 2: Brand Document Generation — No `document_url` in Response

**Date**: 2026-03-29
**Severity**: Medium — Documents may be generating but links aren't returned

### Problem

The Brand Documents frontend page (`/brand-documents`) calls the `generate_document` operation on the `brand-doc-gen` webhook. The backend returns `{ success: true }` but the response does NOT include `document_url` or `document_id`. The frontend shows: "Document generated, but no link returned. Check Google Drive."

The user attempted to generate a "Brand Positioning Document" and received a success toast but no link to the Google Doc.

### Expected Response

Per the handoff spec (Section 8):
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

### Things to Check

1. **Is the BRAND-DOC-GEN workflow active?** (n8n ID: `uKCnoqKspq5nBH35`, registry ID: 438)
2. **Is the Google Docs API connected?** The workflow uses DOC-CREATE utility to create Google Docs.
3. **Is the response including `document_url`?** The frontend tries these fields: `result.document_url`, `result.url`, `result.doc_url`, `result.document.url`. Check which field the workflow actually returns.
4. **Does `get_brand_context` RPC work?** The workflow calls this internally to load identity data for document generation. If identity data is missing (because brand discovery hasn't been completed), the doc content may be empty or the workflow may error silently.
5. **Check the n8n execution log** for the BRAND-DOC-GEN workflow to see the actual response shape.

### Frontend Debug

The frontend now logs the full response to the browser console:
```javascript
console.log('Brand doc response:', docType, result);
```
Ask the user to open browser DevTools > Console, generate a document, and share the logged response.

### Related Files

- Frontend: `sites/rdgr-dashboard/brand-documents.html`
- Backend spec: `sites/rdgr-dashboard/FRONTEND_HANDOFF_branding_system.md` (Section 8)
- Workflow registry: ID 438 (BRAND-DOC-GEN)
