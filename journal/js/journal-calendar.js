// =============================================
// Journal Calendar — Month Grid with Entry Indicators
// =============================================

const JCAL_MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
];
const JCAL_DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// =============================================
// MAIN ENTRY — called by switchView('calendar')
// =============================================
async function loadCalendar() {
    if (!activeProfileId) return;

    const container = document.getElementById('calendarGrid');
    if (!container) return;

    // Parse currentMonth (YYYY-MM)
    const parts = currentMonth.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;

    // Update month label
    const label = document.getElementById('calendarMonthLabel');
    if (label) label.textContent = `${JCAL_MONTH_NAMES[month]} ${year}`;

    // Fetch entry metadata for the month
    const firstDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const lastDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const entries = await supabaseSelect(
        'journal_entries',
        `user_id=eq.${activeProfileId}&entry_date=gte.${firstDate}&entry_date=lte.${lastDate}&select=entry_date,mood,is_favorite,word_count,title,content_text`
    );

    // Build lookup by date
    const entryMap = {};
    if (entries && Array.isArray(entries)) {
        entries.forEach(e => {
            if (e.entry_date) entryMap[e.entry_date] = e;
        });
    }

    // Get the 42-cell grid
    const dates = getMonthDates(currentMonth);
    const today = getToday();

    // Build HTML
    let html = '';

    // Weekday headers
    JCAL_DAY_NAMES.forEach(day => {
        html += `<div class="jcal-dow" role="columnheader">${day}</div>`;
    });

    // Day cells
    dates.forEach(cell => {
        const dayNum = parseInt(cell.date.split('-')[2]);
        const entryData = entryMap[cell.date] || null;
        const isToday = cell.date === today;
        html += renderCalendarDay(cell.date, dayNum, cell.inMonth, entryData, isToday);
    });

    container.innerHTML = html;

    // Initialize sticker canvas for monthly view
    if (typeof initStickerCanvas === 'function') {
        initStickerCanvas('calendarStickerCanvas', 'monthly');
    }
    if (typeof loadStickers === 'function') {
        loadStickers('monthly');
    }
    if (typeof applyMonthBackground === 'function') {
        applyMonthBackground();
    }
    applyMonthColors();
}

// =============================================
// NAVIGATION
// =============================================
function navigateMonth(delta) {
    const parts = currentMonth.split('-');
    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]) - 1;

    month += delta;
    if (month < 0) { month = 11; year--; }
    if (month > 11) { month = 0; year++; }

    currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    loadCalendar();
}

function calendarGoToday() {
    currentMonth = getToday().substring(0, 7);
    loadCalendar();
}

// =============================================
// MONTH COLOR CUSTOMIZATION
// =============================================
function getMonthColorsKey() {
    return 'journal-month-colors-' + (activeProfileId || 'default') + '-' + currentMonth;
}

function getMonthColors() {
    try {
        var saved = localStorage.getItem(getMonthColorsKey());
        return saved ? JSON.parse(saved) : null;
    } catch(e) { return null; }
}

function applyMonthColors() {
    var colors = getMonthColors();
    var wrapper = document.getElementById('calendarWrapper');
    if (!wrapper) return;

    if (colors) {
        wrapper.style.setProperty('--jcal-title-color', colors.title || '');
        wrapper.style.setProperty('--jcal-day-color', colors.day || '');
        wrapper.style.setProperty('--jcal-accent-color', colors.accent || '');
        wrapper.style.setProperty('--jcal-preview-color', colors.preview || '');
    } else {
        wrapper.style.removeProperty('--jcal-title-color');
        wrapper.style.removeProperty('--jcal-day-color');
        wrapper.style.removeProperty('--jcal-accent-color');
        wrapper.style.removeProperty('--jcal-preview-color');
    }
}

function openMonthCustomizer() {
    var colors = getMonthColors() || {};
    var parts = currentMonth.split('-');
    var monthName = JCAL_MONTH_NAMES[parseInt(parts[1]) - 1] + ' ' + parts[0];

    document.getElementById('monthCustomizerTitle').textContent = 'Customize ' + monthName;
    document.getElementById('monthTitleColor').value = colors.title || '#E8ECF1';
    document.getElementById('monthDayColor').value = colors.day || '#E8ECF1';
    document.getElementById('monthAccentColor').value = colors.accent || '#06D6A0';
    document.getElementById('monthPreviewColor').value = colors.preview || '#8A95A9';

    openModal('monthCustomizerModal');
}

function previewMonthColor() {
    var wrapper = document.getElementById('calendarWrapper');
    if (!wrapper) return;
    wrapper.style.setProperty('--jcal-title-color', document.getElementById('monthTitleColor').value);
    wrapper.style.setProperty('--jcal-day-color', document.getElementById('monthDayColor').value);
    wrapper.style.setProperty('--jcal-accent-color', document.getElementById('monthAccentColor').value);
    wrapper.style.setProperty('--jcal-preview-color', document.getElementById('monthPreviewColor').value);
}

function saveMonthColors() {
    var colors = {
        title: document.getElementById('monthTitleColor').value,
        day: document.getElementById('monthDayColor').value,
        accent: document.getElementById('monthAccentColor').value,
        preview: document.getElementById('monthPreviewColor').value
    };
    localStorage.setItem(getMonthColorsKey(), JSON.stringify(colors));
    applyMonthColors();
    closeModal('monthCustomizerModal');
    toast('Month colors saved');
}

function resetMonthColors() {
    localStorage.removeItem(getMonthColorsKey());
    applyMonthColors();
    document.getElementById('monthTitleColor').value = '#E8ECF1';
    document.getElementById('monthDayColor').value = '#E8ECF1';
    document.getElementById('monthAccentColor').value = '#06D6A0';
    document.getElementById('monthPreviewColor').value = '#8A95A9';
    previewMonthColor();
    toast('Month colors reset to defaults');
}

// =============================================
// DAY CELL RENDERING
// =============================================
function renderCalendarDay(dateStr, dayNum, inMonth, entryData, isToday) {
    // Base classes
    let cellClasses = 'jcal-cell';
    if (!inMonth) cellClasses += ' jcal-cell--outside';
    if (isToday) cellClasses += ' jcal-cell--today';
    if (entryData) cellClasses += ' jcal-cell--has-entry';

    // Outside-month cells are non-interactive
    if (!inMonth) {
        return `<div class="${cellClasses}" role="gridcell" aria-disabled="true">
            <span class="jcal-cell__num">${dayNum}</span>
        </div>`;
    }

    // Build indicators
    let indicatorsHtml = '';

    // Mood emoji
    if (entryData && entryData.mood) {
        const moodObj = MOOD_OPTIONS.find(m => m.slug === entryData.mood);
        if (moodObj) {
            indicatorsHtml += `<span class="jcal-mood" title="${moodObj.label}">${moodObj.emoji}</span>`;
        }
    }

    // Favorite star
    if (entryData && entryData.is_favorite) {
        indicatorsHtml += `<span class="jcal-fav" title="Favorite" aria-label="Favorite entry">&#9733;</span>`;
    }

    // Entry dot
    let dotHtml = '';
    if (entryData) {
        const wordCount = entryData.word_count || 0;
        // Dot size/opacity scales with word count
        let dotClass = 'jcal-dot';
        if (wordCount > 200) dotClass += ' jcal-dot--lg';
        else if (wordCount > 50) dotClass += ' jcal-dot--md';
        dotHtml = `<span class="${dotClass}" title="${wordCount} words"></span>`;
    }

    // Accessibility label
    let ariaLabel = `${JCAL_MONTH_NAMES[parseInt(dateStr.split('-')[1]) - 1]} ${dayNum}`;
    if (entryData) {
        ariaLabel += `, ${entryData.word_count || 0} words`;
        if (entryData.mood) ariaLabel += `, mood: ${entryData.mood}`;
        if (entryData.is_favorite) ariaLabel += ', favorited';
    }

    // Text preview (title + snippet of content)
    let previewHtml = '';
    if (entryData) {
        const title = entryData.title || '';
        const text = (entryData.content_text || '').replace(/\n/g, ' ').trim();
        let preview = '';
        if (title) preview = title;
        else if (text) preview = text;
        if (preview) {
            // Truncate to ~60 chars for the cell
            if (preview.length > 60) preview = preview.substring(0, 57) + '...';
            previewHtml = `<div class="jcal-preview">${preview.replace(/</g,'&lt;')}</div>`;
        }
    }

    return `<button type="button"
        class="${cellClasses}"
        role="gridcell"
        tabindex="0"
        aria-label="${ariaLabel}"
        onclick="openDailyView('${dateStr}')"
    >
        <span class="jcal-cell__num">${dayNum}</span>
        ${indicatorsHtml ? `<div class="jcal-indicators">${indicatorsHtml}</div>` : ''}
        ${previewHtml}
        ${dotHtml ? `<div class="jcal-dot-row">${dotHtml}</div>` : ''}
    </button>`;
}

// =============================================
// INJECTED STYLES
// =============================================
(function injectJournalCalendarStyles() {
    if (document.getElementById('jcal-styles')) return;
    const style = document.createElement('style');
    style.id = 'jcal-styles';
    style.textContent = `
        /* ── Calendar Navigation ── */
        .jcal-nav {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }
        .jcal-nav-btn {
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
        .jcal-nav-btn:hover {
            background: rgba(255,255,255,0.06);
            color: var(--deft-txt, #E8ECF1);
            border-color: var(--deft-txt-3, #525E73);
        }
        .jcal-nav-btn:focus-visible {
            outline: 2px solid var(--deft-accent, #06D6A0);
            outline-offset: 2px;
        }
        .jcal-month-label {
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
        .jcal-month-label:hover {
            background: rgba(255,255,255,0.04);
        }

        /* ── Calendar Grid ── */
        #calendarGrid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 1px;
            background: rgba(42, 46, 61, 0.3);
            border: 1px solid rgba(42, 46, 61, 0.3);
            border-radius: 0.5rem;
            overflow: hidden;
        }

        /* Month label (color customizable per month) */
        #calendarMonthLabel {
            color: var(--jcal-title-color, var(--deft-txt, #E8ECF1)) !important;
            text-shadow: 0 1px 4px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9);
        }

        /* Day-of-week headers */
        .jcal-dow {
            padding: 0.625rem 0.25rem;
            text-align: center;
            font-size: 0.8rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--jcal-day-color, var(--deft-txt, #E8ECF1));
            text-shadow: 0 1px 3px rgba(0,0,0,0.5);
            background: var(--journal-panel-bg, rgba(26,29,40,0.75));
            backdrop-filter: blur(var(--journal-panel-blur, 8px));
        }

        /* Text preview in cells */
        .jcal-preview {
            font-size: 0.55rem;
            line-height: 1.3;
            color: var(--jcal-preview-color, var(--deft-txt-2, #8A95A9));
            margin-top: 0.2rem;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            word-break: break-word;
        }

        /* Day cells */
        .jcal-cell {
            min-height: 90px;
            padding: 0.375rem;
            background: var(--journal-panel-bg, rgba(26,29,40,0.75));
            backdrop-filter: blur(var(--journal-panel-blur, 8px));
            border: 2px solid transparent;
            cursor: pointer;
            position: relative;
            display: flex;
            flex-direction: column;
            font-family: inherit;
            font-size: inherit;
            text-align: left;
            transition: background 0.12s, border-color 0.12s;
            -webkit-appearance: none;
            appearance: none;
            outline: none;
            width: 100%;
        }
        .jcal-cell:hover {
            background: var(--journal-panel-bg-hover, rgba(26,29,40,0.85));
        }
        .jcal-cell:focus-visible {
            border-color: var(--deft-accent, #06D6A0);
            box-shadow: inset 0 0 0 1px var(--deft-accent, #06D6A0);
        }

        /* Outside-month cells */
        .jcal-cell--outside {
            cursor: default;
            pointer-events: none;
        }
        .jcal-cell--outside .jcal-cell__num {
            opacity: 0.2;
        }
        .jcal-cell--outside:hover {
            background: var(--journal-panel-bg, rgba(26,29,40,0.75));
        }

        /* Today highlight */
        .jcal-cell--today {
            border-color: var(--jcal-accent-color, var(--deft-accent, #06D6A0));
        }
        .jcal-cell--today .jcal-cell__num {
            background: var(--jcal-accent-color, var(--deft-accent, #06D6A0));
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
        .jcal-cell__num {
            font-size: 0.7rem;
            font-weight: 500;
            color: var(--jcal-day-color, var(--deft-txt-2, #8A95A9));
            line-height: 1;
        }

        /* Indicators row (mood emoji, favorite star) */
        .jcal-indicators {
            display: flex;
            align-items: center;
            gap: 2px;
            margin-top: 0.25rem;
        }
        .jcal-mood {
            font-size: 0.85rem;
            line-height: 1;
        }
        .jcal-fav {
            font-size: 0.65rem;
            color: #FBBF24;
            line-height: 1;
        }

        /* Entry dot */
        .jcal-dot-row {
            margin-top: auto;
            display: flex;
            justify-content: center;
        }
        .jcal-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--jcal-accent-color, var(--deft-accent, #06D6A0));
            opacity: 0.5;
            display: inline-block;
        }
        .jcal-dot--md {
            opacity: 0.7;
            width: 7px;
            height: 7px;
        }
        .jcal-dot--lg {
            opacity: 1;
            width: 8px;
            height: 8px;
        }

        /* ── Responsive ── */
        @media (max-width: 640px) {
            .jcal-cell {
                min-height: 52px;
                padding: 0.25rem;
            }
            .jcal-cell__num {
                font-size: 0.6rem;
            }
            .jcal-mood {
                font-size: 0.7rem;
            }
            .jcal-fav {
                font-size: 0.55rem;
            }
            .jcal-dot {
                width: 5px;
                height: 5px;
            }
            .jcal-dow {
                font-size: 0.55rem;
                padding: 0.375rem 0.125rem;
            }
        }
    `;
    document.head.appendChild(style);
})();
