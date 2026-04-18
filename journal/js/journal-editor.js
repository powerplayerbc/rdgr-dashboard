// =============================================
// Journal Editor — Quill.js Integration, Save/Autosave, Versions
// =============================================

let _editorSaveKeyHandler = null;
let _editorBeforeUnloadHandler = null;

// =============================================
// QUILL INITIALIZATION
// =============================================
function initQuillEditor() {
    destroyQuillEditor();

    const container = document.getElementById('editorContainer');
    if (!container) { console.error('initQuillEditor: #editorContainer not found'); return; }

    // Clear container for fresh editor
    container.innerHTML = '';

    quillEditor = new Quill(container, {
        theme: 'snow',
        placeholder: 'Start writing...',
        modules: {
            toolbar: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
                ['blockquote', 'code-block'],
                ['link', 'image'],
                ['clean']
            ]
        }
    });

    // Text-change handler
    quillEditor.on('text-change', function() {
        isDirty = true;
        lastEditAt = Date.now();
        updateWordCount();
        updateSaveIndicator('unsaved');
    });

    // Ctrl+S save shortcut
    _editorSaveKeyHandler = function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveEntry('manual');
        }
    };
    document.addEventListener('keydown', _editorSaveKeyHandler);

    // Warn on unsaved changes before leaving
    _editorBeforeUnloadHandler = function(e) {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', _editorBeforeUnloadHandler);
}

// =============================================
// CLEANUP
// =============================================
function destroyQuillEditor() {
    // Stop autosave
    stopAutoSave();

    // Remove event listeners
    if (_editorSaveKeyHandler) {
        document.removeEventListener('keydown', _editorSaveKeyHandler);
        _editorSaveKeyHandler = null;
    }
    if (_editorBeforeUnloadHandler) {
        window.removeEventListener('beforeunload', _editorBeforeUnloadHandler);
        _editorBeforeUnloadHandler = null;
    }

    // Clear editor reference
    if (quillEditor) {
        quillEditor.off('text-change');
        quillEditor = null;
    }

    // Remove all Quill toolbar(s) that were inserted as siblings
    const container = document.getElementById('editorContainer');
    if (container) {
        const parent = container.parentNode;
        if (parent) {
            parent.querySelectorAll('.ql-toolbar').forEach(function(tb) { tb.remove(); });
        }
        container.innerHTML = '';
        container.className = '';
    }
}

// =============================================
// LOAD ENTRY INTO EDITOR
// =============================================
function loadEntryIntoEditor(entry) {
    if (!quillEditor || !entry) return;

    // Load content
    if (entry.content_json && entry.content_json.ops) {
        quillEditor.setContents(entry.content_json);
    } else if (entry.content_html) {
        quillEditor.root.innerHTML = '';
        quillEditor.clipboard.dangerouslyPasteHTML(0, entry.content_html);
    } else {
        quillEditor.setText('');
    }

    // Load title
    const titleInput = document.getElementById('entryTitle');
    if (titleInput) titleInput.value = entry.title || '';

    // Load mood
    const moodSelector = document.getElementById('moodSelector');
    if (moodSelector) moodSelector.value = entry.mood || '';

    // Update mood display buttons
    updateMoodSelection(entry.mood || '');

    // Update word count without marking dirty
    updateWordCount();

    // Reset dirty state after loading
    isDirty = false;
    updateSaveIndicator('saved');
}

// =============================================
// EXTRACT EDITOR DATA
// =============================================
function getEditorData() {
    if (!quillEditor) return null;

    const contentJson = quillEditor.getContents();
    const contentHtml = quillEditor.root.innerHTML;
    const contentText = quillEditor.getText();

    // Word count: split on whitespace, filter empty strings
    const words = contentText.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = contentText.trim().length === 0 ? 0 : words.length;

    return {
        content_json: contentJson,
        content_html: contentHtml,
        content_text: contentText,
        word_count: wordCount
    };
}

// =============================================
// SAVE ENTRY
// =============================================
async function saveEntry(source) {
    if (!source) source = 'manual';
    if (!activeProfileId) { toast('Please select a profile first', 'error'); return null; }
    if (!quillEditor) return null;

    updateSaveIndicator('saving');

    const editorData = getEditorData();
    if (!editorData) { updateSaveIndicator('unsaved'); return null; }

    // Get title and mood from UI
    const titleInput = document.getElementById('entryTitle');
    const title = titleInput ? titleInput.value.trim() : '';

    const selectedMood = getSelectedMood();

    // Build entry body
    const entryBody = {
        user_id: activeProfileId,
        entry_date: currentDate,
        content_json: editorData.content_json,
        content_html: editorData.content_html,
        content_text: editorData.content_text,
        word_count: editorData.word_count,
        mood: selectedMood || null,
        title: title || null,
        updated_at: new Date().toISOString()
    };

    // Upsert entry
    const result = await supabaseUpsert('journal_entries', entryBody, 'user_id,entry_date');

    if (!result || (Array.isArray(result) && result.length === 0)) {
        updateSaveIndicator('unsaved');
        if (source === 'manual') toast('Failed to save entry', 'error');
        return null;
    }

    // Extract entry record (upsert returns array)
    const savedEntry = Array.isArray(result) ? result[0] : result;

    // Update currentEntry reference
    if (savedEntry && savedEntry.entry_id) {
        currentEntry = savedEntry;
    }

    // Save version snapshot (non-blocking, best-effort)
    if (currentEntry && currentEntry.entry_id) {
        const versionBody = {
            entry_id: currentEntry.entry_id,
            user_id: activeProfileId,
            content_json: editorData.content_json,
            content_html: editorData.content_html,
            source: source,
            word_count: editorData.word_count
        };
        supabaseWrite('journal_versions', 'POST', versionBody).catch(function(err) {
            console.warn('Version snapshot failed:', err);
        });
    }

    // Update state
    lastSavedAt = Date.now();
    isDirty = false;
    updateSaveIndicator('saved');

    if (source === 'manual') toast('Entry saved', 'success');

    return savedEntry;
}

// =============================================
// AUTOSAVE
// =============================================
function startAutoSave() {
    stopAutoSave();
    autoSaveTimer = setInterval(function() {
        if (!isDirty) return;
        if (Date.now() - lastEditAt < AUTOSAVE_DEBOUNCE_MS) return;
        saveEntry('autosave');
    }, AUTOSAVE_INTERVAL_MS);
}

function stopAutoSave() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }
}

// =============================================
// SAVE INDICATOR
// =============================================
function updateSaveIndicator(status) {
    const el = document.getElementById('saveStatus');
    if (!el) return;

    switch (status) {
        case 'saved':
            el.textContent = 'Saved';
            el.style.color = 'var(--deft-success, #06D6A0)';
            break;
        case 'unsaved':
            el.textContent = 'Unsaved changes';
            el.style.color = 'var(--deft-warning, #FBBF24)';
            break;
        case 'saving':
            el.textContent = 'Saving...';
            el.style.color = 'var(--deft-txt-3, #525E73)';
            break;
        default:
            el.textContent = '';
    }
}

// =============================================
// WORD COUNT
// =============================================
function updateWordCount() {
    const el = document.getElementById('wordCount');
    if (!el || !quillEditor) return;

    const text = quillEditor.getText().trim();
    const count = text.length === 0 ? 0 : text.split(/\s+/).filter(w => w.length > 0).length;
    el.textContent = count + ' word' + (count !== 1 ? 's' : '');
}

// =============================================
// MOOD HELPERS
// =============================================
function getSelectedMood() {
    // Check for active mood button
    const activeBtn = document.querySelector('.jed-mood-btn.active');
    if (activeBtn) return activeBtn.dataset.mood || '';

    // Fallback to hidden select
    const sel = document.getElementById('moodSelector');
    return sel ? sel.value : '';
}

function selectMood(slug) {
    // Update buttons
    document.querySelectorAll('.jed-mood-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.mood === slug);
    });

    // Update hidden select
    const sel = document.getElementById('moodSelector');
    if (sel) sel.value = slug;

    // Mark dirty
    isDirty = true;
    lastEditAt = Date.now();
    updateSaveIndicator('unsaved');
}

function updateMoodSelection(slug) {
    document.querySelectorAll('.jed-mood-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.mood === slug);
    });
    const sel = document.getElementById('moodSelector');
    if (sel) sel.value = slug || '';
}

// =============================================
// VERSION HISTORY
// =============================================
async function loadVersionHistory() {
    if (!currentEntry || !currentEntry.entry_id) {
        const list = document.getElementById('versionHistoryList');
        if (list) list.innerHTML = '<div class="jed-empty">No version history available. Save your entry first.</div>';
        return;
    }

    const versions = await supabaseSelect(
        'journal_versions',
        `entry_id=eq.${currentEntry.entry_id}&select=version_id,created_at,source,word_count&order=created_at.desc&limit=50`
    );

    const list = document.getElementById('versionHistoryList');
    if (!list) return;

    if (!versions || versions.length === 0) {
        list.innerHTML = '<div class="jed-empty">No versions saved yet.</div>';
        return;
    }

    list.innerHTML = versions.map(function(v) {
        const ts = new Date(v.created_at);
        const timeStr = ts.toLocaleString('en-US', {
            month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
        const sourceBadge = v.source === 'autosave'
            ? '<span class="jed-ver-badge jed-ver-badge--auto">auto</span>'
            : '<span class="jed-ver-badge jed-ver-badge--manual">manual</span>';
        const words = v.word_count != null ? v.word_count + ' words' : '';

        return `<div class="jed-ver-item">
            <div class="jed-ver-meta">
                <span class="jed-ver-time">${timeStr}</span>
                ${sourceBadge}
                <span class="jed-ver-words">${words}</span>
            </div>
            <div class="jed-ver-actions">
                <button type="button" class="jed-ver-btn" onclick="previewVersion('${v.version_id}')" title="Preview this version">Preview</button>
                <button type="button" class="jed-ver-btn jed-ver-btn--restore" onclick="restoreVersion('${v.version_id}')" title="Restore this version">Restore</button>
            </div>
        </div>`;
    }).join('');
}

async function previewVersion(versionId) {
    const versions = await supabaseSelect(
        'journal_versions',
        `version_id=eq.${versionId}&select=content_html,content_json,word_count,source,created_at`
    );

    if (!versions || versions.length === 0) {
        toast('Version not found', 'error');
        return;
    }

    const v = versions[0];
    const preview = document.getElementById('versionPreviewContent');
    if (!preview) return;

    // Show content in preview area
    if (v.content_html) {
        preview.innerHTML = v.content_html;
    } else if (v.content_json && v.content_json.ops) {
        // Render delta to HTML via a temporary Quill instance
        const tempDiv = document.createElement('div');
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);
        const tempQuill = new Quill(tempDiv, { readOnly: true });
        tempQuill.setContents(v.content_json);
        preview.innerHTML = tempQuill.root.innerHTML;
        tempDiv.remove();
    } else {
        preview.innerHTML = '<em>No content in this version.</em>';
    }

    // Show meta
    const metaEl = document.getElementById('versionPreviewMeta');
    if (metaEl) {
        const ts = new Date(v.created_at);
        metaEl.textContent = `${ts.toLocaleString()} | ${v.source} | ${v.word_count || 0} words`;
    }

    // Show preview panel
    const panel = document.getElementById('versionPreviewPanel');
    if (panel) panel.style.display = '';
}

async function restoreVersion(versionId) {
    if (!confirm('Restore this version? Your current content will be replaced.')) return;

    const versions = await supabaseSelect(
        'journal_versions',
        `version_id=eq.${versionId}&select=content_json,content_html`
    );

    if (!versions || versions.length === 0) {
        toast('Version not found', 'error');
        return;
    }

    const v = versions[0];

    if (!quillEditor) {
        toast('Editor not initialized', 'error');
        return;
    }

    // Apply restored content
    if (v.content_json && v.content_json.ops) {
        quillEditor.setContents(v.content_json);
    } else if (v.content_html) {
        quillEditor.root.innerHTML = '';
        quillEditor.clipboard.dangerouslyPasteHTML(0, v.content_html);
    }

    // Mark dirty and save
    isDirty = true;
    lastEditAt = Date.now();
    updateWordCount();
    updateSaveIndicator('unsaved');

    await saveEntry('manual');
    toast('Version restored', 'success');

    // Close preview if open
    const panel = document.getElementById('versionPreviewPanel');
    if (panel) panel.style.display = 'none';
}

// =============================================
// INJECTED STYLES
// =============================================
(function injectJournalEditorStyles() {
    if (document.getElementById('jed-styles')) return;
    const style = document.createElement('style');
    style.id = 'jed-styles';
    style.textContent = `
        /* ── Quill Theme Overrides (Dark) ── */
        #editorContainer {
            min-height: 300px;
            color: var(--deft-txt, #E8ECF1);
            font-size: 0.9rem;
            line-height: 1.7;
        }
        #editorContainer .ql-editor {
            min-height: 280px;
            padding: 1rem 1.25rem;
            color: var(--deft-txt, #E8ECF1);
        }
        #editorContainer .ql-editor.ql-blank::before {
            color: var(--deft-txt-3, #525E73);
            font-style: italic;
        }
        #editorContainer .ql-toolbar.ql-snow {
            border: 1px solid var(--deft-border, #2A2E3D);
            border-radius: 0.5rem 0.5rem 0 0;
            background: var(--deft-surface, #13151C);
        }
        #editorContainer .ql-container.ql-snow {
            border: 1px solid var(--deft-border, #2A2E3D);
            border-top: none;
            border-radius: 0 0 0.5rem 0.5rem;
            background: var(--deft-surface-el, #1A1D28);
        }
        #editorContainer .ql-toolbar .ql-stroke {
            stroke: var(--deft-txt-2, #8A95A9);
        }
        #editorContainer .ql-toolbar .ql-fill {
            fill: var(--deft-txt-2, #8A95A9);
        }
        #editorContainer .ql-toolbar .ql-picker-label {
            color: var(--deft-txt-2, #8A95A9);
        }
        #editorContainer .ql-toolbar button:hover .ql-stroke,
        #editorContainer .ql-toolbar .ql-picker-label:hover .ql-stroke {
            stroke: var(--deft-txt, #E8ECF1);
        }
        #editorContainer .ql-toolbar button:hover .ql-fill {
            fill: var(--deft-txt, #E8ECF1);
        }
        #editorContainer .ql-toolbar button.ql-active .ql-stroke {
            stroke: var(--deft-accent, #06D6A0);
        }
        #editorContainer .ql-toolbar button.ql-active .ql-fill {
            fill: var(--deft-accent, #06D6A0);
        }
        #editorContainer .ql-toolbar .ql-picker-options {
            background: var(--deft-surface-el, #1A1D28);
            border-color: var(--deft-border, #2A2E3D);
        }
        #editorContainer .ql-toolbar .ql-picker-item {
            color: var(--deft-txt-2, #8A95A9);
        }
        #editorContainer .ql-toolbar .ql-picker-item:hover {
            color: var(--deft-txt, #E8ECF1);
        }
        #editorContainer .ql-snow .ql-tooltip {
            background: var(--deft-surface-el, #1A1D28);
            border-color: var(--deft-border, #2A2E3D);
            color: var(--deft-txt, #E8ECF1);
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        #editorContainer .ql-snow .ql-tooltip input[type="text"] {
            background: var(--deft-surface, #13151C);
            border-color: var(--deft-border, #2A2E3D);
            color: var(--deft-txt, #E8ECF1);
        }
        #editorContainer .ql-editor h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
        #editorContainer .ql-editor h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.4rem; }
        #editorContainer .ql-editor h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.3rem; }
        #editorContainer .ql-editor blockquote {
            border-left: 3px solid var(--deft-accent, #06D6A0);
            padding-left: 0.75rem;
            color: var(--deft-txt-2, #8A95A9);
        }
        #editorContainer .ql-editor pre.ql-syntax {
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--deft-border, #2A2E3D);
            border-radius: 0.375rem;
            padding: 0.75rem;
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 0.8rem;
            color: var(--deft-txt-2, #8A95A9);
        }
        #editorContainer .ql-editor a {
            color: var(--deft-accent, #06D6A0);
        }
        #editorContainer .ql-editor li[data-list="checked"] > .ql-ui::before {
            color: var(--deft-accent, #06D6A0);
        }

        /* ── Save Indicator ── */
        #saveStatus {
            font-size: 0.7rem;
            font-weight: 500;
            transition: color 0.2s;
        }

        /* ── Word Count ── */
        #wordCount {
            font-size: 0.7rem;
            color: var(--jday-section-color, var(--deft-txt-2, #8A95A9));
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            font-variant-numeric: tabular-nums;
        }

        /* ── Mood Buttons ── */
        .jed-mood-bar {
            display: flex;
            gap: 0.25rem;
            flex-wrap: wrap;
        }
        .jed-mood-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 0.375rem;
            border: 1px solid var(--deft-border, #2A2E3D);
            background: var(--deft-surface, #13151C);
            font-size: 1rem;
            cursor: pointer;
            transition: border-color 0.15s, background 0.15s, transform 0.1s;
        }
        .jed-mood-btn:hover {
            border-color: var(--deft-txt-3, #525E73);
            background: rgba(255,255,255,0.04);
            transform: scale(1.1);
        }
        .jed-mood-btn.active {
            border-color: var(--deft-accent, #06D6A0);
            background: rgba(6,214,160,0.1);
        }
        .jed-mood-btn:focus-visible {
            outline: 2px solid var(--deft-accent, #06D6A0);
            outline-offset: 2px;
        }

        /* ── Version History ── */
        .jed-ver-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.5rem 0.625rem;
            border-bottom: 1px solid var(--deft-border, #2A2E3D);
            gap: 0.5rem;
        }
        .jed-ver-item:last-child {
            border-bottom: none;
        }
        .jed-ver-meta {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
            min-width: 0;
        }
        .jed-ver-time {
            font-size: 0.75rem;
            color: var(--deft-txt-2, #8A95A9);
            white-space: nowrap;
        }
        .jed-ver-badge {
            font-size: 0.6rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 0.1rem 0.4rem;
            border-radius: 9999px;
        }
        .jed-ver-badge--auto {
            background: rgba(251,191,36,0.12);
            color: #FBBF24;
        }
        .jed-ver-badge--manual {
            background: rgba(6,214,160,0.12);
            color: #06D6A0;
        }
        .jed-ver-words {
            font-size: 0.65rem;
            color: var(--deft-txt-3, #525E73);
            font-variant-numeric: tabular-nums;
        }
        .jed-ver-actions {
            display: flex;
            gap: 0.375rem;
            flex-shrink: 0;
        }
        .jed-ver-btn {
            font-size: 0.65rem;
            font-weight: 500;
            padding: 0.2rem 0.5rem;
            border-radius: 0.25rem;
            border: 1px solid var(--deft-border, #2A2E3D);
            background: transparent;
            color: var(--deft-txt-2, #8A95A9);
            cursor: pointer;
            transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .jed-ver-btn:hover {
            background: rgba(255,255,255,0.04);
            color: var(--deft-txt, #E8ECF1);
            border-color: var(--deft-txt-3, #525E73);
        }
        .jed-ver-btn--restore {
            color: var(--deft-accent, #06D6A0);
            border-color: rgba(6,214,160,0.3);
        }
        .jed-ver-btn--restore:hover {
            background: rgba(6,214,160,0.1);
            color: var(--deft-accent, #06D6A0);
            border-color: var(--deft-accent, #06D6A0);
        }

        /* ── Version Preview ── */
        #versionPreviewPanel {
            border: 1px solid var(--deft-border, #2A2E3D);
            border-radius: 0.5rem;
            background: var(--deft-surface, #13151C);
            margin-top: 0.75rem;
            overflow: hidden;
        }
        #versionPreviewMeta {
            font-size: 0.65rem;
            color: var(--deft-txt-3, #525E73);
            padding: 0.5rem 0.75rem;
            border-bottom: 1px solid var(--deft-border, #2A2E3D);
        }
        #versionPreviewContent {
            padding: 0.75rem;
            font-size: 0.85rem;
            color: var(--deft-txt-2, #8A95A9);
            max-height: 300px;
            overflow-y: auto;
            line-height: 1.6;
        }
        #versionPreviewContent h1, #versionPreviewContent h2, #versionPreviewContent h3 {
            color: var(--deft-txt, #E8ECF1);
        }

        /* ── Empty State ── */
        .jed-empty {
            padding: 1.5rem;
            text-align: center;
            font-size: 0.8rem;
            color: var(--deft-txt-3, #525E73);
        }

        /* ── Responsive ── */
        @media (max-width: 640px) {
            #editorContainer .ql-toolbar.ql-snow {
                padding: 0.375rem;
            }
            #editorContainer .ql-toolbar.ql-snow .ql-formats {
                margin-right: 0.25rem;
            }
            .jed-mood-btn {
                width: 28px;
                height: 28px;
                font-size: 0.85rem;
            }
            .jed-ver-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.375rem;
            }
        }
    `;
    document.head.appendChild(style);
})();
