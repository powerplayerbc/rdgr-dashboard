/**
 * RDGR Shared Navigation — Runtime Loader
 * Single source of truth for navigation structure.
 * Replaces inline nav content on every page load to ensure consistency.
 *
 * Also injects:
 *   - A full nav shell into <div id="nav-root"></div> on minimal pages
 *     (e.g. /today, /scheduling-settings) that have no inline <nav>.
 *   - The bug-report widget (FAB + modal + console capture) on every page
 *     that loads this script, guarded so it never duplicates an inline widget.
 *
 * Update NAV_GROUPS here — all pages reflect changes automatically.
 */
(function () {
    'use strict';

    // carltondb (canonical DB). Used as a fallback when the page hasn't
    // declared SUPABASE_URL / SUPABASE_ANON_KEY itself.
    var CARLTONDB_URL = 'https://carltondb.72.60.67.2.sslip.io';
    var CARLTONDB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6ImNhcmx0b24iLCJpYXQiOjE3ODE2OTUzMDksImV4cCI6MjA5NzA1NTMwOX0.Tazw1TnCAXYY6Na6E7muccoLad3NrJltf9GUCPbNnSc';

    // ═══ BUG-REPORT CONSOLE CAPTURE (install immediately) ═══
    var _ce = [], _cw = [];
    (function installConsoleCapture() {
        if (window.__rdgrConsoleCaptured) return; // don't double-hook
        window.__rdgrConsoleCaptured = true;
        var _oe = console.error, _ow = console.warn;
        function _s(a) { return Array.from(a).map(function (x) { try { return typeof x === 'object' ? JSON.stringify(x) : String(x); } catch (e) { return String(x); } }).join(' '); }
        console.error = function () { _ce.push({ m: _s(arguments), t: new Date().toISOString() }); if (_ce.length > 50) _ce.shift(); _ub(); _oe.apply(console, arguments); };
        console.warn = function () { _cw.push({ m: _s(arguments), t: new Date().toISOString() }); if (_cw.length > 50) _cw.shift(); _ow.apply(console, arguments); };
        window.addEventListener('error', function (e) { _ce.push({ m: e.message + (e.filename ? ' at ' + e.filename + ':' + e.lineno : ''), t: new Date().toISOString() }); _ub(); });
        window.addEventListener('unhandledrejection', function (e) { _ce.push({ m: 'Unhandled Promise: ' + (e.reason && e.reason.message || e.reason || 'Unknown'), t: new Date().toISOString() }); _ub(); });
    })();
    function _ub() { var b = document.getElementById('bugBadge'); if (b) { b.textContent = _ce.length; b.style.display = _ce.length > 0 ? 'flex' : 'none'; } }
    function _esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
    function _toast(msg, type) { if (typeof toast === 'function') { toast(msg, type); } else { try { console.log('[' + (type || 'info') + '] ' + msg); } catch (e) {} alert(msg); } }

    // ═══ NAV STRUCTURE (single source of truth) ═══
    var NAV_GROUPS = [
        { label: 'Dashboard', href: '/' },
        { label: 'Rodger', href: '/chat', items: [
            { label: 'Rodger', href: '/chat' },
            { label: 'Council', href: '/council' },
        ]},
        { label: 'DiannaX', href: '/diannax', items: [
            { label: 'DiannaX', href: '/diannax' },
            { label: 'Feelings', href: '/diannax-feelings' },
            { label: 'Settings', href: '/diannax-settings' },
        ]},
        { label: 'Outreach', href: '/crm', role: 'admin', items: [
            { label: 'CRM', href: '/crm' },
            { label: 'Email', href: '/email-outreach' },
            { label: 'Social', href: '/social-dashboard' },
            { label: 'Social Content', href: '/social-content' },
            { label: 'Offers', href: '/offer-studio' },
            { label: 'Subscribers', href: '/subscribers' },
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
            { label: 'Videos', href: '/video-inventory' },
        ]},
        { label: 'Partnerships', href: '/partnerships' },
        { label: 'BRAIN', href: '/brain', items: [
            { label: 'BRAIN', href: '/brain' },
            { label: 'Today', href: '/today' },
            { label: 'DEFT', href: '/deft' },
            { label: 'Journal', href: '/journal' },
            { label: 'Pantry', href: '/pantry' },
            { label: 'Shopping', href: '/shopping' },
            { label: 'Meal Plan', href: '/meal-plan' },
            { label: 'Schedule Settings', href: '/scheduling-settings' },
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
            { label: 'Knowledge', href: '/knowledge-manager' },
            { label: 'Bug Reports', href: '/bug-reports' },
            { label: 'Settings', href: '/settings' },
        ]},
    ];

    var CHEVRON_SVG = '<svg class="chevron" width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
    var MN_CHEVRON_SVG = '<svg class="mn-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';

    // Detect active page
    var activePath = location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';

    function findActiveGroupIdx() {
        var idx = -1;
        NAV_GROUPS.forEach(function (g, gi) {
            if (g.href === activePath) idx = gi;
            if (g.items) {
                g.items.forEach(function (item) {
                    if (item.href === activePath) idx = gi;
                });
            }
        });
        return idx;
    }

    var activeGroupIdx = findActiveGroupIdx();

    // ═══ BUILD DESKTOP NAV ═══
    function buildDesktopNav() {
        return NAV_GROUPS.map(function (group, gi) {
            var isGroupActive = gi === activeGroupIdx;
            var roleAttr = group.role ? ' data-nav-role="' + group.role + '"' : '';

            if (!group.items) {
                return '<a href="' + group.href + '" class="nav-group-btn' + (isGroupActive ? ' active' : '') + '"' + roleAttr + '>' + group.label + '</a>';
            }

            var dropdownItems = group.items.map(function (item) {
                var isItemActive = item.href === activePath;
                return '<a href="' + item.href + '"' + (isItemActive ? ' class="active"' : '') + '>' + item.label + '</a>';
            }).join('\n                                ');

            return '<div class="nav-group"' + roleAttr + '>' +
                '\n                            <a href="' + group.href + '" class="nav-group-btn' + (isGroupActive ? ' active' : '') + '">' + group.label + ' ' + CHEVRON_SVG + '</a>' +
                '\n                            <div class="nav-dropdown">' +
                '\n                                ' + dropdownItems +
                '\n                            </div>' +
                '\n                        </div>';
        }).join('\n                        ');
    }

    // ═══ BUILD MOBILE NAV ═══
    function buildMobileNav() {
        var items = '';
        NAV_GROUPS.forEach(function (group, gi) {
            var isGroupActive = gi === activeGroupIdx;
            var mRoleAttr = group.role ? ' data-nav-role="' + group.role + '"' : '';

            if (!group.items) {
                items += '<a href="' + group.href + '" class="mobile-nav-link' + (isGroupActive ? ' active' : '') + '"' + mRoleAttr + '>' + group.label + '</a>\n';
            } else {
                var shouldExpand = isGroupActive;
                items += '<div' + mRoleAttr + '><button class="mobile-nav-group-btn' + (isGroupActive ? ' active' : '') + (shouldExpand ? ' expanded' : '') + '" onclick="toggleMobileAccordion(this)">' + group.label + ' ' + MN_CHEVRON_SVG + '</button>\n';
                items += '<div class="mobile-nav-children' + (shouldExpand ? ' open' : '') + '">\n';
                group.items.forEach(function (item) {
                    var isItemActive = item.href === activePath;
                    items += '    <a href="' + item.href + '" class="mobile-nav-link' + (isItemActive ? ' active' : '') + '">' + item.label + '</a>\n';
                });
                items += '</div></div>\n';
            }
        });
        return items;
    }

    // ═══ NAV SHELL (for minimal pages with only <div id="nav-root">) ═══
    var NAV_SHELL_CSS = [
        '.rdgr-nav-shell .border-border{border-color:var(--deft-border,#2A2E3D);}',
        '.rdgr-nav-shell .text-txt-3{color:var(--deft-txt-3,#525E73);}',
        '.mobile-menu-btn{display:none;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid var(--deft-border,#2A2E3D);border-radius:.375rem;background:transparent;color:var(--deft-txt-2,#8A95A9);cursor:pointer;transition:background .15s,color .15s;flex-shrink:0;}',
        '.mobile-menu-btn:hover{background:rgba(255,255,255,.06);color:var(--deft-txt,#E8ECF1);}',
        '@media (max-width:639px){.mobile-menu-btn{display:flex;}}',
        '#mobileNavOverlay{position:fixed;inset:0;z-index:200;display:none;opacity:0;transition:opacity .2s ease;}',
        '#mobileNavOverlay.open{display:flex;opacity:1;}',
        '.mobile-nav-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.5);}',
        '.mobile-nav-sidebar{position:relative;z-index:1;width:280px;max-width:85vw;height:100vh;background:var(--deft-base,#0B0E14);border-right:1px solid var(--deft-border,#2A2E3D);overflow-y:auto;transform:translateX(-100%);transition:transform .25s ease;padding:.75rem 0;}',
        '#mobileNavOverlay.open .mobile-nav-sidebar{transform:translateX(0);}',
        '.mobile-nav-close{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;background:transparent;color:var(--deft-txt-3,#525E73);cursor:pointer;font-size:1.1rem;border-radius:.25rem;}',
        '.mobile-nav-close:hover{background:rgba(255,255,255,.06);color:var(--deft-txt,#E8ECF1);}',
        '.mobile-nav-link{display:block;padding:.5rem 1.25rem;font-size:.75rem;font-weight:500;color:var(--deft-txt-2,#8A95A9);text-decoration:none;transition:background .12s,color .12s;}',
        '.mobile-nav-link:hover{background:rgba(255,255,255,.04);color:var(--deft-txt,#E8ECF1);}',
        '.mobile-nav-link.active{background:var(--deft-accent-dim,rgba(6,214,160,.12));color:var(--deft-accent,#06D6A0);}',
        '.mobile-nav-group-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:.5rem 1.25rem;font-size:.75rem;font-weight:500;color:var(--deft-txt-2,#8A95A9);background:transparent;border:none;cursor:pointer;text-align:left;}',
        '.mobile-nav-group-btn:hover{background:rgba(255,255,255,.04);color:var(--deft-txt,#E8ECF1);}',
        '.mobile-nav-group-btn.active{color:var(--deft-accent,#06D6A0);}',
        '.mobile-nav-group-btn .mn-chevron{transition:transform .2s;opacity:.5;}',
        '.mobile-nav-group-btn.expanded .mn-chevron{transform:rotate(180deg);opacity:.8;}',
        '.mobile-nav-children{display:none;padding-left:1rem;}',
        '.mobile-nav-children.open{display:block;}',
        '.mobile-nav-divider{height:1px;background:var(--deft-border,#2A2E3D);margin:.375rem 1rem;}',
        '.nav-group{position:relative;}',
        '.nav-group-btn{display:flex;align-items:center;gap:.25rem;padding:.3rem .75rem;font-size:.7rem;font-weight:500;color:#8A95A9;border-radius:.375rem;text-decoration:none;cursor:pointer;transition:background .15s,color .15s;white-space:nowrap;border:none;background:transparent;}',
        '.nav-group-btn:hover{color:#E8ECF1;}',
        '.nav-group-btn.active{background:var(--deft-accent-dim,rgba(6,214,160,.12));color:var(--deft-accent,#06D6A0);}',
        '.nav-group-btn .chevron{transition:transform .2s;opacity:.5;}',
        '.nav-group:hover .nav-group-btn .chevron{transform:rotate(180deg);opacity:.8;}',
        '.nav-dropdown{position:absolute;top:calc(100% + 4px);left:0;min-width:150px;padding:.375rem;border-radius:.5rem;border:1px solid var(--deft-border,#2A2E3D);background:var(--deft-surface-el,#1A1D28);box-shadow:0 8px 24px rgba(0,0,0,.4);opacity:0;visibility:hidden;transform:translateY(-4px);transition:opacity .15s,visibility .15s,transform .15s;z-index:70;}',
        '.nav-group:hover .nav-dropdown{opacity:1;visibility:visible;transform:translateY(0);}',
        '.nav-dropdown a{display:block;padding:.4rem .625rem;font-size:.7rem;font-weight:500;color:var(--deft-txt-2,#8A95A9);text-decoration:none;border-radius:.25rem;transition:background .12s,color .12s;white-space:nowrap;}',
        '.nav-dropdown a:hover{background:rgba(255,255,255,.06);color:var(--deft-txt,#E8ECF1);}',
        '.nav-dropdown a.active{background:var(--deft-accent-dim,rgba(6,214,160,.12));color:var(--deft-accent,#06D6A0);}'
    ].join('\n');

    function buildShellHTML() {
        return '' +
            '<nav class="rdgr-nav-shell sticky top-0 z-50 border-b border-border" style="background:rgba(8,9,13,0.92);backdrop-filter:blur(20px);">' +
            '  <div class="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">' +
            '    <div class="flex items-center gap-3">' +
            '      <a href="/" style="text-decoration:none;"><h1 style="font-weight:700;font-size:1rem;letter-spacing:.025em;color:var(--deft-txt,#E8ECF1);margin:0;">RDGR <span class="text-txt-3" style="font-weight:400;">Command Center</span></h1></a>' +
            '      <button class="mobile-menu-btn" onclick="toggleMobileNav()" aria-label="Open menu"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>' +
            '      <div class="flex gap-1 p-0.5 rounded-lg ml-2 hidden sm:flex" style="background:rgba(255,255,255,0.04);"></div>' +
            '    </div>' +
            '  </div>' +
            '</nav>' +
            '<div id="mobileNavOverlay">' +
            '  <div class="mobile-nav-backdrop"></div>' +
            '  <div class="mobile-nav-sidebar">' +
            '    <div style="display:flex;align-items:center;justify-content:space-between;padding:0 1.25rem .5rem;"><span style="font-size:.7rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--deft-txt-3,#525E73);">Menu</span><button class="mobile-nav-close" onclick="toggleMobileNav()">&times;</button></div>' +
            '    <div class="mobile-nav-divider"></div>' +
            '  </div>' +
            '</div>';
    }

    function ensureShell() {
        var navRoot = document.getElementById('nav-root');
        if (!navRoot) return;                 // page has its own inline <nav>
        if (document.querySelector('nav')) return; // already has a nav shell somewhere
        if (!document.getElementById('rdgr-nav-shell-css')) {
            var st = document.createElement('style');
            st.id = 'rdgr-nav-shell-css';
            st.textContent = NAV_SHELL_CSS;
            document.head.appendChild(st);
        }
        navRoot.innerHTML = buildShellHTML();
        // Mobile-nav toggle fallbacks (defined only if the page didn't provide them)
        if (typeof window.toggleMobileNav !== 'function') {
            window.toggleMobileNav = function () {
                var o = document.getElementById('mobileNavOverlay'); if (!o) return;
                if (o.classList.contains('open')) {
                    o.style.opacity = '0'; o.querySelector('.mobile-nav-sidebar').style.transform = 'translateX(-100%)';
                    setTimeout(function () { o.classList.remove('open'); o.style.display = 'none'; }, 250);
                } else {
                    o.style.display = 'flex';
                    requestAnimationFrame(function () { o.classList.add('open'); o.style.opacity = '1'; o.querySelector('.mobile-nav-sidebar').style.transform = 'translateX(0)'; });
                }
            };
        }
        if (typeof window.toggleMobileAccordion !== 'function') {
            window.toggleMobileAccordion = function (btn) {
                btn.classList.toggle('expanded');
                var kids = btn.nextElementSibling;
                if (kids && kids.classList.contains('mobile-nav-children')) kids.classList.toggle('open');
            };
        }
        var bd = document.querySelector('#mobileNavOverlay .mobile-nav-backdrop');
        if (bd) bd.addEventListener('click', function () { window.toggleMobileNav(); });
    }

    // ═══ BUG-REPORT WIDGET ═══
    var WIDGET_CSS = [
        '.bug-report-fab{position:fixed;bottom:1.5rem;left:1.5rem;z-index:190;width:40px;height:40px;border-radius:50%;border:1px solid var(--deft-border,#2A2E3D);background:var(--deft-surface-el,#1A1D28);color:var(--deft-txt-3,#525E73);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s,box-shadow .15s;box-shadow:0 2px 8px rgba(0,0,0,.3);padding:0;line-height:1;}',
        '.bug-report-fab:hover{background:rgba(255,107,107,.12);color:#FF6B6B;border-color:rgba(255,107,107,.3);}',
        '.bug-report-fab .bug-badge{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;border-radius:8px;background:#FF6B6B;color:#fff;font-size:.55rem;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 3px;}',
        '.bug-report-modal{position:fixed;inset:0;z-index:195;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:1rem;}',
        '.bug-report-modal.active{display:flex;}',
        '.bug-report-modal .modal-content{background:var(--deft-surface,#11131A);border:1px solid var(--deft-border,#2A2E3D);border-radius:.6rem;max-width:500px;width:92vw;}',
        '.bug-form-label{display:block;font-size:.65rem;font-weight:600;color:var(--deft-txt-2,#8A95A9);margin-bottom:.25rem;text-transform:uppercase;letter-spacing:.03em;}',
        '.bug-console-log{max-height:100px;overflow-y:auto;padding:.4rem;border-radius:.375rem;background:rgba(0,0,0,.3);border:1px solid var(--deft-border,#2A2E3D);font-family:"JetBrains Mono",monospace;font-size:.6rem;line-height:1.4;}',
        '.bug-ce{color:#FF6B6B;} .bug-cw{color:#FFD93D;} .bug-cn{color:var(--deft-txt-3,#525E73);font-style:italic;}'
    ].join('\n');

    var WIDGET_HTML = '' +
        '<button class="bug-report-fab" id="bugReportBtn" onclick="_openBugReport()" title="Report a bug">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.88 1.88"/><path d="M14.12 3.88L16 2"/><path d="M9 7.13v-1a3.003 3.003 0 116 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>' +
        '<span class="bug-badge" id="bugBadge">0</span>' +
        '</button>' +
        '<div class="bug-report-modal" id="bugReportModal">' +
        '  <div class="modal-content" style="padding:1.25rem;">' +
        '    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">' +
        '      <h3 style="font-size:.95rem;font-weight:700;color:var(--deft-txt,#E8ECF1);margin:0;">Report Bug / Request Update</h3>' +
        '      <button onclick="document.getElementById(\'bugReportModal\').classList.remove(\'active\')" style="background:none;border:none;color:var(--deft-txt-3,#525E73);cursor:pointer;font-size:1.2rem;padding:.25rem;">&times;</button>' +
        '    </div>' +
        '    <div style="margin-bottom:.75rem;"><label class="bug-form-label">Page</label><div id="bugPageUrl" style="font-size:.75rem;color:var(--deft-accent,#06D6A0);font-family:\'JetBrains Mono\',monospace;padding:.3rem .5rem;background:rgba(0,0,0,.2);border-radius:.25rem;border:1px solid var(--deft-border,#2A2E3D);"></div></div>' +
        '    <div style="margin-bottom:.75rem;"><label class="bug-form-label">What\'s wrong?</label><textarea id="bugDescription" rows="4" placeholder="Describe the issue..." style="width:100%;resize:vertical;padding:.5rem;border-radius:.375rem;background:var(--deft-surface,#11131A);border:1px solid var(--deft-border,#2A2E3D);color:var(--deft-txt,#E8ECF1);font-size:.8rem;"></textarea></div>' +
        '    <div style="margin-bottom:.75rem;"><label class="bug-form-label">Console Errors</label><div class="bug-console-log" id="bugConsoleLog"><span class="bug-cn">No errors</span></div></div>' +
        '    <div style="display:flex;gap:.75rem;align-items:flex-end;margin-bottom:1rem;"><div style="flex:1;"><label class="bug-form-label">Priority</label><select id="bugPriority" style="width:100%;padding:.35rem .5rem;border-radius:.375rem;background:var(--deft-surface,#11131A);border:1px solid var(--deft-border,#2A2E3D);color:var(--deft-txt,#E8ECF1);font-size:.75rem;"><option value="low">Low</option><option value="normal" selected>Normal</option><option value="high">High</option><option value="critical">Critical</option></select></div></div>' +
        '    <div style="display:flex;gap:.5rem;justify-content:flex-end;"><button onclick="document.getElementById(\'bugReportModal\').classList.remove(\'active\')" style="padding:.4rem 1rem;border-radius:.375rem;border:1px solid var(--deft-border,#2A2E3D);background:transparent;color:var(--deft-txt-2,#8A95A9);font-size:.75rem;cursor:pointer;">Cancel</button><button onclick="_submitBugReport()" id="bugSubmitBtn" style="padding:.4rem 1rem;border-radius:.375rem;border:1px solid rgba(255,107,107,.3);background:rgba(255,107,107,.12);color:#FF6B6B;font-size:.75rem;font-weight:600;cursor:pointer;">Submit</button></div>' +
        '  </div>' +
        '</div>';

    window._openBugReport = function () {
        var m = document.getElementById('bugReportModal'); if (!m) return;
        document.getElementById('bugPageUrl').textContent = location.pathname;
        var log = document.getElementById('bugConsoleLog'), items = [];
        _ce.forEach(function (e) { items.push('<div class="bug-ce">[ERROR] ' + _esc(e.m) + '</div>'); });
        _cw.forEach(function (w) { items.push('<div class="bug-cw">[WARN] ' + _esc(w.m) + '</div>'); });
        log.innerHTML = items.length ? items.join('') : '<span class="bug-cn">No errors</span>';
        m.classList.add('active');
        var ta = document.getElementById('bugDescription'); if (ta) ta.focus();
    };
    window._submitBugReport = async function () {
        var desc = document.getElementById('bugDescription').value.trim();
        if (!desc) { _toast('Please describe the issue', 'error'); return; }
        var btn = document.getElementById('bugSubmitBtn'); if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
        var url = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : CARLTONDB_URL);
        var key = (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : CARLTONDB_KEY);
        try {
            var r = await fetch(url + '/rest/v1/user_bug_reports', {
                method: 'POST',
                headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                body: JSON.stringify({ page_url: location.pathname, page_title: document.title, user_description: desc, console_errors: _ce, console_warnings: _cw, browser_info: { userAgent: navigator.userAgent, viewport: window.innerWidth + 'x' + window.innerHeight, timestamp: new Date().toISOString() }, priority: document.getElementById('bugPriority').value, status: 'open' })
            });
            if (r.ok) {
                var d = await r.json();
                _toast('Bug report ' + (d[0] && d[0].report_id ? d[0].report_id : '') + ' submitted!', 'success');
                document.getElementById('bugDescription').value = '';
                document.getElementById('bugReportModal').classList.remove('active');
                _ce.length = 0; _cw.length = 0; _ub();
            } else {
                var e = await r.text(); _toast('Failed: ' + e, 'error');
            }
        } catch (ex) { _toast('Error: ' + ex.message, 'error'); }
        finally { if (btn) { btn.disabled = false; btn.textContent = 'Submit'; } }
    };

    function ensureBugWidget() {
        if (document.getElementById('bugReportBtn')) return; // inline widget already present
        if (!document.getElementById('rdgr-bug-widget-css')) {
            var st = document.createElement('style');
            st.id = 'rdgr-bug-widget-css';
            st.textContent = WIDGET_CSS;
            document.head.appendChild(st);
        }
        var holder = document.createElement('div');
        holder.id = 'rdgr-bug-widget';
        holder.innerHTML = WIDGET_HTML;
        document.body.appendChild(holder);
        _ub();
    }

    // ═══ APPLY NAV (fill an existing or freshly-built shell) ═══
    function applyNav() {
        // Desktop nav: replace content of the flex container
        var desktopContainer = document.querySelector('div.hidden.sm\\:flex[style*="rgba(255,255,255,0.04)"]');
        if (!desktopContainer) {
            // Fallback: match by class pattern
            var candidates = document.querySelectorAll('nav div.hidden');
            for (var i = 0; i < candidates.length; i++) {
                if (candidates[i].className.indexOf('sm:flex') > -1) {
                    desktopContainer = candidates[i];
                    break;
                }
            }
        }
        if (desktopContainer) {
            desktopContainer.innerHTML = '\n                        ' + buildDesktopNav() + '\n                    ';
        }

        // Mobile nav: replace sidebar content (keep header)
        var sidebar = document.querySelector('#mobileNavOverlay .mobile-nav-sidebar');
        if (sidebar) {
            // Preserve the header (Menu title + close button + divider)
            var header = sidebar.querySelector('div[style]');
            var divider = sidebar.querySelector('.mobile-nav-divider');
            var headerHTML = '';
            if (header) headerHTML += header.outerHTML;
            if (divider) headerHTML += divider.outerHTML;
            sidebar.innerHTML = headerHTML + '\n                ' + buildMobileNav();

            // Re-attach mobile nav link close handlers
            sidebar.querySelectorAll('.mobile-nav-link').forEach(function (a) {
                a.addEventListener('click', function () {
                    if (typeof toggleMobileNav === 'function') toggleMobileNav();
                });
            });
        }

        // Role-based filtering
        try {
            var rp = JSON.parse(localStorage.getItem('rdgr-active-profile') || '{}');
            if (rp.role === 'student') {
                document.querySelectorAll('[data-nav-role="admin"]').forEach(function (el) {
                    el.style.display = 'none';
                });
            }
        } catch (e) { /* ignore */ }

        // Click prevention on active nav items
        var nav = document.querySelector('nav');
        if (nav) {
            nav.addEventListener('click', function (e) {
                var l = e.target.closest('.nav-group-btn.active,.nav-dropdown a.active');
                if (l) e.preventDefault();
            });
        }
    }

    function init() {
        ensureShell();       // build a nav shell into #nav-root if needed
        applyNav();          // fill the (existing or new) shell
        ensureBugWidget();   // add the bug-report widget if not already present
    }

    // Run on DOMContentLoaded or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
