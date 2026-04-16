// ═══════════════════════════════════════
// Tab: History Fact of the Day
// Daily Nevada history facts for Brianna's 4th-grade semester
// Semester: May 4 - July 11, 2026 (10 weeks, 50 facts)
// ═══════════════════════════════════════

const HISTORY_SEMESTER_START = '2026-05-04';
const HISTORY_SEMESTER_END = '2026-07-11';
const HISTORY_TOTAL_FACTS = 50;

// Navigable date state
let historyViewDate = null;
let historyWeekFacts = [];
let historyCurrentFact = null;
let historyAllFacts = null; // cache for preview

// Era color palette
const ERA_COLORS = {
    'Pre-Colonial':  { bg: '#92400E20', text: '#FBBF24', border: '#92400E' },
    'Colonial':      { bg: '#78350F20', text: '#F59E0B', border: '#78350F' },
    'Exploration':   { bg: '#7C3AED20', text: '#A78BFA', border: '#7C3AED' },
    '1800s':         { bg: '#B4540020', text: '#FB923C', border: '#B45400' },
    'Statehood':     { bg: '#06609020', text: '#06D6A0', border: '#066090' },
    'Mining Era':    { bg: '#CA840020', text: '#FCD34D', border: '#CA8400' },
    'Early 1900s':   { bg: '#1D4ED820', text: '#60A5FA', border: '#1D4ED8' },
    'Modern':        { bg: '#7C3AED20', text: '#C084FC', border: '#7C3AED' },
    'Contemporary':  { bg: '#0E766020', text: '#2DD4BF', border: '#0E7660' },
};

function getEraStyle(era) {
    return ERA_COLORS[era] || { bg: '#64748B20', text: '#94A3B8', border: '#64748B' };
}

// ═══════════════════════════════════════
// MAIN ENTRY -- called when History tab loads
// ═══════════════════════════════════════

async function refreshHistory() {
    const container = document.getElementById('history-container');
    if (!container) return;

    if (!historyViewDate) {
        historyViewDate = todayStr();
    }

    // Show loading skeleton
    container.innerHTML = buildHistorySkeletons();

    try {
        // Fetch today's scheduled fact, current week facts, and progress count in parallel
        const weekInfo = getWeekAndDay(historyViewDate);

        const [todayFacts, weekFacts, allPastFacts] = await Promise.all([
            supabaseSelect('school_history_facts',
                `scheduled_date=eq.${historyViewDate}&select=*&limit=1`
            ),
            weekInfo
                ? supabaseSelect('school_history_facts',
                    `week_number=eq.${weekInfo.week}&select=fact_id,title,scheduled_date,status,era,week_number,day_number&order=day_number`)
                : Promise.resolve([]),
            supabaseSelect('school_history_facts',
                `scheduled_date=lte.${todayStr()}&status=eq.published&select=fact_id&order=scheduled_date`)
        ]);

        historyCurrentFact = (todayFacts && todayFacts.length > 0) ? todayFacts[0] : null;
        // Parse any double-encoded JSONB fields
        if (historyCurrentFact) {
            ['key_figures', 'topic_tags', 'references_facts'].forEach(function(field) {
                if (typeof historyCurrentFact[field] === 'string') {
                    try { historyCurrentFact[field] = JSON.parse(historyCurrentFact[field]); } catch(e) { historyCurrentFact[field] = []; }
                }
            });
        }
        historyWeekFacts = weekFacts || [];
        const progressCount = allPastFacts ? allPastFacts.length : 0;

        container.innerHTML = buildHistoryLayout(historyCurrentFact, historyWeekFacts, progressCount, weekInfo);

    } catch (err) {
        console.error('refreshHistory error:', err);
        container.innerHTML = buildHistoryEmptyState('Something went wrong loading history facts.', 'error');
    }
}

// ═══════════════════════════════════════
// DATE / WEEK CALCULATIONS
// ═══════════════════════════════════════

function getWeekAndDay(dateStr) {
    const semesterStart = new Date(HISTORY_SEMESTER_START + 'T00:00:00');
    const target = new Date(dateStr + 'T00:00:00');
    const diffMs = target - semesterStart;
    if (diffMs < 0) return null;

    const diffDays = Math.floor(diffMs / 86400000);
    // Each week = 7 calendar days, but only weekdays count
    const calendarWeek = Math.floor(diffDays / 7);
    const dayOfWeek = target.getDay(); // 0=Sun, 1=Mon...6=Sat

    if (dayOfWeek === 0 || dayOfWeek === 6) return null; // Weekend
    if (calendarWeek >= 10) return null; // Past semester

    const week = calendarWeek + 1;
    const day = dayOfWeek; // 1=Mon through 5=Fri

    return { week: week, day: day };
}

function getWeekDateRange(weekNumber) {
    const start = new Date(HISTORY_SEMESTER_START + 'T00:00:00');
    start.setDate(start.getDate() + (weekNumber - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 4); // Friday = +4 from Monday

    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        startLabel: formatDate(start.toISOString().split('T')[0]),
        endLabel: formatDate(end.toISOString().split('T')[0])
    };
}

function isDateInPast(dateStr) {
    return dateStr <= todayStr();
}

function isDateToday(dateStr) {
    return dateStr === todayStr();
}

// ═══════════════════════════════════════
// LAYOUT BUILDER
// ═══════════════════════════════════════

function buildHistoryLayout(fact, weekFacts, progressCount, weekInfo) {
    const today = todayStr();
    const isFuture = historyViewDate > today;

    // Header with navigation
    let html = buildHistoryHeader(fact, weekInfo);

    // Progress bar
    html += buildHistoryProgress(progressCount);

    // Main content area: fact card + sidebar
    html += '<div style="display:flex;gap:24px;margin-top:20px;align-items:flex-start;">';

    // Main fact card (left, grows)
    html += '<div style="flex:1;min-width:0;">';
    if (isFuture) {
        html += buildHistoryEmptyState('This fact hasn\'t been revealed yet. Check back on ' + formatDate(historyViewDate) + '!', 'locked');
    } else if (!fact) {
        html += buildHistoryEmptyState(
            'No history fact scheduled for ' + formatDate(historyViewDate) + '.',
            'empty'
        );
        html += buildSemesterInfo();
    } else {
        html += buildFactCard(fact);
    }

    // Teacher controls
    html += buildTeacherControls(fact);

    html += '</div>'; // end main

    // Week timeline sidebar (right on desktop)
    html += buildWeekTimeline(weekFacts, weekInfo);

    html += '</div>'; // end flex layout

    return html;
}

// ═══════════════════════════════════════
// HEADER WITH NAVIGATION
// ═══════════════════════════════════════

function buildHistoryHeader(fact, weekInfo) {
    const dateLabel = formatDate(historyViewDate);
    const today = todayStr();
    const canGoNext = historyViewDate < today;
    const canGoPrev = historyViewDate > HISTORY_SEMESTER_START;

    const weekDayLabel = weekInfo
        ? '<span style="font-size:12px;color:var(--deft-txt-3);margin-left:8px;">Week ' + weekInfo.week + ', Day ' + weekInfo.day + '</span>'
        : '';

    const navBtnStyle = 'display:inline-flex;align-items:center;justify-content:center;' +
        'width:32px;height:32px;border-radius:8px;border:1px solid var(--deft-border);' +
        'background:var(--deft-surface-el);color:var(--deft-txt-2);cursor:pointer;' +
        'transition:background 0.15s,color 0.15s,border-color 0.15s;';

    const disabledStyle = 'opacity:0.3;cursor:not-allowed;pointer-events:none;';

    return `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
                <h2 style="margin:0;font-size:18px;font-weight:700;color:var(--deft-txt);
                           font-family:var(--deft-heading-font),sans-serif;display:flex;align-items:center;gap:8px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round" style="color:var(--deft-accent);flex-shrink:0;">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    History Fact of the Day
                </h2>
                <p style="margin:4px 0 0;font-size:13px;color:var(--deft-txt-3);
                          font-family:var(--deft-body-font),sans-serif;">
                    ${escapeHtml(dateLabel)}${weekDayLabel}
                </p>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                <button onclick="historyNavDay(-1)" aria-label="Previous day"
                        style="${navBtnStyle}${canGoPrev ? '' : disabledStyle}"
                        onmouseenter="if(!this.style.pointerEvents)this.style.background='rgba(255,255,255,0.06)'"
                        onmouseleave="this.style.background='var(--deft-surface-el)'">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M9 3L4 7l5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button onclick="historyGoToday()" aria-label="Go to today"
                        style="padding:4px 12px;border-radius:8px;border:1px solid var(--deft-border);
                               background:var(--deft-surface-el);color:var(--deft-txt-2);
                               font-size:12px;font-weight:600;cursor:pointer;
                               font-family:var(--deft-body-font),sans-serif;
                               transition:background 0.15s,color 0.15s;"
                        onmouseenter="this.style.background='rgba(255,255,255,0.06)';this.style.color='var(--deft-txt)'"
                        onmouseleave="this.style.background='var(--deft-surface-el)';this.style.color='var(--deft-txt-2)'">
                    Today
                </button>
                <button onclick="historyNavDay(1)" aria-label="Next day"
                        style="${navBtnStyle}${canGoNext ? '' : disabledStyle}"
                        onmouseenter="if(!this.style.pointerEvents)this.style.background='rgba(255,255,255,0.06)'"
                        onmouseleave="this.style.background='var(--deft-surface-el)'">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M5 3l5 4-5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════

function historyNavDay(delta) {
    const current = new Date(historyViewDate + 'T00:00:00');
    const today = todayStr();

    // Step forward/backward, skipping weekends
    let next = new Date(current);
    let step = 0;
    const direction = delta > 0 ? 1 : -1;
    const stepsNeeded = Math.abs(delta);

    while (step < stepsNeeded) {
        next.setDate(next.getDate() + direction);
        const dow = next.getDay();
        if (dow !== 0 && dow !== 6) step++;
        // Safety: don't loop more than 10 days
        if (Math.abs(next - current) > 864000000) break;
    }

    const nextStr = next.toISOString().split('T')[0];

    // Can't go into the future past today
    if (nextStr > today) return;
    // Can't go before semester start
    if (nextStr < HISTORY_SEMESTER_START) return;

    historyViewDate = nextStr;
    refreshHistory();
}

function historyGoToday() {
    historyViewDate = todayStr();
    refreshHistory();
}

function historyViewDay(dateStr) {
    if (dateStr > todayStr()) return; // Can't view future facts
    historyViewDate = dateStr;
    refreshHistory();
}

// ═══════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════

function buildHistoryProgress(count) {
    const pct = Math.min(100, Math.round((count / HISTORY_TOTAL_FACTS) * 100));
    const weekInfo = getWeekAndDay(todayStr());
    const currentWeekLabel = weekInfo ? 'Currently in Week ' + weekInfo.week : '';

    return `
        <div style="margin-top:16px;padding:14px 18px;border-radius:12px;
                    background:var(--deft-surface-el);border:1px solid var(--deft-border);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:13px;font-weight:600;color:var(--deft-txt);
                             font-family:var(--deft-body-font),sans-serif;">
                    ${count} of ${HISTORY_TOTAL_FACTS} facts explored
                </span>
                <span style="font-size:11px;color:var(--deft-txt-3);
                             font-family:var(--deft-body-font),sans-serif;">
                    ${currentWeekLabel}
                </span>
            </div>
            <div style="height:6px;border-radius:3px;background:var(--deft-surface);overflow:hidden;">
                <div style="height:100%;border-radius:3px;width:${pct}%;
                            background:var(--deft-accent);transition:width 0.4s ease;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:6px;">
                ${buildWeekTicks()}
            </div>
        </div>
    `;
}

function buildWeekTicks() {
    const weekInfo = getWeekAndDay(todayStr());
    const currentWeek = weekInfo ? weekInfo.week : 0;
    let html = '';
    for (let w = 1; w <= 10; w++) {
        const isActive = w <= currentWeek;
        const isCurrent = w === currentWeek;
        const color = isCurrent
            ? 'var(--deft-accent)'
            : (isActive ? 'var(--deft-txt-3)' : 'var(--deft-surface-hi)');
        const weight = isCurrent ? '700' : '400';
        html += '<span style="font-size:9px;color:' + color + ';font-weight:' + weight + ';' +
                'font-family:var(--deft-body-font),sans-serif;">W' + w + '</span>';
    }
    return html;
}

// ═══════════════════════════════════════
// TODAY'S FACT CARD
// ═══════════════════════════════════════

function buildFactCard(fact) {
    const eraStyle = getEraStyle(fact.era);
    const title = escapeHtml(fact.title || 'Untitled Fact');
    const mainFact = escapeHtml(fact.main_fact || '');
    const weekDay = fact.week_number && fact.day_number
        ? 'Week ' + fact.week_number + ', Day ' + fact.day_number
        : '';

    let html = `
        <div style="border-radius:14px;overflow:hidden;
                    background:var(--deft-surface-el);
                    border:1px solid var(--deft-border);
                    border-left:4px solid ${eraStyle.border};">

            <!-- Title area -->
            <div style="padding:24px 24px 16px;">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
                    <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;
                                 border-radius:20px;font-size:11px;font-weight:700;
                                 background:${eraStyle.bg};color:${eraStyle.text};
                                 text-transform:uppercase;letter-spacing:0.04em;
                                 font-family:var(--deft-body-font),sans-serif;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0;">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        ${escapeHtml(fact.era || 'Unknown Era')}
                    </span>
                    ${weekDay ? '<span style="font-size:11px;color:var(--deft-txt-3);font-family:var(--deft-body-font),sans-serif;">' + escapeHtml(weekDay) + '</span>' : ''}
                </div>
                <h3 style="margin:0;font-size:22px;font-weight:700;line-height:1.3;
                           color:var(--deft-txt);font-family:var(--deft-heading-font),sans-serif;">
                    ${title}
                </h3>
            </div>

            <!-- Main fact paragraph -->
            <div style="padding:0 24px 20px;">
                <p style="margin:0;font-size:15px;line-height:1.7;color:var(--deft-txt-2);
                          font-family:var(--deft-body-font),sans-serif;">
                    ${mainFact}
                </p>
            </div>
    `;

    // Supporting Details (expandable)
    if (fact.supporting_details) {
        html += buildExpandableSection(
            'Supporting Details',
            '<p style="margin:0;font-size:14px;line-height:1.65;color:var(--deft-txt-2);' +
            'font-family:var(--deft-body-font),sans-serif;">' +
            escapeHtml(fact.supporting_details) + '</p>',
            'details'
        );
    }

    // Key Figures
    if (fact.key_figures && fact.key_figures.length > 0) {
        html += buildKeyFiguresSection(fact.key_figures);
    }

    // Connections
    if (fact.connections) {
        html += buildConnectionsSection(fact.connections, fact.references_facts);
    }

    // Topic tags
    if (fact.topic_tags && fact.topic_tags.length > 0) {
        html += buildTopicTags(fact.topic_tags);
    }

    html += '</div>'; // end card

    return html;
}

// ═══════════════════════════════════════
// EXPANDABLE SECTION
// ═══════════════════════════════════════

function buildExpandableSection(title, contentHtml, sectionId) {
    const id = 'hist-expand-' + sectionId;
    return `
        <div style="border-top:1px solid var(--deft-border);">
            <button onclick="toggleHistorySection('${id}')" id="${id}-btn"
                    aria-expanded="false" aria-controls="${id}-body"
                    style="display:flex;align-items:center;justify-content:space-between;
                           width:100%;padding:14px 24px;border:none;background:transparent;
                           cursor:pointer;transition:background 0.15s;
                           font-family:var(--deft-body-font),sans-serif;"
                    onmouseenter="this.style.background='rgba(255,255,255,0.02)'"
                    onmouseleave="this.style.background='transparent'">
                <span style="font-size:13px;font-weight:600;color:var(--deft-txt);
                             display:flex;align-items:center;gap:8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--deft-accent)"
                         stroke-width="2" stroke-linecap="round">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    ${escapeHtml(title)}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                     id="${id}-chevron"
                     style="transition:transform 0.2s;color:var(--deft-txt-3);flex-shrink:0;">
                    <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5"
                          stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div id="${id}-body" style="max-height:0;overflow:hidden;transition:max-height 0.3s ease;">
                <div style="padding:0 24px 20px;">
                    ${contentHtml}
                </div>
            </div>
        </div>
    `;
}

function toggleHistorySection(id) {
    const body = document.getElementById(id + '-body');
    const chevron = document.getElementById(id + '-chevron');
    const btn = document.getElementById(id + '-btn');
    if (!body) return;

    const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';
    if (isOpen) {
        body.style.maxHeight = '0px';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        if (btn) btn.setAttribute('aria-expanded', 'false');
    } else {
        body.style.maxHeight = body.scrollHeight + 'px';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        if (btn) btn.setAttribute('aria-expanded', 'true');
    }
}

// ═══════════════════════════════════════
// KEY FIGURES SECTION
// ═══════════════════════════════════════

function buildKeyFiguresSection(figures) {
    const figuresHtml = figures.map(function(fig) {
        const initial = (fig.name || '?')[0].toUpperCase();
        const nameColor = getEraStyle(fig.era || '').text || 'var(--deft-accent)';

        return `
            <div style="display:flex;gap:12px;padding:14px;border-radius:10px;
                        background:var(--deft-surface);border:1px solid var(--deft-border);
                        transition:border-color 0.15s;"
                 onmouseenter="this.style.borderColor='var(--deft-txt-3)'"
                 onmouseleave="this.style.borderColor='var(--deft-border)'">
                <div style="width:38px;height:38px;border-radius:50%;flex-shrink:0;
                            display:flex;align-items:center;justify-content:center;
                            background:var(--deft-accent-dim);color:var(--deft-accent);
                            font-size:16px;font-weight:700;
                            font-family:var(--deft-heading-font),sans-serif;">
                    ${escapeHtml(initial)}
                </div>
                <div style="min-width:0;">
                    <div style="font-size:14px;font-weight:700;color:var(--deft-txt);
                                font-family:var(--deft-body-font),sans-serif;margin-bottom:2px;">
                        ${escapeHtml(fig.name || 'Unknown')}
                    </div>
                    <div style="font-size:12px;color:var(--deft-accent);font-weight:600;
                                margin-bottom:4px;font-family:var(--deft-body-font),sans-serif;">
                        ${escapeHtml(fig.role || '')}
                    </div>
                    <div style="font-size:12px;color:var(--deft-txt-3);line-height:1.5;
                                font-family:var(--deft-body-font),sans-serif;">
                        ${escapeHtml(fig.significance || '')}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div style="border-top:1px solid var(--deft-border);padding:20px 24px;">
            <h4 style="margin:0 0 14px;font-size:13px;font-weight:600;color:var(--deft-txt);
                       display:flex;align-items:center;gap:8px;
                       font-family:var(--deft-body-font),sans-serif;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--deft-accent)"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                    <path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
                Key Figures
            </h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">
                ${figuresHtml}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════
// CONNECTIONS SECTION
// ═══════════════════════════════════════

function buildConnectionsSection(connections, referencedFactIds) {
    return `
        <div style="border-top:1px solid var(--deft-border);padding:20px 24px;">
            <div style="border-radius:10px;padding:16px 18px;
                        background:rgba(56,189,248,0.06);
                        border:1px solid rgba(56,189,248,0.15);">
                <div style="display:flex;align-items:flex-start;gap:10px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38BDF8"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                         style="flex-shrink:0;margin-top:2px;">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                    </svg>
                    <div>
                        <div style="font-size:12px;font-weight:700;color:#93C5FD;
                                    text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;
                                    font-family:var(--deft-body-font),sans-serif;">
                            Connection to Earlier Lessons
                        </div>
                        <p style="margin:0;font-size:13px;line-height:1.6;color:#93C5FD;
                                  font-family:var(--deft-body-font),sans-serif;">
                            ${escapeHtml(connections)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════
// TOPIC TAGS
// ═══════════════════════════════════════

function buildTopicTags(tags) {
    const pillsHtml = tags.map(function(tag) {
        return '<span style="display:inline-block;padding:3px 10px;border-radius:20px;' +
            'font-size:11px;font-weight:500;color:var(--deft-txt-2);' +
            'background:rgba(255,255,255,0.04);border:1px solid var(--deft-border);' +
            'font-family:var(--deft-body-font),sans-serif;">' +
            escapeHtml(tag) + '</span>';
    }).join('');

    return `
        <div style="border-top:1px solid var(--deft-border);padding:16px 24px;">
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${pillsHtml}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════
// WEEK TIMELINE (sidebar)
// ═══════════════════════════════════════

function buildWeekTimeline(weekFacts, weekInfo) {
    if (!weekInfo) {
        return `
            <div class="hist-timeline" style="width:240px;flex-shrink:0;
                        padding:16px;border-radius:12px;
                        background:var(--deft-surface-el);border:1px solid var(--deft-border);">
                <div style="font-size:12px;color:var(--deft-txt-3);text-align:center;padding:20px 0;
                            font-family:var(--deft-body-font),sans-serif;">
                    Outside semester dates
                </div>
            </div>
        `;
    }

    const today = todayStr();
    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const weekRange = getWeekDateRange(weekInfo.week);

    // Build a lookup of day_number -> fact
    const factsByDay = {};
    weekFacts.forEach(function(f) {
        factsByDay[f.day_number] = f;
    });

    let daysHtml = '';
    for (let d = 1; d <= 5; d++) {
        const fact = factsByDay[d];
        const dayDate = getDayDate(weekInfo.week, d);
        const isPast = dayDate && dayDate < today;
        const isCurrent = dayDate && dayDate === historyViewDate;
        const isFuture = dayDate && dayDate > today;

        let borderColor = 'var(--deft-border)';
        let bg = 'transparent';
        let cursor = 'default';
        let opacity = '1';
        let onClick = '';

        if (isCurrent) {
            borderColor = 'var(--deft-accent)';
            bg = 'var(--deft-accent-dim)';
        } else if (isPast && fact) {
            cursor = 'pointer';
            onClick = ' onclick="historyViewDay(\'' + dayDate + '\')" tabindex="0" role="button"' +
                      ' onkeydown="if(event.key===\'Enter\')this.click()"';
        } else if (isFuture) {
            opacity = '0.4';
        }

        const statusIcon = isFuture
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--deft-txt-3)" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>'
            : (isPast && fact)
                ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;"><path d="M3 7l3 3 5-5" stroke="var(--deft-success)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                : '';

        const titleText = fact
            ? escapeHtml(fact.title || 'Untitled')
            : (isFuture ? 'Coming soon' : 'No fact');

        daysHtml += `
            <div style="padding:10px 12px;border-radius:8px;
                        border:1px solid ${borderColor};background:${bg};
                        opacity:${opacity};cursor:${cursor};
                        transition:border-color 0.15s,background 0.15s;"
                 ${onClick}
                 ${cursor === 'pointer' ? 'onmouseenter="this.style.borderColor=\'var(--deft-txt-3)\'"' +
                   ' onmouseleave="this.style.borderColor=\'var(--deft-border)\'"' : ''}
                 aria-label="${dayNames[d]}: ${titleText}">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                    <span style="font-size:11px;font-weight:600;color:${isCurrent ? 'var(--deft-accent)' : 'var(--deft-txt-2)'};
                                 font-family:var(--deft-body-font),sans-serif;">
                        ${dayNames[d]}
                    </span>
                    ${statusIcon}
                </div>
                <div style="font-size:12px;color:var(--deft-txt-3);line-height:1.4;
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                            font-family:var(--deft-body-font),sans-serif;">
                    ${titleText}
                </div>
            </div>
        `;
    }

    return `
        <div class="hist-timeline" style="width:240px;flex-shrink:0;
                    padding:16px;border-radius:12px;
                    background:var(--deft-surface-el);border:1px solid var(--deft-border);">
            <div style="font-size:12px;font-weight:700;color:var(--deft-txt);
                        text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;
                        font-family:var(--deft-body-font),sans-serif;">
                Week ${weekInfo.week}
            </div>
            <div style="font-size:11px;color:var(--deft-txt-3);margin-bottom:14px;
                        font-family:var(--deft-body-font),sans-serif;">
                ${escapeHtml(weekRange.startLabel)} - ${escapeHtml(weekRange.endLabel)}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
                ${daysHtml}
            </div>
        </div>
    `;
}

function getDayDate(weekNumber, dayOfWeek) {
    // dayOfWeek: 1=Mon, 2=Tue, etc.
    const start = new Date(HISTORY_SEMESTER_START + 'T00:00:00');
    start.setDate(start.getDate() + (weekNumber - 1) * 7 + (dayOfWeek - 1));
    return start.toISOString().split('T')[0];
}

// ═══════════════════════════════════════
// SEMESTER INFO (shown when no fact)
// ═══════════════════════════════════════

function buildSemesterInfo() {
    return `
        <div style="margin-top:16px;padding:16px 20px;border-radius:10px;
                    background:rgba(255,255,255,0.02);border:1px solid var(--deft-border);">
            <div style="font-size:13px;color:var(--deft-txt-2);line-height:1.6;
                        font-family:var(--deft-body-font),sans-serif;">
                <strong style="color:var(--deft-txt);">Nevada History Semester</strong><br>
                ${formatDate(HISTORY_SEMESTER_START)} through ${formatDate(HISTORY_SEMESTER_END)}<br>
                10 weeks, 50 daily facts (Monday - Friday)
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════
// TEACHER CONTROLS
// ═══════════════════════════════════════

function buildTeacherControls(fact) {
    if (!isTeacher()) return '';

    const editBtn = fact
        ? `<button onclick="openHistoryEditModal()"
                style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;
                       border-radius:8px;border:1px solid var(--deft-border);
                       background:var(--deft-surface-el);color:var(--deft-txt-2);
                       font-size:12px;font-weight:600;cursor:pointer;
                       font-family:var(--deft-body-font),sans-serif;
                       transition:background 0.15s,color 0.15s,border-color 0.15s;"
                onmouseenter="this.style.background='rgba(255,255,255,0.06)';this.style.color='var(--deft-txt)'"
                onmouseleave="this.style.background='var(--deft-surface-el)';this.style.color='var(--deft-txt-2)'">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Fact
            </button>`
        : '';

    return `
        <div data-role-min="admin" style="display:flex;align-items:center;gap:8px;margin-top:16px;flex-wrap:wrap;">
            <button onclick="generateHistoryFacts()"
                style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;
                       border-radius:8px;border:none;
                       background:var(--deft-accent);color:#0F1008;
                       font-size:12px;font-weight:600;cursor:pointer;
                       font-family:var(--deft-body-font),sans-serif;
                       transition:opacity 0.15s;"
                onmouseenter="this.style.opacity='0.85'"
                onmouseleave="this.style.opacity='1'">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.5" stroke-linecap="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Generate Facts
            </button>
            ${editBtn}
            <button onclick="previewAllHistoryFacts()"
                style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;
                       border-radius:8px;border:1px solid var(--deft-border);
                       background:var(--deft-surface-el);color:var(--deft-txt-2);
                       font-size:12px;font-weight:600;cursor:pointer;
                       font-family:var(--deft-body-font),sans-serif;
                       transition:background 0.15s,color 0.15s,border-color 0.15s;"
                onmouseenter="this.style.background='rgba(255,255,255,0.06)';this.style.color='var(--deft-txt)'"
                onmouseleave="this.style.background='var(--deft-surface-el)';this.style.color='var(--deft-txt-2)'">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
                Preview All
            </button>
        </div>
    `;
}

// ═══════════════════════════════════════
// GENERATE FACTS (Teacher)
// ═══════════════════════════════════════

async function generateHistoryFacts() {
    if (!isTeacher()) return;

    const btn = event.target.closest('button');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:1.5px;"></span> Generating...';

    try {
        const result = await schoolApi('generate_history_facts', {
            semester_start: HISTORY_SEMESTER_START,
            semester_end: HISTORY_SEMESTER_END,
            total_facts: HISTORY_TOTAL_FACTS
        }, { timeout: 120000 });

        if (result) {
            toast('History facts generated successfully');
            historyAllFacts = null; // bust cache
            await refreshHistory();
        }
    } catch (err) {
        console.error('Generate facts error:', err);
        toast('Failed to generate facts', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
}

// ═══════════════════════════════════════
// EDIT FACT MODAL (Teacher)
// ═══════════════════════════════════════

function openHistoryEditModal() {
    if (!historyCurrentFact || !isTeacher()) return;

    let modal = document.getElementById('modal-edit-history');
    if (!modal) {
        modal = buildHistoryEditModal();
        document.body.appendChild(modal);
    }

    // Populate fields
    const f = historyCurrentFact;
    const setVal = function(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };
    setVal('hist-edit-title', f.title);
    setVal('hist-edit-main', f.main_fact);
    setVal('hist-edit-details', f.supporting_details);
    setVal('hist-edit-era', f.era);
    setVal('hist-edit-connections', f.connections);
    setVal('hist-edit-tags', (f.topic_tags || []).join(', '));

    openModal('modal-edit-history');
}

function buildHistoryEditModal() {
    const backdrop = document.createElement('div');
    backdrop.id = 'modal-edit-history';
    backdrop.className = 'modal-backdrop';
    backdrop.onclick = function(e) {
        if (e.target === backdrop) closeModal('modal-edit-history');
    };

    backdrop.innerHTML = `
        <div class="modal-content" style="max-width:560px;">
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:1rem 1.25rem;border-bottom:1px solid var(--deft-border);">
                <h3 style="margin:0;font-size:15px;font-weight:600;color:var(--deft-txt);
                           font-family:var(--deft-heading-font),sans-serif;">
                    Edit History Fact
                </h3>
                <button onclick="closeModal('modal-edit-history')"
                        style="display:flex;align-items:center;justify-content:center;
                               width:28px;height:28px;border-radius:6px;border:none;
                               background:transparent;color:var(--deft-txt-3);cursor:pointer;
                               transition:background 0.12s,color 0.12s;"
                        onmouseenter="this.style.background='rgba(255,255,255,0.06)';this.style.color='var(--deft-txt)'"
                        onmouseleave="this.style.background='transparent';this.style.color='var(--deft-txt-3)'"
                        aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div style="padding:1rem 1.25rem;display:flex;flex-direction:column;gap:12px;">
                <div>
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--deft-txt-2);
                                  text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;
                                  font-family:var(--deft-body-font),sans-serif;">Title</label>
                    <input type="text" id="hist-edit-title" class="school-input">
                </div>
                <div>
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--deft-txt-2);
                                  text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;
                                  font-family:var(--deft-body-font),sans-serif;">Main Fact</label>
                    <textarea id="hist-edit-main" class="school-textarea" rows="4"></textarea>
                </div>
                <div>
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--deft-txt-2);
                                  text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;
                                  font-family:var(--deft-body-font),sans-serif;">Supporting Details</label>
                    <textarea id="hist-edit-details" class="school-textarea" rows="3"></textarea>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:var(--deft-txt-2);
                                      text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;
                                      font-family:var(--deft-body-font),sans-serif;">Era</label>
                        <input type="text" id="hist-edit-era" class="school-input" placeholder="e.g., 1800s">
                    </div>
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:var(--deft-txt-2);
                                      text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;
                                      font-family:var(--deft-body-font),sans-serif;">Topic Tags</label>
                        <input type="text" id="hist-edit-tags" class="school-input" placeholder="mining, geography">
                    </div>
                </div>
                <div>
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--deft-txt-2);
                                  text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;
                                  font-family:var(--deft-body-font),sans-serif;">Connections</label>
                    <textarea id="hist-edit-connections" class="school-textarea" rows="2"
                              placeholder="References to earlier lessons..."></textarea>
                </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;
                        padding:0.75rem 1.25rem;border-top:1px solid var(--deft-border);">
                <button onclick="closeModal('modal-edit-history')" class="btn btn-ghost">Cancel</button>
                <button onclick="saveHistoryEdit()" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `;

    return backdrop;
}

async function saveHistoryEdit() {
    if (!historyCurrentFact || !isTeacher()) return;

    const title = document.getElementById('hist-edit-title')?.value?.trim();
    const mainFact = document.getElementById('hist-edit-main')?.value?.trim();
    const details = document.getElementById('hist-edit-details')?.value?.trim();
    const era = document.getElementById('hist-edit-era')?.value?.trim();
    const connections = document.getElementById('hist-edit-connections')?.value?.trim();
    const tagsRaw = document.getElementById('hist-edit-tags')?.value?.trim();

    if (!title) { toast('Title is required', 'error'); return; }
    if (!mainFact) { toast('Main fact is required', 'error'); return; }

    const tags = tagsRaw
        ? tagsRaw.split(',').map(function(t) { return t.trim(); }).filter(Boolean)
        : [];

    const body = {
        title: title,
        main_fact: mainFact,
        supporting_details: details || null,
        era: era || null,
        connections: connections || null,
        topic_tags: tags.length > 0 ? tags : null,
        updated_at: new Date().toISOString()
    };

    const result = await supabaseWrite(
        'school_history_facts', 'PATCH', body,
        'fact_id=eq.' + historyCurrentFact.fact_id
    );

    if (result) {
        toast('Fact updated');
        closeModal('modal-edit-history');
        await refreshHistory();
    } else {
        toast('Failed to save changes', 'error');
    }
}

// ═══════════════════════════════════════
// PREVIEW ALL FACTS (Teacher)
// ═══════════════════════════════════════

async function previewAllHistoryFacts() {
    if (!isTeacher()) return;

    let modal = document.getElementById('modal-preview-history');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-preview-history';
        modal.className = 'modal-backdrop';
        modal.onclick = function(e) {
            if (e.target === modal) closeModal('modal-preview-history');
        };
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width:680px;max-height:85vh;display:flex;flex-direction:column;">
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:1rem 1.25rem;border-bottom:1px solid var(--deft-border);flex-shrink:0;">
                <h3 style="margin:0;font-size:15px;font-weight:600;color:var(--deft-txt);
                           font-family:var(--deft-heading-font),sans-serif;">
                    All 50 Facts -- Semester Preview
                </h3>
                <button onclick="closeModal('modal-preview-history')"
                        style="display:flex;align-items:center;justify-content:center;
                               width:28px;height:28px;border-radius:6px;border:none;
                               background:transparent;color:var(--deft-txt-3);cursor:pointer;
                               transition:background 0.12s,color 0.12s;"
                        onmouseenter="this.style.background='rgba(255,255,255,0.06)';this.style.color='var(--deft-txt)'"
                        onmouseleave="this.style.background='transparent';this.style.color='var(--deft-txt-3)'"
                        aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div style="padding:1rem 1.25rem;overflow-y:auto;flex:1;">
                <div style="text-align:center;padding:24px;"><span class="spinner"></span></div>
            </div>
        </div>
    `;

    openModal('modal-preview-history');

    // Fetch all facts
    if (!historyAllFacts) {
        historyAllFacts = await supabaseSelect('school_history_facts',
            'select=fact_id,title,scheduled_date,era,week_number,day_number,status,main_fact&order=week_number,day_number'
        );
    }

    const facts = historyAllFacts || [];
    const bodyEl = modal.querySelector('.modal-content > div:last-child');
    if (!bodyEl) return;

    if (facts.length === 0) {
        bodyEl.innerHTML = `
            <div style="text-align:center;padding:32px;color:var(--deft-txt-3);
                        font-size:13px;font-family:var(--deft-body-font),sans-serif;">
                No facts have been generated yet. Use "Generate Facts" to create all 50.
            </div>`;
        return;
    }

    // Group by week
    let currentWeek = 0;
    let html = '';

    facts.forEach(function(f) {
        if (f.week_number !== currentWeek) {
            if (currentWeek > 0) html += '</div>'; // close prev week group
            currentWeek = f.week_number;
            html += `
                <div style="font-size:12px;font-weight:700;color:var(--deft-accent);
                            text-transform:uppercase;letter-spacing:0.05em;
                            margin-top:${currentWeek > 1 ? '20px' : '0'};margin-bottom:8px;
                            padding-bottom:6px;border-bottom:1px solid var(--deft-border);
                            font-family:var(--deft-body-font),sans-serif;">
                    Week ${currentWeek}
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;">
            `;
        }

        const eraStyle = getEraStyle(f.era);
        const dateLabel = f.scheduled_date ? formatDate(f.scheduled_date) : '';
        const isPast = f.scheduled_date && f.scheduled_date <= todayStr();
        const statusDot = f.status === 'published'
            ? '<span style="width:6px;height:6px;border-radius:50%;background:var(--deft-success);flex-shrink:0;"></span>'
            : '<span style="width:6px;height:6px;border-radius:50%;background:var(--deft-txt-3);flex-shrink:0;opacity:0.4;"></span>';

        html += `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                        border-radius:6px;cursor:${isPast ? 'pointer' : 'default'};
                        transition:background 0.12s;"
                 ${isPast ? 'onclick="closeModal(\'modal-preview-history\');historyViewDay(\'' + f.scheduled_date + '\')"' : ''}
                 ${isPast ? 'onmouseenter="this.style.background=\'rgba(255,255,255,0.03)\'"' : ''}
                 ${isPast ? 'onmouseleave="this.style.background=\'transparent\'"' : ''}>
                ${statusDot}
                <span style="font-size:11px;color:var(--deft-txt-3);min-width:80px;
                             font-family:var(--deft-body-font),sans-serif;">
                    Day ${f.day_number || '?'} -- ${escapeHtml(dateLabel)}
                </span>
                <span style="font-size:12px;font-weight:500;color:var(--deft-txt);flex:1;
                             white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                             font-family:var(--deft-body-font),sans-serif;">
                    ${escapeHtml(f.title || 'Untitled')}
                </span>
                <span style="font-size:10px;padding:2px 6px;border-radius:10px;
                             background:${eraStyle.bg};color:${eraStyle.text};
                             font-weight:600;white-space:nowrap;flex-shrink:0;
                             font-family:var(--deft-body-font),sans-serif;">
                    ${escapeHtml(f.era || '')}
                </span>
            </div>
        `;
    });

    if (currentWeek > 0) html += '</div>'; // close last week group

    bodyEl.innerHTML = html;
}

// ═══════════════════════════════════════
// EMPTY / LOADING STATES
// ═══════════════════════════════════════

function buildHistoryEmptyState(message, type) {
    const icons = {
        empty: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        locked: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
        error: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
    };

    const iconColor = type === 'error' ? 'var(--deft-danger)' : 'var(--deft-txt-3)';

    return `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    padding:60px 24px;text-align:center;border-radius:14px;
                    background:var(--deft-surface-el);border:1px solid var(--deft-border);">
            <div style="color:${iconColor};margin-bottom:14px;opacity:0.5;">
                ${icons[type] || icons.empty}
            </div>
            <p style="margin:0;font-size:14px;line-height:1.6;max-width:360px;
                      color:var(--deft-txt-3);font-family:var(--deft-body-font),sans-serif;">
                ${escapeHtml(message)}
            </p>
        </div>
    `;
}

function buildHistorySkeletons() {
    return `
        <div style="margin-top:16px;">
            <!-- Progress skeleton -->
            <div style="padding:14px 18px;border-radius:12px;background:var(--deft-surface-el);
                        border:1px solid var(--deft-border);margin-bottom:20px;
                        animation:hist-skeleton-pulse 1.5s ease-in-out infinite;">
                <div style="height:14px;width:180px;border-radius:4px;background:var(--deft-surface-hi);margin-bottom:10px;"></div>
                <div style="height:6px;border-radius:3px;background:var(--deft-surface-hi);"></div>
            </div>
            <div style="display:flex;gap:24px;">
                <!-- Main card skeleton -->
                <div style="flex:1;border-radius:14px;background:var(--deft-surface-el);
                            border:1px solid var(--deft-border);padding:24px;
                            animation:hist-skeleton-pulse 1.5s ease-in-out infinite;">
                    <div style="height:20px;width:100px;border-radius:12px;background:var(--deft-surface-hi);margin-bottom:16px;"></div>
                    <div style="height:22px;width:280px;max-width:80%;border-radius:4px;background:var(--deft-surface-hi);margin-bottom:20px;"></div>
                    <div style="height:12px;width:100%;border-radius:4px;background:var(--deft-surface-hi);margin-bottom:8px;"></div>
                    <div style="height:12px;width:90%;border-radius:4px;background:var(--deft-surface-hi);margin-bottom:8px;"></div>
                    <div style="height:12px;width:70%;border-radius:4px;background:var(--deft-surface-hi);"></div>
                </div>
                <!-- Timeline skeleton -->
                <div class="hist-timeline" style="width:240px;flex-shrink:0;padding:16px;
                            border-radius:12px;background:var(--deft-surface-el);
                            border:1px solid var(--deft-border);
                            animation:hist-skeleton-pulse 1.5s ease-in-out infinite;">
                    <div style="height:12px;width:60px;border-radius:4px;background:var(--deft-surface-hi);margin-bottom:16px;"></div>
                    <div style="height:48px;border-radius:8px;background:var(--deft-surface-hi);margin-bottom:6px;"></div>
                    <div style="height:48px;border-radius:8px;background:var(--deft-surface-hi);margin-bottom:6px;"></div>
                    <div style="height:48px;border-radius:8px;background:var(--deft-surface-hi);margin-bottom:6px;"></div>
                    <div style="height:48px;border-radius:8px;background:var(--deft-surface-hi);margin-bottom:6px;"></div>
                    <div style="height:48px;border-radius:8px;background:var(--deft-surface-hi);"></div>
                </div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════
// INJECTED STYLES
// ═══════════════════════════════════════
(function injectHistoryStyles() {
    if (document.getElementById('hist-tab-styles')) return;
    const style = document.createElement('style');
    style.id = 'hist-tab-styles';
    style.textContent = `
        @keyframes hist-skeleton-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* Timeline goes horizontal on mobile */
        @media (max-width: 768px) {
            .hist-timeline {
                width: 100% !important;
                order: -1;
            }
            .hist-timeline > div:last-child {
                flex-direction: row !important;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                gap: 8px !important;
                padding-bottom: 4px;
            }
            .hist-timeline > div:last-child > div {
                min-width: 140px;
                flex-shrink: 0;
            }
        }
    `;
    document.head.appendChild(style);
})();
