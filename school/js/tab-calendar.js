// ═══════════════════════════════════════
// Tab: Calendar — Assignment Calendar Grid
// Teachers assign lessons to dates, students see what's due
// ═══════════════════════════════════════

let calYear = null;
let calMonth = null;
let calAssignments = [];
let calLessonsCache = null;

const CAL_MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
];
const CAL_DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ═══════════════════════════════════════
// MAIN ENTRY — called by switchView('calendar')
// ═══════════════════════════════════════
async function refreshCalendar() {
    if (calYear === null) {
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();
    }
    await loadCalendarAssignments();
    renderCalendarGrid();
    renderCalendarList();
}

// ═══════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════
function navCalMonth(delta) {
    calMonth += delta;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    if (calMonth > 11) { calMonth = 0; calYear++; }
    refreshCalendar();
}

function calGoToday() {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    refreshCalendar();
}

// ═══════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════
async function loadCalendarAssignments() {
    const startOfMonth = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
    const endDate = new Date(calYear, calMonth + 1, 0);
    const endOfMonth = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    let query = `assigned_date=gte.${startOfMonth}&assigned_date=lte.${endOfMonth}`;
    query += '&select=id,lesson_id,student_id,assigned_date,status,school_lessons(id,title,subject)';
    query += '&order=assigned_date';

    // Students only see their own assignments
    if (isStudent() && activeProfileId) {
        query += `&student_id=eq.${activeProfileId}`;
    }

    const data = await supabaseSelect('school_assignments', query);
    calAssignments = data || [];
}

async function loadAllLessons() {
    if (calLessonsCache) return calLessonsCache;
    const data = await supabaseSelect('school_lessons', 'select=id,title,subject&order=subject,title');
    calLessonsCache = data || [];
    return calLessonsCache;
}

// ═══════════════════════════════════════
// CALENDAR GRID RENDERING
// ═══════════════════════════════════════
function renderCalendarGrid() {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrev = new Date(calYear, calMonth, 0).getDate();
    const today = new Date();
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Build assignment lookup by date
    const assignmentsByDate = {};
    calAssignments.forEach(a => {
        if (!a.assigned_date) return;
        if (!assignmentsByDate[a.assigned_date]) assignmentsByDate[a.assigned_date] = [];
        assignmentsByDate[a.assigned_date].push(a);
    });

    // Header with navigation
    let html = `
        <div class="cal-nav">
            <button onclick="navCalMonth(-1)" class="cal-nav-btn" aria-label="Previous month">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button onclick="calGoToday()" class="cal-month-label">${CAL_MONTH_NAMES[calMonth]} ${calYear}</button>
            <button onclick="navCalMonth(1)" class="cal-nav-btn" aria-label="Next month">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
        <div class="cal-grid" role="grid" aria-label="Assignment calendar">
    `;

    // Day-of-week headers
    CAL_DAY_NAMES.forEach(d => {
        html += `<div class="cal-dow" role="columnheader">${d}</div>`;
    });

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrev - i;
        html += `<div class="cal-cell cal-cell--outside" role="gridcell" aria-disabled="true"><span class="cal-cell__num">${day}</span></div>`;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dateStr === todayDateStr;
        const dayAssignments = assignmentsByDate[dateStr] || [];
        const hasAssignments = dayAssignments.length > 0;
        const allCompleted = hasAssignments && dayAssignments.every(a => a.status === 'completed' || a.status === 'graded');

        let cellClasses = 'cal-cell';
        if (isToday) cellClasses += ' cal-cell--today';
        if (hasAssignments) cellClasses += ' cal-cell--has-items';

        // Build dots for each assignment (max 5 visible)
        let dotsHtml = '';
        if (hasAssignments) {
            const dots = dayAssignments.slice(0, 5).map(a => {
                const lesson = a.school_lessons || {};
                const style = getSubjectStyle(lesson.subject || 'other');
                return `<span class="cal-dot" style="background:${style.text};" title="${escapeHtml(lesson.title || 'Assignment')}"></span>`;
            }).join('');
            const overflow = dayAssignments.length > 5
                ? `<span class="cal-dot-overflow">+${dayAssignments.length - 5}</span>`
                : '';
            dotsHtml = `<div class="cal-dots">${dots}${overflow}</div>`;
        }

        // Green check overlay for all-completed days
        let checkHtml = '';
        if (allCompleted) {
            checkHtml = `<span class="cal-check" aria-label="All completed">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7l3 3 5-5" stroke="var(--deft-success, #06D6A0)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </span>`;
        }

        html += `<div class="${cellClasses}" role="gridcell" tabindex="0"
                      data-date="${dateStr}"
                      onclick="handleCalDayClick('${dateStr}')"
                      onkeydown="if(event.key==='Enter')handleCalDayClick('${dateStr}')"
                      aria-label="${CAL_MONTH_NAMES[calMonth]} ${d}, ${dayAssignments.length} assignment${dayAssignments.length !== 1 ? 's' : ''}">
            <span class="cal-cell__num">${d}</span>
            ${checkHtml}
            ${dotsHtml}
        </div>`;
    }

    // Next month padding (fill to complete last row)
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
        html += `<div class="cal-cell cal-cell--outside" role="gridcell" aria-disabled="true"><span class="cal-cell__num">${i}</span></div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

// ═══════════════════════════════════════
// ASSIGNMENT LIST BELOW CALENDAR
// ═══════════════════════════════════════
function renderCalendarList() {
    const listEl = document.getElementById('calendar-list');
    if (!listEl) return;

    if (!calAssignments.length) {
        listEl.innerHTML = `
            <div class="cal-list-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="opacity:0.3;margin-bottom:0.5rem;">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <span>No assignments this month</span>
            </div>`;
        return;
    }

    const sorted = [...calAssignments].sort((a, b) => (a.assigned_date || '').localeCompare(b.assigned_date || ''));

    let html = '<div class="cal-list-header">This Month\'s Assignments</div><div class="cal-list-items">';

    sorted.forEach(a => {
        const lesson = a.school_lessons || {};
        const style = getSubjectStyle(lesson.subject || 'other');
        const statusLabel = formatAssignmentStatus(a.status);
        const statusClass = `cal-status--${a.status || 'assigned'}`;

        let actionsHtml = '';
        if (isTeacher()) {
            actionsHtml = `
                <div class="cal-list-actions">
                    <button class="cal-list-action" onclick="event.stopPropagation();deleteCalAssignment('${a.id}')" title="Delete assignment" aria-label="Delete assignment">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M9 6.5v4M5 6.5v4M3.5 4l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>`;
        }

        html += `
            <div class="cal-list-item" onclick="handleCalListClick('${a.id}', '${lesson.id || ''}', '${escapeHtml(lesson.title || '')}')" tabindex="0" onkeydown="if(event.key==='Enter')this.click()">
                <div class="cal-list-date">${formatDate(a.assigned_date)}</div>
                <div class="cal-list-title">${escapeHtml(lesson.title || 'Untitled')}</div>
                <span class="cal-list-badge" style="background:${style.bg};color:${style.text};">${style.label}</span>
                <span class="cal-list-status ${statusClass}">${statusLabel}</span>
                ${actionsHtml}
            </div>`;
    });

    html += '</div>';
    listEl.innerHTML = html;
}

function formatAssignmentStatus(status) {
    const labels = {
        assigned: 'Assigned',
        in_progress: 'In Progress',
        completed: 'Completed',
        graded: 'Graded'
    };
    return labels[status] || 'Assigned';
}

// ═══════════════════════════════════════
// DAY CLICK HANDLERS
// ═══════════════════════════════════════
function handleCalDayClick(dateStr) {
    if (isTeacher()) {
        openAssignModal(dateStr);
    } else {
        // Student: switch to lessons tab filtered to that date
        const dayAssignments = calAssignments.filter(a => a.assigned_date === dateStr);
        if (dayAssignments.length > 0) {
            // If one assignment, open it directly
            if (dayAssignments.length === 1) {
                const a = dayAssignments[0];
                const lesson = a.school_lessons || {};
                openLesson(a.id, lesson.id, lesson.title || 'Untitled');
            } else {
                // Multiple: go to lessons view (it will show all)
                switchView('lessons');
            }
        }
    }
}

function handleCalListClick(assignmentId, lessonId, lessonTitle) {
    openLesson(assignmentId, lessonId, lessonTitle);
}

// ═══════════════════════════════════════
// ASSIGN LESSON MODAL (Teacher only)
// ═══════════════════════════════════════
async function openAssignModal(dateStr) {
    // Ensure modal exists, or build it
    let modal = document.getElementById('modal-assign-lesson');
    if (!modal) {
        modal = buildAssignModal();
        document.body.appendChild(modal);
    }

    // Pre-fill date
    const dateInput = document.getElementById('assign-date');
    if (dateInput) dateInput.value = dateStr || todayStr();

    // Load lessons into dropdown
    const select = document.getElementById('assign-lesson-select');
    if (select) {
        select.innerHTML = '<option value="">Loading lessons...</option>';
        const lessons = await loadAllLessons();
        select.innerHTML = '<option value="">-- Select a lesson --</option>';
        lessons.forEach(l => {
            const style = getSubjectStyle(l.subject || 'other');
            select.innerHTML += `<option value="${l.id}">${escapeHtml(l.title)} (${style.label})</option>`;
        });
    }

    // Load students into selector
    const studentSelect = document.getElementById('assign-student-select');
    if (studentSelect) {
        const profiles = await supabaseSelect('deft_user_profiles', 'select=user_id,display_name,role&role=eq.student&order=display_name');
        studentSelect.innerHTML = '';
        if (profiles && profiles.length) {
            profiles.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.user_id;
                opt.textContent = p.display_name || 'Student';
                studentSelect.appendChild(opt);
            });
        } else {
            // Fallback: show all profiles if no student-only filter works
            const allProfiles = await supabaseSelect('deft_user_profiles', 'select=user_id,display_name&order=display_name');
            (allProfiles || []).forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.user_id;
                opt.textContent = p.display_name || 'User';
                studentSelect.appendChild(opt);
            });
        }
    }

    openModal('modal-assign-lesson');
}

function buildAssignModal() {
    const backdrop = document.createElement('div');
    backdrop.id = 'modal-assign-lesson';
    backdrop.className = 'modal-backdrop';
    backdrop.onclick = function(e) { if (e.target === backdrop) closeModal('modal-assign-lesson'); };

    backdrop.innerHTML = `
        <div class="modal-content cal-modal">
            <div class="modal-header">
                <h3 class="modal-title">Assign Lesson</h3>
                <button onclick="closeModal('modal-assign-lesson')" class="modal-close" aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <label class="cal-field-label">Date</label>
                <input type="date" id="assign-date" class="cal-field-input" />

                <label class="cal-field-label">Lesson</label>
                <select id="assign-lesson-select" class="cal-field-input">
                    <option value="">-- Select a lesson --</option>
                </select>

                <label class="cal-field-label">Student</label>
                <select id="assign-student-select" class="cal-field-input"></select>
            </div>
            <div class="modal-footer">
                <button onclick="closeModal('modal-assign-lesson')" class="cal-btn cal-btn--ghost">Cancel</button>
                <button onclick="submitAssignment()" class="cal-btn cal-btn--primary">Assign</button>
            </div>
        </div>
    `;

    return backdrop;
}

async function submitAssignment() {
    const lessonId = document.getElementById('assign-lesson-select')?.value;
    const studentId = document.getElementById('assign-student-select')?.value;
    const assignedDate = document.getElementById('assign-date')?.value;

    if (!lessonId) { toast('Please select a lesson', 'error'); return; }
    if (!studentId) { toast('Please select a student', 'error'); return; }
    if (!assignedDate) { toast('Please select a date', 'error'); return; }

    const result = await schoolApi('assign_lesson', {
        lesson_id: lessonId,
        student_id: studentId,
        assigned_date: assignedDate
    });

    if (result) {
        toast('Lesson assigned');
        closeModal('modal-assign-lesson');
        calLessonsCache = null; // Bust cache in case new lessons appeared
        await refreshCalendar();
    }
}

// ═══════════════════════════════════════
// DELETE ASSIGNMENT (Teacher only)
// ═══════════════════════════════════════
async function deleteCalAssignment(assignmentId) {
    if (!confirm('Remove this assignment?')) return;
    const result = await supabaseWrite('school_assignments', 'DELETE', null, `id=eq.${assignmentId}`);
    if (result !== null) {
        toast('Assignment removed');
        await refreshCalendar();
    } else {
        toast('Failed to remove assignment', 'error');
    }
}

// ═══════════════════════════════════════
// INJECTED STYLES
// ═══════════════════════════════════════
(function injectCalendarStyles() {
    if (document.getElementById('cal-tab-styles')) return;
    const style = document.createElement('style');
    style.id = 'cal-tab-styles';
    style.textContent = `
        /* ── Calendar Navigation ── */
        .cal-nav {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }
        .cal-nav-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 0.375rem;
            border: 1px solid var(--deft-border, #2A2E3D);
            background: var(--deft-surface-el, #1A1D28);
            color: var(--deft-txt-2, #8A95A9);
            cursor: pointer;
            transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .cal-nav-btn:hover {
            background: rgba(255,255,255,0.06);
            color: var(--deft-txt, #E8ECF1);
            border-color: var(--deft-txt-3, #525E73);
        }
        .cal-month-label {
            font-size: 0.95rem;
            font-weight: 600;
            color: var(--deft-txt, #E8ECF1);
            min-width: 160px;
            text-align: center;
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem;
            transition: background 0.15s;
        }
        .cal-month-label:hover {
            background: rgba(255,255,255,0.04);
        }

        /* ── Calendar Grid ── */
        .cal-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 1px;
            background: var(--deft-border, #2A2E3D);
            border: 1px solid var(--deft-border, #2A2E3D);
            border-radius: 0.5rem;
            overflow: hidden;
        }

        /* Day-of-week headers */
        .cal-dow {
            padding: 0.5rem 0.25rem;
            text-align: center;
            font-size: 0.65rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--deft-txt-3, #525E73);
            background: var(--deft-surface-el, #1A1D28);
        }

        /* Day cells */
        .cal-cell {
            min-height: 80px;
            padding: 0.375rem;
            background: var(--deft-surface-el, #1A1D28);
            border: 1px solid transparent;
            cursor: pointer;
            position: relative;
            display: flex;
            flex-direction: column;
            transition: background 0.12s, border-color 0.12s;
        }
        .cal-cell:hover {
            background: rgba(255,255,255,0.03);
        }
        .cal-cell:focus {
            outline: none;
            border-color: var(--deft-accent, #06D6A0);
            box-shadow: inset 0 0 0 1px var(--deft-accent, #06D6A0);
        }

        /* Outside-month cells */
        .cal-cell--outside {
            cursor: default;
        }
        .cal-cell--outside .cal-cell__num {
            opacity: 0.25;
        }
        .cal-cell--outside:hover {
            background: var(--deft-surface-el, #1A1D28);
        }

        /* Today highlight */
        .cal-cell--today {
            border-color: var(--deft-accent, #06D6A0);
        }
        .cal-cell--today .cal-cell__num {
            background: var(--deft-accent, #06D6A0);
            color: #0D0F13;
            border-radius: 50%;
            width: 22px;
            height: 22px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
        }

        /* Day number */
        .cal-cell__num {
            font-size: 0.7rem;
            font-weight: 500;
            color: var(--deft-txt-2, #8A95A9);
            line-height: 1;
            margin-bottom: 0.25rem;
        }

        /* Assignment dots */
        .cal-dots {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            margin-top: auto;
        }
        .cal-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
            flex-shrink: 0;
        }
        .cal-dot-overflow {
            font-size: 0.55rem;
            color: var(--deft-txt-3, #525E73);
            line-height: 8px;
        }

        /* Completed check overlay */
        .cal-check {
            position: absolute;
            top: 0.25rem;
            right: 0.25rem;
            opacity: 0.8;
        }

        /* ── Monthly Assignment List ── */
        .cal-list-header {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--deft-txt-3, #525E73);
            margin: 1.5rem 0 0.75rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid var(--deft-border, #2A2E3D);
        }
        .cal-list-items {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .cal-list-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.625rem 0.75rem;
            background: var(--deft-surface-el, #1A1D28);
            border: 1px solid var(--deft-border, #2A2E3D);
            border-radius: 0.375rem;
            cursor: pointer;
            transition: background 0.12s, border-color 0.12s;
        }
        .cal-list-item:hover {
            background: rgba(255,255,255,0.03);
            border-color: var(--deft-txt-3, #525E73);
        }
        .cal-list-item:focus {
            outline: none;
            border-color: var(--deft-accent, #06D6A0);
        }
        .cal-list-date {
            font-size: 0.7rem;
            color: var(--deft-txt-3, #525E73);
            min-width: 90px;
            white-space: nowrap;
        }
        .cal-list-title {
            flex: 1;
            font-size: 0.8rem;
            font-weight: 500;
            color: var(--deft-txt, #E8ECF1);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cal-list-badge {
            font-size: 0.6rem;
            font-weight: 600;
            padding: 0.15rem 0.5rem;
            border-radius: 9999px;
            white-space: nowrap;
        }
        .cal-list-status {
            font-size: 0.6rem;
            font-weight: 500;
            white-space: nowrap;
        }
        .cal-status--assigned { color: var(--deft-txt-3, #525E73); }
        .cal-status--in_progress { color: var(--deft-warning, #FBBF24); }
        .cal-status--completed { color: var(--deft-success, #06D6A0); }
        .cal-status--graded { color: #60A5FA; }

        .cal-list-actions {
            display: flex;
            gap: 0.25rem;
            margin-left: auto;
        }
        .cal-list-action {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            border-radius: 0.25rem;
            border: none;
            background: transparent;
            color: var(--deft-txt-3, #525E73);
            cursor: pointer;
            transition: background 0.12s, color 0.12s;
        }
        .cal-list-action:hover {
            background: rgba(255,107,107,0.12);
            color: var(--deft-danger, #FF6B6B);
        }

        .cal-list-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            color: var(--deft-txt-3, #525E73);
            font-size: 0.8rem;
        }

        /* ── Assign Lesson Modal ── */
        .cal-modal {
            max-width: 400px;
            width: 100%;
        }
        .cal-field-label {
            display: block;
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--deft-txt-2, #8A95A9);
            margin-bottom: 0.375rem;
            margin-top: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .cal-field-label:first-child {
            margin-top: 0;
        }
        .cal-field-input {
            width: 100%;
            padding: 0.5rem 0.625rem;
            font-size: 0.8rem;
            color: var(--deft-txt, #E8ECF1);
            background: var(--deft-surface, #13151C);
            border: 1px solid var(--deft-border, #2A2E3D);
            border-radius: 0.375rem;
            outline: none;
            transition: border-color 0.15s;
            -webkit-appearance: none;
        }
        .cal-field-input:focus {
            border-color: var(--deft-accent, #06D6A0);
        }
        .cal-field-input option {
            background: var(--deft-surface, #13151C);
            color: var(--deft-txt, #E8ECF1);
        }

        /* Buttons */
        .cal-btn {
            padding: 0.5rem 1rem;
            font-size: 0.75rem;
            font-weight: 600;
            border-radius: 0.375rem;
            border: none;
            cursor: pointer;
            transition: background 0.15s, opacity 0.15s;
        }
        .cal-btn--primary {
            background: var(--deft-accent, #06D6A0);
            color: #0D0F13;
        }
        .cal-btn--primary:hover {
            opacity: 0.9;
        }
        .cal-btn--ghost {
            background: transparent;
            color: var(--deft-txt-2, #8A95A9);
            border: 1px solid var(--deft-border, #2A2E3D);
        }
        .cal-btn--ghost:hover {
            background: rgba(255,255,255,0.04);
            color: var(--deft-txt, #E8ECF1);
        }

        /* Modal shared styles (if not already defined) */
        .modal-backdrop {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: 100;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(4px);
        }
        .modal-backdrop.active {
            display: flex;
        }
        .modal-content {
            background: var(--deft-surface-el, #1A1D28);
            border: 1px solid var(--deft-border, #2A2E3D);
            border-radius: 0.75rem;
            box-shadow: 0 16px 48px rgba(0,0,0,0.5);
            overflow: hidden;
        }
        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 1.25rem;
            border-bottom: 1px solid var(--deft-border, #2A2E3D);
        }
        .modal-title {
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--deft-txt, #E8ECF1);
            margin: 0;
        }
        .modal-close {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 0.25rem;
            border: none;
            background: transparent;
            color: var(--deft-txt-3, #525E73);
            cursor: pointer;
            transition: background 0.12s, color 0.12s;
        }
        .modal-close:hover {
            background: rgba(255,255,255,0.06);
            color: var(--deft-txt, #E8ECF1);
        }
        .modal-body {
            padding: 1rem 1.25rem;
        }
        .modal-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 0.5rem;
            padding: 0.75rem 1.25rem;
            border-top: 1px solid var(--deft-border, #2A2E3D);
        }

        /* ── Responsive ── */
        @media (max-width: 640px) {
            .cal-cell {
                min-height: 56px;
                padding: 0.25rem;
            }
            .cal-cell__num {
                font-size: 0.6rem;
            }
            .cal-dot {
                width: 6px;
                height: 6px;
            }
            .cal-dow {
                font-size: 0.55rem;
                padding: 0.375rem 0.125rem;
            }
            .cal-list-item {
                flex-wrap: wrap;
                gap: 0.375rem;
            }
            .cal-list-date {
                min-width: auto;
            }
            .cal-list-title {
                flex-basis: 100%;
                order: -1;
            }
        }
    `;
    document.head.appendChild(style);
})();
