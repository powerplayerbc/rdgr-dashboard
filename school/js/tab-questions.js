// ═══════════════════════════════════════
// School — Questions Tab
// Q&A interface for answering lesson questions
// ═══════════════════════════════════════

// Local state for the questions view
let _questionsData = [];
let _answersMap = {};
let _lessonDetail = null;
let _hintCache = {};
let _motivationStats = { explanations_used: 0, videos_searched: 0 }; // UBR-0084

// ═══════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════
async function refreshQuestions() {
    if (!currentAssignmentId || !currentLessonId) return;

    const container = document.getElementById('questions-container');
    if (!container) return;

    container.innerHTML = renderQuestionsLoading();

    // Fetch lesson, questions, answers, and motivation summary in parallel
    const [lessonRows, questions, answers, motivation] = await Promise.all([
        supabaseSelect('school_lessons', `lesson_id=eq.${currentLessonId}&select=*`),
        supabaseSelect('school_questions', `lesson_id=eq.${currentLessonId}&select=*&order=question_number`),
        supabaseSelect('school_answers', `assignment_id=eq.${currentAssignmentId}&select=*`),
        supabaseRpc('get_motivation_summary', {
            p_student_id: activeProfileId,
            p_assignment_id: currentAssignmentId,
            p_lesson_id: currentLessonId
        })
    ]);

    _lessonDetail = (lessonRows && lessonRows.length > 0) ? lessonRows[0] : null;
    _questionsData = questions || [];
    _answersMap = {};
    _hintCache = {};
    _motivationStats = (motivation && motivation[0]) || { explanations_used: 0, videos_searched: 0 };

    if (answers && answers.length > 0) {
        answers.forEach(a => { _answersMap[a.question_id] = a; });
    }

    renderQuestionsView(container);
}

// UBR-0132: prefer the full lesson text fetched from the lesson_sheet_link
// Google Doc (parser writes it to metadata.full_lesson_text) over the short
// summary in lesson_content. Fall back through metadata.full_lesson_text ->
// lesson_content so older lessons still render something.
function _getLessonBodyText() {
    if (!_lessonDetail) return '';
    var meta = _lessonDetail.metadata || {};
    if (typeof meta.full_lesson_text === 'string' && meta.full_lesson_text.length > 50) {
        return meta.full_lesson_text;
    }
    return _lessonDetail.lesson_content || '';
}

// UBR-0132: split-view preference. Persists per profile in localStorage.
function _getSplitViewKey() {
    var pid = (typeof activeProfileId !== 'undefined' && activeProfileId) || 'anon';
    return 'school-questions-split-view-' + pid;
}
function _isSplitView() {
    try { return localStorage.getItem(_getSplitViewKey()) === '1'; }
    catch (e) { return false; }
}
function _setSplitView(on) {
    try { localStorage.setItem(_getSplitViewKey(), on ? '1' : '0'); }
    catch (e) {}
}

// ═══════════════════════════════════════
// RENDER — Full View
// ═══════════════════════════════════════
function renderQuestionsView(container) {
    const answeredCount = Object.keys(_answersMap).length;
    const totalCount = _questionsData.length;
    const lessonBody = _getLessonBodyText();
    const splitView = _isSplitView() && lessonBody;

    let html = '';

    // Header with back button, lesson title, view toggle, and action buttons
    html += renderQuestionsHeader(splitView, !!lessonBody);

    if (splitView) {
        // SPLIT VIEW (UBR-0132): lesson left, questions right. Sticky lesson
        // pane on desktop so the student can scroll questions without losing
        // the lesson reference. Stacks vertically below 900px.
        let questionsHtml = '';
        questionsHtml += renderProgressBar(answeredCount, totalCount);
        questionsHtml += renderMotivationRow(_motivationStats);
        if (_questionsData.length === 0) {
            questionsHtml += renderEmptyQuestions();
        } else {
            _questionsData.forEach(q => {
                questionsHtml += renderQuestionCard(q, _answersMap[q.question_id]);
            });
        }
        html += '<div class="split-view-grid" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:1rem;padding:1rem 1.5rem 0 1.5rem;align-items:start;">'
              + '<aside class="split-view-lesson" style="position:sticky;top:1rem;max-height:calc(100vh - 8rem);overflow-y:auto;background:var(--deft-surface-el);border:1px solid var(--deft-border);border-left:3px solid var(--deft-accent);border-radius:var(--deft-radius,0.875rem);padding:1rem 1.25rem;">'
              +   '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.6rem;position:sticky;top:0;background:var(--deft-surface-el);padding-bottom:0.4rem;border-bottom:1px solid var(--deft-border);">'
              +     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="color:var(--deft-accent);flex-shrink:0;"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
              +     '<span style="font-size:0.75rem;font-weight:600;color:var(--deft-accent);text-transform:uppercase;letter-spacing:0.04em;">Lesson Material</span>'
              +   '</div>'
              +   '<div style="font-size:0.875rem;color:var(--deft-txt-2);line-height:1.65;white-space:pre-line;">' + escapeHtml(lessonBody) + '</div>'
              + '</aside>'
              + '<div class="split-view-questions">' + questionsHtml + '</div>'
              + '</div>';
    } else {
        // SINGLE-COLUMN VIEW (default).
        html += renderProgressBar(answeredCount, totalCount);
        html += renderMotivationRow(_motivationStats);
        if (lessonBody) {
            html += renderLessonContent(lessonBody);
        }
        if (_questionsData.length === 0) {
            html += renderEmptyQuestions();
        } else {
            _questionsData.forEach(q => {
                html += renderQuestionCard(q, _answersMap[q.question_id]);
            });
        }
    }

    container.innerHTML = html;

    // Bind event listeners after render
    bindQuestionEvents();
}

// UBR-0132: pop the lesson into a centered modal as a third reading mode.
// Reuses the existing modal-backdrop / modal-content CSS classes from
// school-core.css so it picks up the active dashboard theme.
function openLessonModal() {
    const body = _getLessonBodyText();
    if (!body) {
        if (typeof toast === 'function') toast('No full lesson text yet for this lesson', 'info');
        return;
    }
    let m = document.getElementById('lessonReaderModal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'lessonReaderModal';
        m.className = 'modal-backdrop';
        m.onclick = function (e) { if (e.target === m) m.classList.remove('active'); };
        document.body.appendChild(m);
    }
    const title = escapeHtml(currentLessonTitle || (_lessonDetail && _lessonDetail.title) || 'Lesson');
    m.innerHTML = '<div class="modal-content" style="max-width:760px;max-height:86vh;display:flex;flex-direction:column;padding:0;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--deft-border);">'
        +   '<div style="display:flex;align-items:center;gap:0.5rem;min-width:0;">'
        +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="color:var(--deft-accent);flex-shrink:0;"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        +     '<h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--deft-txt);font-family:var(--deft-heading-font),sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + title + '</h3>'
        +   '</div>'
        +   '<button onclick="document.getElementById(\'lessonReaderModal\').classList.remove(\'active\')" aria-label="Close" style="background:none;border:none;color:var(--deft-txt-3);cursor:pointer;padding:0.25rem;display:flex;"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>'
        + '</div>'
        + '<div style="padding:1.25rem;overflow-y:auto;flex:1;font-size:0.95rem;color:var(--deft-txt-2);line-height:1.7;white-space:pre-line;">' + escapeHtml(body) + '</div>'
        + '</div>';
    m.classList.add('active');
}

// UBR-0132: toggle split-view, persist preference, re-render.
function toggleSplitView() {
    _setSplitView(!_isSplitView());
    const container = document.getElementById('questions-container');
    if (container) renderQuestionsView(container);
}

// ═══════════════════════════════════════
// RENDER — Loading skeleton
// ═══════════════════════════════════════
function renderQuestionsLoading() {
    return `
        <div style="padding: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
                <div style="width: 2rem; height: 2rem; border-radius: 0.5rem; background: var(--deft-surface-hi); animation: pulse 1.5s ease-in-out infinite;"></div>
                <div style="height: 1.25rem; width: 14rem; border-radius: 0.375rem; background: var(--deft-surface-hi); animation: pulse 1.5s ease-in-out infinite;"></div>
            </div>
            <div style="height: 0.5rem; border-radius: 99px; background: var(--deft-surface-hi); margin-bottom: 1.5rem; animation: pulse 1.5s ease-in-out infinite;"></div>
            ${[1,2,3].map(() => `
                <div style="background: var(--deft-surface-el); border: 1px solid var(--deft-border); border-radius: var(--deft-radius, 0.875rem); padding: 1.25rem; margin-bottom: 1rem; animation: pulse 1.5s ease-in-out infinite;">
                    <div style="height: 1rem; width: 70%; border-radius: 0.375rem; background: var(--deft-surface-hi); margin-bottom: 0.75rem;"></div>
                    <div style="height: 4rem; width: 100%; border-radius: 0.5rem; background: var(--deft-surface-hi);"></div>
                </div>
            `).join('')}
        </div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}</style>
    `;
}

// ═══════════════════════════════════════
// RENDER — Header
// ═══════════════════════════════════════
function renderQuestionsHeader(splitView, hasLessonBody) {
    const title = escapeHtml(currentLessonTitle || (_lessonDetail && _lessonDetail.title) || 'Questions');
    const subject = _lessonDetail ? _lessonDetail.subject : null;
    const subjectStyle = subject ? getSubjectStyle(subject) : null;
    const subjectBadge = subjectStyle
        ? `<span style="font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 99px; background: ${subjectStyle.bg}; color: ${subjectStyle.text}; letter-spacing: 0.03em; text-transform: uppercase;">${escapeHtml(subjectStyle.label)}</span>`
        : '';

    // UBR-0128: lesson title is now a clickable button. In single-column view
    // it scrolls to the Lesson Material block; in split view it opens the
    // popup-style lesson modal so the student can read undistracted.
    const titleClick = splitView ? 'openLessonModal()' : 'scrollToLessonMaterial()';
    const titleButton = `
        <button type="button" onclick="${titleClick}" aria-label="Read lesson material"
            style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; padding: 0; background: transparent; border: none; cursor: pointer; text-align: left; flex-wrap: wrap;">
            <h2 style="margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--deft-txt); font-family: var(--deft-heading-font, 'Nunito'), system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 24rem; transition: color 0.15s ease;"
                onmouseover="this.style.color='var(--deft-accent)'" onmouseout="this.style.color='var(--deft-txt)'">
                ${title}
            </h2>
            ${subjectBadge}
        </button>`;

    // UBR-0132: split-view toggle button. Hidden when there's no lesson body
    // to show alongside.
    const splitToggle = hasLessonBody ? `
        <button onclick="toggleSplitView()" aria-label="Toggle split view" aria-pressed="${splitView ? 'true' : 'false'}"
            title="${splitView ? 'Switch to single-column view' : 'Show lesson alongside questions'}"
            style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.75rem; border-radius: 0.5rem; border: 1px solid ${splitView ? 'var(--deft-accent)' : 'var(--deft-border)'}; background: ${splitView ? 'var(--deft-accent-dim)' : 'var(--deft-surface-el)'}; color: ${splitView ? 'var(--deft-accent)' : 'var(--deft-txt-2)'}; cursor: pointer; font-size: 0.775rem; font-weight: 500; transition: all 0.15s ease; white-space: nowrap;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="18" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="3" width="8" height="18" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>
            ${splitView ? 'Single' : 'Split View'}
        </button>` : '';

    // UBR-0139: "Read Lesson" header button removed (redundant with the
    // clickable lesson title and the inline lesson material block).

    return `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 1.5rem 1.5rem 0 1.5rem; flex-wrap: wrap;">
            <button onclick="switchView('lessons')" aria-label="Back to lessons"
                style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 0.5rem; border: 1px solid var(--deft-border); background: var(--deft-surface-el); color: var(--deft-txt-2); cursor: pointer; transition: all 0.15s ease; flex-shrink: 0;"
                onmouseenter="this.style.background='var(--deft-surface-hi)';this.style.color='var(--deft-txt)'"
                onmouseleave="this.style.background='var(--deft-surface-el)';this.style.color='var(--deft-txt-2)'">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            ${titleButton}
            ${splitToggle}
            <button onclick="openVideoSearchModal()" aria-label="Find Videos"
                style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.75rem; border-radius: 0.5rem; border: 1px solid var(--deft-border); background: var(--deft-surface-el); color: var(--deft-txt-2); cursor: pointer; font-size: 0.775rem; font-weight: 500; transition: all 0.15s ease; white-space: nowrap;"
                onmouseenter="this.style.background='var(--deft-surface-hi)';this.style.color='var(--deft-txt)';this.style.borderColor='var(--deft-accent)'"
                onmouseleave="this.style.background='var(--deft-surface-el)';this.style.color='var(--deft-txt-2)';this.style.borderColor='var(--deft-border)'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.43z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><polygon points="9.75,8.27 15.5,11.75 9.75,15.23" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/></svg>
                Find Videos
            </button>
        </div>
    `;
}

// UBR-0128: scroll the lesson material block into view and pulse it so the
// student can locate the lesson text. Used by the clickable lesson title and
// the Read Lesson button in the header.
function scrollToLessonMaterial() {
    const el = document.getElementById('lesson-material-block');
    if (!el) {
        // No inline block (e.g. user is in split view). Fall back to the modal.
        return openLessonModal();
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('lesson-material-pulse');
    void el.offsetWidth;
    el.classList.add('lesson-material-pulse');
}

// ═══════════════════════════════════════
// RENDER — Progress Bar
// ═══════════════════════════════════════
function renderProgressBar(answered, total) {
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    const barColor = pct === 100 ? 'var(--deft-success)' : 'var(--deft-accent)';

    return `
        <div style="padding: 1rem 1.5rem 0.25rem 1.5rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                <span style="font-size: 0.775rem; color: var(--deft-txt-2); font-weight: 500;">
                    ${answered} of ${total} question${total !== 1 ? 's' : ''} answered
                </span>
                <span style="font-size: 0.7rem; color: var(--deft-txt-3); font-weight: 600; font-variant-numeric: tabular-nums;">
                    ${pct}%
                </span>
            </div>
            <div style="width: 100%; height: 6px; border-radius: 99px; background: var(--deft-surface-hi); overflow: hidden;" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Questions progress">
                <div style="width: ${pct}%; height: 100%; border-radius: 99px; background: ${barColor}; transition: width 0.4s ease;"></div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════
// RENDER — Lesson Content Block
// ═══════════════════════════════════════
function renderLessonContent(content) {
    // UBR-0132: lessons are now full 2-3 page bodies (~6500 chars) instead of a
    // 1-sentence summary. Cap the inline block at 18rem with scroll so it does
    // not push the question cards off-screen. Footer buttons let the student
    // pop into the centered popup or split-view if they prefer.
    return `
        <div id="lesson-material-block" style="margin: 1rem 1.5rem 0.5rem 1.5rem; padding: 1rem 1.25rem; background: var(--deft-surface-el); border: 1px solid var(--deft-border); border-radius: var(--deft-radius, 0.875rem); border-left: 3px solid var(--deft-accent); transition: box-shadow 0.3s ease, border-color 0.3s ease;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="color: var(--deft-accent); flex-shrink: 0;"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <span style="font-size: 0.75rem; font-weight: 600; color: var(--deft-accent); text-transform: uppercase; letter-spacing: 0.04em;">Lesson Material</span>
                </div>
                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                    <button onclick="openLessonModal()" type="button" aria-label="Open lesson in popup"
                        style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.25rem 0.6rem;border-radius:0.375rem;border:1px solid var(--deft-border);background:transparent;color:var(--deft-txt-3);cursor:pointer;font-size:0.7rem;font-weight:500;"
                        onmouseenter="this.style.borderColor='var(--deft-accent)';this.style.color='var(--deft-accent)'"
                        onmouseleave="this.style.borderColor='var(--deft-border)';this.style.color='var(--deft-txt-3)'">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M15 3h6v6M21 3l-7 7M10 21H3v-7M3 21l7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        Pop out
                    </button>
                    <button onclick="toggleSplitView()" type="button" aria-label="Switch to split view"
                        style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.25rem 0.6rem;border-radius:0.375rem;border:1px solid var(--deft-border);background:transparent;color:var(--deft-txt-3);cursor:pointer;font-size:0.7rem;font-weight:500;"
                        onmouseenter="this.style.borderColor='var(--deft-accent)';this.style.color='var(--deft-accent)'"
                        onmouseleave="this.style.borderColor='var(--deft-border)';this.style.color='var(--deft-txt-3)'">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="18" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="3" width="8" height="18" rx="1.5" stroke="currentColor" stroke-width="1.8"/></svg>
                        Split view
                    </button>
                </div>
            </div>
            <div style="font-size: 0.875rem; color: var(--deft-txt-2); line-height: 1.65; white-space: pre-line; max-height: 18rem; overflow-y: auto; padding-right: 0.25rem;">${escapeHtml(content)}</div>
        </div>
    `;
}

// ═══════════════════════════════════════
// RENDER — Motivation Row (UBR-0084)
// ═══════════════════════════════════════
function renderMotivationRow(stats) {
    const explanations = (stats && stats.explanations_used) || 0;
    const videos = (stats && stats.videos_searched) || 0;
    const total = explanations + videos;
    const accentColor = total >= 5 ? 'var(--deft-success)' : (total >= 1 ? 'var(--deft-accent)' : 'var(--deft-txt-3)');
    const tooltip = total === 0
        ? 'Add explanations to your answers and look up videos to lift this score.'
        : `${total} learn-more action${total === 1 ? '' : 's'} on this lesson.`;

    const pill = (num, label) => `
        <div style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.65rem; border-radius: 99px; background: var(--deft-surface-el); border: 1px solid var(--deft-border);">
            <span style="font-size: 0.875rem; font-weight: 700; color: ${accentColor}; font-variant-numeric: tabular-nums;">${num}</span>
            <span style="font-size: 0.7rem; color: var(--deft-txt-2); text-transform: uppercase; letter-spacing: 0.04em;">${label}</span>
        </div>`;

    return `
        <div id="motivationRow" style="padding: 0.5rem 1.5rem 0.25rem 1.5rem;" title="${tooltip}">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="font-size: 0.7rem; color: var(--deft-txt-3); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;">Motivation</span>
                ${pill(explanations, 'Explanations')}
                ${pill(videos, 'Videos')}
            </div>
        </div>
    `;
}

function refreshMotivationRow() {
    const el = document.getElementById('motivationRow');
    if (!el) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = renderMotivationRow(_motivationStats);
    const replacement = tmp.firstElementChild;
    if (replacement) el.replaceWith(replacement);
}

// ═══════════════════════════════════════
// RENDER — Empty State
// ═══════════════════════════════════════
function renderEmptyQuestions() {
    return `
        <div style="padding: 3rem 1.5rem; text-align: center;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style="color: var(--deft-txt-3); margin: 0 auto 1rem;">
                <path d="M9 11l3 3L22 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p style="color: var(--deft-txt-3); font-size: 0.875rem; margin: 0;">No questions have been added to this lesson yet.</p>
        </div>
    `;
}

// ═══════════════════════════════════════
// RENDER — Question Card
// ═══════════════════════════════════════
function renderQuestionCard(question, existingAnswer) {
    const qId = question.question_id;
    const qNum = question.question_number || '?';
    const qText = question.question_text || '';
    const isMultipleChoice = question.question_type === 'multiple_choice';
    const options = question.options || [];

    // Determine status from existing answer
    const hasAnswer = !!existingAnswer;
    const isChecked = hasAnswer && existingAnswer.is_correct !== null && existingAnswer.is_correct !== undefined;
    const isCorrect = isChecked && existingAnswer.is_correct;
    const partialCredit = isChecked && (existingAnswer.partial_credit === true);
    // UBR-0149 three-state grading: 'correct' (90+) / 'partial' (70-89) / 'incorrect' (<70).
    const gradeState = isChecked ? (isCorrect && partialCredit ? 'partial' : (isCorrect ? 'correct' : 'incorrect')) : null;
    const answerText = hasAnswer ? (existingAnswer.answer_text || '') : '';
    const answerImageUrl = hasAnswer ? (existingAnswer.answer_image_url || '') : '';
    const aiFeedback = hasAnswer ? (existingAnswer.ai_feedback || '') : '';
    // Prefer override_score (teacher) -> ai_score; tolerate legacy `score` field too.
    const score = hasAnswer
        ? (existingAnswer.override_score != null
            ? existingAnswer.override_score
            : (existingAnswer.ai_score != null ? existingAnswer.ai_score : (existingAnswer.score != null ? existingAnswer.score : null)))
        : null;
    // UBR-0137: answer key surfaced from grading flow so the student can compare
    // their answer against the expected one without losing what they wrote.
    const correctAnswerShown = hasAnswer ? (existingAnswer.correct_answer_shown || '') : '';

    // Color tokens per state — partial credit uses warning/amber so it reads as
    // "good attempt, almost there" rather than the previous harsh red.
    const stateColors = {
        correct:   { line: 'var(--deft-success)',  text: 'var(--deft-success)',  bgDim: 'var(--deft-success-dim, rgba(107,203,119,0.1))', bgBorder: 'rgba(107,203,119,0.2)' },
        partial:   { line: 'var(--deft-warning, #f59e0b)', text: 'var(--deft-warning, #f59e0b)', bgDim: 'rgba(245,158,11,0.1)', bgBorder: 'rgba(245,158,11,0.25)' },
        incorrect: { line: 'var(--deft-danger)',   text: 'var(--deft-danger)',   bgDim: 'var(--deft-danger-dim, rgba(232,93,93,0.1))', bgBorder: 'rgba(232,93,93,0.2)' }
    };
    const sc = gradeState ? stateColors[gradeState] : null;

    // Border style based on grade state.
    let borderLeft = '1px solid var(--deft-border)';
    if (sc) borderLeft = `3px solid ${sc.line}`;

    // Score badge (uses state color so the chip matches the rest of the card).
    let scoreBadge = '';
    if (isChecked && score !== null && score !== undefined) {
        const badgeColor = sc ? sc.text : 'var(--deft-txt-2)';
        scoreBadge = `
            <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.7rem; font-weight: 700; background: ${sc ? sc.bgDim : 'transparent'}; color: ${badgeColor};">
                ${score}%
            </span>`;
    }

    // Status indicator (Correct / Mostly Correct / Incorrect / Submitted).
    let statusIndicator = '';
    if (gradeState === 'correct') {
        statusIndicator = `<span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; font-weight: 600; color: var(--deft-success);">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Correct</span>`;
    } else if (gradeState === 'partial') {
        statusIndicator = `<span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; font-weight: 600; color: var(--deft-warning, #f59e0b);">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M6 1.5 A4.5 4.5 0 0 1 6 10.5 Z" fill="currentColor" stroke="none"/></svg>
            Mostly Correct</span>`;
    } else if (gradeState === 'incorrect') {
        statusIndicator = `<span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; font-weight: 600; color: var(--deft-danger);">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Incorrect</span>`;
    } else if (hasAnswer) {
        statusIndicator = `<span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; font-weight: 600; color: var(--deft-accent);">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/></svg>
            Submitted</span>`;
    }

    // UBR-0137: once an answer is checked, freeze the input UI and show the
    // student's verbatim answer plus the answer key in dedicated read-only
    // blocks so the student can compare their work against what was expected.
    // For unchecked questions we keep the editable MC radios + textarea.

    // Multiple choice options (only while not yet checked).
    let mcHtml = '';
    if (!isChecked && isMultipleChoice && options.length > 0) {
        mcHtml = `<div style="display: flex; flex-direction: column; gap: 0.5rem; margin: 0.75rem 0;" role="radiogroup" aria-label="Answer options for question ${qNum}">`;
        options.forEach((opt, idx) => {
            const optId = `q${qId}_opt${idx}`;
            const isSelected = answerText === opt;
            const selectedBg = isSelected ? 'var(--deft-accent-dim)' : 'transparent';
            const selectedBorder = isSelected ? 'var(--deft-accent)' : 'var(--deft-border)';
            mcHtml += `
                <label for="${optId}" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0.75rem; border-radius: 0.5rem; border: 1px solid ${selectedBorder}; background: ${selectedBg}; cursor: pointer; transition: all 0.15s ease;"
                    onmouseenter="if(!this.querySelector('input').checked){this.style.background='rgba(255,255,255,0.03)'}"
                    onmouseleave="if(!this.querySelector('input').checked){this.style.background='${isSelected ? 'var(--deft-accent-dim)' : 'transparent'}'}">
                    <input type="radio" id="${optId}" name="mc_${qId}" value="${escapeHtml(opt)}"
                        ${isSelected ? 'checked' : ''}
                        style="accent-color: var(--deft-accent); margin: 0; width: 1rem; height: 1rem; cursor: pointer;"
                        onchange="handleMcSelect('${qId}', this.value, this.closest('div[role=radiogroup]'))">
                    <span style="font-size: 0.85rem; color: var(--deft-txt); line-height: 1.4;">${escapeHtml(opt)}</span>
                </label>`;
        });
        mcHtml += '</div>';
    }

    // Text area for typed answer (only while not yet checked).
    const textareaHtml = !isChecked ? `
        <textarea id="answer_text_${qId}" rows="3"
            placeholder="${isMultipleChoice ? 'Add an explanation (optional)...' : 'Type your answer here...'}"
            style="width: 100%; padding: 0.65rem 0.75rem; border-radius: 0.5rem; border: 1px solid var(--deft-border); background: var(--deft-surface); color: var(--deft-txt); font-size: 0.85rem; font-family: inherit; resize: vertical; min-height: 4rem; line-height: 1.5; transition: border-color 0.15s ease; box-sizing: border-box;"
            onfocus="this.style.borderColor='var(--deft-accent)'"
            onblur="this.style.borderColor='var(--deft-border)'"
        >${escapeHtml(answerText)}</textarea>` : '';

    // UBR-0137: read-only "Your Answer" block shown after grading.
    let yourAnswerHtml = '';
    if (isChecked) {
        const displayAnswer = answerText || '(no text answer submitted)';
        yourAnswerHtml = `
            <div style="margin-top: 0.5rem; padding: 0.75rem 1rem; border-radius: 0.5rem; background: var(--deft-surface); border: 1px solid var(--deft-border);">
                <div style="font-size: 0.7rem; font-weight: 600; color: var(--deft-txt-3); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem;">Your Answer</div>
                <p style="margin: 0; font-size: 0.875rem; color: var(--deft-txt); line-height: 1.55; white-space: pre-line;">${escapeHtml(displayAnswer)}</p>
            </div>`;
    }

    // UBR-0137: side-by-side Answer Key when one is available so the student can compare.
    let answerKeyHtml = '';
    if (isChecked && correctAnswerShown) {
        answerKeyHtml = `
            <div style="margin-top: 0.5rem; padding: 0.75rem 1rem; border-radius: 0.5rem; background: rgba(107,203,119,0.06); border: 1px solid rgba(107,203,119,0.25);">
                <div style="font-size: 0.7rem; font-weight: 600; color: var(--deft-success); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem;">Answer Key</div>
                <p style="margin: 0; font-size: 0.875rem; color: var(--deft-txt); line-height: 1.55; white-space: pre-line;">${escapeHtml(correctAnswerShown)}</p>
            </div>`;
    }

    // Uploaded image preview
    let imagePreviewHtml = '';
    if (answerImageUrl) {
        imagePreviewHtml = `
            <div id="img_preview_${qId}" style="margin-top: 0.5rem; position: relative; display: inline-block;">
                <img src="${escapeHtml(answerImageUrl)}" alt="Answer image"
                    style="max-width: 100%; max-height: 12rem; border-radius: 0.5rem; border: 1px solid var(--deft-border); object-fit: contain; cursor: pointer;"
                    onclick="window.open(this.src, '_blank')">
                ${!isChecked ? `<button onclick="clearAnswerImage('${qId}')" aria-label="Remove image"
                    style="position: absolute; top: 0.25rem; right: 0.25rem; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: rgba(0,0,0,0.7); border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">&times;</button>` : ''}
            </div>`;
    } else {
        imagePreviewHtml = `<div id="img_preview_${qId}" style="margin-top: 0.5rem; display: none;"></div>`;
    }

    // AI feedback section — colored to match the three-state grade (UBR-0149).
    let feedbackHtml = '';
    if (isChecked && aiFeedback) {
        const fbBg = sc ? sc.bgDim : 'var(--deft-surface-el)';
        const fbBorder = sc ? sc.bgBorder : 'var(--deft-border)';
        const fbAccent = sc ? sc.text : 'var(--deft-txt-2)';
        feedbackHtml = `
            <div style="margin-top: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.5rem; background: ${fbBg}; border: 1px solid ${fbBorder};">
                <div style="display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.35rem;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="color: ${fbAccent}; flex-shrink: 0;">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span style="font-size: 0.7rem; font-weight: 600; color: ${fbAccent}; text-transform: uppercase; letter-spacing: 0.03em;">AI Feedback</span>
                </div>
                <p style="margin: 0; font-size: 0.825rem; color: var(--deft-txt-2); line-height: 1.55;">${escapeHtml(aiFeedback)}</p>
            </div>`;
    }

    // Hint section (collapsible, starts hidden)
    const hintHtml = `<div id="hint_${qId}" style="display: none; margin-top: 0.5rem;"></div>`;

    // Action buttons
    const uploadBtnHtml = !isChecked ? `
        <input type="file" id="file_${qId}" accept="image/*" style="display: none;" onchange="handleImageUpload('${qId}', this)">
        <button onclick="document.getElementById('file_${qId}').click()" aria-label="Upload image"
            style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.65rem; border-radius: 0.375rem; border: 1px solid var(--deft-border); background: transparent; color: var(--deft-txt-2); cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: all 0.15s ease;"
            onmouseenter="this.style.borderColor='var(--deft-txt-2)';this.style.color='var(--deft-txt)'"
            onmouseleave="this.style.borderColor='var(--deft-border)';this.style.color='var(--deft-txt-2)'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Upload Image
        </button>` : '';

    const hintBtnHtml = !isChecked ? `
        <button onclick="handleGetHint('${qId}')" id="hint_btn_${qId}" aria-label="Get a hint"
            style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.65rem; border-radius: 0.375rem; border: 1px solid var(--deft-border); background: transparent; color: var(--deft-txt-2); cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: all 0.15s ease;"
            onmouseenter="this.style.borderColor='var(--deft-warning)';this.style.color='var(--deft-warning)'"
            onmouseleave="this.style.borderColor='var(--deft-border)';this.style.color='var(--deft-txt-2)'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/></svg>
            Get Hint
        </button>` : '';

    const submitBtnHtml = !isChecked ? `
        <button onclick="handleSubmitAnswer('${qId}')" id="submit_btn_${qId}"
            style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.85rem; border-radius: 0.375rem; border: none; background: var(--deft-accent); color: var(--deft-base); cursor: pointer; font-size: 0.75rem; font-weight: 700; transition: all 0.15s ease; margin-left: auto;"
            onmouseenter="this.style.opacity='0.88'"
            onmouseleave="this.style.opacity='1'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Submit Answer
        </button>` : '';

    // Spinner placeholder (hidden initially)
    const spinnerHtml = `<div id="spinner_${qId}" style="display: none; margin-left: auto;">
        <div style="width: 1.25rem; height: 1.25rem; border: 2px solid var(--deft-border); border-top-color: var(--deft-accent); border-radius: 50%; animation: qSpin 0.6s linear infinite;"></div>
    </div>`;

    return `
        <div id="card_${qId}" data-question-id="${qId}"
            style="background: var(--deft-surface-el); border: 1px solid var(--deft-border); border-left: ${borderLeft}; border-radius: var(--deft-radius, 0.875rem); padding: 1.25rem; margin: 0.75rem 1.5rem; transition: border-color 0.3s ease, border-left 0.3s ease;">

            <!-- Question header -->
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.6rem;">
                <div style="display: flex; align-items: baseline; gap: 0.5rem; flex: 1; min-width: 0;">
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 1.6rem; height: 1.6rem; border-radius: 50%; background: var(--deft-accent-dim); color: var(--deft-accent); font-size: 0.7rem; font-weight: 700; flex-shrink: 0;">${qNum}</span>
                    <p style="margin: 0; font-size: 0.925rem; font-weight: 600; color: var(--deft-txt); line-height: 1.45;">${escapeHtml(qText)}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0;">
                    ${scoreBadge}
                    ${statusIndicator}
                </div>
            </div>

            <!-- Multiple choice options (only while not yet checked) -->
            ${mcHtml}

            <!-- Text answer textarea (only while not yet checked) -->
            ${textareaHtml ? `<div style="margin-top: 0.5rem;">${textareaHtml}</div>` : ''}

            <!-- UBR-0137: read-only "Your Answer" block after grading -->
            ${yourAnswerHtml}

            <!-- UBR-0137: Answer Key block after grading (when available) -->
            ${answerKeyHtml}

            <!-- Image preview -->
            ${imagePreviewHtml}

            <!-- AI feedback -->
            ${feedbackHtml}

            <!-- Hint section -->
            ${hintHtml}

            <!-- Action buttons -->
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap;">
                ${uploadBtnHtml}
                ${hintBtnHtml}
                ${spinnerHtml}
                ${submitBtnHtml}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════
// EVENT BINDING
// ═══════════════════════════════════════
function bindQuestionEvents() {
    // Add spin animation keyframes if not already present
    if (!document.getElementById('q-spin-style')) {
        const style = document.createElement('style');
        style.id = 'q-spin-style';
        style.textContent = '@keyframes qSpin{to{transform:rotate(360deg)}}'
            + '@keyframes lessonMaterialPulse{0%{box-shadow:0 0 0 0 rgba(6,214,160,.55);border-color:var(--deft-accent);}70%{box-shadow:0 0 0 14px rgba(6,214,160,0);border-color:var(--deft-accent);}100%{box-shadow:0 0 0 0 rgba(6,214,160,0);border-color:var(--deft-border);}}'
            + '.lesson-material-pulse{animation:lessonMaterialPulse 1.4s ease-out 1;}';
        document.head.appendChild(style);
    }
}

// ═══════════════════════════════════════
// HANDLERS — Multiple Choice Selection
// ═══════════════════════════════════════
function handleMcSelect(qId, value, radioGroup) {
    // Update visual state of radio labels
    if (!radioGroup) return;
    radioGroup.querySelectorAll('label').forEach(label => {
        const input = label.querySelector('input');
        if (input && input.checked) {
            label.style.background = 'var(--deft-accent-dim)';
            label.style.borderColor = 'var(--deft-accent)';
        } else {
            label.style.background = 'transparent';
            label.style.borderColor = 'var(--deft-border)';
        }
    });
}

// ═══════════════════════════════════════
// HANDLERS — Image Upload
// ═══════════════════════════════════════
async function handleImageUpload(qId, fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        toast('Image must be under 5MB', 'error');
        fileInput.value = '';
        return;
    }

    const preview = document.getElementById(`img_preview_${qId}`);
    if (!preview) return;

    // Show uploading state
    preview.style.display = 'block';
    preview.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border-radius: 0.5rem; background: var(--deft-surface-hi); border: 1px dashed var(--deft-border);">
            <div style="width: 1rem; height: 1rem; border: 2px solid var(--deft-border); border-top-color: var(--deft-accent); border-radius: 50%; animation: qSpin 0.6s linear infinite;"></div>
            <span style="font-size: 0.8rem; color: var(--deft-txt-2);">Uploading...</span>
        </div>`;

    const publicUrl = await uploadAnswerImage(file);

    if (publicUrl) {
        // Store URL on the preview element for retrieval during submit
        preview.dataset.imageUrl = publicUrl;
        preview.innerHTML = `
            <div style="position: relative; display: inline-block;">
                <img src="${escapeHtml(publicUrl)}" alt="Answer image"
                    style="max-width: 100%; max-height: 12rem; border-radius: 0.5rem; border: 1px solid var(--deft-border); object-fit: contain; cursor: pointer;"
                    onclick="window.open(this.src, '_blank')">
                <button onclick="clearAnswerImage('${qId}')" aria-label="Remove image"
                    style="position: absolute; top: 0.25rem; right: 0.25rem; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: rgba(0,0,0,0.7); border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">&times;</button>
            </div>`;
        toast('Image uploaded', 'success');
    } else {
        preview.style.display = 'none';
        preview.innerHTML = '';
        delete preview.dataset.imageUrl;
    }

    fileInput.value = '';
}

function clearAnswerImage(qId) {
    const preview = document.getElementById(`img_preview_${qId}`);
    if (preview) {
        preview.style.display = 'none';
        preview.innerHTML = '';
        delete preview.dataset.imageUrl;
    }
}

// ═══════════════════════════════════════
// HANDLERS — Submit Answer
// ═══════════════════════════════════════
async function handleSubmitAnswer(qId) {
    // Gather answer text
    const textarea = document.getElementById(`answer_text_${qId}`);
    let answerText = textarea ? textarea.value.trim() : '';

    // Capture the raw textarea value BEFORE merging with MC selection — for MC
    // questions this is the optional explanation. Used by motivation tracker (UBR-0084).
    const rawExplanation = answerText;

    // Check for multiple choice selection
    const mcRadio = document.querySelector(`input[name="mc_${qId}"]:checked`);
    const isMcSubmission = !!mcRadio;
    if (mcRadio) {
        // For MC questions, the selected option IS the answer; textarea is supplemental
        answerText = mcRadio.value + (answerText ? '\n\n' + answerText : '');
    }

    // Get image URL if uploaded
    const preview = document.getElementById(`img_preview_${qId}`);
    const answerImageUrl = (preview && preview.dataset.imageUrl) || '';

    // Validate: must have at least some answer
    if (!answerText && !answerImageUrl) {
        toast('Please provide an answer before submitting', 'error');
        return;
    }

    // Show spinner, hide submit button
    const submitBtn = document.getElementById(`submit_btn_${qId}`);
    const spinner = document.getElementById(`spinner_${qId}`);
    if (submitBtn) submitBtn.style.display = 'none';
    if (spinner) spinner.style.display = 'flex';

    // UBR-0131: AI grading routinely takes 5-15s. Bump timeout to 60s so the
    // request doesn't get aborted mid-call. The user previously saw the
    // spinner reset with no toast because the default 30s window was firing
    // mid-grade and schoolApi's silent return-null then hid the failure.
    const result = await schoolApi('submit_answer', {
        assignment_id: currentAssignmentId,
        question_id: qId,
        answer_text: answerText,
        answer_image_url: answerImageUrl || null
    }, { timeout: 60000 });

    if (spinner) spinner.style.display = 'none';

    if (result) {
        // Update local answers map
        const answerData = result.data || result;
        _answersMap[qId] = answerData;

        // Motivation tracker (UBR-0084): on MC questions, log when the student
        // wrote a non-empty explanation. Only count once per (assignment, question)
        // to keep the metric meaningful even if the user re-submits.
        if (isMcSubmission && rawExplanation && rawExplanation.length > 0) {
            const previouslyHadExplanation = !!(answerData
                && answerData.answer_text
                && /\n\n/.test(answerData.answer_text)
                && _answersMap[qId] === answerData
                && answerData._counted_explanation);
            if (!previouslyHadExplanation) {
                logMotivationEvent('explanation_added', {
                    question_id: qId,
                    explanation_length: rawExplanation.length
                });
                _motivationStats.explanations_used = (_motivationStats.explanations_used || 0) + 1;
                if (answerData) answerData._counted_explanation = true;
                refreshMotivationRow();
            }
        }

        // Re-render this card in place
        const card = document.getElementById(`card_${qId}`);
        if (card) {
            const question = _questionsData.find(q => q.question_id === qId);
            if (question) {
                const tmp = document.createElement('div');
                tmp.innerHTML = renderQuestionCard(question, answerData);
                card.replaceWith(tmp.firstElementChild);
            }
        }

        // Update progress bar
        updateProgressBar();

        toast('Answer submitted!', 'success');
    } else {
        // UBR-0131: explicit failure toast so the student is never left
        // wondering whether their answer went through. schoolApi may already
        // have toasted (timeout / connection / success:false), but this
        // catches the empty-response branch where it returns null silently.
        if (typeof toast === 'function') toast('Could not submit answer. Please try again.', 'error');
        // Restore submit button on failure
        if (submitBtn) submitBtn.style.display = 'inline-flex';
    }
}

// ═══════════════════════════════════════
// HANDLERS — Get Hint
// ═══════════════════════════════════════
async function handleGetHint(qId) {
    const hintEl = document.getElementById(`hint_${qId}`);
    const hintBtn = document.getElementById(`hint_btn_${qId}`);
    if (!hintEl) return;

    // Toggle off if already visible
    if (hintEl.style.display !== 'none' && hintEl.innerHTML) {
        hintEl.style.display = 'none';
        return;
    }

    // Check cache
    if (_hintCache[qId]) {
        renderHint(qId, _hintCache[qId]);
        return;
    }

    // Find question data
    const question = _questionsData.find(q => q.question_id === qId);
    if (!question) return;

    // Disable button, show loading
    if (hintBtn) {
        hintBtn.disabled = true;
        hintBtn.style.opacity = '0.5';
    }
    hintEl.style.display = 'block';
    hintEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem; border-radius: 0.5rem; background: var(--deft-warning-dim, rgba(240,168,48,0.1)); border: 1px solid rgba(240,168,48,0.15);">
            <div style="width: 1rem; height: 1rem; border: 2px solid var(--deft-border); border-top-color: var(--deft-warning); border-radius: 50%; animation: qSpin 0.6s linear infinite;"></div>
            <span style="font-size: 0.8rem; color: var(--deft-warning);">Thinking of a hint...</span>
        </div>`;

    const result = await schoolApi('get_hint', {
        question_id: qId,
        question_text: question.question_text,
        correct_answer: question.correct_answer || ''
    });

    if (hintBtn) {
        hintBtn.disabled = false;
        hintBtn.style.opacity = '1';
    }

    if (result) {
        const hintText = (result.data && result.data.hint) || result.hint || result.data || 'No hint available.';
        _hintCache[qId] = typeof hintText === 'string' ? hintText : JSON.stringify(hintText);
        renderHint(qId, _hintCache[qId]);
        // UBR-0169: track hint usage so the teacher Grades tab can show motivation.
        logMotivationEvent('hint_used', { question_id: qId });
        _motivationStats.hints_used = (_motivationStats.hints_used || 0) + 1;
    } else {
        hintEl.innerHTML = `
            <div style="padding: 0.6rem 0.75rem; border-radius: 0.5rem; background: var(--deft-danger-dim, rgba(232,93,93,0.1)); border: 1px solid rgba(232,93,93,0.15);">
                <span style="font-size: 0.8rem; color: var(--deft-danger);">Could not load hint. Try again.</span>
            </div>`;
    }
}

function renderHint(qId, hintText) {
    const hintEl = document.getElementById(`hint_${qId}`);
    if (!hintEl) return;

    hintEl.style.display = 'block';
    hintEl.innerHTML = `
        <div style="padding: 0.65rem 0.85rem; border-radius: 0.5rem; background: var(--deft-warning-dim, rgba(240,168,48,0.1)); border: 1px solid rgba(240,168,48,0.15);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem;">
                <div style="display: flex; align-items: center; gap: 0.3rem;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="color: var(--deft-warning);">
                        <path d="M9 18h6M10 22h4M12 2a7 7 0 015 11.9V17H7v-3.1A7 7 0 0112 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span style="font-size: 0.7rem; font-weight: 600; color: var(--deft-warning); text-transform: uppercase; letter-spacing: 0.03em;">Hint</span>
                </div>
                <button onclick="document.getElementById('hint_${qId}').style.display='none'" aria-label="Close hint"
                    style="background: none; border: none; color: var(--deft-txt-3); cursor: pointer; padding: 0.15rem; display: flex; align-items: center; justify-content: center;"
                    onmouseenter="this.style.color='var(--deft-txt)'"
                    onmouseleave="this.style.color='var(--deft-txt-3)'">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </button>
            </div>
            <p style="margin: 0; font-size: 0.825rem; color: var(--deft-txt-2); line-height: 1.5;">${escapeHtml(hintText)}</p>
        </div>`;
}

// ═══════════════════════════════════════
// PROGRESS BAR — Live Update
// ═══════════════════════════════════════
function updateProgressBar() {
    const container = document.getElementById('questions-container');
    if (!container) return;

    const answeredCount = Object.keys(_answersMap).length;
    const totalCount = _questionsData.length;

    // Find and replace the progress bar element
    const progressBar = container.querySelector('[role="progressbar"]');
    if (progressBar) {
        const pct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
        const barColor = pct === 100 ? 'var(--deft-success)' : 'var(--deft-accent)';
        progressBar.setAttribute('aria-valuenow', pct);
        const fill = progressBar.querySelector('div');
        if (fill) {
            fill.style.width = pct + '%';
            fill.style.background = barColor;
        }

        // Update text
        const wrapper = progressBar.parentElement;
        if (wrapper) {
            const textSpan = wrapper.querySelector('span:first-child');
            const pctSpan = wrapper.querySelector('span:last-child');
            if (textSpan) textSpan.textContent = `${answeredCount} of ${totalCount} question${totalCount !== 1 ? 's' : ''} answered`;
            if (pctSpan) pctSpan.textContent = pct + '%';
        }
    }
}

// ═══════════════════════════════════════
// VIDEO SEARCH MODAL
// ═══════════════════════════════════════
function openVideoSearchModal() {
    const title = currentLessonTitle || (_lessonDetail && _lessonDetail.title) || 'lesson';
    const subject = (_lessonDetail && _lessonDetail.subject) || '';
    const searchQuery = encodeURIComponent(title + (subject ? ' ' + subject : '') + ' for kids');

    // Check if modal already exists, create if not
    let modal = document.getElementById('videoSearchModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'videoSearchModal';
        modal.className = 'modal-backdrop';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background: var(--deft-surface); border: 1px solid var(--deft-border); border-radius: var(--deft-radius, 0.875rem); width: 90%; max-width: 36rem; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 25px 60px rgba(0,0,0,0.5);">
            <!-- Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid var(--deft-border);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="color: var(--deft-danger);">
                        <path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.43z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                        <polygon points="9.75,8.27 15.5,11.75 9.75,15.23" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
                    </svg>
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--deft-txt); font-family: var(--deft-heading-font, 'Nunito'), system-ui, sans-serif;">Find Videos</h3>
                </div>
                <button onclick="closeModal('videoSearchModal')" aria-label="Close"
                    style="background: none; border: none; color: var(--deft-txt-3); cursor: pointer; padding: 0.25rem; display: flex;"
                    onmouseenter="this.style.color='var(--deft-txt)'"
                    onmouseleave="this.style.color='var(--deft-txt-3)'">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </button>
            </div>
            <!-- Body -->
            <div style="padding: 1.25rem; overflow-y: auto; flex: 1;">
                <p style="margin: 0 0 1rem; font-size: 0.85rem; color: var(--deft-txt-2); line-height: 1.5;">
                    Search YouTube for videos about <strong style="color: var(--deft-txt);">${escapeHtml(currentLessonTitle || title)}</strong>.
                </p>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                    <input type="text" id="videoSearchInput" value="${escapeHtml(decodeURIComponent(searchQuery))}"
                        placeholder="Search for educational videos..."
                        style="flex: 1; padding: 0.55rem 0.75rem; border-radius: 0.5rem; border: 1px solid var(--deft-border); background: var(--deft-surface-el); color: var(--deft-txt); font-size: 0.85rem; font-family: inherit;"
                        onfocus="this.style.borderColor='var(--deft-accent)'"
                        onblur="this.style.borderColor='var(--deft-border)'"
                        onkeydown="if(event.key==='Enter')searchVideos()">
                    <button onclick="searchVideos()"
                        style="padding: 0.55rem 1rem; border-radius: 0.5rem; border: none; background: var(--deft-accent); color: var(--deft-base); font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: opacity 0.15s;"
                        onmouseenter="this.style.opacity='0.88'"
                        onmouseleave="this.style.opacity='1'">
                        Search
                    </button>
                </div>
                <div id="videoSearchResults" style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <p style="text-align: center; color: var(--deft-txt-3); font-size: 0.8rem; padding: 1rem 0;">Press Search or Enter to find videos.</p>
                </div>
            </div>
        </div>`;

    openModal('videoSearchModal');

    // Focus the search input
    setTimeout(() => {
        const input = document.getElementById('videoSearchInput');
        if (input) input.focus();
    }, 100);
}

async function searchVideos() {
    const input = document.getElementById('videoSearchInput');
    const resultsEl = document.getElementById('videoSearchResults');
    if (!input || !resultsEl) return;

    const query = input.value.trim();
    if (!query) return;

    resultsEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 2rem 0;">
            <div style="width: 1.25rem; height: 1.25rem; border: 2px solid var(--deft-border); border-top-color: var(--deft-accent); border-radius: 50%; animation: qSpin 0.6s linear infinite;"></div>
            <span style="font-size: 0.8rem; color: var(--deft-txt-2);">Searching...</span>
        </div>`;

    // Motivation tracker (UBR-0084): the student is asking for more learning material.
    logMotivationEvent('video_search', { query });
    _motivationStats.videos_searched = (_motivationStats.videos_searched || 0) + 1;
    refreshMotivationRow();

    // UBR-0127: backend operation is search_youtube; response shape is
    // {success, videos:[{id,title,channel,thumbnail}], count}.
    const result = await schoolApi('search_youtube', { query }, { timeout: 15000 });
    const videos = result && Array.isArray(result.videos) ? result.videos : null;

    if (videos && videos.length > 0) {
        resultsEl.innerHTML = videos.map(v => {
            const videoId = v.id || v.video_id || '';
            const thumbnail = v.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            const videoTitle = v.title || 'Untitled Video';
            const channel = v.channel || '';
            const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

            return `
                <a href="${ytUrl}" target="_blank" rel="noopener noreferrer"
                    style="display: flex; gap: 0.75rem; padding: 0.6rem; border-radius: 0.5rem; border: 1px solid var(--deft-border); background: var(--deft-surface-el); text-decoration: none; transition: all 0.15s ease;"
                    onmouseenter="this.style.borderColor='var(--deft-accent)';this.style.background='var(--deft-surface-hi)'"
                    onmouseleave="this.style.borderColor='var(--deft-border)';this.style.background='var(--deft-surface-el)'">
                    <img src="${escapeHtml(thumbnail)}" alt="" loading="lazy"
                        style="width: 7.5rem; height: 4.2rem; border-radius: 0.375rem; object-fit: cover; flex-shrink: 0; background: var(--deft-surface-hi);">
                    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 0.2rem;">
                        <span style="font-size: 0.825rem; font-weight: 600; color: var(--deft-txt); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(videoTitle)}</span>
                        ${channel ? `<span style="font-size: 0.7rem; color: var(--deft-txt-3);">${escapeHtml(channel)}</span>` : ''}
                    </div>
                </a>`;
        }).join('');
    } else if (videos && videos.length === 0) {
        resultsEl.innerHTML = `<p style="text-align: center; color: var(--deft-txt-3); font-size: 0.8rem; padding: 2rem 0;">No videos found. Try a different search.</p>`;
    } else {
        // Fallback: open YouTube search in new tab
        const ytSearchUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
        resultsEl.innerHTML = `
            <div style="text-align: center; padding: 1.5rem 0;">
                <p style="color: var(--deft-txt-3); font-size: 0.8rem; margin: 0 0 0.75rem;">Video search is not available right now.</p>
                <a href="${ytSearchUrl}" target="_blank" rel="noopener noreferrer"
                    style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.85rem; border-radius: 0.5rem; background: var(--deft-danger); color: #fff; text-decoration: none; font-size: 0.8rem; font-weight: 600; transition: opacity 0.15s;"
                    onmouseenter="this.style.opacity='0.88'"
                    onmouseleave="this.style.opacity='1'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Search on YouTube
                </a>
            </div>`;
    }
}
