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
    modalBody.innerHTML = `
        <div class="bg-picker-header">
            <span class="bg-picker-header-label">Background for ${targetLabel}</span>
        </div>
        <div class="bg-picker-grid">${gridHtml}</div>
        <button class="bg-upload-btn" onclick="uploadCustomBackground()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Upload Custom Background
        </button>
    `;

    openModal('backgroundPickerModal');
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
        container.style.backgroundSize = 'cover';
        container.style.backgroundPosition = 'center';
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
        container.style.backgroundSize = 'cover';
        container.style.backgroundPosition = 'center';
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
