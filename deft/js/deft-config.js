// ═══════════════════════════════════════
// DEFT Config — Constants & Theme Definitions
// ═══════════════════════════════════════

// Migrate old localStorage key
if (!localStorage.getItem('rdgr-active-profile') && localStorage.getItem('rdgr-active-profile')) {
    localStorage.setItem('rdgr-active-profile', localStorage.getItem('rdgr-active-profile'));
    localStorage.removeItem('rdgr-active-profile');
}

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════
const SUPABASE_URL = 'https://yrwrswyjawmgtxrgbnim.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8';
const DEFT_BRIDGE_URL = 'https://n8n.carltonaiservices.com/webhook/deft-bridge';

// ═══════════════════════════════════════
// THEME ENGINE
// ═══════════════════════════════════════
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
