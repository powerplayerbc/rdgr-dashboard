// ═══════════════════════════════════════
// School Shared — State, Init, View Switching, UI Utilities
// ═══════════════════════════════════════

// Global state
let activeProfileId = null;
let activeProfileName = 'Bradford';
// UBR-0158/0160: default to 'student' (least-privilege) until the DB confirms otherwise.
// A stale localStorage entry without a role field would previously fall through to admin.
let userRole = 'student';
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

// UBR-0158/0160: re-fetch the active profile's role from the DB and
// reconcile with cached localStorage. Old caches saved before role tracking
// existed would default userRole=admin, leaking teacher-only UI to students
// (and hiding the student-only "Mark as Done" button from them). Calling
// this before refreshXxx() forces userRole to match the canonical DB value.
async function revalidateProfileFromDB() {
    if (!activeProfileId) return;
    try {
        const rows = await supabaseSelect(
            'deft_user_profiles',
            `user_id=eq.${activeProfileId}&select=user_id,display_name,role&limit=1`
        );
        if (rows && rows.length > 0) {
            const dbRole = rows[0].role || 'student';
            if (dbRole !== userRole) {
                userRole = dbRole;
                try {
                    const saved = JSON.parse(localStorage.getItem('rdgr-active-profile') || '{}');
                    saved.role = dbRole;
                    saved.name = rows[0].display_name || saved.name;
                    localStorage.setItem('rdgr-active-profile', JSON.stringify(saved));
                } catch (e) {}
                applyRoleVisibility();
            }
        }
    } catch (e) {
        // fire-and-forget: don't break page if revalidation fails
        console.warn('revalidateProfileFromDB error', e);
    }
}

// ═══════════════════════════════════════
// INIT (kept for backward compatibility -- each page now uses initPage())
// ═══════════════════════════════════════
async function initSchool() {
    // initPage() is defined per-page in the HTML and calls the right refresh function
    if (typeof initPage === 'function') initPage();
}

// Load current lesson from sessionStorage (for questions page)
function loadCurrentLesson() {
    try {
        var saved = sessionStorage.getItem('school-current-lesson');
        if (saved) {
            var data = JSON.parse(saved);
            currentAssignmentId = data.assignmentId;
            currentLessonId = data.lessonId;
            currentLessonTitle = data.title;
            return true;
        }
    } catch(e) {}
    return false;
}

// ═══════════════════════════════════════
// VIEW SWITCHING (each tab is now its own page)
// ═══════════════════════════════════════
function switchView(view) {
    // Each tab is a separate page -- navigate to it
    var routes = {
        lessons: '/school',
        today: '/school',
        questions: '/school/questions',
        grades: '/school/grades',
        calendar: '/school/calendar',
        history: '/school/history',
        vocabulary: '/school/vocabulary',
        flashcards: '/school/flashcards',
        typing: '/school/typing',
        teacher: '/school/teacher',
    };
    if (view === 'teacher' && isStudent()) {
        toast('Access restricted', 'error');
        return;
    }
    if (routes[view] && window.location.pathname !== routes[view]) {
        window.location.href = routes[view];
    }
}

// Navigate to a lesson's questions (separate page now)
function openLesson(assignmentId, lessonId, title) {
    currentAssignmentId = assignmentId;
    currentLessonId = lessonId;
    currentLessonTitle = title;
    // Store in sessionStorage so the questions page can pick it up
    sessionStorage.setItem('school-current-lesson', JSON.stringify({
        assignmentId: assignmentId,
        lessonId: lessonId,
        title: title
    }));
    window.location.href = '/school/questions';
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
    // Local-calendar today (YYYY-MM-DD). UTC-based toISOString() produced
    // off-by-one bugs for negative-UTC users after their afternoon (UBR-0115).
    const d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
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
