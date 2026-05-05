// ═══════════════════════════════════════
// Tab: Today's Lessons
// Renders assigned lessons for the current day
// ═══════════════════════════════════════

async function refreshLessons() {
    const headerEl = document.getElementById('lessons-header');
    const listEl = document.getElementById('lessons-list');
    if (!headerEl || !listEl) return;

    const today = todayStr();

    // ── Render header ──
    headerEl.innerHTML = buildLessonsHeader(today);

    // ── Guard: no profile selected ──
    if (!activeProfileId) {
        listEl.innerHTML = emptyState('Select a profile to see today\'s lessons.', 'profile');
        return;
    }

    // ── Show skeleton while loading ──
    listEl.innerHTML = buildSkeletons(3);

    try {
        // Fetch today's AND upcoming assignments (not excused), ordered by date
        const allAssignments = await fetchCurrentAndUpcoming(today);

        if (!allAssignments || allAssignments.length === 0) {
            listEl.innerHTML = emptyState(
                isTeacher()
                    ? 'No lessons assigned. Use the button above to assign one.'
                    : 'No lessons assigned \u2014 enjoy a free day!',
                'empty'
            );
            updateLessonsCount(headerEl, 0, 0);
            return;
        }

        // Split into today vs upcoming
        const todayAssignments = allAssignments.filter(a => a.assigned_date === today);
        const upcomingAssignments = allAssignments.filter(a => a.assigned_date > today);

        // Collect unique lesson IDs and fetch lesson details
        const lessonIds = [...new Set(allAssignments.map(a => a.lesson_id).filter(Boolean))];
        const lessonsMap = await fetchLessonsMap(lessonIds);

        // Build today section
        const completedCount = todayAssignments.filter(a => a.status === 'completed').length;
        updateLessonsCount(headerEl, completedCount, todayAssignments.length);

        var html = '';

        if (todayAssignments.length > 0) {
            html += todayAssignments.map(a => {
                const lesson = lessonsMap[a.lesson_id] || {};
                return buildLessonCard(a, lesson);
            }).join('');
        } else {
            html += '<div style="text-align:center;padding:1.5rem;color:var(--deft-txt-3);font-size:0.875rem;">No lessons for today \u2014 all caught up!</div>';
        }

        // Build upcoming section
        if (upcomingAssignments.length > 0) {
            html += '<div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--deft-border);">';
            html += '<h3 style="margin:0 0 0.75rem;font-size:0.8125rem;font-weight:600;color:var(--deft-txt-2);font-family:var(--deft-heading-font),sans-serif;text-transform:uppercase;letter-spacing:0.05em;">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="inline mr-1" style="vertical-align:-2px;"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
            html += 'Get Ahead \u2014 Upcoming Lessons</h3>';

            // Group by date
            var dateGroups = {};
            upcomingAssignments.forEach(function(a) {
                if (!dateGroups[a.assigned_date]) dateGroups[a.assigned_date] = [];
                dateGroups[a.assigned_date].push(a);
            });

            Object.keys(dateGroups).sort().forEach(function(date) {
                var dayLabel = formatDate(date);
                var isWeekend = (function() { var d = new Date(date + 'T00:00:00'); return d.getDay() === 0 || d.getDay() === 6; })();
                html += '<div style="margin-bottom:0.5rem;font-size:0.75rem;font-weight:600;color:var(--deft-txt-3);">' + escapeHtml(dayLabel) + '</div>';
                dateGroups[date].forEach(function(a) {
                    var lesson = lessonsMap[a.lesson_id] || {};
                    html += buildLessonCard(a, lesson);
                });
            });

            html += '</div>';
        }

        // Daily Activities section (UBR-0114) - links to history/typing/vocab.
        // Only shown to students; teachers see lesson management on this tab.
        if (isStudent()) {
            html += buildDailyActivitiesSection(today);
        }

        listEl.innerHTML = html;

    } catch (err) {
        console.error('refreshLessons error:', err);
        listEl.innerHTML = emptyState('Something went wrong loading lessons.', 'error');
    }
}

// ═══════════════════════════════════════
// DAILY ACTIVITIES (UBR-0114)
// Lists the non-lesson school activities (history, typing, vocabulary) so
// the student can see their full day in one place. History uses the same
// hist-read-<profile>-<factId> localStorage key set on the History page; the
// other two link out without completion tracking until those tabs add it.
// ═══════════════════════════════════════

// Local copy of the history read-state check (the History tab uses the same
// localStorage key) so tab-history.js doesn't need to be loaded on the Today
// page just for one lookup.
function _todayTabIsHistoryFactRead(factId) {
    if (!factId) return false;
    const profileId = (typeof activeProfileId !== 'undefined' && activeProfileId) || 'anon';
    try { return localStorage.getItem('hist-read-' + profileId + '-' + factId) === '1'; }
    catch (e) { return false; }
}

async function buildDailyActivitiesSectionData(today) {
    // Fetch today's history fact id (if any) so we can check the read flag.
    const factRows = await supabaseSelect('school_history_facts',
        `scheduled_date=eq.${today}&select=fact_id,title&limit=1`);
    const fact = (factRows && factRows[0]) || null;
    return { fact };
}

function buildDailyActivitiesSection(today) {
    // Render placeholder synchronously, then populate async (the lessons list
    // needs to render immediately; the fact lookup can be slow).
    setTimeout(function() {
        buildDailyActivitiesSectionData(today).then(function(data) {
            const target = document.getElementById('daily-activities-list');
            if (target) target.innerHTML = renderDailyActivities(data, today);
        });
    }, 0);

    return '<div style="margin-top:1.75rem;padding-top:1rem;border-top:1px solid var(--deft-border);">' +
        '<h3 style="margin:0 0 0.75rem;font-size:0.8125rem;font-weight:600;color:var(--deft-txt-2);' +
        'font-family:var(--deft-heading-font),sans-serif;text-transform:uppercase;letter-spacing:0.05em;">' +
        'Daily Activities</h3>' +
        '<div id="daily-activities-list" style="display:flex;flex-direction:column;gap:8px;"></div>' +
        '</div>';
}

function renderDailyActivities(data, today) {
    const fact = data.fact;
    const factRead = fact && _todayTabIsHistoryFactRead(fact.fact_id);
    const items = [
        {
            href: '/school/history',
            label: 'Today’s History Fact',
            sub: fact ? fact.title : 'No fact scheduled for today',
            done: !!factRead,
            disabled: !fact
        },
        { href: '/school/typing',     label: 'Typing Practice',  sub: 'Build accuracy and speed', done: false },
        { href: '/school/vocabulary', label: 'Vocabulary Study', sub: 'Review today’s words', done: false },
        { href: '/school/flashcards', label: 'Flashcards',       sub: 'Quick review',             done: false }
    ];
    return items.map(function(it) {
        const checkSvg = it.done
            ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;"><circle cx="8" cy="8" r="7" stroke="var(--deft-success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--deft-success)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;"><circle cx="8" cy="8" r="7" stroke="var(--deft-txt-3)" stroke-width="1.5" stroke-dasharray="2 2"/></svg>';
        const titleColor = it.disabled ? 'var(--deft-txt-3)' : 'var(--deft-txt)';
        const subColor   = it.disabled ? 'var(--deft-txt-3)' : 'var(--deft-txt-2)';
        const opacity    = it.disabled ? '0.6' : '1';
        const tag = it.disabled ? 'div' : 'a';
        const hrefAttr = it.disabled ? '' : ' href="' + it.href + '"';
        return '<' + tag + hrefAttr + ' style="display:flex;align-items:center;gap:12px;' +
               'padding:12px 14px;border-radius:10px;background:var(--deft-surface-el);' +
               'border:1px solid var(--deft-border);opacity:' + opacity + ';' +
               'text-decoration:none;transition:border-color 0.15s,background 0.15s;"' +
               (it.disabled ? '' : ' onmouseenter="this.style.borderColor=\'var(--deft-accent)\'" onmouseleave="this.style.borderColor=\'var(--deft-border)\'"') +
               '>' +
                 checkSvg +
                 '<div style="flex:1;min-width:0;">' +
                   '<div style="font-size:13px;font-weight:600;color:' + titleColor + ';font-family:var(--deft-heading-font),sans-serif;">' + escapeHtml(it.label) + '</div>' +
                   '<div style="font-size:12px;color:' + subColor + ';margin-top:2px;font-family:var(--deft-body-font),sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(it.sub || '') + '</div>' +
                 '</div>' +
                 (it.disabled ? '' : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;color:var(--deft-txt-3);"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>') +
               '</' + tag + '>';
    }).join('');
}

// ═══════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════

async function fetchCurrentAndUpcoming(today) {
    // Fetch today + next 14 days of assignments (allows working ahead by 2 weeks)
    var futureDate = (function() {
        var d = new Date(today + 'T00:00:00');
        d.setDate(d.getDate() + 14);
        return d.toISOString().split('T')[0];
    })();

    let query = `assigned_date=gte.${today}&assigned_date=lte.${futureDate}&status=neq.excused&select=assignment_id,lesson_id,student_id,status,assigned_date,completed_at&order=assigned_date,created_at`;

    if (isStudent()) {
        query += `&student_id=eq.${activeProfileId}`;
    }

    return await supabaseSelect('school_assignments', query);
}

async function fetchLessonsMap(lessonIds) {
    if (!lessonIds.length) return {};

    const idsParam = lessonIds.map(id => `"${id}"`).join(',');
    const lessons = await supabaseSelect(
        'school_lessons',
        `lesson_id=in.(${idsParam})&select=lesson_id,title,subject,description`
    );

    const map = {};
    if (lessons) {
        lessons.forEach(l => { map[l.lesson_id] = l; });
    }
    return map;
}

// ═══════════════════════════════════════
// HEADER
// ═══════════════════════════════════════

function buildLessonsHeader(today) {
    const dateLabel = formatDate(today);
    const assignBtn = isTeacher()
        ? `<button onclick="openLessonAssignModal()"
                style="display:inline-flex;align-items:center;gap:6px;
                       padding:8px 16px;border-radius:8px;border:none;
                       background:var(--deft-accent);color:#0F1008;
                       font-size:13px;font-weight:600;cursor:pointer;
                       font-family:var(--deft-body-font),sans-serif;
                       transition:opacity 0.15s;"
                onmouseenter="this.style.opacity='0.85'"
                onmouseleave="this.style.opacity='1'"
                aria-label="Assign a new lesson">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                Assign Lesson
            </button>`
        : '';

    return `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
                <h2 style="margin:0;font-size:18px;font-weight:700;
                           color:var(--deft-txt);font-family:var(--deft-heading-font),sans-serif;">
                    Lessons
                </h2>
                <p style="margin:4px 0 0;font-size:13px;color:var(--deft-txt-3);
                          font-family:var(--deft-body-font),sans-serif;">
                    ${escapeHtml(dateLabel)}
                    <span id="lessons-count" style="margin-left:8px;"></span>
                </p>
            </div>
            ${assignBtn}
        </div>
    `;
}

function updateLessonsCount(headerEl, completed, total) {
    const countEl = headerEl.querySelector('#lessons-count');
    if (!countEl) return;

    if (total === 0) {
        countEl.textContent = '';
        return;
    }

    const allDone = completed === total;
    const color = allDone ? 'var(--deft-success)' : 'var(--deft-txt-2)';

    countEl.innerHTML = `<span style="color:${color};font-weight:600;">` +
        `${completed} of ${total} completed` +
        (allDone ? ' \u2713' : '') +
        `</span>`;
}

// ═══════════════════════════════════════
// LESSON CARD
// ═══════════════════════════════════════

function buildLessonCard(assignment, lesson) {
    const subject = lesson.subject || 'other';
    const style = getSubjectStyle(subject);
    const title = escapeHtml(lesson.title || 'Untitled Lesson');
    const description = escapeHtml(lesson.description || '');
    const status = assignment.status || 'not_started';
    const statusUI = getStatusUI(status);
    const scoreHTML = buildScoreBadge(assignment, status);
    const questionInfo = lesson.question_count
        ? `<span style="font-size:12px;color:var(--deft-txt-3);">${lesson.question_count} question${lesson.question_count !== 1 ? 's' : ''}</span>`
        : '';

    const isClickable = status !== 'completed';
    const cursorStyle = isClickable ? 'cursor:pointer;' : 'cursor:default;';
    const hoverBg = isClickable ? 'var(--deft-surface-hi)' : 'var(--deft-surface-el)';

    // For teacher view: show student name if available
    const studentLabel = isTeacher() && assignment.student_id
        ? `<span style="font-size:11px;padding:2px 8px;border-radius:6px;
                        background:rgba(138,149,169,0.1);color:var(--deft-txt-3);
                        font-family:var(--deft-body-font),sans-serif;"
                 data-student-id="${escapeHtml(assignment.student_id)}">
               Student
           </span>`
        : '';

    return `
        <div class="lesson-card"
             role="button"
             tabindex="0"
             aria-label="${title} - ${statusUI.label}"
             style="display:flex;align-items:center;gap:14px;
                    background:var(--deft-surface-el);
                    border:1px solid var(--deft-border);
                    border-radius:12px;padding:16px;
                    transition:background 0.15s,border-color 0.15s;
                    ${cursorStyle}
                    font-family:var(--deft-body-font),sans-serif;"
             onclick="handleLessonClick('${escapeHtml(assignment.id)}','${escapeHtml(assignment.lesson_id)}','${title.replace(/'/g, "\\'")}')"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}"
             onmouseenter="this.style.background='${hoverBg}';this.style.borderColor='var(--deft-txt-3)';"
             onmouseleave="this.style.background='var(--deft-surface-el)';this.style.borderColor='var(--deft-border)';">

            ${buildSubjectBadge(style)}

            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:14px;font-weight:600;color:var(--deft-txt);
                                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;">
                        ${title}
                    </span>
                    <span style="font-size:11px;padding:2px 8px;border-radius:6px;
                                 background:${style.bg};color:${style.text};font-weight:600;
                                 text-transform:uppercase;letter-spacing:0.03em;">
                        ${escapeHtml(style.label)}
                    </span>
                    ${studentLabel}
                </div>
                <div style="display:flex;align-items:center;gap:12px;margin-top:4px;">
                    ${description
                        ? `<span style="font-size:12px;color:var(--deft-txt-2);
                                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                                        max-width:320px;">${description}</span>`
                        : ''}
                    ${questionInfo}
                </div>
            </div>

            <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
                ${scoreHTML}
                ${buildStatusIndicator(statusUI)}
            </div>
        </div>
    `;
}

function handleLessonClick(assignmentId, lessonId, title) {
    openLesson(assignmentId, lessonId, title);
}

// ═══════════════════════════════════════
// SUBJECT BADGE (left icon)
// ═══════════════════════════════════════

function buildSubjectBadge(style) {
    return `
        <div style="width:40px;height:40px;border-radius:10px;flex-shrink:0;
                    display:flex;align-items:center;justify-content:center;
                    background:${style.bg};color:${style.text};font-size:18px;"
             aria-hidden="true">
            ${getSubjectIcon(style.label)}
        </div>
    `;
}

function getSubjectIcon(label) {
    const icons = {
        'Math':            '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M9 3v12M5 5l8 8M13 5L5 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
        'Reading':         '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 3h5a2 2 0 012 2v10a1.5 1.5 0 00-1.5-1.5H2V3zM16 3h-5a2 2 0 00-2 2v10a1.5 1.5 0 011.5-1.5H16V3z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'Science':         '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 2v5L3 14a1.5 1.5 0 001.3 2.2h9.4A1.5 1.5 0 0015 14l-4-7V2M6 2h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'Social Studies':  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 9h13M9 2.5a10 10 0 013 6.5 10 10 0 01-3 6.5 10 10 0 01-3-6.5 10 10 0 013-6.5z" stroke="currentColor" stroke-width="1.3"/></svg>',
        'Writing':         '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M13 2.5l2.5 2.5L6 14.5l-3.5 1 1-3.5L13 2.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'Spelling':        '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 14h12M5.5 14L9 4l3.5 10M6.5 11h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'Typing':          '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="5" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 8h1M8.5 8h1M12 8h1M6 11h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    };
    return icons[label] || '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="2" fill="currentColor"/></svg>';
}

// ═══════════════════════════════════════
// STATUS INDICATOR
// ═══════════════════════════════════════

function getStatusUI(status) {
    switch (status) {
        case 'completed':
            return {
                label: 'Completed',
                color: 'var(--deft-success)',
                bg: 'var(--deft-success-dim)',
                icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            };
        case 'in_progress':
            return {
                label: 'In Progress',
                color: 'var(--deft-warning)',
                bg: 'var(--deft-warning-dim)',
                icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="3" fill="currentColor" opacity="0.6"/></svg>'
            };
        default: // not_started
            return {
                label: 'Not Started',
                color: 'var(--deft-txt-3)',
                bg: 'rgba(107,103,88,0.12)',
                icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.3"/></svg>'
            };
    }
}

function buildStatusIndicator(statusUI) {
    return `
        <div style="display:flex;align-items:center;gap:6px;
                    padding:4px 10px;border-radius:8px;
                    background:${statusUI.bg};color:${statusUI.color};
                    font-size:12px;font-weight:600;white-space:nowrap;"
             aria-label="Status: ${statusUI.label}">
            ${statusUI.icon}
            <span>${statusUI.label}</span>
        </div>
    `;
}

// ═══════════════════════════════════════
// SCORE BADGE
// ═══════════════════════════════════════

function buildScoreBadge(assignment, status) {
    if (status !== 'completed' || assignment.score == null) return '';

    const pct = Math.round(assignment.score);
    const grade = getLetterGrade(pct);

    return `
        <div style="display:flex;align-items:center;gap:6px;
                    padding:4px 10px;border-radius:8px;
                    background:${grade.color}18;
                    font-size:12px;font-weight:700;white-space:nowrap;"
             aria-label="Score: ${pct}% (${grade.grade})">
            <span style="color:${grade.color};font-size:15px;line-height:1;">${grade.grade}</span>
            <span style="color:var(--deft-txt-2);">${pct}%</span>
        </div>
    `;
}

// ═══════════════════════════════════════
// EMPTY / LOADING STATES
// ═══════════════════════════════════════

function emptyState(message, type) {
    const icons = {
        profile: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="12" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M6 27c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
        empty:   '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="5" y="8" width="22" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M12 15h8M12 19h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
        error:   '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M16 11v6M16 20v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    };

    const iconColor = type === 'error' ? 'var(--deft-danger)' : 'var(--deft-txt-3)';

    return `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    padding:48px 24px;text-align:center;color:var(--deft-txt-3);
                    font-family:var(--deft-body-font),sans-serif;">
            <div style="color:${iconColor};margin-bottom:12px;opacity:0.6;">
                ${icons[type] || icons.empty}
            </div>
            <p style="margin:0;font-size:14px;line-height:1.5;max-width:320px;">
                ${escapeHtml(message)}
            </p>
        </div>
    `;
}

function buildSkeletons(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div style="display:flex;align-items:center;gap:14px;
                        background:var(--deft-surface-el);
                        border:1px solid var(--deft-border);
                        border-radius:12px;padding:16px;
                        animation:skeleton-pulse 1.5s ease-in-out infinite;">
                <div style="width:40px;height:40px;border-radius:10px;
                            background:var(--deft-surface-hi);flex-shrink:0;"></div>
                <div style="flex:1;">
                    <div style="height:14px;width:${140 + i * 30}px;max-width:60%;
                                border-radius:4px;background:var(--deft-surface-hi);
                                margin-bottom:8px;"></div>
                    <div style="height:10px;width:${80 + i * 20}px;max-width:40%;
                                border-radius:4px;background:var(--deft-surface-hi);"></div>
                </div>
                <div style="width:80px;height:26px;border-radius:8px;
                            background:var(--deft-surface-hi);flex-shrink:0;"></div>
            </div>
        `;
    }
    return html;
}

// ═══════════════════════════════════════
// ASSIGN LESSON MODAL (Today tab)
// ═══════════════════════════════════════

async function openLessonAssignModal() {
    let modal = document.getElementById('modal-assign-lesson-today');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-assign-lesson-today';
        modal.className = 'modal-backdrop';
        modal.onclick = function(e) { if (e.target === modal) closeModal('modal-assign-lesson-today'); };
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
                    <h3 style="margin:0;font-size:15px;font-weight:700;color:var(--deft-txt);font-family:var(--deft-heading-font),sans-serif;">Assign Lesson</h3>
                    <button onclick="closeModal('modal-assign-lesson-today')" style="background:none;border:none;color:var(--deft-txt-3);cursor:pointer;padding:4px;" aria-label="Close">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    </button>
                </div>
                <div>
                    <label style="display:block;font-size:0.7rem;font-weight:600;color:var(--deft-txt-2);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:0.04em;">Date</label>
                    <input type="date" id="assign-today-date" style="width:100%;padding:0.5rem 0.625rem;font-size:0.8rem;color:var(--deft-txt);background:var(--deft-surface);border:1px solid var(--deft-border);border-radius:0.375rem;outline:none;" />

                    <label style="display:block;font-size:0.7rem;font-weight:600;color:var(--deft-txt-2);margin-bottom:0.375rem;margin-top:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Lesson</label>
                    <select id="assign-today-lesson" style="width:100%;padding:0.5rem 0.625rem;font-size:0.8rem;color:var(--deft-txt);background:var(--deft-surface);border:1px solid var(--deft-border);border-radius:0.375rem;outline:none;">
                        <option value="">Loading...</option>
                    </select>

                    <label style="display:block;font-size:0.7rem;font-weight:600;color:var(--deft-txt-2);margin-bottom:0.375rem;margin-top:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Student</label>
                    <select id="assign-today-student" style="width:100%;padding:0.5rem 0.625rem;font-size:0.8rem;color:var(--deft-txt);background:var(--deft-surface);border:1px solid var(--deft-border);border-radius:0.375rem;outline:none;">
                    </select>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1.25rem;">
                    <button onclick="closeModal('modal-assign-lesson-today')" style="padding:0.5rem 1rem;font-size:0.75rem;font-weight:600;border-radius:0.375rem;background:transparent;color:var(--deft-txt-2);border:1px solid var(--deft-border);cursor:pointer;">Cancel</button>
                    <button onclick="submitLessonAssignment()" style="padding:0.5rem 1rem;font-size:0.75rem;font-weight:600;border-radius:0.375rem;background:var(--deft-accent);color:#0D0F13;border:none;cursor:pointer;">Assign</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Pre-fill date
    const dateInput = document.getElementById('assign-today-date');
    if (dateInput) dateInput.value = todayStr();

    // Load lessons
    const lessonSelect = document.getElementById('assign-today-lesson');
    if (lessonSelect) {
        lessonSelect.innerHTML = '<option value="">Loading lessons...</option>';
        const lessons = await supabaseSelect('school_lessons', 'select=lesson_id,title,subject&order=subject,title');
        lessonSelect.innerHTML = '<option value="">-- Select a lesson --</option>';
        (lessons || []).forEach(l => {
            const style = getSubjectStyle(l.subject || 'other');
            lessonSelect.innerHTML += `<option value="${l.lesson_id}">${escapeHtml(l.title)} (${style.label})</option>`;
        });
    }

    // Load students
    const studentSelect = document.getElementById('assign-today-student');
    if (studentSelect) {
        studentSelect.innerHTML = '';
        const profiles = await supabaseSelect('deft_user_profiles', 'select=user_id,display_name,role&role=eq.student&order=display_name');
        if (profiles && profiles.length) {
            profiles.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.user_id;
                opt.textContent = p.display_name || 'Student';
                studentSelect.appendChild(opt);
            });
        } else {
            const allProfiles = await supabaseSelect('deft_user_profiles', 'select=user_id,display_name&order=display_name');
            (allProfiles || []).forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.user_id;
                opt.textContent = p.display_name || 'User';
                studentSelect.appendChild(opt);
            });
        }
    }

    openModal('modal-assign-lesson-today');
}

async function submitLessonAssignment() {
    const lessonId = document.getElementById('assign-today-lesson')?.value;
    const studentId = document.getElementById('assign-today-student')?.value;
    const assignedDate = document.getElementById('assign-today-date')?.value;

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
        closeModal('modal-assign-lesson-today');
        refreshLessons();
    }
}

// Inject skeleton keyframes if not already present
(function injectSkeletonAnimation() {
    if (document.getElementById('skeleton-pulse-style')) return;
    const style = document.createElement('style');
    style.id = 'skeleton-pulse-style';
    style.textContent = `
        @keyframes skeleton-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    `;
    document.head.appendChild(style);
})();
