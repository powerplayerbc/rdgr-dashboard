// ═══════════════════════════════════════
// School API Layer — Supabase & Bridge Helpers
// ═══════════════════════════════════════

async function supabaseSelect(table, query = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
    try {
        const res = await fetch(url, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) { console.error('Supabase error:', res.status, await res.text()); return null; }
        return await res.json();
    } catch (err) { console.error('Supabase fetch error:', table, err); return null; }
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
        if (!res.ok) { console.error('Supabase write error:', res.status, await res.text()); return null; }
        const text = await res.text();
        return text ? JSON.parse(text) : true;
    } catch (err) { console.error('Supabase write error:', err); return null; }
}

async function supabaseUpsert(table, body, onConflict = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
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
        if (!res.ok) { console.error('Supabase upsert error:', res.status, await res.text()); return null; }
        const text = await res.text();
        return text ? JSON.parse(text) : true;
    } catch (err) { console.error('Supabase upsert error:', err); return null; }
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
async function schoolApi(operation, data = {}, { silent = false, timeout = 30000 } = {}) {
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
            console.warn(`schoolApi(${operation}) error:`, err.message);
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
