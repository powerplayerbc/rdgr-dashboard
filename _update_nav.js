/**
 * Nav bar updater — replaces the flat 18-tab nav with grouped dropdowns.
 * Run: node _update_nav.js
 *
 * Each page needs:
 * 1. The new dropdown CSS injected (if not already present)
 * 2. The old nav tab row replaced with the new grouped structure
 * 3. The correct "active" state based on the page's own URL
 */

const fs = require('fs');
const path = require('path');

// ═══ NAV STRUCTURE ═══
// Each group: { label, href, items: [{ label, href }] }
// Groups with no items array are standalone tabs
const NAV_GROUPS = [
    { label: 'Dashboard', href: '/' },
    { label: 'Rodger', href: '/chat', items: [
        { label: 'Rodger', href: '/chat' },
        { label: 'Council', href: '/council' },
    ]},
    { label: 'Outreach', href: '/crm', role: 'admin', items: [
        { label: 'CRM', href: '/crm' },
        { label: 'Email', href: '/email-outreach' },
        { label: 'Social', href: '/social-dashboard' },
        { label: 'Social Content', href: '/social-content' },
        { label: 'Offers', href: '/offer-studio' },
        { label: 'Client Projects', href: '/client-projects' },
    ]},
    { label: 'Finance', href: '/finance', role: 'admin', items: [
        { label: 'Dashboard', href: '/finance' },
    ]},
    { label: 'Brand', href: '/brand-discovery', items: [
        { label: 'Discovery', href: '/brand-discovery' },
        { label: 'Voice', href: '/brand-voice' },
        { label: 'Templates', href: '/template-studio' },
        { label: 'Docs', href: '/brand-documents' },
    ]},
    { label: 'Policy', href: '/bsi-discovery', role: 'admin', items: [
        { label: 'Discovery', href: '/bsi-discovery' },
        { label: 'Compliance', href: '/compliance' },
        { label: 'Documents', href: '/bsi-documents' },
    ]},
    { label: 'Content', href: '/content', items: [
        { label: 'Publishing', href: '/content' },
        { label: 'Media', href: '/media' },
    ]},
    { label: 'Partnerships', href: '/partnerships' },
    { label: 'BRAIN', href: '/brain', items: [
        { label: 'BRAIN', href: '/brain' },
        { label: 'DEFT', href: '/deft' },
        { label: 'Journal', href: '/journal' },
        { label: 'Pantry', href: '/pantry' },
        { label: 'Shopping', href: '/shopping' },
        { label: 'Meal Plan', href: '/meal-plan' },
        { label: 'School', href: '/school' },
    ]},
    { label: 'Trading', href: '/trading-desk', role: 'admin', items: [
        { label: 'Trading Desk', href: '/trading-desk' },
        { label: 'Bot Dashboard', href: '/trading-bot' },
        { label: 'Strategies', href: '/trading-strategies' },
        { label: 'Monitor', href: '/trading-monitor' },
        { label: 'Research', href: '/trading-research' },
        { label: 'Discovery', href: '/trading-discovery' },
        { label: 'Cross-Pairs', href: '/trading-cross-pairs' },
        { label: 'Exchanges', href: '/trading-exchanges' },
        { label: 'Config', href: '/trading-config' },
        { label: 'Reports', href: '/trading-reports' },
    ]},
    { label: 'Meetings', href: '/meetings' },
    { label: 'System', href: '/our-workflows', role: 'admin', items: [
        { label: 'Workflows', href: '/our-workflows' },
        { label: 'Org Map', href: '/org-chart' },
        { label: 'HUB', href: '/hub' },
        { label: 'Bug Reports', href: '/bug-reports' },
    ]},
];

// Map page URLs to source filenames (for active state detection)
const PAGE_URL_MAP = {
    'index.html': '/',
    'chat.html': '/chat',
    'council.html': '/council',
    'crm.html': '/crm',
    'email-outreach.html': '/email-outreach',
    'social-dashboard.html': '/social-dashboard',
    'offer-studio.html': '/offer-studio',
    'client-projects.html': '/client-projects',
    'brand-discovery.html': '/brand-discovery',
    'template-studio.html': '/template-studio',
    'brand-documents.html': '/brand-documents',
    'content.html': '/content',
    'media.html': '/media',
    'brain.html': '/brain',
    'deft.html': '/deft',
    'pantry.html': '/pantry',
    'school.html': '/school',
    'school/index.html': '/school',
    'shopping/index.html': '/shopping',
    'journal/index.html': '/journal',
    'meal-plan/index.html': '/meal-plan',
    'meetings.html': '/meetings',
    'our-workflows.html': '/our-workflows',
    'org-chart.html': '/org-chart',
    'hub.html': '/hub',
    'appearance.html': '/appearance',
    'profile.html': '/profile',
    'email-voice-settings.html': '/email-voice-settings',
    'settings.html': '/settings',
    'deft-settings.html': '/deft-settings',
    'scraper-settings.html': '/scraper-settings',
    'social-content.html': '/social-content',
    'social-voice-settings.html': '/social-voice-settings',
    'council-advisors-settings.html': '/council-advisors-settings',
    'knowledge-manager.html': '/knowledge-manager',
    'bsi-discovery.html': '/bsi-discovery',
    'compliance.html': '/compliance',
    'bsi-documents.html': '/bsi-documents',
    'trading-research.html': '/trading-research',
    'trading-bot.html': '/trading-bot',
    'trading-strategies.html': '/trading-strategies',
    'trading-monitor.html': '/trading-monitor',
    'trading-discovery.html': '/trading-discovery',
    'trading-cross-pairs.html': '/trading-cross-pairs',
    'trading-exchanges.html': '/trading-exchanges',
    'trading-config.html': '/trading-config',
    'trading-desk.html': '/trading-desk',
    'trading-reports.html': '/trading-reports',
    'subscribers.html': '/subscribers',
    'partnerships.html': '/partnerships',
    'finance/index.html': '/finance',
    'brand-voice/index.html': '/brand-voice',
    'bug-reports/index.html': '/bug-reports',
};

// ═══ CSS FOR DROPDOWN NAV ═══
const DROPDOWN_CSS = `
        /* ── Nav Dropdown System ── */
        .nav-group { position: relative; }
        .nav-group-btn {
            display: flex; align-items: center; gap: 0.25rem;
            padding: 0.3rem 0.75rem;
            font-size: 0.7rem; font-weight: 500;
            color: #8A95A9;
            border-radius: 0.375rem;
            text-decoration: none;
            cursor: pointer;
            transition: background 0.15s, color 0.15s;
            white-space: nowrap;
            border: none; background: transparent;
        }
        .nav-group-btn:hover { color: #E8ECF1; }
        .nav-group-btn.active {
            background: rgba(6,214,160,0.12);
            color: #06D6A0;
        }
        .nav-group-btn .chevron {
            transition: transform 0.2s;
            opacity: 0.5;
        }
        .nav-group:hover .nav-group-btn .chevron { transform: rotate(180deg); opacity: 0.8; }
        .nav-dropdown {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            min-width: 150px;
            padding: 0.375rem;
            border-radius: 0.5rem;
            border: 1px solid var(--deft-border, #2A2E3D);
            background: var(--deft-surface-el, #1A1D28);
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            opacity: 0;
            visibility: hidden;
            transform: translateY(-4px);
            transition: opacity 0.15s, visibility 0.15s, transform 0.15s;
            z-index: 70;
        }
        .nav-group:hover .nav-dropdown {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        .nav-dropdown a {
            display: block;
            padding: 0.4rem 0.625rem;
            font-size: 0.7rem;
            font-weight: 500;
            color: var(--deft-txt-2, #8A95A9);
            text-decoration: none;
            border-radius: 0.25rem;
            transition: background 0.12s, color 0.12s;
            white-space: nowrap;
        }
        .nav-dropdown a:hover {
            background: rgba(255,255,255,0.06);
            color: var(--deft-txt, #E8ECF1);
        }
        .nav-dropdown a.active {
            background: var(--deft-accent-dim, rgba(6,214,160,0.12));
            color: var(--deft-accent, #06D6A0);
        }
        /* Theme overrides for nav */
        .nav-group-btn.active {
            background: var(--deft-accent-dim, rgba(6,214,160,0.12)) !important;
            color: var(--deft-accent, #06D6A0) !important;
        }`;

// ═══ MOBILE NAV CSS ═══
const MOBILE_NAV_CSS = `
        /* ── Mobile Nav System ── */
        .mobile-menu-btn {
            display: none;
            align-items: center; justify-content: center;
            width: 32px; height: 32px;
            border: 1px solid var(--deft-border, #2A2E3D);
            border-radius: 0.375rem;
            background: transparent;
            color: var(--deft-txt-2, #8A95A9);
            cursor: pointer;
            transition: background 0.15s, color 0.15s;
            flex-shrink: 0;
        }
        .mobile-menu-btn:hover { background: rgba(255,255,255,0.06); color: var(--deft-txt, #E8ECF1); }
        @media (max-width: 639px) { .mobile-menu-btn { display: flex; } }
        #mobileNavOverlay {
            position: fixed; inset: 0; z-index: 200;
            display: none; opacity: 0;
            transition: opacity 0.2s ease;
        }
        #mobileNavOverlay.open { display: flex; opacity: 1; }
        .mobile-nav-backdrop {
            position: absolute; inset: 0;
            background: rgba(0,0,0,0.5);
        }
        .mobile-nav-sidebar {
            position: relative; z-index: 1;
            width: 280px; max-width: 85vw; height: 100vh;
            background: var(--deft-base, #11131A);
            border-right: 1px solid var(--deft-border, #2A2E3D);
            overflow-y: auto;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            padding: 0.75rem 0;
        }
        #mobileNavOverlay.open .mobile-nav-sidebar { transform: translateX(0); }
        .mobile-nav-close {
            display: flex; align-items: center; justify-content: center;
            width: 28px; height: 28px;
            border: none; background: transparent;
            color: var(--deft-txt-3, #525E73);
            cursor: pointer; font-size: 1.1rem;
            border-radius: 0.25rem;
            transition: background 0.12s, color 0.12s;
        }
        .mobile-nav-close:hover { background: rgba(255,255,255,0.06); color: var(--deft-txt, #E8ECF1); }
        .mobile-nav-link {
            display: block;
            padding: 0.5rem 1.25rem;
            font-size: 0.75rem; font-weight: 500;
            color: var(--deft-txt-2, #8A95A9);
            text-decoration: none;
            transition: background 0.12s, color 0.12s;
        }
        .mobile-nav-link:hover { background: rgba(255,255,255,0.04); color: var(--deft-txt, #E8ECF1); }
        .mobile-nav-link.active {
            background: var(--deft-accent-dim, rgba(6,214,160,0.12));
            color: var(--deft-accent, #06D6A0);
        }
        .mobile-nav-group-btn {
            display: flex; align-items: center; justify-content: space-between;
            width: 100%; padding: 0.5rem 1.25rem;
            font-size: 0.75rem; font-weight: 500;
            color: var(--deft-txt-2, #8A95A9);
            background: transparent; border: none;
            cursor: pointer;
            transition: background 0.12s, color 0.12s;
            text-align: left;
        }
        .mobile-nav-group-btn:hover { background: rgba(255,255,255,0.04); color: var(--deft-txt, #E8ECF1); }
        .mobile-nav-group-btn.active { color: var(--deft-accent, #06D6A0); }
        .mobile-nav-group-btn .mn-chevron {
            transition: transform 0.2s; opacity: 0.5;
        }
        .mobile-nav-group-btn.expanded .mn-chevron { transform: rotate(180deg); opacity: 0.8; }
        .mobile-nav-children {
            display: none;
            padding-left: 1rem;
        }
        .mobile-nav-children.open { display: block; }
        .mobile-nav-divider {
            height: 1px;
            background: var(--deft-border, #2A2E3D);
            margin: 0.375rem 1rem;
        }`;

// ═══ MOBILE NAV JS ═══
const MOBILE_NAV_JS = `<script>
function toggleMobileNav(){var o=document.getElementById('mobileNavOverlay');if(o.classList.contains('open')){o.style.opacity='0';o.querySelector('.mobile-nav-sidebar').style.transform='translateX(-100%)';setTimeout(function(){o.classList.remove('open');o.style.display='none';},250);}else{o.style.display='flex';requestAnimationFrame(function(){o.classList.add('open');o.style.opacity='1';o.querySelector('.mobile-nav-sidebar').style.transform='translateX(0)';});}}
function toggleMobileAccordion(btn){btn.classList.toggle('expanded');var ch=btn.nextElementSibling;ch.classList.toggle('open');}
document.getElementById('mobileNavOverlay')?.querySelector('.mobile-nav-backdrop')?.addEventListener('click',function(){toggleMobileNav();});
document.querySelectorAll('#mobileNavOverlay .mobile-nav-link').forEach(function(a){a.addEventListener('click',function(){toggleMobileNav();});});
</script>`;

// ═══ BUG REPORT FAB — CSS ═══
const BUG_REPORT_CSS = `
        /* ── Bug Report FAB ── */
        .bug-report-fab {
            position: fixed;
            bottom: 1.5rem;
            left: 1.5rem;
            z-index: 190;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 1px solid var(--deft-border, #2A2E3D);
            background: var(--deft-surface-el, #1A1D28);
            color: var(--deft-txt-3, #525E73);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s, color 0.15s, box-shadow 0.15s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            padding: 0; line-height: 1;
        }
        .bug-report-fab:hover {
            background: rgba(255,107,107,0.12);
            color: #FF6B6B;
            border-color: rgba(255,107,107,0.3);
            box-shadow: 0 4px 16px rgba(255,107,107,0.15);
        }
        .bug-report-fab .bug-badge {
            position: absolute; top: -4px; right: -4px;
            min-width: 16px; height: 16px; border-radius: 8px;
            background: #FF6B6B; color: #fff;
            font-size: 0.55rem; font-weight: 700;
            display: none; align-items: center; justify-content: center;
            padding: 0 3px;
        }
        .bug-report-modal { z-index: 195 !important; }
        .bug-report-modal .modal-content {
            max-width: 500px; width: 92vw;
        }
        .bug-form-label {
            display: block; font-size: 0.65rem; font-weight: 600;
            color: var(--deft-txt-2, #8A95A9);
            margin-bottom: 0.25rem;
            text-transform: uppercase; letter-spacing: 0.03em;
        }
        .bug-console-log {
            max-height: 100px; overflow-y: auto;
            padding: 0.4rem; border-radius: 0.375rem;
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--deft-border, #2A2E3D);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.6rem; line-height: 1.4;
        }
        .bug-ce { color: #FF6B6B; }
        .bug-cw { color: #FFD93D; }
        .bug-cn { color: var(--deft-txt-3, #525E73); font-style: italic; }`;

// ═══ BUG REPORT FAB — HTML ═══
const BUG_REPORT_HTML = `
    <!-- Bug Report FAB -->
    <button class="bug-report-fab" id="bugReportBtn" onclick="_openBugReport()" title="Report a bug">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.88 1.88"/><path d="M14.12 3.88L16 2"/><path d="M9 7.13v-1a3.003 3.003 0 116 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
        <span class="bug-badge" id="bugBadge">0</span>
    </button>

    <!-- Bug Report Modal -->
    <div class="modal-backdrop bug-report-modal" id="bugReportModal">
        <div class="modal-content" style="padding:1.25rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
                <h3 style="font-size:0.95rem;font-weight:700;color:var(--deft-txt,#E8ECF1);margin:0;font-family:var(--deft-heading-font,'Chakra Petch'),sans-serif;">Report Bug / Request Update</h3>
                <button onclick="document.getElementById('bugReportModal').classList.remove('active')" style="background:none;border:none;color:var(--deft-txt-3,#525E73);cursor:pointer;font-size:1.2rem;padding:0.25rem;">&times;</button>
            </div>
            <div style="margin-bottom:0.75rem;">
                <label class="bug-form-label">Page</label>
                <div id="bugPageUrl" style="font-size:0.75rem;color:var(--deft-accent,#06D6A0);font-family:'JetBrains Mono',monospace;padding:0.3rem 0.5rem;background:rgba(0,0,0,0.2);border-radius:0.25rem;border:1px solid var(--deft-border,#2A2E3D);"></div>
            </div>
            <div style="margin-bottom:0.75rem;">
                <label class="bug-form-label">What's wrong? / What needs updating?</label>
                <textarea id="bugDescription" rows="4" placeholder="Describe the issue or update needed..." style="width:100%;resize:vertical;padding:0.5rem;border-radius:0.375rem;background:var(--deft-surface,#11131A);border:1px solid var(--deft-border,#2A2E3D);color:var(--deft-txt,#E8ECF1);font-size:0.8rem;font-family:var(--deft-body-font,'IBM Plex Sans'),sans-serif;"></textarea>
            </div>
            <div style="margin-bottom:0.75rem;">
                <label class="bug-form-label">Console Errors / Warnings</label>
                <div class="bug-console-log" id="bugConsoleLog"><span class="bug-cn">No console errors captured</span></div>
            </div>
            <div style="display:flex;gap:0.75rem;align-items:flex-end;margin-bottom:1rem;">
                <div style="flex:1;">
                    <label class="bug-form-label">Priority</label>
                    <select id="bugPriority" style="width:100%;padding:0.35rem 0.5rem;border-radius:0.375rem;background:var(--deft-surface,#11131A);border:1px solid var(--deft-border,#2A2E3D);color:var(--deft-txt,#E8ECF1);font-size:0.75rem;">
                        <option value="low">Low</option>
                        <option value="normal" selected>Normal</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>
            </div>
            <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
                <button onclick="document.getElementById('bugReportModal').classList.remove('active')" style="padding:0.4rem 1rem;border-radius:0.375rem;border:1px solid var(--deft-border,#2A2E3D);background:transparent;color:var(--deft-txt-2,#8A95A9);font-size:0.75rem;cursor:pointer;">Cancel</button>
                <button onclick="_submitBugReport()" id="bugSubmitBtn" style="padding:0.4rem 1rem;border-radius:0.375rem;border:1px solid rgba(255,107,107,0.3);background:rgba(255,107,107,0.12);color:#FF6B6B;font-size:0.75rem;font-weight:600;cursor:pointer;">Submit Bug Report</button>
            </div>
        </div>
    </div>`;

// ═══ BUG REPORT FAB — JS ═══
const BUG_REPORT_JS = `<script>
(function(){
var _ce=[],_cw=[];
var _oe=console.error,_ow=console.warn;
function _s(a){return Array.from(a).map(function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ');}
console.error=function(){_ce.push({m:_s(arguments),t:new Date().toISOString()});if(_ce.length>50)_ce.shift();_ub();_oe.apply(console,arguments);};
console.warn=function(){_cw.push({m:_s(arguments),t:new Date().toISOString()});if(_cw.length>50)_cw.shift();_ow.apply(console,arguments);};
window.addEventListener('error',function(e){_ce.push({m:e.message+(e.filename?' at '+e.filename+':'+e.lineno:''),t:new Date().toISOString()});_ub();});
window.addEventListener('unhandledrejection',function(e){_ce.push({m:'Unhandled Promise: '+(e.reason&&e.reason.message||e.reason||'Unknown'),t:new Date().toISOString()});_ub();});
function _ub(){var b=document.getElementById('bugBadge');if(b){b.textContent=_ce.length;b.style.display=_ce.length>0?'flex':'none';}}
function _esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
window._openBugReport=function(){
var m=document.getElementById('bugReportModal');if(!m)return;
document.getElementById('bugPageUrl').textContent=location.pathname;
var log=document.getElementById('bugConsoleLog'),items=[];
_ce.forEach(function(e){items.push('<div class="bug-ce">[ERROR] '+_esc(e.m)+'</div>');});
_cw.forEach(function(w){items.push('<div class="bug-cw">[WARN] '+_esc(w.m)+'</div>');});
log.innerHTML=items.length?items.join(''):'<span class="bug-cn">No console errors captured</span>';
m.classList.add('active');
var ta=document.getElementById('bugDescription');if(ta)ta.focus();
};
window._submitBugReport=async function(){
var desc=document.getElementById('bugDescription').value.trim();
if(!desc){if(typeof toast==='function')toast('Please describe the issue','error');return;}
var btn=document.getElementById('bugSubmitBtn');if(btn){btn.disabled=true;btn.textContent='Submitting...';}
var SB='https://yrwrswyjawmgtxrgbnim.supabase.co';
var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8';
try{
var r=await fetch(SB+'/rest/v1/user_bug_reports',{method:'POST',headers:{'apikey':SK,'Authorization':'Bearer '+SK,'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({page_url:location.pathname,page_title:document.title,user_description:desc,console_errors:_ce,console_warnings:_cw,browser_info:{userAgent:navigator.userAgent,viewport:window.innerWidth+'x'+window.innerHeight,timestamp:new Date().toISOString()},priority:document.getElementById('bugPriority').value,status:'open'})});
if(r.ok){var d=await r.json();if(typeof toast==='function')toast('Bug report '+d[0].report_id+' submitted!','success');document.getElementById('bugDescription').value='';document.getElementById('bugReportModal').classList.remove('active');_ce.length=0;_cw.length=0;_ub();}
else{var e=await r.text();if(typeof toast==='function')toast('Failed: '+e,'error');}
}catch(ex){if(typeof toast==='function')toast('Error: '+ex.message,'error');}
finally{if(btn){btn.disabled=false;btn.textContent='Submit Bug Report';}}
};
})();
</script>`;

// ═══ BUILD MOBILE NAV HTML ═══
function buildMobileNavHTML(activeUrl) {
    let activeGroupIdx = -1;
    NAV_GROUPS.forEach((g, gi) => {
        if (g.href === activeUrl) activeGroupIdx = gi;
        if (g.items) {
            g.items.forEach(item => {
                if (item.href === activeUrl) activeGroupIdx = gi;
            });
        }
    });

    const chevronSvg = '<svg class="mn-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';

    let items = '';
    NAV_GROUPS.forEach((group, gi) => {
        const isGroupActive = gi === activeGroupIdx;

        const mRoleAttr = group.role ? ` data-nav-role="${group.role}"` : '';

        if (!group.items) {
            // Standalone link
            items += `<a href="${group.href}" class="mobile-nav-link${isGroupActive ? ' active' : ''}"${mRoleAttr}>${group.label}</a>\n`;
        } else {
            // Group with children - accordion
            const shouldExpand = isGroupActive;
            items += `<div${mRoleAttr}><button class="mobile-nav-group-btn${isGroupActive ? ' active' : ''}${shouldExpand ? ' expanded' : ''}" onclick="toggleMobileAccordion(this)">${group.label} ${chevronSvg}</button>\n`;
            items += `<div class="mobile-nav-children${shouldExpand ? ' open' : ''}">\n`;
            group.items.forEach(item => {
                const isItemActive = item.href === activeUrl;
                items += `    <a href="${item.href}" class="mobile-nav-link${isItemActive ? ' active' : ''}">${item.label}</a>\n`;
            });
            items += `</div></div>\n`;
        }
    });

    return items;
}

// ═══ BUILD HAMBURGER BUTTON HTML ═══
function buildHamburgerHTML() {
    return `<button class="mobile-menu-btn" onclick="toggleMobileNav()" aria-label="Open menu"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>`;
}

// ═══ BUILD NAV HTML ═══
function buildNavHTML(activeUrl) {
    // Determine which group is active (parent) and which item is active
    let activeGroupIdx = -1;
    NAV_GROUPS.forEach((g, gi) => {
        if (g.href === activeUrl) activeGroupIdx = gi;
        if (g.items) {
            g.items.forEach(item => {
                if (item.href === activeUrl) activeGroupIdx = gi;
            });
        }
    });

    const tabs = NAV_GROUPS.map((group, gi) => {
        const isGroupActive = gi === activeGroupIdx;

        const roleAttr = group.role ? ` data-nav-role="${group.role}"` : '';

        if (!group.items) {
            // Standalone tab (no dropdown)
            return `<a href="${group.href}" class="nav-group-btn${isGroupActive ? ' active' : ''}"${roleAttr}>${group.label}</a>`;
        }

        // Group with dropdown
        const chevron = `<svg class="chevron" width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
        const dropdownItems = group.items.map(item => {
            const isItemActive = item.href === activeUrl;
            return `<a href="${item.href}"${isItemActive ? ' class="active"' : ''}>${item.label}</a>`;
        }).join('\n                                ');

        return `<div class="nav-group"${roleAttr}>
                            <a href="${group.href}" class="nav-group-btn${isGroupActive ? ' active' : ''}">${group.label} ${chevron}</a>
                            <div class="nav-dropdown">
                                ${dropdownItems}
                            </div>
                        </div>`;
    }).join('\n                        ');

    return tabs;
}

// ═══ PROCESS FILES ═══
const skip = ['builder-test.html', 'page-builder.html', '_update_nav.js', '_test_script.js'];
const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && !skip.includes(f));

// Auto-discover all subdirectory index.html files
fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !['node_modules', '.git', 'docs'].includes(d.name))
    .forEach(d => {
        const subIndex = path.join(d.name, 'index.html');
        if (fs.existsSync(path.join(dir, subIndex))) {
            files.push(subIndex);
        }
    });

let updated = 0;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    // Derive URL from file path: 'pantry.html' -> '/pantry', 'pantry/index.html' -> '/pantry'
    const fileNorm = file.replace(/\\/g, '/');
    let activeUrl = PAGE_URL_MAP[file] || PAGE_URL_MAP[fileNorm];
    if (!activeUrl) {
        if (fileNorm.endsWith('/index.html')) {
            activeUrl = '/' + fileNorm.replace('/index.html', '');
        } else if (file.endsWith('.html')) {
            activeUrl = '/' + file.replace('.html', '');
        } else {
            activeUrl = '/';
        }
    }

    // 1. Inject dropdown CSS if not already present
    if (!content.includes('.nav-group-btn {')) {
        let injected = false;
        const tailwindIdx = content.indexOf('src="https://cdn.tailwindcss.com"');
        if (tailwindIdx > -1) {
            // Try: insert before the </style> that precedes the Tailwind script
            const beforeTailwind = content.substring(0, tailwindIdx);
            const lastStyleClose = beforeTailwind.lastIndexOf('</style>');
            if (lastStyleClose > -1) {
                content = content.substring(0, lastStyleClose) + DROPDOWN_CSS + '\n    ' + content.substring(lastStyleClose);
                injected = true;
            }
        }
        if (!injected) {
            // Fallback: insert at the beginning of the first <style> block (after the <style> tag)
            const firstStyleIdx = content.indexOf('<style>');
            if (firstStyleIdx > -1) {
                const insertAt = firstStyleIdx + '<style>'.length;
                content = content.substring(0, insertAt) + DROPDOWN_CSS + content.substring(insertAt);
                injected = true;
            }
        }
        if (!injected) {
            console.log('WARNING: Could not inject nav CSS in: ' + file);
        }
    }

    // 2. Replace the nav tab row
    // Match the div containing all the flat task-tab links
    // Pattern: <div class="flex gap-1 p-0.5 rounded-lg ml-2 hidden sm:flex" ...> ... </div>
    const navStartPattern = /<div class="flex gap-1 p-0\.5 rounded-lg ml-2 hidden sm:flex"[^>]*>/;
    const navStartMatch = content.match(navStartPattern);

    if (!navStartMatch) {
        console.log('Nav container not found in: ' + file);
        return;
    }

    const navStartIdx = content.indexOf(navStartMatch[0]);
    // Find the closing </div> for this nav container
    // We need to count nested divs
    let depth = 1;
    let searchIdx = navStartIdx + navStartMatch[0].length;
    while (depth > 0 && searchIdx < content.length) {
        const nextOpen = content.indexOf('<div', searchIdx);
        const nextClose = content.indexOf('</div>', searchIdx);

        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++;
            searchIdx = nextOpen + 4;
        } else {
            depth--;
            if (depth === 0) {
                // Found the matching close
                const navEndIdx = nextClose + '</div>'.length;
                const navHTML = buildNavHTML(activeUrl);
                const newNavContainer = `<div class="flex gap-1 p-0.5 rounded-lg ml-2 hidden sm:flex" style="background: rgba(255,255,255,0.04);">
                        ${navHTML}
                    </div>`;
                content = content.substring(0, navStartIdx) + newNavContainer + content.substring(navEndIdx);
            }
            searchIdx = nextClose + 6;
        }
    }

    // 3. Inject role-based nav filtering script if not already present
    const roleFilterScript = `<script>try{var _rp=JSON.parse(localStorage.getItem('rdgr-active-profile')||'{}');if(_rp.role==='student'){document.querySelectorAll('[data-nav-role=\"admin\"]').forEach(function(el){el.style.display='none';});}}catch(e){}</script>`;
    if (!content.includes('data-nav-role')) {
        const navCloseForRole = content.indexOf('</nav>');
        if (navCloseForRole > -1) {
            const insertAtRole = navCloseForRole + '</nav>'.length;
            content = content.substring(0, insertAtRole) + '\n        ' + roleFilterScript + content.substring(insertAtRole);
        }
    }

    // 3b. Inject click prevention script if not already present
    const clickPreventScript = `<script>document.querySelector('nav').addEventListener('click',function(e){var l=e.target.closest('.nav-group-btn.active,.nav-dropdown a.active');if(l)e.preventDefault();});</script>`;
    if (!content.includes("closest('.nav-group-btn.active")) {
        // Insert right after </nav>
        const navCloseIdx = content.indexOf('</nav>');
        if (navCloseIdx > -1) {
            const insertAt = navCloseIdx + '</nav>'.length;
            content = content.substring(0, insertAt) + '\n        ' + clickPreventScript + content.substring(insertAt);
        }
    }

    // 4. Inject mobile nav CSS if not already present
    if (!content.includes('.mobile-menu-btn {')) {
        // Insert mobile CSS alongside dropdown CSS
        const dropdownCssMarker = content.indexOf('.nav-group-btn {');
        if (dropdownCssMarker > -1) {
            // Find the end of the dropdown CSS block (look for the closing of the last rule)
            const markerSection = content.substring(dropdownCssMarker);
            // Insert after the nav-group-btn.active rule that ends the DROPDOWN_CSS
            const themeOverrideEnd = content.indexOf('color: var(--deft-accent, #06D6A0) !important;\n        }');
            if (themeOverrideEnd > -1) {
                const insertAt = content.indexOf('}', themeOverrideEnd + 50) + 1;
                content = content.substring(0, insertAt) + MOBILE_NAV_CSS + content.substring(insertAt);
            }
        } else {
            // Fallback: inject before </style>
            const styleCloseIdx = content.indexOf('</style>');
            if (styleCloseIdx > -1) {
                content = content.substring(0, styleCloseIdx) + MOBILE_NAV_CSS + '\n    ' + content.substring(styleCloseIdx);
            }
        }
    }

    // 5. Remove any existing old-style mobile nav (flat scrollable tabs)
    const oldMobileNavPattern = /<div class="flex gap-1 p-1 overflow-x-auto sm:hidden[^>]*>[\s\S]*?<\/div>\s*(?=<\/nav>|<!--)/;
    content = content.replace(oldMobileNavPattern, '');
    // Also remove variant patterns
    const oldMobileNavPattern2 = /<!-- Mobile nav -->\s*<div class="flex gap-1 p-1[^>]*sm:hidden[^>]*>[\s\S]*?<\/div>/;
    content = content.replace(oldMobileNavPattern2, '');

    // 6. Inject hamburger button into nav bar (after title, before desktop nav)
    if (!content.includes('aria-label="Open menu"')) {
        // Find the desktop nav container and insert hamburger just before it
        const desktopNavIdx = content.indexOf('<div class="flex gap-1 p-0.5 rounded-lg ml-2 hidden sm:flex"');
        if (desktopNavIdx > -1) {
            const hamburgerHTML = buildHamburgerHTML();
            content = content.substring(0, desktopNavIdx) + hamburgerHTML + '\n                    ' + content.substring(desktopNavIdx);
        }
    }

    // 7. Inject mobile nav overlay panel before </nav> if not present
    if (!content.includes('id="mobileNavOverlay"')) {
        const navCloseIdx = content.indexOf('</nav>');
        if (navCloseIdx > -1) {
            const mobileNavItems = buildMobileNavHTML(activeUrl);
            const mobileNavPanel = `
        <!-- Mobile Nav Overlay -->
        <div id="mobileNavOverlay">
            <div class="mobile-nav-backdrop"></div>
            <div class="mobile-nav-sidebar">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 1rem 0.75rem;">
                    <span style="font-size:0.8rem;font-weight:700;color:var(--deft-txt,#E8ECF1);">Menu</span>
                    <button class="mobile-nav-close" onclick="toggleMobileNav()">&times;</button>
                </div>
                <div class="mobile-nav-divider"></div>
                ${mobileNavItems}
            </div>
        </div>
`;
            content = content.substring(0, navCloseIdx) + mobileNavPanel + '        ' + content.substring(navCloseIdx);
        }
    }

    // 8. Inject mobile nav JS if not present
    if (!content.includes('toggleMobileNav')) {
        const navCloseIdx = content.indexOf('</nav>');
        if (navCloseIdx > -1) {
            const afterNav = navCloseIdx + '</nav>'.length;
            content = content.substring(0, afterNav) + '\n        ' + MOBILE_NAV_JS + content.substring(afterNav);
        }
    }

    // 9. Inject shared-nav.js runtime loader before </body> if not present
    if (!content.includes('shared-nav.js')) {
        const bodyCloseIdx = content.indexOf('</body>');
        if (bodyCloseIdx > -1) {
            content = content.substring(0, bodyCloseIdx) + '<script src="/js/shared-nav.js"></script>\n' + content.substring(bodyCloseIdx);
        }
    }

    // 10. Inject bug report CSS if not already present
    if (!content.includes('.bug-report-fab {')) {
        const styleCloseIdx = content.lastIndexOf('</style>');
        if (styleCloseIdx > -1) {
            content = content.substring(0, styleCloseIdx) + BUG_REPORT_CSS + '\n    ' + content.substring(styleCloseIdx);
        }
    }

    // 10. Inject bug report button + modal + JS before </body>
    if (!content.includes('id="bugReportBtn"')) {
        const bodyCloseIdx = content.indexOf('</body>');
        if (bodyCloseIdx > -1) {
            content = content.substring(0, bodyCloseIdx) + BUG_REPORT_HTML + '\n' + BUG_REPORT_JS + '\n' + content.substring(bodyCloseIdx);
        }
    }

    fs.writeFileSync(filePath, content);
    updated++;
    console.log('Updated: ' + file);
});

console.log(`\nDone. ${updated} files updated.`);
