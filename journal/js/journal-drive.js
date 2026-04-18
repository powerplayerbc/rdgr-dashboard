// =============================================
// Journal Drive — Google Drive Attachment Upload & Display
// =============================================

// =============================================
// FILE UPLOAD
// =============================================
function openFileUpload() {
    if (!currentEntry || !currentEntry.entry_id) {
        toast('Save your entry first before attaching files', 'error');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx';
    input.style.display = 'none';

    input.onchange = async function () {
        const file = input.files[0];
        if (!file) return;

        if (file.size > 25 * 1024 * 1024) {
            toast('File must be under 25 MB', 'error');
            return;
        }

        // Show upload progress
        const progressEl = showUploadProgress(file.name);

        const reader = new FileReader();
        reader.onload = async function () {
            const base64 = reader.result.split(',')[1];

            try {
                const result = await journalDriveApi('upload_attachment', {
                    entry_date: currentDate,
                    file_name: file.name,
                    mime_type: file.type,
                    file_data_base64: base64
                });

                removeUploadProgress(progressEl);

                if (result && result.success) {
                    toast('File uploaded');
                    if (typeof loadAttachments === 'function') {
                        loadAttachments();
                    } else {
                        refreshAttachmentList();
                    }
                } else {
                    const errMsg = (result && result.error) ? result.error : 'Upload failed';
                    toast(errMsg, 'error');
                }
            } catch (err) {
                removeUploadProgress(progressEl);
                console.error('File upload error:', err);
                toast('Upload failed', 'error');
            }
        };
        reader.onerror = function () {
            removeUploadProgress(progressEl);
            toast('Could not read file', 'error');
        };
        reader.readAsDataURL(file);
    };

    document.body.appendChild(input);
    input.click();
    input.remove();
}

function showUploadProgress(fileName) {
    const container = document.getElementById('attachmentsList') || document.getElementById('attachmentsGrid');
    if (!container) return null;

    const el = document.createElement('div');
    el.className = 'attachment-card attachment-uploading';
    el.innerHTML = `
        <div class="attachment-uploading-spinner"></div>
        <span class="attachment-uploading-name">${escapeHtml(fileName)}</span>
    `;
    container.prepend(el);
    return el;
}

function removeUploadProgress(el) {
    if (el && el.parentNode) el.remove();
}

// =============================================
// DELETE ATTACHMENT
// =============================================
async function deleteAttachment(attachmentId) {
    if (!attachmentId) return;

    const confirmed = confirm('Delete this attachment? This cannot be undone.');
    if (!confirmed) return;

    const result = await journalDriveApi('delete_attachment', {
        attachment_id: attachmentId
    });

    if (result && result.success) {
        // Remove from DOM
        const card = document.querySelector(`[data-attachment-id="${attachmentId}"]`);
        if (card) {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(() => card.remove(), 200);
        }
        toast('Attachment deleted');
    } else {
        const errMsg = (result && result.error) ? result.error : 'Delete failed';
        toast(errMsg, 'error');
    }
}

// =============================================
// RENDER ATTACHMENT THUMBNAIL
// =============================================
function renderAttachmentThumbnail(attachment) {
    const isImage = attachment.mime_type && attachment.mime_type.startsWith('image/');
    const thumbSrc = attachment.thumbnail_url || attachment.drive_url || '';
    const fileName = attachment.file_name || 'Untitled';
    const fileSize = attachment.file_size_bytes ? formatFileSize(attachment.file_size_bytes) : '';
    const driveUrl = attachment.drive_url || '#';
    const attachId = attachment.id || attachment.attachment_id || '';

    let previewHtml;
    if (isImage && thumbSrc) {
        previewHtml = `<img src="${escapeHtml(thumbSrc)}" alt="${escapeHtml(fileName)}" class="attachment-thumb-img" loading="lazy" />`;
    } else {
        const ext = fileName.split('.').pop().toUpperCase();
        previewHtml = `
            <div class="attachment-file-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="attachment-ext">${escapeHtml(ext)}</span>
            </div>
        `;
    }

    return `
        <div class="attachment-card" data-attachment-id="${escapeHtml(String(attachId))}">
            <a href="${escapeHtml(driveUrl)}" target="_blank" rel="noopener noreferrer" class="attachment-preview" title="Open in Drive">
                ${previewHtml}
            </a>
            <div class="attachment-info">
                <span class="attachment-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</span>
                ${fileSize ? `<span class="attachment-size">${fileSize}</span>` : ''}
            </div>
            <button class="attachment-delete-btn" onclick="deleteAttachment('${escapeHtml(String(attachId))}')" title="Delete attachment" aria-label="Delete ${escapeHtml(fileName)}">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
        </div>
    `;
}

// =============================================
// REFRESH ATTACHMENT LIST
// =============================================
async function refreshAttachmentList() {
    if (!currentEntry || !currentEntry.entry_id) return;

    const attachments = await supabaseSelect('journal_attachments', `select=*&entry_id=eq.${currentEntry.entry_id}&order=created_at.desc`);
    const container = document.getElementById('attachmentsList') || document.getElementById('attachmentsGrid');
    if (!container) return;

    if (!attachments || !attachments.length) {
        container.innerHTML = '<div class="attachments-empty">No attachments yet. Click the upload button to add files.</div>';
        return;
    }

    container.innerHTML = attachments.map(a => renderAttachmentThumbnail(a)).join('');
}

// =============================================
// HELPERS
// =============================================
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// =============================================
// ATTACHMENT STYLES (injected once)
// =============================================
(function injectAttachmentStyles() {
    if (document.getElementById('journal-attachment-styles')) return;
    const style = document.createElement('style');
    style.id = 'journal-attachment-styles';
    style.textContent = `
        /* Attachment Grid */
        #attachmentsList,
        #attachmentsGrid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 10px;
        }
        .attachment-card {
            position: relative;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.06);
            background: rgba(255,255,255,0.02);
            overflow: hidden;
            transition: border-color 0.2s, transform 0.15s;
        }
        .attachment-card:hover {
            border-color: rgba(255,255,255,0.12);
            transform: translateY(-1px);
        }
        .attachment-preview {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100px;
            overflow: hidden;
            background: rgba(0,0,0,0.15);
            text-decoration: none;
            color: var(--deft-txt-muted, #8A95A9);
        }
        .attachment-thumb-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .attachment-file-icon {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            color: var(--deft-txt-muted, #8A95A9);
        }
        .attachment-ext {
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.05em;
            opacity: 0.7;
        }
        .attachment-info {
            padding: 8px 10px;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .attachment-name {
            font-size: 12px;
            color: var(--deft-txt, #E8ECF1);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .attachment-size {
            font-size: 10px;
            color: var(--deft-txt-muted, #8A95A9);
        }
        .attachment-delete-btn {
            position: absolute;
            top: 4px;
            right: 4px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 6px;
            background: rgba(0,0,0,0.5);
            color: var(--deft-txt-muted, #8A95A9);
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.15s, color 0.15s, background 0.15s;
        }
        .attachment-card:hover .attachment-delete-btn {
            opacity: 1;
        }
        .attachment-delete-btn:hover {
            background: rgba(232,93,93,0.25);
            color: #E85D5D;
        }
        .attachments-empty {
            grid-column: 1 / -1;
            text-align: center;
            padding: 24px 16px;
            font-size: 13px;
            color: var(--deft-txt-muted, #8A95A9);
        }

        /* Upload progress */
        .attachment-uploading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 16px 10px;
            min-height: 100px;
        }
        .attachment-uploading-spinner {
            width: 24px;
            height: 24px;
            border: 2px solid rgba(255,255,255,0.1);
            border-top-color: #06D6A0;
            border-radius: 50%;
            animation: attachment-spin 0.8s linear infinite;
        }
        @keyframes attachment-spin {
            to { transform: rotate(360deg); }
        }
        .attachment-uploading-name {
            font-size: 11px;
            color: var(--deft-txt-muted, #8A95A9);
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: center;
        }
    `;
    document.head.appendChild(style);
})();
