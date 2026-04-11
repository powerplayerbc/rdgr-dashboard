# Backend Issue: Voice Self-Enhancement Not Displaying

**Reported**: 2026-03-23
**Severity**: Feature non-functional
**Affected UI**: RDGR Settings (`settings.html`) + Social Voice Settings (`social-voice-settings.html`)

---

## Symptom

The AI Suggestions panels in both the email voice settings and social voice settings pages show nothing. The user gave draft feedback on 2026-03-22 and expected the nightly VOICE-LEARN workflows to produce voice tuning suggestions by the next morning. No suggestions appeared.

---

## Root Cause: Empty Suggestion Tables

All suggestion and snapshot tables have **zero rows**:

| Table | Expected Source | Rows |
|-------|----------------|------|
| `voice_learning_log` | VOICE-LEARN workflow | 0 |
| `voice_settings_snapshots` | VOICE-LEARN workflow | 0 |
| `social_voice_learning_log` | SOCIAL-VOICE-LEARN workflow | 0 |
| `social_voice_snapshots` | SOCIAL-VOICE-LEARN workflow | 0 |

The nightly n8n workflows have **never written data** to these tables.

---

## Data State (What Exists vs What's Missing)

### Email Drafts (`copy_drafts`) — Has feedback data
- 1 rejected draft from 2026-03-20 with feedback: *"Way too salesy. Just ask what takes up most of his time each week. 2 sentences."*
- 1 skipped draft, 1 still in draft status
- **This data should have been analyzed by VOICE-LEARN but wasn't.**

### Social Drafts (`social_content_queue`) — Missing social platform data
- Only `blog` and `newsletter` entries exist (18 total)
- **Zero entries for LinkedIn, Instagram, Twitter/X, Facebook, or Reddit**
- SOCIAL-VOICE-LEARN has nothing to analyze for social platforms

---

## Workflows to Investigate

### 1. VOICE-LEARN (Email Voice)
- **Workflow ID**: `PUWdgIPKprlAkNOl`
- **Schedule**: Daily at 6:30 AM UTC
- **Expected behavior**:
  1. Query `copy_drafts` for recent approved/rejected/skipped entries with feedback
  2. Analyze patterns (e.g., "12 of 15 rejections mention 'too salesy'")
  3. Generate 1-3 suggestions per analysis
  4. Write suggestions to `voice_learning_log` with `status='pending'`
  5. Optionally create snapshots in `voice_settings_snapshots`
- **Check**: Is the workflow active? Has it ever executed? Are there execution errors in n8n logs?

### 2. SOCIAL-VOICE-LEARN (Social Voice)
- **Schedule**: Daily at midnight PT
- **Expected behavior**:
  1. Query `social_content_queue` for recent social platform drafts with feedback
  2. Analyze approval/rejection/edit patterns per platform
  3. Generate 1-3 suggestions per platform
  4. Write to `social_voice_learning_log` with `status='pending'`
  5. Create snapshots in `social_voice_snapshots`
- **Check**: Is the workflow active? Also — social platform drafts aren't being created at all (only blog/newsletter), so the social orchestrator workflows may also need investigation.

---

## Expected Data Flow

```
User reviews drafts (approve/reject with feedback)
        ↓
copy_drafts / social_content_queue tables store feedback
        ↓
VOICE-LEARN / SOCIAL-VOICE-LEARN (nightly n8n workflows)
        ↓
AI analyzes patterns in recent feedback
        ↓
Writes suggestions to voice_learning_log / social_voice_learning_log
        ↓
Frontend loads pending suggestions and displays in AI Suggestions panel
        ↓
User accepts/dismisses → voice settings updated
```

**The break is between step 2 and step 3** — the nightly workflows aren't running or aren't producing output.

---

## Supabase RPC Functions (for reference)

- `resolve_voice_suggestion(p_suggestion_id, p_action)` — marks email voice suggestion as accepted/dismissed
- `save_voice_settings(p_brand_id, p_settings)` — applies email voice setting change
- `resolve_social_voice_suggestion(p_suggestion_id, p_action)` — marks social voice suggestion as accepted/dismissed
- `save_social_voice_settings(p_brand_id, p_platform, p_settings)` — applies social voice setting change
- `apply_social_voice_snapshot(p_snapshot_id)` — applies a social voice snapshot

---

## Frontend Status: Ready

The frontend UI is fully implemented and waiting for data:
- **Email voice**: `sites/rdgr-dashboard/settings.html` lines 810-832 (AI Suggested Settings + Individual Suggestions panels)
- **Social voice**: `sites/carlton-ai-services/social-voice-settings.html` lines 440-462 (AI Suggestions + Voice Snapshots panels)
- Both pages correctly query their respective tables and render suggestion cards with Accept/Dismiss buttons.
