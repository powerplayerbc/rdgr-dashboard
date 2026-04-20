// =============================================
// Journal Print — 8.5x11" page rendering for daily + monthly views
// =============================================

function escapeHtmlPrint(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function moodDisplay(slug) {
    if (!slug || typeof MOOD_OPTIONS === 'undefined') return '';
    const m = MOOD_OPTIONS.find(function(x) { return x.slug === slug; });
    if (!m) return '';
    return m.emoji + ' ' + m.label;
}

function ensurePrintContainer() {
    let el = document.getElementById('printArea');
    if (el) el.remove();
    el = document.createElement('div');
    el.id = 'printArea';
    el.className = 'print-only';
    document.body.appendChild(el);
    return el;
}

function cleanupPrintContainer() {
    const el = document.getElementById('printArea');
    if (el) el.remove();
    window.removeEventListener('afterprint', cleanupPrintContainer);
}

async function buildEntryBlock(entry) {
    if (!entry) return '';

    const dateHeading = typeof formatDate === 'function' ? formatDate(entry.entry_date) : entry.entry_date;
    const title = entry.title ? escapeHtmlPrint(entry.title) : '';
    const mood = moodDisplay(entry.mood);
    const contentHtml = entry.content_html || '';

    let stepsHtml = '';
    if (entry.entry_id) {
        const steps = await supabaseSelect(
            'journal_next_steps',
            'entry_id=eq.' + entry.entry_id + '&select=title,is_completed&order=created_at.asc'
        );
        if (steps && steps.length > 0) {
            stepsHtml = '<h3>Next Steps</h3><ul>' + steps.map(function(s) {
                const mark = s.is_completed ? '[x]' : '[ ]';
                return '<li>' + mark + ' ' + escapeHtmlPrint(s.title) + '</li>';
            }).join('') + '</ul>';
        }
    }

    let attachHtml = '';
    if (entry.entry_id) {
        const atts = await supabaseSelect(
            'journal_attachments',
            'entry_id=eq.' + entry.entry_id + '&select=file_name,mime_type&order=created_at.asc'
        );
        if (atts && atts.length > 0) {
            attachHtml = '<h3>Attachments</h3><ul>' + atts.map(function(a) {
                return '<li>' + escapeHtmlPrint(a.file_name || 'file') + '</li>';
            }).join('') + '</ul>';
        }
    }

    return '<div class="print-page">' +
        '<h1>' + escapeHtmlPrint(dateHeading) + '</h1>' +
        (title ? '<div class="print-meta"><strong>' + title + '</strong></div>' : '') +
        (mood ? '<div class="print-meta">Mood: <span class="print-mood">' + escapeHtmlPrint(mood) + '</span></div>' : '') +
        '<div class="print-content">' + contentHtml + '</div>' +
        stepsHtml +
        attachHtml +
        '</div>';
}

function buildCalendarPage(yearMonth, entriesByDate) {
    const parts = yearMonth.split('-');
    const year = parseInt(parts[0]);
    const monthIdx = parseInt(parts[1]) - 1;
    const firstDay = new Date(year, monthIdx, 1);
    const lastDay = new Date(year, monthIdx + 1, 0);
    const monthLabel = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const startOffset = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = '<div class="print-page">';
    html += '<h1>' + escapeHtmlPrint(monthLabel) + '</h1>';
    html += '<table class="print-calendar">';
    html += '<thead><tr>' + dayHeaders.map(function(d) { return '<th>' + d + '</th>'; }).join('') + '</tr></thead>';
    html += '<tbody>';

    let day = 1;
    let cellIdx = 0;
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    html += '<tr>';
    for (let i = 0; i < totalCells; i++) {
        if (i > 0 && i % 7 === 0) html += '</tr><tr>';
        if (i < startOffset || day > daysInMonth) {
            html += '<td class="empty"></td>';
        } else {
            const dateStr = year + '-' + String(monthIdx + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            const entry = entriesByDate[dateStr];
            const moodSlug = entry && entry.mood;
            const moodObj = moodSlug && typeof MOOD_OPTIONS !== 'undefined' ? MOOD_OPTIONS.find(function(m) { return m.slug === moodSlug; }) : null;
            const moodEmoji = moodObj ? moodObj.emoji : '';
            const favMark = entry && entry.is_favorite ? ' &#9733;' : '';
            html += '<td>' +
                '<div class="day-num">' + day + favMark + '</div>' +
                (moodEmoji ? '<div class="day-mood">' + moodEmoji + '</div>' : '') +
                '</td>';
            day++;
        }
    }
    html += '</tr></tbody></table>';
    html += '</div>';
    return html;
}

async function printDaily() {
    if (typeof activeProfileId === 'undefined' || !activeProfileId) {
        if (typeof toast === 'function') toast('Please select a profile first', 'error');
        return;
    }
    if (typeof currentDate === 'undefined' || !currentDate) {
        if (typeof toast === 'function') toast('No date selected', 'error');
        return;
    }

    let entry = (typeof currentEntry !== 'undefined' && currentEntry) ? currentEntry : null;
    if (!entry) {
        const rows = await supabaseSelect(
            'journal_entries',
            'user_id=eq.' + activeProfileId + '&entry_date=eq.' + currentDate + '&select=*'
        );
        entry = (rows && rows.length > 0) ? rows[0] : { entry_date: currentDate };
    }

    const container = ensurePrintContainer();
    container.innerHTML = await buildEntryBlock(entry);

    window.addEventListener('afterprint', cleanupPrintContainer);
    window.print();
}

async function printMonth() {
    if (typeof activeProfileId === 'undefined' || !activeProfileId) {
        if (typeof toast === 'function') toast('Please select a profile first', 'error');
        return;
    }
    if (typeof currentMonth === 'undefined' || !currentMonth) {
        if (typeof toast === 'function') toast('No month selected', 'error');
        return;
    }

    const parts = currentMonth.split('-');
    const year = parts[0];
    const monthNum = parts[1];
    const firstOfMonth = year + '-' + monthNum + '-01';
    const nextMonthStart = (function() {
        const m = parseInt(monthNum);
        const y = parseInt(year);
        const nm = m === 12 ? 1 : m + 1;
        const ny = m === 12 ? y + 1 : y;
        return ny + '-' + String(nm).padStart(2, '0') + '-01';
    })();

    const entries = await supabaseSelect(
        'journal_entries',
        'user_id=eq.' + activeProfileId +
        '&entry_date=gte.' + firstOfMonth +
        '&entry_date=lt.' + nextMonthStart +
        '&select=*&order=entry_date.asc'
    );

    if (entries === null) {
        if (typeof toast === 'function') toast('Failed to load entries for print', 'error');
        return;
    }

    const entriesByDate = {};
    (entries || []).forEach(function(e) { entriesByDate[e.entry_date] = e; });

    const container = ensurePrintContainer();
    let html = buildCalendarPage(currentMonth, entriesByDate);

    for (let i = 0; i < (entries || []).length; i++) {
        html += await buildEntryBlock(entries[i]);
    }

    container.innerHTML = html;

    window.addEventListener('afterprint', cleanupPrintContainer);
    window.print();
}

window.printDaily = printDaily;
window.printMonth = printMonth;
