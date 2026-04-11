# RDGR Dashboard — New Task & Social Post Integration

## Webhook Endpoint

Both task types POST to the same endpoint:

```
POST https://n8n.carltonaiservices.com/webhook/rdgr-intake
Content-Type: application/json
```

---

## General Task Payload

```json
{
  "title": "Research AI consulting market trends",
  "description": "Analyze the current AI consulting landscape...",
  "domain": "research",
  "priority": 3,
  "context": {
    "notes": "Focus on B2B SaaS companies"
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Short task title |
| `description` | string | Yes | Detailed task description |
| `domain` | string | Yes | One of: `research`, `email`, `writing`, `sales`, `calendar`, `finance`, `thinking`, `toolbuild` |
| `priority` | integer | Yes | 1 (Critical) to 5 (Background), default 3 |
| `context` | object | No | Optional. Contains `notes` string with additional context |

---

## Social Post Payload

Social posts include a `type` field, structured `context` with platform/tone, and an optional `image` attachment:

### Without image

```json
{
  "type": "social_post",
  "title": "Social post: AI automation for small businesses",
  "description": "AI automation for small businesses",
  "domain": "social_media",
  "priority": 3,
  "context": {
    "platform": "linkedin",
    "tone": "thought_leadership",
    "notes": "Include a CTA linking to bradfordcarlton.com"
  }
}
```

### With image

```json
{
  "type": "social_post",
  "title": "Social post: AI automation for small businesses",
  "description": "AI automation for small businesses",
  "domain": "social_media",
  "priority": 3,
  "context": {
    "platform": "linkedin",
    "tone": "thought_leadership",
    "notes": "Include a CTA linking to bradfordcarlton.com"
  },
  "image": {
    "base64": "/9j/4AAQSkZJRgABAQ...",
    "filename": "team-photo.jpg",
    "mimeType": "image/jpeg",
    "size": 245760
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Always `"social_post"` — differentiates from general tasks |
| `title` | string | Yes | Auto-generated as `"Social post: {topic}"` |
| `description` | string | Yes | The topic/idea for the post |
| `domain` | string | Yes | Always `"social_media"` |
| `priority` | integer | Yes | Default 3 |
| `context.platform` | string | Yes | One of: `linkedin`, `twitter`, `instagram`, `facebook`, `all` |
| `context.tone` | string | Yes | One of: `professional`, `casual`, `thought_leadership`, `promotional`, `educational` |
| `context.notes` | string | No | Additional instructions (hashtags, CTA, links, key points) |
| `image` | object | No | Present only when user attaches an image |
| `image.base64` | string | — | Raw base64-encoded image data (no `data:` prefix) |
| `image.filename` | string | — | Original filename (e.g. `"team-photo.jpg"`) |
| `image.mimeType` | string | — | MIME type (e.g. `"image/jpeg"`, `"image/png"`, `"image/webp"`) |
| `image.size` | integer | — | File size in bytes (max 5MB / 5242880) |

### Handling the image in n8n

```javascript
// In n8n Code node — check for image and convert back to binary
if ($json.image) {
  const buffer = Buffer.from($json.image.base64, 'base64');
  // Option 1: Store in Google Drive, S3, etc. via binary data
  // Option 2: Pass to social media API directly
  // Option 3: Save to temp and reference by URL

  // To create binary data for downstream nodes:
  $input.item.binary = {
    image: {
      data: $json.image.base64,
      mimeType: $json.image.mimeType,
      fileName: $json.image.filename,
    }
  };
}
```

### How to differentiate in n8n

In RDGR-INTAKE, check for the `type` field:

```javascript
// In n8n Code node or IF node
if ($json.type === 'social_post') {
  // Route to social media workflow (e.g., RDGR-WRITING with social context)
  // Platform and tone are in $json.context.platform / $json.context.tone
  // Image (if attached) is in $json.image.base64
} else {
  // Standard task processing
}
```

---

## Response

The webhook should return:

```json
{
  "task_id": "TQ-1710000000000",
  "status": "queued"
}
```

The dashboard reads `task_id` from the response (checks `result.task_id` then `result.data.task_id`) and shows a success toast. The task queue auto-refreshes 2 seconds after submission.

---

## Data Flow

```
Dashboard "New Task" button
  → Opens modal with tab selector (General Task / Social Post)
  → User fills form, clicks Submit
  → POST to rdgr-intake webhook
  → RDGR-INTAKE workflow receives payload
    → If type === "social_post": route to social media processing
    → Else: standard task queue insertion
  → Response with task_id
  → Dashboard shows toast + refreshes task queue
```
