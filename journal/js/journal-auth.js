// =============================================
// Journal Auth Gate
// =============================================

// =============================================
// AUTH GATE
// =============================================
let gateSelectedProfile = null;

function getCachedProfiles(callback) {
    var CACHE_KEY = 'rdgr-profiles-cache';
    var CACHE_TTL = 300000; // 5 minutes
    try {
        var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        if (cached.profiles && cached.ts && (Date.now() - cached.ts) < CACHE_TTL) {
            callback(cached.profiles);
            return;
        }
    } catch(e) {}
    var _SB_URL = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : 'https://yrwrswyjawmgtxrgbnim.supabase.co';
    var _SB_KEY = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8';
    fetch(`${_SB_URL}/rest/v1/deft_user_profiles?select=user_id,display_name,email,role&order=display_name`, {
        headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${_SB_KEY}` }
    }).then(r => r.json()).then(profiles => {
        if (profiles && Array.isArray(profiles) && profiles.length > 0) {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ profiles: profiles, ts: Date.now() }));
        }
        callback(profiles);
    }).catch(() => callback([]));
}

function loadGateProfiles() {
    getCachedProfiles(function(profiles) {
        const container = document.getElementById('gateProfiles');
        if (!container || !profiles || !profiles.length) return;
        const saved = localStorage.getItem('rdgr-active-profile');
        let savedId = null;
        if (saved) { try { savedId = JSON.parse(saved).id; } catch(e) {} }
        container.innerHTML = profiles.map(p => {
            const name = p.display_name || p.email || '?';
            const initial = name[0].toUpperCase();
            const colors = { 'Bradford': '#06D6A0', 'Dianna': '#A855F7', 'Brianna': '#4CC9F0' };
            const color = colors[name] || '#8A95A9';
            const role = p.role || 'admin';
            return `<button type="button" onclick="selectGateProfile('${p.user_id}','${name.replace(/'/g, '&#39;')}',this,'${role}')" class="gate-profile-btn flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all" style="background:rgba(255,255,255,0.02);border:2px solid transparent;cursor:pointer;min-width:80px;" onmouseenter="this.style.background='rgba(255,255,255,0.04)'" onmouseleave="if(!this.classList.contains('selected'))this.style.background='rgba(255,255,255,0.02)'">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style="background:${color}20;color:${color};border:2px solid transparent;">${initial}</div>
                <span class="text-xs" style="color:#8A95A9;">${name}</span>
            </button>`;
        }).join('');
        if (savedId) {
            const btns = container.querySelectorAll('.gate-profile-btn');
            btns.forEach(btn => {
                if (btn.getAttribute('onclick').includes(savedId)) {
                    btn.click();
                }
            });
        }
    });
}

function selectGateProfile(userId, name, el, role) {
    gateSelectedProfile = { id: userId, name: name, role: role || 'admin' };
    document.querySelectorAll('.gate-profile-btn').forEach(btn => {
        btn.classList.remove('selected');
        btn.style.background = 'rgba(255,255,255,0.02)';
        btn.style.borderColor = 'transparent';
        btn.querySelector('.w-10').style.borderColor = 'transparent';
    });
    el.classList.add('selected');
    el.style.background = 'rgba(255,255,255,0.06)';
    el.style.borderColor = 'rgba(6,214,160,0.4)';
    el.querySelector('.w-10').style.borderColor = el.querySelector('.w-10').style.color;
    const btn = document.getElementById('gateSubmitBtn');
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = 'Sign In as ' + name;
    document.getElementById('gateInput').focus();
}

function handleGate(e) {
    e.preventDefault();
    const input = document.getElementById('gateInput').value;
    if (input === 'Advance1!') {
        localStorage.setItem('rdgr-session', JSON.stringify({ authenticated: true, ts: Date.now() }));
        if (gateSelectedProfile) {
            localStorage.setItem('rdgr-active-profile', JSON.stringify(gateSelectedProfile));
            activeProfileId = gateSelectedProfile.id;
        }
        document.getElementById('gate').classList.add('hidden');
        document.getElementById('journalApp').style.opacity = '1';
        initJournal();
        return false;
    }
    document.getElementById('gateError').classList.add('show');
    document.getElementById('gateInput').value = '';
    document.getElementById('gateInput').focus();
    setTimeout(() => document.getElementById('gateError').classList.remove('show'), 2000);
    return false;
}

if (JSON.parse(localStorage.getItem('rdgr-session') || '{}').authenticated === true) {
    document.getElementById('gate').classList.add('hidden');
    document.getElementById('journalApp').style.opacity = '1';
    initJournal();
}

// Load gate profiles on page load (only if gate is visible)
if (!JSON.parse(localStorage.getItem('rdgr-session') || '{}').authenticated) {
    loadGateProfiles();
}
