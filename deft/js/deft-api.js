// ═══════════════════════════════════════
// DEFT API Layer — Supabase & Bridge Helpers
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SUPABASE HELPERS
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

// ═══════════════════════════════════════
// DEFT-BRIDGE API
// ═══════════════════════════════════════
async function deftApi(operation, data = {}, { silent = false } = {}) {
    if (!activeProfileId) {
        if (!silent) toast('Please select a profile first', 'error');
        return null;
    }
    try {
        const res = await fetch(DEFT_BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operation, user_id: activeProfileId, data })
        });
        const text = await res.text();
        if (!text) {
            console.warn(`deftApi(${operation}): empty response`);
            return null;
        }
        let result;
        try { result = JSON.parse(text); } catch(e) {
            console.warn(`deftApi(${operation}): non-JSON response:`, text.substring(0, 200));
            return null;
        }
        if (result && result.success === false) {
            if (!silent) toast(result.error || 'Something went wrong', 'error');
            return null;
        }
        return result;
    } catch (err) {
        console.warn(`deftApi(${operation}) error:`, err.message);
        if (!silent) toast('Connection error — check if the backend is running', 'error');
        return null;
    }
}

