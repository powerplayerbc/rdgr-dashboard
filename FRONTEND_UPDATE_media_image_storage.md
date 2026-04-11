# Frontend Update: Media Image Storage — Backend Changes Complete

**Date:** 2026-03-27
**From:** Backend developer
**For:** Frontend developer
**Re:** [BACKEND_ISSUE_media_image_storage.md](BACKEND_ISSUE_media_image_storage.md) (now RESOLVED)

---

## What's Live Now

All schema changes and workflow updates are deployed. The `image_sessions` table and `gemini-image` webhook are ready for the Media Gallery page.

---

## 1. Table Schema (image_sessions)

All columns from the BACKEND_ISSUE are live, plus one extra (`drive_url`):

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `session_id` | text | Groups related edits |
| `brand_id` | text | Default `'carlton'` — filter with `.eq('brand_id', 'carlton')` |
| `status` | text | `'generating'` → `'complete'` (or `'failed'`) |
| `source` | text | `'dashboard'`, `'offers'`, `'content'`, `'media_agent'`, `'directive_task'` |
| `image_type` | text | `'general'`, `'icon'`, `'logo'`, `'ugc'`, `'product_mockup'`, `'person'`, `'bradford'` |
| `image_url` | text | Direct viewable URL — use for `<img src>` |
| `thumbnail_url` | text | 300px thumbnail — use for gallery grid cards |
| `drive_url` | text | Google Drive page link — use for "Open in Drive" button |
| `drive_file_id` | text | Raw file ID — use for download link |
| `prompt` | text | Generation prompt |
| `aspect_ratio` | text | `'1:1'`, `'16:9'`, `'9:16'`, `'4:3'` |
| `mime_type` | text | `'image/jpeg'` |
| `created_at` | timestamptz | |

**Index exists** on `(brand_id, status, created_at DESC)` for fast gallery queries.

### Difference from BACKEND_ISSUE proposal
- Added `drive_url` (the Drive page link, e.g., `https://drive.google.com/file/d/.../view`) — this is separate from `image_url` (the direct viewable URL). Your FRONTEND_SPEC_media_tab.md already referenced `drive_url`, so this matches.
- `hub_file_id` column exists but will usually be NULL (HUB registration is fire-and-forget). Frontend can ignore this column.
- `image_base64` column still exists but is nullable and NULLed after Drive upload. **Do not select it** in gallery queries — it's only used internally for edit-mode sessions.

---

## 2. Gallery Query (confirmed working)

```javascript
const PAGE_SIZE = 24;

const { data, count } = await supabase
  .from('image_sessions')
  .select('id, session_id, image_type, prompt, aspect_ratio, image_url, thumbnail_url, drive_url, drive_file_id, source, created_at', { count: 'exact' })
  .eq('brand_id', 'carlton')
  .eq('status', 'complete')
  .order('created_at', { ascending: false })
  .range(offset, offset + PAGE_SIZE - 1);
```

**Important:** Do NOT include `image_base64` in the select — it would pull megabytes of data.

### With image_type filter
```javascript
if (selectedType !== 'all') {
  query = query.eq('image_type', selectedType);
}
```

### With source filter (if you want it)
```javascript
query = query.eq('source', 'dashboard'); // only show dashboard-generated images
```

---

## 3. Generate Image Webhook

```
POST https://n8n.carltonaiservices.com/webhook/gemini-image
Content-Type: application/json
```

### Request payload
```json
{
  "prompt": "A modern icon of a lightbulb with neural connections",
  "image_type": "icon",
  "aspect_ratio": "1:1",
  "brand_id": "carlton",
  "source": "dashboard"
}
```

**Notes:**
- `source: "dashboard"` — please send this so we can track where images were created
- `image_type` — send this so it shows up in the correct gallery filter
- `enhance` defaults to `true` (prompt gets enhanced via OpenAI before generation)
- `uploadToDrive` defaults to `true` — you don't need to send it
- Both `aspect_ratio` (snake_case) and `aspectRatio` (camelCase) are accepted

### Response (synchronous — image is ready immediately)
```json
{
  "success": true,
  "data": {
    "base64": "<base64-encoded-image>",
    "mimeType": "image/jpeg",
    "sessionId": "aff8e527-...",
    "prompt": "A modern icon of a lightbulb...",
    "enhancedPrompt": "A sleek, minimalist icon...",
    "aspectRatio": "1:1",
    "isEdit": false,
    "textResponse": null,
    "source": "dashboard",
    "brand_id": "carlton",
    "image_type": "icon",
    "driveFileId": "1zrtIUbWS-...",
    "driveUrl": "https://drive.google.com/file/d/1zrtIUbWS-.../view",
    "imageUrl": "https://drive.google.com/uc?export=view&id=1zrtIUbWS-...",
    "thumbnailUrl": "https://drive.google.com/thumbnail?id=1zrtIUbWS-...&sz=w300"
  }
}
```

### Difference from BACKEND_ISSUE proposal
The response is **synchronous** — the image is fully generated and uploaded to Drive before the response returns (~15-25 seconds). You do NOT need to poll. The response includes the complete image data + all URLs.

Your FRONTEND_SPEC showed a polling approach with `status` checks. That still works (the row transitions `'generating'` → `'complete'`), but you can also just use the response data directly:

**Option A (simpler):** Use the response directly
```javascript
const res = await fetch('/webhook/gemini-image', { method: 'POST', body: JSON.stringify(payload) });
const { data } = await res.json();
// data.imageUrl, data.thumbnailUrl, data.driveUrl are immediately available
// Prepend to gallery without polling
```

**Option B (from your spec):** Use polling
```javascript
// Fire the webhook, show "generating..." toast, poll image_sessions for status='complete'
```

Either approach works. Option A is simpler since you get the URLs in the response.

---

## 4. Gallery Card Image Sources

| Context | Use This URL |
|---------|-------------|
| Gallery grid thumbnail | `thumbnail_url` (300px, fast loading) |
| Lightbox / detail modal | `image_url` (full resolution) |
| "Open in Drive" button | `drive_url` |
| Download button | `https://drive.google.com/uc?export=download&id=${drive_file_id}` |
| Copy URL button | `image_url` |

---

## 5. Real-time Subscription (from your spec)

This will work as-is since the row's `status` field transitions from `'generating'` to `'complete'`:

```javascript
supabase.channel('media-gallery')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'image_sessions',
    filter: 'status=eq.complete'
  }, (payload) => {
    // Prepend new image to gallery
  })
  .subscribe();
```

---

## 6. Summary of What's Different from the Original Proposal

| Item | Proposed | Actual |
|------|----------|--------|
| Storage | Google Drive | Google Drive (same) |
| Thumbnail | Drive thumbnail API or separate file | Drive thumbnail API: `/thumbnail?id={ID}&sz=w300` (same) |
| `drive_url` column | Not in proposal | Added — needed per your FRONTEND_SPEC |
| `source` column | Not in proposal | Added per Bradford's request — tracks dashboard/directive_task/offers/content/media_agent |
| Webhook response | Async (poll for completion) | **Synchronous** — URLs available immediately in response |
| `image_base64` column | Drop after migration | **Kept nullable** — still needed for edit-mode sessions |
