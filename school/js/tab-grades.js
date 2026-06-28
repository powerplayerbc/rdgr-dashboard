// =======================================
// School — Grades Tab
// =======================================

// =======================================
// STATE
// =======================================
let gradesData = {
    assignments: [],
    grades: {},        // assignment_id -> single school_grades row (per-assignment schema)
    answers: {},       // assignment_id -> array of school_answers rows
    lessons: {},
    questions: {},     // lesson_id -> array of school_questions rows
    expandedId: null
};

// UBR-0156: resolve the actual student profile id for teacher view (the
// previous hardcoded UUID didn't match any real profile so the page was empty).
let _gradesViewStudentId = null;
async function resolveGradesViewStudentId() {
    if (_gradesViewStudentId) return _gradesViewStudentId;
    if (!isTeacher()) {
        _gradesViewStudentId = activeProfileId;
        return _gradesViewStudentId;
    }
    const rows = await supabaseSelect('deft_user_profiles', 'role=eq.student&select=user_id&limit=1');
    if (rows && rows.length) {
        _gradesViewStudentId = rows[0].user_id;
    } else {
        _gradesViewStudentId = activeProfileId;
    }
    return _gradesViewStudentId;
}

// =======================================
// REFRESH GRADES (main entry point)
// =======================================
async function refreshGrades() {
    if (!activeProfileId) return;

    const container = document.getElementById('grades-container');
    if (!container) return;

    container.innerHTML = renderGradesLoading();

    const viewUserId = await resolveGradesViewStudentId();
    if (!viewUserId) {
        container.innerHTML = renderGradesEmpty('No student profile to view.');
        return;
    }

    // UBR-0156: per-assignment grade summary from school_grades + per-question
    // answer rows from school_answers.
    // UBR-0162/0163: also load school_questions eagerly so we can recompute
    // earned_points on the fly (defensive — backend recalc fires on override
    // but frontend should not trust stored totals if any writer leaves them
    // stale).
    // UBR-0164: also fetch the daily-task summary for the new stats cards.
    // UBR-0169: also pull motivation events so the teacher can see engagement.
    // UBR-0202: typing data is shown over the whole quarter (the old 7-day window
    // hid practice that was >1 week old). Compute a quarter-start date.
    const _qStart = gradesQuarterStart();
    const [assignments, grades, lessons, answers, dailySummary, motivationEvents, vocabQuizzes, typingSessions, projects, weightRows] = await Promise.all([
        supabaseSelect('school_assignments',
            `student_id=eq.${viewUserId}&order=assigned_date.desc&select=*`
        ),
        supabaseSelect('school_grades',
            `student_id=eq.${viewUserId}&select=*`
        ),
        supabaseSelect('school_lessons',
            'select=lesson_id,title,subject'
        ),
        supabaseSelect('school_answers',
            `student_id=eq.${viewUserId}&select=*`
        ),
        supabaseRpc('get_daily_task_summary', { p_student_id: viewUserId, p_days: 7 }),
        supabaseSelect('school_motivation_events',
            `student_id=eq.${viewUserId}&select=event_type,assignment_id,lesson_id,created_at&order=created_at.desc&limit=1000`
        ),
        // UBR-0180/0178: vocab quiz attempts for the teacher review + grade-adjust tool.
        supabaseSelect('school_vocab_quizzes',
            `student_id=eq.${viewUserId}&select=*&order=created_at.desc`
        ),
        // UBR-0202: all typing sessions this quarter (for the quarter card + WPM/accuracy chart).
        supabaseSelect('school_typing_sessions',
            `student_id=eq.${viewUserId}&created_at=gte.${_qStart}&select=wpm,accuracy,duration_secs,created_at&order=created_at`
        ),
        // UBR-0199: external projects + grade-category weights for the weighted overall grade.
        supabaseSelect('school_projects',
            `student_id=eq.${viewUserId}&select=*&order=assigned_date.desc`
        ),
        supabaseSelect('school_grade_weights',
            `or=(student_id.eq.${viewUserId},student_id.eq.*)&select=student_id,category,weight`
        )
    ]);
    gradesData.vocabQuizzes = vocabQuizzes || [];
    gradesData.typingSessions = typingSessions || [];
    gradesData.projects = projects || [];
    // Per-student weights override the global '*' defaults.
    const _w = { lessons: 50, spelling: 20, typing: 10, history: 10, projects: 10 };
    (weightRows || []).filter(r => r.student_id === '*').forEach(r => { _w[r.category] = Number(r.weight); });
    (weightRows || []).filter(r => r.student_id === viewUserId).forEach(r => { _w[r.category] = Number(r.weight); });
    gradesData.gradeWeights = _w;

    // Per-assignment school_grades (one row per assignment)
    gradesData.grades = {};
    if (grades && grades.length) {
        for (const g of grades) {
            gradesData.grades[g.assignment_id] = g;
        }
    }

    // Per-assignment answers
    gradesData.answers = {};
    if (answers && answers.length) {
        for (const a of answers) {
            if (!gradesData.answers[a.assignment_id]) gradesData.answers[a.assignment_id] = [];
            gradesData.answers[a.assignment_id].push(a);
        }
    }

    // Lessons by id
    gradesData.lessons = {};
    if (lessons && lessons.length) {
        for (const l of lessons) {
            gradesData.lessons[l.lesson_id] = l;
        }
    }

    gradesData.assignments = assignments || [];
    gradesData.dailySummary = (dailySummary && dailySummary.summary) ? dailySummary.summary : null;
    gradesData.expandedId = null;

    // UBR-0169: aggregate motivation events globally and per-assignment so the
    // teacher Grades tab can show engagement at the top stat row AND on each
    // assignment's detail panel.
    gradesData.motivation = { total: { explanations_used: 0, videos_searched: 0, hints_used: 0 }, byAssignment: {} };
    if (motivationEvents && motivationEvents.length) {
        for (const ev of motivationEvents) {
            const t = gradesData.motivation.total;
            const aid = ev.assignment_id;
            if (aid) {
                if (!gradesData.motivation.byAssignment[aid]) {
                    gradesData.motivation.byAssignment[aid] = { explanations_used: 0, videos_searched: 0, hints_used: 0 };
                }
            }
            const inc = (key) => {
                t[key] = (t[key] || 0) + 1;
                if (aid) gradesData.motivation.byAssignment[aid][key] = (gradesData.motivation.byAssignment[aid][key] || 0) + 1;
            };
            if (ev.event_type === 'explanation_added') inc('explanations_used');
            else if (ev.event_type === 'video_search') inc('videos_searched');
            else if (ev.event_type === 'hint_used') inc('hints_used');
        }
    }

    // UBR-0162/0163: fetch school_questions for the lessons in this view, then
    // recompute per-assignment earned/total from school_answers + question
    // points. This makes the page resilient to any stale school_grades row.
    const lessonIds = Array.from(new Set((assignments || []).map(a => a.lesson_id).filter(Boolean)));
    if (lessonIds.length) {
        const lessonFilter = lessonIds.map(id => encodeURIComponent(id)).join(',');
        const questions = await supabaseSelect('school_questions',
            `lesson_id=in.(${lessonFilter})&select=question_id,lesson_id,points`);
        gradesData.questionPoints = {};
        if (questions && questions.length) {
            for (const q of questions) {
                gradesData.questionPoints[q.question_id] = Number(q.points) || 10;
            }
        }
    } else {
        gradesData.questionPoints = {};
    }

    // Recompute per-assignment totals from answers (overrides + strikes applied).
    gradesData.recomputed = {};
    for (const a of gradesData.assignments) {
        const ansArr = gradesData.answers[a.assignment_id] || [];
        let possible = 0, earned = 0, qCount = 0, correctCount = 0, struckCount = 0, pendingCount = 0;
        for (const an of ansArr) {
            const qPts = gradesData.questionPoints[an.question_id] || 10;
            qCount++;
            if (an.is_struck) { struckCount++; continue; }
            possible += qPts;
            const pct = (an.override_score != null) ? Number(an.override_score)
                       : (an.ai_score != null) ? Number(an.ai_score) : 0;
            earned += (pct / 100) * qPts;
            if (pct >= 90) correctCount++;
            if (an.check_status === 'checking' || an.check_status === 'pending') pendingCount++;
        }
        // UBR-0204: early-submission bonus. If the assignment is flagged early
        // (auto-detected from due_date vs completed_at, or set by the teacher),
        // add the bonus % to the earned points, capped at the possible total.
        // The bonus comes from the single global setting (school_grade_weights
        // early_bonus, editable in the Teacher area); a per-assignment value > 0
        // overrides it for that one assignment.
        const bonusPct = isAssignmentEarly(a) ? effectiveEarlyBonus(a) : 0;
        const earnedWithBonus = possible > 0 ? Math.min(possible, earned + (bonusPct / 100) * possible) : earned;
        const pctOut = possible > 0 ? (earnedWithBonus / possible) * 100 : 0;
        const letter = pctOut >= 90 ? 'A' : pctOut >= 80 ? 'B' : pctOut >= 70 ? 'C' : pctOut >= 60 ? 'D' : 'F';
        gradesData.recomputed[a.assignment_id] = {
            earned: Math.round(earnedWithBonus * 100) / 100,
            possible: Math.round(possible * 100) / 100,
            pct: Math.round(pctOut * 100) / 100,
            letter,
            qCount,
            correctCount,
            struckCount,
            pendingCount,
            earlyBonus: bonusPct
        };
    }

    renderGrades();
}

function renderGradesEmpty(msg) {
    return `
        <div style="text-align: center; padding: 60px 20px; color: var(--deft-txt-3);">
            <div style="font-size: 15px; font-weight: 600; color: var(--deft-txt-2); margin-bottom: 4px;">
                ${escapeHtml(msg)}
            </div>
        </div>
    `;
}

// =======================================
// QUARTER + WEIGHTED-CATEGORY GRADING (UBR-0199 / UBR-0202)
// =======================================
// Quarter start used for typing aggregates/chart. Aligns with the school
// semester window used elsewhere; falls back to a rolling 90-day window.
const GRADES_QUARTER_START = '2026-05-04';
function gradesQuarterStart() {
    try {
        const rolling = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
        // Use the later of the fixed semester start and the rolling window so we
        // never pull an unbounded history, but always cover the current quarter.
        return GRADES_QUARTER_START > rolling ? rolling : GRADES_QUARTER_START;
    } catch (e) { return GRADES_QUARTER_START; }
}

// UBR-0204: an assignment counts as "early" if the teacher explicitly flagged it,
// or it was completed on/before its due date.
function isAssignmentEarly(a) {
    if (!a) return false;
    if (a.is_early === true) return true;
    if (a.due_date && a.completed_at) {
        try { return (a.completed_at.slice(0, 10) <= a.due_date); } catch (e) { return false; }
    }
    return false;
}

// Effective early bonus % for an assignment: a per-assignment override (>0) wins,
// otherwise the single global setting (school_grade_weights early_bonus).
function effectiveEarlyBonus(a) {
    const per = Number(a && a.early_bonus_pct);
    if (per && per > 0) return per;
    return Number((gradesData.gradeWeights || {}).early_bonus) || 0;
}

// UBR-0204: teacher sets/adjusts the early-submission bonus on an assignment.
async function setEarlyBonus(assignmentId) {
    if (!isTeacher()) return;
    const a = (gradesData.assignments || []).find(x => x.assignment_id === assignmentId);
    if (!a) return;
    const glob = Number((gradesData.gradeWeights || {}).early_bonus) || 0;
    const cur = Number(a.early_bonus_pct) || 0;
    const inp = prompt('Per-assignment early-bonus OVERRIDE (%). Enter 0 to use the global ' + glob + '% set in the Teacher area:', String(cur || ''));
    if (inp == null) return;
    const pct = Number(inp || 0);
    if (!(pct >= 0) || pct > 50) { toast('Enter a bonus between 0 and 50', 'error'); return; }
    a.early_bonus_pct = pct;
    a.is_early = pct > 0 ? true : isAssignmentEarly(a);
    const res = await supabaseWrite('school_assignments', 'PATCH',
        { early_bonus_pct: pct, is_early: a.is_early }, `assignment_id=eq.${encodeURIComponent(assignmentId)}`);
    if (res === null) { toast('Could not save bonus', 'error'); return; }
    toast(pct > 0 ? `Early bonus set to +${pct}%` : 'Early bonus cleared', 'success');
    refreshGrades();
}

// Typing grade is PARTICIPATION-based: full credit for keeping up with practice
// (a configurable sessions/week target), rather than penalizing a young typist for
// raw speed. WPM and accuracy are still shown as stats + the progression chart, but
// they don't lower the grade. Target lives in school_grade_weights (typing_target,
// default 3/week) and is editable in the Teacher area.
function typingGradeFromSessions(sessions) {
    if (!sessions || !sessions.length) return null;
    const target = Number((gradesData.gradeWeights || {}).typing_target) || 3; // sessions per week
    const start = new Date(GRADES_QUARTER_START + 'T00:00:00');
    const weeks = Math.max(1, (Date.now() - start.getTime()) / (7 * 86400000));
    const expected = target * weeks;
    return expected > 0 ? Math.min(100, Math.round((sessions.length / expected) * 100)) : 100;
}

// Compute each grade category's percentage and the weighted overall. Categories
// with no data are excluded so an empty category (e.g. no projects yet) doesn't
// drag the grade down — the remaining weights re-normalize.
function calcCategoryGrades() {
    const lessons = calcGradeStats();
    const lessonsPct = lessons.assignmentCount > 0 ? lessons.overallPct : null;

    const vq = (gradesData.vocabQuizzes || []).filter(q => q.percentage != null);
    const spellingPct = vq.length ? (vq.reduce((s, q) => s + Number(q.percentage), 0) / vq.length) : null;

    const typingPct = typingGradeFromSessions(gradesData.typingSessions);

    const hist = (gradesData.dailySummary && gradesData.dailySummary.history) || null;
    let historyPct = null;
    if (hist) {
        if (hist.total_available) historyPct = Math.round((Number(hist.reads_this_semester || 0) / Number(hist.total_available)) * 100);
        else if (hist.pct_read != null) historyPct = Number(hist.pct_read);
    }

    const pr = (gradesData.projects || []).filter(p => p.status === 'graded' && Number(p.total_points) > 0 && p.earned_points != null);
    const projectsPct = pr.length
        ? Math.round(pr.reduce((s, p) => s + (Number(p.earned_points) / Number(p.total_points)) * 100, 0) / pr.length)
        : null;

    const cats = { lessons: lessonsPct, spelling: spellingPct, typing: typingPct, history: historyPct, projects: projectsPct };
    const weights = gradesData.gradeWeights || { lessons: 50, spelling: 20, typing: 10, history: 10, projects: 10 };

    let wSum = 0, acc = 0;
    Object.keys(cats).forEach(k => {
        if (cats[k] == null) return;
        const w = Number(weights[k] || 0);
        if (w <= 0) return;
        wSum += w; acc += cats[k] * w;
    });
    const overallPct = wSum > 0 ? (acc / wSum) : (lessonsPct || 0);
    return { cats, weights, overallPct: Math.round(overallPct * 10) / 10, lessons };
}

// =======================================
// STAT CALCULATIONS
// =======================================
function calcGradeStats() {
    // UBR-0162/0163: prefer the on-the-fly recomputed totals (from school_answers
    // + override_score + question points) over the cached school_grades row.
    // Falls back to school_grades only when answers haven't loaded.
    let totalEarned = 0;
    let totalPossible = 0;
    let assignmentCount = 0;

    for (const a of gradesData.assignments) {
        const r = gradesData.recomputed && gradesData.recomputed[a.assignment_id];
        const g = gradesData.grades[a.assignment_id];
        if (!r && !g) continue;

        // UBR-0172: skip not-started / pending-review lessons so they don't
        // drag the running average toward 0%.
        const aStats = calcAssignmentStats(a.assignment_id);
        if (!aStats.hasGrade) continue;

        assignmentCount++;
        const possible = r ? r.possible : (Number(g.total_points) || 0);
        const earned = r ? r.earned : (Number(g.earned_points) || 0);
        totalEarned += earned;
        totalPossible += possible;
    }

    const overallPct = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;

    // UBR-0176: a single percentage. Per-answer logic (line 159) already
    // prefers override_score over ai_score, so overallPct is the
    // override-adjusted score. The previous "raw vs adjusted" split was
    // misleading because both fields held the same number.
    return {
        totalEarned: Math.round(totalEarned * 10) / 10,
        totalPossible: Math.round(totalPossible * 10) / 10,
        overallPct,
        assignmentCount
    };
}

function calcAssignmentStats(assignmentId) {
    // UBR-0162/0163: use the recomputed totals from school_answers when present.
    const r = gradesData.recomputed && gradesData.recomputed[assignmentId];
    if (r && r.possible > 0) {
        return {
            pct: r.pct,
            earned: r.earned,
            possible: r.possible,
            hasGrade: true,
            letterGrade: r.letter,
            notStarted: false,
            pendingReview: false
        };
    }

    // UBR-0172: distinguish "not started" (no answers yet) and "pending review"
    // from "graded with 0%". Showing a literal "0% F" pill on an unstarted lesson
    // is demoralizing — show a neutral pill instead. The primary signal is answer
    // count, NOT whether a school_grades row exists (the backend can pre-create a
    // row at assignment time with total_points based on lesson_questions).
    const answerCount = (gradesData.answers[assignmentId] || []).length;
    const g = gradesData.grades[assignmentId];

    // No answers from the student yet => not started, regardless of grade-row pre-population.
    if (answerCount === 0) {
        return {
            pct: 0, earned: 0, possible: 0,
            hasGrade: false,
            notStarted: true,
            pendingReview: false
        };
    }

    // Has answers but no graded result (no letter_grade or no grade row) => awaiting review.
    if (!g || !g.letter_grade) {
        return {
            pct: 0, earned: 0, possible: 0,
            hasGrade: false,
            notStarted: false,
            pendingReview: true
        };
    }

    const pct = g.adjusted_percentage != null ? Number(g.adjusted_percentage) : Number(g.raw_percentage || 0);
    const earned = Number(g.earned_points || 0);
    const possible = Number(g.total_points || 0);
    return {
        pct,
        earned: Math.round(earned * 10) / 10,
        possible: Math.round(possible * 10) / 10,
        hasGrade: true,
        letterGrade: g.letter_grade,
        notStarted: false,
        pendingReview: false
    };
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

    // UBR-0199: overall grade is now a weighted blend of categories (lessons,
    // spelling, typing, history, projects), not lessons alone.
    const cat = calcCategoryGrades();
    const stats = Object.assign({}, cat.lessons, { overallPct: cat.overallPct });
    const letterOverall = getLetterGrade(cat.overallPct);

    // Empty state — only when there is genuinely nothing across ALL categories.
    const hasAnyData = gradesData.assignments.length
        || (gradesData.vocabQuizzes || []).length
        || (gradesData.typingSessions || []).length
        || (gradesData.projects || []).length;
    if (!hasAnyData) {
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
        ${renderStatsRow(stats, letterOverall)}
        ${renderCategoryBreakdown(cat)}
        ${renderMotivationSummaryCard()}
        <div id="grades-assignment-list" style="display: flex; flex-direction: column; gap: 8px; margin-top: 20px;">
            ${gradesData.assignments.map(a => renderAssignmentAccordion(a)).join('')}
        </div>
        ${renderDailyTaskStats()}
        ${renderVocabQuizReview()}
    `;
}

// UBR-0199: category breakdown showing how the weighted overall grade is built.
function renderCategoryBreakdown(cat) {
    const LABELS = { lessons: '📘 Lessons', spelling: '📚 Spelling', typing: '⌨️ Typing', history: '📜 History', projects: '🎒 Projects' };
    const order = ['lessons', 'spelling', 'typing', 'history', 'projects'];
    const rows = order.map(k => {
        const pct = cat.cats[k];
        const w = Number(cat.weights[k] || 0);
        const has = pct != null;
        const lg = has ? getLetterGrade(pct) : null;
        const valTxt = has ? (Math.round(pct) + '% ' + lg.grade) : 'No data yet';
        const valColor = has ? lg.color : 'var(--deft-txt-3)';
        const barPct = has ? Math.max(2, Math.min(100, pct)) : 0;
        return `
            <div style="display:flex;align-items:center;gap:10px;padding:6px 0;">
                <div style="width:96px;font-size:12px;color:var(--deft-txt-2);">${LABELS[k]}</div>
                <div style="width:54px;font-size:10px;color:var(--deft-txt-3);">w: ${w}%</div>
                <div style="flex:1;height:8px;border-radius:4px;background:var(--deft-border);overflow:hidden;">
                    <div style="height:100%;width:${barPct}%;background:${valColor};border-radius:4px;"></div>
                </div>
                <div style="width:84px;text-align:right;font-size:12px;font-weight:600;color:${valColor};">${valTxt}</div>
            </div>`;
    }).join('');
    return `
        <div style="margin-top:16px;background:var(--deft-surface-el);border:1px solid var(--deft-border);border-radius:12px;padding:16px 20px;">
            <div style="font-size:13px;font-weight:600;color:var(--deft-txt-2);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                <span>Grade Breakdown (weighted)</span>
                <span style="font-size:11px;color:var(--deft-txt-3);font-weight:500;">Empty categories are excluded</span>
            </div>
            ${rows}
        </div>
    `;
}

// =======================================
// VOCAB QUIZ REVIEW + GRADE ADJUSTMENT (UBR-0180 / UBR-0178)
// Teacher-only. Lists each vocab quiz attempt with its ACTUAL questions (the
// student's quiz is shuffled, so this is the only accurate per-quiz answer key),
// and lets the teacher flip any question's correctness to adjust the grade.
// =======================================
function vocabQuizScoreFromAnswers(quiz) {
    const ans = Array.isArray(quiz.answers) ? quiz.answers : [];
    const total = quiz.total_possible || ans.length || 0;
    const correct = ans.filter(q => q && q.is_correct === true).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, total, pct };
}

function renderVocabQuizReview() {
    if (!isTeacher()) return '';
    const quizzes = (gradesData.vocabQuizzes || []).filter(q => Array.isArray(q.answers) && q.answers.length);
    if (!quizzes.length) return '';

    const rows = quizzes.map(quiz => {
        const s = vocabQuizScoreFromAnswers(quiz);
        const lg = getLetterGrade(s.pct);
        const dateStr = quiz.created_at
            ? new Date(quiz.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '';
        const isOpen = gradesData.vocabExpandedId === quiz.quiz_id;
        const statusPill = quiz.status === 'graded'
            ? `<span style="font-size:10px;color:${lg.color};font-weight:700;">${s.correct}/${s.total} &middot; ${s.pct}% (${lg.grade})</span>`
            : `<span style="font-size:10px;color:var(--deft-txt-3);text-transform:uppercase;">${escapeHtml(quiz.status || 'in progress')}</span>`;

        const detail = !isOpen ? '' : `
            <div style="padding:8px 12px 12px;display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.02);border:1px solid var(--deft-border);">
                    <span style="font-size:11px;color:var(--deft-txt-3);">Score override (for grading mistakes)</span>
                    <button class="btn btn-ghost" onclick="event.stopPropagation();overrideVocabQuizTotals('${escapeHtml(quiz.quiz_id)}')" style="padding:3px 10px;font-size:10px;flex-shrink:0;">Override score / total</button>
                </div>
                ${quiz.answers.map((q, i) => {
                    const correct = q.is_correct === true;
                    const sa = (q.student_answer == null || q.student_answer === '') ? '(no answer)' : q.student_answer;
                    return `
                    <div style="display:flex;align-items:flex-start;gap:8px;padding:8px;border-radius:6px;
                                background:var(--deft-surface);border:1px solid var(--deft-border);font-size:12px;">
                        <span style="min-width:16px;font-weight:700;color:var(--deft-txt-3);">${q.question_number || (i + 1)}.</span>
                        <div style="flex:1;min-width:0;">
                            <div style="color:var(--deft-txt);">${escapeHtml(q.prompt || '')}</div>
                            <div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                                <span style="font-size:11px;color:var(--deft-txt-2);">Student: <strong>${escapeHtml(sa)}</strong></span>
                                <span style="font-size:11px;color:var(--deft-success);">Correct: ${escapeHtml(q.correct_answer || '')}</span>
                            </div>
                        </div>
                        <span style="font-size:11px;font-weight:700;flex-shrink:0;color:${correct ? 'var(--deft-success)' : '#E57373'};">
                            ${correct ? '✓' : '✗'}
                        </span>
                        <button class="btn btn-ghost" onclick="event.stopPropagation();adjustVocabAnswer('${escapeHtml(quiz.quiz_id)}', ${q.question_number || (i + 1)})"
                                style="padding:3px 8px;font-size:10px;flex-shrink:0;">
                            Mark ${correct ? 'wrong' : 'correct'}
                        </button>
                    </div>`;
                }).join('')}
            </div>`;

        return `
            <div style="border:1px solid var(--deft-border);border-radius:10px;overflow:hidden;background:var(--deft-surface-el);">
                <div onclick="toggleVocabQuiz('${escapeHtml(quiz.quiz_id)}')" role="button" tabindex="0"
                     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}"
                     style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;">
                    <span style="flex:1;min-width:0;font-size:12px;color:var(--deft-txt);font-weight:600;">
                        Quiz &middot; <span style="color:var(--deft-txt-2);font-weight:400;">${escapeHtml(dateStr)}</span>
                    </span>
                    ${statusPill}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;transform:rotate(${isOpen ? 180 : 0}deg);transition:transform 0.15s;">
                        <path d="M3 4.5l3 3 3-3" stroke="var(--deft-txt-3)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                ${detail}
            </div>`;
    }).join('');

    return `
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--deft-border);" data-role-min="admin">
            <h3 style="margin:0 0 10px;font-size:0.8125rem;font-weight:600;color:var(--deft-txt-2);
                       text-transform:uppercase;letter-spacing:0.05em;">Vocab Quizzes &mdash; Review &amp; Adjust</h3>
            <div style="display:flex;flex-direction:column;gap:8px;">${rows}</div>
        </div>
    `;
}

function toggleVocabQuiz(quizId) {
    gradesData.vocabExpandedId = (gradesData.vocabExpandedId === quizId) ? null : quizId;
    renderGrades();
}

async function adjustVocabAnswer(quizId, questionNumber) {
    const quiz = (gradesData.vocabQuizzes || []).find(q => q.quiz_id === quizId);
    if (!quiz || !Array.isArray(quiz.answers)) return;
    const q = quiz.answers.find(a => (a.question_number || 0) === questionNumber);
    if (!q) return;

    // Flip correctness and recompute the score from the answers array.
    q.is_correct = !(q.is_correct === true);
    q.adjusted_by_teacher = true;
    const s = vocabQuizScoreFromAnswers(quiz);
    const lg = getLetterGrade(s.pct);
    quiz.score = s.correct;
    quiz.total_possible = s.total;
    quiz.percentage = s.pct;
    quiz.letter_grade = lg.grade;
    if (quiz.status !== 'graded') quiz.status = 'graded';

    gradesData.vocabExpandedId = quizId; // keep this quiz open after re-render
    renderGrades();

    const res = await supabaseWrite('school_vocab_quizzes', 'PATCH', {
        answers: quiz.answers,
        score: quiz.score,
        total_possible: quiz.total_possible,
        percentage: quiz.percentage,
        letter_grade: quiz.letter_grade,
        status: 'graded',
        graded_by: 'teacher',
        graded_at: new Date().toISOString()
    }, `quiz_id=eq.${quizId}`);

    if (res === null) {
        toast('Could not save the adjustment', 'error');
    } else {
        toast(`Adjusted: ${quiz.score}/${quiz.total_possible} (${quiz.percentage}%)`);
    }
}

// UBR-0200: direct teacher override of a quiz's correct count and total questions
// (for cases where the system graded out of the wrong number of questions).
async function overrideVocabQuizTotals(quizId) {
    const quiz = (gradesData.vocabQuizzes || []).find(q => q.quiz_id === quizId);
    if (!quiz) return;
    const ansLen = Array.isArray(quiz.answers) ? quiz.answers.length : 0;
    const totIn = prompt('Total number of questions on this quiz:', String(quiz.total_possible || ansLen || 12));
    if (totIn == null) return;
    const total = parseInt(totIn, 10);
    if (!(total > 0)) { toast('Total must be a positive number', 'error'); return; }
    const corrIn = prompt('Number the student got correct (0–' + total + '):', String(quiz.score != null ? quiz.score : ''));
    if (corrIn == null) return;
    const correct = parseInt(corrIn, 10);
    if (!(correct >= 0) || correct > total) { toast('Correct count must be between 0 and ' + total, 'error'); return; }

    const pct = Math.round((correct / total) * 100);
    const lg = getLetterGrade(pct);
    quiz.score = correct; quiz.total_possible = total; quiz.percentage = pct; quiz.letter_grade = lg.grade;
    if (quiz.status !== 'graded') quiz.status = 'graded';
    gradesData.vocabExpandedId = quizId;
    renderGrades();

    const res = await supabaseWrite('school_vocab_quizzes', 'PATCH', {
        score: correct, total_possible: total, percentage: pct, letter_grade: lg.grade,
        status: 'graded', graded_by: 'teacher', graded_at: new Date().toISOString()
    }, `quiz_id=eq.${quizId}`);
    if (res === null) toast('Could not save the override', 'error');
    else toast(`Override saved: ${correct}/${total} (${pct}% ${lg.grade})`);
}

// =======================================
// MOTIVATION SUMMARY (UBR-0169)
// =======================================
function renderMotivationSummaryCard() {
    if (!isTeacher()) return ''; // student-side already has its own pill row in the questions tab
    const m = gradesData.motivation && gradesData.motivation.total;
    if (!m) return '';

    const total = (m.explanations_used || 0) + (m.videos_searched || 0) + (m.hints_used || 0);
    const assignmentCount = gradesData.assignments.length || 1;
    const eventsPerAssignment = total / assignmentCount;

    // Engagement banding: low / medium / high
    let engagement = { label: 'Low', color: 'var(--deft-txt-3)', fill: 0.25 };
    if (eventsPerAssignment >= 3) engagement = { label: 'High', color: 'var(--deft-success, #06D6A0)', fill: 1 };
    else if (eventsPerAssignment >= 1) engagement = { label: 'Medium', color: 'var(--deft-warning, #FBBF24)', fill: 0.6 };

    const pill = (count, label, color) => `
        <div style="
            display: flex; flex-direction: column; align-items: center;
            padding: 12px 18px; border-radius: 12px;
            background: var(--deft-surface-hi, rgba(255,255,255,0.03));
            border: 1px solid var(--deft-border); min-width: 100px;
        ">
            <span style="font-size: 22px; font-weight: 700; color: ${color}; font-variant-numeric: tabular-nums;">${count}</span>
            <span style="font-size: 11px; color: var(--deft-txt-3); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.04em;">${label}</span>
        </div>
    `;

    return `
        <div style="
            margin-top: 16px; padding: 16px 20px;
            background: var(--deft-surface-el); border: 1px solid var(--deft-border);
            border-radius: 12px;
        ">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div>
                    <div style="font-size: 14px; font-weight: 700; color: var(--deft-txt); margin-bottom: 2px;">
                        Learning Motivation
                    </div>
                    <div style="font-size: 11px; color: var(--deft-txt-3);">
                        How often Brianna reaches for the "learn more" tools.
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px; color: var(--deft-txt-3); text-transform: uppercase; letter-spacing: 0.04em;">Engagement</span>
                    <span style="
                        font-size: 12px; font-weight: 700; padding: 3px 12px; border-radius: 999px;
                        background: ${engagement.color}1F; color: ${engagement.color};
                        border: 1px solid ${engagement.color}40;
                    ">${engagement.label}</span>
                </div>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${pill(m.explanations_used || 0, 'Explanations', 'var(--deft-accent, #06D6A0)')}
                ${pill(m.videos_searched || 0, 'Video Searches', 'var(--deft-accent-warm, #FBBF24)')}
                ${pill(m.hints_used || 0, 'Hints', 'var(--deft-warning, #F0A830)')}
                ${pill(total, 'Total Uses', 'var(--deft-txt-2)')}
            </div>
            <div style="margin-top: 10px; height: 6px; border-radius: 3px; background: var(--deft-border); overflow: hidden;">
                <div style="height: 100%; width: ${Math.round(engagement.fill * 100)}%; background: ${engagement.color}; transition: width 0.3s ease;"></div>
            </div>
        </div>
    `;
}

// Per-assignment mini motivation row, rendered inside the accordion detail.
function renderAssignmentMotivationRow(assignmentId) {
    if (!isTeacher()) return '';
    const m = gradesData.motivation && gradesData.motivation.byAssignment && gradesData.motivation.byAssignment[assignmentId];
    if (!m) return '';

    const total = (m.explanations_used || 0) + (m.videos_searched || 0) + (m.hints_used || 0);
    if (total === 0) return '';

    const inlinePill = (n, label) => `
        <span style="
            display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px;
            background: var(--deft-surface-hi, rgba(255,255,255,0.04)); border: 1px solid var(--deft-border);
            font-size: 11px; color: var(--deft-txt-2);
        ">
            <span style="font-weight: 700; color: var(--deft-txt);">${n}</span>
            <span style="color: var(--deft-txt-3);">${label}</span>
        </span>
    `;

    return `
        <div style="padding: 10px 18px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                    border-top: 1px solid var(--deft-border); background: rgba(255,255,255,0.015);">
            <span style="font-size: 10px; color: var(--deft-txt-3); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;">
                Motivation in this lesson
            </span>
            ${m.explanations_used ? inlinePill(m.explanations_used, 'explanations') : ''}
            ${m.videos_searched ? inlinePill(m.videos_searched, 'video searches') : ''}
            ${m.hints_used ? inlinePill(m.hints_used, 'hints') : ''}
        </div>
    `;
}

// UBR-0202: Typing card over the whole quarter + a WPM/accuracy progression
// line chart (the old card used a 7-day window and showed nothing once practice
// was more than a week old).
function buildTypingLineChart(sessions) {
    if (!sessions || sessions.length < 2) {
        return '<div style="font-size:11px;color:var(--deft-txt-3);margin-top:8px;">Complete a few sessions to see your progression chart.</div>';
    }
    const W = 248, H = 76, padL = 6, padR = 6, padT = 8, padB = 12;
    const n = sessions.length;
    const wpms = sessions.map(t => Number(t.wpm) || 0);
    const accs = sessions.map(t => Number(t.accuracy) || 0);
    const maxWpm = Math.max(40, ...wpms);
    const x = i => padL + (i * (W - padL - padR)) / (n - 1);
    const yW = v => padT + (1 - v / maxWpm) * (H - padT - padB);
    const yA = v => padT + (1 - v / 100) * (H - padT - padB);
    const line = (arr, yf) => arr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yf(v).toFixed(1)).join(' ');
    const wpmPath = line(wpms, yW);
    const accPath = line(accs, yA);
    return `
        <div style="margin-top:10px;">
            <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" role="img" aria-label="WPM and accuracy over the quarter">
                <path d="${accPath}" fill="none" stroke="var(--deft-accent, #06D6A0)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>
                <path d="${wpmPath}" fill="none" stroke="#FBBF24" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
            </svg>
            <div style="display:flex;gap:14px;margin-top:2px;font-size:10px;color:var(--deft-txt-3);">
                <span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:2px;background:#FBBF24;display:inline-block;"></span>WPM</span>
                <span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:2px;background:var(--deft-accent,#06D6A0);display:inline-block;"></span>Accuracy %</span>
                <span style="margin-left:auto;">${n} sessions this quarter</span>
            </div>
        </div>`;
}

function renderTypingQuarterCard(cardBase, headerStyle, rowStyle, labelStyle, valueStyle) {
    const ts = gradesData.typingSessions || [];
    const n = ts.length;
    const avgWpm = n ? Math.round(ts.reduce((s, t) => s + (Number(t.wpm) || 0), 0) / n) : 0;
    const bestWpm = n ? Math.max(...ts.map(t => Number(t.wpm) || 0)) : 0;
    const avgAcc = n ? Math.round(ts.reduce((s, t) => s + (Number(t.accuracy) || 0), 0) / n) : 0;
    const totalMin = n ? Math.round(ts.reduce((s, t) => s + (Number(t.duration_secs) || 0), 0) / 60) : 0;
    const emptyNote = n ? '' : '<div style="font-size:11px;color:var(--deft-txt-3);margin-top:4px;">No typing practice recorded this quarter yet.</div>';
    return `
        <div style="${cardBase}">
            <div style="${headerStyle}">⌨️ Typing Practice (quarter)</div>
            <div style="${rowStyle}"><span style="${labelStyle}">Sessions</span><span style="${valueStyle}">${n}</span></div>
            <div style="${rowStyle}"><span style="${labelStyle}">Average WPM</span><span style="${valueStyle}">${avgWpm}</span></div>
            <div style="${rowStyle}"><span style="${labelStyle}">Best WPM</span><span style="${valueStyle}">${bestWpm}</span></div>
            <div style="${rowStyle}"><span style="${labelStyle}">Avg accuracy</span><span style="${valueStyle}">${avgAcc}%</span></div>
            <div style="${rowStyle}"><span style="${labelStyle}">Total practice</span><span style="${valueStyle}">${totalMin} min</span></div>
            ${emptyNote}
            ${buildTypingLineChart(ts)}
        </div>`;
}

// =======================================
// DAILY TASK STATS (UBR-0164)
// =======================================
function renderDailyTaskStats() {
    // UBR-0202: don't early-return when the 7-day summary is empty — the typing
    // card now uses the full-quarter sessions, which may exist even when the last
    // 7 days are quiet.
    const s = gradesData.dailySummary || {};

    const cardBase = 'background: var(--deft-surface-el); border: 1px solid var(--deft-border); border-radius: 12px; padding: 16px 20px;';
    const headerStyle = 'font-size: 13px; font-weight: 600; color: var(--deft-txt-2); margin-bottom: 12px; display:flex; align-items:center; gap:6px;';
    const rowStyle = 'display:flex; justify-content:space-between; align-items:center; padding:4px 0; font-size:13px;';
    const labelStyle = 'color: var(--deft-txt-3);';
    const valueStyle = 'color: var(--deft-txt); font-weight:600;';

    const vocab = s.vocab || {};
    const typing = s.typing || {};
    const history = s.history || {};
    const grid = Array.isArray(s.daily_grid) ? s.daily_grid : [];

    // Vocab trend mini bars
    const trend = Array.isArray(vocab.trend) ? vocab.trend.slice().reverse() : [];
    const trendBars = trend.map(p => {
        const pct = Number(p) || 0;
        const h = Math.max(6, Math.round((pct / 100) * 40));
        const col = pct >= 90 ? 'var(--deft-success, #06D6A0)'
                  : pct >= 70 ? 'var(--deft-warn, #FBBF24)'
                  : 'var(--deft-danger, #F87171)';
        return '<div style="width:8px; height:' + h + 'px; background:' + col + '; border-radius:2px;" title="' + pct + '%"></div>';
    }).join('');

    // Daily grid (rows: vocab, typing, history, assignments)
    const gridRows = [
        { key: 'vocab_done', label: 'Vocab' },
        { key: 'typing_done', label: 'Typing' },
        { key: 'history_done', label: 'History' },
        { key: 'assignments_done', label: 'Assignments' }
    ];
    const cell = (done) => '<div style="width:20px;height:20px;border-radius:4px;background:' + (done ? 'var(--deft-success, #06D6A0)' : 'var(--deft-border)') + ';"></div>';
    const dayLabel = (iso) => {
        try {
            const d = new Date(iso + 'T00:00:00');
            return d.toLocaleDateString('en-US', { weekday: 'short' });
        } catch (e) { return iso; }
    };
    // Show oldest -> newest left to right.
    // Wrap the grid in an overflow-x container with min-width:max-content so the
    // fixed-size cells never spill outside the padded card (UBR-0201).
    const orderedDays = grid.slice().reverse();
    const gridHtml = `
        <div style="overflow-x:auto; max-width:100%;">
            <div style="display:grid; grid-template-columns: 68px repeat(${orderedDays.length}, minmax(20px, 1fr)); gap:6px; align-items:center; min-width:max-content;">
                <div></div>
                ${orderedDays.map(d => '<div style="font-size:10px; color:var(--deft-txt-3); text-align:center;">' + dayLabel(d.date) + '</div>').join('')}
                ${gridRows.map(r => `
                    <div style="font-size:12px; color:var(--deft-txt-2);">${r.label}</div>
                    ${orderedDays.map(d => '<div style="display:flex;justify-content:center;">' + cell(!!d[r.key]) + '</div>').join('')}
                `).join('')}
            </div>
        </div>
    `;

    return `
        <div style="margin-top: 32px;">
            <h3 style="font-size:14px; font-weight:600; color:var(--deft-txt-2); margin-bottom:12px;">Daily Task Statistics</h3>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:12px;">
                <div style="${cardBase}">
                    <div style="${headerStyle}">📚 Vocabulary Quizzes</div>
                    <div style="${rowStyle}"><span style="${labelStyle}">Quizzes taken</span><span style="${valueStyle}">${vocab.total_quizzes || 0}</span></div>
                    <div style="${rowStyle}"><span style="${labelStyle}">Average score</span><span style="${valueStyle}">${vocab.avg_score_pct || 0}%</span></div>
                    <div style="${rowStyle}"><span style="${labelStyle}">Latest score</span><span style="${valueStyle}">${vocab.latest_score_pct || 0}% (${vocab.latest_letter || '-'})</span></div>
                    ${trendBars ? '<div style="display:flex; align-items:flex-end; gap:4px; height:44px; margin-top:8px;">' + trendBars + '</div>' : ''}
                </div>

                ${renderTypingQuarterCard(cardBase, headerStyle, rowStyle, labelStyle, valueStyle)}

                <div style="${cardBase}">
                    <div style="${headerStyle}">📜 History Facts</div>
                    <div style="${rowStyle}"><span style="${labelStyle}">Read this week</span><span style="${valueStyle}">${history.reads_this_week || 0}</span></div>
                    <div style="${rowStyle}"><span style="${labelStyle}">Read this semester</span><span style="${valueStyle}">${history.reads_this_semester || 0}</span></div>
                    <div style="${rowStyle}"><span style="${labelStyle}">Of available</span><span style="${valueStyle}">${history.total_available || 0} facts</span></div>
                    <div style="${rowStyle}"><span style="${labelStyle}">% read</span><span style="${valueStyle}">${history.pct_read || 0}%</span></div>
                </div>

                <div style="${cardBase}">
                    <div style="${headerStyle}">✅ Daily Completion (7d)</div>
                    ${gridHtml}
                </div>
            </div>
        </div>
    `;
}

// =======================================
// STATS ROW (4 cards)
// =======================================
function renderStatsRow(stats, letterOverall) {
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

            <!-- Percentage Score (UBR-0176: single card; includes teacher overrides) -->
            <div style="${cardBase}" role="group" aria-label="Percentage score">
                <span style="${labelStyle}">Percentage Score</span>
                <span style="${valueStyle} color: ${letterOverall.color};">
                    ${stats.overallPct.toFixed(1)}%
                </span>
                <span style="font-size: 12px; color: var(--deft-txt-2);">includes overrides</span>
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

    // UBR-0204: early-submission badge + teacher bonus control.
    const early = isAssignmentEarly(assignment);
    const bonusPct = early ? effectiveEarlyBonus(assignment) : 0;
    const earlyBadge = early
        ? `<span title="Submitted early" style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:var(--deft-accent-dim,rgba(6,214,160,0.15));color:var(--deft-accent,#06D6A0);">⭐ Early${bonusPct ? ' +' + bonusPct + '%' : ''}</span>`
        : '';
    const bonusCtrl = isTeacher()
        ? `<span role="button" tabindex="0" title="Set early-submission bonus"
                 onclick="event.stopPropagation();setEarlyBonus('${assignment.assignment_id}')"
                 onkeydown="if(event.key==='Enter'){event.stopPropagation();setEarlyBonus('${assignment.assignment_id}');}"
                 style="font-size:10px;padding:2px 7px;border-radius:6px;border:1px solid var(--deft-border);color:var(--deft-txt-3);cursor:pointer;flex-shrink:0;">⭐ bonus</span>`
        : '';

    // UBR-0172: render a neutral pill for not-started / pending-review lessons
    // instead of "0 / 0  F  0%", which reads as a failing grade.
    let scorePillHtml;
    if (!aStats.hasGrade && aStats.notStarted) {
        scorePillHtml = `
            <span style="
                font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
                background: var(--deft-surface-hi, rgba(255,255,255,0.04));
                color: var(--deft-txt-3); border: 1px solid var(--deft-border);
            ">Not started</span>
        `;
    } else if (!aStats.hasGrade && aStats.pendingReview) {
        scorePillHtml = `
            <span style="
                font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
                background: var(--deft-surface-hi, rgba(255,255,255,0.04));
                color: var(--deft-txt-2); border: 1px solid var(--deft-border);
            ">Pending review</span>
        `;
    } else {
        scorePillHtml = `
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
        `;
    }

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
                    <div style="font-size: 11px; color: var(--deft-txt-3); margin-top: 2px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span>${dateStr}</span>
                        ${earlyBadge}
                    </div>
                </div>

                <!-- Score + letter grade (or neutral pill for not-started / pending review) -->
                <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                    ${bonusCtrl}
                    ${scorePillHtml}

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
    // UBR-0156: render the accordion list first so the expanded indicator updates.
    const list = document.getElementById('grades-assignment-list');
    if (list) {
        list.innerHTML = gradesData.assignments.map(a => renderAssignmentAccordion(a)).join('');
    }

    const panel = document.getElementById('grade-detail-' + assignmentId);
    if (!panel) return;

    // Find the lesson_id for this assignment
    const assignment = gradesData.assignments.find(a => a.assignment_id === assignmentId);
    const lessonId = assignment ? assignment.lesson_id : null;
    if (!lessonId) {
        panel.innerHTML = renderGradesEmpty('Lesson not found for this assignment.');
        return;
    }

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

    // UBR-0156: fetch the lesson's questions directly from Supabase rather than
    // through the broken get_assignment_detail flow (which didn't pass lesson_id).
    if (!gradesData.questions[lessonId]) {
        const qs = await supabaseSelect('school_questions',
            `lesson_id=eq.${lessonId}&order=question_number&select=*`);
        gradesData.questions[lessonId] = qs || [];
    }

    panel.innerHTML = renderAssignmentDetail(assignmentId);
}

// =======================================
// ASSIGNMENT DETAIL (question rows)
// =======================================
function renderAssignmentDetail(assignmentId) {
    const assignment = gradesData.assignments.find(a => a.assignment_id === assignmentId);
    const lessonId = assignment ? assignment.lesson_id : null;
    const lessonQuestions = (lessonId && gradesData.questions[lessonId]) || [];
    const studentAnswers = gradesData.answers[assignmentId] || [];

    if (!lessonQuestions.length) {
        return `
            <div style="padding: 20px; text-align: center; color: var(--deft-txt-3); font-size: 13px;">
                No questions found for this lesson.
            </div>
        `;
    }

    // UBR-0156: build per-question rows by joining school_questions with the
    // student's school_answers in memory.
    const answerMap = {};
    studentAnswers.forEach(a => { answerMap[a.question_id] = a; });
    const rows = lessonQuestions.map((q, idx) => ({
        grade: answerMap[q.question_id] || {},
        question: q,
        num: q.question_number || (idx + 1)
    }));

    // UBR-0171: Excuse Assignment teacher control removed.
    const teacherControls = '';

    // UBR-0169: per-assignment motivation row (teacher view only).
    const motivationRow = renderAssignmentMotivationRow(assignmentId);

    return `
        ${motivationRow}
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
    const g = row.grade;       // school_answers row (or {} if unanswered)
    const q = row.question;    // school_questions row
    const num = row.num;

    // UBR-0156: scores come from school_answers (ai_score 0-100, override_score 0-100).
    // Possible points come from school_questions.points (canonical 10).
    const isStruck = g.is_struck === true;
    const hasOverride = g.override_score != null;
    const aiPct = g.ai_score != null ? Number(g.ai_score) : null;
    const overridePct = hasOverride ? Number(g.override_score) : null;
    const scorePct = overridePct != null ? overridePct : aiPct; // 0-100 percentage
    const possible = Number(q.points) > 0 ? Number(q.points) : 10;
    const score = scorePct != null ? Math.round((scorePct / 100) * possible * 10) / 10 : null;
    const isPending = scorePct == null && !isStruck;

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

    // UBR-0156: per-question text from school_questions + student answer from school_answers
    const questionText = q.question_text || '';
    const studentAnswer = g.answer_text || '';
    const correctAnswer = q.correct_answer || g.correct_answer_shown || '';

    const struckStyle = isStruck ? 'text-decoration: line-through; opacity: 0.5;' : '';

    const teacherActions = isTeacher() ? `
        <span style="display: flex; gap: 4px; justify-content: flex-end;">
            <button onclick="openOverrideInline('${assignmentId}', '${(g.answer_id || q.question_id)}', ${score || 0}, ${possible})"
                    title="Override score"
                    style="background: transparent; border: 1px solid var(--deft-border); color: var(--deft-txt-2);
                           border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;
                           transition: border-color 0.15s ease, color 0.15s ease;"
                    onmouseenter="this.style.borderColor='var(--deft-txt-2)';this.style.color='var(--deft-txt)'"
                    onmouseleave="this.style.borderColor='var(--deft-border)';this.style.color='var(--deft-txt-2)'">
                Edit
            </button>
            <button onclick="toggleStrike('${assignmentId}', '${(g.answer_id || q.question_id)}', ${!isStruck})"
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
        <div id="grade-row-${(g.answer_id || q.question_id)}" style="
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
        <div id="override-inline-${(g.answer_id || q.question_id)}" style="display: none;"></div>
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

async function submitOverride(assignmentId, answerId, maxPoints) {
    const scoreInput = document.getElementById('override-val-' + answerId);
    const reasonInput = document.getElementById('override-reason-' + answerId);
    if (!scoreInput) return;

    const newScorePoints = parseFloat(scoreInput.value);
    if (isNaN(newScorePoints) || newScorePoints < 0 || newScorePoints > maxPoints) {
        toast('Score must be between 0 and ' + maxPoints, 'error');
        return;
    }
    // UBR-0156: convert points back to 0-100 percentage for the backend.
    const newScorePct = maxPoints > 0
        ? Math.max(0, Math.min(100, Math.round((newScorePoints / maxPoints) * 100)))
        : 0;

    const reason = reasonInput ? reasonInput.value.trim() : 'Teacher override';

    // UBR-0155 contract: { answer_id, override_score, override_reason }.
    const result = await schoolApi('override_score', {
        answer_id: answerId,
        override_score: newScorePct,
        override_reason: reason
    });

    if (result) {
        toast('Score overridden', 'success');
        // Update local cache: school_answers row holds the override.
        const answers = gradesData.answers[assignmentId] || [];
        const a = answers.find(an => an.answer_id === answerId);
        if (a) {
            a.override_score = newScorePct;
            a.override_reason = reason;
            a.check_status = 'verified';
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
async function toggleStrike(assignmentId, answerId, shouldStrike) {
    const result = await schoolApi('strike_question', {
        answer_id: answerId,
        is_struck: shouldStrike
    });

    if (result) {
        toast(shouldStrike ? 'Question struck' : 'Strike removed', 'success');
        // Update local cache (school_answers.is_struck)
        const answers = gradesData.answers[assignmentId] || [];
        const a = answers.find(an => an.answer_id === answerId);
        if (a) a.is_struck = shouldStrike;
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

// UBR-0171: excuseAssignment() removed.
