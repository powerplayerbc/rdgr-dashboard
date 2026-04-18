// =====================================================================
// Tab: Flashcards
// Spelling practice (from vocab weeks) + Multiplication drill
// Study tools tracked for completion and proficiency, NOT graded tests
// =====================================================================

// ─── Constants ──────────────────────────────────────────────────────
const FC_SEMESTER_START = '2026-05-04';
const FC_SEMESTER_ID = '2026-summer';
const FC_TOTAL_WEEKS = 10;

// ─── Flashcard State ────────────────────────────────────────────────
let fcState = {
    mode: 'spelling',           // 'spelling' | 'multiplication'

    // Spelling
    spWeekNumber: 1,
    spCurrentWeek: 1,
    spWords: [],                // [{word, definition, category, part_of_speech, example_sentence}]
    spProgress: {},             // card_key -> progress row
    spIndex: 0,
    spInput: '',
    spRevealed: false,
    spCorrect: null,            // null | true | false
    spFlipped: false,

    // Multiplication
    mulPhase: 1,                // 1 | 2 | 3
    mulProblems: [],            // [{a, b, key}]
    mulProgress: {},            // card_key -> progress row
    mulCurrent: null,           // {a, b, key}
    mulInput: '',
    mulRevealed: false,
    mulCorrect: null,
    mulTimerStart: null,
    mulTimerId: null,
    mulElapsed: 0,

    // Session stats (multiplication)
    mulSessionAnswered: 0,
    mulSessionCorrect: 0,
    mulSessionStreak: 0,
    mulSessionBestStreak: 0
};

// ─── Upsert Helper ──────────────────────────────────────────────────
async function upsertProgress(body) {
    const url = `${SUPABASE_URL}/rest/v1/school_flashcard_progress?on_conflict=student_id,card_type,card_key`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation,resolution=merge-duplicates'
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            console.error('upsertProgress error:', res.status, await res.text());
            return null;
        }
        const text = await res.text();
        return text ? JSON.parse(text) : true;
    } catch (err) {
        console.error('upsertProgress error:', err);
        return null;
    }
}


// =====================================================================
//   MAIN ENTRY POINT
// =====================================================================
async function refreshFlashcards() {
    const container = document.getElementById('flashcards-container');
    if (!container) return;

    injectFlashcardStyles();

    fcState.spCurrentWeek = fcGetCurrentWeek();
    if (!fcState.spWeekNumber) fcState.spWeekNumber = fcState.spCurrentWeek;

    container.innerHTML = fcBuildSkeleton();

    try {
        if (fcState.mode === 'spelling') {
            await fcLoadSpellingData();
        } else {
            await fcLoadMultiplicationData();
        }
        fcRender();
    } catch (err) {
        console.error('refreshFlashcards error:', err);
        container.innerHTML = fcEmptyState('Something went wrong loading flashcard data.', 'error');
    }
}


// ─── Semester Week Calculation ───────────────────────────────────────
function fcGetCurrentWeek() {
    const today = new Date(todayStr() + 'T00:00:00');
    const start = new Date(FC_SEMESTER_START + 'T00:00:00');
    if (today < start) return 1;
    const diffDays = Math.floor((today - start) / 86400000);
    const week = Math.floor(diffDays / 7) + 1;
    return Math.min(Math.max(week, 1), FC_TOTAL_WEEKS);
}


// =====================================================================
//   SKELETON / LOADING
// =====================================================================
function fcBuildSkeleton() {
    return `
    <div class="fc-wrapper">
        <div class="fc-loading">
            <div class="fc-spinner"></div>
            <span>Loading flashcards...</span>
        </div>
    </div>`;
}

function fcEmptyState(msg, type = 'empty') {
    const icon = type === 'error'
        ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--deft-danger)" stroke-width="1.5"/><path d="M15 9l-6 6M9 9l6 6" stroke="var(--deft-danger)" stroke-width="1.5" stroke-linecap="round"/></svg>'
        : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="var(--deft-txt-3)" stroke-width="1.5"/><path d="M8 10h8M8 14h5" stroke="var(--deft-txt-3)" stroke-width="1.3" stroke-linecap="round"/></svg>';
    return `<div class="fc-empty">${icon}<p>${msg}</p></div>`;
}


// =====================================================================
//   DATA FETCHING
// =====================================================================
async function fcLoadSpellingData() {
    const [weekRows, progressRows] = await Promise.all([
        supabaseSelect(
            'school_vocab_weeks',
            `semester_id=eq.${FC_SEMESTER_ID}&week_number=eq.${fcState.spWeekNumber}&select=words`
        ),
        activeProfileId
            ? supabaseSelect(
                'school_flashcard_progress',
                `student_id=eq.${activeProfileId}&card_type=eq.spelling&select=*`
            )
            : Promise.resolve(null)
    ]);

    var rawWords = (weekRows && weekRows[0] && weekRows[0].words) ? weekRows[0].words : [];
    fcState.spWords = typeof rawWords === 'string' ? (function() { try { return JSON.parse(rawWords); } catch(e) { return []; } })() : rawWords;

    // Index progress by card_key
    fcState.spProgress = {};
    if (progressRows) {
        progressRows.forEach(r => { fcState.spProgress[r.card_key] = r; });
    }

    // Reset card position
    fcState.spIndex = 0;
    fcState.spRevealed = false;
    fcState.spCorrect = null;
    fcState.spInput = '';
    fcState.spFlipped = false;
}

async function fcLoadMultiplicationData() {
    // Build problem set for current phase
    fcBuildMultiplicationProblems();

    if (!activeProfileId) {
        fcState.mulProgress = {};
        return;
    }

    const progressRows = await supabaseSelect(
        'school_flashcard_progress',
        `student_id=eq.${activeProfileId}&card_type=eq.multiplication&select=*`
    );

    fcState.mulProgress = {};
    if (progressRows) {
        progressRows.forEach(r => { fcState.mulProgress[r.card_key] = r; });
    }

    // Reset session stats
    fcState.mulSessionAnswered = 0;
    fcState.mulSessionCorrect = 0;
    fcState.mulSessionStreak = 0;
    fcState.mulSessionBestStreak = 0;

    // Pick first problem
    fcState.mulCurrent = null;
    fcState.mulRevealed = false;
    fcState.mulCorrect = null;
    fcState.mulInput = '';
    fcPickNextMultiplication();
}

function fcBuildMultiplicationProblems() {
    fcState.mulProblems = [];
    const phase = fcState.mulPhase;

    if (phase === 1) {
        for (let a = 1; a <= 12; a++) {
            for (let b = 1; b <= 12; b++) {
                fcState.mulProblems.push({ a, b, key: `${a}x${b}` });
            }
        }
    } else if (phase === 2) {
        // 13-20 range: both factors 1-20, at least one >= 13
        for (let a = 1; a <= 20; a++) {
            for (let b = 1; b <= 20; b++) {
                if (a >= 13 || b >= 13) {
                    fcState.mulProblems.push({ a, b, key: `${a}x${b}` });
                }
            }
        }
    } else if (phase === 3) {
        // Phase 3 uses random generation, not a fixed set
        fcState.mulProblems = [];
    }
}


// =====================================================================
//   MAIN RENDER
// =====================================================================
function fcRender() {
    const container = document.getElementById('flashcards-container');
    if (!container) return;

    let html = '<div class="fc-wrapper">';

    // Mode selector
    html += fcBuildModeSelector();

    // Content area
    html += '<div class="fc-content" id="fc-content">';
    if (fcState.mode === 'spelling') {
        html += fcBuildSpellingView();
    } else {
        html += fcBuildMultiplicationView();
    }
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    // Post-render bindings
    fcPostRender();
}

function fcPostRender() {
    // Auto-focus input
    const input = document.getElementById('fc-input');
    if (input && !fcState.spRevealed && !fcState.mulRevealed) {
        setTimeout(() => input.focus(), 50);
    }

    // Start timer for multiplication
    if (fcState.mode === 'multiplication' && fcState.mulCurrent && !fcState.mulRevealed) {
        fcStartMulTimer();
    }
}


// =====================================================================
//   MODE SELECTOR
// =====================================================================
function fcBuildModeSelector() {
    const sp = fcState.mode === 'spelling';
    const ml = fcState.mode === 'multiplication';
    return `
    <div class="fc-mode-bar">
        <button class="fc-mode-btn ${sp ? 'active' : ''}" onclick="fcSetMode('spelling')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 12l2.5-7h5L13 12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 9.5h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M7 3v1.5M9 3v1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
            </svg>
            Spelling
        </button>
        <button class="fc-mode-btn ${ml ? 'active' : ''}" onclick="fcSetMode('multiplication')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Multiplication
        </button>
    </div>`;
}

function fcSetMode(mode) {
    if (fcState.mode === mode) return;
    fcStopMulTimer();
    fcState.mode = mode;
    refreshFlashcards();
}


// =====================================================================
//   SPELLING VIEW
// =====================================================================
function fcBuildSpellingView() {
    let html = '';

    // Week header + navigation
    html += fcBuildSpellingHeader();

    if (fcState.spWords.length === 0) {
        return html + fcEmptyState('No vocabulary words for this week yet. Check back soon!');
    }

    // Mastery summary
    html += fcBuildSpellingMastery();

    // Flashcard
    html += fcBuildSpellingCard();

    return html;
}

function fcBuildSpellingHeader() {
    const w = fcState.spWeekNumber;
    const isCurrent = w === fcState.spCurrentWeek;

    let weekOptions = '';
    for (let i = 1; i <= FC_TOTAL_WEEKS; i++) {
        const label = `Week ${i}${i === fcState.spCurrentWeek ? ' (Current)' : ''}`;
        weekOptions += `<option value="${i}" ${i === w ? 'selected' : ''}>${label}</option>`;
    }

    return `
    <div class="fc-sp-header">
        <div class="fc-sp-header-left">
            <h3 class="fc-title">Spelling Practice</h3>
            <div class="fc-week-indicator">
                <span class="fc-week-badge ${isCurrent ? 'fc-week-current' : ''}">
                    Week ${w} of ${FC_TOTAL_WEEKS}
                </span>
            </div>
        </div>
        <div class="fc-week-nav">
            <button class="fc-nav-btn" onclick="fcChangeSpWeek(${w - 1})" ${w <= 1 ? 'disabled' : ''}
                    aria-label="Previous week">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M8.5 3L4.5 7l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <select class="fc-week-select" onchange="fcChangeSpWeek(parseInt(this.value))" aria-label="Select week">
                ${weekOptions}
            </select>
            <button class="fc-nav-btn" onclick="fcChangeSpWeek(${w + 1})" ${w >= FC_TOTAL_WEEKS ? 'disabled' : ''}
                    aria-label="Next week">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5.5 3L9.5 7l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
    </div>`;
}

function fcChangeSpWeek(num) {
    if (num < 1 || num > FC_TOTAL_WEEKS) return;
    fcState.spWeekNumber = num;
    refreshFlashcards();
}

function fcBuildSpellingMastery() {
    const words = fcState.spWords;
    const prog = fcState.spProgress;
    let mastered = 0;

    const wordItems = words.map(w => {
        const p = prog[w.word];
        const isProficient = p && p.proficient;
        if (isProficient) mastered++;
        return { word: w.word, proficient: isProficient, attempts: p ? p.total_attempts : 0 };
    });

    const pct = words.length > 0 ? Math.round((mastered / words.length) * 100) : 0;

    let html = `
    <div class="fc-mastery-bar">
        <div class="fc-mastery-header">
            <span class="fc-mastery-label">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1l1.8 3.6L13 5.2l-3 2.9.7 4.1L7 10.3 3.3 12.2l.7-4.1-3-2.9 4.2-.6z" stroke="var(--deft-accent)" stroke-width="1.1" fill="var(--deft-accent)" fill-opacity="0.15"/>
                </svg>
                ${mastered} of ${words.length} words mastered
            </span>
            <span class="fc-mastery-pct">${pct}%</span>
        </div>
        <div class="fc-progress-track">
            <div class="fc-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="fc-word-chips">`;

    wordItems.forEach((item, i) => {
        const cls = item.proficient ? 'fc-chip-done' : (item.attempts > 0 ? 'fc-chip-wip' : 'fc-chip-new');
        html += `<button class="fc-word-chip ${cls} ${i === fcState.spIndex ? 'active' : ''}" onclick="fcJumpToSpWord(${i})" title="Word ${i + 1}">${i + 1}</button>`;
    });

    html += `</div></div>`;
    return html;
}

function fcJumpToSpWord(index) {
    fcState.spIndex = index;
    fcState.spRevealed = false;
    fcState.spCorrect = null;
    fcState.spInput = '';
    fcState.spFlipped = false;
    fcRender();
}

function fcBuildSpellingCard() {
    const words = fcState.spWords;
    if (words.length === 0) return '';

    const idx = fcState.spIndex;
    const w = words[idx];
    const total = words.length;

    // Part-of-speech badge
    const posColors = {
        'noun':      { bg: '#3B82F615', text: '#60A5FA' },
        'verb':      { bg: '#22C55E15', text: '#4ADE80' },
        'adjective': { bg: '#A855F715', text: '#C084FC' },
        'adverb':    { bg: '#F59E0B15', text: '#FBBF24' },
        'pronoun':   { bg: '#EC489915', text: '#F472B6' },
        'preposition': { bg: '#0EA5E915', text: '#38BDF8' }
    };
    const posStyle = posColors[w.part_of_speech] || { bg: '#64748B15', text: '#94A3B8' };
    const posBadge = w.part_of_speech
        ? `<span class="fc-pos-badge" style="background:${posStyle.bg};color:${posStyle.text}">${escapeHtml(w.part_of_speech)}</span>`
        : '';

    const revealed = fcState.spRevealed;
    const correct = fcState.spCorrect;

    // Card front: definition
    // Card back: result
    let cardFront = `
        <div class="fc-card-counter">${idx + 1} / ${total}</div>
        <div class="fc-card-body">
            ${posBadge}
            <div class="fc-definition">${escapeHtml(w.definition || 'No definition available')}</div>
            ${w.example_sentence ? `<div class="fc-example"><em>"${escapeHtml(w.example_sentence.replace(new RegExp(w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '____'))}"</em></div>` : ''}
        </div>
        <button class="fc-speak-btn" onclick="fcSpeak('${escapeHtml(w.definition || '')}')" title="Read definition aloud" aria-label="Read aloud">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 7h2l4-3v10l-4-3H3a1 1 0 01-1-1V8a1 1 0 011-1z" fill="currentColor" opacity="0.6"/>
                <path d="M12.5 5.5a5 5 0 010 7M14.5 3.5a8 8 0 010 11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
        </button>
    `;

    let cardBack = '';
    if (revealed) {
        if (correct) {
            cardBack = `
                <div class="fc-result fc-result-correct">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                        <circle cx="20" cy="20" r="18" stroke="var(--deft-success)" stroke-width="2" fill="var(--deft-success)" fill-opacity="0.1"/>
                        <path d="M12 20l5 5 11-11" stroke="var(--deft-success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <div class="fc-result-word">${escapeHtml(w.word)}</div>
                    <div class="fc-result-msg">Correct!</div>
                </div>`;
        } else {
            const userInput = fcState.spInput || '';
            const diff = fcBuildSpellingDiff(userInput, w.word);
            cardBack = `
                <div class="fc-result fc-result-wrong">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                        <circle cx="20" cy="20" r="18" stroke="var(--deft-danger)" stroke-width="2" fill="var(--deft-danger)" fill-opacity="0.1"/>
                        <path d="M14 14l12 12M26 14l-12 12" stroke="var(--deft-danger)" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                    <div class="fc-result-label">Correct spelling:</div>
                    <div class="fc-result-word fc-result-word-correct">${escapeHtml(w.word)}</div>
                    <div class="fc-result-label" style="margin-top:8px;">Your answer:</div>
                    <div class="fc-result-diff">${diff}</div>
                </div>`;
        }
    }

    // Input area
    let inputArea = '';
    if (!revealed) {
        inputArea = `
        <div class="fc-input-area">
            <input id="fc-input" type="text" class="fc-text-input" placeholder="Type the word..."
                   autocomplete="off" autocapitalize="off" spellcheck="false"
                   onkeydown="if(event.key==='Enter')fcCheckSpelling()" aria-label="Spell the word">
            <button class="fc-check-btn" onclick="fcCheckSpelling()">
                Check
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l4 4 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>`;
    } else {
        inputArea = `
        <div class="fc-input-area">
            <button class="fc-next-btn" onclick="fcNextSpelling()">
                ${idx < total - 1 ? 'Next Word' : 'Finish'}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5.5 3L9.5 7l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>`;
    }

    const flipClass = revealed ? 'fc-card-flipped' : '';

    return `
    <div class="fc-card-stage">
        <div class="fc-card-3d ${flipClass}" id="fc-card-3d">
            <div class="fc-card-face fc-card-front">${cardFront}</div>
            <div class="fc-card-face fc-card-back">${cardBack}</div>
        </div>
        ${inputArea}
    </div>`;
}

function fcBuildSpellingDiff(userInput, correctWord) {
    // Highlight character differences
    const uLower = userInput.toLowerCase();
    const cLower = correctWord.toLowerCase();
    let html = '';
    const maxLen = Math.max(uLower.length, cLower.length);

    for (let i = 0; i < maxLen; i++) {
        const uChar = i < userInput.length ? userInput[i] : '';
        const cChar = i < cLower.length ? cLower[i] : '';

        if (uChar.toLowerCase() === cChar) {
            html += `<span class="fc-diff-match">${escapeHtml(uChar || '_')}</span>`;
        } else if (uChar) {
            html += `<span class="fc-diff-wrong">${escapeHtml(uChar)}</span>`;
        } else {
            html += `<span class="fc-diff-missing">_</span>`;
        }
    }
    return html;
}

function fcSpeak(text) {
    if (!('speechSynthesis' in window)) {
        toast('Speech not supported in this browser', 'error');
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

async function fcCheckSpelling() {
    const input = document.getElementById('fc-input');
    if (!input) return;

    const userAnswer = input.value.trim();
    if (!userAnswer) {
        input.classList.add('fc-input-shake');
        setTimeout(() => input.classList.remove('fc-input-shake'), 400);
        return;
    }

    const w = fcState.spWords[fcState.spIndex];
    const isCorrect = userAnswer.toLowerCase() === w.word.toLowerCase();

    fcState.spInput = userAnswer;
    fcState.spCorrect = isCorrect;
    fcState.spRevealed = true;
    fcState.spFlipped = true;

    // Update progress
    if (activeProfileId) {
        const existing = fcState.spProgress[w.word];
        const now = new Date().toISOString();

        const newStreak = isCorrect ? ((existing ? existing.correct_streak : 0) + 1) : 0;
        const totalAttempts = (existing ? existing.total_attempts : 0) + 1;
        const totalCorrect = (existing ? existing.total_correct : 0) + (isCorrect ? 1 : 0);
        const proficient = newStreak >= 3;

        const body = {
            student_id: activeProfileId,
            card_type: 'spelling',
            card_key: w.word,
            correct_streak: newStreak,
            total_attempts: totalAttempts,
            total_correct: totalCorrect,
            proficient: proficient,
            last_attempt_at: now
        };

        if (proficient && !(existing && existing.proficient)) {
            body.proficient_at = now;
        }

        const result = await upsertProgress(body);
        if (result && result[0]) {
            fcState.spProgress[w.word] = result[0];
        }
    }

    fcRender();
}

function fcNextSpelling() {
    const total = fcState.spWords.length;
    if (fcState.spIndex < total - 1) {
        fcState.spIndex++;
    } else {
        // Looped through all words
        fcState.spIndex = 0;
        toast('All words reviewed! Starting over.', 'success');
    }
    fcState.spRevealed = false;
    fcState.spCorrect = null;
    fcState.spInput = '';
    fcState.spFlipped = false;
    fcRender();
}


// =====================================================================
//   MULTIPLICATION VIEW
// =====================================================================
function fcBuildMultiplicationView() {
    let html = '';

    // Phase header
    html += fcBuildMulPhaseHeader();

    // Session stats
    html += fcBuildMulSessionStats();

    // Flashcard
    html += fcBuildMulCard();

    // Mastery grid
    html += fcBuildMulMasteryGrid();

    return html;
}

function fcBuildMulPhaseHeader() {
    const phase = fcState.mulPhase;
    const prog = fcState.mulProgress;

    // Calculate phase completions
    const p1Total = 144;
    const p1Done = fcCountPhaseProficient(1);
    const p1Pct = Math.round((p1Done / p1Total) * 100);

    const p2Unlocked = p1Done >= p1Total;
    const p2Total = fcCountPhaseTotal(2);
    const p2Done = p2Unlocked ? fcCountPhaseProficient(2) : 0;
    const p2Pct = p2Total > 0 ? Math.round((p2Done / p2Total) * 100) : 0;

    const p3Unlocked = p2Unlocked && p2Done >= p2Total;

    const phases = [
        { num: 1, label: '1-12 x 1-12', total: p1Total, done: p1Done, pct: p1Pct, unlocked: true, active: phase === 1 },
        { num: 2, label: '13-20 Range', total: p2Total, done: p2Done, pct: p2Pct, unlocked: p2Unlocked, active: phase === 2 },
        { num: 3, label: '2-Digit x 2-Digit', total: 0, done: 0, pct: 0, unlocked: p3Unlocked, active: phase === 3 }
    ];

    let html = '<div class="fc-phase-bar">';
    phases.forEach(p => {
        const lockIcon = !p.unlocked
            ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2.5" y="5.5" width="7" height="5" rx="1" stroke="currentColor" stroke-width="1"/><path d="M4 5.5V4a2 2 0 014 0v1.5" stroke="currentColor" stroke-width="1"/></svg>'
            : '';
        const canClick = p.unlocked ? `onclick="fcSetPhase(${p.num})"` : '';
        const cls = `fc-phase-chip ${p.active ? 'active' : ''} ${!p.unlocked ? 'locked' : ''}`;

        html += `
        <button class="${cls}" ${canClick} ${!p.unlocked ? 'disabled' : ''}>
            <span class="fc-phase-num">Phase ${p.num}</span>
            <span class="fc-phase-label">${p.label}</span>
            ${lockIcon}
            ${p.unlocked && p.num !== 3 ? `<span class="fc-phase-pct">${p.pct}%</span>` : ''}
        </button>`;
    });
    html += '</div>';

    // Progress bar for active phase (not phase 3)
    if (phase !== 3) {
        const active = phases[phase - 1];
        html += `
        <div class="fc-phase-progress">
            <div class="fc-progress-track">
                <div class="fc-progress-fill" style="width:${active.pct}%"></div>
            </div>
            <span class="fc-phase-progress-text">${active.done} of ${active.total} mastered (${active.pct}%)</span>
        </div>`;
    } else {
        html += `
        <div class="fc-phase-progress">
            <span class="fc-phase-progress-text" style="color:var(--deft-accent)">Infinite practice mode -- random 2-digit problems</span>
        </div>`;
    }

    return html;
}

function fcCountPhaseProficient(phase) {
    const prog = fcState.mulProgress;
    let count = 0;
    if (phase === 1) {
        for (let a = 1; a <= 12; a++) {
            for (let b = 1; b <= 12; b++) {
                if (prog[`${a}x${b}`] && prog[`${a}x${b}`].proficient) count++;
            }
        }
    } else if (phase === 2) {
        for (let a = 1; a <= 20; a++) {
            for (let b = 1; b <= 20; b++) {
                if (a >= 13 || b >= 13) {
                    if (prog[`${a}x${b}`] && prog[`${a}x${b}`].proficient) count++;
                }
            }
        }
    }
    return count;
}

function fcCountPhaseTotal(phase) {
    if (phase === 1) return 144;
    if (phase === 2) {
        // All combos where at least one factor >= 13, factors 1-20
        return 20 * 20 - 12 * 12; // 400 - 144 = 256
    }
    return 0;
}

function fcSetPhase(phase) {
    if (fcState.mulPhase === phase) return;
    fcStopMulTimer();
    fcState.mulPhase = phase;
    refreshFlashcards();
}

function fcBuildMulSessionStats() {
    const s = fcState;
    const accuracy = s.mulSessionAnswered > 0
        ? Math.round((s.mulSessionCorrect / s.mulSessionAnswered) * 100)
        : 0;

    return `
    <div class="fc-session-stats">
        <div class="fc-stat-chip">
            <div class="fc-stat-val">${s.mulSessionAnswered}</div>
            <div class="fc-stat-lbl">Answered</div>
        </div>
        <div class="fc-stat-chip">
            <div class="fc-stat-val">${accuracy}%</div>
            <div class="fc-stat-lbl">Accuracy</div>
        </div>
        <div class="fc-stat-chip">
            <div class="fc-stat-val">${s.mulSessionStreak}</div>
            <div class="fc-stat-lbl">Streak</div>
        </div>
        <div class="fc-stat-chip">
            <div class="fc-stat-val">${s.mulSessionBestStreak}</div>
            <div class="fc-stat-lbl">Best Streak</div>
        </div>
    </div>`;
}

function fcBuildMulCard() {
    const cur = fcState.mulCurrent;
    if (!cur) {
        return `<div class="fc-card-stage"><div class="fc-empty"><p>All problems mastered in this phase! Try the next phase.</p></div></div>`;
    }

    const revealed = fcState.mulRevealed;
    const correct = fcState.mulCorrect;
    const answer = cur.a * cur.b;

    // Timer display
    const timerHtml = `
    <div class="fc-timer" id="fc-mul-timer">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="var(--deft-accent)" stroke-width="1.2"/>
            <path d="M7 4.5V7l2 1.5" stroke="var(--deft-accent)" stroke-width="1.1" stroke-linecap="round"/>
        </svg>
        <span id="fc-timer-display">0.0s</span>
    </div>`;

    // Problem display
    let cardContent = '';
    if (!revealed) {
        cardContent = `
        <div class="fc-mul-problem">
            <span class="fc-mul-a">${cur.a}</span>
            <span class="fc-mul-op">&times;</span>
            <span class="fc-mul-b">${cur.b}</span>
            <span class="fc-mul-eq">=</span>
            <span class="fc-mul-q">?</span>
        </div>
        ${timerHtml}`;
    } else {
        if (correct) {
            const elapsed = fcState.mulElapsed;
            const timeStr = (elapsed / 1000).toFixed(1);
            cardContent = `
            <div class="fc-mul-result fc-result-correct">
                <div class="fc-mul-problem fc-mul-solved">
                    <span class="fc-mul-a">${cur.a}</span>
                    <span class="fc-mul-op">&times;</span>
                    <span class="fc-mul-b">${cur.b}</span>
                    <span class="fc-mul-eq">=</span>
                    <span class="fc-mul-answer-correct">${answer}</span>
                </div>
                <div class="fc-mul-time-badge">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="5.5" stroke="var(--deft-success)" stroke-width="1.2"/>
                        <path d="M7 4.5V7l2 1.5" stroke="var(--deft-success)" stroke-width="1.1" stroke-linecap="round"/>
                    </svg>
                    ${timeStr}s
                </div>
                <svg class="fc-checkmark-anim" width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" stroke="var(--deft-success)" stroke-width="2" fill="var(--deft-success)" fill-opacity="0.08"/>
                    <path class="fc-check-path" d="M14 24l7 7 13-13" stroke="var(--deft-success)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>`;
        } else {
            cardContent = `
            <div class="fc-mul-result fc-result-wrong">
                <div class="fc-mul-problem fc-mul-solved">
                    <span class="fc-mul-a">${cur.a}</span>
                    <span class="fc-mul-op">&times;</span>
                    <span class="fc-mul-b">${cur.b}</span>
                    <span class="fc-mul-eq">=</span>
                    <span class="fc-mul-answer-wrong">${escapeHtml(fcState.mulInput)}</span>
                </div>
                <div class="fc-mul-correct-answer">
                    <span>Correct answer:</span>
                    <strong>${answer}</strong>
                </div>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="var(--deft-danger)" stroke-width="2" fill="var(--deft-danger)" fill-opacity="0.08"/>
                    <path d="M14 14l12 12M26 14l-12 12" stroke="var(--deft-danger)" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
            </div>`;
        }
    }

    let inputArea = '';
    if (!revealed) {
        inputArea = `
        <div class="fc-input-area">
            <input id="fc-input" type="number" class="fc-text-input fc-num-input" placeholder="Answer"
                   autocomplete="off" inputmode="numeric"
                   onkeydown="if(event.key==='Enter')fcCheckMultiplication()" aria-label="Enter your answer">
            <button class="fc-check-btn" onclick="fcCheckMultiplication()">
                Check
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l4 4 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>`;
    } else {
        inputArea = `
        <div class="fc-input-area fc-input-row">
            ${!correct ? `<button class="fc-retry-btn" onclick="fcRetryMultiplication()">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7a5 5 0 019.2-2.6M12 7a5 5 0 01-9.2 2.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    <path d="M11 2v2.5h-2.5M3 12V9.5h2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Try Again
            </button>` : ''}
            <button class="fc-next-btn" onclick="fcNextMultiplication()">
                Next
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5.5 3L9.5 7l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>`;
    }

    return `
    <div class="fc-card-stage">
        <div class="fc-mul-card" id="fc-mul-card">
            ${cardContent}
        </div>
        ${inputArea}
    </div>`;
}


// ─── Multiplication Timer ───────────────────────────────────────────
function fcStartMulTimer() {
    fcStopMulTimer();
    fcState.mulTimerStart = performance.now();
    fcState.mulElapsed = 0;

    fcState.mulTimerId = setInterval(() => {
        fcState.mulElapsed = performance.now() - fcState.mulTimerStart;
        const display = document.getElementById('fc-timer-display');
        if (display) {
            display.textContent = (fcState.mulElapsed / 1000).toFixed(1) + 's';
        }
    }, 100);
}

function fcStopMulTimer() {
    if (fcState.mulTimerId) {
        clearInterval(fcState.mulTimerId);
        fcState.mulTimerId = null;
    }
    if (fcState.mulTimerStart) {
        fcState.mulElapsed = performance.now() - fcState.mulTimerStart;
    }
}


// ─── Multiplication Problem Selection ───────────────────────────────
function fcPickNextMultiplication() {
    const phase = fcState.mulPhase;
    const prog = fcState.mulProgress;

    // Phase 3: random 2-digit
    if (phase === 3) {
        const a = Math.floor(Math.random() * 90) + 10;
        const b = Math.floor(Math.random() * 90) + 10;
        fcState.mulCurrent = { a, b, key: `${a}x${b}` };
        return;
    }

    const problems = fcState.mulProblems;
    if (problems.length === 0) {
        fcState.mulCurrent = null;
        return;
    }

    // Categorize problems
    const unproficient = [];
    const recentlyProficient = [];
    const allProblems = [];

    problems.forEach(p => {
        const pr = prog[p.key];
        allProblems.push(p);

        if (!pr || !pr.proficient) {
            unproficient.push(p);
        } else {
            recentlyProficient.push(p);
        }
    });

    if (unproficient.length === 0 && recentlyProficient.length === 0) {
        fcState.mulCurrent = null;
        return;
    }

    const rand = Math.random();
    let pool;

    if (rand < 0.70 && unproficient.length > 0) {
        // 70%: pick unproficient, prioritize struggling
        pool = unproficient.sort((a, b) => {
            const pa = prog[a.key];
            const pb = prog[b.key];
            const attA = pa ? pa.total_attempts : 0;
            const attB = pb ? pb.total_attempts : 0;
            return attB - attA; // most attempts first
        });
        // Pick from top struggling third
        const topThird = Math.max(1, Math.ceil(pool.length / 3));
        fcState.mulCurrent = pool[Math.floor(Math.random() * topThird)];
    } else if (rand < 0.90 && recentlyProficient.length > 0) {
        // 20%: review recently proficient
        fcState.mulCurrent = recentlyProficient[Math.floor(Math.random() * recentlyProficient.length)];
    } else {
        // 10%: any problem
        fcState.mulCurrent = allProblems[Math.floor(Math.random() * allProblems.length)];
    }
}

async function fcCheckMultiplication() {
    const input = document.getElementById('fc-input');
    if (!input) return;

    const userAnswer = input.value.trim();
    if (userAnswer === '') {
        input.classList.add('fc-input-shake');
        setTimeout(() => input.classList.remove('fc-input-shake'), 400);
        return;
    }

    fcStopMulTimer();

    const cur = fcState.mulCurrent;
    const correctAnswer = cur.a * cur.b;
    const isCorrect = parseInt(userAnswer, 10) === correctAnswer;
    const timeMs = Math.round(fcState.mulElapsed);

    fcState.mulInput = userAnswer;
    fcState.mulCorrect = isCorrect;
    fcState.mulRevealed = true;

    // Session stats
    fcState.mulSessionAnswered++;
    if (isCorrect) {
        fcState.mulSessionCorrect++;
        fcState.mulSessionStreak++;
        if (fcState.mulSessionStreak > fcState.mulSessionBestStreak) {
            fcState.mulSessionBestStreak = fcState.mulSessionStreak;
        }
    } else {
        fcState.mulSessionStreak = 0;
    }

    // Update progress
    if (activeProfileId) {
        const existing = fcState.mulProgress[cur.key];
        const now = new Date().toISOString();

        const newStreak = isCorrect ? ((existing ? existing.correct_streak : 0) + 1) : 0;
        const totalAttempts = (existing ? existing.total_attempts : 0) + 1;
        const totalCorrect = (existing ? existing.total_correct : 0) + (isCorrect ? 1 : 0);

        // Compute avg_time_ms (running average)
        let avgTimeMs = timeMs;
        if (existing && existing.avg_time_ms && existing.total_attempts > 0) {
            avgTimeMs = Math.round(
                ((existing.avg_time_ms * existing.total_attempts) + timeMs) / totalAttempts
            );
        }

        // Best time
        let bestTimeMs = timeMs;
        if (isCorrect && existing && existing.best_time_ms) {
            bestTimeMs = Math.min(existing.best_time_ms, timeMs);
        } else if (!isCorrect && existing && existing.best_time_ms) {
            bestTimeMs = existing.best_time_ms;
        }

        // Proficiency: streak >= 3 AND avg_time < 5000ms
        const proficient = isCorrect && newStreak >= 3 && avgTimeMs < 5000;

        // If was proficient but answered wrong, reset
        const wasProficient = existing && existing.proficient;

        const body = {
            student_id: activeProfileId,
            card_type: 'multiplication',
            card_key: cur.key,
            correct_streak: newStreak,
            total_attempts: totalAttempts,
            total_correct: totalCorrect,
            best_time_ms: bestTimeMs,
            avg_time_ms: avgTimeMs,
            proficient: proficient,
            last_attempt_at: now
        };

        if (proficient && !wasProficient) {
            body.proficient_at = now;
        }

        const result = await upsertProgress(body);
        if (result && result[0]) {
            fcState.mulProgress[cur.key] = result[0];
        }
    }

    fcRender();
}

function fcRetryMultiplication() {
    fcState.mulRevealed = false;
    fcState.mulCorrect = null;
    fcState.mulInput = '';
    fcRender();
}

function fcNextMultiplication() {
    fcStopMulTimer();
    fcPickNextMultiplication();
    fcState.mulRevealed = false;
    fcState.mulCorrect = null;
    fcState.mulInput = '';
    fcRender();
}

function fcPracticeProblem(a, b) {
    fcStopMulTimer();
    fcState.mulCurrent = { a, b, key: `${a}x${b}` };
    fcState.mulRevealed = false;
    fcState.mulCorrect = null;
    fcState.mulInput = '';
    fcRender();

    // Scroll to card
    const card = document.querySelector('.fc-card-stage');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


// ─── Mastery Grid ───────────────────────────────────────────────────
function fcBuildMulMasteryGrid() {
    const phase = fcState.mulPhase;

    if (phase === 3) {
        return `
        <div class="fc-mastery-section">
            <h4 class="fc-section-title">Phase 3: Random Practice</h4>
            <p class="fc-section-desc">No mastery grid for Phase 3. Practice random 2-digit multiplication problems to sharpen your skills!</p>
        </div>`;
    }

    const prog = fcState.mulProgress;

    if (phase === 1) {
        return fcBuildGrid12x12(prog);
    } else {
        return fcBuildGridPhase2(prog);
    }
}

function fcBuildGrid12x12(prog) {
    let html = `
    <div class="fc-mastery-section">
        <h4 class="fc-section-title">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.1"/>
                <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.1"/>
                <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.1"/>
                <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.1"/>
            </svg>
            Mastery Grid
        </h4>
        <div class="fc-grid-legend">
            <span class="fc-legend-item"><span class="fc-legend-swatch fc-swatch-proficient"></span>Mastered</span>
            <span class="fc-legend-item"><span class="fc-legend-swatch fc-swatch-attempted"></span>In Progress</span>
            <span class="fc-legend-item"><span class="fc-legend-swatch fc-swatch-new"></span>Not Started</span>
        </div>
        <div class="fc-grid-scroll">
        <div class="fc-grid" style="grid-template-columns: 32px repeat(12, 1fr);">`;

    // Header row
    html += '<div class="fc-grid-corner">&times;</div>';
    for (let b = 1; b <= 12; b++) {
        html += `<div class="fc-grid-header">${b}</div>`;
    }

    // Data rows
    for (let a = 1; a <= 12; a++) {
        html += `<div class="fc-grid-row-header">${a}</div>`;
        for (let b = 1; b <= 12; b++) {
            const key = `${a}x${b}`;
            const p = prog[key];
            let cls = 'fc-cell-new';
            let title = `${a} x ${b} = ${a * b}`;

            if (p) {
                if (p.proficient) {
                    cls = 'fc-cell-proficient';
                    title += ` (Mastered - ${(p.avg_time_ms / 1000).toFixed(1)}s avg)`;
                } else {
                    cls = 'fc-cell-attempted';
                    title += ` (${p.total_correct}/${p.total_attempts} correct)`;
                }
            } else {
                title += ' (Not started)';
            }

            html += `<div class="fc-grid-cell ${cls}" onclick="fcPracticeProblem(${a},${b})" title="${title}" role="button" tabindex="0" aria-label="${title}"></div>`;
        }
    }

    html += '</div></div></div>';
    return html;
}

function fcBuildGridPhase2(prog) {
    // For phase 2, show a condensed view: rows 13-20, columns 1-20
    let html = `
    <div class="fc-mastery-section">
        <h4 class="fc-section-title">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.1"/>
                <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.1"/>
                <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.1"/>
                <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.1"/>
            </svg>
            Mastery Grid (13-20)
        </h4>
        <div class="fc-grid-legend">
            <span class="fc-legend-item"><span class="fc-legend-swatch fc-swatch-proficient"></span>Mastered</span>
            <span class="fc-legend-item"><span class="fc-legend-swatch fc-swatch-attempted"></span>In Progress</span>
            <span class="fc-legend-item"><span class="fc-legend-swatch fc-swatch-new"></span>Not Started</span>
        </div>
        <div class="fc-grid-scroll">
        <div class="fc-grid" style="grid-template-columns: 32px repeat(20, 1fr);">`;

    // Header row
    html += '<div class="fc-grid-corner">&times;</div>';
    for (let b = 1; b <= 20; b++) {
        html += `<div class="fc-grid-header">${b}</div>`;
    }

    // Rows 13-20
    for (let a = 13; a <= 20; a++) {
        html += `<div class="fc-grid-row-header">${a}</div>`;
        for (let b = 1; b <= 20; b++) {
            const key = `${a}x${b}`;
            const p = prog[key];
            let cls = 'fc-cell-new';
            let title = `${a} x ${b} = ${a * b}`;

            if (p) {
                if (p.proficient) {
                    cls = 'fc-cell-proficient';
                    title += ` (Mastered - ${(p.avg_time_ms / 1000).toFixed(1)}s avg)`;
                } else {
                    cls = 'fc-cell-attempted';
                    title += ` (${p.total_correct}/${p.total_attempts} correct)`;
                }
            } else {
                title += ' (Not started)';
            }

            html += `<div class="fc-grid-cell ${cls}" onclick="fcPracticeProblem(${a},${b})" title="${title}" role="button" tabindex="0" aria-label="${title}"></div>`;
        }
    }

    html += '</div></div>';

    // Also show rows 1-12 with columns 13-20 (the other half of phase 2)
    html += `
        <h4 class="fc-section-title" style="margin-top:1rem;">
            Rows 1-12 x Columns 13-20
        </h4>
        <div class="fc-grid-scroll">
        <div class="fc-grid" style="grid-template-columns: 32px repeat(8, 1fr);">`;

    html += '<div class="fc-grid-corner">&times;</div>';
    for (let b = 13; b <= 20; b++) {
        html += `<div class="fc-grid-header">${b}</div>`;
    }

    for (let a = 1; a <= 12; a++) {
        html += `<div class="fc-grid-row-header">${a}</div>`;
        for (let b = 13; b <= 20; b++) {
            const key = `${a}x${b}`;
            const p = prog[key];
            let cls = 'fc-cell-new';
            let title = `${a} x ${b} = ${a * b}`;

            if (p) {
                if (p.proficient) {
                    cls = 'fc-cell-proficient';
                    title += ` (Mastered - ${(p.avg_time_ms / 1000).toFixed(1)}s avg)`;
                } else {
                    cls = 'fc-cell-attempted';
                    title += ` (${p.total_correct}/${p.total_attempts} correct)`;
                }
            } else {
                title += ' (Not started)';
            }

            html += `<div class="fc-grid-cell ${cls}" onclick="fcPracticeProblem(${a},${b})" title="${title}" role="button" tabindex="0" aria-label="${title}"></div>`;
        }
    }

    html += '</div></div></div>';
    return html;
}


// =====================================================================
//   STYLE INJECTION
// =====================================================================
function injectFlashcardStyles() {
    if (document.getElementById('fc-styles')) return;
    const style = document.createElement('style');
    style.id = 'fc-styles';
    style.textContent = `
/* =====================================================================
   Flashcard Tab Styles
   ===================================================================== */

.fc-wrapper {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 2rem;
}

/* ── Loading ── */
.fc-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 3rem;
    color: var(--deft-txt-3);
    font-size: 13px;
}
.fc-spinner {
    width: 28px; height: 28px;
    border: 2.5px solid var(--deft-border);
    border-top-color: var(--deft-accent);
    border-radius: 50%;
    animation: fc-spin 0.8s linear infinite;
}
@keyframes fc-spin { to { transform: rotate(360deg); } }

/* ── Empty State ── */
.fc-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--deft-txt-3);
    font-size: 14px;
}

/* ── Mode Bar ── */
.fc-mode-bar {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: rgba(255,255,255,0.03);
    border-radius: 10px;
    border: 1px solid var(--deft-border);
}
.fc-mode-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    color: var(--deft-txt-3);
    background: transparent;
    border: none;
    transition: all 0.15s;
    font-family: var(--deft-body-font), sans-serif;
}
.fc-mode-btn:hover {
    color: var(--deft-txt-2);
    background: rgba(255,255,255,0.03);
}
.fc-mode-btn.active {
    color: var(--deft-accent);
    background: var(--deft-accent-dim, rgba(6,214,160,0.15));
}

/* ── Spelling Header ── */
.fc-sp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}
.fc-sp-header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.fc-title {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: var(--deft-txt);
    font-family: var(--deft-heading-font), sans-serif;
}
.fc-week-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.fc-week-badge {
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
.fc-week-badge.fc-week-current {
    background: var(--deft-accent-dim);
    color: var(--deft-accent);
    border-color: transparent;
}

/* Week nav */
.fc-week-nav {
    display: flex;
    align-items: center;
    gap: 4px;
}
.fc-nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border: 1px solid var(--deft-border);
    border-radius: 8px;
    background: var(--deft-surface-el);
    color: var(--deft-txt-2);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--deft-body-font), sans-serif;
}
.fc-nav-btn:hover:not(:disabled) {
    background: var(--deft-surface-hi);
    color: var(--deft-txt);
}
.fc-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}
.fc-week-select {
    padding: 5px 10px;
    border: 1px solid var(--deft-border);
    border-radius: 8px;
    background: var(--deft-surface-el);
    color: var(--deft-txt);
    font-size: 12px;
    font-family: var(--deft-body-font), sans-serif;
    cursor: pointer;
    outline: none;
}
.fc-week-select:focus {
    border-color: var(--deft-accent);
}

/* ── Mastery Bar (Spelling) ── */
.fc-mastery-bar {
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.fc-mastery-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.fc-mastery-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--deft-txt);
}
.fc-mastery-pct {
    font-size: 13px;
    font-weight: 700;
    color: var(--deft-accent);
    font-family: var(--deft-heading-font), sans-serif;
}
.fc-progress-track {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.06);
    overflow: hidden;
}
.fc-progress-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--deft-accent);
    transition: width 0.4s ease;
    min-width: 0;
}

/* Word chips */
.fc-word-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.fc-word-chip {
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
    font-family: var(--deft-body-font), sans-serif;
}
.fc-chip-done {
    background: var(--deft-success-dim, rgba(6,214,160,0.15));
    color: var(--deft-success);
    border-color: rgba(6,214,160,0.2);
}
.fc-chip-wip {
    background: var(--deft-warning-dim, rgba(255,217,61,0.15));
    color: var(--deft-warning);
    border-color: rgba(255,217,61,0.2);
}
.fc-chip-new {
    background: rgba(255,255,255,0.04);
    color: var(--deft-txt-3);
    border-color: var(--deft-border);
}
.fc-word-chip:hover {
    filter: brightness(1.15);
    transform: translateY(-1px);
}
.fc-word-chip.active {
    border-color: var(--deft-accent);
    background: var(--deft-accent-dim);
    color: var(--deft-accent);
}

/* ── Flashcard 3D ── */
.fc-card-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    perspective: 1200px;
}
.fc-card-3d {
    width: 100%;
    max-width: 520px;
    min-height: 240px;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.fc-card-3d.fc-card-flipped {
    transform: rotateY(180deg);
}
.fc-card-face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border-radius: 16px;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
}
.fc-card-front {
    z-index: 2;
}
.fc-card-back {
    transform: rotateY(180deg);
}

.fc-card-counter {
    position: absolute;
    top: 12px;
    left: 16px;
    font-size: 11px;
    font-weight: 600;
    color: var(--deft-txt-3);
    font-family: var(--deft-heading-font), sans-serif;
}

.fc-card-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    width: 100%;
}
.fc-definition {
    font-size: 20px;
    font-weight: 500;
    color: var(--deft-txt);
    line-height: 1.5;
    max-width: 420px;
}
.fc-example {
    font-size: 13px;
    color: var(--deft-txt-3);
    max-width: 380px;
    line-height: 1.5;
}
.fc-pos-badge {
    display: inline-flex;
    padding: 2px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: capitalize;
}

/* Speak button */
.fc-speak-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--deft-border);
    background: rgba(255,255,255,0.04);
    color: var(--deft-txt-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
}
.fc-speak-btn:hover {
    background: var(--deft-accent-dim);
    color: var(--deft-accent);
    border-color: var(--deft-accent);
}

/* ── Results ── */
.fc-result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
}
.fc-result-correct {
    color: var(--deft-success);
}
.fc-result-wrong {
    color: var(--deft-danger);
}
.fc-result-word {
    font-size: 28px;
    font-weight: 700;
    font-family: var(--deft-heading-font), sans-serif;
}
.fc-result-word-correct {
    color: var(--deft-success);
}
.fc-result-msg {
    font-size: 15px;
    font-weight: 600;
}
.fc-result-label {
    font-size: 11px;
    color: var(--deft-txt-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.fc-result-diff {
    font-size: 22px;
    font-weight: 600;
    font-family: 'IBM Plex Mono', monospace;
    letter-spacing: 2px;
}
.fc-diff-match {
    color: var(--deft-success);
}
.fc-diff-wrong {
    color: var(--deft-danger);
    text-decoration: line-through;
}
.fc-diff-missing {
    color: var(--deft-warning);
    opacity: 0.6;
}

/* ── Input Area ── */
.fc-input-area {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    max-width: 520px;
}
.fc-input-row {
    justify-content: center;
}
.fc-text-input {
    flex: 1;
    padding: 14px 18px;
    border-radius: 12px;
    background: var(--deft-surface);
    border: 2px solid var(--deft-border);
    color: var(--deft-txt);
    font-size: 18px;
    font-weight: 500;
    font-family: var(--deft-body-font), sans-serif;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    text-align: center;
    letter-spacing: 1px;
}
.fc-text-input:focus {
    border-color: var(--deft-accent);
    box-shadow: 0 0 0 3px var(--deft-accent-dim);
}
.fc-text-input::placeholder {
    color: var(--deft-txt-3);
    font-weight: 400;
}
.fc-num-input {
    max-width: 180px;
    font-size: 24px;
    font-weight: 700;
    font-family: var(--deft-heading-font), sans-serif;
    -moz-appearance: textfield;
}
.fc-num-input::-webkit-outer-spin-button,
.fc-num-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

/* Shake animation */
@keyframes fc-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
}
.fc-input-shake {
    animation: fc-shake 0.4s ease;
    border-color: var(--deft-danger) !important;
}

/* Buttons */
.fc-check-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 14px 24px;
    border-radius: 12px;
    background: var(--deft-accent);
    color: #000;
    font-size: 14px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--deft-body-font), sans-serif;
    white-space: nowrap;
}
.fc-check-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
}
.fc-next-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 12px 28px;
    border-radius: 12px;
    background: var(--deft-accent);
    color: #000;
    font-size: 14px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--deft-body-font), sans-serif;
}
.fc-next-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
}
.fc-retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 12px 20px;
    border-radius: 12px;
    background: rgba(255,255,255,0.06);
    color: var(--deft-txt-2);
    font-size: 14px;
    font-weight: 600;
    border: 1px solid var(--deft-border);
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--deft-body-font), sans-serif;
}
.fc-retry-btn:hover {
    background: rgba(255,255,255,0.1);
    color: var(--deft-txt);
}

/* ── Multiplication Card ── */
.fc-mul-card {
    width: 100%;
    max-width: 520px;
    min-height: 200px;
    border-radius: 16px;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    transition: border-color 0.3s;
}
.fc-mul-problem {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: var(--deft-heading-font), sans-serif;
}
.fc-mul-a, .fc-mul-b {
    font-size: 48px;
    font-weight: 700;
    color: var(--deft-txt);
}
.fc-mul-op {
    font-size: 32px;
    font-weight: 400;
    color: var(--deft-txt-3);
}
.fc-mul-eq {
    font-size: 32px;
    font-weight: 400;
    color: var(--deft-txt-3);
}
.fc-mul-q {
    font-size: 48px;
    font-weight: 700;
    color: var(--deft-accent);
    opacity: 0.6;
}
.fc-mul-solved .fc-mul-a,
.fc-mul-solved .fc-mul-b {
    font-size: 36px;
}
.fc-mul-solved .fc-mul-op,
.fc-mul-solved .fc-mul-eq {
    font-size: 24px;
}
.fc-mul-answer-correct {
    font-size: 36px;
    font-weight: 700;
    color: var(--deft-success);
    font-family: var(--deft-heading-font), sans-serif;
}
.fc-mul-answer-wrong {
    font-size: 36px;
    font-weight: 700;
    color: var(--deft-danger);
    font-family: var(--deft-heading-font), sans-serif;
    text-decoration: line-through;
}
.fc-mul-correct-answer {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--deft-txt-2);
}
.fc-mul-correct-answer strong {
    font-size: 22px;
    color: var(--deft-success);
    font-family: var(--deft-heading-font), sans-serif;
}

/* Timer */
.fc-timer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 14px;
    border-radius: 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--deft-border);
}
.fc-timer span {
    font-size: 16px;
    font-weight: 600;
    font-family: 'IBM Plex Mono', monospace;
    color: var(--deft-accent);
    min-width: 50px;
    text-align: center;
}

/* Time badge on correct answer */
.fc-mul-time-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 14px;
    border-radius: 8px;
    background: var(--deft-success-dim, rgba(6,214,160,0.12));
    font-size: 14px;
    font-weight: 600;
    color: var(--deft-success);
    font-family: 'IBM Plex Mono', monospace;
}

/* Checkmark animation */
.fc-checkmark-anim {
    margin-top: 4px;
}
.fc-check-path {
    stroke-dasharray: 50;
    stroke-dashoffset: 50;
    animation: fc-check-draw 0.5s ease forwards 0.2s;
}
@keyframes fc-check-draw {
    to { stroke-dashoffset: 0; }
}

/* Multiplication result sections */
.fc-mul-result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}

/* ── Phase Bar ── */
.fc-phase-bar {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.fc-phase-chip {
    flex: 1;
    min-width: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--deft-body-font), sans-serif;
    position: relative;
}
.fc-phase-chip:hover:not(:disabled) {
    background: var(--deft-surface-hi);
}
.fc-phase-chip.active {
    border-color: var(--deft-accent);
    background: var(--deft-accent-dim);
}
.fc-phase-chip.locked {
    opacity: 0.4;
    cursor: not-allowed;
}
.fc-phase-num {
    font-size: 11px;
    font-weight: 700;
    color: var(--deft-txt-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.fc-phase-chip.active .fc-phase-num {
    color: var(--deft-accent);
}
.fc-phase-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--deft-txt-2);
}
.fc-phase-chip.active .fc-phase-label {
    color: var(--deft-txt);
}
.fc-phase-pct {
    font-size: 11px;
    font-weight: 700;
    color: var(--deft-accent);
    font-family: var(--deft-heading-font), sans-serif;
}
.fc-phase-chip.locked .fc-phase-pct {
    display: none;
}

/* Phase progress */
.fc-phase-progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
}
.fc-phase-progress .fc-progress-track {
    width: 100%;
}
.fc-phase-progress-text {
    font-size: 12px;
    color: var(--deft-txt-3);
    font-weight: 500;
}

/* ── Session Stats ── */
.fc-session-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
}
.fc-stat-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 8px;
    border-radius: 10px;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
}
.fc-stat-val {
    font-size: 20px;
    font-weight: 700;
    color: var(--deft-txt);
    font-family: var(--deft-heading-font), sans-serif;
}
.fc-stat-lbl {
    font-size: 10px;
    font-weight: 600;
    color: var(--deft-txt-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* ── Mastery Grid ── */
.fc-mastery-section {
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.fc-section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--deft-txt);
    font-family: var(--deft-heading-font), sans-serif;
}
.fc-section-desc {
    font-size: 13px;
    color: var(--deft-txt-3);
    margin: 0;
}

.fc-grid-legend {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}
.fc-legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--deft-txt-3);
}
.fc-legend-swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
}
.fc-swatch-proficient {
    background: var(--deft-success);
}
.fc-swatch-attempted {
    background: var(--deft-warning);
}
.fc-swatch-new {
    background: rgba(255,255,255,0.08);
    border: 1px solid var(--deft-border);
}

.fc-grid-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 4px;
}
.fc-grid {
    display: grid;
    gap: 2px;
    min-width: max-content;
}
.fc-grid-corner {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    color: var(--deft-txt-3);
}
.fc-grid-header {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: var(--deft-txt-3);
    padding: 2px 0;
    font-family: var(--deft-heading-font), sans-serif;
}
.fc-grid-row-header {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: var(--deft-txt-3);
    font-family: var(--deft-heading-font), sans-serif;
}
.fc-grid-cell {
    width: 100%;
    aspect-ratio: 1;
    min-width: 20px;
    max-width: 36px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.12s;
    border: 1px solid transparent;
}
.fc-grid-cell:hover {
    transform: scale(1.3);
    z-index: 2;
    border-color: var(--deft-txt-2);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.fc-cell-proficient {
    background: var(--deft-success);
    opacity: 0.85;
}
.fc-cell-proficient:hover {
    opacity: 1;
}
.fc-cell-attempted {
    background: var(--deft-warning);
    opacity: 0.7;
}
.fc-cell-attempted:hover {
    opacity: 1;
}
.fc-cell-new {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.04);
}
.fc-cell-new:hover {
    background: rgba(255,255,255,0.12);
}

/* ── Responsive ── */
@media (max-width: 640px) {
    .fc-wrapper {
        gap: 0.75rem;
    }
    .fc-mode-btn {
        padding: 8px 10px;
        font-size: 12px;
    }
    .fc-sp-header {
        flex-direction: column;
        align-items: flex-start;
    }
    .fc-definition {
        font-size: 17px;
    }
    .fc-text-input {
        font-size: 16px;
        padding: 12px 14px;
    }
    .fc-check-btn, .fc-next-btn {
        padding: 12px 18px;
        font-size: 13px;
    }
    .fc-mul-a, .fc-mul-b {
        font-size: 36px;
    }
    .fc-mul-op, .fc-mul-eq {
        font-size: 24px;
    }
    .fc-mul-q {
        font-size: 36px;
    }
    .fc-session-stats {
        grid-template-columns: repeat(2, 1fr);
    }
    .fc-phase-bar {
        flex-direction: column;
    }
    .fc-phase-chip {
        min-width: unset;
        flex-direction: row;
        justify-content: center;
        gap: 8px;
    }
    .fc-card-3d {
        min-height: 200px;
    }
    .fc-card-face {
        padding: 20px 16px;
    }
    .fc-grid-cell {
        min-width: 18px;
    }
    .fc-result-word {
        font-size: 22px;
    }
    .fc-result-diff {
        font-size: 18px;
    }
}

@media (max-width: 380px) {
    .fc-mul-a, .fc-mul-b {
        font-size: 28px;
    }
    .fc-mul-op, .fc-mul-eq {
        font-size: 20px;
    }
    .fc-mul-q {
        font-size: 28px;
    }
    .fc-num-input {
        font-size: 20px;
    }
    .fc-grid-cell {
        min-width: 14px;
    }
}
`;
    document.head.appendChild(style);
}
