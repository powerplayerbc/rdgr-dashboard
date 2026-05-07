// ═══════════════════════════════════════
// Tab: Teacher Panel
// Lesson creation, review, grading, and assignment management
// ═══════════════════════════════════════

// ── Local state ──
let teacherLessons = [];
let teacherLessonSearch = '';
let teacherCreatorTab = 'ai';
let manualQuestions = [];
let generatedLesson = null;
let pendingReviews = [];

// ═══════════════════════════════════════
// MAIN ENTRY
// ═══════════════════════════════════════

async function refreshTeacher() {
    const container = document.getElementById('teacher-container');
    if (!container) return;

    if (!isTeacher()) {
        container.innerHTML = emptyState('This area is for teachers only.', 'error');
        return;
    }

    // Reset local state
    generatedLesson = null;
    manualQuestions = [];
    teacherCreatorTab = 'ai';

    container.innerHTML = buildTeacherPanel();

    // Load data in parallel
    await Promise.all([
        loadTeacherLessons(),
        loadPendingReviews(),
        loadExcuseManager()
    ]);
}

// ═══════════════════════════════════════
// MAIN LAYOUT
// ═══════════════════════════════════════

function buildTeacherPanel() {
    return `
        <div style="display:flex;flex-direction:column;gap:20px;">

            <!-- Section A: Lesson Creator -->
            <div class="panel" id="lessonCreatorPanel">
                <div class="panel-header">
                    <h3 style="margin:0;font-size:15px;font-weight:700;color:var(--deft-txt);
                               font-family:var(--deft-heading-font),sans-serif;display:flex;align-items:center;gap:8px;">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                            <path d="M9 2v14M2 9h14" stroke="var(--deft-accent)" stroke-width="1.8" stroke-linecap="round"/>
                        </svg>
                        Lesson Creator
                    </h3>
                </div>
                <div class="panel-body" style="padding-top:0;">
                    ${buildCreatorTabs()}
                    <div id="creatorContent">
                        ${buildAIGenerateForm()}
                    </div>
                </div>
            </div>

            <!-- Section B: Lesson Library -->
            <div class="panel" id="lessonLibraryPanel">
                <div class="panel-header">
                    <h3 style="margin:0;font-size:15px;font-weight:700;color:var(--deft-txt);
                               font-family:var(--deft-heading-font),sans-serif;display:flex;align-items:center;gap:8px;">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                            <path d="M2 3h5a2 2 0 012 2v10a1.5 1.5 0 00-1.5-1.5H2V3zM16 3h-5a2 2 0 00-2 2v10a1.5 1.5 0 011.5-1.5H16V3z"
                                  stroke="var(--deft-accent)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Lesson Library
                    </h3>
                    <div style="position:relative;">
                        <input type="text" class="form-input" id="lessonLibrarySearch"
                               placeholder="Search lessons..."
                               oninput="handleLessonLibrarySearch(this.value)"
                               style="width:200px;padding-right:28px;font-size:13px;"
                               aria-label="Search lesson library">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                             style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;"
                             aria-hidden="true">
                            <circle cx="6" cy="6" r="4.5" stroke="var(--deft-txt-3)" stroke-width="1.2"/>
                            <path d="M9.5 9.5L12.5 12.5" stroke="var(--deft-txt-3)" stroke-width="1.2" stroke-linecap="round"/>
                        </svg>
                    </div>
                </div>
                <div class="panel-body" id="lessonLibraryList" style="max-height:420px;overflow-y:auto;">
                    ${buildSkeletons(3)}
                </div>
            </div>

            <!-- Section C: Pending Reviews -->
            <div class="panel" id="pendingReviewsPanel">
                <div class="panel-header">
                    <h3 style="margin:0;font-size:15px;font-weight:700;color:var(--deft-txt);
                               font-family:var(--deft-heading-font),sans-serif;display:flex;align-items:center;gap:8px;">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                            <path d="M3 7l3 3 5-5" stroke="var(--deft-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                            <rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="var(--deft-accent)" stroke-width="1.3"/>
                        </svg>
                        Pending Reviews
                    </h3>
                    <span id="reviewCount" style="font-size:12px;color:var(--deft-txt-3);
                                                   font-family:var(--deft-body-font),sans-serif;"></span>
                </div>
                <div class="panel-body" id="pendingReviewsList" style="max-height:480px;overflow-y:auto;">
                    ${buildSkeletons(2)}
                </div>
            </div>

            <!-- Section D: Excuse Manager -->
            <div class="panel" id="excuseManagerPanel">
                <div class="panel-header">
                    <h3 style="margin:0;font-size:15px;font-weight:700;color:var(--deft-txt);
                               font-family:var(--deft-heading-font),sans-serif;display:flex;align-items:center;gap:8px;">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                            <circle cx="9" cy="9" r="7" stroke="var(--deft-accent-warm)" stroke-width="1.3"/>
                            <path d="M9 5.5v4M9 12v.5" stroke="var(--deft-accent-warm)" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        Excuse Manager
                    </h3>
                </div>
                <div class="panel-body" id="excuseManagerList">
                    ${buildSkeletons(2)}
                </div>
            </div>

        </div>
    `;
}

// ═══════════════════════════════════════
// CREATOR TABS
// ═══════════════════════════════════════

function buildCreatorTabs() {
    const tabs = [
        { key: 'ai', label: 'AI Generate', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M2.8 11.2l1.4-1.4M9.8 4.2l1.4-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>' },
        { key: 'manual', label: 'Manual Create', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 1.5l2.5 2.5L5 11.5l-3.5 1 1-3.5L10 1.5z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
        { key: 'sheet', label: 'Sync from Sheet', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2" width="11" height="10" rx="1" stroke="currentColor" stroke-width="1.1"/><path d="M1.5 5h11M5 5v7" stroke="currentColor" stroke-width="1.1"/></svg>' },
        { key: 'drive', label: 'Import from Drive', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4.8 1.5L1.5 7.5h4l-1.2 5 6.2-7h-4l1.3-4z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
    ];

    return `
        <div style="display:flex;gap:4px;padding:12px 0 16px;border-bottom:1px solid var(--deft-border);margin-bottom:16px;
                    overflow-x:auto;" role="tablist" aria-label="Lesson creation methods">
            ${tabs.map(t => {
                const isActive = teacherCreatorTab === t.key;
                return `
                    <button onclick="switchCreatorTab('${t.key}')"
                            role="tab"
                            aria-selected="${isActive}"
                            aria-controls="creatorContent"
                            style="display:flex;align-items:center;gap:6px;
                                   padding:7px 14px;border-radius:8px;border:none;
                                   font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;
                                   font-family:var(--deft-heading-font),sans-serif;
                                   letter-spacing:0.03em;text-transform:uppercase;
                                   transition:background 0.15s,color 0.15s;
                                   background:${isActive ? 'var(--deft-accent-dim)' : 'transparent'};
                                   color:${isActive ? 'var(--deft-accent)' : 'var(--deft-txt-2)'};"
                            onmouseenter="if(!this.getAttribute('aria-selected').includes('true'))this.style.color='var(--deft-txt)'"
                            onmouseleave="if(!this.getAttribute('aria-selected').includes('true'))this.style.color='var(--deft-txt-2)'">
                        ${t.icon}
                        ${t.label}
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

function switchCreatorTab(tab) {
    teacherCreatorTab = tab;
    generatedLesson = null;

    // Re-render tabs and content
    const panel = document.getElementById('lessonCreatorPanel');
    if (!panel) return;
    const body = panel.querySelector('.panel-body');
    if (!body) return;

    let content = '';
    switch (tab) {
        case 'ai':      content = buildAIGenerateForm(); break;
        case 'manual':  content = buildManualCreateForm(); manualQuestions = []; break;
        case 'sheet':   content = buildSheetSyncPanel(); break;
        case 'drive':   content = buildDriveImportPanel(); break;
    }

    body.innerHTML = buildCreatorTabs() + `<div id="creatorContent">${content}</div>`;
}

// ═══════════════════════════════════════
// SUBJECT DROPDOWN HTML (shared)
// ═══════════════════════════════════════

function buildSubjectOptions(selected) {
    const subjects = [
        { value: 'math', label: 'Math' },
        { value: 'reading', label: 'Reading' },
        { value: 'science', label: 'Science' },
        { value: 'social_studies', label: 'Social Studies' },
        { value: 'writing', label: 'Writing' },
        { value: 'spelling', label: 'Spelling' },
        { value: 'typing', label: 'Typing' },
        { value: 'other', label: 'Other' },
    ];
    return subjects.map(s =>
        `<option value="${s.value}" ${selected === s.value ? 'selected' : ''}>${s.label}</option>`
    ).join('');
}

// ═══════════════════════════════════════
// A1: AI GENERATE
// ═══════════════════════════════════════

function buildAIGenerateForm() {
    return `
        <form id="aiGenerateForm" onsubmit="handleAIGenerate(event)" style="display:flex;flex-direction:column;gap:14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                                  margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                                  font-family:var(--deft-heading-font),sans-serif;">Subject</label>
                    <select class="form-input" name="subject" required aria-label="Subject">
                        <option value="">Select subject...</option>
                        ${buildSubjectOptions('')}
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                                  margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                                  font-family:var(--deft-heading-font),sans-serif;">Topic</label>
                    <input type="text" class="form-input" name="topic" required
                           placeholder="e.g. Fractions, Photosynthesis..."
                           aria-label="Topic">
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                                  margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                                  font-family:var(--deft-heading-font),sans-serif;">Questions</label>
                    <input type="number" class="form-input" name="question_count" value="8" min="1" max="30"
                           aria-label="Number of questions">
                </div>
                <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                                  margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                                  font-family:var(--deft-heading-font),sans-serif;">Difficulty</label>
                    <select class="form-input" name="difficulty" aria-label="Difficulty level">
                        <option value="easy">Easy</option>
                        <option value="medium" selected>Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>
            </div>
            <div>
                <label style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                              margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                              font-family:var(--deft-heading-font),sans-serif;">Notes (optional)</label>
                <textarea class="form-input" name="notes" rows="2"
                          placeholder="Any special instructions for the AI..."
                          aria-label="Additional notes"></textarea>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                <button type="submit" class="btn btn-primary" id="aiGenerateBtn">
                    <span style="display:flex;align-items:center;gap:6px;">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M2.8 11.2l1.4-1.4M9.8 4.2l1.4-1.4"
                                  stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                        </svg>
                        Generate Lesson
                    </span>
                </button>
            </div>
        </form>
        <div id="aiGenerateResult"></div>
    `;
}

async function handleAIGenerate(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('aiGenerateBtn');

    const subject = form.subject.value;
    const topic = form.topic.value.trim();
    const question_count = parseInt(form.question_count.value) || 8;
    const difficulty = form.difficulty.value;
    const notes = form.notes.value.trim();

    if (!subject || !topic) {
        toast('Subject and topic are required', 'error');
        return;
    }

    // Show spinner
    btn.disabled = true;
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px;">
        ${buildSpinner(14)} Generating...
    </span>`;

    const resultEl = document.getElementById('aiGenerateResult');
    resultEl.innerHTML = buildGeneratingIndicator();

    const result = await schoolApi('generate_lesson', {
        subject,
        topic,
        grade_level: '4th',
        question_count,
        difficulty,
        notes
    }, { timeout: 60000 });

    btn.disabled = false;
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M2.8 11.2l1.4-1.4M9.8 4.2l1.4-1.4"
                  stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        Generate Lesson
    </span>`;

    if (!result) {
        resultEl.innerHTML = `<div style="padding:16px;color:var(--deft-danger);font-size:13px;">
            Failed to generate lesson. Try again or check the topic.
        </div>`;
        return;
    }

    // Store for approval
    generatedLesson = result.data || result;
    resultEl.innerHTML = buildGeneratedReview(generatedLesson, { subject, topic, difficulty });
}

function buildGeneratingIndicator() {
    return `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    padding:40px 20px;gap:12px;">
            ${buildSpinner(28)}
            <span style="font-size:14px;color:var(--deft-txt-2);font-family:var(--deft-body-font),sans-serif;">
                AI is generating your lesson...
            </span>
            <span style="font-size:12px;color:var(--deft-txt-3);">This may take 10-20 seconds</span>
        </div>
    `;
}

function buildGeneratedReview(lesson, meta) {
    const title = lesson.title || `${meta.topic} (${meta.subject})`;
    const description = lesson.description || '';
    const questions = lesson.questions || [];

    return `
        <div style="margin-top:16px;border:1px solid var(--deft-border);border-radius:10px;
                    background:var(--deft-surface);overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid var(--deft-border);
                        display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:13px;font-weight:700;color:var(--deft-accent);
                             font-family:var(--deft-heading-font),sans-serif;text-transform:uppercase;
                             letter-spacing:0.04em;">
                    Generated Lesson Preview
                </span>
                <span style="font-size:11px;color:var(--deft-txt-3);">${questions.length} question${questions.length !== 1 ? 's' : ''}</span>
            </div>
            <div style="padding:16px;">
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--deft-txt-3);
                                  margin-bottom:4px;text-transform:uppercase;letter-spacing:0.04em;">Title</label>
                    <input type="text" class="form-input" id="genReviewTitle" value="${escapeHtml(title)}"
                           aria-label="Lesson title">
                </div>
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--deft-txt-3);
                                  margin-bottom:4px;text-transform:uppercase;letter-spacing:0.04em;">Description</label>
                    <textarea class="form-input" id="genReviewDesc" rows="2"
                              aria-label="Lesson description">${escapeHtml(description)}</textarea>
                </div>
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--deft-txt-3);
                                  margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">Questions</label>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        ${questions.map((q, i) => `
                            <div style="padding:10px 12px;border-radius:8px;background:var(--deft-surface-el);
                                        border:1px solid var(--deft-border);font-size:13px;">
                                <div style="display:flex;align-items:flex-start;gap:8px;">
                                    <span style="font-size:11px;font-weight:700;color:var(--deft-accent);
                                                 min-width:18px;font-family:'JetBrains Mono',monospace;">
                                        ${i + 1}.
                                    </span>
                                    <div style="flex:1;min-width:0;">
                                        <div style="color:var(--deft-txt);margin-bottom:4px;">
                                            ${escapeHtml(q.question_text || q.question || '')}
                                        </div>
                                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                            <span style="font-size:11px;padding:2px 8px;border-radius:5px;
                                                         background:var(--deft-success-dim);color:var(--deft-success);">
                                                ${escapeHtml(q.correct_answer || q.answer || '')}
                                            </span>
                                            <span style="font-size:10px;color:var(--deft-txt-3);
                                                         text-transform:uppercase;letter-spacing:0.04em;">
                                                ${escapeHtml(q.question_type || q.type || 'open')}
                                            </span>
                                            <span style="font-size:10px;color:var(--deft-txt-3);">
                                                ${q.points || 1} pt${(q.points || 1) !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;padding-top:8px;border-top:1px solid var(--deft-border);">
                    <button class="btn btn-primary" onclick="approveGeneratedLesson()"
                            id="approveGenBtn">
                        <span style="display:flex;align-items:center;gap:6px;">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                <path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Approve & Save
                        </span>
                    </button>
                    <button class="btn btn-ghost" onclick="document.getElementById('aiGenerateForm').dispatchEvent(new Event('submit'))">
                        <span style="display:flex;align-items:center;gap:6px;">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                <path d="M1.5 7a5.5 5.5 0 019.37-3.9M12.5 7a5.5 5.5 0 01-9.37 3.9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                                <path d="M11 1v3h-3M3 13v-3h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Regenerate
                        </span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function approveGeneratedLesson() {
    if (!generatedLesson) return;

    const btn = document.getElementById('approveGenBtn');
    btn.disabled = true;
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px;">${buildSpinner(14)} Saving...</span>`;

    // Use editable fields
    const title = document.getElementById('genReviewTitle')?.value || generatedLesson.title;
    const description = document.getElementById('genReviewDesc')?.value || generatedLesson.description;

    const payload = {
        title,
        subject: generatedLesson.subject,
        description,
        questions: generatedLesson.questions || [],
        source_type: 'ai_generated'
    };

    const result = await schoolApi('create_lesson', payload);

    if (result) {
        toast('Lesson saved successfully');
        generatedLesson = null;
        document.getElementById('aiGenerateResult').innerHTML = '';
        document.getElementById('aiGenerateForm').reset();
        await loadTeacherLessons();
    } else {
        btn.disabled = false;
        btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px;">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Approve & Save
        </span>`;
    }
}

// ═══════════════════════════════════════
// A2: MANUAL CREATE
// ═══════════════════════════════════════

function buildManualCreateForm() {
    return `
        <form id="manualCreateForm" onsubmit="handleManualCreate(event)" style="display:flex;flex-direction:column;gap:14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                                  margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                                  font-family:var(--deft-heading-font),sans-serif;">Title</label>
                    <input type="text" class="form-input" name="title" required
                           placeholder="Lesson title..."
                           aria-label="Lesson title">
                </div>
                <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                                  margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                                  font-family:var(--deft-heading-font),sans-serif;">Subject</label>
                    <select class="form-input" name="subject" required aria-label="Subject">
                        <option value="">Select subject...</option>
                        ${buildSubjectOptions('')}
                    </select>
                </div>
            </div>
            <div>
                <label style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                              margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                              font-family:var(--deft-heading-font),sans-serif;">Description</label>
                <textarea class="form-input" name="description" rows="2"
                          placeholder="Brief description of this lesson..."
                          aria-label="Lesson description"></textarea>
            </div>

            <!-- Dynamic question list -->
            <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <label style="font-size:12px;font-weight:600;color:var(--deft-txt-2);
                                  text-transform:uppercase;letter-spacing:0.04em;
                                  font-family:var(--deft-heading-font),sans-serif;">
                        Questions
                        <span id="manualQuestionCount" style="color:var(--deft-txt-3);font-weight:400;">(0)</span>
                    </label>
                    <button type="button" class="btn btn-ghost" onclick="addManualQuestion()"
                            style="padding:5px 12px;font-size:11px;">
                        <span style="display:flex;align-items:center;gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            Add Question
                        </span>
                    </button>
                </div>
                <div id="manualQuestionsList" style="display:flex;flex-direction:column;gap:10px;"></div>
            </div>

            <div>
                <button type="submit" class="btn btn-primary" id="manualSaveBtn">
                    <span style="display:flex;align-items:center;gap:6px;">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path d="M11 1H3a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V4L9 1z"
                                  stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M9 1v3H6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Save Lesson
                    </span>
                </button>
            </div>
        </form>
    `;
}

function addManualQuestion() {
    const idx = manualQuestions.length;
    manualQuestions.push({
        question_text: '',
        question_type: 'open',
        correct_answer: '',
        points: 1
    });
    renderManualQuestions();
}

function removeManualQuestion(idx) {
    manualQuestions.splice(idx, 1);
    renderManualQuestions();
}

function updateManualQuestion(idx, field, value) {
    if (manualQuestions[idx]) {
        manualQuestions[idx][field] = field === 'points' ? (parseInt(value) || 1) : value;
    }
}

function renderManualQuestions() {
    const list = document.getElementById('manualQuestionsList');
    const countEl = document.getElementById('manualQuestionCount');
    if (!list) return;
    if (countEl) countEl.textContent = `(${manualQuestions.length})`;

    if (manualQuestions.length === 0) {
        list.innerHTML = `
            <div style="padding:24px;text-align:center;color:var(--deft-txt-3);
                        font-size:13px;border:1px dashed var(--deft-border);border-radius:8px;">
                No questions yet. Click "Add Question" above.
            </div>
        `;
        return;
    }

    list.innerHTML = manualQuestions.map((q, i) => `
        <div style="padding:12px;border:1px solid var(--deft-border);border-radius:10px;
                    background:var(--deft-surface-el);position:relative;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <span style="font-size:12px;font-weight:700;color:var(--deft-accent);
                             font-family:'JetBrains Mono',monospace;">Q${i + 1}</span>
                <button type="button" onclick="removeManualQuestion(${i})"
                        style="background:none;border:none;cursor:pointer;padding:2px;color:var(--deft-danger);
                               opacity:0.6;transition:opacity 0.15s;"
                        onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.6'"
                        aria-label="Remove question ${i + 1}">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div style="margin-bottom:8px;">
                <textarea class="form-input" rows="2"
                          placeholder="Question text..."
                          oninput="updateManualQuestion(${i},'question_text',this.value)"
                          aria-label="Question ${i + 1} text"
                          style="font-size:13px;">${escapeHtml(q.question_text)}</textarea>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 80px;gap:8px;">
                <div>
                    <select class="form-input" style="font-size:12px;padding:6px 8px;"
                            onchange="updateManualQuestion(${i},'question_type',this.value)"
                            aria-label="Question ${i + 1} type">
                        <option value="open" ${q.question_type === 'open' ? 'selected' : ''}>Open</option>
                        <option value="multiple_choice" ${q.question_type === 'multiple_choice' ? 'selected' : ''}>Multiple Choice</option>
                        <option value="true_false" ${q.question_type === 'true_false' ? 'selected' : ''}>True/False</option>
                        <option value="fill_blank" ${q.question_type === 'fill_blank' ? 'selected' : ''}>Fill in Blank</option>
                    </select>
                </div>
                <div>
                    <input type="text" class="form-input" style="font-size:12px;padding:6px 8px;"
                           placeholder="Correct answer"
                           value="${escapeHtml(q.correct_answer)}"
                           oninput="updateManualQuestion(${i},'correct_answer',this.value)"
                           aria-label="Question ${i + 1} correct answer">
                </div>
                <div>
                    <input type="number" class="form-input" style="font-size:12px;padding:6px 8px;text-align:center;"
                           value="${q.points}" min="1" max="10"
                           oninput="updateManualQuestion(${i},'points',this.value)"
                           aria-label="Question ${i + 1} points">
                </div>
            </div>
        </div>
    `).join('');
}

async function handleManualCreate(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('manualSaveBtn');

    const title = form.title.value.trim();
    const subject = form.subject.value;
    const description = form.description.value.trim();

    if (!title || !subject) {
        toast('Title and subject are required', 'error');
        return;
    }

    if (manualQuestions.length === 0) {
        toast('Add at least one question', 'error');
        return;
    }

    // Validate questions
    for (let i = 0; i < manualQuestions.length; i++) {
        if (!manualQuestions[i].question_text.trim()) {
            toast(`Question ${i + 1} is empty`, 'error');
            return;
        }
    }

    btn.disabled = true;
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px;">${buildSpinner(14)} Saving...</span>`;

    const result = await schoolApi('create_lesson', {
        title,
        subject,
        description,
        questions: manualQuestions.map((q, i) => ({
            question_number: i + 1,
            question_text: q.question_text.trim(),
            question_type: q.question_type,
            correct_answer: q.correct_answer.trim(),
            points: q.points
        })),
        source_type: 'manual'
    });

    btn.disabled = false;
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 1H3a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V4L9 1z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 1v3H6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Save Lesson
    </span>`;

    if (result) {
        toast('Lesson created successfully');
        form.reset();
        manualQuestions = [];
        renderManualQuestions();
        await loadTeacherLessons();
    }
}

// ═══════════════════════════════════════
// A3: SHEET SYNC
// ═══════════════════════════════════════

function buildSheetSyncPanel() {
    const savedUrl = (typeof localStorage !== 'undefined' && localStorage.getItem('schoolSyncSheetUrl')) || '';
    return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px 0;">
            <div style="width:56px;height:56px;border-radius:14px;
                        background:var(--deft-success-dim);
                        display:flex;align-items:center;justify-content:center;">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                    <rect x="3" y="4" width="22" height="20" rx="2" stroke="var(--deft-success)" stroke-width="1.5"/>
                    <path d="M3 10h22M10 10v14" stroke="var(--deft-success)" stroke-width="1.5"/>
                </svg>
            </div>
            <div style="text-align:center;">
                <p style="margin:0;font-size:14px;color:var(--deft-txt);font-weight:600;
                          font-family:var(--deft-heading-font),sans-serif;">
                    Sync from Google Sheet
                </p>
                <p style="margin:6px 0 0;font-size:12px;color:var(--deft-txt-3);max-width:420px;">
                    Open your lesson library tab in Google Sheets and copy the URL from the browser address bar
                    (it should include <code style="background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:3px;">#gid=NUMBER</code>).
                    Lessons that already have a Score will be skipped automatically.
                </p>
            </div>
            <div style="width:100%;max-width:480px;">
                <label for="sheetSyncUrl" style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                              margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                              font-family:var(--deft-heading-font),sans-serif;">Google Sheet URL</label>
                <input type="text" id="sheetSyncUrl" class="form-input"
                       placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..."
                       value="${savedUrl}"
                       autocomplete="off"
                       aria-label="Google Sheet URL">
            </div>
            <button class="btn btn-primary" onclick="handleSheetSync(this)" id="sheetSyncBtn">
                <span style="display:flex;align-items:center;gap:6px;">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M1.5 7a5.5 5.5 0 019.37-3.9M12.5 7a5.5 5.5 0 01-9.37 3.9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                        <path d="M11 1v3h-3M3 13v-3h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Sync from Google Sheet
                </span>
            </button>
            <div id="sheetSyncResult"></div>
        </div>
    `;
}

async function handleSheetSync(btn) {
    const urlInput = document.getElementById('sheetSyncUrl');
    const url = (urlInput?.value || '').trim();
    const resultEl = document.getElementById('sheetSyncResult');
    resultEl.innerHTML = '';

    const renderError = (msg) => {
        resultEl.innerHTML = `
            <div style="padding:12px 16px;border-radius:8px;background:var(--deft-danger-dim);
                        border:1px solid rgba(232,93,93,0.3);font-size:13px;color:var(--deft-danger);
                        max-width:480px;line-height:1.5;">
                ${msg}
            </div>
        `;
    };

    if (!url || !/\/spreadsheets\/d\/[a-zA-Z0-9_-]+/.test(url)) {
        renderError('Please paste a valid Google Sheet URL (https://docs.google.com/spreadsheets/d/...).');
        return;
    }
    if (!activeProfileId) {
        renderError('Please select a profile first.');
        return;
    }

    try { localStorage.setItem('schoolSyncSheetUrl', url); } catch (e) { /* ignore */ }

    btn.disabled = true;
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px;">${buildSpinner(14)} Syncing...</span>`;

    // Call the webhook directly so we can surface backend error messages in the
    // result panel (schoolApi swallows {success:false} responses into a 4s toast).
    let result = null;
    try {
        const res = await fetch(SCHOOL_BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operation: 'sync_from_sheet', user_id: activeProfileId, data: { sheet_url: url } })
        });
        const text = await res.text();
        try { result = JSON.parse(text); } catch (e) { result = { success: false, error: 'Server returned an invalid response.' }; }
    } catch (e) {
        result = { success: false, error: 'Connection error: ' + (e.message || e) };
    }

    btn.disabled = false;
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 7a5.5 5.5 0 019.37-3.9M12.5 7a5.5 5.5 0 01-9.37 3.9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M11 1v3h-3M3 13v-3h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Sync from Google Sheet
    </span>`;

    if (result && result.success) {
        const synced = result.synced_count ?? 0;
        const skipped = result.skipped_count ?? 0;
        const total = result.total_data_rows ?? (synced + skipped);
        const skippedSuffix = skipped ? ` (${skipped} skipped — already scored)` : '';
        resultEl.innerHTML = `
            <div style="padding:12px 16px;border-radius:8px;background:var(--deft-success-dim);
                        border:1px solid rgba(107,203,119,0.3);
                        display:flex;align-items:center;gap:8px;">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;">
                    <path d="M4 8l3 3 5-5" stroke="var(--deft-success)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span style="font-size:13px;color:var(--deft-success);font-weight:600;">
                    Synced ${synced} lesson${synced !== 1 ? 's' : ''}${skippedSuffix} — total ${total} rows in sheet
                </span>
            </div>
        `;
        await loadTeacherLessons();
    } else {
        renderError((result && result.error) ? result.error : 'Sync failed. Please try again.');
    }
}

// ═══════════════════════════════════════
// A4: DRIVE IMPORT
// ═══════════════════════════════════════

function buildDriveImportPanel() {
    return `
        <div style="display:flex;flex-direction:column;gap:14px;padding-top:4px;">
            <div>
                <label style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                              margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                              font-family:var(--deft-heading-font),sans-serif;">Google Drive URL</label>
                <input type="url" class="form-input" id="driveUrlInput"
                       placeholder="https://docs.google.com/document/d/..."
                       aria-label="Google Drive document URL">
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                <button class="btn btn-primary" onclick="handleDriveImport()" id="driveImportBtn">
                    <span style="display:flex;align-items:center;gap:6px;">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M2 10v2h10v-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Import
                    </span>
                </button>
            </div>
            <div id="driveImportResult"></div>
        </div>
    `;
}

async function handleDriveImport() {
    const input = document.getElementById('driveUrlInput');
    const btn = document.getElementById('driveImportBtn');
    const resultEl = document.getElementById('driveImportResult');
    const drive_url = input?.value.trim();

    if (!drive_url) {
        toast('Enter a Google Drive URL', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px;">${buildSpinner(14)} Importing...</span>`;
    resultEl.innerHTML = buildGeneratingIndicator();

    const result = await schoolApi('import_from_drive', { drive_url }, { timeout: 60000 });

    btn.disabled = false;
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px;">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 10v2h10v-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Import
    </span>`;

    if (!result) {
        resultEl.innerHTML = `
            <div style="padding:12px 16px;border-radius:8px;background:var(--deft-danger-dim);
                        border:1px solid rgba(232,93,93,0.3);font-size:13px;color:var(--deft-danger);">
                Import failed. Check the URL and try again.
            </div>
        `;
        return;
    }

    // Show parsed result for review
    const imported = result.data || result;
    generatedLesson = imported;
    resultEl.innerHTML = buildGeneratedReview(imported, {
        subject: imported.subject || 'other',
        topic: imported.title || 'Imported',
        difficulty: 'medium'
    });
}

// ═══════════════════════════════════════
// B: LESSON LIBRARY
// ═══════════════════════════════════════

async function loadTeacherLessons() {
    const listEl = document.getElementById('lessonLibraryList');
    if (!listEl) return;

    // UBR-0142/0147: embed question + assignment counts so the Library card
    // can show real question totals AND mark lessons that have already been
    // assigned (so the teacher does not accidentally re-assign).
    const lessons = await supabaseSelect(
        'school_lessons',
        'select=lesson_id,title,subject,description,source_type,created_at,school_questions(count),school_assignments(count)&order=created_at.desc'
    );

    teacherLessons = (lessons || []).map(l => ({
        ...l,
        question_count: Array.isArray(l.school_questions) && l.school_questions[0] ? (l.school_questions[0].count || 0) : 0,
        assignment_count: Array.isArray(l.school_assignments) && l.school_assignments[0] ? (l.school_assignments[0].count || 0) : 0
    }));
    renderTeacherLessons();
}

function handleLessonLibrarySearch(query) {
    teacherLessonSearch = query.toLowerCase().trim();
    renderTeacherLessons();
}

function renderTeacherLessons() {
    const listEl = document.getElementById('lessonLibraryList');
    if (!listEl) return;

    let filtered = teacherLessons;
    if (teacherLessonSearch) {
        filtered = teacherLessons.filter(l =>
            (l.title || '').toLowerCase().includes(teacherLessonSearch) ||
            (l.subject || '').toLowerCase().includes(teacherLessonSearch) ||
            (l.description || '').toLowerCase().includes(teacherLessonSearch)
        );
    }

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div style="padding:32px;text-align:center;color:var(--deft-txt-3);font-size:13px;">
                ${teacherLessonSearch ? 'No lessons match your search.' : 'No lessons yet. Create one above.'}
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map(l => buildLibraryCard(l)).join('');
}

function buildLibraryCard(lesson) {
    const style = getSubjectStyle(lesson.subject || 'other');
    const sourceLabel = getSourceLabel(lesson.source_type);
    const qCount = lesson.question_count || 0;
    // UBR-0147: surface assignment status so a previously-assigned lesson is
    // visibly flagged before the teacher re-assigns it.
    const assignCount = lesson.assignment_count || 0;
    const isAssigned = assignCount > 0;
    const created = lesson.created_at ? new Date(lesson.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const assignedPill = isAssigned ? `
        <span style="font-size:10px;padding:2px 7px;border-radius:5px;
                     background:rgba(107,203,119,0.18);color:#3FB44A;font-weight:700;
                     text-transform:uppercase;letter-spacing:0.04em;"
              title="Assigned ${assignCount} time${assignCount !== 1 ? 's' : ''}">
            ✓ Assigned${assignCount > 1 ? ' ×' + assignCount : ''}
        </span>` : '';
    const assignBtnLabel = isAssigned ? 'Re-assign' : 'Assign';
    const assignBtnConfirm = isAssigned
        ? `if(!confirm('This lesson has already been assigned ${assignCount} time${assignCount !== 1 ? 's' : ''}. Re-assign anyway?'))return;`
        : '';

    return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;
                    border-bottom:1px solid var(--deft-border);
                    transition:background 0.12s;cursor:pointer;"
             onmouseenter="this.style.background='var(--deft-surface-el)'"
             onmouseleave="this.style.background='transparent'"
             onclick="toggleLibraryExpand(this, '${escapeHtml(lesson.lesson_id)}')"
             role="button" tabindex="0"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}">

            <!-- Subject icon -->
            <div style="width:34px;height:34px;border-radius:8px;flex-shrink:0;
                        display:flex;align-items:center;justify-content:center;
                        background:${style.bg};color:${style.text};font-size:15px;"
                 aria-hidden="true">
                ${getSubjectIcon(style.label)}
            </div>

            <!-- Info -->
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:flex-start;gap:6px;flex-wrap:wrap;">
                    <span style="font-size:13px;font-weight:600;color:var(--deft-txt);
                                 display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
                                 overflow:hidden;line-height:1.3;flex:1;min-width:160px;">
                        ${escapeHtml(lesson.title || 'Untitled')}
                    </span>
                    <span style="font-size:10px;padding:2px 7px;border-radius:5px;
                                 background:${style.bg};color:${style.text};font-weight:600;
                                 text-transform:uppercase;letter-spacing:0.03em;flex-shrink:0;">
                        ${escapeHtml(style.label)}
                    </span>
                    ${sourceLabel}
                    ${assignedPill}
                </div>
                <div style="display:flex;align-items:center;gap:10px;margin-top:3px;">
                    <span style="font-size:11px;color:var(--deft-txt-3);">
                        ${qCount} question${qCount !== 1 ? 's' : ''}
                    </span>
                    ${created ? `<span style="font-size:11px;color:var(--deft-txt-3);">${created}</span>` : ''}
                </div>
            </div>

            <!-- Assign / Re-assign button -->
            <button class="btn btn-ghost" onclick="event.stopPropagation();${assignBtnConfirm}openAssignModal('${escapeHtml(lesson.lesson_id)}','${escapeHtml((lesson.title || '').replace(/'/g, "\\'"))}')"
                    style="padding:5px 12px;font-size:11px;flex-shrink:0;${isAssigned ? 'border-color:rgba(107,203,119,0.4);color:#3FB44A;' : ''}">
                ${assignBtnLabel}
            </button>
        </div>

        <!-- Expandable detail (hidden by default) -->
        <div class="library-detail" data-lesson-id="${escapeHtml(lesson.lesson_id)}"
             style="display:none;padding:0 12px 12px 58px;background:var(--deft-surface-el);
                    border-bottom:1px solid var(--deft-border);">
            <div style="padding:10px 0;font-size:12px;color:var(--deft-txt-3);">Loading questions...</div>
        </div>
    `;
}

function getSourceLabel(sourceType) {
    const labels = {
        'ai_generated': { text: 'AI', bg: 'rgba(168,133,247,0.12)', color: '#C084FC' },
        'manual':       { text: 'Manual', bg: 'rgba(96,165,250,0.12)', color: '#60A5FA' },
        'google_sheet': { text: 'Sheet', bg: 'rgba(107,203,119,0.12)', color: '#6BCB77' },
        'drive_import': { text: 'Drive', bg: 'rgba(240,168,48,0.12)', color: '#FBBF24' },
    };
    const s = labels[sourceType] || labels['manual'];
    return `<span style="font-size:9px;padding:2px 6px;border-radius:4px;
                         background:${s.bg};color:${s.color};font-weight:600;
                         text-transform:uppercase;letter-spacing:0.04em;">${s.text}</span>`;
}

async function toggleLibraryExpand(cardEl, lessonId) {
    const detailEl = cardEl.nextElementSibling;
    if (!detailEl || !detailEl.classList.contains('library-detail')) return;

    const isOpen = detailEl.style.display !== 'none';
    if (isOpen) {
        detailEl.style.display = 'none';
        return;
    }

    detailEl.style.display = '';

    // Fetch questions for this lesson
    const questions = await supabaseSelect(
        'school_questions',
        `lesson_id=eq.${lessonId}&select=question_id,question_number,question_text,question_type,correct_answer,points&order=question_number`
    );

    if (!questions || questions.length === 0) {
        detailEl.innerHTML = `
            <div style="padding:10px 0;font-size:12px;color:var(--deft-txt-3);">No questions found for this lesson.</div>
        `;
        return;
    }

    detailEl.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;padding:8px 0;">
            ${questions.map(q => `
                <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 8px;
                            border-radius:6px;background:var(--deft-surface);
                            border:1px solid var(--deft-border);font-size:12px;">
                    <span style="font-weight:700;color:var(--deft-accent);min-width:18px;
                                 font-family:'JetBrains Mono',monospace;font-size:11px;">
                        ${q.question_number || '?'}.
                    </span>
                    <div style="flex:1;min-width:0;">
                        <div style="color:var(--deft-txt);">${escapeHtml(q.question_text || '')}</div>
                        <div style="display:flex;align-items:center;gap:8px;margin-top:3px;">
                            <span style="font-size:10px;color:var(--deft-success);padding:1px 6px;border-radius:4px;
                                         background:var(--deft-success-dim);">
                                ${escapeHtml(q.correct_answer || '')}
                            </span>
                            <span style="font-size:10px;color:var(--deft-txt-3);text-transform:uppercase;">
                                ${escapeHtml(q.question_type || 'open')}
                            </span>
                            <span style="font-size:10px;color:var(--deft-txt-3);">
                                ${q.points || 1} pt${(q.points || 1) !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ── Assign modal ──

function openAssignModal(lessonId, lessonTitle) {
    // Create a lightweight inline modal for date picking
    const existing = document.getElementById('assignModalOverlay');
    if (existing) existing.remove();

    const today = todayStr();

    const overlay = document.createElement('div');
    overlay.id = 'assignModalOverlay';
    overlay.className = 'modal-backdrop active';
    overlay.innerHTML = `
        <div class="modal-content" style="max-width:380px;padding:24px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <h3 style="margin:0;font-size:15px;font-weight:700;color:var(--deft-txt);
                           font-family:var(--deft-heading-font),sans-serif;">Assign Lesson</h3>
                <button onclick="document.getElementById('assignModalOverlay').remove()"
                        style="background:none;border:none;cursor:pointer;color:var(--deft-txt-3);padding:4px;"
                        aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <p style="margin:0 0 12px;font-size:13px;color:var(--deft-txt-2);">
                ${escapeHtml(lessonTitle)}
            </p>
            <div style="margin-bottom:12px;">
                <label style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                              margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                              font-family:var(--deft-heading-font),sans-serif;" for="assignStudentSelect">Student</label>
                <select class="form-input" id="assignStudentSelect" aria-label="Student">
                    <option value="">Loading students...</option>
                </select>
            </div>
            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;font-weight:600;color:var(--deft-txt-2);
                              margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;
                              font-family:var(--deft-heading-font),sans-serif;" for="assignDateInput">Assign Date</label>
                <input type="date" class="form-input" id="assignDateInput" value="${today}"
                       aria-label="Assignment date">
            </div>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-primary" id="confirmAssignBtn"
                        onclick="confirmAssign('${escapeHtml(lessonId)}')">
                    Assign
                </button>
                <button class="btn btn-ghost" onclick="document.getElementById('assignModalOverlay').remove()">
                    Cancel
                </button>
            </div>
        </div>
    `;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    populateAssignStudents();
}

// Load student profiles into the assign modal's student select.
// Falls back to all profiles if no rows have role='student' (some setups use admin only).
async function populateAssignStudents() {
    const sel = document.getElementById('assignStudentSelect');
    if (!sel) return;
    let profiles = await supabaseSelect('deft_user_profiles',
        'select=user_id,display_name,role&role=eq.student&order=display_name');
    if (!profiles || profiles.length === 0) {
        profiles = await supabaseSelect('deft_user_profiles',
            'select=user_id,display_name,role&order=display_name');
    }
    if (!profiles || profiles.length === 0) {
        sel.innerHTML = '<option value="">No profiles found</option>';
        return;
    }
    sel.innerHTML = profiles.map(p =>
        `<option value="${p.user_id}">${escapeHtml(p.display_name || 'Profile')}${p.role && p.role !== 'student' ? ' (' + p.role + ')' : ''}</option>`
    ).join('');
    // Auto-select if only one student
    if (profiles.length === 1) sel.value = profiles[0].user_id;
}

async function confirmAssign(lessonId) {
    const studentSelect = document.getElementById('assignStudentSelect');
    const dateInput = document.getElementById('assignDateInput');
    const btn = document.getElementById('confirmAssignBtn');
    const studentId = studentSelect?.value;
    const date = dateInput?.value;

    if (!studentId) {
        toast('Select a student', 'error');
        return;
    }
    if (!date) {
        toast('Select a date', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Assigning...';

    const result = await schoolApi('assign_lesson', {
        lesson_id: lessonId,
        student_id: studentId,
        assigned_date: date
    });

    if (result) {
        toast('Lesson assigned');
        document.getElementById('assignModalOverlay')?.remove();
    } else {
        btn.disabled = false;
        btn.textContent = 'Assign';
    }
}

// ═══════════════════════════════════════
// C: PENDING REVIEWS
// ═══════════════════════════════════════

async function loadPendingReviews() {
    const listEl = document.getElementById('pendingReviewsList');
    const countEl = document.getElementById('reviewCount');
    if (!listEl) return;

    // UBR-0148: pull lesson info via embedded resource so we can group reviews
    // under the lesson they belong to.
    const answers = await supabaseSelect(
        'school_answers',
        'check_status=eq.checked&order=checked_at.desc&limit=40&select=answer_id,question_id,student_id,answer_text,ai_score,ai_feedback,check_status,partial_credit,correct_answer_shown,school_questions(question_text,correct_answer,points,lesson_id,school_lessons(title,subject))'
    );

    pendingReviews = answers || [];

    if (countEl) {
        countEl.textContent = pendingReviews.length > 0 ? `${pendingReviews.length} to review` : '';
    }

    if (pendingReviews.length === 0) {
        listEl.innerHTML = `
            <div style="padding:32px;text-align:center;color:var(--deft-txt-3);font-size:13px;">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style="margin:0 auto 8px;display:block;opacity:0.5;">
                    <path d="M8 14l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="14" cy="14" r="11" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                All caught up! No answers pending review.
            </div>
        `;
        return;
    }

    // UBR-0148: group reviews by lesson, sorted by most-recent-pending-answer first.
    const groups = {};
    const order = [];
    pendingReviews.forEach(a => {
        const q = a.school_questions || {};
        const lessonId = q.lesson_id || 'unknown';
        if (!groups[lessonId]) {
            const lesson = q.school_lessons || {};
            groups[lessonId] = {
                lesson_id: lessonId,
                title: lesson.title || 'Unknown lesson',
                subject: lesson.subject || '',
                answers: []
            };
            order.push(lessonId);
        }
        groups[lessonId].answers.push(a);
    });

    listEl.innerHTML = order.map(id => {
        const g = groups[id];
        const subjectStyle = getSubjectStyle(g.subject || 'other');
        const headerHtml = `
            <div style="padding:10px 14px;background:var(--deft-surface-el);
                        border-top:1px solid var(--deft-border);
                        border-bottom:1px solid var(--deft-border);
                        display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:10px;font-weight:700;color:var(--deft-txt-3);
                             text-transform:uppercase;letter-spacing:0.06em;">Lesson</span>
                <span style="font-size:13px;font-weight:600;color:var(--deft-txt);">${escapeHtml(g.title)}</span>
                <span style="font-size:10px;padding:2px 7px;border-radius:5px;
                             background:${subjectStyle.bg};color:${subjectStyle.text};font-weight:600;
                             text-transform:uppercase;letter-spacing:0.03em;">
                    ${escapeHtml(subjectStyle.label)}
                </span>
                <span style="font-size:11px;color:var(--deft-txt-3);margin-left:auto;">
                    ${g.answers.length} answer${g.answers.length !== 1 ? 's' : ''} pending
                </span>
            </div>`;
        return headerHtml + g.answers.map(a => buildReviewCard(a)).join('');
    }).join('');
}

function buildReviewCard(answer) {
    const q = answer.school_questions || {};
    // UBR-0143: ai_score is a 0-100 percentage from the LLM. The teacher
    // dashboard wants to show "earned points / max points" — convert before
    // displaying. q.points migrated to 10 by the canonical migration.
    const maxPoints = q.points && Number(q.points) > 0 ? Number(q.points) : 10;
    const aiScorePct = answer.ai_score != null ? Number(answer.ai_score) : null;
    const earnedPoints = aiScorePct != null
        ? Math.round((aiScorePct / 100) * maxPoints * 10) / 10
        : null;
    // Use the canonical state colors so reviews match the student-facing UI.
    const partial = answer.partial_credit === true;
    const gradeState = aiScorePct == null
        ? null
        : (aiScorePct >= 90 ? 'correct' : (aiScorePct >= 70 ? 'partial' : 'incorrect'));
    const gradeColor = gradeState === 'correct' ? 'var(--deft-success)'
        : (gradeState === 'partial' ? 'var(--deft-warning, #f59e0b)' : 'var(--deft-danger)');
    const stateLabel = gradeState === 'correct' ? 'Correct'
        : (gradeState === 'partial' ? 'Mostly Correct' : (gradeState === 'incorrect' ? 'Incorrect' : ''));

    return `
        <div style="padding:14px;border-bottom:1px solid var(--deft-border);" data-answer-id="${escapeHtml(answer.answer_id)}">
            <!-- Question -->
            <div style="margin-bottom:8px;">
                <span style="font-size:11px;font-weight:600;color:var(--deft-txt-3);text-transform:uppercase;
                             letter-spacing:0.04em;font-family:var(--deft-heading-font),sans-serif;">Question</span>
                <p style="margin:4px 0 0;font-size:13px;color:var(--deft-txt);line-height:1.5;">
                    ${escapeHtml(q.question_text || 'Unknown question')}
                </p>
            </div>

            <!-- Student answer -->
            <div style="margin-bottom:8px;padding:10px 12px;border-radius:8px;
                        background:var(--deft-surface-el);border:1px solid var(--deft-border);">
                <span style="font-size:10px;font-weight:600;color:var(--deft-txt-3);text-transform:uppercase;
                             letter-spacing:0.04em;">Student Answer</span>
                <p style="margin:4px 0 0;font-size:13px;color:var(--deft-txt);line-height:1.4;white-space:pre-line;">
                    ${escapeHtml(answer.answer_text || '(no answer)')}
                </p>
            </div>

            <!-- AI assessment -->
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
                ${earnedPoints != null ? `
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:11px;color:var(--deft-txt-3);">AI Score:</span>
                        <span style="font-size:14px;font-weight:700;color:${gradeColor};">
                            ${earnedPoints}/${maxPoints}
                        </span>
                        ${stateLabel ? `<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${gradeColor};">${stateLabel}</span>` : ''}
                    </div>
                ` : ''}
                ${answer.ai_feedback ? `
                    <div style="flex:1;min-width:200px;">
                        <span style="font-size:11px;color:var(--deft-txt-3);">AI Feedback:</span>
                        <p style="margin:2px 0 0;font-size:12px;color:var(--deft-txt-2);line-height:1.4;font-style:italic;">
                            ${escapeHtml(answer.ai_feedback)}
                        </p>
                    </div>
                ` : ''}
            </div>

            <!-- Correct answer reference -->
            ${q.correct_answer ? `
                <div style="margin-bottom:10px;font-size:11px;">
                    <span style="color:var(--deft-txt-3);">Expected: </span>
                    <span style="color:var(--deft-success);font-weight:600;">${escapeHtml(q.correct_answer)}</span>
                </div>
            ` : ''}

            <!-- Teacher override controls (entered as points out of maxPoints) -->
            <div style="display:flex;align-items:center;gap:8px;padding-top:8px;border-top:1px solid var(--deft-border);">
                <label style="font-size:11px;color:var(--deft-txt-2);font-weight:600;white-space:nowrap;">Override Score:</label>
                <input type="number" class="form-input" min="0" max="${maxPoints}" step="0.5"
                       value="${earnedPoints != null ? earnedPoints : ''}"
                       id="override-${escapeHtml(answer.answer_id)}"
                       data-max-points="${maxPoints}"
                       style="width:70px;font-size:12px;padding:5px 8px;text-align:center;"
                       aria-label="Override score for this answer">
                <span style="font-size:11px;color:var(--deft-txt-3);">/ ${maxPoints}</span>
                <button class="btn btn-primary" onclick="confirmReview('${escapeHtml(answer.answer_id)}')"
                        style="padding:5px 12px;font-size:11px;margin-left:auto;">
                    Confirm
                </button>
                <button class="btn btn-ghost" onclick="confirmReview('${escapeHtml(answer.answer_id)}', true)"
                        style="padding:5px 12px;font-size:11px;">
                    Accept AI
                </button>
            </div>
        </div>
    `;
}

async function confirmReview(answerId, acceptAI) {
    const overrideInput = document.getElementById(`override-${answerId}`);
    // UBR-0143: input is in points (0-maxPoints); convert back to percentage
    // for ai_score / override_score storage.
    let scorePct;

    if (acceptAI) {
        const answer = pendingReviews.find(a => a.answer_id === answerId);
        scorePct = answer?.ai_score;
    } else {
        const points = parseFloat(overrideInput?.value);
        const maxPoints = parseFloat(overrideInput?.dataset?.maxPoints) || 10;
        if (!isNaN(points) && maxPoints > 0) {
            scorePct = Math.max(0, Math.min(100, Math.round((points / maxPoints) * 100)));
        }
    }

    if (scorePct == null || isNaN(scorePct)) {
        toast('Enter a valid score', 'error');
        return;
    }

    // Use the canonical override_score backend route so school_grades + the
    // assignment status PATCH all recalculate consistently.
    const result = acceptAI
        ? await supabaseWrite('school_answers', 'PATCH', {
            check_status: 'verified',
            checked_at: new Date().toISOString()
        }, `answer_id=eq.${answerId}`)
        : await schoolApi('override_score', { answer_id: answerId, score: scorePct, reason: 'Teacher review' });

    if (result) {
        toast('Review saved');
        // Remove from list with animation
        const card = document.querySelector(`[data-answer-id="${answerId}"]`);
        if (card) {
            card.style.transition = 'opacity 0.3s, max-height 0.3s';
            card.style.opacity = '0';
            card.style.maxHeight = '0';
            card.style.overflow = 'hidden';
            card.style.padding = '0';
            setTimeout(() => card.remove(), 300);
        }
        // Update count
        pendingReviews = pendingReviews.filter(a => a.answer_id !== answerId);
        const countEl = document.getElementById('reviewCount');
        if (countEl) {
            countEl.textContent = pendingReviews.length > 0 ? `${pendingReviews.length} to review` : '';
        }
        // Refresh grades if the view is visible
        if (typeof refreshGrades === 'function') refreshGrades();
    }
}

// ═══════════════════════════════════════
// D: EXCUSE MANAGER
// ═══════════════════════════════════════

async function loadExcuseManager() {
    const listEl = document.getElementById('excuseManagerList');
    if (!listEl) return;

    // Fetch this week's assignments
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    const assignments = await supabaseSelect(
        'school_assignments',
        `assigned_date=gte.${mondayStr}&assigned_date=lte.${sundayStr}&status=neq.excused&select=assignment_id,lesson_id,student_id,status,assigned_date,school_lessons(title,subject)&order=assigned_date.desc`
    );

    if (!assignments || assignments.length === 0) {
        listEl.innerHTML = `
            <div style="padding:24px;text-align:center;color:var(--deft-txt-3);font-size:13px;">
                No active assignments this week.
            </div>
        `;
        return;
    }

    listEl.innerHTML = `
        <div style="margin-bottom:10px;font-size:12px;color:var(--deft-txt-3);
                    font-family:var(--deft-heading-font),sans-serif;">
            This week: ${formatDate(mondayStr)} - ${formatDate(sundayStr)}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
            ${assignments.map(a => buildExcuseRow(a)).join('')}
        </div>
    `;
}

function buildExcuseRow(assignment) {
    const lesson = assignment.school_lessons || {};
    const style = getSubjectStyle(lesson.subject || 'other');
    const statusColor = assignment.status === 'completed' ? 'var(--deft-success)' : 'var(--deft-txt-3)';
    const dateLabel = assignment.assigned_date ? formatDate(assignment.assigned_date) : '';

    return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;
                    background:var(--deft-surface-el);border:1px solid var(--deft-border);"
             data-excuse-id="${escapeHtml(assignment.id)}">
            <div style="width:8px;height:8px;border-radius:50%;background:${statusColor};flex-shrink:0;"
                 aria-hidden="true"></div>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:13px;font-weight:600;color:var(--deft-txt);
                                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">
                        ${escapeHtml(lesson.title || 'Untitled')}
                    </span>
                    <span style="font-size:9px;padding:2px 6px;border-radius:4px;
                                 background:${style.bg};color:${style.text};font-weight:600;
                                 text-transform:uppercase;letter-spacing:0.03em;">
                        ${escapeHtml(style.label)}
                    </span>
                </div>
                <span style="font-size:11px;color:var(--deft-txt-3);">${dateLabel}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;" id="excuse-controls-${escapeHtml(assignment.id)}">
                <button class="btn btn-warm" onclick="showExcuseInput('${escapeHtml(assignment.id)}')"
                        style="padding:5px 12px;font-size:11px;">
                    Excuse
                </button>
            </div>
        </div>
    `;
}

function showExcuseInput(assignmentId) {
    const controlsEl = document.getElementById(`excuse-controls-${assignmentId}`);
    if (!controlsEl) return;

    controlsEl.innerHTML = `
        <input type="text" class="form-input" id="excuse-reason-${assignmentId}"
               placeholder="Reason..."
               style="width:140px;font-size:11px;padding:5px 8px;"
               aria-label="Excuse reason"
               onkeydown="if(event.key==='Enter'){event.preventDefault();submitExcuse('${assignmentId}');}">
        <button class="btn btn-warm" onclick="submitExcuse('${assignmentId}')"
                style="padding:5px 10px;font-size:11px;" id="excuse-submit-${assignmentId}">
            OK
        </button>
        <button class="btn btn-ghost" onclick="cancelExcuseInput('${assignmentId}')"
                style="padding:5px 8px;font-size:11px;">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
        </button>
    `;

    document.getElementById(`excuse-reason-${assignmentId}`)?.focus();
}

function cancelExcuseInput(assignmentId) {
    const controlsEl = document.getElementById(`excuse-controls-${assignmentId}`);
    if (!controlsEl) return;
    controlsEl.innerHTML = `
        <button class="btn btn-warm" onclick="showExcuseInput('${assignmentId}')"
                style="padding:5px 12px;font-size:11px;">
            Excuse
        </button>
    `;
}

async function submitExcuse(assignmentId) {
    const reasonInput = document.getElementById(`excuse-reason-${assignmentId}`);
    const btn = document.getElementById(`excuse-submit-${assignmentId}`);
    const reason = reasonInput?.value.trim() || 'Excused by teacher';

    if (btn) {
        btn.disabled = true;
        btn.textContent = '...';
    }

    const result = await schoolApi('excuse_assignment', {
        assignment_id: assignmentId,
        reason
    });

    if (result) {
        toast('Assignment excused');
        // Remove the row with animation
        const row = document.querySelector(`[data-excuse-id="${assignmentId}"]`);
        if (row) {
            row.style.transition = 'opacity 0.3s, max-height 0.3s';
            row.style.opacity = '0';
            setTimeout(() => row.remove(), 300);
        }
    } else {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'OK';
        }
    }
}

// ═══════════════════════════════════════
// SHARED UI HELPERS
// ═══════════════════════════════════════

function buildSpinner(size) {
    return `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
             style="animation:teacher-spin 1s linear infinite;" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5"
                    stroke-dasharray="31.4 31.4" stroke-linecap="round" opacity="0.3"/>
            <path d="M12 2a10 10 0 019.8 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
    `;
}

// Inject spinner keyframes
(function injectTeacherAnimations() {
    if (document.getElementById('teacher-tab-styles')) return;
    const style = document.createElement('style');
    style.id = 'teacher-tab-styles';
    style.textContent = `
        @keyframes teacher-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
})();
