// =======================================
// School — Grades Tab
// =======================================

// =======================================
// STATE
// =======================================
let gradesData = {
    assignments: [],
    grades: {},
    lessons: {},
    expandedId: null
};

// Brianna's user_id for teacher viewing
const STUDENT_USER_ID = '3f0a5120-44d8-4835-a57c-2a4ecb55f7a3';

// =======================================
// REFRESH GRADES (main entry point)
// =======================================
async function refreshGrades() {
    if (!activeProfileId) return;

    const container = document.getElementById('grades-container');
    if (!container) return;

    container.innerHTML = renderGradesLoading();

    const viewUserId = isTeacher() ? STUDENT_USER_ID : activeProfileId;

    // Fetch all data in parallel
    const [assignments, grades, lessons] = await Promise.all([
        supabaseSelect('school_assignments',
            `user_id=eq.${viewUserId}&status=neq.excused&order=assigned_date.desc&select=*`
        ),
        supabaseSelect('school_grades',
            `user_id=eq.${viewUserId}&select=*`
        ),
        supabaseSelect('school_lessons',
            'select=lesson_id,title,subject'
        )
    ]);

    // Index grades by assignment_id
    gradesData.grades = {};
    if (grades && grades.length) {
        for (const g of grades) {
            if (!gradesData.grades[g.assignment_id]) {
                gradesData.grades[g.assignment_id] = [];
            }
            gradesData.grades[g.assignment_id].push(g);
        }
    }

    // Index lessons by id
    gradesData.lessons = {};
    if (lessons && lessons.length) {
        for (const l of lessons) {
            gradesData.lessons[l.lesson_id] = l;
        }
    }

    gradesData.assignments = assignments || [];
    gradesData.expandedId = null;

    renderGrades();
}

// =======================================
// STAT CALCULATIONS
// =======================================
function calcGradeStats() {
    let totalEarned = 0;
    let totalPossible = 0;
    let totalAdjustedEarned = 0;
    let totalAdjustedPossible = 0;
    let assignmentCount = 0;

    for (const a of gradesData.assignments) {
        const aGrades = gradesData.grades[a.assignment_id];
        if (!aGrades || !aGrades.length) continue;

        assignmentCount++;
        for (const g of aGrades) {
            const possible = g.points_possible || 100;
            const earned = g.score != null ? g.score : 0;
            totalEarned += earned;
            totalPossible += possible;

            // Adjusted: skip struck questions, apply overrides
            if (g.struck) continue;
            const adjEarned = g.override_score != null ? g.override_score : earned;
            totalAdjustedEarned += adjEarned;
            totalAdjustedPossible += possible;
        }
    }

    const overallPct = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
    const adjustedPct = totalAdjustedPossible > 0 ? (totalAdjustedEarned / totalAdjustedPossible) * 100 : 0;

    return {
        totalEarned: Math.round(totalEarned * 10) / 10,
        totalPossible: Math.round(totalPossible * 10) / 10,
        overallPct,
        adjustedPct,
        assignmentCount
    };
}

function calcAssignmentStats(assignmentId) {
    const aGrades = gradesData.grades[assignmentId];
    if (!aGrades || !aGrades.length) return { pct: 0, earned: 0, possible: 0 };

    let earned = 0;
    let possible = 0;
    for (const g of aGrades) {
        const pts = g.points_possible || 100;
        const sc = g.override_score != null ? g.override_score : (g.score != null ? g.score : 0);
        if (!g.struck) {
            earned += sc;
            possible += pts;
        }
    }
    const pct = possible > 0 ? (earned / possible) * 100 : 0;
    return { pct, earned: Math.round(earned * 10) / 10, possible: Math.round(possible * 10) / 10 };
}

// =======================================
// LOADING SKELETON
// =======================================
function renderGradesLoading() {
    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px;">
            ${[1,2,3,4].map(() => `
                <div style="background: var(--deft-surface-el); border: 1px solid var(--deft-border);
                    border-radius: 12px; padding: 20px; height: 88px;">
                    <div style="background: var(--deft-border); border-radius: 6px; height: 14px; width: 60%; margin-bottom: 12px;
                        animation: gradesPulse 1.5s ease-in-out infinite;"></div>
                    <div style="background: var(--deft-border); border-radius: 6px; height: 24px; width: 40%;
                        animation: gradesPulse 1.5s ease-in-out 0.2s infinite;"></div>
                </div>
            `).join('')}
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${[1,2,3].map(() => `
                <div style="background: var(--deft-surface-el); border: 1px solid var(--deft-border);
                    border-radius: 12px; padding: 16px; height: 56px;
                    animation: gradesPulse 1.5s ease-in-out 0.3s infinite;"></div>
            `).join('')}
        </div>
        <style>
            @keyframes gradesPulse {
                0%, 100% { opacity: 0.4; }
                50% { opacity: 0.8; }
            }
        </style>
    `;
}

// =======================================
// MAIN RENDER
// =======================================
function renderGrades() {
    const container = document.getElementById('grades-container');
    if (!container) return;

    const stats = calcGradeStats();
    const letterOverall = getLetterGrade(stats.overallPct);
    const letterAdjusted = getLetterGrade(stats.adjustedPct);

    // Empty state
    if (!gradesData.assignments.length) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--deft-txt-3);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                     style="margin: 0 auto 16px; opacity: 0.4;">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                    <path d="M9 7h6M9 11h4"/>
                </svg>
                <div style="font-size: 15px; font-weight: 600; color: var(--deft-txt-2); margin-bottom: 4px;">
                    No graded assignments yet
                </div>
                <div style="font-size: 13px;">Complete assignments to see grades here.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        ${renderStatsRow(stats, letterOverall, letterAdjusted)}
        <div id="grades-assignment-list" style="display: flex; flex-direction: column; gap: 8px; margin-top: 20px;">
            ${gradesData.assignments.map(a => renderAssignmentAccordion(a)).join('')}
        </div>
    `;
}

// =======================================
// STATS ROW (4 cards)
// =======================================
function renderStatsRow(stats, letterOverall, letterAdjusted) {
    const cardBase = `
        background: var(--deft-surface-el);
        border: 1px solid var(--deft-border);
        border-radius: 12px;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    `;
    const labelStyle = 'font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--deft-txt-3); font-weight: 600;';
    const valueStyle = 'font-size: 24px; font-weight: 700; line-height: 1.2;';

    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
            <!-- Overall Grade -->
            <div style="${cardBase}" role="group" aria-label="Overall grade">
                <span style="${labelStyle}">Overall Grade</span>
                <span style="${valueStyle} color: ${letterOverall.color};">
                    ${letterOverall.grade}
                </span>
                <span style="font-size: 12px; color: var(--deft-txt-2);">${stats.overallPct.toFixed(1)}%</span>
            </div>

            <!-- Total Score -->
            <div style="${cardBase}" role="group" aria-label="Total score">
                <span style="${labelStyle}">Total Score</span>
                <span style="${valueStyle} color: var(--deft-txt);">
                    ${stats.totalEarned}<span style="font-size: 14px; font-weight: 400; color: var(--deft-txt-3);"> / ${stats.totalPossible} pts</span>
                </span>
                <span style="font-size: 12px; color: var(--deft-txt-2);">${stats.assignmentCount} assignment${stats.assignmentCount !== 1 ? 's' : ''}</span>
            </div>

            <!-- Average Score -->
            <div style="${cardBase}" role="group" aria-label="Average score">
                <span style="${labelStyle}">Average Score</span>
                <span style="${valueStyle} color: ${letterOverall.color};">
                    ${stats.overallPct.toFixed(1)}%
                </span>
                <span style="font-size: 12px; color: var(--deft-txt-2);">raw average</span>
            </div>

            <!-- Adjusted Score -->
            <div style="${cardBase}" role="group" aria-label="Adjusted score">
                <span style="${labelStyle}">Adjusted Score</span>
                <span style="${valueStyle} color: ${letterAdjusted.color};">
                    ${stats.adjustedPct.toFixed(1)}%
                </span>
                <span style="font-size: 12px; color: var(--deft-txt-2);">after overrides</span>
            </div>
        </div>
    `;
}

// =======================================
// ASSIGNMENT ACCORDION ITEM
// =======================================
function renderAssignmentAccordion(assignment) {
    const lesson = gradesData.lessons[assignment.lesson_id] || {};
    const title = lesson.title || 'Untitled Lesson';
    const subject = lesson.subject || 'other';
    const subjectStyle = getSubjectStyle(subject);
    const aStats = calcAssignmentStats(assignment.assignment_id);
    const letterGrade = getLetterGrade(aStats.pct);
    const dateStr = formatDate(assignment.assigned_date || assignment.created_at);
    const isExpanded = gradesData.expandedId === assignment.assignment_id;

    return `
        <div class="grades-accordion-card" style="
            background: var(--deft-surface-el);
            border: 1px solid var(--deft-border);
            border-radius: 12px;
            overflow: hidden;
            transition: border-color 0.2s ease;
        ">
            <!-- Accordion header -->
            <button
                onclick="toggleGradeAccordion('${assignment.assignment_id}')"
                aria-expanded="${isExpanded}"
                aria-controls="grade-detail-${assignment.assignment_id}"
                style="
                    width: 100%; border: none; background: transparent; cursor: pointer;
                    padding: 14px 18px; display: flex; align-items: center; gap: 12px;
                    color: var(--deft-txt); text-align: left; transition: background 0.15s ease;
                "
                onmouseenter="this.style.background='rgba(255,255,255,0.03)'"
                onmouseleave="this.style.background='transparent'"
            >
                <!-- Subject badge -->
                <span style="
                    display: inline-flex; align-items: center; justify-content: center;
                    width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
                    background: ${subjectStyle.bg}; color: ${subjectStyle.text};
                    font-size: 12px; font-weight: 700; text-transform: uppercase;
                ">${subject.substring(0, 2).toUpperCase()}</span>

                <!-- Title + date -->
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${escapeHtml(title)}
                    </div>
                    <div style="font-size: 11px; color: var(--deft-txt-3); margin-top: 2px;">
                        ${dateStr}
                    </div>
                </div>

                <!-- Score + letter grade -->
                <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                    <span style="font-size: 13px; color: var(--deft-txt-2); font-variant-numeric: tabular-nums;">
                        ${aStats.earned} / ${aStats.possible}
                    </span>
                    <span style="
                        font-size: 13px; font-weight: 700; color: ${letterGrade.color};
                        min-width: 28px; text-align: center;
                    ">${letterGrade.grade}</span>
                    <span style="font-size: 13px; color: ${letterGrade.color}; font-weight: 600; font-variant-numeric: tabular-nums;">
                        ${aStats.pct.toFixed(0)}%
                    </span>

                    <!-- Chevron -->
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                         style="transition: transform 0.2s ease; transform: rotate(${isExpanded ? '180' : '0'}deg); flex-shrink: 0;">
                        <path d="M4 6l4 4 4-4" stroke="var(--deft-txt-3)" stroke-width="1.5"
                              stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </button>

            <!-- Accordion detail panel -->
            <div id="grade-detail-${assignment.assignment_id}"
                 role="region"
                 aria-label="Grade detail for ${escapeHtml(title)}"
                 style="display: ${isExpanded ? 'block' : 'none'};">
                ${isExpanded ? renderAssignmentDetail(assignment.assignment_id) : ''}
            </div>
        </div>
    `;
}

// =======================================
// TOGGLE ACCORDION
// =======================================
function toggleGradeAccordion(assignmentId) {
    const wasExpanded = gradesData.expandedId === assignmentId;
    gradesData.expandedId = wasExpanded ? null : assignmentId;

    if (!wasExpanded) {
        // Lazy-load detail for this assignment
        loadGradeDetail(assignmentId);
    } else {
        // Collapse: re-render the list
        const list = document.getElementById('grades-assignment-list');
        if (list) {
            list.innerHTML = gradesData.assignments.map(a => renderAssignmentAccordion(a)).join('');
        }
    }
}

// =======================================
// LAZY-LOAD DETAIL
// =======================================
async function loadGradeDetail(assignmentId) {
    // Show loading state first
    const detailEl = document.getElementById('grade-detail-' + assignmentId);
    const headerBtn = detailEl ? detailEl.previousElementSibling : null;

    // Update all accordion visuals
    const list = document.getElementById('grades-assignment-list');
    if (list) {
        list.innerHTML = gradesData.assignments.map(a => renderAssignmentAccordion(a)).join('');
    }

    const panel = document.getElementById('grade-detail-' + assignmentId);
    if (!panel) return;

    panel.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--deft-txt-3);">
            <div class="grades-spinner" style="
                width: 24px; height: 24px; border: 2px solid var(--deft-border);
                border-top-color: var(--deft-txt-2); border-radius: 50%;
                animation: gradesSpin 0.8s linear infinite; margin: 0 auto 8px;
            "></div>
            <span style="font-size: 12px;">Loading questions...</span>
        </div>
        <style>
            @keyframes gradesSpin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;

    // Fetch question-by-question data via schoolApi
    const result = await schoolApi('get_assignment_detail', { assignment_id: assignmentId }, { silent: true });

    if (result && result.data && result.data.questions) {
        // Cache the fetched questions for rendering
        if (!gradesData.questionCache) gradesData.questionCache = {};
        gradesData.questionCache[assignmentId] = result.data.questions;
    }

    // Re-render the panel with the data
    panel.innerHTML = renderAssignmentDetail(assignmentId);
}

// =======================================
// ASSIGNMENT DETAIL (question rows)
// =======================================
function renderAssignmentDetail(assignmentId) {
    const aGrades = gradesData.grades[assignmentId] || [];
    const cachedQuestions = (gradesData.questionCache && gradesData.questionCache[assignmentId]) || [];

    if (!aGrades.length && !cachedQuestions.length) {
        return `
            <div style="padding: 20px; text-align: center; color: var(--deft-txt-3); font-size: 13px;">
                No grade data available for this assignment.
            </div>
        `;
    }

    // Merge grade entries with question data
    const rows = aGrades.map((g, idx) => {
        const q = cachedQuestions.find(cq => cq.id === g.question_id) || cachedQuestions[idx] || {};
        return { grade: g, question: q, num: idx + 1 };
    });

    // If we have cached questions but no grades, show questions alone
    if (!aGrades.length && cachedQuestions.length) {
        return cachedQuestions.map((q, idx) => renderQuestionRowNoGrade(q, idx + 1)).join('');
    }

    const teacherControls = isTeacher() ? `
        <div data-role-min="admin" style="
            padding: 8px 18px 12px; display: flex; gap: 8px; justify-content: flex-end;
            border-top: 1px solid var(--deft-border);
        ">
            <button onclick="excuseAssignment('${assignmentId}')" style="
                background: transparent; border: 1px solid var(--deft-warning);
                color: var(--deft-warning); border-radius: 8px; padding: 6px 14px;
                font-size: 12px; font-weight: 600; cursor: pointer;
                transition: background 0.15s ease;
            " onmouseenter="this.style.background='rgba(251,191,36,0.1)'"
               onmouseleave="this.style.background='transparent'">
                Excuse Assignment
            </button>
        </div>
    ` : '';

    return `
        <!-- Question table header -->
        <div style="
            display: grid;
            grid-template-columns: 36px 1.5fr 1fr 1fr 70px 60px ${isTeacher() ? '120px' : ''};
            gap: 4px; padding: 6px 18px;
            font-size: 11px; font-weight: 600; text-transform: uppercase;
            letter-spacing: 0.05em; color: var(--deft-txt-3);
            border-top: 1px solid var(--deft-border);
            background: rgba(255,255,255,0.015);
        " role="row" aria-hidden="true">
            <span>#</span>
            <span>Question</span>
            <span>Student Answer</span>
            <span>Correct Answer</span>
            <span>Score</span>
            <span>Status</span>
            ${isTeacher() ? '<span style="text-align: right;">Actions</span>' : ''}
        </div>

        <!-- Question rows -->
        ${rows.map(r => renderQuestionRow(r, assignmentId)).join('')}

        <!-- AI Feedback section -->
        ${renderAiFeedbackSection(assignmentId, rows)}

        <!-- Teacher assignment-level controls -->
        ${teacherControls}
    `;
}

// =======================================
// QUESTION ROW
// =======================================
function renderQuestionRow(row, assignmentId) {
    const g = row.grade;
    const q = row.question;
    const num = row.num;

    const isStruck = g.struck === true;
    const hasOverride = g.override_score != null;
    const score = hasOverride ? g.override_score : (g.score != null ? g.score : null);
    const possible = g.points_possible || 100;
    const scorePct = possible > 0 && score != null ? (score / possible) * 100 : null;
    const isPending = score == null && !isStruck;

    // Status determination
    let statusLabel = 'Pending';
    let statusColor = 'var(--deft-txt-3)';
    let statusBg = 'rgba(148,163,184,0.1)';
    let rowBorderLeft = 'transparent';

    if (isStruck) {
        statusLabel = 'Struck';
        statusColor = 'var(--deft-warning)';
        statusBg = 'rgba(251,191,36,0.1)';
        rowBorderLeft = 'var(--deft-warning)';
    } else if (isPending) {
        statusLabel = 'Pending';
        statusColor = 'var(--deft-txt-3)';
        statusBg = 'rgba(148,163,184,0.1)';
        rowBorderLeft = 'var(--deft-border)';
    } else if (scorePct >= 80) {
        statusLabel = 'Correct';
        statusColor = 'var(--deft-success)';
        statusBg = 'rgba(6,214,160,0.1)';
        rowBorderLeft = 'var(--deft-success)';
    } else if (scorePct > 0) {
        statusLabel = 'Partial';
        statusColor = 'var(--deft-warning)';
        statusBg = 'rgba(251,191,36,0.1)';
        rowBorderLeft = 'var(--deft-warning)';
    } else {
        statusLabel = 'Incorrect';
        statusColor = 'var(--deft-danger)';
        statusBg = 'rgba(255,107,107,0.1)';
        rowBorderLeft = 'var(--deft-danger)';
    }

    // Truncate text helper
    const truncate = (txt, max) => {
        if (!txt) return '<span style="color:var(--deft-txt-3);font-style:italic;">--</span>';
        const clean = escapeHtml(txt);
        return clean.length > max
            ? `<span title="${clean}">${clean.substring(0, max)}...</span>`
            : clean;
    };

    const questionText = q.question_text || g.question_text || '';
    const studentAnswer = q.student_answer || g.student_answer || '';
    const correctAnswer = q.correct_answer || g.correct_answer || '';

    const struckStyle = isStruck ? 'text-decoration: line-through; opacity: 0.5;' : '';

    const teacherActions = isTeacher() ? `
        <span style="display: flex; gap: 4px; justify-content: flex-end;">
            <button onclick="openOverrideInline('${assignmentId}', '${g.answer_id}', ${score || 0}, ${possible})"
                    title="Override score"
                    style="background: transparent; border: 1px solid var(--deft-border); color: var(--deft-txt-2);
                           border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;
                           transition: border-color 0.15s ease, color 0.15s ease;"
                    onmouseenter="this.style.borderColor='var(--deft-txt-2)';this.style.color='var(--deft-txt)'"
                    onmouseleave="this.style.borderColor='var(--deft-border)';this.style.color='var(--deft-txt-2)'">
                Edit
            </button>
            <button onclick="toggleStrike('${assignmentId}', '${g.answer_id}', ${!isStruck})"
                    title="${isStruck ? 'Unstrike' : 'Strike'} question"
                    style="background: transparent; border: 1px solid ${isStruck ? 'var(--deft-warning)' : 'var(--deft-border)'};
                           color: ${isStruck ? 'var(--deft-warning)' : 'var(--deft-txt-3)'};
                           border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;
                           transition: border-color 0.15s ease, color 0.15s ease;"
                    onmouseenter="this.style.borderColor='var(--deft-warning)';this.style.color='var(--deft-warning)'"
                    onmouseleave="this.style.borderColor='${isStruck ? 'var(--deft-warning)' : 'var(--deft-border)'}';this.style.color='${isStruck ? 'var(--deft-warning)' : 'var(--deft-txt-3)'}'">
                ${isStruck ? 'Undo' : 'Strike'}
            </button>
        </span>
    ` : '';

    return `
        <div id="grade-row-${g.answer_id}" style="
            display: grid;
            grid-template-columns: 36px 1.5fr 1fr 1fr 70px 60px ${isTeacher() ? '120px' : ''};
            gap: 4px; padding: 8px 18px; align-items: center;
            border-top: 1px solid rgba(255,255,255,0.03);
            border-left: 3px solid ${rowBorderLeft};
            font-size: 13px; color: var(--deft-txt);
            transition: background 0.15s ease;
            ${struckStyle}
        " role="row"
           onmouseenter="this.style.background='rgba(255,255,255,0.02)'"
           onmouseleave="this.style.background='transparent'">

            <!-- # -->
            <span style="color: var(--deft-txt-3); font-weight: 600; font-variant-numeric: tabular-nums;">
                ${num}
            </span>

            <!-- Question text -->
            <span style="line-height: 1.4; ${struckStyle}">${truncate(questionText, 60)}</span>

            <!-- Student answer -->
            <span style="color: var(--deft-txt-2); ${struckStyle}">${truncate(studentAnswer, 40)}</span>

            <!-- Correct answer -->
            <span style="color: var(--deft-txt-2); ${struckStyle}">${truncate(correctAnswer, 40)}</span>

            <!-- Score -->
            <span style="font-weight: 600; font-variant-numeric: tabular-nums; color: ${statusColor}; ${struckStyle}">
                ${score != null ? score + ' / ' + possible : '--'}
                ${hasOverride ? '<span title="Score overridden" style="font-size:10px;vertical-align:super;color:var(--deft-warning);">*</span>' : ''}
            </span>

            <!-- Status badge -->
            <span style="
                display: inline-flex; align-items: center; justify-content: center;
                padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;
                background: ${statusBg}; color: ${statusColor}; white-space: nowrap;
            ">${statusLabel}</span>

            <!-- Teacher actions -->
            ${teacherActions}
        </div>

        <!-- Inline override input (hidden by default) -->
        <div id="override-inline-${g.answer_id}" style="display: none;"></div>
    `;
}

// =======================================
// QUESTION ROW (no grade data)
// =======================================
function renderQuestionRowNoGrade(q, num) {
    return `
        <div style="
            display: grid; grid-template-columns: 36px 1fr; gap: 8px;
            padding: 8px 18px; align-items: start;
            border-top: 1px solid rgba(255,255,255,0.03);
            font-size: 13px; color: var(--deft-txt-2);
        ">
            <span style="color: var(--deft-txt-3); font-weight: 600;">${num}</span>
            <span>${escapeHtml(q.question_text || '--')}</span>
        </div>
    `;
}

// =======================================
// AI FEEDBACK SECTION
// =======================================
function renderAiFeedbackSection(assignmentId, rows) {
    // Collect feedback from grades or cached questions
    const feedbackItems = rows
        .map(r => {
            const fb = r.question.ai_feedback || r.grade.ai_feedback;
            return fb ? { num: r.num, feedback: fb } : null;
        })
        .filter(Boolean);

    if (!feedbackItems.length) return '';

    return `
        <div style="
            border-top: 1px solid var(--deft-border);
            padding: 12px 18px;
            background: rgba(255,255,255,0.01);
        ">
            <div style="font-size: 12px; font-weight: 600; color: var(--deft-txt-2);
                         text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                AI Feedback
            </div>
            ${feedbackItems.map(fi => `
                <div style="margin-bottom: 8px; padding-left: 12px; border-left: 2px solid var(--deft-border);">
                    <span style="font-size: 11px; color: var(--deft-txt-3); font-weight: 600;">Q${fi.num}</span>
                    <p style="font-size: 13px; color: var(--deft-txt-2); margin: 2px 0 0; line-height: 1.5;">
                        ${escapeHtml(fi.feedback)}
                    </p>
                </div>
            `).join('')}
        </div>
    `;
}

// =======================================
// TEACHER ACTIONS
// =======================================

// --- Override score inline ---
function openOverrideInline(assignmentId, gradeId, currentScore, maxPoints) {
    const container = document.getElementById('override-inline-' + gradeId);
    if (!container) return;

    // Toggle off if already open
    if (container.style.display !== 'none') {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'block';
    container.innerHTML = `
        <div style="
            padding: 10px 18px 10px 57px;
            background: rgba(255,255,255,0.02);
            display: flex; align-items: center; gap: 10px;
            border-top: 1px dashed var(--deft-border);
        ">
            <label style="font-size: 12px; color: var(--deft-txt-2); white-space: nowrap;">New Score:</label>
            <input id="override-val-${gradeId}" type="number" min="0" max="${maxPoints}" value="${currentScore}"
                   style="
                       width: 64px; background: var(--deft-surface); border: 1px solid var(--deft-border);
                       border-radius: 6px; padding: 4px 8px; font-size: 13px; color: var(--deft-txt);
                       font-variant-numeric: tabular-nums; outline: none; text-align: center;
                   "
                   onfocus="this.style.borderColor='var(--deft-txt-2)'"
                   onblur="this.style.borderColor='var(--deft-border)'" />
            <span style="font-size: 12px; color: var(--deft-txt-3);">/ ${maxPoints}</span>

            <input id="override-reason-${gradeId}" type="text" placeholder="Reason (optional)"
                   style="
                       flex: 1; min-width: 100px; background: var(--deft-surface); border: 1px solid var(--deft-border);
                       border-radius: 6px; padding: 4px 10px; font-size: 12px; color: var(--deft-txt); outline: none;
                   "
                   onfocus="this.style.borderColor='var(--deft-txt-2)'"
                   onblur="this.style.borderColor='var(--deft-border)'" />

            <button onclick="submitOverride('${assignmentId}', '${gradeId}', ${maxPoints})" style="
                background: var(--deft-success); color: #fff; border: none; border-radius: 6px;
                padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
                transition: opacity 0.15s ease;
            " onmouseenter="this.style.opacity='0.85'" onmouseleave="this.style.opacity='1'">
                Save
            </button>
            <button onclick="document.getElementById('override-inline-${gradeId}').style.display='none'" style="
                background: transparent; border: 1px solid var(--deft-border); color: var(--deft-txt-3);
                border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer;
            ">Cancel</button>
        </div>
    `;

    // Focus the score input
    const inp = document.getElementById('override-val-' + gradeId);
    if (inp) inp.focus();
}

async function submitOverride(assignmentId, gradeId, maxPoints) {
    const scoreInput = document.getElementById('override-val-' + gradeId);
    const reasonInput = document.getElementById('override-reason-' + gradeId);
    if (!scoreInput) return;

    const newScore = parseFloat(scoreInput.value);
    if (isNaN(newScore) || newScore < 0 || newScore > maxPoints) {
        toast('Score must be between 0 and ' + maxPoints, 'error');
        return;
    }

    const reason = reasonInput ? reasonInput.value.trim() : '';

    const result = await schoolApi('override_score', {
        grade_id: gradeId,
        assignment_id: assignmentId,
        new_score: newScore,
        reason: reason
    });

    if (result) {
        toast('Score overridden', 'success');
        // Update local cache
        const aGrades = gradesData.grades[assignmentId];
        if (aGrades) {
            const g = aGrades.find(gr => gr.answer_id === gradeId);
            if (g) {
                g.override_score = newScore;
                g.override_reason = reason;
            }
        }
        // Re-render everything (stats + detail)
        renderGrades();
        // Re-expand the same assignment
        gradesData.expandedId = assignmentId;
        const list = document.getElementById('grades-assignment-list');
        if (list) {
            list.innerHTML = gradesData.assignments.map(a => renderAssignmentAccordion(a)).join('');
        }
        const panel = document.getElementById('grade-detail-' + assignmentId);
        if (panel) panel.innerHTML = renderAssignmentDetail(assignmentId);
    }
}

// --- Strike / Unstrike question ---
async function toggleStrike(assignmentId, gradeId, shouldStrike) {
    const result = await schoolApi('strike_question', {
        grade_id: gradeId,
        assignment_id: assignmentId,
        struck: shouldStrike
    });

    if (result) {
        toast(shouldStrike ? 'Question struck' : 'Strike removed', 'success');
        // Update local cache
        const aGrades = gradesData.grades[assignmentId];
        if (aGrades) {
            const g = aGrades.find(gr => gr.answer_id === gradeId);
            if (g) g.struck = shouldStrike;
        }
        // Re-render
        renderGrades();
        gradesData.expandedId = assignmentId;
        const list = document.getElementById('grades-assignment-list');
        if (list) {
            list.innerHTML = gradesData.assignments.map(a => renderAssignmentAccordion(a)).join('');
        }
        const panel = document.getElementById('grade-detail-' + assignmentId);
        if (panel) panel.innerHTML = renderAssignmentDetail(assignmentId);
    }
}

// --- Excuse entire assignment ---
async function excuseAssignment(assignmentId) {
    if (!confirm('Excuse this entire assignment? It will be excluded from grade calculations.')) return;

    const result = await schoolApi('excuse_assignment', {
        assignment_id: assignmentId
    });

    if (result) {
        toast('Assignment excused', 'success');
        // Remove from local data and re-render
        gradesData.assignments = gradesData.assignments.filter(a => a.assignment_id !== assignmentId);
        delete gradesData.grades[assignmentId];
        gradesData.expandedId = null;
        renderGrades();
    }
}
