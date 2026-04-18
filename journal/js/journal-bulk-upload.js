// =============================================
// Journal Bulk Upload — Shared Sticker & Background Batch Upload
// =============================================

let _bulkUploadType = null;
let _bulkUploadFiles = [];
let _bulkUploadTags = [];
let _bulkUploadBundle = '';
let _bulkDragCounter = 0;

const BULK_CONFIG = {
    sticker: { maxDim: 512, quality: 0.85, driveOp: 'upload_custom_sticker', table: 'journal_sticker_library', sizeLimitMB: 20, thumbSz: 'w512' },
    background: { maxDim: 1600, quality: 0.88, driveOp: 'upload_background_image', table: 'journal_backgrounds', sizeLimitMB: 50, thumbSz: 'w1600' }
};

// =============================================
// OPEN MODAL
// =============================================
function openBulkUploadModal(type) {
    _bulkUploadType = type;
    _bulkUploadFiles = [];
    _bulkUploadTags = [];
    _bulkUploadBundle = '';
    _bulkDragCounter = 0;

    var title = document.getElementById('bulkUploadTitle');
    if (title) title.textContent = type === 'sticker' ? 'Upload Stickers' : 'Upload Backgrounds';

    renderBulkStep1();
    openModal('bulkUploadModal');
}

// =============================================
// STEP 1 — METADATA (Bundle Name + Tags)
// =============================================
function renderBulkStep1() {
    var content = document.getElementById('bulkUploadContent');
    if (!content) return;

    content.innerHTML = `
        <div class="bulk-step">
            <label class="bulk-label">Bundle Name <span class="bulk-optional">(optional)</span></label>
            <input type="text" id="bulkBundleName" class="bulk-input" placeholder="e.g., Fairy Collection" value="${_escBulk(_bulkUploadBundle)}">

            <label class="bulk-label" style="margin-top:12px;">Tags</label>
            <div class="bulk-tag-bar" id="bulkTagBar">
                <div id="bulkTagChips" class="bulk-tag-chips"></div>
                <input type="text" id="bulkTagInput" class="bulk-tag-input" placeholder="Type a tag, press Enter"
                    onkeydown="if(event.key==='Enter'){event.preventDefault();addBulkTag();}">
            </div>
            <p class="bulk-hint">Tags help you find these later. All files in this batch share the same tags.</p>

            <div class="bulk-actions">
                <button class="bulk-btn bulk-btn-primary" onclick="showBulkStep2()">
                    Next &mdash; Select Files
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5.5 3.5L9 7l-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
        </div>
    `;

    renderBulkTagChips();
}

// =============================================
// TAG CHIPS
// =============================================
function addBulkTag() {
    var input = document.getElementById('bulkTagInput');
    if (!input) return;
    var tag = input.value.trim().toLowerCase();
    if (!tag || _bulkUploadTags.indexOf(tag) !== -1) { input.value = ''; return; }
    _bulkUploadTags.push(tag);
    input.value = '';
    renderBulkTagChips();
}

function removeBulkTag(tag) {
    _bulkUploadTags = _bulkUploadTags.filter(function(t) { return t !== tag; });
    renderBulkTagChips();
}

function renderBulkTagChips() {
    var container = document.getElementById('bulkTagChips');
    if (!container) return;
    if (_bulkUploadTags.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = _bulkUploadTags.map(function(tag) {
        return '<span class="bulk-tag-chip">' +
            _escBulk(tag) +
            '<button type="button" class="bulk-tag-remove" onclick="removeBulkTag(\'' + _escBulk(tag) + '\')" aria-label="Remove tag">&times;</button>' +
        '</span>';
    }).join('');
}

// =============================================
// STEP 2 — FILE SELECTION
// =============================================
function showBulkStep2() {
    var nameInput = document.getElementById('bulkBundleName');
    _bulkUploadBundle = nameInput ? nameInput.value.trim() : '';

    var content = document.getElementById('bulkUploadContent');
    if (!content) return;

    var tagSummary = '';
    if (_bulkUploadBundle) tagSummary += '<span class="bulk-tag-chip bulk-bundle-chip">' + _escBulk(_bulkUploadBundle) + '</span>';
    _bulkUploadTags.forEach(function(t) { tagSummary += '<span class="bulk-tag-chip">' + _escBulk(t) + '</span>'; });

    content.innerHTML = `
        <div class="bulk-step">
            ${tagSummary ? '<div class="bulk-meta-summary">' + tagSummary + '<button class="bulk-back-link" onclick="renderBulkStep1()">Edit</button></div>' : '<div class="bulk-meta-summary"><span class="bulk-hint" style="margin:0;">No bundle or tags set</span><button class="bulk-back-link" onclick="renderBulkStep1()">Edit</button></div>'}

            <div class="bulk-drop-zone" id="bulkDropZone"
                 onclick="document.getElementById('bulkFileInput').click();"
                 ondragenter="_bulkDragEnter(event)"
                 ondragleave="_bulkDragLeave(event)"
                 ondragover="event.preventDefault();"
                 ondrop="_bulkDrop(event)">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style="opacity:0.4;margin-bottom:6px;"><path d="M16 4v18M10 10l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 22v4a2 2 0 002 2h20a2 2 0 002-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                <span>Drop images here or click to browse</span>
                <span class="bulk-hint" style="margin-top:4px;">Max ${BULK_CONFIG[_bulkUploadType].sizeLimitMB} MB per file</span>
            </div>
            <input type="file" id="bulkFileInput" multiple accept="image/*" style="display:none;" onchange="handleBulkFiles(this.files); this.value='';">

            <div id="bulkPreviewGrid" class="bulk-preview-grid"></div>

            <div id="bulkProgressWrap" class="bulk-progress-wrap" style="display:none;">
                <div class="bulk-progress-bar"><div class="bulk-progress-fill" id="bulkProgressFill"></div></div>
                <span id="bulkProgressText" class="bulk-hint">Uploading...</span>
            </div>

            <div class="bulk-actions">
                <span id="bulkFileCount" class="bulk-hint">${_bulkUploadFiles.length} file${_bulkUploadFiles.length !== 1 ? 's' : ''} selected</span>
                <button class="bulk-btn bulk-btn-primary" id="bulkUploadBtn" onclick="startBulkUpload()" ${_bulkUploadFiles.length === 0 ? 'disabled' : ''}>
                    Upload${_bulkUploadFiles.length > 0 ? ' ' + _bulkUploadFiles.length + ' File' + (_bulkUploadFiles.length !== 1 ? 's' : '') : ''}
                </button>
            </div>
        </div>
    `;

    renderBulkPreviewGrid();
}

// =============================================
// DRAG & DROP
// =============================================
function _bulkDragEnter(e) {
    e.preventDefault();
    _bulkDragCounter++;
    var zone = document.getElementById('bulkDropZone');
    if (zone) zone.classList.add('bulk-drop-zone--active');
}

function _bulkDragLeave(e) {
    e.preventDefault();
    _bulkDragCounter--;
    if (_bulkDragCounter <= 0) {
        _bulkDragCounter = 0;
        var zone = document.getElementById('bulkDropZone');
        if (zone) zone.classList.remove('bulk-drop-zone--active');
    }
}

function _bulkDrop(e) {
    e.preventDefault();
    _bulkDragCounter = 0;
    var zone = document.getElementById('bulkDropZone');
    if (zone) zone.classList.remove('bulk-drop-zone--active');
    if (e.dataTransfer && e.dataTransfer.files) {
        handleBulkFiles(e.dataTransfer.files);
    }
}

// =============================================
// FILE HANDLING
// =============================================
function handleBulkFiles(fileList) {
    var sizeLimit = BULK_CONFIG[_bulkUploadType].sizeLimitMB * 1024 * 1024;
    var added = 0;

    for (var i = 0; i < fileList.length; i++) {
        var file = fileList[i];
        if (!file.type || !file.type.startsWith('image/')) {
            toast(file.name + ' is not an image', 'error');
            continue;
        }
        if (file.size > sizeLimit) {
            toast(file.name + ' exceeds ' + BULK_CONFIG[_bulkUploadType].sizeLimitMB + ' MB limit', 'error');
            continue;
        }
        _bulkUploadFiles.push({
            file: file,
            id: _bulkUUID(),
            status: 'pending',
            previewUrl: URL.createObjectURL(file)
        });
        added++;
    }

    if (added > 0) {
        renderBulkPreviewGrid();
        _updateBulkFileCount();
    }
}

function removeBulkFile(id) {
    _bulkUploadFiles = _bulkUploadFiles.filter(function(f) {
        if (f.id === id && f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        return f.id !== id;
    });
    renderBulkPreviewGrid();
    _updateBulkFileCount();
}

function renderBulkPreviewGrid() {
    var grid = document.getElementById('bulkPreviewGrid');
    if (!grid) return;

    if (_bulkUploadFiles.length === 0) {
        grid.innerHTML = '';
        return;
    }

    grid.innerHTML = _bulkUploadFiles.map(function(f) {
        var statusClass = 'bulk-status--' + f.status;
        var statusIcon = '';
        if (f.status === 'done') statusIcon = '<span class="bulk-status-icon bulk-status-done">&#10003;</span>';
        else if (f.status === 'error') statusIcon = '<span class="bulk-status-icon bulk-status-error">&#10007;</span>';
        else if (f.status === 'uploading') statusIcon = '<span class="bulk-status-icon bulk-status-uploading"></span>';

        var name = f.file.name.length > 18 ? f.file.name.substring(0, 15) + '...' : f.file.name;

        return '<div class="bulk-preview-card ' + statusClass + '">' +
            '<img src="' + f.previewUrl + '" alt="' + _escBulk(f.file.name) + '" loading="lazy">' +
            statusIcon +
            (f.status === 'pending' ? '<button class="bulk-preview-remove" onclick="removeBulkFile(\'' + f.id + '\')" aria-label="Remove">&times;</button>' : '') +
            '<span class="bulk-preview-name">' + _escBulk(name) + '</span>' +
        '</div>';
    }).join('');
}

// =============================================
// UPLOAD
// =============================================
async function startBulkUpload() {
    var pending = _bulkUploadFiles.filter(function(f) { return f.status === 'pending'; });
    if (pending.length === 0) { toast('No files to upload', 'error'); return; }

    var btn = document.getElementById('bulkUploadBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

    var progressWrap = document.getElementById('bulkProgressWrap');
    if (progressWrap) progressWrap.style.display = '';

    var config = BULK_CONFIG[_bulkUploadType];
    var done = 0;
    var failed = 0;

    for (var i = 0; i < _bulkUploadFiles.length; i++) {
        var f = _bulkUploadFiles[i];
        if (f.status !== 'pending') continue;

        f.status = 'uploading';
        renderBulkPreviewGrid();
        _updateBulkProgress(done, pending.length);

        try {
            var compressed = await compressImage(f.file, config.maxDim, config.quality);

            var result = await journalDriveApi(config.driveOp, {
                file_name: compressed.fileName,
                mime_type: compressed.mimeType,
                file_data_base64: compressed.base64
            });

            if (!result || !result.success) {
                f.status = 'error';
                failed++;
                renderBulkPreviewGrid();
                continue;
            }

            var imageUrl = _buildUploadedUrl(result, _bulkUploadType);

            var record;
            if (_bulkUploadType === 'sticker') {
                record = {
                    user_id: activeProfileId,
                    name: f.file.name.replace(/\.[^.]+$/, ''),
                    drive_file_id: result.fileId || '',
                    image_url: imageUrl,
                    category: 'custom',
                    tags: _bulkUploadTags.length > 0 ? _bulkUploadTags : null,
                    bundle: _bulkUploadBundle || null
                };
            } else {
                record = {
                    user_id: activeProfileId,
                    name: f.file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
                    type: 'image',
                    value: imageUrl,
                    category: 'custom',
                    is_active: true,
                    tags: _bulkUploadTags.length > 0 ? _bulkUploadTags : null,
                    bundle: _bulkUploadBundle || null
                };
            }

            await supabaseWrite(config.table, 'POST', record);
            f.status = 'done';
            done++;
        } catch (err) {
            console.error('Bulk upload error:', err);
            f.status = 'error';
            failed++;
        }

        renderBulkPreviewGrid();
        _updateBulkProgress(done, pending.length);
    }

    // Done
    var msg = 'Uploaded ' + done + ' of ' + pending.length + ' ' + _bulkUploadType + (pending.length !== 1 ? 's' : '');
    if (failed > 0) msg += ' (' + failed + ' failed)';
    toast(msg, failed > 0 ? 'error' : 'success');

    if (btn) { btn.textContent = 'Done'; }

    // Refresh the relevant picker
    if (_bulkUploadType === 'sticker') {
        if (typeof loadCustomStickersForPicker === 'function') loadCustomStickersForPicker();
    } else {
        if (typeof loadBackgrounds === 'function') await loadBackgrounds();
    }

    // Auto-close after brief delay
    setTimeout(function() { closeModal('bulkUploadModal'); }, 800);
}

// =============================================
// HELPERS
// =============================================
function _buildUploadedUrl(result, type) {
    if (result.fileId) {
        var sz = type === 'sticker' ? 'w512' : 'w1600';
        return 'https://drive.google.com/thumbnail?id=' + result.fileId + '&sz=' + sz;
    }
    return result.thumbnailUrl || result.driveUrl || '';
}

function _updateBulkFileCount() {
    var count = _bulkUploadFiles.filter(function(f) { return f.status === 'pending'; }).length;
    var el = document.getElementById('bulkFileCount');
    if (el) el.textContent = count + ' file' + (count !== 1 ? 's' : '') + ' selected';
    var btn = document.getElementById('bulkUploadBtn');
    if (btn) {
        btn.disabled = count === 0;
        btn.textContent = count > 0 ? 'Upload ' + count + ' File' + (count !== 1 ? 's' : '') : 'Upload';
    }
}

function _updateBulkProgress(done, total) {
    var fill = document.getElementById('bulkProgressFill');
    var text = document.getElementById('bulkProgressText');
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = 'Uploading ' + done + ' of ' + total + '...';
}

function _bulkUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'bulk-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

function _escBulk(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// =============================================
// STYLES (IIFE-injected)
// =============================================
(function injectBulkUploadStyles() {
    if (document.getElementById('journal-bulk-upload-styles')) return;
    var style = document.createElement('style');
    style.id = 'journal-bulk-upload-styles';
    style.textContent = `
        /* ── Step Layout ── */
        .bulk-step { padding: 4px 0; }
        .bulk-label {
            display: block; font-size: 0.7rem; font-weight: 600;
            text-transform: uppercase; letter-spacing: 0.04em;
            color: var(--deft-txt-2, #8A95A9); margin-bottom: 6px;
        }
        .bulk-optional { font-weight: 400; text-transform: none; color: var(--deft-txt-3, #525E73); }
        .bulk-hint { font-size: 0.7rem; color: var(--deft-txt-3, #525E73); margin-top: 6px; }
        .bulk-input {
            width: 100%; padding: 8px 12px; border-radius: 6px;
            border: 1px solid var(--deft-border, #2A2E3D);
            background: var(--deft-surface, #11131A);
            color: var(--deft-txt, #E8ECF1); font-size: 0.85rem;
            outline: none; transition: border-color 0.15s;
        }
        .bulk-input:focus { border-color: var(--deft-accent, #06D6A0); }

        /* ── Tag Bar ── */
        .bulk-tag-bar {
            display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
            padding: 6px 8px; border-radius: 6px;
            border: 1px solid var(--deft-border, #2A2E3D);
            background: var(--deft-surface, #11131A);
            min-height: 38px; cursor: text;
        }
        .bulk-tag-bar:focus-within { border-color: var(--deft-accent, #06D6A0); }
        .bulk-tag-chips { display: flex; flex-wrap: wrap; gap: 4px; }
        .bulk-tag-input {
            flex: 1; min-width: 100px; border: none; background: transparent;
            color: var(--deft-txt, #E8ECF1); font-size: 0.8rem; outline: none;
            padding: 2px 0;
        }
        .bulk-tag-chip {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 3px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 500;
            background: rgba(6,214,160,0.1); color: #06D6A0;
            white-space: nowrap;
        }
        .bulk-bundle-chip {
            background: rgba(99,102,241,0.12); color: #818CF8;
        }
        .bulk-tag-remove {
            display: inline-flex; align-items: center; justify-content: center;
            width: 14px; height: 14px; border: none; background: transparent;
            color: inherit; cursor: pointer; font-size: 0.8rem; padding: 0;
            opacity: 0.6; transition: opacity 0.12s;
        }
        .bulk-tag-remove:hover { opacity: 1; }

        /* ── Meta Summary (Step 2 header) ── */
        .bulk-meta-summary {
            display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
            margin-bottom: 12px; padding: 8px 10px; border-radius: 6px;
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--deft-border, #2A2E3D);
        }
        .bulk-back-link {
            margin-left: auto; font-size: 0.7rem; color: var(--deft-accent, #06D6A0);
            background: none; border: none; cursor: pointer; text-decoration: underline;
            padding: 0;
        }

        /* ── Drop Zone ── */
        .bulk-drop-zone {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 28px 16px; border: 2px dashed var(--deft-border, #2A2E3D);
            border-radius: 10px; cursor: pointer; text-align: center;
            color: var(--deft-txt-3, #525E73); font-size: 0.8rem;
            transition: border-color 0.2s, background 0.2s;
            margin-bottom: 12px;
        }
        .bulk-drop-zone:hover {
            border-color: rgba(6,214,160,0.3); background: rgba(6,214,160,0.02);
        }
        .bulk-drop-zone--active {
            border-color: var(--deft-accent, #06D6A0) !important;
            background: rgba(6,214,160,0.06) !important;
        }

        /* ── Preview Grid ── */
        .bulk-preview-grid {
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
            margin-bottom: 12px;
        }
        .bulk-preview-card {
            position: relative; border-radius: 8px; overflow: hidden;
            border: 1px solid var(--deft-border, #2A2E3D); aspect-ratio: 1;
            background: rgba(0,0,0,0.2);
        }
        .bulk-preview-card img {
            width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .bulk-preview-remove {
            position: absolute; top: 3px; right: 3px;
            width: 20px; height: 20px; border-radius: 50%;
            border: none; background: rgba(0,0,0,0.7); color: #fff;
            font-size: 0.75rem; cursor: pointer; display: flex;
            align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.15s;
        }
        .bulk-preview-card:hover .bulk-preview-remove { opacity: 1; }
        .bulk-preview-name {
            position: absolute; bottom: 0; left: 0; right: 0;
            padding: 3px 6px; font-size: 0.55rem; color: #fff;
            background: rgba(0,0,0,0.6); overflow: hidden;
            text-overflow: ellipsis; white-space: nowrap;
        }

        /* ── Status Icons ── */
        .bulk-status-icon {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
            width: 28px; height: 28px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.85rem; font-weight: 700;
        }
        .bulk-status-done { background: rgba(6,214,160,0.9); color: #0D0F13; }
        .bulk-status-error { background: rgba(255,107,107,0.9); color: #fff; }
        .bulk-status-uploading {
            width: 24px; height: 24px; border: 2px solid rgba(255,255,255,0.2);
            border-top-color: #06D6A0; border-radius: 50%;
            animation: bulkSpin 0.7s linear infinite;
        }
        @keyframes bulkSpin { to { transform: translate(-50%,-50%) rotate(360deg); } }
        .bulk-status--uploading img, .bulk-status--done img, .bulk-status--error img {
            opacity: 0.35;
        }

        /* ── Progress Bar ── */
        .bulk-progress-wrap { margin-bottom: 12px; }
        .bulk-progress-bar {
            width: 100%; height: 4px; border-radius: 2px;
            background: rgba(255,255,255,0.06); overflow: hidden;
        }
        .bulk-progress-fill {
            height: 100%; width: 0; border-radius: 2px;
            background: var(--deft-accent, #06D6A0);
            transition: width 0.3s ease;
        }

        /* ── Actions Bar ── */
        .bulk-actions {
            display: flex; align-items: center; justify-content: space-between;
            margin-top: 12px; gap: 12px;
        }
        .bulk-btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 8px 16px; border-radius: 6px; font-size: 0.8rem;
            font-weight: 600; cursor: pointer; border: none; transition: opacity 0.15s;
        }
        .bulk-btn:disabled { opacity: 0.4; cursor: default; }
        .bulk-btn-primary {
            background: var(--deft-accent, #06D6A0); color: #0D0F13;
        }
        .bulk-btn-primary:hover:not(:disabled) { opacity: 0.9; }

        /* ── Responsive ── */
        @media (max-width: 480px) {
            .bulk-preview-grid { grid-template-columns: repeat(3, 1fr); }
        }
    `;
    document.head.appendChild(style);
})();
