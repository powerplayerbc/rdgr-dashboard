// =============================================
// Journal Stickers — Konva.js Sticker System
// =============================================

let stickerMode = false;
let activeStickerScope = 'monthly'; // Default to monthly since calendar is the initial view
let stickerTransformers = [];

// =============================================
// INIT STICKER CANVAS
// =============================================
function initStickerCanvas(containerId, scope) {
    const container = document.getElementById(containerId);
    if (!container) { console.error('Sticker container not found:', containerId); return; }

    // Destroy existing stage for this scope
    destroyStickerCanvas(scope);

    const width = container.offsetWidth || 400;
    const height = container.offsetHeight || 600;

    const stage = new Konva.Stage({
        container: containerId,
        width: width,
        height: height
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    // Position canvas overlay -- pointer-events off by default.
    // User toggles "sticker mode" to interact with stickers.
    stage.container().style.position = 'absolute';
    stage.container().style.top = '0';
    stage.container().style.left = '0';
    stage.container().style.width = '100%';
    stage.container().style.height = '100%';
    stage.container().style.pointerEvents = 'none';
    stage.container().style.zIndex = '10';

    if (scope === 'daily') {
        konvaStage = stage;
    } else {
        calendarKonvaStage = stage;
    }

    // Click on empty area deselects all transformers
    stage.on('click tap', function (e) {
        if (e.target === stage) {
            deselectAllStickers();
        }
    });

    return stage;
}

// =============================================
// LOAD STICKERS
// =============================================
async function loadStickers(scope) {
    const stage = scope === 'daily' ? konvaStage : calendarKonvaStage;
    if (!stage) return;

    const layer = stage.findOne('Layer');
    if (!layer) return;

    // Clear existing sticker nodes
    layer.destroyChildren();
    stickerTransformers = stickerTransformers.filter(t => {
        const s = t.getAttr('_scope');
        return s !== scope;
    });

    let query;
    if (scope === 'daily') {
        if (!currentEntry || !currentEntry.entry_id) return;
        query = `select=*&scope=eq.daily&entry_id=eq.${currentEntry.entry_id}&order=z_index`;
    } else {
        if (!activeProfileId || !currentMonth) return;
        query = `select=*&scope=eq.monthly&user_id=eq.${activeProfileId}&scope_month=eq.${currentMonth}&order=z_index`;
    }

    const stickers = await supabaseSelect('journal_stickers', query);
    if (!stickers || !stickers.length) { layer.batchDraw(); return; }

    for (const s of stickers) {
        const x = (s.x_percent / 100) * stage.width();
        const y = (s.y_percent / 100) * stage.height();

        let node;
        if (s.sticker_type === 'emoji') {
            const stickerDef = STICKER_LIBRARY.find(sl => sl.slug === s.sticker_slug);
            const emoji = stickerDef ? stickerDef.emoji : s.sticker_slug;
            node = new Konva.Text({
                text: emoji,
                fontSize: 40,
                x: x,
                y: y,
                draggable: stickerMode,
                listening: stickerMode,
                scaleX: s.scale || 1,
                scaleY: s.scale || 1,
                rotation: s.rotation || 0
            });
        } else if (s.sticker_type === 'custom') {
            node = await loadCustomStickerImage(s, x, y);
        }

        if (node) {
            node.setAttr('_stickerId', s.sticker_id);
            node.setAttr('_stickerScope', scope);
            node.setAttr('_stickerSlug', s.sticker_slug);
            node.setAttr('_stickerType', s.sticker_type);

            attachStickerEvents(node, scope);
            layer.add(node);
        }
    }

    layer.batchDraw();
}

function loadCustomStickerImage(stickerData, x, y) {
    return new Promise((resolve) => {
        const imageUrl = stickerData.image_url;
        if (!imageUrl) { resolve(null); return; }

        const img = new Image();
        // No crossOrigin — Google Drive URLs need cookies/redirects
        img.onload = function () {
            const node = new Konva.Image({
                image: img,
                x: x,
                y: y,
                width: 60,
                height: 60,
                draggable: stickerMode,
                listening: stickerMode,
                scaleX: stickerData.scale || 1,
                scaleY: stickerData.scale || 1,
                rotation: stickerData.rotation || 0
            });
            resolve(node);
        };
        img.onerror = function () {
            console.warn('Failed to load custom sticker image:', imageUrl);
            resolve(null);
        };
        img.src = imageUrl;
    });
}

// =============================================
// STICKER EVENTS
// =============================================
function attachStickerEvents(node, scope) {
    node.on('click tap', function (e) {
        if (!stickerMode) return;
        e.cancelBubble = true;
        selectSticker(node, scope);
    });

    node.on('dragend', function () {
        saveStickerPosition(node);
    });

    node.on('transformend', function () {
        saveStickerPosition(node);
    });
}

let _selectedStickerNode = null;

function selectSticker(node, scope) {
    deselectAllStickers();
    _selectedStickerNode = node;

    const stage = scope === 'daily' ? konvaStage : calendarKonvaStage;
    if (!stage) return;
    const layer = stage.findOne('Layer');
    if (!layer) return;

    const tr = new Konva.Transformer({
        nodes: [node],
        enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        rotateEnabled: true,
        borderStroke: '#06D6A0',
        borderStrokeWidth: 1.5,
        anchorStroke: '#06D6A0',
        anchorFill: '#1A1D2E',
        anchorSize: 8,
        padding: 4
    });
    tr.setAttr('_scope', scope);
    layer.add(tr);
    stickerTransformers.push(tr);
    layer.batchDraw();

    // Show floating delete button
    showStickerDeleteBtn(node, stage);
}

function showStickerDeleteBtn(node, stage) {
    hideStickerDeleteBtn();

    // Add delete button to the bottom sticker bar
    var bar = document.getElementById('stickerModeBar');
    if (!bar) return;

    var btn = document.createElement('button');
    btn.id = 'stickerDeleteFloating';
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M4.5 3V2.5a1 1 0 011-1h1a1 1 0 011 1V3M5 5.5v3M7 5.5v3M3 3l.5 6.5a1 1 0 001 .5h3a1 1 0 001-.5L9 3" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg> Delete Sticker';
    btn.style.cssText = 'display:flex;align-items:center;gap:0.375rem;padding:0.5rem 1rem;border-radius:999px;border:1px solid rgba(255,107,107,0.5);background:transparent;color:#FF6B6B;font-size:0.8rem;font-weight:600;cursor:pointer;';

    btn.onclick = function() {
        var stickerId = node.getAttr('_stickerId');
        if (!stickerId) {
            node.destroy();
            deselectAllStickers();
            var layer = stage.findOne('Layer');
            if (layer) layer.batchDraw();
            toast('Sticker removed');
            return;
        }
        if (confirm('Delete this sticker from the page?')) {
            deleteSticker(stickerId, node);
        }
    };

    bar.appendChild(btn);
}

function hideStickerDeleteBtn() {
    var existing = document.getElementById('stickerDeleteFloating');
    if (existing) existing.remove();
}

function deselectAllStickers() {
    _selectedStickerNode = null;
    hideStickerDeleteBtn();
    stickerTransformers.forEach(tr => tr.destroy());
    stickerTransformers = [];
    if (konvaStage) {
        const l = konvaStage.findOne('Layer');
        if (l) l.batchDraw();
    }
    if (calendarKonvaStage) {
        const l = calendarKonvaStage.findOne('Layer');
        if (l) l.batchDraw();
    }
}

// =============================================
// STICKER PICKER
// =============================================
function openStickerPicker() {
    const modal = document.getElementById('stickerPickerModal');
    if (!modal) return;

    // Group stickers by category
    const categories = {};
    STICKER_LIBRARY.forEach(s => {
        if (!categories[s.category]) categories[s.category] = [];
        categories[s.category].push(s);
    });

    let emojiHtml = '';
    for (const [cat, stickers] of Object.entries(categories)) {
        const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
        emojiHtml += `<div class="sticker-picker-category">
            <div class="sticker-picker-category-label">${catLabel}</div>
            <div class="sticker-picker-grid">`;
        stickers.forEach(s => {
            emojiHtml += `<button class="sticker-picker-item" onclick="addSticker('${s.slug}', 'emoji')" title="${s.label}" aria-label="${s.label}">${s.emoji}</button>`;
        });
        emojiHtml += `</div></div>`;
    }

    const customHtml = `<div style="margin-bottom:8px;">
        <input type="text" id="customStickerSearch" placeholder="Search by name, tag, or bundle..."
            oninput="filterCustomStickers()"
            style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid var(--deft-border,#2A2E3D);background:var(--deft-surface,#11131A);color:var(--deft-txt,#E8ECF1);font-size:0.8rem;outline:none;" />
    </div>
    <div id="customStickersGrid" class="sticker-picker-grid">
        <div class="sticker-picker-loading">Loading custom stickers...</div>
    </div>
    <button class="sticker-upload-btn" onclick="openBulkUploadModal('sticker')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Upload Stickers
    </button>`;

    const modalBody = document.getElementById('stickerPickerContent');
    if (!modalBody) return;
    modalBody.innerHTML = `
        <div class="sticker-picker-tabs" role="tablist">
            <button class="sticker-picker-tab active" onclick="switchStickerTab('emoji')" role="tab" aria-selected="true" id="tab-sticker-emoji">Emoji</button>
            <button class="sticker-picker-tab" onclick="switchStickerTab('custom')" role="tab" aria-selected="false" id="tab-sticker-custom">Custom</button>
        </div>
        <div id="stickerTabEmoji" class="sticker-tab-content">${emojiHtml}</div>
        <div id="stickerTabCustom" class="sticker-tab-content" style="display:none;">${customHtml}</div>
    `;

    openModal('stickerPickerModal');
    loadCustomStickersForPicker();
}

function switchStickerTab(tab) {
    const emojiTab = document.getElementById('stickerTabEmoji');
    const customTab = document.getElementById('stickerTabCustom');
    const tabBtnEmoji = document.getElementById('tab-sticker-emoji');
    const tabBtnCustom = document.getElementById('tab-sticker-custom');

    if (tab === 'emoji') {
        emojiTab.style.display = '';
        customTab.style.display = 'none';
        tabBtnEmoji.classList.add('active');
        tabBtnEmoji.setAttribute('aria-selected', 'true');
        tabBtnCustom.classList.remove('active');
        tabBtnCustom.setAttribute('aria-selected', 'false');
    } else {
        emojiTab.style.display = 'none';
        customTab.style.display = '';
        tabBtnEmoji.classList.remove('active');
        tabBtnEmoji.setAttribute('aria-selected', 'false');
        tabBtnCustom.classList.add('active');
        tabBtnCustom.setAttribute('aria-selected', 'true');
    }
}

let _customStickersCache = [];

async function loadCustomStickersForPicker() {
    if (!activeProfileId) return;
    const stickers = await supabaseSelect('journal_sticker_library', `select=*&user_id=eq.${activeProfileId}&order=bundle.asc.nullslast,created_at.desc`);
    _customStickersCache = stickers || [];
    renderCustomStickers(_customStickersCache);
}

function filterCustomStickers() {
    var input = document.getElementById('customStickerSearch');
    var q = (input ? input.value : '').trim().toLowerCase();
    if (!q) { renderCustomStickers(_customStickersCache); return; }
    var filtered = _customStickersCache.filter(function(s) {
        if ((s.name || '').toLowerCase().indexOf(q) !== -1) return true;
        if (s.bundle && s.bundle.toLowerCase().indexOf(q) !== -1) return true;
        if (s.tags && Array.isArray(s.tags)) {
            for (var i = 0; i < s.tags.length; i++) {
                if (s.tags[i].toLowerCase().indexOf(q) !== -1) return true;
            }
        }
        return false;
    });
    renderCustomStickers(filtered);
}

function renderCustomStickers(stickers) {
    var grid = document.getElementById('customStickersGrid');
    if (!grid) return;

    if (!stickers || !stickers.length) {
        grid.innerHTML = '<div class="sticker-picker-empty">No custom stickers yet. Upload some below.</div>';
        return;
    }

    // Group by bundle
    var groups = {};
    stickers.forEach(function(s) {
        var key = s.bundle || '';
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });

    var html = '';
    var keys = Object.keys(groups).sort(function(a, b) {
        if (!a) return 1; if (!b) return -1;
        return a.localeCompare(b);
    });

    keys.forEach(function(key) {
        var items = groups[key];
        var label = key || 'Ungrouped';
        if (keys.length > 1 || key) {
            html += '<div class="sticker-bundle-group">';
            html += '<div class="sticker-bundle-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
            html += '<span>' + label + ' (' + items.length + ')</span>';
            html += '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="sticker-bundle-chevron"><path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
            html += '</div>';
            html += '<div class="sticker-bundle-content sticker-picker-grid">';
        }

        items.forEach(function(s) {
            var slug = s.id || s.name || 'custom';
            var name = s.name || 'Custom sticker';
            html += '<div class="sticker-picker-custom-card" style="position:relative;">';
            html += '<button class="sticker-picker-item sticker-picker-custom" onclick="addSticker(\'' + slug + '\', \'custom\', \'' + s.image_url + '\')" title="' + name + '" aria-label="' + name + '">';
            html += '<img src="' + s.image_url + '" alt="' + name + '" loading="lazy" />';
            html += '</button>';
            html += '<button class="sticker-picker-custom-delete" onclick="event.stopPropagation();deleteCustomSticker(\'' + s.id + '\')" title="Delete sticker" aria-label="Delete ' + name + '">&times;</button>';
            html += '</div>';
        });

        if (keys.length > 1 || key) {
            html += '</div></div>';
        }
    });

    grid.innerHTML = html;
}

async function deleteCustomSticker(libraryId) {
    // Check if this sticker is being used on any pages
    var library = await supabaseSelect('journal_sticker_library', 'id=eq.' + libraryId + '&select=image_url,name');
    if (!library || !library.length) { toast('Sticker not found', 'error'); return; }

    var imageUrl = library[0].image_url;
    var name = library[0].name || 'this sticker';

    // Count how many placed stickers reference this image
    var usages = await supabaseSelect('journal_stickers', 'image_url=eq.' + encodeURIComponent(imageUrl) + '&select=sticker_id');
    var usageCount = (usages && usages.length) ? usages.length : 0;

    var msg = 'Delete "' + name + '" from your sticker library?';
    if (usageCount > 0) {
        msg += '\n\nWARNING: This sticker is currently placed on ' + usageCount + ' page' + (usageCount > 1 ? 's' : '') + '. Those placed stickers will remain but the image may stop loading.';
    }

    if (!confirm(msg)) return;

    // Delete from library
    await supabaseWrite('journal_sticker_library', 'DELETE', null, 'id=eq.' + libraryId);
    toast('Custom sticker deleted');
    loadCustomStickersForPicker();
}

// =============================================
// ADD STICKER
// =============================================
async function addSticker(slug, type, imageUrl) {
    const scope = activeStickerScope;
    const stage = scope === 'daily' ? konvaStage : calendarKonvaStage;
    if (!stage) { toast('Sticker canvas not ready', 'error'); return; }

    // For daily scope, ensure entry exists (auto-create if needed)
    if (scope === 'daily' && (!currentEntry || !currentEntry.entry_id)) {
        if (typeof saveEntry === 'function') {
            const saved = await saveEntry('manual');
            if (!saved || !saved.entry_id) {
                toast('Save your entry first before adding stickers', 'error');
                return;
            }
        } else {
            toast('Save your entry first before adding stickers', 'error');
            return;
        }
    }

    const layer = stage.findOne('Layer');
    if (!layer) return;

    // Place near center with slight randomness
    const cx = stage.width() / 2 + (Math.random() - 0.5) * 80;
    const cy = stage.height() / 2 + (Math.random() - 0.5) * 80;

    if (type === 'emoji') {
        const stickerDef = STICKER_LIBRARY.find(s => s.slug === slug);
        const emoji = stickerDef ? stickerDef.emoji : slug;

        const node = new Konva.Text({
            text: emoji,
            fontSize: 40,
            x: cx,
            y: cy,
            draggable: true,
            listening: true
        });
        node.setAttr('_stickerSlug', slug);
        node.setAttr('_stickerType', 'emoji');
        node.setAttr('_stickerScope', scope);
        attachStickerEvents(node, scope);
        layer.add(node);
        layer.batchDraw();

        // Save to DB
        saveStickerToDb(node, slug, 'emoji', null, scope);
    } else if (type === 'custom' && imageUrl) {
        const img = new Image();
        // No crossOrigin — Google Drive URLs need cookies/redirects
        img.onload = function () {
            const node = new Konva.Image({
                image: img,
                x: cx,
                y: cy,
                width: 60,
                height: 60,
                draggable: true,
                listening: true
            });
            node.setAttr('_stickerSlug', slug);
            node.setAttr('_stickerType', 'custom');
            node.setAttr('_stickerScope', scope);
            node.setAttr('_imageUrl', imageUrl);
            attachStickerEvents(node, scope);
            layer.add(node);
            layer.batchDraw();

            saveStickerToDb(node, slug, 'custom', imageUrl, scope);
        };
        img.onerror = function () {
            toast('Failed to load sticker image', 'error');
        };
        img.src = imageUrl;
    }

    closeModal('stickerPickerModal');
    toast('Sticker added');
}

async function saveStickerToDb(node, slug, type, imageUrl, scope) {
    if (scope === 'daily' && (!currentEntry || !currentEntry.entry_id)) {
        toast('Save your entry first before adding stickers', 'error');
        return;
    }
    const stage = scope === 'daily' ? konvaStage : calendarKonvaStage;
    if (!stage) return;

    const xPercent = (node.x() / stage.width()) * 100;
    const yPercent = (node.y() / stage.height()) * 100;

    const body = {
        user_id: activeProfileId,
        scope: scope,
        sticker_slug: slug,
        sticker_type: type,
        x_percent: Math.round(xPercent * 100) / 100,
        y_percent: Math.round(yPercent * 100) / 100,
        scale: node.scaleX(),
        rotation: node.rotation(),
        z_index: 0
    };

    if (scope === 'daily' && currentEntry) {
        body.entry_id = currentEntry.entry_id;
    }
    if (scope === 'monthly') {
        body.scope_month = currentMonth;
    }
    if (imageUrl) {
        body.image_url = imageUrl;
    }

    const result = await supabaseWrite('journal_stickers', 'POST', body);
    if (result && result.length > 0) {
        node.setAttr('_stickerId', result[0].sticker_id);
    }
}

// =============================================
// SAVE STICKER POSITION
// =============================================
async function saveStickerPosition(stickerNode) {
    const stickerId = stickerNode.getAttr('_stickerId');
    if (!stickerId) return;

    const scope = stickerNode.getAttr('_stickerScope') || activeStickerScope;
    const stage = scope === 'daily' ? konvaStage : calendarKonvaStage;
    if (!stage) return;

    const xPercent = (stickerNode.x() / stage.width()) * 100;
    const yPercent = (stickerNode.y() / stage.height()) * 100;

    const body = {
        x_percent: Math.round(xPercent * 100) / 100,
        y_percent: Math.round(yPercent * 100) / 100,
        scale: Math.round(stickerNode.scaleX() * 100) / 100,
        rotation: Math.round(stickerNode.rotation() * 10) / 10,
        z_index: stickerNode.zIndex()
    };

    await supabaseWrite('journal_stickers', 'PATCH', body, `sticker_id=eq.${stickerId}`);
}

// =============================================
// DELETE STICKER
// =============================================
async function deleteSticker(stickerId, node) {
    if (!stickerId) return;

    const result = await supabaseWrite('journal_stickers', 'DELETE', null, `sticker_id=eq.${stickerId}`);
    if (result !== null) {
        if (node) {
            node.destroy();
            // Remove any transformer attached to this node
            stickerTransformers = stickerTransformers.filter(tr => {
                const nodes = tr.nodes();
                if (nodes.includes(node)) {
                    tr.destroy();
                    return false;
                }
                return true;
            });
            const scope = node.getAttr('_stickerScope');
            const stage = scope === 'daily' ? konvaStage : calendarKonvaStage;
            if (stage) {
                const layer = stage.findOne('Layer');
                if (layer) layer.batchDraw();
            }
        }
        toast('Sticker removed');
    }
}

// =============================================
// TOGGLE STICKER MODE
// =============================================
function toggleStickerMode() {
    stickerMode = !stickerMode;

    // Update all sticker nodes in both stages
    [konvaStage, calendarKonvaStage].forEach(stage => {
        if (!stage) return;
        const layer = stage.findOne('Layer');
        if (!layer) return;

        // Toggle pointer events on the canvas container
        stage.container().style.pointerEvents = stickerMode ? 'auto' : 'none';

        layer.children.forEach(child => {
            if (child instanceof Konva.Transformer) return;
            child.draggable(stickerMode);
            child.listening(stickerMode);
        });

        layer.batchDraw();
    });

    if (!stickerMode) {
        deselectAllStickers();
    }

    // Update toggle button visuals on both calendar and daily buttons
    ['stickerModeToggle', 'dailyStickerModeToggle'].forEach(function(id) {
        var btn = document.getElementById(id);
        if (btn) {
            btn.style.background = stickerMode ? 'rgba(6,214,160,0.2)' : '';
            btn.style.borderColor = stickerMode ? 'rgba(6,214,160,0.5)' : '';
            btn.style.color = stickerMode ? '#06D6A0' : '';
        }
    });

    toast(stickerMode ? 'Sticker mode ON -- drag, resize & rotate stickers' : 'Sticker mode OFF -- normal editing', 'info');

    // Show/hide floating sticker toolbar bar
    var bar = document.getElementById('stickerModeBar');
    if (stickerMode) {
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'stickerModeBar';
            bar.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);z-index:10001;display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;border-radius:999px;background:rgba(8,9,13,0.92);backdrop-filter:blur(12px);box-shadow:0 4px 20px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);';

            var exitBtn = document.createElement('button');
            exitBtn.id = 'stickerModeExitBtn';
            exitBtn.onclick = toggleStickerMode;
            exitBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Exit Sticker Mode';
            exitBtn.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;border-radius:999px;border:1px solid rgba(6,214,160,0.5);background:transparent;color:#06D6A0;font-size:0.8rem;font-weight:600;cursor:pointer;';
            bar.appendChild(exitBtn);

            document.body.appendChild(bar);
        }
        bar.style.display = 'flex';
        // Remove delete button when entering mode fresh (no sticker selected yet)
        hideStickerDeleteBtn();
    } else {
        if (bar) bar.style.display = 'none';
    }
}

// =============================================
// UPLOAD CUSTOM STICKER
// =============================================
function uploadCustomSticker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    input.onchange = async function () {
        const file = input.files[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
            toast('Image must be under 20 MB', 'error');
            return;
        }

        try {
            toast('Compressing & uploading...');

            // Compress sticker (max 512px, keep PNG for small/transparent images)
            const compressed = await compressImage(file, 512, 0.85);

            const result = await journalDriveApi('upload_custom_sticker', {
                file_name: compressed.fileName,
                mime_type: compressed.mimeType,
                file_data_base64: compressed.base64
            });

            if (result && result.success) {
                // Use Drive thumbnail URL (works without auth in browsers)
                const stickerUrl = result.fileId
                    ? 'https://drive.google.com/thumbnail?id=' + result.fileId + '&sz=w512'
                    : (result.driveUrl || '');
                await supabaseWrite('journal_sticker_library', 'POST', {
                    user_id: activeProfileId,
                    name: file.name.replace(/\.[^.]+$/, ''),
                    drive_file_id: result.fileId || '',
                    image_url: stickerUrl,
                    category: 'custom'
                });

                toast('Custom sticker uploaded');
                openStickerPicker();
            } else {
                toast('Upload failed', 'error');
            }
        } catch (err) {
            console.error('Sticker upload error:', err);
            toast('Upload failed', 'error');
        }
    };

    document.body.appendChild(input);
    input.click();
    input.remove();
}

// =============================================
// DESTROY STICKER CANVAS
// =============================================
function destroyStickerCanvas(scope) {
    if (scope === 'daily' && konvaStage) {
        konvaStage.destroy();
        konvaStage = null;
    } else if (scope === 'monthly' && calendarKonvaStage) {
        calendarKonvaStage.destroy();
        calendarKonvaStage = null;
    }

    // Clean up transformers for this scope
    stickerTransformers = stickerTransformers.filter(tr => {
        if (tr.getAttr('_scope') === scope) {
            tr.destroy();
            return false;
        }
        return true;
    });
}

// =============================================
// STICKER PICKER STYLES (injected once)
// =============================================
(function injectStickerStyles() {
    if (document.getElementById('journal-sticker-styles')) return;
    const style = document.createElement('style');
    style.id = 'journal-sticker-styles';
    style.textContent = `
        /* Sticker Picker Modal */
        .sticker-picker-tabs {
            display: flex;
            gap: 2px;
            background: rgba(255,255,255,0.04);
            border-radius: 8px;
            padding: 3px;
            margin-bottom: 12px;
        }
        .sticker-picker-tab {
            flex: 1;
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            background: transparent;
            color: var(--deft-txt-muted, #8A95A9);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        .sticker-picker-tab.active {
            background: rgba(6,214,160,0.1);
            color: #06D6A0;
        }
        .sticker-picker-tab:hover:not(.active) {
            color: var(--deft-txt, #E8ECF1);
        }
        .sticker-picker-category {
            margin-bottom: 12px;
        }
        .sticker-picker-category-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--deft-txt-muted, #8A95A9);
            margin-bottom: 6px;
            padding-left: 2px;
        }
        .sticker-picker-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
            gap: 4px;
        }
        .sticker-picker-item {
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid transparent;
            border-radius: 8px;
            background: rgba(255,255,255,0.03);
            cursor: pointer;
            font-size: 24px;
            transition: all 0.15s;
            padding: 0;
        }
        .sticker-picker-item:hover {
            background: rgba(6,214,160,0.1);
            border-color: rgba(6,214,160,0.2);
            transform: scale(1.1);
        }
        .sticker-picker-item:active {
            transform: scale(0.95);
        }
        .sticker-picker-custom img {
            width: 32px;
            height: 32px;
            object-fit: contain;
            border-radius: 4px;
        }
        .sticker-picker-empty,
        .sticker-picker-loading {
            grid-column: 1 / -1;
            text-align: center;
            padding: 20px;
            font-size: 13px;
            color: var(--deft-txt-muted, #8A95A9);
        }
        .sticker-upload-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 10px;
            margin-top: 12px;
            border: 1px dashed rgba(255,255,255,0.12);
            border-radius: 8px;
            background: transparent;
            color: var(--deft-txt-muted, #8A95A9);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .sticker-upload-btn:hover {
            border-color: rgba(6,214,160,0.3);
            color: #06D6A0;
            background: rgba(6,214,160,0.04);
        }

        /* Bundle Groups */
        .sticker-bundle-group { margin-bottom: 10px; }
        .sticker-bundle-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 5px 4px; cursor: pointer; font-size: 11px; font-weight: 600;
            text-transform: uppercase; letter-spacing: 0.04em;
            color: var(--deft-txt-muted, #8A95A9);
            border-bottom: 1px solid var(--deft-border, #2A2E3D);
            margin-bottom: 6px; user-select: none;
        }
        .sticker-bundle-header:hover { color: var(--deft-txt, #E8ECF1); }
        .sticker-bundle-chevron { transition: transform 0.2s; }
        .sticker-bundle-group.collapsed .sticker-bundle-chevron { transform: rotate(-90deg); }
        .sticker-bundle-group.collapsed .sticker-bundle-content { display: none; }

        /* Sticker Mode Toggle Button */
        #stickerModeToggle {
            transition: all 0.25s;
        }
        #stickerModeToggle.sticker-mode-active {
            background: rgba(6,214,160,0.15) !important;
            border-color: rgba(6,214,160,0.3) !important;
            color: #06D6A0 !important;
            box-shadow: 0 0 8px rgba(6,214,160,0.15);
        }
    `;
    document.head.appendChild(style);
})();
