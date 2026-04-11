# Command Chat — Frontend Changes Required

## Context

The RDGR-CHAT backend workflow is now live and handling inline domain agent execution. When a user asks for research, writing, or other domain work, the backend calls the domain agent directly and waits for the result before responding. This means some requests take 15-60+ seconds instead of the original 2-5 seconds.

The frontend needs three changes to support this properly.

---

## Change 1: Extend the Webhook Timeout

**Current:** `sendChatMessage()` uses a 30-second `AbortController` timeout.

**Required:** Increase to **180 seconds** (3 minutes).

**Why:** Domain agent operations (research, writing, etc.) execute inline and can take 30-120 seconds. The backend workflow has a 300-second execution timeout, so the frontend should allow at least 180 seconds.

**Where to change:** Find the `AbortController` timeout in the `sendChatMessage` function and change `30000` to `180000`.

```javascript
// BEFORE
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

// AFTER
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 180000);
```

Also update the timeout error message:
```javascript
// BEFORE
"Request timed out (30s). Try again."

// AFTER
"Request timed out (3m). Try again."
```

---

## Change 2: Enhanced Typing Indicator

**Current:** A simple typing indicator (dots or similar) shows while waiting for the response.

**Required:** Add a **duration counter** next to the typing indicator so the user knows the system is still working during long operations.

**Implementation:**

When the typing indicator activates (after sending a message), start a timer that updates every second:

```javascript
// When message is sent and typing indicator shows:
let startTime = Date.now();
let timerInterval = setInterval(() => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  // Update the typing indicator text
  if (elapsed < 10) {
    setTypingText("Rodger is thinking...");
  } else if (elapsed < 30) {
    setTypingText(`Working on it... (${elapsed}s)`);
  } else {
    setTypingText(`Still working — this one takes a moment... (${elapsed}s)`);
  }
}, 1000);

// When response arrives, clear the timer:
clearInterval(timerInterval);
```

**Visual behavior:**
- **0-10s**: "Rodger is thinking..." (standard dots animation)
- **10-30s**: "Working on it... (15s)" — shows elapsed time
- **30s+**: "Still working — this one takes a moment... (45s)" — reassures the user

The typing indicator should remain visually consistent (same position, same animation style) — just the text changes.

---

## Change 3: Render Google Drive Links in Responses

**Current:** AI responses render `**bold**`, `` `code` ``, and `\n` as line breaks.

**Required:** Add support for rendering **markdown links** in AI responses.

**Why:** When the backend executes domain agents inline (research, writing), the domain agent saves the output to Google Drive and the response includes a Drive link. These links need to be clickable.

**Format the backend sends:**
The AI response content may include URLs in plain text like:
```
Here is your research brief: https://docs.google.com/document/d/1abc123/edit
```

Or in markdown link format:
```
Here is your [research brief](https://docs.google.com/document/d/1abc123/edit)
```

**Implementation:**

Add URL detection to the message rendering logic. At minimum, auto-link bare URLs:

```javascript
function renderMessageContent(text) {
  // Existing: bold, code, line breaks
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');

  // NEW: Auto-link URLs
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // NEW: Markdown links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  return html;
}
```

**Note:** Apply markdown link replacement BEFORE bare URL replacement to avoid double-linking.

**Styling for links:**
```css
.chat-message a {
  color: #3b82f6;          /* blue-500 */
  text-decoration: underline;
  word-break: break-all;    /* prevent long URLs from breaking layout */
}
.chat-message a:hover {
  color: #2563eb;          /* blue-600 */
}
```

---

## Summary of Changes

| Change | File(s) | Effort |
|--------|---------|--------|
| Extend timeout to 180s | `sendChatMessage()` function | 2 lines |
| Enhanced typing indicator with timer | Typing indicator component | ~15 lines |
| Render Drive links in responses | Message rendering function + CSS | ~10 lines |

## Backend Response Format (unchanged)

The backend response format has not changed. The frontend should continue checking:

```javascript
if (result && result.success && result.reply) {
  // result.reply.content     — message text (may now contain URLs)
  // result.reply.content_type — 'text'
  // result.reply.metadata    — includes route, delegated_to, processing_time_ms
  // result.message_id        — message ID
  // result.timestamp         — ISO timestamp
}
```

## Testing

1. Send a simple greeting — should respond in 2-5s, typing indicator shows "Rodger is thinking..."
2. Send "Do a quick research search on AI agent trends" — should take 15-60s, typing indicator shows elapsed time, response includes real research data
3. Send "Research the competitive landscape for AI consulting" — may take 60-120s, verify the 180s timeout doesn't trigger, response may include a Google Doc link
4. Verify Google Doc links in responses are clickable and open in a new tab
