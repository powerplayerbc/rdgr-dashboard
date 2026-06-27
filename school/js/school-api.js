// ═══════════════════════════════════════
// School API Layer — carltondb (PostgREST) & Bridge Helpers
// ═══════════════════════════════════════

// Error objects serialize to "{}" via JSON.stringify (no enumerable props), which
// made the bug-report widget show useless "write error: {}" messages. Render a
// readable string instead so connectivity failures (e.g. "TypeError: Failed to
// fetch" from antivirus HTTPS scanning / network blocks) are diagnosable (UBR-0198).
function _errStr(err) {
    if (!err) return 'unknown error';
    if (err.name || err.message) return (err.name || 'Error') + ': ' + (err.message || '');
    try { return String(err); } catch (e) { return 'unserializable error'; }
}

async function supabaseSelect(table, query = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
    try {
        const res = await fetch(url, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) { console.error('carltondb read error:', table, res.status, await res.text()); return null; }
        return await res.json();
    } catch (err) { console.error('carltondb read error (network):', table, _errStr(err)); return null; }
}

async function supabaseWrite(table, method, body, matchQuery = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${matchQuery}`;
    try {
        const res = await fetch(url, {
            method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: method === 'DELETE' ? undefined : JSON.stringify(body)
        });
        if (!res.ok) { console.error('carltondb write error:', table, res.status, await res.text()); return null; }
        const text = await res.text();
        return text ? JSON.parse(text) : true;
    } catch (err) { console.error('carltondb write error (network):', table, _errStr(err)); return null; }
}

async function supabaseUpsert(table, body, onConflict = '') {
    // UBR-0164: on_conflict must be appended to the URL for PostgREST's
    // resolution=merge-duplicates to know which constraint to merge against,
    // otherwise PostgREST does a plain INSERT and unique-violations surface.
    const url = `${SUPABASE_URL}/rest/v1/${table}` + (onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation,resolution=merge-duplicates'
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) { console.error('carltondb upsert error:', table, res.status, await res.text()); return null; }
        const text = await res.text();
        return text ? JSON.parse(text) : true;
    } catch (err) { console.error('carltondb upsert error (network):', table, _errStr(err)); return null; }
}

// UBR-0177: daily activity completion (vocab/typing/flashcards) was tracked in
// localStorage only, so a second device never saw what was marked done on the
// first. school_daily_task_completions is the cross-device source of truth.
// This seeds the per-device localStorage cache from the server for today, so the
// existing synchronous `school-<type>-done-<profile>-<today>` reads reflect what
// was completed on ANY device. Returns a Set of completed task_type strings.
async function syncDailyCompletionsFromServer() {
    const profileId = (typeof activeProfileId !== 'undefined' && activeProfileId) || 'anon';
    if (profileId === 'anon') return new Set();
    const today = (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0, 10);
    const rows = await supabaseSelect(
        'school_daily_task_completions',
        `student_id=eq.${profileId}&task_date=eq.${today}&select=task_type`
    );
    const done = new Set();
    if (Array.isArray(rows)) {
        rows.forEach(function (r) {
            if (!r || !r.task_type) return;
            done.add(r.task_type);
            try { localStorage.setItem('school-' + r.task_type + '-done-' + profileId + '-' + today, '1'); } catch (e) {}
        });
    }
    return done;
}

async function supabaseRpc(fn, body) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body || {})
        });
        if (!res.ok) { console.warn(`Supabase rpc ${fn} error:`, res.status); return null; }
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch (err) { console.warn(`Supabase rpc ${fn} error:`, err); return null; }
}

// Fire-and-forget motivation event logger (UBR-0084).
// Inserts a row into school_motivation_events. Errors are swallowed -- this
// must never block the user-facing flow it's hooked into.
function logMotivationEvent(eventType, payload = {}) {
    if (!activeProfileId || !eventType) return;
    const body = {
        student_id: activeProfileId,
        assignment_id: typeof currentAssignmentId !== 'undefined' ? currentAssignmentId : null,
        lesson_id: typeof currentLessonId !== 'undefined' ? currentLessonId : null,
        event_type: eventType,
        payload: payload || {}
    };
    fetch(`${SUPABASE_URL}/rest/v1/school_motivation_events`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(body)
    }).catch(() => { /* fire-and-forget */ });
}

// ═══════════════════════════════════════
// SCHOOL-BRIDGE API
// ═══════════════════════════════════════
async function schoolApi(operation, data = {}, { silent = false, timeout = 120000 } = {}) {
    if (!activeProfileId) {
        if (!silent) toast('Please select a profile first', 'error');
        return null;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(SCHOOL_BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operation, user_id: activeProfileId, data }),
            signal: controller.signal
        });
        clearTimeout(timer);
        const text = await res.text();
        if (!text) { console.warn(`schoolApi(${operation}): empty response`); return null; }
        let result;
        try { result = JSON.parse(text); } catch(e) {
            console.warn(`schoolApi(${operation}): non-JSON response:`, text.substring(0, 200));
            return null;
        }
        if (result && result.success === false) {
            if (!silent) toast(result.error || 'Something went wrong', 'error');
            return null;
        }
        return result;
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            if (!silent) toast('Request timed out', 'error');
        } else {
            console.warn(`schoolApi(${operation}) error:`, err.name, err.message, err.stack);
            if (!silent) toast('Connection error', 'error');
        }
        return null;
    }
}

// Upload image to Supabase Storage
async function uploadAnswerImage(file) {
    const ext = file.name.split('.').pop();
    const fileName = `${activeProfileId}/${Date.now()}.${ext}`;
    const url = `${SUPABASE_URL}/storage/v1/object/school-answers/${fileName}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': file.type
            },
            body: file
        });
        if (!res.ok) {
            console.error('Upload error:', res.status);
            toast('Failed to upload image', 'error');
            return null;
        }
        return `${SUPABASE_URL}/storage/v1/object/public/school-answers/${fileName}`;
    } catch (err) {
        console.error('Upload error:', err);
        toast('Failed to upload image', 'error');
        return null;
    }
}
