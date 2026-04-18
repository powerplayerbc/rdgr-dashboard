// =============================================
// Journal Daily View — Entry Loading, BRAIN Sidebar, Next Steps, Attachments
// =============================================

// =============================================
// MAIN ENTRY — called by switchView('daily')
// =============================================
async function loadDailyView() {
    if (!activeProfileId) return;

    // Save current entry if dirty before switching
    if (isDirty && quillEditor && currentEntry) {
        await saveEntry('autosave');
    }

    // Update date display
    renderDailyHeader();

    // Destroy old editor, create fresh one
    destroyQuillEditor();
    initQuillEditor();

    // Fetch entry for currentDate
    const entries = await supabaseSelect(
        'journal_entries',
        `user_id=eq.${activeProfileId}&entry_date=eq.${currentDate}&select=*`
    );

    if (entries && entries.length > 0) {
        currentEntry = entries[0];
        loadEntryIntoEditor(currentEntry);
    } else {
        currentEntry = null;
        isDirty = false;
        updateSaveIndicator('saved');
    }

    // Start autosave
    startAutoSave();

    // Initialize sticker canvas for daily view
    if (typeof initStickerCanvas === 'function') {
        initStickerCanvas('dailyStickerCanvas', 'daily');
    }

    // Load sidebar data (non-blocking)
    loadBrainActivities();
    loadNextSteps();
    loadAttachments();
    if (typeof loadStickers === 'function') loadStickers('daily');
}

// =============================================
// DAY NAVIGATION
// =============================================
async function navigateDay(delta) {
    // Save if dirty
    if (isDirty && quillEditor) {
        await saveEntry('autosave');
    }

    currentDate = addDays(currentDate, delta);
    loadDailyView();
}

function goToToday() {
    if (currentDate === getToday()) return;
    currentDate = getToday();
    loadDailyView();
}

// =============================================
// DAILY HEADER
// =============================================
function renderDailyHeader() {
    // Date label
    const label = document.getElementById('dailyDateLabel');
    if (label) label.textContent = formatDate(currentDate);

    // Today badge visibility
    const todayBadge = document.getElementById('dailyTodayBadge');
    if (todayBadge) {
        todayBadge.style.display = currentDate === getToday() ? '' : 'none';
    }

    // Render mood buttons
    renderMoodBar();
}

function renderMoodBar() {
    const bar = document.getElementById('moodBar');
    if (!bar) return;

    bar.innerHTML = MOOD_OPTIONS.map(function(m) {
        return `<button type="button"
            class="jed-mood-btn"
            data-mood="${m.slug}"
            onclick="selectMood('${m.slug}')"
            title="${m.label}"
            aria-label="Set mood to ${m.label}"
        >${m.emoji}</button>`;
    }).join('');
}

// =============================================
// BRAIN ACTIVITIES SIDEBAR
// =============================================
async function loadBrainActivities() {
    const container = document.getElementById('brainActivitiesList');
    if (!container) return;

    if (!activeProfileId) {
        container.innerHTML = '<div class="jday-empty">Select a profile to view activities.</div>';
        return;
    }

    // Calculate date boundaries
    const dayStart = currentDate + 'T00:00:00';
    const dayEnd = currentDate + 'T23:59:59.999';

    // Fetch BRAIN activities for this day
    const activities = await supabaseSelect(
        'brain_activities',
        `user_id=eq.${activeProfileId}&started_at=gte.${dayStart}&started_at=lte.${dayEnd}&select=activity_id,category_id,title,duration_min,points_earned,started_at&order=started_at.asc`
    );

    // Fetch journal-specific activity notes/hidden flags
    let journalActivities = [];
    if (currentEntry && currentEntry.entry_id) {
        const ja = await supabaseSelect(
            'journal_brain_activities',
            `entry_id=eq.${currentEntry.entry_id}&select=activity_id,user_note,is_hidden`
        );
        if (ja) journalActivities = ja;
    }

    // Build lookup for journal activity data
    const jaMap = {};
    journalActivities.forEach(function(ja) {
        jaMap[ja.activity_id] = ja;
    });

    if (!activities || activities.length === 0) {
        container.innerHTML = '<div class="jday-empty">No BRAIN activities recorded for this day.</div>';
        return;
    }

    // Category icons
    const catIcons = {
        work: '&#x1F4BC;', learning: '&#x1F4DA;', exercise: '&#x1F3CB;',
        creative: '&#x1F3A8;', social: '&#x1F465;', health: '&#x2764;',
        mindfulness: '&#x1F9D8;', reading: '&#x1F4D6;', coding: '&#x1F4BB;'
    };

    container.innerHTML = activities.map(function(a) {
        const ja = jaMap[a.activity_id] || {};
        if (ja.is_hidden) return '';

        const icon = catIcons[a.category_id] || '&#x2B50;';
        const time = new Date(a.started_at).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });
        const noteHtml = ja.user_note
            ? `<div class="jday-act-note">${escapeHtmlSafe(ja.user_note)}</div>`
            : '';

        return `<div class="jday-act-item" data-activity-id="${a.activity_id}">
            <div class="jday-act-header">
                <span class="jday-act-icon">${icon}</span>
                <div class="jday-act-info">
                    <span class="jday-act-title">${escapeHtmlSafe(a.title || 'Activity')}</span>
                    <span class="jday-act-meta">${time} &middot; ${a.duration_min || 0}min &middot; ${a.points_earned || 0}pts</span>
                </div>
                <div class="jday-act-actions">
                    <button type="button" class="jday-act-btn" onclick="addActivityNote('${a.activity_id}')" title="Add note" aria-label="Add note">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    </button>
                    <button type="button" class="jday-act-btn" onclick="toggleActivityHidden('${a.activity_id}')" title="Hide" aria-label="Hide activity">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 7s2.5-4 5.5-4 5.5 4 5.5 4-2.5 4-5.5 4S1.5 7 1.5 7z" stroke="currentColor" stroke-width="1"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" stroke-width="1"/><path d="M2 12L12 2" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>
            ${noteHtml}
        </div>`;
    }).filter(Boolean).join('');

    if (container.innerHTML.trim() === '') {
        container.innerHTML = '<div class="jday-empty">All activities hidden for this entry.</div>';
    }
}

async function addActivityNote(activityId) {
    const note = prompt('Add a note for this activity:');
    if (note === null) return;

    if (!currentEntry || !currentEntry.entry_id) {
        // Save entry first to get an entry_id
        const saved = await saveEntry('manual');
        if (!saved || !saved.entry_id) {
            toast('Save your entry first', 'error');
            return;
        }
    }

    const body = {
        entry_id: currentEntry.entry_id,
        activity_id: activityId,
        user_note: note.trim() || null
    };

    const result = await supabaseUpsert('journal_brain_activities', body, 'entry_id,activity_id');
    if (result) {
        toast('Note saved', 'success');
        loadBrainActivities();
    } else {
        toast('Failed to save note', 'error');
    }
}

async function toggleActivityHidden(activityId) {
    if (!currentEntry || !currentEntry.entry_id) {
        const saved = await saveEntry('manual');
        if (!saved || !saved.entry_id) {
            toast('Save your entry first', 'error');
            return;
        }
    }

    // Check current state
    const existing = await supabaseSelect(
        'journal_brain_activities',
        `entry_id=eq.${currentEntry.entry_id}&activity_id=eq.${activityId}&select=is_hidden`
    );

    const currentlyHidden = existing && existing.length > 0 ? existing[0].is_hidden : false;

    const body = {
        entry_id: currentEntry.entry_id,
        activity_id: activityId,
        is_hidden: !currentlyHidden
    };

    const result = await supabaseUpsert('journal_brain_activities', body, 'entry_id,activity_id');
    if (result) {
        toast(currentlyHidden ? 'Activity shown' : 'Activity hidden', 'success');
        loadBrainActivities();
    }
}

// =============================================
// NEXT STEPS
// =============================================
async function loadNextSteps() {
    const container = document.getElementById('nextStepsList');
    if (!container) return;

    if (!currentEntry || !currentEntry.entry_id) {
        container.innerHTML = renderNextStepsEmpty();
        return;
    }

    const steps = await supabaseSelect(
        'journal_next_steps',
        `entry_id=eq.${currentEntry.entry_id}&select=step_id,title,is_completed,completed_at,promoted_to,brain_task_id&order=created_at.asc`
    );

    if (!steps || steps.length === 0) {
        container.innerHTML = renderNextStepsEmpty();
        return;
    }

    let html = steps.map(function(s) {
        const checked = s.is_completed ? 'checked' : '';
        const completedClass = s.is_completed ? 'jday-step--done' : '';
        const promotedBadge = s.promoted_to
            ? `<span class="jday-step-badge">Promoted to ${escapeHtmlSafe(s.promoted_to)}</span>`
            : '';

        return `<div class="jday-step-item ${completedClass}">
            <label class="jday-step-check">
                <input type="checkbox" ${checked} onchange="toggleNextStep('${s.step_id}')" aria-label="Mark complete">
                <span class="jday-step-checkmark"></span>
            </label>
            <span class="jday-step-title">${escapeHtmlSafe(s.title)}</span>
            ${promotedBadge}
            <div class="jday-step-actions">
                ${!s.promoted_to ? `<button type="button" class="jday-step-btn" onclick="promoteNextStep('${s.step_id}')" title="Promote to BRAIN task" aria-label="Promote to BRAIN task">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 9V3M6 3l-3 3M6 3l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>` : ''}
                <button type="button" class="jday-step-btn jday-step-btn--del" onclick="deleteNextStep('${s.step_id}')" title="Delete" aria-label="Delete step">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </button>
            </div>
        </div>`;
    }).join('');

    // Add step form
    html += renderAddStepForm();

    container.innerHTML = html;
}

function renderNextStepsEmpty() {
    return `<div class="jday-empty">No next steps yet.</div>${renderAddStepForm()}`;
}

function renderAddStepForm() {
    return `<div class="jday-step-add">
        <input type="text" id="newStepInput"
            class="jday-step-input"
            placeholder="Add a next step..."
            onkeydown="if(event.key==='Enter'){event.preventDefault();addNextStep();}"
            aria-label="New next step"
        />
        <button type="button" class="jday-step-add-btn" onclick="addNextStep()" aria-label="Add step">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
    </div>`;
}

async function addNextStep() {
    const input = document.getElementById('newStepInput');
    if (!input) return;

    const title = input.value.trim();
    if (!title) return;

    // Ensure we have a saved entry
    if (!currentEntry || !currentEntry.entry_id) {
        const saved = await saveEntry('manual');
        if (!saved || !saved.entry_id) {
            toast('Save your entry first', 'error');
            return;
        }
    }

    const body = {
        entry_id: currentEntry.entry_id,
        user_id: activeProfileId,
        title: title,
        is_completed: false
    };

    const result = await supabaseWrite('journal_next_steps', 'POST', body);
    if (result) {
        input.value = '';
        toast('Step added', 'success');
        loadNextSteps();
    } else {
        toast('Failed to add step', 'error');
    }
}

async function toggleNextStep(stepId) {
    // Read current state
    const existing = await supabaseSelect(
        'journal_next_steps',
        `step_id=eq.${stepId}&select=is_completed`
    );

    if (!existing || existing.length === 0) return;

    const newCompleted = !existing[0].is_completed;
    const patchBody = {
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null
    };

    const result = await supabaseWrite('journal_next_steps', 'PATCH', patchBody, `step_id=eq.${stepId}`);
    if (result) {
        loadNextSteps();
    }
}

async function promoteNextStep(stepId) {
    // Fetch the step
    const steps = await supabaseSelect(
        'journal_next_steps',
        `step_id=eq.${stepId}&select=title`
    );

    if (!steps || steps.length === 0) return;

    const stepTitle = steps[0].title;

    // Create a BRAIN task (scheduled_date is required)
    const scheduledDate = currentDate || getToday();
    const taskBody = {
        user_id: activeProfileId,
        title: stepTitle,
        status: 'pending',
        scheduled_date: scheduledDate,
        original_date: scheduledDate,
        estimated_minutes: 30,
        heat_level: 0,
        points_earned: 0
    };

    const taskResult = await supabaseWrite('brain_tasks', 'POST', taskBody);
    if (!taskResult) {
        toast('Failed to create BRAIN task', 'error');
        return;
    }

    const task = Array.isArray(taskResult) ? taskResult[0] : taskResult;

    // Update the step with promotion info
    const patchBody = {
        promoted_to: 'brain_task',
        brain_task_id: task.task_id || task.id || null
    };

    await supabaseWrite('journal_next_steps', 'PATCH', patchBody, `step_id=eq.${stepId}`);

    toast('Promoted to BRAIN task!', 'success');
    loadNextSteps();
}

async function deleteNextStep(stepId) {
    if (!confirm('Delete this step?')) return;

    const result = await supabaseWrite('journal_next_steps', 'DELETE', null, `step_id=eq.${stepId}`);
    if (result !== null) {
        toast('Step deleted', 'success');
        loadNextSteps();
    } else {
        toast('Failed to delete step', 'error');
    }
}

// =============================================
// ATTACHMENTS
// =============================================
async function loadAttachments() {
    const container = document.getElementById('attachmentsList');
    if (!container) return;

    if (!currentEntry || !currentEntry.entry_id) {
        container.innerHTML = '<div class="jday-empty">Save your entry to add attachments.</div>';
        return;
    }

    const attachments = await supabaseSelect(
        'journal_attachments',
        `entry_id=eq.${currentEntry.entry_id}&select=attachment_id,file_name,mime_type,drive_url,thumbnail_url,file_size_bytes&order=created_at.asc`
    );

    if (!attachments || attachments.length === 0) {
        container.innerHTML = '<div class="jday-empty">No attachments yet.</div>';
        return;
    }

    container.innerHTML = `<div class="jday-attach-grid">${attachments.map(function(a) {
        const isImage = a.mime_type && a.mime_type.startsWith('image/');
        const thumbSrc = a.thumbnail_url || a.drive_url || '';
        const sizeStr = a.file_size_bytes ? formatFileSize(a.file_size_bytes) : '';

        if (isImage && thumbSrc) {
            return `<a href="${thumbSrc}" target="_blank" rel="noopener noreferrer" class="jday-attach-thumb" title="${escapeHtmlSafe(a.file_name || 'Image')}">
                <img src="${thumbSrc}" alt="${escapeHtmlSafe(a.file_name || 'Attachment')}" loading="lazy" />
                <span class="jday-attach-overlay">${escapeHtmlSafe(a.file_name || 'Image')}</span>
            </a>`;
        }

        return `<a href="${a.drive_url || '#'}" target="_blank" rel="noopener noreferrer" class="jday-attach-file" title="${escapeHtmlSafe(a.file_name || 'File')}">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="4" y="2" width="12" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 7h6M7 10h6M7 13h3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
            <span class="jday-attach-name">${escapeHtmlSafe(a.file_name || 'File')}</span>
            ${sizeStr ? `<span class="jday-attach-size">${sizeStr}</span>` : ''}
        </a>`;
    }).join('')}</div>`;
}

// =============================================
// STICKERS
// =============================================
async function loadEntryStickers() {
    const container = document.getElementById('entryStickers');
    if (!container) return;

    if (!currentEntry || !currentEntry.entry_id) {
        container.innerHTML = '';
        return;
    }

    const stickers = await supabaseSelect(
        'journal_stickers',
        `entry_id=eq.${currentEntry.entry_id}&select=sticker_slug&order=created_at.asc`
    );

    if (!stickers || stickers.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = stickers.map(function(s) {
        const sticker = STICKER_LIBRARY.find(function(st) { return st.slug === s.sticker_slug; });
        if (!sticker) return '';
        return `<span class="jday-sticker" title="${sticker.label}">${sticker.emoji}</span>`;
    }).filter(Boolean).join('');
}

// =============================================
// FAVORITE TOGGLE
// =============================================
async function toggleFavorite() {
    if (!currentEntry || !currentEntry.entry_id) {
        toast('Save your entry first', 'error');
        return;
    }

    const newVal = !currentEntry.is_favorite;
    const result = await supabaseWrite(
        'journal_entries', 'PATCH',
        { is_favorite: newVal },
        `entry_id=eq.${currentEntry.entry_id}`
    );

    if (result) {
        currentEntry.is_favorite = newVal;
        const btn = document.getElementById('favBtn');
        if (btn) {
            btn.classList.toggle('active', newVal);
            btn.title = newVal ? 'Remove from favorites' : 'Add to favorites';
        }
        toast(newVal ? 'Added to favorites' : 'Removed from favorites', 'success');
    }
}

// =============================================
// UTILITIES
// =============================================
function escapeHtmlSafe(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
}

// =============================================
// INJECTED STYLES
// =============================================
(function injectJournalDailyStyles() {
    if (document.getElementById('jday-styles')) return;
    var style = document.createElement('style');
    style.id = 'jday-styles';
    style.textContent = `
        /* ── Daily Header ── */
        .jday-nav {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }
        .jday-nav-btn {
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
        .jday-nav-btn:hover {
            background: rgba(255,255,255,0.06);
            color: var(--deft-txt, #E8ECF1);
            border-color: var(--deft-txt-3, #525E73);
        }
        .jday-nav-btn:focus-visible {
            outline: 2px solid var(--deft-accent, #06D6A0);
            outline-offset: 2px;
        }
        .jday-date-label {
            font-size: 0.95rem;
            font-weight: 600;
            color: var(--deft-txt, #E8ECF1);
            min-width: 200px;
            text-align: center;
        }
        .jday-today-badge {
            font-size: 0.6rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 0.1rem 0.4rem;
            border-radius: 9999px;
            background: rgba(6,214,160,0.12);
            color: var(--deft-accent, #06D6A0);
            margin-left: 0.5rem;
            vertical-align: middle;
        }

        /* ── Editor Toolbar Bar ── */
        .jday-toolbar-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
            flex-wrap: wrap;
        }
        .jday-toolbar-left {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex: 1;
            min-width: 0;
        }
        .jday-toolbar-right {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-shrink: 0;
        }
        .jday-title-input {
            flex: 1;
            min-width: 0;
            padding: 0.375rem 0.625rem;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--deft-txt, #E8ECF1);
            background: var(--deft-surface, #13151C);
            border: 1px solid var(--deft-border, #2A2E3D);
            border-radius: 0.375rem;
            outline: none;
            transition: border-color 0.15s;
        }
        .jday-title-input:focus {
            border-color: var(--deft-accent, #06D6A0);
        }
        .jday-title-input::placeholder {
            color: var(--deft-txt-3, #525E73);
        }

        /* ── Save / Fav Buttons ── */
        .jday-save-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.375rem 0.75rem;
            font-size: 0.75rem;
            font-weight: 600;
            border-radius: 0.375rem;
            border: none;
            background: var(--deft-accent, #06D6A0);
            color: #0D0F13;
            cursor: pointer;
            transition: opacity 0.15s;
        }
        .jday-save-btn:hover { opacity: 0.9; }
        .jday-save-btn:focus-visible {
            outline: 2px solid var(--deft-accent, #06D6A0);
            outline-offset: 2px;
        }

        .jday-fav-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 0.375rem;
            border: 1px solid var(--deft-border, #2A2E3D);
            background: transparent;
            color: var(--deft-txt-3, #525E73);
            font-size: 1rem;
            cursor: pointer;
            transition: color 0.15s, border-color 0.15s;
        }
        .jday-fav-btn:hover {
            color: #FBBF24;
            border-color: rgba(251,191,36,0.3);
        }
        .jday-fav-btn.active {
            color: #FBBF24;
            border-color: rgba(251,191,36,0.4);
        }

        /* ── Sidebar Sections ── */
        .jday-sidebar-section {
            margin-bottom: 1.25rem;
        }
        .jday-sidebar-header {
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--deft-txt-3, #525E73);
            margin-bottom: 0.5rem;
            padding-bottom: 0.375rem;
            border-bottom: 1px solid var(--deft-border, #2A2E3D);
        }

        /* ── BRAIN Activities ── */
        .jday-act-item {
            padding: 0.5rem 0.625rem;
            border-bottom: 1px solid var(--deft-border, #2A2E3D);
        }
        .jday-act-item:last-child { border-bottom: none; }
        .jday-act-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .jday-act-icon {
            font-size: 1rem;
            flex-shrink: 0;
        }
        .jday-act-info {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 0.125rem;
        }
        .jday-act-title {
            font-size: 0.8rem;
            font-weight: 500;
            color: var(--deft-txt, #E8ECF1);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .jday-act-meta {
            font-size: 0.65rem;
            color: var(--deft-txt-3, #525E73);
        }
        .jday-act-note {
            margin-top: 0.375rem;
            padding: 0.375rem 0.5rem;
            font-size: 0.75rem;
            color: var(--deft-txt-2, #8A95A9);
            background: rgba(255,255,255,0.02);
            border-left: 2px solid var(--deft-accent, #06D6A0);
            border-radius: 0 0.25rem 0.25rem 0;
            line-height: 1.4;
        }
        .jday-act-actions {
            display: flex;
            gap: 0.25rem;
            flex-shrink: 0;
        }
        .jday-act-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 0.25rem;
            border: none;
            background: transparent;
            color: var(--deft-txt-3, #525E73);
            cursor: pointer;
            transition: background 0.12s, color 0.12s;
        }
        .jday-act-btn:hover {
            background: rgba(255,255,255,0.06);
            color: var(--deft-txt-2, #8A95A9);
        }

        /* ── Next Steps ── */
        .jday-step-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.375rem 0.5rem;
            border-bottom: 1px solid var(--deft-border, #2A2E3D);
        }
        .jday-step-item:last-of-type { border-bottom: none; }
        .jday-step--done .jday-step-title {
            text-decoration: line-through;
            opacity: 0.5;
        }
        .jday-step-check {
            display: flex;
            align-items: center;
            cursor: pointer;
            flex-shrink: 0;
        }
        .jday-step-check input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: var(--deft-accent, #06D6A0);
            cursor: pointer;
        }
        .jday-step-title {
            flex: 1;
            font-size: 0.8rem;
            color: var(--deft-txt, #E8ECF1);
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .jday-step-badge {
            font-size: 0.55rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            padding: 0.1rem 0.35rem;
            border-radius: 9999px;
            background: rgba(6,214,160,0.12);
            color: var(--deft-accent, #06D6A0);
            white-space: nowrap;
            flex-shrink: 0;
        }
        .jday-step-actions {
            display: flex;
            gap: 0.25rem;
            flex-shrink: 0;
        }
        .jday-step-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: 0.25rem;
            border: none;
            background: transparent;
            color: var(--deft-txt-3, #525E73);
            cursor: pointer;
            transition: background 0.12s, color 0.12s;
        }
        .jday-step-btn:hover {
            background: rgba(255,255,255,0.06);
            color: var(--deft-txt-2, #8A95A9);
        }
        .jday-step-btn--del:hover {
            background: rgba(255,107,107,0.12);
            color: var(--deft-danger, #FF6B6B);
        }

        /* Add step form */
        .jday-step-add {
            display: flex;
            gap: 0.375rem;
            margin-top: 0.5rem;
            padding-top: 0.5rem;
        }
        .jday-step-input {
            flex: 1;
            padding: 0.375rem 0.625rem;
            font-size: 0.8rem;
            color: var(--deft-txt, #E8ECF1);
            background: var(--deft-surface, #13151C);
            border: 1px solid var(--deft-border, #2A2E3D);
            border-radius: 0.375rem;
            outline: none;
            transition: border-color 0.15s;
        }
        .jday-step-input:focus {
            border-color: var(--deft-accent, #06D6A0);
        }
        .jday-step-input::placeholder {
            color: var(--deft-txt-3, #525E73);
        }
        .jday-step-add-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 0.375rem;
            border: 1px solid var(--deft-border, #2A2E3D);
            background: transparent;
            color: var(--deft-accent, #06D6A0);
            cursor: pointer;
            transition: background 0.12s, border-color 0.12s;
        }
        .jday-step-add-btn:hover {
            background: rgba(6,214,160,0.08);
            border-color: var(--deft-accent, #06D6A0);
        }

        /* ── Attachments ── */
        .jday-attach-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 0.5rem;
        }
        .jday-attach-thumb {
            position: relative;
            display: block;
            border-radius: 0.375rem;
            overflow: hidden;
            border: 1px solid var(--deft-border, #2A2E3D);
            aspect-ratio: 1;
            transition: border-color 0.12s;
        }
        .jday-attach-thumb:hover {
            border-color: var(--deft-accent, #06D6A0);
        }
        .jday-attach-thumb img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .jday-attach-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 0.25rem 0.375rem;
            font-size: 0.6rem;
            color: #fff;
            background: rgba(0,0,0,0.6);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .jday-attach-file {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            padding: 0.75rem 0.5rem;
            border: 1px solid var(--deft-border, #2A2E3D);
            border-radius: 0.375rem;
            color: var(--deft-txt-2, #8A95A9);
            text-decoration: none;
            transition: border-color 0.12s, background 0.12s;
        }
        .jday-attach-file:hover {
            border-color: var(--deft-accent, #06D6A0);
            background: rgba(255,255,255,0.02);
        }
        .jday-attach-name {
            font-size: 0.65rem;
            text-align: center;
            word-break: break-all;
            color: var(--deft-txt, #E8ECF1);
        }
        .jday-attach-size {
            font-size: 0.55rem;
            color: var(--deft-txt-3, #525E73);
        }

        /* ── Stickers ── */
        #entryStickers {
            display: flex;
            gap: 0.25rem;
            flex-wrap: wrap;
            margin-bottom: 0.5rem;
        }
        .jday-sticker {
            font-size: 1.25rem;
            cursor: default;
        }

        /* ── Empty State ── */
        .jday-empty {
            padding: 1rem;
            text-align: center;
            font-size: 0.8rem;
            color: var(--deft-txt-3, #525E73);
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
            .jday-toolbar-bar {
                flex-direction: column;
                align-items: stretch;
            }
            .jday-toolbar-right {
                justify-content: space-between;
            }
            .jday-attach-grid {
                grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            }
        }
        @media (max-width: 640px) {
            .jday-date-label {
                font-size: 0.8rem;
                min-width: auto;
            }
            .jday-act-header {
                gap: 0.375rem;
            }
            .jday-step-item {
                gap: 0.375rem;
                padding: 0.25rem 0.375rem;
            }
        }
    `;
    document.head.appendChild(style);
})();
