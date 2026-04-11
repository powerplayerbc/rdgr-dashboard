# Backend Issue: Media Images — Move from Base64 to Google Drive URLs

**Status:** NEEDS BACKEND WORK
**Date:** 2026-03-26
**Filed by:** Frontend developer
**Priority:** High — Media gallery page is broken because the frontend was built assuming URL-based images

---

## Current Problem

The `image_sessions` table stores generated images as raw base64 blobs in an `image_base64` column. This causes:

1. **Gallery page is broken** — the frontend was built expecting an `image_url` column with a displayable URL
2. **Massive row sizes** — each image is 500KB–1MB+ of base64 text in a single Supabase row
3. **Slow queries** — fetching even 10 images for the gallery pulls megabytes of data
4. **Browser memory** — rendering 50+ base64 images simultaneously will crash tabs on lower-end devices
5. **No sharing** — base64 blobs can't be linked to, shared, or embedded elsewhere

## Current Table Schema (`image_sessions`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `session_id` | uuid | Groups related images |
| `image_base64` | text | **The problem** — raw base64 JPEG/PNG data |
| `prompt` | text | Generation prompt |
| `image_type` | text | e.g., `general`, `icon`, `logo`, `ugc`, `product_mockup`, `person`, `bradford` |
| `mime_type` | text | e.g., `image/jpeg` |
| `created_at` | timestamptz | |

**Missing columns the frontend needs:** `brand_id`, `status`, `image_url`, `thumbnail_url`

---

## Proposed Changes

### 1. Image Storage: Google Drive

When the `gemini-image` webhook generates an image:

1. **Save the full image to Google Drive** in a dedicated folder (e.g., `Carlton AI Hub / Media / Generated Images / {image_type}/`)
2. **Set sharing to "anyone with the link can view"** so the URL is publicly accessible
3. **Store the Google Drive shareable link** in the table as `image_url`
4. Use the Drive file ID to construct the direct image URL: `https://drive.google.com/uc?export=view&id={FILE_ID}` or use the Google Drive thumbnail API

### 2. Thumbnail Generation

For each image, generate a small preview (thumbnail) for the gallery grid:

- **Size:** ~300px wide (enough for gallery cards)
- **Format:** JPEG at 70% quality (small file size)
- **Storage:** Either:
  - **Option A (recommended):** Use Google Drive's built-in thumbnail: `https://drive.google.com/thumbnail?id={FILE_ID}&sz=w300`
  - **Option B:** Generate a resized version and store as a second Drive file, save URL as `thumbnail_url`
  - **Option C:** Store the thumbnail as base64 in Supabase (acceptable since thumbnails are ~5-15KB)

### 3. Schema Migration

Add these columns to `image_sessions`:

| Column | Type | Purpose |
|--------|------|---------|
| `brand_id` | text | Filter by brand (e.g., `'carlton'`) — **required for multi-tenant** |
| `status` | text | `'generating'`, `'complete'`, `'failed'` — **required for polling** |
| `image_url` | text | Google Drive shareable URL (full resolution) |
| `thumbnail_url` | text | Small preview URL for gallery grid (300px wide) |
| `drive_file_id` | text | Google Drive file ID (for download link construction) |

**Migration plan:**
1. Add new columns (nullable initially)
2. For existing rows with `image_base64`:
   - Run a one-time migration script that uploads each base64 blob to Drive
   - Populates `image_url`, `thumbnail_url`, `drive_file_id`
   - Sets `brand_id = 'carlton'` and `status = 'complete'`
3. After migration, the `image_base64` column can be dropped or nulled out to reclaim space

### 4. Updated Webhook Flow (`gemini-image`)

```
1. Receive generation request (prompt, image_type, aspect_ratio)
2. Generate image via Gemini API
3. Upload full image to Google Drive → get file_id
4. Set Drive sharing to "anyone with link"
5. INSERT into image_sessions:
   - brand_id: 'carlton'
   - status: 'complete'
   - image_url: 'https://drive.google.com/uc?export=view&id={file_id}'
   - thumbnail_url: 'https://drive.google.com/thumbnail?id={file_id}&sz=w300'
   - drive_file_id: file_id
   - prompt, image_type, mime_type
   - image_base64: NULL (don't store it)
6. Return { success: true, image_url, file_id } to frontend
```

---

## Frontend Changes (after backend is done)

Once the schema is updated, the frontend Media page will:

### Gallery Loading
```javascript
// Fetch gallery — lightweight query, no base64
const images = await sbSelect('image_sessions',
  `brand_id=eq.carlton&status=eq.complete&select=id,image_type,prompt,thumbnail_url,image_url,drive_file_id,created_at&order=created_at.desc&limit=50`
);
```

### Gallery Cards
- Display `thumbnail_url` in the grid (small, fast-loading)
- Lazy-load thumbnails with `loading="lazy"` (safe here since no animation containers)

### Lightbox (full image view)
- On card click, load `image_url` (full resolution) in the lightbox
- Show a loading spinner while full image loads

### Memory Management
- Gallery cards use thumbnail URLs (tiny, browser manages cache naturally)
- Lightbox loads one full image at a time, clears `src` on close to free memory
- Pagination: load 50 at a time with "Load More" button instead of all at once

### Download Button
```javascript
// Direct download via Google Drive
window.open(`https://drive.google.com/uc?export=download&id=${drive_file_id}`, '_blank');
```

### Copy URL Button
```javascript
// Copy the shareable Google Drive link to clipboard
navigator.clipboard.writeText(image_url);
toast('URL copied to clipboard');
```

---

## Summary of What Backend Needs to Do

1. **Add columns** to `image_sessions`: `brand_id`, `status`, `image_url`, `thumbnail_url`, `drive_file_id`
2. **Update `gemini-image` webhook** to save images to Google Drive instead of base64
3. **Set Drive permissions** to "anyone with link" on each uploaded image
4. **Return `image_url` and `file_id`** in the webhook response
5. **Run migration** on existing base64 rows (upload to Drive, populate new columns)
6. **Optional:** Drop `image_base64` column after migration to save storage

## What Frontend Will Do (after backend)

1. Update Media page queries to use new columns
2. Display thumbnails in gallery grid, full images in lightbox
3. Add "Download" and "Copy URL" buttons to each image card/lightbox
4. Implement lazy loading + pagination for memory efficiency
