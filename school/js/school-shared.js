// ═══════════════════════════════════════
// School Shared — State, Init, View Switching, UI Utilities
// ═══════════════════════════════════════

// Global state
let activeProfileId = null;
let activeProfileName = 'Bradford';
let userRole = 'admin';
let currentView = 'lessons';
let currentLessonId = null;
let currentAssignmentId = null;
let currentLessonTitle = '';

// ═══════════════════════════════════════
// PROFILE SWITCHER
// ═══════════════════════════════════════
async function loadProfiles() {
    const profiles = await supabaseSelect('deft_user_profiles', 'select=user_id,display_name,email,role&order=display_name');
    const dropdown = document.getElementById('profileDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';

    if (profiles && profiles.length > 0) {
        const colors = { 'Bradford': '#06D6A0', 'Dianna': '#A855F7', 'Brianna': '#4CC9F0' };
        profiles.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2';
            btn.style.cssText = 'color: var(--deft-txt); background: transparent;';
            btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.04)';
            btn.onmouseleave = () => btn.style.background = 'transparent';

            const initial = (p.display_name || '?')[0].toUpperCase();
            const isActive = p.user_id === activeProfileId;
            const color = colors[p.display_name] || '#8A95A9';
            const roleLabel = p.role === 'student' ? '<span class="text-xs ml-auto" style="color:var(--deft-txt-3);">Student</span>' : '';
            btn.innerHTML = `
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                     style="background: ${color}20; color: ${color};">
                    ${initial}
                </div>
                <span>${p.display_name || p.email}</span>
                ${roleLabel}
                ${isActive ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="ml-1"><path d="M2 6l3 3 5-5" stroke="var(--deft-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
            `;
            btn.onclick = () => selectProfile(p.user_id, p.display_name || p.email, p.role);
            dropdown.appendChild(btn);
        });
    }

    // Sign Out
    const signOutDiv = document.createElement('div');
    signOutDiv.style.cssText = 'border-top: 1px solid var(--deft-border); margin-top: 0.25rem; padding-top: 0.25rem;';
    signOutDiv.innerHTML = '<button onclick="signOut()" class="w-full text-left px-3 py-2 text-xs flex items-center gap-2" style="color:var(--deft-danger);background:transparent;" onmouseenter="this.style.background=\'rgba(255,107,107,0.06)\'" onmouseleave="this.style.background=\'transparent\'"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 10.5H2.5a1 1 0 01-1-1v-7a1 1 0 011-1h2M8 8.5l2.5-2.5L8 3.5M10.5 6h-6" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Sign Out</span></button>';
    dropdown.appendChild(signOutDiv);
}

function signOut() {
    localStorage.removeItem('rdgr-session');
    localStorage.removeItem('rdgr-active-profile');
    location.reload();
}

function selectProfile(userId, name, role) {
    localStorage.setItem('rdgr-active-profile', JSON.stringify({ id: userId, name, role: role || 'admin' }));
    location.reload();
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
    }
}

// ═══════════════════════════════════════
// ROLE HELPERS
// ═══════════════════════════════════════
function isTeacher() { return userRole === 'admin'; }
function isStudent() { return userRole === 'student'; }

function applyRoleVisibility() {
    document.querySelectorAll('[data-role-min]').forEach(el => {
        const requiredRole = el.getAttribute('data-role-min');
        if (requiredRole === 'admin' && userRole !== 'admin') {
            el.style.display = 'none';
        }
    });
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
async function initSchool() {
    // Load saved profile
    const savedProfile = localStorage.getItem('rdgr-active-profile');
    if (savedProfile) {
        try {
            const p = JSON.parse(savedProfile);
            activeProfileId = p.id;
            activeProfileName = p.name;
            userRole = p.role || 'admin';
            const nameEl = document.getElementById('profileName');
            const avatarEl = document.getElementById('profileAvatar');
            if (nameEl) nameEl.textContent = p.name;
            if (avatarEl) avatarEl.textContent = p.name[0].toUpperCase();
        } catch(e) {}
    }

    // If role not cached, fetch from Supabase
    if (activeProfileId && !userRole) {
        const profiles = await supabaseSelect('deft_user_profiles', `user_id=eq.${activeProfileId}&select=role`);
        if (profiles && profiles[0]) {
            userRole = profiles[0].role || 'admin';
            // Update localStorage with role
            const saved = JSON.parse(localStorage.getItem('rdgr-active-profile') || '{}');
            saved.role = userRole;
            localStorage.setItem('rdgr-active-profile', JSON.stringify(saved));
        }
    }

    // Apply role-based UI
    applyRoleVisibility();

    // Load profiles for switcher
    await loadProfiles();

    // Check URL hash for deep link (e.g., #typing)
    const hash = window.location.hash.replace('#', '');
    if (hash && ['lessons', 'questions', 'grades', 'calendar', 'typing', 'teacher'].includes(hash)) {
        switchView(hash);
    } else {
        // Default view: lessons for student, calendar for teacher
        switchView(isStudent() ? 'lessons' : 'lessons');
    }
}

// ═══════════════════════════════════════
// VIEW SWITCHING
// ═══════════════════════════════════════
function switchView(view) {
    // Block student from teacher view
    if (view === 'teacher' && isStudent()) {
        toast('Access restricted', 'error');
        return;
    }

    currentView = view;
    const views = ['lessons', 'questions', 'grades', 'calendar', 'typing', 'teacher'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.style.display = v === view ? '' : 'none';
        const tab = document.getElementById(`tab-${v}`);
        if (tab) {
            tab.classList.toggle('active', v === view);
            tab.setAttribute('aria-selected', v === view ? 'true' : 'false');
        }
    });

    // Update hash for deep linking
    window.location.hash = view;

    // Lazy-load data for views
    if (view === 'lessons') refreshLessons();
    if (view === 'questions' && currentAssignmentId) refreshQuestions();
    if (view === 'grades') refreshGrades();
    if (view === 'calendar') refreshCalendar();
    if (view === 'typing') initTyping();
    if (view === 'teacher') refreshTeacher();
}

// Navigate to a lesson's questions
function openLesson(assignmentId, lessonId, title) {
    currentAssignmentId = assignmentId;
    currentLessonId = lessonId;
    currentLessonTitle = title;
    switchView('questions');
}

// ═══════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════
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

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
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
        }
    }
});
