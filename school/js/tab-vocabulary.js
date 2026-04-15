// =====================================================================
// Tab: Vocabulary
// Weekly word lists, example stories, and fill-in-the-blank quizzes
// Semester: May 4 - July 11, 2026 (10 weeks)
// =====================================================================

// ─── Vocabulary State ────────────────────────────────────────────────
const VOCAB_SEMESTER_START = '2026-05-04';
const VOCAB_SEMESTER_END   = '2026-07-11';
const VOCAB_TOTAL_WEEKS    = 10;
const VOCAB_SEMESTER_ID    = 'summer-2026';

let vocabState = {
    currentWeekNumber: 1,
    selectedWeekNumber: 1,
    weekData: null,
    quizAttempts: [],
    activeQuiz: null,
    subView: 'words',       // 'words' | 'story' | 'quiz'
    quizAnswers: [],
    quizQuestions: [],
    activeTooltip: null
};

// ─── Semester Week Calculation ───────────────────────────────────────
function vocabGetCurrentWeek() {
    const today = new Date(todayStr() + 'T00:00:00');
    const start = new Date(VOCAB_SEMESTER_START + 'T00:00:00');
    const end   = new Date(VOCAB_SEMESTER_END + 'T00:00:00');

    if (today < start) return 1;
    if (today > end) return VOCAB_TOTAL_WEEKS;

    const diffMs = today - start;
    const diffDays = Math.floor(diffMs / 86400000);
    const week = Math.floor(diffDays / 7) + 1;
    return Math.min(week, VOCAB_TOTAL_WEEKS);
}

function vocabGetWeekDates(weekNum) {
    const start = new Date(VOCAB_SEMESTER_START + 'T00:00:00');
    start.setDate(start.getDate() + (weekNum - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

// ─── Main Entry Point ────────────────────────────────────────────────
async function refreshVocabulary() {
    const container = document.getElementById('vocabulary-container');
    if (!container) return;

    vocabState.currentWeekNumber = vocabGetCurrentWeek();
    if (!vocabState.selectedWeekNumber) {
        vocabState.selectedWeekNumber = vocabState.currentWeekNumber;
    }

    injectVocabStyles();
    container.innerHTML = buildVocabSkeleton();

    try {
        await vocabLoadWeekData(vocabState.selectedWeekNumber);
        vocabRender(container);
    } catch (err) {
        console.error('refreshVocabulary error:', err);
        container.innerHTML = vocabEmptyState('Something went wrong loading vocabulary data.', 'error');
    }
}

// ─── Data Fetching ───────────────────────────────────────────────────
async function vocabLoadWeekData(weekNum) {
    const [weekRows, quizRows] = await Promise.all([
        supabaseSelect(
            'school_vocab_weeks',
            `semester_id=eq.${VOCAB_SEMESTER_ID}&week_number=eq.${weekNum}&select=*`
        ),
        activeProfileId
            ? supabaseSelect(
                'school_vocab_quizzes',
                `student_id=eq.${activeProfileId}&select=*&order=created_at.desc`
            )
            : Promise.resolve(null)
    ]);

    vocabState.weekData = (weekRows && weekRows.length > 0) ? weekRows[0] : null;

    // Filter quiz attempts for this week
    if (quizRows && vocabState.weekData) {
        vocabState.quizAttempts = quizRows.filter(
            q => q.week_id === vocabState.weekData.week_id
        );
    } else {
        vocabState.quizAttempts = [];
    }
}

// ─── Main Render ─────────────────────────────────────────────────────
function vocabRender(container) {
    if (!container) container = document.getElementById('vocabulary-container');
    if (!container) return;

    let html = '<div class="vc-wrapper">';

    // Header: week progress + navigation
    html += vocabBuildHeader();

    // Sub-view tabs
    html += vocabBuildSubTabs();

    // Content area
    html += '<div class="vc-content" id="vc-content">';
    if (vocabState.subView === 'words') {
        html += vocabBuildWordList();
    } else if (vocabState.subView === 'story') {
        html += vocabBuildStory();
    } else if (vocabState.subView === 'quiz') {
        html += vocabBuildQuiz();
    }
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    // Post-render: bind tooltip events for story view
    if (vocabState.subView === 'story') {
        vocabBindStoryTooltips();
    }
}

// ─── Header with Week Navigation ─────────────────────────────────────
function vocabBuildHeader() {
    const w = vocabState.selectedWeekNumber;
    const current = vocabState.currentWeekNumber;
    const weekData = vocabState.weekData;
    const theme = weekData ? escapeHtml(weekData.theme || '') : '';
    const dates = vocabGetWeekDates(w);
    const isCurrent = w === current;

    // Week selector dropdown options
    let weekOptions = '';
    for (let i = 1; i <= VOCAB_TOTAL_WEEKS; i++) {
        const d = vocabGetWeekDates(i);
        const label = `Week ${i}${i === current ? ' (Current)' : ''}`;
        weekOptions += `<option value="${i}" ${i === w ? 'selected' : ''}>${label}</option>`;
    }

    const generateBtn = isTeacher()
        ? `<button class="vc-btn vc-btn-secondary" onclick="vocabGenerateAll()" data-role-min="admin"
                style="font-size:12px;padding:6px 14px;">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M11.2 2.8l-1.4 1.4M4.2 9.8l-1.4 1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                Generate All Weeks
            </button>`
        : '';

    return `
        <div class="vc-header">
            <div class="vc-header-top">
                <div class="vc-header-left">
                    <h2 class="vc-title">Vocabulary</h2>
                    <div class="vc-week-indicator">
                        <span class="vc-week-badge ${isCurrent ? 'vc-week-current' : ''}">
                            Week ${w} of ${VOCAB_TOTAL_WEEKS}
                        </span>
                        <span class="vc-week-dates">${formatDate(dates.start)} - ${formatDate(dates.end)}</span>
                    </div>
                </div>
                <div class="vc-header-right">
                    ${generateBtn}
                </div>
            </div>
            ${theme ? `<div class="vc-theme-banner"><span class="vc-theme-label">Week ${w}:</span> ${theme}</div>` : ''}
            <div class="vc-week-nav">
                <button class="vc-nav-btn" onclick="vocabChangeWeek(${w - 1})" ${w <= 1 ? 'disabled' : ''}
                        aria-label="Previous week">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M8.5 3L4.5 7l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Prev
                </button>
                <select class="vc-week-select school-select" onchange="vocabChangeWeek(parseInt(this.value))"
                        aria-label="Select week">
                    ${weekOptions}
                </select>
                <button class="vc-nav-btn" onclick="vocabChangeWeek(${w + 1})" ${w >= VOCAB_TOTAL_WEEKS ? 'disabled' : ''}
                        aria-label="Next week">
                    Next
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M5.5 3L9.5 7l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// ─── Sub-View Tabs ───────────────────────────────────────────────────
function vocabBuildSubTabs() {
    const sv = vocabState.subView;
    const hasData = !!vocabState.weekData;
    const wordCount = hasData && vocabState.weekData.words ? vocabState.weekData.words.length : 0;
    const quizCount = vocabState.quizAttempts.length;

    return `
        <div class="vc-sub-tabs">
            <div class="vc-pill-group">
                <button class="vc-pill ${sv === 'words' ? 'active' : ''}" onclick="vocabSwitchSub('words')">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="2" y="2" width="10" height="2" rx="1" fill="currentColor"/>
                        <rect x="2" y="6" width="8" height="2" rx="1" fill="currentColor" opacity="0.7"/>
                        <rect x="2" y="10" width="10" height="2" rx="1" fill="currentColor" opacity="0.5"/>
                    </svg>
                    Word List${wordCount ? ` (${wordCount})` : ''}
                </button>
                <button class="vc-pill ${sv === 'story' ? 'active' : ''}" onclick="vocabSwitchSub('story')"
                        ${!hasData || !vocabState.weekData.essay_text ? 'disabled' : ''}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2h4a1.5 1.5 0 011.5 1.5V12A1 1 0 006.5 11H2V2z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                        <path d="M12 2H8a1.5 1.5 0 00-1.5 1.5V12A1 1 0 018.5 11H12V2z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                    </svg>
                    Story
                </button>
                <button class="vc-pill ${sv === 'quiz' ? 'active' : ''}" onclick="vocabSwitchSub('quiz')"
                        ${!hasData || !vocabState.weekData.words || !vocabState.weekData.words.length ? 'disabled' : ''}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" stroke-width="1.1"/>
                        <path d="M5 5h4M5 7.5h3M5 10h2" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
                    </svg>
                    Quiz${quizCount ? ` (${quizCount})` : ''}
                </button>
            </div>
        </div>
    `;
}

// =====================================================================
//   WORD LIST VIEW
// =====================================================================
function vocabBuildWordList() {
    const weekData = vocabState.weekData;
    if (!weekData || !weekData.words || weekData.words.length === 0) {
        return vocabEmptyState(
            isTeacher()
                ? 'No words for this week yet. Click "Generate All Weeks" to create vocabulary content.'
                : 'No vocabulary words for this week yet. Check back soon!',
            'empty'
        );
    }

    const words = weekData.words;

    // Group by category
    const categories = {};
    const uncategorized = [];
    words.forEach(w => {
        const cat = w.category || 'General';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(w);
    });

    const categoryColors = {
        'Action Words':     { border: '#3B82F6', bg: '#3B82F610', text: '#60A5FA' },
        'Descriptive':      { border: '#A855F7', bg: '#A855F710', text: '#C084FC' },
        'People & Places':  { border: '#06D6A0', bg: '#06D6A010', text: '#06D6A0' },
        'Nature':           { border: '#22C55E', bg: '#22C55E10', text: '#4ADE80' },
        'Emotions':         { border: '#F43F5E', bg: '#F43F5E10', text: '#FB7185' },
        'Science':          { border: '#0EA5E9', bg: '#0EA5E910', text: '#38BDF8' },
        'Math':             { border: '#F59E0B', bg: '#F59E0B10', text: '#FBBF24' },
        'Social Studies':   { border: '#EAB308', bg: '#EAB30810', text: '#FDE047' },
        'General':          { border: '#64748B', bg: '#64748B10', text: '#94A3B8' }
    };

    let html = '<div class="vc-wordlist">';

    // Teacher: edit button
    if (isTeacher()) {
        html += `
            <div class="vc-teacher-bar" data-role-min="admin">
                <button class="vc-btn vc-btn-secondary" onclick="vocabEditWords()" style="font-size:12px;padding:5px 12px;">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M8.5 1.5l2 2L4 10l-3 1 1-3L8.5 1.5z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Edit Words
                </button>
                <button class="vc-btn vc-btn-ghost" onclick="vocabPrint()" style="font-size:12px;padding:5px 12px;">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4V1h6v3M3 8.5H1.5v-3a1 1 0 011-1h7a1 1 0 011 1v3H9M3 7h6v4H3V7z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Print
                </button>
            </div>
        `;
    }

    const catKeys = Object.keys(categories);
    catKeys.forEach((cat, catIdx) => {
        const colors = categoryColors[cat] || categoryColors['General'];
        const catWords = categories[cat];

        html += `
            <div class="vc-category-section">
                <div class="vc-category-header" style="border-left:3px solid ${colors.border};">
                    <span class="vc-category-name" style="color:${colors.text};">${escapeHtml(cat)}</span>
                    <span class="vc-category-count">${catWords.length} word${catWords.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="vc-word-cards">
        `;

        catWords.forEach(w => {
            const pos = w.part_of_speech || '';
            const posColors = {
                'noun':       { bg: '#3B82F615', text: '#60A5FA' },
                'verb':       { bg: '#22C55E15', text: '#4ADE80' },
                'adjective':  { bg: '#A855F715', text: '#C084FC' },
                'adverb':     { bg: '#F59E0B15', text: '#FBBF24' },
                'preposition':{ bg: '#EC489915', text: '#F472B6' },
                'conjunction':{ bg: '#64748B15', text: '#94A3B8' }
            };
            const posStyle = posColors[pos.toLowerCase()] || { bg: '#64748B15', text: '#94A3B8' };

            html += `
                <div class="vc-word-card" style="border-left:3px solid ${colors.border};">
                    <div class="vc-word-top">
                        <span class="vc-word-name">${escapeHtml(w.word)}</span>
                        ${pos ? `<span class="vc-word-pos" style="background:${posStyle.bg};color:${posStyle.text};">${escapeHtml(pos)}</span>` : ''}
                    </div>
                    <p class="vc-word-def">${escapeHtml(w.definition || '')}</p>
                    ${w.example_sentence ? `<p class="vc-word-example"><span class="vc-example-label">Example:</span> ${escapeHtml(w.example_sentence)}</p>` : ''}
                </div>
            `;
        });

        html += '</div></div>';
    });

    html += '</div>';
    return html;
}

// =====================================================================
//   STORY VIEW
// =====================================================================
function vocabBuildStory() {
    const weekData = vocabState.weekData;
    if (!weekData || !weekData.essay_text) {
        return vocabEmptyState(
            'No story has been written for this week yet.',
            'empty'
        );
    }

    const words = (weekData.words || []).map(w => w.word);
    const format = weekData.essay_format || '';
    const title = weekData.essay_title || '';

    // Format badge label
    const formatLabels = {
        'historical_narrative': 'Historical Narrative',
        'drama_script':         'Drama Script',
        'fairy_tale':           'Fairy Tale',
        'soap_opera':           'Soap Opera',
        'news_report':          'News Report',
        'comic_book':           'Comic Book',
        'diary_entry':          'Diary Entry',
        'letter':               'Letter',
        'mystery':              'Mystery',
        'sports_commentary':    'Sports Commentary'
    };
    const formatLabel = formatLabels[format] || format.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Highlight vocab words in the essay text
    const highlightedText = vocabHighlightWords(weekData.essay_text, words);

    // Build the word legend
    let legendHtml = '<div class="vc-story-legend"><div class="vc-legend-title">Vocabulary Words in this Story</div><div class="vc-legend-words">';
    const foundWords = [];
    words.forEach(w => {
        const regex = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        const found = regex.test(weekData.essay_text);
        foundWords.push({ word: w, found });
        legendHtml += `<span class="vc-legend-word ${found ? 'vc-legend-found' : 'vc-legend-missing'}">${escapeHtml(w)}</span>`;
    });
    legendHtml += '</div></div>';

    const foundCount = foundWords.filter(f => f.found).length;

    return `
        <div class="vc-story">
            <div class="vc-story-header">
                ${format ? `<span class="vc-format-badge">${escapeHtml(formatLabel)}</span>` : ''}
                <span class="vc-word-count-badge">${foundCount}/${words.length} words used</span>
            </div>
            ${title ? `<h3 class="vc-story-title">${escapeHtml(title)}</h3>` : ''}
            <div class="vc-story-body" id="vc-story-body">
                ${highlightedText}
            </div>
            ${legendHtml}
        </div>
    `;
}

function vocabHighlightWords(text, words) {
    if (!words || words.length === 0) return escapeHtml(text);

    // Build a map of word -> definition for tooltips
    const defMap = {};
    if (vocabState.weekData && vocabState.weekData.words) {
        vocabState.weekData.words.forEach(w => {
            defMap[w.word.toLowerCase()] = w.definition || '';
        });
    }

    // Sort words by length descending to match longer words first
    const sorted = [...words].sort((a, b) => b.length - a.length);
    const escapedWords = sorted.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp('\\b(' + escapedWords.join('|') + ')\\b', 'gi');

    // Split text into paragraphs
    const paragraphs = text.split(/\n\n+/);
    return paragraphs.map(para => {
        // Escape HTML first, then apply highlighting
        const escaped = escapeHtml(para);
        const highlighted = escaped.replace(pattern, (match) => {
            const def = defMap[match.toLowerCase()] || '';
            const safeDef = def.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            return `<span class="vc-vocab-highlight" data-word="${escapeHtml(match.toLowerCase())}" data-def="${safeDef}" tabindex="0" role="button" aria-label="${escapeHtml(match)}: ${safeDef}">${match}</span>`;
        });
        return `<p>${highlighted}</p>`;
    }).join('');
}

function vocabBindStoryTooltips() {
    document.querySelectorAll('.vc-vocab-highlight').forEach(el => {
        el.addEventListener('click', vocabShowTooltip);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                vocabShowTooltip.call(el, e);
            }
        });
    });

    // Close tooltip on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.vc-vocab-highlight') && !e.target.closest('.vc-tooltip')) {
            vocabDismissTooltip();
        }
    }, { once: false });
}

function vocabShowTooltip(e) {
    vocabDismissTooltip();

    const word = this.dataset.word;
    const def = this.dataset.def;
    if (!def) return;

    const rect = this.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.className = 'vc-tooltip';
    tooltip.innerHTML = `<strong>${escapeHtml(word)}</strong>: ${escapeHtml(def)}`;

    document.body.appendChild(tooltip);
    vocabState.activeTooltip = tooltip;

    // Position tooltip
    const ttRect = tooltip.getBoundingClientRect();
    let top = rect.top - ttRect.height - 8 + window.scrollY;
    let left = rect.left + (rect.width / 2) - (ttRect.width / 2) + window.scrollX;

    // Keep within viewport
    if (left < 8) left = 8;
    if (left + ttRect.width > window.innerWidth - 8) left = window.innerWidth - ttRect.width - 8;
    if (top < window.scrollY + 8) top = rect.bottom + 8 + window.scrollY;

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
    tooltip.style.opacity = '1';
}

function vocabDismissTooltip() {
    if (vocabState.activeTooltip) {
        vocabState.activeTooltip.remove();
        vocabState.activeTooltip = null;
    }
}

// =====================================================================
//   QUIZ VIEW
// =====================================================================
function vocabBuildQuiz() {
    const weekData = vocabState.weekData;
    if (!weekData || !weekData.words || weekData.words.length === 0) {
        return vocabEmptyState('No vocabulary words available for a quiz this week.', 'empty');
    }

    let html = '<div class="vc-quiz-wrapper">';

    // If there's an active (in-progress) quiz, show it
    if (vocabState.activeQuiz) {
        html += vocabBuildActiveQuiz();
    } else {
        // Start quiz button + quiz history
        html += vocabBuildQuizLanding();
    }

    html += '</div>';
    return html;
}

function vocabBuildQuizLanding() {
    let html = '';

    // Teacher: answer key
    if (isTeacher() && vocabState.weekData && vocabState.weekData.words) {
        html += `
            <details class="vc-answer-key" data-role-min="admin">
                <summary class="vc-answer-key-toggle">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M8 1.5L5.5 4 8 6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M5.5 4h4a3 3 0 010 6h-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                    Answer Key (Teacher Only)
                    <svg class="vc-chevron-icon" width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </summary>
                <div class="vc-answer-key-list">
                    ${vocabState.weekData.words.map((w, i) => `
                        <div class="vc-ak-row">
                            <span class="vc-ak-num">${i + 1}.</span>
                            <span class="vc-ak-word">${escapeHtml(w.word)}</span>
                            <span class="vc-ak-def">${escapeHtml(w.definition || '')}</span>
                        </div>
                    `).join('')}
                </div>
            </details>
        `;
    }

    // Start quiz button
    html += `
        <div class="vc-quiz-start-area">
            <div class="vc-quiz-info">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="3" y="2" width="22" height="24" rx="3" stroke="var(--deft-accent)" stroke-width="1.5"/>
                    <path d="M9 8h10M9 12h8M9 16h6M9 20h4" stroke="var(--deft-accent)" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
                    <circle cx="20" cy="20" r="5" fill="var(--deft-accent)" opacity="0.15"/>
                    <path d="M18 20l1.5 1.5L22 18.5" stroke="var(--deft-accent)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div>
                    <div class="vc-quiz-info-title">Vocabulary Quiz - Week ${vocabState.selectedWeekNumber}</div>
                    <div class="vc-quiz-info-desc">15 questions: fill-in-the-blank sentences and definition matching</div>
                </div>
            </div>
            <button class="vc-btn vc-btn-primary vc-btn-lg" onclick="vocabStartQuiz()">
                Start Quiz
            </button>
        </div>
    `;

    // Quiz history
    if (vocabState.quizAttempts.length > 0) {
        html += '<div class="vc-quiz-history">';
        html += '<h4 class="vc-section-title">Past Attempts</h4>';
        html += '<div class="vc-quiz-history-list">';
        vocabState.quizAttempts.forEach(attempt => {
            const grade = attempt.letter_grade || '';
            const gradeInfo = getLetterGrade(attempt.percentage || 0);
            const dateStr = attempt.submitted_at
                ? new Date(attempt.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                : attempt.created_at
                    ? new Date(attempt.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : '';
            const statusLabel = attempt.status === 'graded'
                ? 'Graded'
                : attempt.status === 'submitted'
                    ? 'Submitted'
                    : 'In Progress';
            const statusColor = attempt.status === 'graded'
                ? 'var(--deft-success)'
                : attempt.status === 'submitted'
                    ? 'var(--deft-warning)'
                    : 'var(--deft-txt-3)';

            html += `
                <div class="vc-history-row" onclick="vocabViewAttempt('${escapeHtml(attempt.quiz_id)}')">
                    <div class="vc-history-left">
                        <span class="vc-history-date">${dateStr}</span>
                        <span class="vc-history-status" style="color:${statusColor};">${statusLabel}</span>
                    </div>
                    <div class="vc-history-right">
                        ${attempt.status === 'graded' ? `
                            <span class="vc-history-score">${attempt.score || 0}/${attempt.total_possible || 15}</span>
                            <span class="vc-history-pct" style="color:${gradeInfo.color};">${attempt.percentage || 0}%</span>
                            <span class="vc-history-grade" style="color:${gradeInfo.color};">${grade || gradeInfo.grade}</span>
                        ` : `
                            <span class="vc-history-score" style="color:var(--deft-txt-3);">--</span>
                        `}
                    </div>
                </div>
            `;
        });
        html += '</div></div>';
    }

    // Teacher: view all student attempts
    if (isTeacher()) {
        html += `
            <div class="vc-teacher-attempts" data-role-min="admin">
                <button class="vc-btn vc-btn-ghost" onclick="vocabLoadAllAttempts()" style="font-size:12px;">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="3.5" r="2" stroke="currentColor" stroke-width="1"/>
                        <path d="M1.5 10.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
                    </svg>
                    View All Student Attempts
                </button>
                <div id="vc-all-attempts"></div>
            </div>
        `;
    }

    return html;
}

// ─── Quiz Generation & Flow ──────────────────────────────────────────
function vocabGenerateQuizQuestions() {
    const words = vocabState.weekData.words;
    if (!words || words.length < 15) return [];

    const questions = [];
    const shuffled = [...words].sort(() => Math.random() - 0.5);

    // ~8 fill-in-the-blank questions
    const fillCount = 8;
    for (let i = 0; i < fillCount && i < shuffled.length; i++) {
        const w = shuffled[i];
        // Create a fill-in-the-blank from the example sentence
        let prompt = '';
        if (w.example_sentence) {
            // Replace the word with blanks in the sentence
            const regex = new RegExp('\\b' + w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
            prompt = w.example_sentence.replace(regex, '________');
            // If the word wasn't in the example sentence, use the definition
            if (prompt === w.example_sentence) {
                prompt = w.definition + ' (Fill in the word: ________)';
            }
        } else {
            prompt = w.definition + ' (Fill in the word: ________)';
        }

        questions.push({
            question_number: questions.length + 1,
            question_type: 'fill_blank',
            prompt: prompt,
            correct_answer: w.word,
            student_answer: '',
            is_correct: null
        });
    }

    // ~7 definition-to-word questions
    const remaining = shuffled.slice(fillCount);
    // If we have fewer than 7 remaining, supplement from the start
    const defWords = remaining.length >= 7
        ? remaining.slice(0, 7)
        : [...remaining, ...shuffled.slice(0, 7 - remaining.length)];

    for (let i = 0; i < defWords.length && questions.length < 15; i++) {
        const w = defWords[i];
        questions.push({
            question_number: questions.length + 1,
            question_type: 'definition',
            prompt: w.definition || 'No definition available',
            correct_answer: w.word,
            student_answer: '',
            is_correct: null
        });
    }

    // Shuffle all questions
    for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    // Renumber
    questions.forEach((q, idx) => { q.question_number = idx + 1; });

    return questions;
}

async function vocabStartQuiz() {
    if (!activeProfileId) {
        toast('Please select a profile first', 'error');
        return;
    }

    const questions = vocabGenerateQuizQuestions();
    if (questions.length === 0) {
        toast('Not enough words to generate a quiz', 'error');
        return;
    }

    // Create quiz record in Supabase
    const quizId = 'vq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const body = {
        quiz_id: quizId,
        week_id: vocabState.weekData.week_id,
        student_id: activeProfileId,
        answers: questions,
        score: null,
        total_possible: 15,
        percentage: null,
        letter_grade: null,
        status: 'in_progress'
    };

    const result = await supabaseWrite('school_vocab_quizzes', 'POST', body);
    if (!result) {
        toast('Could not start quiz', 'error');
        return;
    }

    vocabState.activeQuiz = {
        quiz_id: quizId,
        questions: questions,
        status: 'in_progress'
    };
    vocabState.quizAnswers = questions.map(() => '');

    const container = document.getElementById('vocabulary-container');
    vocabRender(container);
}

function vocabBuildActiveQuiz() {
    const quiz = vocabState.activeQuiz;
    if (!quiz) return '';

    const questions = quiz.questions;
    const isGraded = quiz.status === 'graded';

    let html = '';

    // Quiz header
    html += `
        <div class="vc-quiz-active-header">
            <div class="vc-quiz-active-title">
                ${isGraded ? 'Quiz Results' : 'Vocabulary Quiz'}
                <span class="vc-quiz-active-week">Week ${vocabState.selectedWeekNumber}</span>
            </div>
            ${isGraded && quiz.score != null ? `
                <div class="vc-quiz-score-banner">
                    <span class="vc-quiz-score-num" style="color:${getLetterGrade(quiz.percentage || 0).color};">
                        ${quiz.score}/${quiz.total_possible || 15}
                    </span>
                    <span class="vc-quiz-score-pct" style="color:${getLetterGrade(quiz.percentage || 0).color};">
                        ${quiz.percentage || 0}%
                    </span>
                    <span class="vc-quiz-score-grade" style="color:${getLetterGrade(quiz.percentage || 0).color};">
                        ${quiz.letter_grade || getLetterGrade(quiz.percentage || 0).grade}
                    </span>
                </div>
            ` : ''}
        </div>
    `;

    // Teacher answer key during quiz
    if (isTeacher() && !isGraded && vocabState.weekData && vocabState.weekData.words) {
        html += `
            <details class="vc-answer-key vc-answer-key-inline" data-role-min="admin">
                <summary class="vc-answer-key-toggle">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M8 1.5L5.5 4 8 6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M5.5 4h4a3 3 0 010 6h-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                    Answer Key
                    <svg class="vc-chevron-icon" width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </summary>
                <div class="vc-answer-key-list">
                    ${vocabState.weekData.words.map((w, i) => `
                        <div class="vc-ak-row">
                            <span class="vc-ak-num">${i + 1}.</span>
                            <span class="vc-ak-word">${escapeHtml(w.word)}</span>
                        </div>
                    `).join('')}
                </div>
            </details>
        `;
    }

    // Questions
    html += '<div class="vc-quiz-questions">';
    questions.forEach((q, idx) => {
        const typeLabel = q.question_type === 'fill_blank' ? 'Fill in the Blank' : 'Definition Match';
        const typeIcon = q.question_type === 'fill_blank'
            ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="5" width="11" height="4" rx="1" stroke="currentColor" stroke-width="1"/><path d="M4 7h6" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-dasharray="2 2"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1"/><path d="M6 5.5a1.5 1.5 0 011.8 1.4c0 .7-.5 1-1 1.3M6.8 10h.01" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>';

        const studentAnswer = isGraded ? (q.student_answer || '') : (vocabState.quizAnswers[idx] || '');

        // Result feedback for graded quiz
        let feedbackHtml = '';
        if (isGraded) {
            if (q.is_correct) {
                feedbackHtml = `
                    <div class="vc-quiz-feedback vc-feedback-correct">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3 7l3 3 5-5" stroke="var(--deft-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Correct!
                    </div>
                `;
            } else {
                feedbackHtml = `
                    <div class="vc-quiz-feedback vc-feedback-incorrect">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3 3l8 8M11 3l-8 8" stroke="var(--deft-danger)" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <span>Incorrect. The answer is: <strong>${escapeHtml(q.correct_answer)}</strong></span>
                    </div>
                `;
            }
        }

        html += `
            <div class="vc-quiz-question ${isGraded ? (q.is_correct ? 'vc-q-correct' : 'vc-q-incorrect') : ''}">
                <div class="vc-q-header">
                    <span class="vc-q-number">${q.question_number}</span>
                    <span class="vc-q-type">${typeIcon} ${typeLabel}</span>
                </div>
                <p class="vc-q-prompt">${escapeHtml(q.prompt)}</p>
                <div class="vc-q-input-row">
                    <input type="text" class="school-input vc-quiz-input"
                           data-qidx="${idx}"
                           value="${escapeHtml(studentAnswer)}"
                           placeholder="Type your answer..."
                           ${isGraded ? 'disabled' : ''}
                           oninput="vocabQuizInput(${idx}, this.value)"
                           autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
                </div>
                ${feedbackHtml}
            </div>
        `;
    });
    html += '</div>';

    // Submit / Back buttons
    if (isGraded) {
        html += `
            <div class="vc-quiz-actions">
                <button class="vc-btn vc-btn-secondary" onclick="vocabBackToLanding()">Back to Quiz Menu</button>
                <button class="vc-btn vc-btn-primary" onclick="vocabStartQuiz()">Try Again</button>
            </div>
        `;
    } else {
        const answered = vocabState.quizAnswers.filter(a => a.trim().length > 0).length;
        html += `
            <div class="vc-quiz-actions">
                <div class="vc-quiz-progress-text">
                    ${answered} of ${questions.length} answered
                </div>
                <button class="vc-btn vc-btn-primary vc-btn-lg" onclick="vocabSubmitQuiz()"
                        ${answered === 0 ? 'disabled' : ''}>
                    Submit Quiz
                </button>
            </div>
        `;
    }

    return html;
}

function vocabQuizInput(idx, value) {
    vocabState.quizAnswers[idx] = value;

    // Update progress text
    const answered = vocabState.quizAnswers.filter(a => a.trim().length > 0).length;
    const progressEl = document.querySelector('.vc-quiz-progress-text');
    if (progressEl) {
        const total = vocabState.activeQuiz ? vocabState.activeQuiz.questions.length : 15;
        progressEl.textContent = `${answered} of ${total} answered`;
    }

    // Enable/disable submit button
    const submitBtn = document.querySelector('.vc-quiz-actions .vc-btn-primary');
    if (submitBtn && !submitBtn.textContent.includes('Try Again')) {
        submitBtn.disabled = answered === 0;
    }
}

async function vocabSubmitQuiz() {
    if (!vocabState.activeQuiz) return;

    const quiz = vocabState.activeQuiz;
    const questions = quiz.questions;

    // Merge student answers into the questions
    questions.forEach((q, idx) => {
        q.student_answer = (vocabState.quizAnswers[idx] || '').trim();
    });

    // Save to Supabase first
    const updateBody = {
        answers: questions,
        status: 'submitted',
        submitted_at: new Date().toISOString()
    };

    toast('Submitting quiz...', 'success');

    await supabaseWrite(
        'school_vocab_quizzes',
        'PATCH',
        updateBody,
        `quiz_id=eq.${quiz.quiz_id}`
    );

    // Request AI grading via schoolApi
    const gradeResult = await schoolApi('grade_vocab_quiz', {
        quiz_id: quiz.quiz_id,
        week_id: vocabState.weekData.week_id,
        answers: questions
    }, { timeout: 45000 });

    if (gradeResult && gradeResult.graded_answers) {
        // Apply grading results
        const graded = gradeResult.graded_answers;
        questions.forEach((q, idx) => {
            if (graded[idx]) {
                q.is_correct = graded[idx].is_correct;
                q.student_answer = graded[idx].student_answer || q.student_answer;
            }
        });

        quiz.status = 'graded';
        quiz.score = gradeResult.score || questions.filter(q => q.is_correct).length;
        quiz.total_possible = gradeResult.total_possible || 15;
        quiz.percentage = gradeResult.percentage || Math.round((quiz.score / quiz.total_possible) * 100);
        quiz.letter_grade = gradeResult.letter_grade || getLetterGrade(quiz.percentage).grade;

        toast(`Quiz graded: ${quiz.score}/${quiz.total_possible} (${quiz.percentage}%)`, 'success');
    } else {
        // Fallback: do simple case-insensitive grading locally
        let score = 0;
        questions.forEach(q => {
            const student = (q.student_answer || '').trim().toLowerCase();
            const correct = (q.correct_answer || '').trim().toLowerCase();
            q.is_correct = student === correct;
            if (q.is_correct) score++;
        });

        quiz.status = 'graded';
        quiz.score = score;
        quiz.total_possible = 15;
        quiz.percentage = Math.round((score / 15) * 100);
        quiz.letter_grade = getLetterGrade(quiz.percentage).grade;

        toast(`Quiz graded locally: ${score}/15 (${quiz.percentage}%)`, 'success');
    }

    // Save final graded results
    await supabaseWrite(
        'school_vocab_quizzes',
        'PATCH',
        {
            answers: questions,
            score: quiz.score,
            total_possible: quiz.total_possible,
            percentage: quiz.percentage,
            letter_grade: quiz.letter_grade,
            status: 'graded',
            graded_at: new Date().toISOString(),
            graded_by: gradeResult ? 'ai' : 'local'
        },
        `quiz_id=eq.${quiz.quiz_id}`
    );

    // Re-render
    const container = document.getElementById('vocabulary-container');
    vocabRender(container);
}

function vocabBackToLanding() {
    vocabState.activeQuiz = null;
    vocabState.quizAnswers = [];
    // Reload quiz attempts
    vocabLoadWeekData(vocabState.selectedWeekNumber).then(() => {
        const container = document.getElementById('vocabulary-container');
        vocabRender(container);
    });
}

async function vocabViewAttempt(quizId) {
    // Load the attempt data
    const rows = await supabaseSelect(
        'school_vocab_quizzes',
        `quiz_id=eq.${quizId}&select=*`
    );
    if (!rows || rows.length === 0) {
        toast('Could not load quiz attempt', 'error');
        return;
    }

    const attempt = rows[0];
    vocabState.activeQuiz = {
        quiz_id: attempt.quiz_id,
        questions: attempt.answers || [],
        status: attempt.status,
        score: attempt.score,
        total_possible: attempt.total_possible,
        percentage: attempt.percentage,
        letter_grade: attempt.letter_grade
    };
    vocabState.quizAnswers = (attempt.answers || []).map(q => q.student_answer || '');

    const container = document.getElementById('vocabulary-container');
    vocabRender(container);
}

// ─── Teacher: Load All Student Attempts ──────────────────────────────
async function vocabLoadAllAttempts() {
    if (!vocabState.weekData) return;

    const el = document.getElementById('vc-all-attempts');
    if (!el) return;

    el.innerHTML = '<div style="padding:12px;color:var(--deft-txt-3);font-size:13px;">Loading...</div>';

    const rows = await supabaseSelect(
        'school_vocab_quizzes',
        `week_id=eq.${vocabState.weekData.week_id}&select=*&order=created_at.desc`
    );

    if (!rows || rows.length === 0) {
        el.innerHTML = '<div style="padding:12px;color:var(--deft-txt-3);font-size:13px;">No quiz attempts for this week.</div>';
        return;
    }

    let html = '<div class="vc-all-attempts-list">';
    rows.forEach(r => {
        const gradeInfo = getLetterGrade(r.percentage || 0);
        const dateStr = r.submitted_at
            ? new Date(r.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : '';
        html += `
            <div class="vc-history-row" onclick="vocabViewAttempt('${escapeHtml(r.quiz_id)}')">
                <div class="vc-history-left">
                    <span class="vc-history-student">${escapeHtml(r.student_id || 'Unknown')}</span>
                    <span class="vc-history-date">${dateStr}</span>
                </div>
                <div class="vc-history-right">
                    ${r.status === 'graded' ? `
                        <span class="vc-history-score">${r.score || 0}/${r.total_possible || 15}</span>
                        <span class="vc-history-pct" style="color:${gradeInfo.color};">${r.percentage || 0}%</span>
                        <span class="vc-history-grade" style="color:${gradeInfo.color};">${r.letter_grade || gradeInfo.grade}</span>
                    ` : `
                        <span style="color:var(--deft-txt-3);font-size:12px;">${r.status || 'unknown'}</span>
                    `}
                </div>
            </div>
        `;
    });
    html += '</div>';
    el.innerHTML = html;
}

// ─── Teacher: Generate All Weeks ─────────────────────────────────────
async function vocabGenerateAll() {
    if (!isTeacher()) return;

    const confirmed = confirm('Generate vocabulary content for all 10 weeks? This may take a minute.');
    if (!confirmed) return;

    toast('Generating vocabulary for all weeks...', 'success');

    const result = await schoolApi('generate_vocab_weeks', {
        semester_id: VOCAB_SEMESTER_ID,
        semester_start: VOCAB_SEMESTER_START,
        semester_end: VOCAB_SEMESTER_END,
        total_weeks: VOCAB_TOTAL_WEEKS,
        student_name: 'Brianna',
        grade_level: '4th grade'
    }, { timeout: 120000 });

    if (result) {
        toast('Vocabulary generated for all weeks!', 'success');
        await vocabLoadWeekData(vocabState.selectedWeekNumber);
        const container = document.getElementById('vocabulary-container');
        vocabRender(container);
    } else {
        toast('Failed to generate vocabulary content', 'error');
    }
}

// ─── Teacher: Edit Words ─────────────────────────────────────────────
function vocabEditWords() {
    if (!isTeacher() || !vocabState.weekData) return;

    // Open a simple modal with the word list as editable JSON
    const words = vocabState.weekData.words || [];
    const json = JSON.stringify(words, null, 2);

    const modalHtml = `
        <div class="modal-backdrop active" id="vocabEditModal" onclick="if(event.target===this)closeModal('vocabEditModal')">
            <div class="modal-content" style="max-width:700px;max-height:80vh;overflow-y:auto;">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-heading font-bold text-sm" style="color:var(--deft-txt);">
                        Edit Word List - Week ${vocabState.selectedWeekNumber}
                    </h3>
                    <button onclick="closeModal('vocabEditModal')" style="background:none;border:none;color:var(--deft-txt-3);cursor:pointer;font-size:1.2rem;">&times;</button>
                </div>
                <textarea id="vocabEditJson" class="school-textarea" style="min-height:400px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.5;">${escapeHtml(json)}</textarea>
                <div class="flex gap-2 mt-4">
                    <button class="btn btn-ghost flex-1" onclick="closeModal('vocabEditModal')">Cancel</button>
                    <button class="btn btn-primary flex-1" onclick="vocabSaveWords()">Save Words</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function vocabSaveWords() {
    const textarea = document.getElementById('vocabEditJson');
    if (!textarea) return;

    let words;
    try {
        words = JSON.parse(textarea.value);
    } catch (e) {
        toast('Invalid JSON format', 'error');
        return;
    }

    if (!Array.isArray(words)) {
        toast('Words must be a JSON array', 'error');
        return;
    }

    const result = await supabaseWrite(
        'school_vocab_weeks',
        'PATCH',
        { words: words },
        `week_id=eq.${vocabState.weekData.week_id}`
    );

    if (result) {
        toast('Words saved!', 'success');
        closeModal('vocabEditModal');
        const editModal = document.getElementById('vocabEditModal');
        if (editModal) editModal.remove();
        await vocabLoadWeekData(vocabState.selectedWeekNumber);
        const container = document.getElementById('vocabulary-container');
        vocabRender(container);
    } else {
        toast('Failed to save words', 'error');
    }
}

// ─── Print-Friendly Word List ────────────────────────────────────────
function vocabPrint() {
    if (!vocabState.weekData || !vocabState.weekData.words) return;

    const words = vocabState.weekData.words;
    const theme = vocabState.weekData.theme || '';
    const w = vocabState.selectedWeekNumber;

    let printHtml = `
        <html><head><title>Vocabulary Week ${w}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #222; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            h2 { font-size: 14px; color: #666; margin-top: 0; }
            .word-row { margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 12px; }
            .word-name { font-weight: bold; font-size: 16px; }
            .word-pos { font-style: italic; color: #888; margin-left: 8px; }
            .word-def { margin: 4px 0; }
            .word-example { color: #555; font-style: italic; }
        </style></head><body>
        <h1>Vocabulary - Week ${w}</h1>
        ${theme ? `<h2>${escapeHtml(theme)}</h2>` : ''}
    `;

    words.forEach((word, i) => {
        printHtml += `
            <div class="word-row">
                <span class="word-name">${i + 1}. ${escapeHtml(word.word)}</span>
                <span class="word-pos">(${escapeHtml(word.part_of_speech || '')})</span>
                <div class="word-def">${escapeHtml(word.definition || '')}</div>
                ${word.example_sentence ? `<div class="word-example">"${escapeHtml(word.example_sentence)}"</div>` : ''}
            </div>
        `;
    });

    printHtml += '</body></html>';

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.print();
    }
}

// ─── Navigation & Sub-View Switching ─────────────────────────────────
async function vocabChangeWeek(weekNum) {
    if (weekNum < 1 || weekNum > VOCAB_TOTAL_WEEKS) return;

    vocabState.selectedWeekNumber = weekNum;
    vocabState.activeQuiz = null;
    vocabState.quizAnswers = [];
    vocabState.subView = 'words';

    const container = document.getElementById('vocabulary-container');
    if (container) container.innerHTML = buildVocabSkeleton();

    await vocabLoadWeekData(weekNum);
    vocabRender(container);
}

function vocabSwitchSub(sub) {
    vocabState.subView = sub;
    vocabState.activeQuiz = null;
    vocabState.quizAnswers = [];
    vocabDismissTooltip();

    const container = document.getElementById('vocabulary-container');
    vocabRender(container);
}

// ─── Empty & Loading States ──────────────────────────────────────────
function vocabEmptyState(message, type) {
    const icons = {
        empty: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M4 6h8a3 3 0 013 3v14a2 2 0 00-2-2H4V6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M28 6h-8a3 3 0 00-3 3v14a2 2 0 012-2h9V6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
        error: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M16 11v6M16 20v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    };

    const iconColor = type === 'error' ? 'var(--deft-danger)' : 'var(--deft-txt-3)';

    return `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    padding:56px 24px;text-align:center;color:var(--deft-txt-3);
                    font-family:var(--deft-body-font),sans-serif;">
            <div style="color:${iconColor};margin-bottom:12px;opacity:0.6;">
                ${icons[type] || icons.empty}
            </div>
            <p style="margin:0;font-size:14px;line-height:1.5;max-width:360px;">
                ${escapeHtml(message)}
            </p>
        </div>
    `;
}

function buildVocabSkeleton() {
    return `
        <div style="max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:1rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0;">
                <div>
                    <div style="height:22px;width:140px;border-radius:6px;background:var(--deft-surface-hi);margin-bottom:8px;animation:skeleton-pulse 1.5s ease-in-out infinite;"></div>
                    <div style="height:14px;width:200px;border-radius:4px;background:var(--deft-surface-hi);animation:skeleton-pulse 1.5s ease-in-out infinite;"></div>
                </div>
            </div>
            <div style="display:flex;gap:4px;padding:3px;background:var(--deft-surface-el);border-radius:8px;border:1px solid var(--deft-border);width:fit-content;">
                <div style="width:100px;height:30px;border-radius:6px;background:var(--deft-surface-hi);animation:skeleton-pulse 1.5s ease-in-out infinite;"></div>
                <div style="width:70px;height:30px;border-radius:6px;background:var(--deft-surface-hi);animation:skeleton-pulse 1.5s ease-in-out infinite;"></div>
                <div style="width:70px;height:30px;border-radius:6px;background:var(--deft-surface-hi);animation:skeleton-pulse 1.5s ease-in-out infinite;"></div>
            </div>
            ${[1,2,3,4,5].map(i => `
                <div style="background:var(--deft-surface-el);border:1px solid var(--deft-border);border-radius:12px;padding:16px;animation:skeleton-pulse 1.5s ease-in-out infinite;">
                    <div style="height:16px;width:${100 + i * 25}px;max-width:50%;border-radius:4px;background:var(--deft-surface-hi);margin-bottom:10px;"></div>
                    <div style="height:12px;width:${200 + i * 15}px;max-width:80%;border-radius:4px;background:var(--deft-surface-hi);margin-bottom:6px;"></div>
                    <div style="height:11px;width:${150 + i * 20}px;max-width:60%;border-radius:4px;background:var(--deft-surface-hi);"></div>
                </div>
            `).join('')}
        </div>
    `;
}

// ─── CSS Injection ───────────────────────────────────────────────────
function injectVocabStyles() {
    if (document.getElementById('vc-styles')) return;
    const style = document.createElement('style');
    style.id = 'vc-styles';
    style.textContent = `
/* =====================================================================
   Vocabulary Tab Styles
   ===================================================================== */

.vc-wrapper {
    max-width: 820px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* ── Header ── */
.vc-header {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.vc-header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}

.vc-header-left { display: flex; flex-direction: column; gap: 0.375rem; }

.vc-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--deft-txt);
    font-family: var(--deft-heading-font), sans-serif;
}

.vc-week-indicator {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
}

.vc-week-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    background: var(--deft-surface-el);
    color: var(--deft-txt-2);
    border: 1px solid var(--deft-border);
}

.vc-week-badge.vc-week-current {
    background: var(--deft-accent-dim);
    color: var(--deft-accent);
    border-color: transparent;
}

.vc-week-dates {
    font-size: 12px;
    color: var(--deft-txt-3);
}

.vc-theme-banner {
    padding: 10px 16px;
    border-radius: 10px;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    font-size: 14px;
    color: var(--deft-txt);
    font-weight: 500;
}

.vc-theme-label {
    color: var(--deft-accent);
    font-weight: 700;
    margin-right: 4px;
}

.vc-week-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.vc-nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border: 1px solid var(--deft-border);
    border-radius: 8px;
    background: var(--deft-surface-el);
    color: var(--deft-txt-2);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--deft-body-font), sans-serif;
}

.vc-nav-btn:hover:not(:disabled) {
    background: var(--deft-surface-hi);
    color: var(--deft-txt);
    border-color: var(--deft-txt-3);
}

.vc-nav-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

.vc-week-select {
    padding: 5px 10px;
    font-size: 12px;
    min-width: 160px;
}

.vc-header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
}

/* ── Sub-Tabs (pill group) ── */
.vc-sub-tabs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.vc-pill-group {
    display: flex;
    gap: 0.25rem;
    padding: 0.1875rem;
    border-radius: 0.5rem;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
}

.vc-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0.35rem 0.75rem;
    border: none;
    border-radius: 0.375rem;
    background: transparent;
    color: var(--deft-txt-2);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
    font-family: var(--deft-body-font), sans-serif;
    white-space: nowrap;
}

.vc-pill:hover:not(:disabled) { background: rgba(255,255,255,0.04); color: var(--deft-txt); }

.vc-pill.active {
    background: var(--deft-accent);
    color: #0D0F14;
}

.vc-pill:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

/* ── Buttons ── */
.vc-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0.5rem 1.25rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
    font-family: var(--deft-body-font), sans-serif;
}

.vc-btn-primary {
    background: var(--deft-accent);
    color: #0D0F14;
}
.vc-btn-primary:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.vc-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; filter: none; }

.vc-btn-secondary {
    background: var(--deft-surface-hi);
    color: var(--deft-txt-2);
    border: 1px solid var(--deft-border);
}
.vc-btn-secondary:hover { color: var(--deft-txt); border-color: var(--deft-txt-3); }

.vc-btn-ghost {
    background: transparent;
    color: var(--deft-txt-3);
}
.vc-btn-ghost:hover { color: var(--deft-txt-2); background: rgba(255,255,255,0.03); }

.vc-btn-lg { padding: 0.625rem 1.5rem; font-size: 0.9rem; }

/* ── Teacher Bar ── */
.vc-teacher-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

/* ── Word List ── */
.vc-wordlist {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.vc-category-section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
}

.vc-category-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 8px 14px;
    border-radius: 8px;
    background: var(--deft-surface);
}

.vc-category-name {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-family: var(--deft-heading-font), sans-serif;
}

.vc-category-count {
    font-size: 11px;
    color: var(--deft-txt-3);
    margin-left: auto;
}

.vc-word-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.vc-word-card {
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    border-radius: 10px;
    padding: 14px 16px;
    transition: background 0.15s, border-color 0.15s;
}

.vc-word-card:hover {
    background: var(--deft-surface-hi);
    border-color: var(--deft-txt-3);
}

.vc-word-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 6px;
    flex-wrap: wrap;
}

.vc-word-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--deft-txt);
    font-family: var(--deft-heading-font), sans-serif;
}

.vc-word-pos {
    display: inline-flex;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    font-style: italic;
}

.vc-word-def {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--deft-txt-2);
    line-height: 1.5;
}

.vc-word-example {
    margin: 0;
    font-size: 12px;
    color: var(--deft-txt-3);
    line-height: 1.5;
    font-style: italic;
}

.vc-example-label {
    font-style: normal;
    font-weight: 600;
    color: var(--deft-txt-3);
}

/* ── Story View ── */
.vc-story {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.vc-story-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.vc-format-badge {
    display: inline-flex;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--deft-accent-dim);
    color: var(--deft-accent);
}

.vc-word-count-badge {
    display: inline-flex;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(255,255,255,0.04);
    color: var(--deft-txt-3);
}

.vc-story-title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--deft-txt);
    font-family: var(--deft-heading-font), sans-serif;
}

.vc-story-body {
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    border-radius: 12px;
    padding: 24px 28px;
    line-height: 1.8;
    font-size: 14px;
    color: var(--deft-txt);
}

.vc-story-body p {
    margin: 0 0 1em;
}

.vc-story-body p:last-child {
    margin-bottom: 0;
}

.vc-vocab-highlight {
    background: var(--deft-accent-dim);
    color: var(--deft-accent);
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.12s, box-shadow 0.12s;
    border-bottom: 2px solid transparent;
}

.vc-vocab-highlight:hover,
.vc-vocab-highlight:focus {
    background: rgba(6,214,160,0.25);
    border-bottom-color: var(--deft-accent);
    outline: none;
}

.vc-tooltip {
    position: absolute;
    z-index: 200;
    max-width: 320px;
    padding: 10px 14px;
    border-radius: 8px;
    background: var(--deft-surface-hi, #242836);
    color: var(--deft-txt);
    font-size: 13px;
    line-height: 1.5;
    border: 1px solid var(--deft-border);
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    opacity: 0;
    transition: opacity 0.15s;
    pointer-events: none;
}

.vc-tooltip strong {
    color: var(--deft-accent);
    text-transform: capitalize;
}

/* ── Story Legend ── */
.vc-story-legend {
    background: var(--deft-surface);
    border: 1px solid var(--deft-border);
    border-radius: 10px;
    padding: 16px 20px;
}

.vc-legend-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--deft-txt-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 10px;
}

.vc-legend-words {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.vc-legend-word {
    display: inline-flex;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.12s;
}

.vc-legend-found {
    background: var(--deft-accent-dim);
    color: var(--deft-accent);
}

.vc-legend-missing {
    background: rgba(255,107,107,0.1);
    color: var(--deft-danger);
    text-decoration: line-through;
    opacity: 0.6;
}

/* ── Quiz View ── */
.vc-quiz-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.vc-quiz-start-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 36px 24px;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    border-radius: 12px;
    text-align: center;
}

.vc-quiz-info {
    display: flex;
    align-items: center;
    gap: 14px;
}

.vc-quiz-info-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--deft-txt);
    font-family: var(--deft-heading-font), sans-serif;
}

.vc-quiz-info-desc {
    font-size: 13px;
    color: var(--deft-txt-3);
    margin-top: 2px;
}

/* ── Answer Key ── */
.vc-answer-key {
    background: var(--deft-surface);
    border: 1px solid var(--deft-border);
    border-radius: 10px;
    overflow: hidden;
}

.vc-answer-key-inline {
    margin-bottom: 0.5rem;
}

.vc-answer-key-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    font-size: 12px;
    font-weight: 600;
    color: var(--deft-txt-3);
    cursor: pointer;
    list-style: none;
    user-select: none;
}

.vc-answer-key-toggle::-webkit-details-marker { display: none; }

.vc-chevron-icon {
    margin-left: auto;
    transition: transform 0.2s;
}

details[open] > .vc-answer-key-toggle .vc-chevron-icon {
    transform: rotate(180deg);
}

.vc-answer-key-list {
    padding: 8px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.vc-ak-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
    padding: 3px 0;
}

.vc-ak-num { color: var(--deft-txt-3); min-width: 22px; }
.vc-ak-word { color: var(--deft-accent); font-weight: 700; min-width: 100px; }
.vc-ak-def { color: var(--deft-txt-2); flex: 1; }

/* ── Active Quiz ── */
.vc-quiz-active-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}

.vc-quiz-active-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--deft-txt);
    font-family: var(--deft-heading-font), sans-serif;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.vc-quiz-active-week {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--deft-surface-el);
    color: var(--deft-txt-3);
}

.vc-quiz-score-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.vc-quiz-score-num { font-size: 18px; font-weight: 700; }
.vc-quiz-score-pct { font-size: 14px; font-weight: 600; }
.vc-quiz-score-grade { font-size: 22px; font-weight: 800; font-family: var(--deft-heading-font), sans-serif; }

.vc-quiz-questions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.vc-quiz-question {
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    border-radius: 10px;
    padding: 16px 18px;
    transition: border-color 0.15s;
}

.vc-quiz-question:focus-within {
    border-color: var(--deft-accent);
}

.vc-quiz-question.vc-q-correct {
    border-color: var(--deft-success);
    background: rgba(6,214,160,0.03);
}

.vc-quiz-question.vc-q-incorrect {
    border-color: var(--deft-danger);
    background: rgba(255,107,107,0.03);
}

.vc-q-header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-bottom: 8px;
}

.vc-q-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: var(--deft-surface-hi);
    color: var(--deft-txt-2);
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
}

.vc-q-type {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--deft-txt-3);
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.vc-q-prompt {
    margin: 0 0 10px;
    font-size: 14px;
    color: var(--deft-txt);
    line-height: 1.5;
}

.vc-q-input-row {
    max-width: 360px;
}

.vc-quiz-input {
    font-size: 14px;
}

.vc-quiz-question.vc-q-correct .vc-quiz-input {
    border-color: var(--deft-success);
    color: var(--deft-success);
}

.vc-quiz-question.vc-q-incorrect .vc-quiz-input {
    border-color: var(--deft-danger);
    color: var(--deft-danger);
}

/* ── Quiz Feedback ── */
.vc-quiz-feedback {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 13px;
    font-weight: 600;
}

.vc-feedback-correct { color: var(--deft-success); }
.vc-feedback-incorrect { color: var(--deft-danger); }
.vc-feedback-incorrect strong { color: var(--deft-accent); }

/* ── Quiz Actions ── */
.vc-quiz-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-top: 0.5rem;
    flex-wrap: wrap;
}

.vc-quiz-progress-text {
    font-size: 13px;
    color: var(--deft-txt-3);
    font-weight: 500;
}

/* ── Quiz History ── */
.vc-quiz-history {
    margin-top: 0.5rem;
}

.vc-section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--deft-txt-2);
    margin: 0 0 0.625rem;
    font-family: var(--deft-heading-font), sans-serif;
}

.vc-quiz-history-list,
.vc-all-attempts-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.vc-history-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}

.vc-history-row:hover {
    background: var(--deft-surface-hi);
    border-color: var(--deft-txt-3);
}

.vc-history-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.vc-history-date {
    font-size: 12px;
    color: var(--deft-txt-2);
}

.vc-history-status {
    font-size: 11px;
    font-weight: 600;
}

.vc-history-student {
    font-size: 13px;
    color: var(--deft-txt);
    font-weight: 600;
}

.vc-history-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.vc-history-score {
    font-size: 13px;
    color: var(--deft-txt-2);
    font-weight: 600;
}

.vc-history-pct {
    font-size: 13px;
    font-weight: 700;
}

.vc-history-grade {
    font-size: 16px;
    font-weight: 800;
    font-family: var(--deft-heading-font), sans-serif;
}

.vc-teacher-attempts {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--deft-border);
}

/* ── Print ── */
@media print {
    .vc-sub-tabs, .vc-week-nav, .vc-teacher-bar, .vc-header-right,
    .vc-nav-btn, .vc-btn { display: none !important; }
    .vc-word-card { break-inside: avoid; border: 1px solid #ddd !important; }
    .vc-wrapper { max-width: 100%; }
}

/* ── Responsive ── */
@media (max-width: 640px) {
    .vc-story-body { padding: 16px 18px; font-size: 13px; }
    .vc-quiz-info { flex-direction: column; text-align: center; }
    .vc-quiz-score-banner { flex-direction: column; gap: 0.25rem; }
    .vc-header-top { flex-direction: column; }
    .vc-quiz-actions { flex-direction: column; align-items: stretch; }
    .vc-quiz-actions .vc-btn-lg { width: 100%; justify-content: center; }
    .vc-history-row { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
    .vc-q-input-row { max-width: 100%; }
}
`;
    document.head.appendChild(style);
}
