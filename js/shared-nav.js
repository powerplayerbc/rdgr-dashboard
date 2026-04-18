/**
 * RDGR Shared Navigation — Runtime Loader
 * Single source of truth for navigation structure.
 * Replaces inline nav content on every page load to ensure consistency.
 *
 * Update NAV_GROUPS here — all pages reflect changes automatically.
 */
(function () {
    'use strict';

    // ═══ NAV STRUCTURE (single source of truth) ═══
    var NAV_GROUPS = [
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

    // ═══ APPLY NAV ═══
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

    // Run on DOMContentLoaded or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyNav);
    } else {
        applyNav();
    }
})();
