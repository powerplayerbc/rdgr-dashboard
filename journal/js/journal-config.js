// =============================================
// Journal Config — Constants, Stickers & Presets
// =============================================

// Migrate old localStorage key
if (!localStorage.getItem('rdgr-active-profile') && localStorage.getItem('rdgr-active-profile')) {
    localStorage.setItem('rdgr-active-profile', localStorage.getItem('rdgr-active-profile'));
    localStorage.removeItem('rdgr-active-profile');
}

// =============================================
// CONFIG
// =============================================
const SUPABASE_URL = 'https://yrwrswyjawmgtxrgbnim.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8';
const JOURNAL_DRIVE_URL = 'https://n8n.carltonaiservices.com/webhook/journal-drive';

// =============================================
// AUTOSAVE SETTINGS
// =============================================
const AUTOSAVE_INTERVAL_MS = 30000;
const AUTOSAVE_DEBOUNCE_MS = 2000;
const MAX_AUTOSAVE_VERSIONS = 20;

// =============================================
// MOOD OPTIONS
// =============================================
const MOOD_OPTIONS = [
    { slug: 'happy', emoji: '\u{1F60A}', label: 'Happy' },
    { slug: 'excited', emoji: '\u{1F929}', label: 'Excited' },
    { slug: 'calm', emoji: '\u{1F60C}', label: 'Calm' },
    { slug: 'grateful', emoji: '\u{1F64F}', label: 'Grateful' },
    { slug: 'tired', emoji: '\u{1F634}', label: 'Tired' },
    { slug: 'anxious', emoji: '\u{1F630}', label: 'Anxious' },
    { slug: 'sad', emoji: '\u{1F622}', label: 'Sad' },
    { slug: 'angry', emoji: '\u{1F621}', label: 'Angry' }
];

// =============================================
// STICKER LIBRARY
// =============================================
const STICKER_LIBRARY = [
    // Decorative
    { slug: 'star', category: 'decorative', emoji: '\u2B50', label: 'Star' },
    { slug: 'sparkles', category: 'decorative', emoji: '\u2728', label: 'Sparkles' },
    { slug: 'heart', category: 'decorative', emoji: '\u2764\uFE0F', label: 'Heart' },
    { slug: 'fire', category: 'decorative', emoji: '\u{1F525}', label: 'Fire' },
    { slug: 'rainbow', category: 'decorative', emoji: '\u{1F308}', label: 'Rainbow' },
    { slug: 'ribbon', category: 'decorative', emoji: '\u{1F380}', label: 'Ribbon' },
    { slug: 'balloon', category: 'decorative', emoji: '\u{1F388}', label: 'Balloon' },

    // Mood
    { slug: 'smile', category: 'mood', emoji: '\u{1F604}', label: 'Smile' },
    { slug: 'laugh', category: 'mood', emoji: '\u{1F602}', label: 'Laugh' },
    { slug: 'love-eyes', category: 'mood', emoji: '\u{1F60D}', label: 'Love Eyes' },
    { slug: 'thinking', category: 'mood', emoji: '\u{1F914}', label: 'Thinking' },
    { slug: 'mind-blown', category: 'mood', emoji: '\u{1F92F}', label: 'Mind Blown' },
    { slug: 'celebrate', category: 'mood', emoji: '\u{1F973}', label: 'Celebrate' },
    { slug: 'hug', category: 'mood', emoji: '\u{1F917}', label: 'Hug' },

    // Weather
    { slug: 'sunny', category: 'weather', emoji: '\u2600\uFE0F', label: 'Sunny' },
    { slug: 'cloudy', category: 'weather', emoji: '\u2601\uFE0F', label: 'Cloudy' },
    { slug: 'rainy', category: 'weather', emoji: '\u{1F327}\uFE0F', label: 'Rainy' },
    { slug: 'snowy', category: 'weather', emoji: '\u2744\uFE0F', label: 'Snowy' },
    { slug: 'stormy', category: 'weather', emoji: '\u26C8\uFE0F', label: 'Stormy' },
    { slug: 'windy', category: 'weather', emoji: '\u{1F32C}\uFE0F', label: 'Windy' },

    // Achievement
    { slug: 'trophy', category: 'achievement', emoji: '\u{1F3C6}', label: 'Trophy' },
    { slug: 'medal', category: 'achievement', emoji: '\u{1F3C5}', label: 'Medal' },
    { slug: 'check', category: 'achievement', emoji: '\u2705', label: 'Check' },
    { slug: 'rocket', category: 'achievement', emoji: '\u{1F680}', label: 'Rocket' },
    { slug: 'crown', category: 'achievement', emoji: '\u{1F451}', label: 'Crown' },
    { slug: 'muscle', category: 'achievement', emoji: '\u{1F4AA}', label: 'Muscle' },
    { slug: 'hundred', category: 'achievement', emoji: '\u{1F4AF}', label: 'Hundred' },

    // Nature
    { slug: 'flower', category: 'nature', emoji: '\u{1F33B}', label: 'Sunflower' },
    { slug: 'tree', category: 'nature', emoji: '\u{1F333}', label: 'Tree' },
    { slug: 'leaf', category: 'nature', emoji: '\u{1F343}', label: 'Leaf' },
    { slug: 'butterfly', category: 'nature', emoji: '\u{1F98B}', label: 'Butterfly' },
    { slug: 'ocean-wave', category: 'nature', emoji: '\u{1F30A}', label: 'Wave' },
    { slug: 'mountain', category: 'nature', emoji: '\u26F0\uFE0F', label: 'Mountain' },

    // Food
    { slug: 'coffee', category: 'food', emoji: '\u2615', label: 'Coffee' },
    { slug: 'pizza', category: 'food', emoji: '\u{1F355}', label: 'Pizza' },
    { slug: 'cake', category: 'food', emoji: '\u{1F382}', label: 'Cake' },
    { slug: 'cookie', category: 'food', emoji: '\u{1F36A}', label: 'Cookie' },
    { slug: 'fruit', category: 'food', emoji: '\u{1F34E}', label: 'Apple' },

    // Activity
    { slug: 'book', category: 'activity', emoji: '\u{1F4DA}', label: 'Books' },
    { slug: 'music', category: 'activity', emoji: '\u{1F3B5}', label: 'Music' },
    { slug: 'art', category: 'activity', emoji: '\u{1F3A8}', label: 'Art' },
    { slug: 'camera', category: 'activity', emoji: '\u{1F4F7}', label: 'Camera' },
    { slug: 'travel', category: 'activity', emoji: '\u{1F30D}', label: 'Travel' },
    { slug: 'gaming', category: 'activity', emoji: '\u{1F3AE}', label: 'Gaming' },
    { slug: 'workout', category: 'activity', emoji: '\u{1F3CB}\uFE0F', label: 'Workout' }
];

// =============================================
// IMAGE COMPRESSION UTILITY
// =============================================
// Compresses an image file using Canvas API before upload.
// Returns { base64, mimeType, fileName } with the compressed image.
// maxDim: max width/height in pixels. quality: JPEG quality 0-1.
function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 1600;
    quality = quality || 0.88;
    return new Promise(function(resolve, reject) {
        // Non-image files pass through unchanged
        if (!file.type || !file.type.startsWith('image/')) {
            var reader = new FileReader();
            reader.onload = function() {
                resolve({ base64: reader.result.split(',')[1], mimeType: file.type, fileName: file.name });
            };
            reader.onerror = function() { reject(new Error('Failed to read file')); };
            reader.readAsDataURL(file);
            return;
        }

        var img = new Image();
        var url = URL.createObjectURL(file);
        img.onload = function() {
            URL.revokeObjectURL(url);

            var w = img.naturalWidth;
            var h = img.naturalHeight;

            // Resize to fit within maxDim while preserving aspect ratio
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round(h * (maxDim / w));
                    w = maxDim;
                } else {
                    w = Math.round(w * (maxDim / h));
                    h = maxDim;
                }
            }

            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            // Use high-quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            // Always output as JPEG for consistent small file sizes
            // (typically 80-200KB at 1600px / 88% quality)
            var outputType = 'image/jpeg';
            var ext = '.jpg';

            var dataUrl = canvas.toDataURL(outputType, quality);
            var base64 = dataUrl.split(',')[1];
            var newName = file.name.replace(/\.[^.]+$/, ext);

            resolve({ base64: base64, mimeType: outputType, fileName: newName });
        };
        img.onerror = function() {
            URL.revokeObjectURL(url);
            // Fallback: read raw if image can't be decoded
            var reader = new FileReader();
            reader.onload = function() {
                resolve({ base64: reader.result.split(',')[1], mimeType: file.type, fileName: file.name });
            };
            reader.onerror = function() { reject(new Error('Failed to read file')); };
            reader.readAsDataURL(file);
        };
        img.src = url;
    });
}

// =============================================
// THEME ENGINE (shared with DEFT)
// =============================================
const THEMES = {
    forest: {
        name: 'Forest',
        accent: '#A8D65B', accentWarm: '#F0A830',
        base: '#0F1008', surface: '#191C10', surfaceEl: '#232718', surfaceHi: '#2D3220',
        border: '#3A3F2C', success: '#6BCB77', warning: '#F0A830', danger: '#E85D5D',
        txt: '#EAE8E0', txt2: '#A09B8C', txt3: '#6B6758',
        headingFont: 'Nunito', bodyFont: 'DM Sans',
    },
    sunrise: {
        name: 'Sunrise',
        accent: '#F0A830', accentWarm: '#E85D5D',
        base: '#100D08', surface: '#1C1810', surfaceEl: '#272118', surfaceHi: '#322B20',
        border: '#3F382C', success: '#6BCB77', warning: '#F0A830', danger: '#E85D5D',
        txt: '#EAE8E0', txt2: '#A09B8C', txt3: '#6B6758',
        headingFont: 'Nunito', bodyFont: 'DM Sans',
    },
    ocean: {
        name: 'Ocean',
        accent: '#38BDF8', accentWarm: '#06D6A0',
        base: '#080D10', surface: '#10161C', surfaceEl: '#182027', surfaceHi: '#202A32',
        border: '#2C363F', success: '#6BCB77', warning: '#F0A830', danger: '#E85D5D',
        txt: '#E0E8EA', txt2: '#8C9BA0', txt3: '#586B6B',
        headingFont: 'Nunito', bodyFont: 'DM Sans',
    },
    berry: {
        name: 'Berry',
        accent: '#C084FC', accentWarm: '#FB7185',
        base: '#0D0810', surface: '#16101C', surfaceEl: '#201827', surfaceHi: '#2A2032',
        border: '#3A2C3F', success: '#6BCB77', warning: '#F0A830', danger: '#E85D5D',
        txt: '#E8E0EA', txt2: '#A08CA0', txt3: '#6B586B',
        headingFont: 'Nunito', bodyFont: 'DM Sans',
    },
    rdgr: {
        name: 'RDGR',
        accent: '#06D6A0', accentWarm: '#4CC9F0',
        base: '#08090D', surface: '#11131A', surfaceEl: '#1A1D28', surfaceHi: '#242836',
        border: '#2A2E3D', success: '#06D6A0', warning: '#FFD93D', danger: '#FF6B6B',
        txt: '#E8ECF1', txt2: '#8A95A9', txt3: '#525E73',
        headingFont: 'Chakra Petch', bodyFont: 'IBM Plex Sans',
    },
    monochrome: {
        name: 'Monochrome',
        accent: '#E8E8E8', accentWarm: '#A0A0A0',
        base: '#000000', surface: '#0A0A0A', surfaceEl: '#141414', surfaceHi: '#1E1E1E',
        border: '#2A2A2A', success: '#6BCB77', warning: '#F0A830', danger: '#E85D5D',
        txt: '#E8E8E8', txt2: '#A0A0A0', txt3: '#666666',
        headingFont: 'Nunito', bodyFont: 'DM Sans',
    },
};

function getThemeKey() {
    return `deft-theme-${activeProfileId || 'default'}`;
}

function loadTheme() {
    const saved = localStorage.getItem(getThemeKey());
    if (saved) {
        try { return JSON.parse(saved); } catch(e) {}
    }
    if (activeProfileId && activeProfileId !== 'default') {
        fetch(SUPABASE_URL + '/rest/v1/deft_user_profiles?user_id=eq.' + activeProfileId + '&select=preferences', {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        }).then(r => r.json()).then(d => {
            if (d && d[0] && d[0].preferences && d[0].preferences.theme) {
                localStorage.setItem(getThemeKey(), JSON.stringify(d[0].preferences.theme));
                applyTheme(d[0].preferences.theme);
            }
        }).catch(() => {});
    }
    return { preset: 'rdgr' };
}

function applyTheme(config) {
    const theme = config.preset === 'custom' ? config.custom : THEMES[config.preset] || THEMES.rdgr;
    const app = document.documentElement;
    app.style.setProperty('--deft-accent', theme.accent);
    app.style.setProperty('--deft-accent-dim', hexToRGBA(theme.accent, 0.15));
    app.style.setProperty('--deft-accent-warm', theme.accentWarm);
    app.style.setProperty('--deft-accent-warm-dim', hexToRGBA(theme.accentWarm, 0.15));
    app.style.setProperty('--deft-base', theme.base);
    app.style.setProperty('--deft-surface', theme.surface);
    app.style.setProperty('--deft-surface-el', theme.surfaceEl);
    app.style.setProperty('--deft-surface-hi', theme.surfaceHi);
    app.style.setProperty('--deft-border', theme.border);
    const so = config.statusOverrides || {};
    app.style.setProperty('--deft-success', so.success || theme.success);
    app.style.setProperty('--deft-success-dim', hexToRGBA(so.success || theme.success, 0.15));
    app.style.setProperty('--deft-warning', so.warning || theme.warning);
    app.style.setProperty('--deft-warning-dim', hexToRGBA(so.warning || theme.warning, 0.15));
    app.style.setProperty('--deft-danger', so.danger || theme.danger);
    app.style.setProperty('--deft-danger-dim', hexToRGBA(so.danger || theme.danger, 0.15));
    app.style.setProperty('--deft-txt', theme.txt);
    app.style.setProperty('--deft-txt-2', theme.txt2);
    app.style.setProperty('--deft-txt-3', theme.txt3);
    app.style.setProperty('--deft-heading-font', theme.headingFont);
    app.style.setProperty('--deft-body-font', theme.bodyFont);
    document.body.style.background = theme.base;
    document.body.style.color = theme.txt;
    document.body.style.fontFamily = `${theme.bodyFont}, system-ui, sans-serif`;
    loadFonts(theme.headingFont, theme.bodyFont);
}

function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function loadFonts(headingFont, bodyFont) {
    const fonts = new Set([headingFont, bodyFont, 'JetBrains Mono']);
    const families = Array.from(fonts).map(f => f.replace(/ /g, '+') + ':wght@400;500;600;700;800').join('&family=');
    const existing = document.getElementById('deft-fonts');
    if (existing) existing.remove();
    const link = document.createElement('link');
    link.id = 'deft-fonts';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
    document.head.appendChild(link);
}
