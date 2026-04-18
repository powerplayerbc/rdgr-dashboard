// =============================================
// Journal Stickers — Konva.js Sticker System
// =============================================

let stickerMode = false;
let activeStickerScope = 'daily';
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

    // Make canvas transparent (no background fill)
    stage.container().style.position = 'absolute';
    stage.container().style.top = '0';
    stage.container().style.left = '0';
    stage.container().style.pointerEvents = stickerMode ? 'auto' : 'none';
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
            node.setAttr('_stickerId', s.id);
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
        img.crossOrigin = 'anonymous';
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

function selectSticker(node, scope) {
    deselectAllStickers();

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
}

function deselectAllStickers() {
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

    const customHtml = `<div id="customStickersGrid" class="sticker-picker-grid">
        <div class="sticker-picker-loading">Loading custom stickers...</div>
    </div>
    <button class="sticker-upload-btn" onclick="uploadCustomSticker()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Upload Custom Sticker
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

async function loadCustomStickersForPicker() {
    if (!activeProfileId) return;
    const stickers = await supabaseSelect('journal_sticker_library', `select=*&user_id=eq.${activeProfileId}&order=created_at.desc`);
    const grid = document.getElementById('customStickersGrid');
    if (!grid) return;

    if (!stickers || !stickers.length) {
        grid.innerHTML = '<div class="sticker-picker-empty">No custom stickers yet. Upload one below.</div>';
        return;
    }

    grid.innerHTML = stickers.map(s => `
        <button class="sticker-picker-item sticker-picker-custom" onclick="addSticker('${s.slug}', 'custom', '${s.image_url}')" title="${s.name || s.slug}" aria-label="${s.name || s.slug}">
            <img src="${s.image_url}" alt="${s.name || s.slug}" loading="lazy" />
        </button>
    `).join('');
}

// =============================================
// ADD STICKER
// =============================================
function addSticker(slug, type, imageUrl) {
    const scope = activeStickerScope;
    const stage = scope === 'daily' ? konvaStage : calendarKonvaStage;
    if (!stage) { toast('Sticker canvas not ready', 'error'); return; }

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
        img.crossOrigin = 'anonymous';
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
        node.setAttr('_stickerId', result[0].id);
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

    await supabaseWrite('journal_stickers', 'PATCH', body, `id=eq.${stickerId}`);
}

// =============================================
// DELETE STICKER
// =============================================
async function deleteSticker(stickerId, node) {
    if (!stickerId) return;

    const result = await supabaseWrite('journal_stickers', 'DELETE', null, `id=eq.${stickerId}`);
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

    // Update toggle button visuals
    const toggleBtn = document.getElementById('stickerModeToggle');
    if (toggleBtn) {
        toggleBtn.classList.toggle('sticker-mode-active', stickerMode);
        toggleBtn.setAttribute('aria-pressed', stickerMode ? 'true' : 'false');
        toggleBtn.title = stickerMode ? 'Sticker mode ON (click to lock stickers)' : 'Sticker mode OFF (click to edit stickers)';
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
                await supabaseWrite('journal_sticker_library', 'POST', {
                    user_id: activeProfileId,
                    name: file.name.replace(/\.[^.]+$/, ''),
                    drive_file_id: result.fileId || '',
                    image_url: result.thumbnailUrl || result.driveUrl || '',
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
