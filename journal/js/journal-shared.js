// =============================================
// Journal Shared — State, Init, View Switching, UI Utilities
// =============================================

// =============================================
// GLOBAL STATE
// =============================================
let activeProfileId = null;
let activeProfileName = 'Bradford';
let currentView = 'calendar';
let currentDate = getToday();
let currentMonth = getToday().substring(0, 7);
let currentEntry = null;
let quillEditor = null;
let isDirty = false;
let lastEditAt = 0;
let lastSavedAt = 0;
let autoSaveTimer = null;
let konvaStage = null;
let calendarKonvaStage = null;

// =============================================
// PROFILE SWITCHER
// =============================================
async function loadProfiles() {
    let profiles = await supabaseSelect('deft_user_profiles', 'select=user_id,display_name,email&order=display_name');

    // Fallback to cached profiles if Supabase fails
    if (!profiles) {
        try {
            const cached = JSON.parse(localStorage.getItem('rdgr-profiles-cache') || '{}');
            if (cached.profiles && Array.isArray(cached.profiles)) {
                profiles = cached.profiles;
            }
        } catch(e) {}
    }

    const dropdown = document.getElementById('profileDropdown');
    dropdown.innerHTML = '';

    if (profiles && profiles.length > 0) {
        profiles.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2';
            btn.style.cssText = 'color: var(--deft-txt, #E8ECF1); background: transparent;';
            btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.04)';
            btn.onmouseleave = () => btn.style.background = 'transparent';

            const initial = (p.display_name || p.email || '?')[0].toUpperCase();
            const isActive = p.user_id === activeProfileId;
            btn.innerHTML = `
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                     style="background: ${isActive ? 'rgba(6,214,160,0.15)' : 'rgba(255,255,255,0.06)'}; color: ${isActive ? '#06D6A0' : '#8A95A9'};">
                    ${initial}
                </div>
                <span>${p.display_name || p.email}</span>
                ${isActive ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="ml-auto"><path d="M2 6l3 3 5-5" stroke="#06D6A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
            `;
            btn.setAttribute('role', 'menuitem');
            btn.onclick = () => selectProfile(p.user_id, p.display_name || p.email);
            dropdown.appendChild(btn);
        });
    } else {
        const errDiv = document.createElement('div');
        errDiv.className = 'px-3 py-2 text-xs';
        errDiv.style.color = 'var(--deft-danger, #E85D5D)';
        errDiv.textContent = 'Could not load profiles. Check your connection.';
        dropdown.appendChild(errDiv);
    }

    // Divider + Sign Out
    const divider = document.createElement('div');
    divider.style.cssText = 'border-top: 1px solid var(--deft-border, #2A2E3D); margin: 4px 0;';
    dropdown.appendChild(divider);

    const signOutDiv = document.createElement('div');
    signOutDiv.style.cssText = 'padding-top: 0.25rem;';
    signOutDiv.innerHTML = '<button onclick="signOut()" class="w-full text-left px-3 py-2 text-xs flex items-center gap-2" style="color:#FF6B6B;background:transparent;" onmouseenter="this.style.background=\'rgba(255,107,107,0.06)\'" onmouseleave="this.style.background=\'transparent\'"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 10.5H2.5a1 1 0 01-1-1v-7a1 1 0 011-1h2M8 8.5l2.5-2.5L8 3.5M10.5 6h-6" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Sign Out</span></button>';
    dropdown.appendChild(signOutDiv);
}

function selectProfile(userId, name) {
    localStorage.setItem('rdgr-active-profile', JSON.stringify({ id: userId, name: name }));
    location.reload();
}

function signOut() {
    localStorage.removeItem('rdgr-session');
    localStorage.removeItem('rdgr-active-profile');
    location.reload();
}

// Migrate old localStorage key
if (!localStorage.getItem('rdgr-active-profile') && localStorage.getItem('deft-active-profile')) {
    localStorage.setItem('rdgr-active-profile', localStorage.getItem('deft-active-profile'));
    localStorage.removeItem('deft-active-profile');
}

function toggleProfileDropdown() {
    const dd = document.getElementById('profileDropdown');
    const btn = document.getElementById('profileBtn');
    dd.classList.toggle('hidden');
    btn.setAttribute('aria-expanded', !dd.classList.contains('hidden'));
    if (!dd.classList.contains('hidden')) {
        setTimeout(() => {
            document.addEventListener('click', closeProfileDropdown, { once: true });
        }, 0);
    }
}

function closeProfileDropdown(e) {
    const dd = document.getElementById('profileDropdown');
    if (!document.getElementById('profileSwitcher').contains(e.target)) {
        dd.classList.add('hidden');
        document.getElementById('profileBtn').setAttribute('aria-expanded', 'false');
    }
}

// =============================================
// INIT
// =============================================
async function initJournal() {
    // Load saved profile
    const savedProfile = localStorage.getItem('rdgr-active-profile');
    if (savedProfile) {
        try {
            const p = JSON.parse(savedProfile);
            activeProfileId = p.id;
            activeProfileName = p.name;
            const nameEl = document.getElementById('profileName');
            if (nameEl) nameEl.textContent = p.name;
            const avatarEl = document.getElementById('profileAvatar');
            if (avatarEl) avatarEl.textContent = p.name[0].toUpperCase();
        } catch(e) {}
    }

    // Apply theme
    if (typeof loadTheme === 'function') {
        const themeConfig = loadTheme();
        if (typeof applyTheme === 'function') applyTheme(themeConfig);
    }

    // Load profiles for switcher
    await loadProfiles();

    // Auto-select first profile if none saved
    if (!activeProfileId) {
        const profiles = await supabaseSelect('deft_user_profiles', 'select=user_id,display_name,email&order=display_name&limit=1');
        if (profiles && profiles.length > 0) {
            const p = profiles[0];
            selectProfile(p.user_id, p.display_name || p.email);
        }
    }

    // Reset date state
    currentDate = getToday();
    currentMonth = getToday().substring(0, 7);

    // Load initial view data
    if (activeProfileId) {
        if (typeof loadBackgrounds === 'function') loadBackgrounds();
        if (typeof loadCalendar === 'function') loadCalendar();
    }
}

// =============================================
// VIEW SWITCHING
// =============================================
function switchView(view) {
    currentView = view;
    activeStickerScope = (view === 'calendar') ? 'monthly' : 'daily';
    const views = ['calendar', 'daily', 'search', 'settings'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.style.display = v === view ? '' : 'none';
        const tab = document.getElementById(`tab-${v}`);
        if (tab) {
            tab.classList.toggle('active', v === view);
            tab.setAttribute('aria-selected', v === view ? 'true' : 'false');
        }
    });

    // Re-trigger reveal animations
    const activeView = document.getElementById(`view-${view}`);
    if (activeView) {
        const revealEls = activeView.querySelectorAll('.journal-reveal');
        revealEls.forEach(el => {
            el.style.animation = 'none';
            el.offsetHeight; // trigger reflow
            el.style.animation = '';
        });
    }

    // Lazy-load data for views
    if (view === 'calendar' && typeof loadCalendar === 'function') loadCalendar();
    if (view === 'daily' && typeof loadDailyView === 'function') loadDailyView();
}

// =============================================
// DAILY VIEW SHORTCUT
// =============================================
function openDailyView(dateStr) {
    currentDate = dateStr;
    switchView('daily');
}

// =============================================
// DATE HELPERS
// =============================================
function getToday() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function addDays(dateStr, n) {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function getMonthDates(yearMonth) {
    const parts = yearMonth.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const dates = [];

    // Pad start of calendar with previous month days (week starts Sunday)
    const startPad = firstDay.getDay();
    for (let i = startPad - 1; i >= 0; i--) {
        const d = new Date(year, month, -i);
        dates.push({
            date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
            inMonth: false
        });
    }

    // Days in current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const d = new Date(year, month, i);
        dates.push({
            date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
            inMonth: true
        });
    }

    // Pad end to complete last week (fill to 42 cells for 6-row grid)
    while (dates.length < 42) {
        const last = new Date(dates[dates.length - 1].date + 'T00:00:00');
        last.setDate(last.getDate() + 1);
        dates.push({
            date: last.getFullYear() + '-' + String(last.getMonth() + 1).padStart(2, '0') + '-' + String(last.getDate()).padStart(2, '0'),
            inMonth: false
        });
    }

    return dates;
}

// =============================================
// UTILITIES
// =============================================
function toast(message, type = 'success') {
    const container = document.getElementById('toasts');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    el.setAttribute('role', 'status');
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

// Keyboard: close modals on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.active').forEach(m => {
            m.classList.remove('active');
        });
        const dd = document.getElementById('profileDropdown');
        if (dd && !dd.classList.contains('hidden')) {
            dd.classList.add('hidden');
            const profileBtn = document.getElementById('profileBtn');
            if (profileBtn) profileBtn.setAttribute('aria-expanded', 'false');
        }
    }
});
