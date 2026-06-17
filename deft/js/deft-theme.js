// ═══════════════════════════════════════
// DEFT Theme Management
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// THEME MANAGEMENT
// ═══════════════════════════════════════
function getThemeKey() {
    return `deft-theme-${activeProfileId || 'default'}`;
}

function loadTheme() {
    const saved = localStorage.getItem(getThemeKey());
    if (saved) {
        try { return JSON.parse(saved); } catch(e) {}
    }
    // Async fallback: fetch from Supabase if localStorage is empty
    if (activeProfileId && activeProfileId !== 'default') {
        fetch('https://carltondb.72.60.67.2.sslip.io/rest/v1/deft_user_profiles?user_id=eq.' + activeProfileId + '&select=preferences', {
            headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6ImNhcmx0b24iLCJpYXQiOjE3ODE2OTUzMDksImV4cCI6MjA5NzA1NTMwOX0.Tazw1TnCAXYY6Na6E7muccoLad3NrJltf9GUCPbNnSc' }
        }).then(r => r.json()).then(d => {
            if (d && d[0] && d[0].preferences && d[0].preferences.theme) {
                localStorage.setItem(getThemeKey(), JSON.stringify(d[0].preferences.theme));
                applyTheme(d[0].preferences.theme);
            }
        }).catch(() => {});
    }
    return { preset: 'forest' };
}

function applyTheme(config) {
    const theme = config.preset === 'custom' ? config.custom : THEMES[config.preset] || THEMES.forest;
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
    // Status colors: use overrides if set, otherwise theme defaults
    const so = config.statusOverrides || {};
    const successColor = so.success || theme.success;
    const warningColor = so.warning || theme.warning;
    const dangerColor = so.danger || theme.danger;
    app.style.setProperty('--deft-success', successColor);
    app.style.setProperty('--deft-success-dim', hexToRGBA(successColor, 0.15));
    app.style.setProperty('--deft-warning', warningColor);
    app.style.setProperty('--deft-warning-dim', hexToRGBA(warningColor, 0.15));
    app.style.setProperty('--deft-danger', dangerColor);
    app.style.setProperty('--deft-danger-dim', hexToRGBA(dangerColor, 0.15));
    app.style.setProperty('--deft-txt', theme.txt);
    app.style.setProperty('--deft-txt-2', theme.txt2);
    app.style.setProperty('--deft-txt-3', theme.txt3);
    app.style.setProperty('--deft-heading-font', theme.headingFont);
    app.style.setProperty('--deft-body-font', theme.bodyFont);
    // Update body styles
    document.body.style.background = theme.base;
    document.body.style.color = theme.txt;
    document.body.style.fontFamily = `${theme.bodyFont}, system-ui, sans-serif`;
    // Dynamically load needed fonts if switching themes
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

function saveTheme(config) {
    localStorage.setItem(getThemeKey(), JSON.stringify(config));
    applyTheme(config);
    // Async sync to Supabase (fire and forget)
    if (activeProfileId) {
        syncThemeToSupabase(config);
    }
}

async function syncThemeToSupabase(config) {
    try {
        const profile = await supabaseSelect('deft_user_profiles', `user_id=eq.${activeProfileId}&select=preferences`);
        if (profile && profile[0]) {
            const prefs = profile[0].preferences || {};
            prefs.theme = config;
            await supabaseWrite('deft_user_profiles', 'PATCH', { preferences: prefs }, `user_id=eq.${activeProfileId}`);
        }
    } catch(e) { console.warn('Theme sync failed:', e); }
}
