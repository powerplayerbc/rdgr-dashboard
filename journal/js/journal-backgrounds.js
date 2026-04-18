// =============================================
// Journal Backgrounds — Per-Day & Per-Month Backgrounds
// =============================================

let backgroundsList = [];
let backgroundPickerTarget = 'daily';

// =============================================
// LOAD BACKGROUNDS
// =============================================
async function loadBackgrounds() {
    const query = `select=*&or=(user_id.is.null,user_id.eq.${activeProfileId})&is_active=eq.true&order=name`;
    const result = await supabaseSelect('journal_backgrounds', query);
    backgroundsList = result || [];
    return backgroundsList;
}

// =============================================
// OPEN BACKGROUND PICKER
// =============================================
async function openBackgroundPicker(target) {
    backgroundPickerTarget = target;
    const modal = document.getElementById('backgroundPickerModal');
    if (!modal) return;

    // Always load fresh backgrounds before rendering
    await loadBackgrounds();

    const targetLabel = target === 'daily' ? 'Daily Entry' : 'Monthly Calendar';

    let gridHtml = '';

    // "None" option
    gridHtml += `
        <button class="bg-picker-card" onclick="removeBackground('${target}')" title="No background" aria-label="Remove background">
            <div class="bg-picker-preview" style="background: var(--deft-bg, #0F1119); border: 1px dashed rgba(255,255,255,0.12);">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="opacity:0.4;">
                    <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </div>
            <span class="bg-picker-label">None</span>
        </button>
    `;

    backgroundsList.forEach(bg => {
        const previewStyle = getBackgroundPreviewStyle(bg);
        const isCustom = bg.user_id ? true : false;
        const deleteBtn = isCustom
            ? `<button class="bg-picker-delete" onclick="event.stopPropagation();deleteBackground('${bg.background_id}')" title="Delete" aria-label="Delete ${bg.name}">&times;</button>`
            : '';
        gridHtml += `
            <div class="bg-picker-card" style="position:relative;">
                <button class="bg-picker-card-inner" onclick="selectBackground('${bg.background_id}', '${target}')" title="${bg.name}" aria-label="${bg.name}">
                    <div class="bg-picker-preview" style="${previewStyle}"></div>
                    <span class="bg-picker-label">${bg.name}</span>
                </button>
                ${deleteBtn}
            </div>
        `;
    });

    const modalBody = document.getElementById('backgroundPickerContent');
    if (!modalBody) return;
    // Load current position settings
    var posSettings = getBgPositionSettings(target);

    modalBody.innerHTML = `
        <div class="bg-picker-header">
            <span class="bg-picker-header-label">Background for ${targetLabel}</span>
        </div>
        <div style="margin-bottom:8px;">
            <input type="text" id="customBgSearch" placeholder="Search by name, tag, or bundle..."
                oninput="filterCustomBackgrounds('${target}')"
                style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid var(--deft-border,#2A2E3D);background:var(--deft-surface,#11131A);color:var(--deft-txt,#E8ECF1);font-size:0.8rem;outline:none;" />
        </div>
        <div class="bg-picker-grid" id="bgPickerGrid">${gridHtml}</div>
        <div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid var(--deft-border, #2A2E3D);">
            <div class="settings-label" style="margin-bottom:0.5rem;">Image Position</div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:start;">
                <div>
                    <label class="text-xs" style="color:var(--deft-txt-3);display:block;margin-bottom:0.25rem;">Fit</label>
                    <select id="bgFitSelect" onchange="previewBgPosition('${target}')" style="padding:0.3rem 0.5rem;font-size:0.7rem;border-radius:0.375rem;border:1px solid var(--deft-border);background:var(--deft-surface-el, #1A1D28);color:var(--deft-txt);">
                        <option value="cover" ${posSettings.fit === 'cover' ? 'selected' : ''}>Cover (fill, may crop)</option>
                        <option value="contain" ${posSettings.fit === 'contain' ? 'selected' : ''}>Contain (fit whole image)</option>
                        <option value="auto" ${posSettings.fit === 'auto' ? 'selected' : ''}>Original size</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs" style="color:var(--deft-txt-3);display:block;margin-bottom:0.25rem;">Vertical</label>
                    <select id="bgPosYSelect" onchange="previewBgPosition('${target}')" style="padding:0.3rem 0.5rem;font-size:0.7rem;border-radius:0.375rem;border:1px solid var(--deft-border);background:var(--deft-surface-el, #1A1D28);color:var(--deft-txt);">
                        <option value="top" ${posSettings.posY === 'top' ? 'selected' : ''}>Top</option>
                        <option value="center" ${posSettings.posY === 'center' ? 'selected' : ''}>Center</option>
                        <option value="bottom" ${posSettings.posY === 'bottom' ? 'selected' : ''}>Bottom</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs" style="color:var(--deft-txt-3);display:block;margin-bottom:0.25rem;">Horizontal</label>
                    <select id="bgPosXSelect" onchange="previewBgPosition('${target}')" style="padding:0.3rem 0.5rem;font-size:0.7rem;border-radius:0.375rem;border:1px solid var(--deft-border);background:var(--deft-surface-el, #1A1D28);color:var(--deft-txt);">
                        <option value="left" ${posSettings.posX === 'left' ? 'selected' : ''}>Left</option>
                        <option value="center" ${posSettings.posX === 'center' ? 'selected' : ''}>Center</option>
                        <option value="right" ${posSettings.posX === 'right' ? 'selected' : ''}>Right</option>
                    </select>
                </div>
                <button onclick="saveBgPosition('${target}')" class="btn btn-sm btn-primary" style="align-self:end;">Save Position</button>
            </div>
        </div>
        <button class="bg-upload-btn" onclick="openBulkUploadModal('background')" style="margin-top:0.75rem;">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Upload Backgrounds
        </button>
    `;

    openModal('backgroundPickerModal');
}

// =============================================
// BACKGROUND POSITION SETTINGS
// =============================================
function getBgPositionKey(target) {
    return 'journal-bg-pos-' + (activeProfileId || 'default') + '-' + (target === 'daily' ? currentDate : currentMonth);
}

function getBgPositionSettings(target) {
    try {
        var saved = localStorage.getItem(getBgPositionKey(target));
        return saved ? JSON.parse(saved) : { fit: 'cover', posY: 'center', posX: 'center' };
    } catch(e) { return { fit: 'cover', posY: 'center', posX: 'center' }; }
}

function previewBgPosition(target) {
    var fit = document.getElementById('bgFitSelect').value;
    var posY = document.getElementById('bgPosYSelect').value;
    var posX = document.getElementById('bgPosXSelect').value;
    applyBgPositionToContainer(target, fit, posX, posY);
}

function saveBgPosition(target) {
    var settings = {
        fit: document.getElementById('bgFitSelect').value,
        posY: document.getElementById('bgPosYSelect').value,
        posX: document.getElementById('bgPosXSelect').value
    };
    localStorage.setItem(getBgPositionKey(target), JSON.stringify(settings));
    applyBgPositionToContainer(target, settings.fit, settings.posX, settings.posY);
    toast('Background position saved');
}

function applyBgPositionToContainer(target, fit, posX, posY) {
    var container;
    if (target === 'daily') {
        container = document.getElementById('dailyBackground');
    } else {
        container = document.getElementById('calendarWrapper') || document.getElementById('view-calendar');
    }
    if (!container) return;

    container.style.backgroundSize = fit;
    container.style.backgroundPosition = posX + ' ' + posY;
    container.style.backgroundRepeat = 'no-repeat';
}

function getBackgroundPreviewStyle(bg) {
    if (bg.type === 'gradient' && bg.value) {
        return `background: ${bg.value};`;
    }
    if (bg.type === 'image' && bg.value) {
        return `background-image: url('${bg.value}'); background-size: cover; background-position: center;`;
    }
    if (bg.type === 'solid' && bg.value) {
        return `background: ${bg.value};`;
    }
    return 'background: rgba(255,255,255,0.04);';
}

// =============================================
// SELECT BACKGROUND
// =============================================
async function selectBackground(backgroundId, target) {
    if (target === 'daily') {
        if (!currentEntry || !currentEntry.entry_id) {
            toast('No entry loaded', 'error');
            return;
        }
        await supabaseWrite('journal_entries', 'PATCH', { background_id: backgroundId }, `entry_id=eq.${currentEntry.entry_id}`);
        currentEntry.background_id = backgroundId;
        applyDailyBackground(backgroundId);
        toast('Background applied');
    } else if (target === 'monthly') {
        const key = `journal-month-bg-${activeProfileId}-${currentMonth}`;
        localStorage.setItem(key, backgroundId);
        applyMonthBackground();
        toast('Calendar background applied');
    }

    closeModal('backgroundPickerModal');
}

// =============================================
// APPLY DAILY BACKGROUND
// =============================================
function applyDailyBackground(backgroundId) {
    const container = document.getElementById('dailyBackground');
    if (!container) return;

    if (!backgroundId) {
        container.style.background = '';
        container.style.backgroundImage = '';
        return;
    }

    const bg = backgroundsList.find(b => String(b.background_id) === String(backgroundId));
    if (!bg) {
        // Background not found in loaded list; clear
        container.style.background = '';
        container.style.backgroundImage = '';
        return;
    }

    if (bg.type === 'gradient' && bg.value) {
        container.style.background = bg.value;
        container.style.backgroundImage = '';
    } else if (bg.type === 'image' && bg.value) {
        container.style.background = '';
        container.style.backgroundImage = `url('${bg.value}')`;
        // Apply saved position settings
        var pos = getBgPositionSettings('daily');
        container.style.backgroundSize = pos.fit;
        container.style.backgroundPosition = pos.posX + ' ' + pos.posY;
        container.style.backgroundRepeat = 'no-repeat';
    } else if (bg.type === 'solid' && bg.value) {
        container.style.background = bg.value;
        container.style.backgroundImage = '';
    } else {
        container.style.background = '';
        container.style.backgroundImage = '';
    }
}

// =============================================
// APPLY MONTH BACKGROUND
// =============================================
function applyMonthBackground() {
    const container = document.getElementById('calendarWrapper') || document.getElementById('view-calendar');
    if (!container) return;

    const key = `journal-month-bg-${activeProfileId}-${currentMonth}`;
    const backgroundId = localStorage.getItem(key);

    if (!backgroundId) {
        container.style.background = '';
        container.style.backgroundImage = '';
        return;
    }

    const bg = backgroundsList.find(b => String(b.background_id) === String(backgroundId));
    if (!bg) {
        container.style.background = '';
        container.style.backgroundImage = '';
        return;
    }

    if (bg.type === 'gradient' && bg.value) {
        container.style.background = bg.value;
    } else if (bg.type === 'image' && bg.value) {
        container.style.backgroundImage = `url('${bg.value}')`;
        var pos = getBgPositionSettings('monthly');
        container.style.backgroundSize = pos.fit;
        container.style.backgroundPosition = pos.posX + ' ' + pos.posY;
        container.style.backgroundRepeat = 'no-repeat';
    } else if (bg.type === 'solid' && bg.value) {
        container.style.background = bg.value;
    }
}

// =============================================
// DELETE CUSTOM BACKGROUND
// =============================================
async function deleteBackground(backgroundId) {
    if (!confirm('Delete this background? This cannot be undone.')) return;

    const result = await supabaseWrite('journal_backgrounds', 'DELETE', null, 'background_id=eq.' + backgroundId);
    if (result !== null) {
        toast('Background deleted');
        await loadBackgrounds();
        openBackgroundPicker(backgroundPickerTarget);
    } else {
        toast('Failed to delete background', 'error');
    }
}

// =============================================
// UPLOAD CUSTOM BACKGROUND
// =============================================
function uploadCustomBackground() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    input.onchange = async function () {
        const file = input.files[0];
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {
            toast('Image must be under 50 MB', 'error');
            return;
        }

        try {
            toast('Compressing & uploading...');

            // Compress image (max 1920px, 75% quality for backgrounds)
            const compressed = await compressImage(file);

            const result = await journalDriveApi('upload_background_image', {
                file_name: compressed.fileName,
                mime_type: compressed.mimeType,
                file_data_base64: compressed.base64
            });

            if (result && result.success) {
                // Use Drive thumbnail URL (works without auth in browsers)
                const imageUrl = result.fileId
                    ? 'https://drive.google.com/thumbnail?id=' + result.fileId + '&sz=w1600'
                    : (result.driveUrl || '');
                const bgName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
                await supabaseWrite('journal_backgrounds', 'POST', {
                    user_id: activeProfileId,
                    name: bgName,
                    type: 'image',
                    value: imageUrl,
                    category: 'custom',
                    is_active: true
                });

                toast('Background uploaded');

                // Refresh list and picker
                await loadBackgrounds();
                openBackgroundPicker(backgroundPickerTarget);
            } else {
                toast('Upload failed', 'error');
            }
        } catch (err) {
            console.error('Background upload error:', err);
            toast('Upload failed', 'error');
        }
    };

    document.body.appendChild(input);
    input.click();
    input.remove();
}

// =============================================
// FILTER BACKGROUNDS
// =============================================
function filterCustomBackgrounds(target) {
    var input = document.getElementById('customBgSearch');
    var q = (input ? input.value : '').trim().toLowerCase();
    var grid = document.getElementById('bgPickerGrid');
    if (!grid) return;

    var filtered = backgroundsList;
    if (q) {
        filtered = backgroundsList.filter(function(bg) {
            // System backgrounds always show
            if (!bg.user_id) return true;
            if ((bg.name || '').toLowerCase().indexOf(q) !== -1) return true;
            if (bg.bundle && bg.bundle.toLowerCase().indexOf(q) !== -1) return true;
            if (bg.tags && Array.isArray(bg.tags)) {
                for (var i = 0; i < bg.tags.length; i++) {
                    if (bg.tags[i].toLowerCase().indexOf(q) !== -1) return true;
                }
            }
            return false;
        });
    }

    var html = '';
    // "None" option
    html += '<button class="bg-picker-card" onclick="removeBackground(\'' + target + '\')" title="No background" aria-label="Remove background">';
    html += '<div class="bg-picker-preview" style="background: var(--deft-bg, #0F1119); border: 1px dashed rgba(255,255,255,0.12);">';
    html += '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="opacity:0.4;"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    html += '</div><span class="bg-picker-label">None</span></button>';

    filtered.forEach(function(bg) {
        var previewStyle = getBackgroundPreviewStyle(bg);
        var isCustom = bg.user_id ? true : false;
        var deleteBtn = isCustom
            ? '<button class="bg-picker-delete" onclick="event.stopPropagation();deleteBackground(\'' + bg.background_id + '\')" title="Delete" aria-label="Delete ' + (bg.name || '') + '">&times;</button>'
            : '';
        html += '<div class="bg-picker-card" style="position:relative;">';
        html += '<button class="bg-picker-card-inner" onclick="selectBackground(\'' + bg.background_id + '\', \'' + target + '\')" title="' + (bg.name || '') + '" aria-label="' + (bg.name || '') + '">';
        html += '<div class="bg-picker-preview" style="' + previewStyle + '"></div>';
        html += '<span class="bg-picker-label">' + (bg.name || '') + '</span>';
        html += '</button>';
        html += deleteBtn;
        html += '</div>';
    });

    grid.innerHTML = html;
}

// =============================================
// REMOVE BACKGROUND
// =============================================
async function removeBackground(target) {
    if (target === 'daily') {
        if (currentEntry && currentEntry.entry_id) {
            await supabaseWrite('journal_entries', 'PATCH', { background_id: null }, `entry_id=eq.${currentEntry.entry_id}`);
            currentEntry.background_id = null;
        }
        const container = document.getElementById('dailyBackground');
        if (container) {
            container.style.background = '';
            container.style.backgroundImage = '';
        }
        toast('Background removed');
    } else if (target === 'monthly') {
        const key = `journal-month-bg-${activeProfileId}-${currentMonth}`;
        localStorage.removeItem(key);
        const container = document.getElementById('calendarWrapper') || document.getElementById('view-calendar');
        if (container) {
            container.style.background = '';
            container.style.backgroundImage = '';
        }
        toast('Calendar background removed');
    }

    closeModal('backgroundPickerModal');
}

// =============================================
// BACKGROUND PICKER STYLES (injected once)
// =============================================
(function injectBackgroundStyles() {
    if (document.getElementById('journal-background-styles')) return;
    const style = document.createElement('style');
    style.id = 'journal-background-styles';
    style.textContent = `
        .bg-picker-header {
            margin-bottom: 12px;
        }
        .bg-picker-header-label {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--deft-txt-muted, #8A95A9);
        }
        .bg-picker-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
            gap: 10px;
            margin-bottom: 12px;
        }
        .bg-picker-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            transition: transform 0.15s;
        }
        .bg-picker-card:hover {
            transform: scale(1.05);
        }
        .bg-picker-card:active {
            transform: scale(0.97);
        }
        .bg-picker-preview {
            width: 80px;
            height: 56px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            transition: border-color 0.2s;
        }
        .bg-picker-card:hover .bg-picker-preview {
            border-color: rgba(6,214,160,0.3);
        }
        .bg-picker-label {
            font-size: 11px;
            color: var(--deft-txt-muted, #8A95A9);
            text-align: center;
            max-width: 80px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .bg-upload-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 10px;
            border: 1px dashed rgba(255,255,255,0.12);
            border-radius: 8px;
            background: transparent;
            color: var(--deft-txt-muted, #8A95A9);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .bg-upload-btn:hover {
            border-color: rgba(6,214,160,0.3);
            color: #06D6A0;
            background: rgba(6,214,160,0.04);
        }
    `;
    document.head.appendChild(style);
})();
