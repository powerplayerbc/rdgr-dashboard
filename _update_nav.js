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
    { label: 'Outreach', href: '/crm', items: [
        { label: 'CRM', href: '/crm' },
        { label: 'Email', href: '/email-outreach' },
        { label: 'Social', href: '/social-dashboard' },
        { label: 'Social Content', href: '/social-content' },
        { label: 'Offers', href: '/offer-studio' },
    ]},
    { label: 'Finance', href: '/finance', items: [
        { label: 'Dashboard', href: '/finance' },
    ]},
    { label: 'Brand', href: '/brand-discovery', items: [
        { label: 'Discovery', href: '/brand-discovery' },
        { label: 'Templates', href: '/template-studio' },
        { label: 'Docs', href: '/brand-documents' },
    ]},
    { label: 'Policy', href: '/bsi-discovery', items: [
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
    ]},
    { label: 'Trading', href: '/trading-desk', items: [
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
    { label: 'System', href: '/our-workflows', items: [
        { label: 'Workflows', href: '/our-workflows' },
        { label: 'Org Map', href: '/org-chart' },
        { label: 'HUB', href: '/hub' },
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
    'brand-discovery.html': '/brand-discovery',
    'template-studio.html': '/template-studio',
    'brand-documents.html': '/brand-documents',
    'content.html': '/content',
    'media.html': '/media',
    'brain.html': '/brain',
    'deft.html': '/deft',
    'meetings.html': '/meetings',
    'our-workflows.html': '/our-workflows',
    'org-chart.html': '/org-chart',
    'hub.html': '/hub',
    'appearance.html': '/appearance',
    'profile.html': '/profile',
    'settings.html': '/email-voice-settings',
    'settings-directory.html': '/settings',
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
    'partnership.html': '/partnerships',
    'finance/index.html': '/finance',
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

        if (!group.items) {
            // Standalone link
            items += `<a href="${group.href}" class="mobile-nav-link${isGroupActive ? ' active' : ''}">${group.label}</a>\n`;
        } else {
            // Group with children - accordion
            const shouldExpand = isGroupActive;
            items += `<button class="mobile-nav-group-btn${isGroupActive ? ' active' : ''}${shouldExpand ? ' expanded' : ''}" onclick="toggleMobileAccordion(this)">${group.label} ${chevronSvg}</button>\n`;
            items += `<div class="mobile-nav-children${shouldExpand ? ' open' : ''}">\n`;
            group.items.forEach(item => {
                const isItemActive = item.href === activeUrl;
                items += `    <a href="${item.href}" class="mobile-nav-link${isItemActive ? ' active' : ''}">${item.label}</a>\n`;
            });
            items += `</div>\n`;
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

        if (!group.items) {
            // Standalone tab (no dropdown)
            return `<a href="${group.href}" class="nav-group-btn${isGroupActive ? ' active' : ''}">${group.label}</a>`;
        }

        // Group with dropdown
        const chevron = `<svg class="chevron" width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
        const dropdownItems = group.items.map(item => {
            const isItemActive = item.href === activeUrl;
            return `<a href="${item.href}"${isItemActive ? ' class="active"' : ''}>${item.label}</a>`;
        }).join('\n                                ');

        return `<div class="nav-group">
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

// Also include subdirectory HTML files
const financePath = path.join(dir, 'finance', 'index.html');
if (fs.existsSync(financePath)) {
    files.push('finance/index.html');
}

let updated = 0;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const activeUrl = PAGE_URL_MAP[file] || '/';

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

    // 3. Inject click prevention script if not already present
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

    fs.writeFileSync(filePath, content);
    updated++;
    console.log('Updated: ' + file);
});

console.log(`\nDone. ${updated} files updated.`);
