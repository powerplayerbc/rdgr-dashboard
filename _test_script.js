
    // Migrate old localStorage key
    if (!localStorage.getItem('rdgr-active-profile') && localStorage.getItem('rdgr-active-profile')) {
        localStorage.setItem('rdgr-active-profile', localStorage.getItem('rdgr-active-profile'));
        localStorage.removeItem('rdgr-active-profile');
    }

    // ═══════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════
    let activeProfileId = null;

    const API = {
        approve: 'https://n8n.carltonaiservices.com/webhook/rdgr-approve',
        intake: 'https://n8n.carltonaiservices.com/webhook/rdgr-intake',
        activate: 'https://n8n.carltonaiservices.com/webhook/rdgr-activate',
        directiveAction: 'https://n8n.carltonaiservices.com/webhook/rdgr-directive-action',
        complete: 'https://n8n.carltonaiservices.com/webhook/rdgr-complete',
        humanAction: 'https://n8n.carltonaiservices.com/webhook/human-action',
        crm: 'https://n8n.carltonaiservices.com/webhook/rdgr-crm',
        social: 'https://n8n.carltonaiservices.com/webhook/rdgr-tool-social',
    };
    // Direct Supabase PostgREST
    const SUPABASE_URL = 'https://yrwrswyjawmgtxrgbnim.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8';

    async function supabaseSelect(table, query = '') {
        const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
        try {
            const res = await fetch(url, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                }
            });
            if (!res.ok) { console.error('Supabase error:', res.status, await res.text()); return null; }
            return await res.json();
        } catch (err) { console.error('Supabase fetch error:', table, err); return null; }
    }

    const DOMAIN_ICONS = {
        email: '✉', calendar: '📅', research: '🔍', writing: '✏️',
        sales: '🤝', finance: '📊', thinking: '🧠', toolbuild: '🔧',
        hub: '🔗', meetings: '👥', bookkeeper: '📒', social_media: '📱',
        meta: '⚙️', report: '📋', partnership: '🤝',
        prospecting: '🎯', content: '📝', outbound: '📤',
    };

    let taskData = [];
    let reviewData = [];
    let activityData = [];
    let directiveData = [];
    let directiveHistory = [];
    let activeDirectives = [];
    let humanTasksData = [];
    let currentHumanTaskIdx = null;
    let autoRefreshInterval = null;
    let currentModifyTaskId = null;
    let dirPanelOpen = true;

    // Workflow control state
    let workflowRegistry = [];
    let wfPanelOpen = false;


    // ═══════════════════════════════════════
    // AUTH GATE
    // ═══════════════════════════════════════
    let gateSelectedProfile = null;

        function getCachedProfiles(callback) {
        var CACHE_KEY = 'rdgr-profiles-cache';
        var CACHE_TTL = 300000; // 5 minutes
        try {
            var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
            if (cached.profiles && cached.ts && (Date.now() - cached.ts) < CACHE_TTL) {
                callback(cached.profiles);
                return;
            }
        } catch(e) {}
        var _SB_URL = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : 'https://yrwrswyjawmgtxrgbnim.supabase.co';
        var _SB_KEY = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8';
        fetch(`${_SB_URL}/rest/v1/deft_user_profiles?select=user_id,display_name,email&order=display_name`, {
            headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${_SB_KEY}` }
        }).then(r => r.json()).then(profiles => {
            if (profiles && Array.isArray(profiles) && profiles.length > 0) {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ profiles: profiles, ts: Date.now() }));
            }
            callback(profiles);
        }).catch(() => callback([]));
    }

    function loadGateProfiles() {
        getCachedProfiles(function(profiles) {
            const container = document.getElementById('gateProfiles');
                        if (!container || !profiles || !profiles.length) return;
                        const saved = localStorage.getItem('rdgr-active-profile');
                        let savedId = null;
                        if (saved) { try { savedId = JSON.parse(saved).id; } catch(e) {} }
                        container.innerHTML = profiles.map(p => {
                            const name = p.display_name || p.email || '?';
                            const initial = name[0].toUpperCase();
                            const colors = { 'Bradford': '#06D6A0', 'Dianna': '#A855F7', 'Brianna': '#4CC9F0' };
                            const color = colors[name] || '#8A95A9';
                            return `<button type="button" onclick="selectGateProfile('${p.user_id}','${name.replace(/'/g, '&#39;')}',this)" class="gate-profile-btn flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all" style="background:rgba(255,255,255,0.02);border:2px solid transparent;cursor:pointer;min-width:80px;" onmouseenter="this.style.background='rgba(255,255,255,0.04)'" onmouseleave="if(!this.classList.contains('selected'))this.style.background='rgba(255,255,255,0.02)'">
                                <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style="background:${color}20;color:${color};border:2px solid transparent;">${initial}</div>
                                <span class="text-xs" style="color:#8A95A9;">${name}</span>
                            </button>`;
                        }).join('');
                        if (savedId) {
                            const btns = container.querySelectorAll('.gate-profile-btn');
                            btns.forEach(btn => {
                                if (btn.getAttribute('onclick').includes(savedId)) {
                                    btn.click();
                                }
                            });
                        }
        });
    }

    function selectGateProfile(userId, name, el) {
        gateSelectedProfile = { id: userId, name: name };
        document.querySelectorAll('.gate-profile-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.style.background = 'rgba(255,255,255,0.02)';
            btn.style.borderColor = 'transparent';
            btn.querySelector('.w-10').style.borderColor = 'transparent';
        });
        el.classList.add('selected');
        el.style.background = 'rgba(255,255,255,0.06)';
        el.style.borderColor = 'rgba(6,214,160,0.4)';
        el.querySelector('.w-10').style.borderColor = el.querySelector('.w-10').style.color;
        const btn = document.getElementById('gateSubmitBtn');
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = 'Sign In as ' + name;
        document.getElementById('gateInput').focus();
    }

    function handleGate(e) {
        e.preventDefault();
        const input = document.getElementById('gateInput').value;
        if (input === 'Advance1!') {
            localStorage.setItem('rdgr-session', JSON.stringify({ authenticated: true, ts: Date.now() }));
            if (gateSelectedProfile) {
                localStorage.setItem('rdgr-active-profile', JSON.stringify(gateSelectedProfile));
                activeProfileId = gateSelectedProfile.id;
            }
            document.getElementById('gate').classList.add('hidden');
            document.getElementById('mainContent').style.opacity = '1';
            initDashboard();
            return false;
        }
        document.getElementById('gateError').classList.add('show');
        document.getElementById('gateInput').value = '';
        document.getElementById('gateInput').focus();
        setTimeout(() => document.getElementById('gateError').classList.remove('show'), 2000);
        return false;
    }

    if (JSON.parse(localStorage.getItem('rdgr-session') || '{}').authenticated === true) {
        document.getElementById('gate').classList.add('hidden');
        document.getElementById('mainContent').style.opacity = '1';
        initDashboard();
    }

    // Load gate profiles on page load (only if gate is visible)
    if (!JSON.parse(localStorage.getItem('rdgr-session') || '{}').authenticated) {
        loadGateProfiles();
    }

    // ═══════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════
    function initDashboard() {
        refreshAll();
        fetchWorkflows();
        startAutoRefresh();
        checkPendingSnapshots();
    }

    async function checkPendingSnapshots() {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/voice_settings_snapshots?brand_id=eq.carlton&status=eq.pending&select=id`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            });
            const data = await res.json();
            if (data && data.length > 0) {
                const badge = document.getElementById('settingsBadge');
                if (badge) badge.classList.remove('hidden');
                const link = document.getElementById('settingsLink');
                if (link) link.title = `Voice Settings (${data.length} AI suggestion${data.length > 1 ? 's' : ''})`;
            }
        } catch (e) { /* silent */ }
    }

    function startAutoRefresh() {
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
        autoRefreshInterval = setInterval(refreshAll, 300000);
    }

    function toggleAutoRefresh() {
        if (document.getElementById('autoRefreshToggle').checked) {
            startAutoRefresh();
        } else {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    // ═══════════════════════════════════════
    // DATA FETCHING
    // ═══════════════════════════════════════
    async function fetchJSON(url, body, { retries = 0, backoff = 2000 } = {}) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.status >= 500 && retries < 2) {
                await new Promise(r => setTimeout(r, backoff));
                return fetchJSON(url, body, { retries: retries + 1, backoff: backoff * 2 });
            }
            return await res.json();
        } catch (err) {
            if (retries < 1) {
                await new Promise(r => setTimeout(r, 2000));
                return fetchJSON(url, body, { retries: retries + 1, backoff });
            }
            console.error('Fetch error:', url, err);
            return null;
        }
    }

    async function refreshAll() {
        document.getElementById('lastRefresh').textContent = 'Refreshing...';
        const btn = document.getElementById('refreshBtn');
        btn.disabled = true;

        await Promise.all([
            fetchTaskQueue(),
            fetchHumanReview(),
            fetchDirectives(),
            fetchActivity(),
            fetchHealth(),
            fetchRevenue(),
            fetchHumanTasks(),
        ]);

        document.getElementById('lastRefresh').textContent = new Date().toLocaleTimeString();
        btn.disabled = false;
    }

    async function fetchTaskQueue() {
        const [directiveTasks, legacyTasks] = await Promise.all([
            supabaseSelect('directive_tasks',
                'select=task_id,directive_id,title,domain,status,human_action_type,description,sequence,created_at&brand_id=eq.carlton&order=created_at.desc&limit=100'),
            supabaseSelect('autonomous_task_queue',
                'order=priority.asc,created_at.desc&limit=100')
        ]);

        const normalizedDirective = (Array.isArray(directiveTasks) ? directiveTasks : []).map(t => ({
            ...t,
            priority: t.sequence || 0,
            source: 'directive',
        }));
        const normalizedLegacy = (Array.isArray(legacyTasks) ? legacyTasks : []).map(t => ({
            ...t,
            source: 'legacy',
        }));

        taskData = [...normalizedDirective, ...normalizedLegacy]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 100);

        updateStatusBar();
        renderTasks();
    }

    async function fetchHumanReview() {
        const result = await supabaseSelect(
            'human_review_queue',
            'decision=is.null&order=submitted_at.desc&limit=100'
        );
        reviewData = Array.isArray(result) ? result : [];
        renderReviews();
    }

    async function fetchDirectives() {
        const [pendingResult, historyResult, activeResult] = await Promise.all([
            supabaseSelect('autonomous_directives', 'status=eq.pending_approval&order=created_at.desc&select=id,directive_id,project_id,title,objective,acceptance_criteria,domain,target_domains,priority,risk_level,context,created_at'),
            supabaseSelect('autonomous_directives', 'approved_at=not.is.null&order=approved_at.desc&limit=10&select=directive_id,title,status,risk_level,approved_by,approved_at,approval_notes'),
            supabaseSelect('autonomous_directives', 'status=in.(active,in_progress)&order=created_at.desc&select=directive_id,title,status,domain,target_domains,risk_level,priority,created_at'),
        ]);

        directiveData = Array.isArray(pendingResult) ? pendingResult : [];
        directiveHistory = Array.isArray(historyResult) ? historyResult : [];
        activeDirectives = Array.isArray(activeResult) ? activeResult : [];

        renderDirectives();
        updateStatusBar();
    }

    async function fetchActivity() {
        const [dt, atq, execLog] = await Promise.all([
            supabaseSelect('directive_tasks',
                'brand_id=eq.carlton&status=in.(completed,failed)&order=created_at.desc&limit=20&select=task_id,directive_id,title,domain,status,human_action_type,created_at'),
            supabaseSelect('autonomous_task_queue',
                'status=in.(completed,failed)&order=created_at.desc&limit=20'),
            supabaseSelect('autonomous_execution_log',
                'order=timestamp.desc&limit=30&select=workflow,result,action,timestamp,task_id,error_message,details')
        ]);

        // Normalize execution log entries to match activity format
        const normalizedExecLog = (Array.isArray(execLog) ? execLog : []).map(e => {
            const details = e.details && typeof e.details === 'object' ? e.details : {};
            return {
                task_id: e.task_id || '',
                title: `${e.workflow || 'Unknown'}: ${(e.action || '').replace(/_/g, ' ')}`,
                domain: details.domain || e.workflow?.replace('RDGR-', '').toLowerCase() || '',
                status: e.result === 'success' ? 'completed' : 'failed',
                operation: e.action || '',
                error_message: e.error_message || details.error_message || null,
                created_at: e.timestamp,
                source: 'execution_log',
                retry_count: details.retry_count || null,
            };
        });

        activityData = [
            ...(Array.isArray(dt) ? dt : []).map(t => ({ ...t, source: 'directive' })),
            ...(Array.isArray(atq) ? atq : []).map(t => ({ ...t, source: 'legacy' })),
            ...normalizedExecLog,
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
         .slice(0, 30);

        renderActivity();
    }

    async function fetchHealth() {
        const result = await supabaseSelect('autonomous_execution_log', 'order=timestamp.desc&limit=50');
        renderHealth(Array.isArray(result) ? result : []);
    }

    async function fetchRevenue() {
        const result = await supabaseSelect('autonomous_financial_snapshots', 'order=snapshot_date.desc&limit=1');
        renderRevenue((Array.isArray(result) && result[0]) ? result[0] : null);
    }

    // ═══════════════════════════════════════
    // HUMAN TASKS
    // ═══════════════════════════════════════
    async function fetchHumanTasks() {
        let result = await supabaseSelect(
            'directive_tasks',
            'select=task_id,directive_id,title,domain,status,human_action_type,description,parameters,expected_output,created_at&requires_human=eq.true&status=in.(pending,in_progress)&brand_id=eq.carlton&order=created_at.desc'
        );
        humanTasksData = Array.isArray(result) ? result : [];
        renderHumanTasks();
    }

    function toggleHumanTaskDetail(idx) {
        const el = document.getElementById(`ht-detail-${idx}`);
        if (el) el.classList.toggle('open');
    }

    // Button config for dynamic action buttons
    const ACTION_BUTTON_CONFIG = {
        approve:         { label: 'Approve',        cls: 'btn-approve', icon: '✓' },
        reject:          { label: 'Reject',         cls: 'btn-deny',    icon: '✕' },
        edit:            { label: 'Edit & Approve', cls: 'btn-modify',  icon: '✎' },
        skip:            { label: 'Skip',           cls: 'btn-ghost',   icon: '⏭' },
        request_changes: { label: 'Request Changes',cls: 'btn-warn',    icon: '↻' },
        acknowledge:     { label: 'Acknowledge',    cls: 'btn-ghost',   icon: '👁' },
        mark_complete:   { label: 'Mark Complete',  cls: 'btn-approve', icon: '✓' },
    };

    function formatActionLabel(action) {
        const cfg = ACTION_BUTTON_CONFIG[action];
        return cfg ? cfg.label : action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    function renderReviewContent(reviewContent) {
        if (!reviewContent || !reviewContent.type) return '';
        switch (reviewContent.type) {
            case 'text':
                return `<div class="review-content-panel"><div class="text-xs text-txt-2" style="white-space:pre-wrap;">${esc(typeof reviewContent.data === 'string' ? reviewContent.data : JSON.stringify(reviewContent.data, null, 2))}</div></div>`;
            case 'url':
                const url = reviewContent.preview_url || reviewContent.data;
                return `<div class="review-content-panel"><a href="${esc(url)}" target="_blank" rel="noopener" class="text-xs text-accent hover:underline break-all">${esc(url)}</a></div>`;
            case 'comparison':
                const d = reviewContent.data || {};
                return `<div class="comparison-view"><div class="comparison-col"><div class="text-[0.65rem] font-semibold text-txt-3 uppercase tracking-wider mb-1">Original</div><div class="text-xs text-txt-2" style="white-space:pre-wrap;">${esc(d.original || '')}</div></div><div class="comparison-col"><div class="text-[0.65rem] font-semibold text-txt-3 uppercase tracking-wider mb-1">Polished</div><div class="text-xs text-txt-2" style="white-space:pre-wrap;">${esc(d.polished || '')}</div></div></div>`;
            case 'document':
                return `<div class="review-content-panel"><a href="${esc(reviewContent.data || '')}" target="_blank" rel="noopener" class="btn btn-ghost text-xs inline-flex items-center gap-1.5">📄 Open Document</a></div>`;
            default:
                return `<div class="review-content-panel"><pre class="text-xs text-txt-2 overflow-x-auto">${esc(JSON.stringify(reviewContent, null, 2))}</pre></div>`;
        }
    }

    function renderHumanTasks() {
        const panel = document.getElementById('humanTasksPanel');
        const countEl = document.getElementById('humanTasksCount');
        countEl.textContent = humanTasksData.length;

        if (humanTasksData.length === 0) {
            panel.innerHTML = '<div class="empty-state"><div class="mb-2 text-2xl opacity-40">👤</div>No tasks requiring human action</div>';
            return;
        }

        const DISPLAY_LIMIT = 5;
        const showAll = panel.dataset.showAll === 'true';
        const displayItems = showAll ? humanTasksData : humanTasksData.slice(0, DISPLAY_LIMIT);
        let html = displayItems.map((task, i) => {
            const actionType = task.human_action_type || 'review';
            const params = task.parameters && typeof task.parameters === 'object' ? task.parameters : {};
            const isProcessing = task._processing;

            // ══════════════════════════════════════
            // SOCIAL OUTREACH DRAFT CARD
            // ══════════════════════════════════════
            if (actionType === 'approve_social_draft') {
                return renderSocialDraftTask(task, i, params, isProcessing);
            }

            // ══════════════════════════════════════
            // STANDARD HUMAN TASK CARD
            // ══════════════════════════════════════
            const actionBadgeClass = actionType === 'approve' || actionType === 'approve_content' ? 'badge-approve-type'
                : actionType === 'execute' ? 'badge-execute'
                : actionType === 'decide' ? 'badge-decide'
                : 'badge-review';

            const domainBadge = task.domain
                ? `<span class="badge" style="background:rgba(96,165,250,0.12);color:#60A5FA;font-size:0.6rem">${esc(task.domain)}</span>`
                : '';

            // Review content rendering
            const reviewContent = params.review_content;
            let reviewContentHtml = reviewContent
                ? `<div class="mt-2"><span class="text-[0.65rem] font-semibold text-txt-3 uppercase tracking-wider">Review Content</span>${renderReviewContent(reviewContent)}</div>`
                : '';

            // Build expanded detail sections
            let descHtml = task.description
                ? `<div class="mt-2"><span class="text-[0.65rem] font-semibold text-txt-3 uppercase tracking-wider">Description</span><div class="text-xs text-txt-2 mt-0.5" style="white-space:pre-wrap;">${esc(task.description)}</div></div>`
                : '';

            let expectedHtml = task.expected_output
                ? `<div class="mt-2"><span class="text-[0.65rem] font-semibold text-txt-3 uppercase tracking-wider">Expected Output</span><div class="text-xs text-txt-2 mt-0.5">${esc(task.expected_output)}</div></div>`
                : '';

            let contactHtml = '';
            if (params.contact_id) {
                contactHtml = `<div class="mt-2"><span class="text-[0.65rem] font-semibold text-txt-3 uppercase tracking-wider">Contact</span><div class="text-xs text-txt-2 mt-0.5">${esc(params.contact_name || params.contact_id)}</div></div>`;
            }

            // Show parameters (excluding review_content and action_options which are rendered separately)
            let paramsHtml = '';
            const paramKeys = Object.keys(params).filter(k => !['contact_id', 'contact_name', 'review_content', 'action_options', 'callback_webhook', 'callback_payload_template'].includes(k));
            if (paramKeys.length > 0) {
                const paramRows = paramKeys.map(k => {
                    const val = typeof params[k] === 'object' ? JSON.stringify(params[k]) : String(params[k]);
                    return `<div class="flex gap-2 text-xs"><span class="text-txt-3 font-mono flex-shrink-0">${esc(k)}:</span><span class="text-txt-2">${esc(val)}</span></div>`;
                }).join('');
                paramsHtml = `<div class="mt-2"><span class="text-[0.65rem] font-semibold text-txt-3 uppercase tracking-wider">Parameters</span><div class="mt-0.5 space-y-0.5">${paramRows}</div></div>`;
            }

            // Dynamic action buttons from action_options
            const actionOptions = params.action_options || ['approve', 'reject'];
            let buttonsHtml;
            if (isProcessing) {
                buttonsHtml = `<div class="flex items-center gap-2 text-xs text-txt-3"><span class="ha-spinner"></span> Processing...</div>`;
            } else {
                buttonsHtml = actionOptions.map(action => {
                    const cfg = ACTION_BUTTON_CONFIG[action] || { label: action.replace(/_/g, ' '), cls: 'btn-ghost', icon: '⚡' };
                    return `<button class="btn ${cfg.cls} text-xs py-1.5 px-3 whitespace-nowrap" onclick="event.stopPropagation();fireAction(${i}, '${action}')" id="ht-actionbtn-${i}-${action}">${cfg.icon} ${cfg.label}</button>`;
                }).join('');
            }

            // CRM interaction logging (always visible in expanded card)
            const crmHtml = `<div class="mt-3">
                <label class="flex items-center gap-2 cursor-pointer text-xs text-txt-2">
                    <input type="checkbox" id="ht-logcrm-${i}" onchange="toggleInlineCrm(${i})" class="accent-accent">
                    <span>Log as CRM interaction</span>
                </label>
                <div id="ht-crm-fields-${i}" style="display:none;" class="mt-2 space-y-2 pl-4 border-l-2 border-border">
                    <select id="ht-channel-${i}" class="form-input text-xs" onchange="toggleInlinePlatform(${i})">
                        <option value="phone_outbound">Phone (Outbound)</option>
                        <option value="phone_inbound">Phone (Inbound)</option>
                        <option value="email_outbound">Email (Outbound)</option>
                        <option value="in_person">In Person</option>
                        <option value="social">Social Media</option>
                        <option value="manual">Manual / Other</option>
                    </select>
                    <select id="ht-platform-${i}" class="form-input text-xs" style="display:none;">
                        <option value="instagram">Instagram</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="facebook">Facebook</option>
                        <option value="twitter">Twitter / X</option>
                    </select>
                </div>
            </div>`;

            return `
                <div class="human-task-card${isProcessing ? ' processing' : ''}">
                    <div class="flex items-start gap-2 cursor-pointer" onclick="toggleHumanTaskDetail(${i})">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap mb-1">
                                <span class="badge ${actionBadgeClass}">${esc(actionType)}</span>
                                <span class="badge badge-${task.status}">${esc((task.status || '').replace('_', ' '))}</span>
                                ${domainBadge}
                                <span class="font-mono text-[0.6rem] text-txt-3">DIR: ${esc(task.directive_id || '—')}</span>
                            </div>
                            <div class="text-sm font-medium text-txt">${esc(task.title || 'Untitled')}</div>
                            <div class="text-xs text-txt-2 mt-0.5 line-clamp-2">${esc(task.description || '')}</div>
                        </div>
                        <span class="text-[0.6rem] text-txt-3 whitespace-nowrap flex-shrink-0 mt-1">${timeAgo(task.created_at)}</span>
                    </div>
                    <div class="human-task-detail" id="ht-detail-${i}">
                        ${reviewContentHtml}
                        ${descHtml}
                        ${expectedHtml}
                        ${contactHtml}
                        ${paramsHtml}
                        <div class="mt-3">
                            <textarea id="ht-feedback-${i}" class="form-input text-xs" rows="2" placeholder="Notes (optional)" onclick="event.stopPropagation()"></textarea>
                        </div>
                        ${crmHtml}
                        <div class="flex flex-wrap gap-1.5 mt-3" id="ht-buttons-${i}">
                            ${buttonsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        if (humanTasksData.length > DISPLAY_LIMIT) {
            const btnText = showAll ? 'Show Less' : `Show All (${humanTasksData.length} total)`;
            html += `<div class="text-center mt-3 pt-3" style="border-top: 1px solid var(--deft-border, #2A2E3D);">
                <button onclick="this.closest('.panel-body').dataset.showAll = this.closest('.panel-body').dataset.showAll === 'true' ? 'false' : 'true'; renderHumanTasks();" class="btn btn-ghost text-xs py-1.5 px-4">${btnText}</button>
            </div>`;
        }
        panel.innerHTML = html;
    }

    function renderSocialDraftTask(task, i, params, isProcessing) {
        const rc = params.review_content || {};
        const cb = params.callback_payload_template || {};
        const draftText = rc.data || '';
        const platform = rc.platform || cb.platform || '';
        const outreachType = rc.outreach_type || '';
        const threadUrl = rc.thread_url || cb.thread_url || params.thread_url || '';
        const profileUrl = rc.profile_url || cb.profile_url || params.profile_url || '';
        const discoveryType = cb.discovery_type || rc.discovery_type || '';
        const draftId = cb.draft_id;
        const isOutdated = !draftId;

        // Platform badge
        const platColors = { reddit:'rgba(255,69,0,0.15)', linkedin:'rgba(10,102,194,0.15)', instagram:'rgba(225,48,108,0.15)', facebook:'rgba(24,119,242,0.15)', twitter:'rgba(29,161,242,0.15)' };
        const platTextColors = { reddit:'#FF6347', linkedin:'#3B9BF5', instagram:'#E1306C', facebook:'#5B9CF5', twitter:'#1DA1F2' };
        const platBg = platColors[platform] || 'rgba(138,149,169,0.15)';
        const platTxt = platTextColors[platform] || '#8A95A9';
        const platLabel = platform.charAt(0).toUpperCase() + platform.slice(1);

        // Discovery type badge
        let typeBadge = '';
        if (discoveryType === 'wave_catcher') typeBadge = '<span class="badge" style="background:rgba(20,184,166,0.15);color:#2DD4BF;">Wave</span>';
        else if (discoveryType === 'pain_prospector') typeBadge = '<span class="badge" style="background:rgba(245,158,11,0.15);color:#F59E0B;">Pain Point</span>';

        // Link
        const linkHtml = platform === 'reddit' && threadUrl
            ? `<a href="${esc(threadUrl)}" target="_blank" class="text-xs text-txt-3 hover:text-accent transition-colors" onclick="event.stopPropagation()">Open Thread →</a>`
            : profileUrl
            ? `<a href="${esc(profileUrl)}" target="_blank" class="text-xs text-txt-3 hover:text-accent transition-colors" onclick="event.stopPropagation()">View Profile →</a>`
            : '';

        // Border color based on type
        const borderColor = discoveryType === 'wave_catcher' ? '#2DD4BF' : discoveryType === 'pain_prospector' ? '#F59E0B' : '#C084FC';

        // Buttons
        let buttonsHtml;
        if (isProcessing) {
            buttonsHtml = '<div class="flex items-center gap-2 text-xs text-txt-3"><span class="ha-spinner"></span> Processing...</div>';
        } else if (isOutdated) {
            buttonsHtml = `
                <div class="flex items-center gap-2">
                    <span class="text-[0.6rem] text-txt-3 italic">Outdated task (no draft_id)</span>
                    <button class="btn btn-ghost text-xs py-1.5 px-3" onclick="event.stopPropagation();fireAction(${i}, 'skip')" id="ht-actionbtn-${i}-skip">⏭ Skip</button>
                </div>`;
        } else {
            buttonsHtml = `
                <button class="btn btn-approve text-xs py-1.5 px-3" onclick="event.stopPropagation();fireAction(${i}, 'approve')" id="ht-actionbtn-${i}-approve">✓ Approve</button>
                <button class="btn btn-modify text-xs py-1.5 px-3" onclick="event.stopPropagation();toggleSocialEdit(${i})" id="ht-actionbtn-${i}-edit">✎ Edit & Approve</button>
                <button class="btn btn-deny text-xs py-1.5 px-3" onclick="event.stopPropagation();fireAction(${i}, 'reject')" id="ht-actionbtn-${i}-reject">↻ Redraft</button>
                <button class="btn btn-ghost text-xs py-1.5 px-3" onclick="event.stopPropagation();fireAction(${i}, 'skip')" id="ht-actionbtn-${i}-skip">⏭ Skip</button>
            `;
        }

        return `
            <div class="human-task-card${isProcessing ? ' processing' : ''}" style="border-left-color: ${borderColor};">
                <div class="flex items-start gap-2 cursor-pointer" onclick="toggleHumanTaskDetail(${i})">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap mb-1">
                            ${typeBadge}
                            <span class="badge" style="background:${platBg};color:${platTxt};">${esc(platLabel)}</span>
                            <span class="badge" style="background:rgba(168,85,247,0.12);color:#C084FC;">${esc(outreachType || 'engagement')}</span>
                            ${isOutdated ? '<span class="badge" style="background:rgba(255,107,107,0.12);color:#FF6B6B;font-size:0.5rem;">OUTDATED</span>' : ''}
                        </div>
                        <div class="text-sm font-medium text-txt">${esc(task.title || 'Social Draft Review')}</div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0 mt-1">
                        ${linkHtml}
                        <span class="text-[0.6rem] text-txt-3 whitespace-nowrap">${timeAgo(task.created_at)}</span>
                    </div>
                </div>
                <div class="human-task-detail" id="ht-detail-${i}">
                    ${task.description ? `<div class="text-xs text-txt-3 mt-1 mb-2">${esc(task.description)}</div>` : ''}
                    <div class="mt-2" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:0.375rem;padding:0.625rem 0.75rem;">
                        <div class="text-[0.65rem] text-txt-3 uppercase tracking-wide mb-1 font-mono">Draft ${esc(outreachType === 'dm' ? 'message' : 'comment')}</div>
                        <div class="text-xs text-txt-2" style="white-space:pre-wrap;line-height:1.6;" id="ht-draft-display-${i}">${esc(draftText)}</div>
                    </div>
                    <div id="ht-social-edit-${i}" style="display:none;" class="mt-2">
                        <textarea class="form-input text-xs" id="ht-social-edit-text-${i}" rows="4" onclick="event.stopPropagation()">${esc(draftText)}</textarea>
                        <div class="flex gap-2 mt-1">
                            <button class="btn btn-approve text-xs py-1 px-2" onclick="event.stopPropagation();submitSocialEdit(${i})">Save & Approve</button>
                            <button class="btn btn-ghost text-xs py-1 px-2" onclick="event.stopPropagation();cancelSocialEdit(${i})">Cancel</button>
                        </div>
                    </div>
                    <div class="mt-2">
                        <textarea id="ht-feedback-${i}" class="form-input text-xs" rows="2" placeholder="Feedback (optional, used for redraft)" onclick="event.stopPropagation()"></textarea>
                    </div>
                    ${threadUrl || profileUrl ? `
                    <div class="mt-2">
                        <a href="${esc(threadUrl || profileUrl)}" target="_blank" class="btn btn-ghost text-xs py-1.5 px-3 inline-flex items-center gap-1.5" onclick="event.stopPropagation()" style="border-color:${platTxt};color:${platTxt};">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M5 1H2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V7M7 1h4v4M4.5 7.5L11 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            ${platform === 'reddit' && threadUrl ? 'Open Reddit Thread' : 'Open Profile'}
                        </a>
                    </div>
                    ` : ''}
                    <div class="flex flex-wrap gap-1.5 mt-3" id="ht-buttons-${i}">
                        ${buttonsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    function toggleSocialEdit(idx) {
        const editDiv = document.getElementById(`ht-social-edit-${idx}`);
        const displayDiv = document.getElementById(`ht-draft-display-${idx}`);
        if (editDiv.style.display === 'none') {
            editDiv.style.display = '';
            if (displayDiv) displayDiv.style.display = 'none';
            document.getElementById(`ht-social-edit-text-${idx}`).focus();
        } else {
            editDiv.style.display = 'none';
            if (displayDiv) displayDiv.style.display = '';
        }
    }

    function cancelSocialEdit(idx) {
        document.getElementById(`ht-social-edit-${idx}`).style.display = 'none';
        const displayDiv = document.getElementById(`ht-draft-display-${idx}`);
        if (displayDiv) displayDiv.style.display = '';
    }

    async function submitSocialEdit(idx) {
        const editedContent = document.getElementById(`ht-social-edit-text-${idx}`).value.trim();
        if (!editedContent) { toast('Draft content cannot be empty', 'error'); return; }
        // Fire the edit action with edited_content
        const task = humanTasksData[idx];
        if (!task) return;
        const feedback = document.getElementById(`ht-feedback-${idx}`)?.value?.trim() || '';

        document.querySelectorAll(`#ht-buttons-${idx} .btn`).forEach(b => { b.disabled = true; b.style.opacity = '0.4'; });

        try {
            const result = await fetchJSON(API.humanAction, {
                task_id: task.task_id,
                action: 'edit',
                feedback: feedback || undefined,
                edited_content: editedContent,
                acted_by: 'bradford'
            });
            if (result?.success) {
                humanTasksData.splice(idx, 1);
                renderHumanTasks();
                updateStatusBar();
                toast(`Edited & approved: ${task.title || task.task_id}`, 'success');
            } else {
                toast(`Failed: ${result?.message || result?.error || 'Unknown error'}`, 'error');
                document.querySelectorAll(`#ht-buttons-${idx} .btn`).forEach(b => { b.disabled = false; b.style.opacity = '1'; });
            }
        } catch (err) {
            toast(`Failed: ${err.message}`, 'error');
            document.querySelectorAll(`#ht-buttons-${idx} .btn`).forEach(b => { b.disabled = false; b.style.opacity = '1'; });
        }
    }

    function toggleInlineCrm(idx) {
        const checked = document.getElementById(`ht-logcrm-${idx}`).checked;
        document.getElementById(`ht-crm-fields-${idx}`).style.display = checked ? '' : 'none';
    }

    function toggleInlinePlatform(idx) {
        const channel = document.getElementById(`ht-channel-${idx}`).value;
        document.getElementById(`ht-platform-${idx}`).style.display = channel === 'social' ? '' : 'none';
    }

    async function fireAction(idx, action) {
        const task = humanTasksData[idx];
        if (!task) return;

        const feedback = document.getElementById(`ht-feedback-${idx}`)?.value?.trim() || '';

        // Validate feedback required for reject/request_changes
        if (['reject', 'request_changes'].includes(action) && !feedback) {
            toast('Please provide feedback for this action.', 'error');
            document.getElementById(`ht-feedback-${idx}`).focus();
            return;
        }

        // Disable all action buttons in this card
        document.querySelectorAll(`#ht-buttons-${idx} .btn`).forEach(b => { b.disabled = true; b.style.opacity = '0.4'; });
        const clickedBtn = document.getElementById(`ht-actionbtn-${idx}-${action}`);
        if (clickedBtn) { clickedBtn.style.opacity = '1'; clickedBtn.textContent = 'Sending...'; }

        try {
            // Log CRM interaction if checked
            const logCrm = document.getElementById(`ht-logcrm-${idx}`)?.checked;
            if (logCrm) {
                const params = task.parameters && typeof task.parameters === 'object' ? task.parameters : {};
                const channel = document.getElementById(`ht-channel-${idx}`).value;
                const platform = channel === 'social' ? document.getElementById(`ht-platform-${idx}`).value : null;
                if (params.contact_id) {
                    await fetchJSON(API.crm, {
                        task_id: `human-${Date.now()}`,
                        brand_id: 'carlton',
                        domain: 'crm',
                        operation: 'log_interaction',
                        parameters: {
                            contact_id: params.contact_id,
                            channel: channel,
                            interaction_type: 'task_completed',
                            direction: channel.includes('outbound') ? 'outbound' : 'inbound',
                            summary: feedback || `Task ${action}`,
                            details: { platform: platform, task_id: task.task_id }
                        }
                    });
                }
            }

            // Send to human-action webhook
            const result = await fetchJSON(API.humanAction, {
                task_id: task.task_id,
                action: action,
                feedback: feedback || undefined,
                acted_by: 'bradford'
            });

            if (result?.success) {
                humanTasksData.splice(idx, 1);
                renderHumanTasks();
                updateStatusBar();
                const cbMsg = result.callback_fired ? ' — workflow continuing' : '';
                toast(`${formatActionLabel(action)}: ${task.title || task.task_id}${cbMsg}`, 'success');
            } else {
                toast(`Failed: ${result?.message || result?.error || 'Unknown error'}`, 'error');
                document.querySelectorAll(`#ht-buttons-${idx} .btn`).forEach(b => { b.disabled = false; b.style.opacity = '1'; });
                if (clickedBtn) clickedBtn.textContent = ACTION_BUTTON_CONFIG[action]?.icon + ' ' + formatActionLabel(action);
            }
        } catch (err) {
            toast(`Failed: ${err.message}`, 'error');
            document.querySelectorAll(`#ht-buttons-${idx} .btn`).forEach(b => { b.disabled = false; b.style.opacity = '1'; });
            if (clickedBtn) clickedBtn.textContent = ACTION_BUTTON_CONFIG[action]?.icon + ' ' + formatActionLabel(action);
        }
    }

    // Legacy submitCompleteTask/submitRefuseTask removed — replaced by unified submitHumanAction above

    // ═══════════════════════════════════════
    // STATUS BAR
    // ═══════════════════════════════════════
    function updateStatusBar() {
        const today = new Date().toISOString().split('T')[0];
        const active = taskData.filter(t => ['ready', 'in_progress'].includes(t.status)).length;
        const review = reviewData.length + directiveData.length;
        const completed = taskData.filter(t => t.status === 'completed' && (t.completed_at || t.updated_at || '').startsWith(today)).length;
        const failed = taskData.filter(t => t.status === 'failed' && (t.completed_at || t.updated_at || '').startsWith(today)).length;
        const blocked = taskData.filter(t => t.status === 'blocked').length;

        document.getElementById('statActive').textContent = active;
        document.getElementById('statReview').textContent = review;
        document.getElementById('statCompleted').textContent = completed;
        document.getElementById('statFailed').textContent = failed;
        document.getElementById('statBlocked').textContent = blocked;

        // System pulse
        const pulse = document.getElementById('systemPulse');
        if (failed > 3) { pulse.className = 'pulse-dot error'; }
        else { pulse.className = 'pulse-dot'; }
    }

    // ═══════════════════════════════════════
    // RENDER: DIRECTIVE APPROVALS
    // ═══════════════════════════════════════
    function toggleDirPanel() {
        dirPanelOpen = !dirPanelOpen;
        document.getElementById('dirPanelBody').style.display = dirPanelOpen ? '' : 'none';
        document.getElementById('dirCollapseBtn').classList.toggle('open', dirPanelOpen);
    }

    let dirHistoryOpen = true;
    function toggleDirHistory() {
        dirHistoryOpen = !dirHistoryOpen;
        document.getElementById('directiveHistoryPanel').style.display = dirHistoryOpen ? '' : 'none';
        document.getElementById('dirHistoryCollapseBtn').classList.toggle('open', dirHistoryOpen);
    }

    function toggleDirectiveDetail(idx) {
        const el = document.getElementById(`dir-detail-${idx}`);
        if (el) el.classList.toggle('open');
    }

    function renderDirectives() {
        const panel = document.getElementById('directivePanel');
        const countEl = document.getElementById('directiveCount');
        const histPanel = document.getElementById('directiveHistoryPanel');

        countEl.textContent = directiveData.length;

        // Pending approvals
        if (directiveData.length === 0) {
            panel.innerHTML = '<div class="text-center py-4 text-txt-3 text-sm">No directives pending approval</div>';
        } else {
            const DISPLAY_LIMIT = 5;
            const showAll = panel.dataset.showAll === 'true';
            const displayItems = showAll ? directiveData : directiveData.slice(0, DISPLAY_LIMIT);
            let html = displayItems.map((d, i) => {
                const riskClass = d.risk_level === 'high' ? 'risk-high' : d.risk_level === 'medium' ? 'risk-medium' : 'risk-low';
                const riskBadge = d.risk_level === 'high'
                    ? '<span class="badge badge-failed">HIGH</span>'
                    : d.risk_level === 'medium'
                        ? '<span class="badge badge-blocked">MEDIUM</span>'
                        : '<span class="badge" style="background:rgba(6,214,160,0.12);color:#06D6A0;">LOW</span>';

                const priorityBadge = `<span class="badge badge-p${d.priority || 3}">P${d.priority || 3}</span>`;

                // Acceptance criteria
                let criteriaHtml = '';
                if (d.acceptance_criteria) {
                    const criteria = Array.isArray(d.acceptance_criteria) ? d.acceptance_criteria : [];
                    if (criteria.length > 0) {
                        criteriaHtml = `
                            <div class="mt-2">
                                <span class="text-[0.65rem] font-semibold text-txt-3 uppercase tracking-wider">Acceptance Criteria</span>
                                <ul class="criteria-list">${criteria.map(c => `<li>${esc(typeof c === 'string' ? c : c.criterion || JSON.stringify(c))}</li>`).join('')}</ul>
                            </div>`;
                    }
                }

                // Target domains
                let domainsHtml = '';
                const domains = d.target_domains || (d.domain ? [d.domain] : []);
                if (domains.length > 0) {
                    domainsHtml = `<div class="flex flex-wrap gap-1 mt-2">${domains.map(dm => `<span class="domain-chip">${esc(dm)}</span>`).join('')}</div>`;
                }

                // Context
                let contextHtml = '';
                if (d.context && typeof d.context === 'object') {
                    const parts = [];
                    if (d.context.why_now) parts.push(`<div><span class="text-txt-3 text-[0.65rem] uppercase font-semibold">Why now:</span> <span class="text-txt-2 text-xs">${esc(d.context.why_now)}</span></div>`);
                    if (d.context.constraints) parts.push(`<div><span class="text-txt-3 text-[0.65rem] uppercase font-semibold">Constraints:</span> <span class="text-txt-2 text-xs">${esc(typeof d.context.constraints === 'string' ? d.context.constraints : JSON.stringify(d.context.constraints))}</span></div>`);
                    if (d.context.resources) parts.push(`<div><span class="text-txt-3 text-[0.65rem] uppercase font-semibold">Resources:</span> <span class="text-txt-2 text-xs">${esc(typeof d.context.resources === 'string' ? d.context.resources : JSON.stringify(d.context.resources))}</span></div>`);
                    if (parts.length > 0) contextHtml = `<div class="mt-2 space-y-1">${parts.join('')}</div>`;
                }

                return `
                    <div class="directive-card ${riskClass}">
                        <div class="flex items-start gap-2 cursor-pointer" onclick="toggleDirectiveDetail(${i})">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap mb-1">
                                    ${riskBadge}
                                    ${priorityBadge}
                                    <span class="font-mono text-[0.6rem] text-txt-3">${esc(d.directive_id || '')}</span>
                                </div>
                                <div class="text-sm font-medium text-txt">${esc(d.title || 'Untitled')}</div>
                                <div class="text-xs text-txt-2 mt-0.5 line-clamp-2">${esc(d.objective || '')}</div>
                            </div>
                            <span class="text-[0.6rem] text-txt-3 whitespace-nowrap flex-shrink-0 mt-1">${timeAgo(d.created_at)}</span>
                        </div>
                        <div class="directive-detail" id="dir-detail-${i}">
                            ${criteriaHtml}
                            ${domainsHtml}
                            ${contextHtml}
                            <div class="directive-actions">
                                <textarea id="dir-notes-${i}" placeholder="Add notes for the system..." rows="2"></textarea>
                                <div class="flex flex-col gap-1.5">
                                    <button class="btn btn-approve text-xs py-1.5 px-3 whitespace-nowrap" onclick="approveDirective('${esc(d.directive_id)}', ${i})">Approve</button>
                                    <button class="btn btn-deny text-xs py-1.5 px-3 whitespace-nowrap" onclick="rejectDirective('${esc(d.directive_id)}', ${i})">Reject</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            if (directiveData.length > DISPLAY_LIMIT) {
                const btnText = showAll ? 'Show Less' : `Show All (${directiveData.length} total)`;
                html += `<div class="text-center mt-3 pt-3" style="border-top: 1px solid var(--deft-border, #2A2E3D);">
                    <button onclick="this.closest('.panel-body').dataset.showAll = this.closest('.panel-body').dataset.showAll === 'true' ? 'false' : 'true'; renderDirectives();" class="btn btn-ghost text-xs py-1.5 px-4">${btnText}</button>
                </div>`;
            }
            panel.innerHTML = html;
        }

        // Active directives
        const activePanel = document.getElementById('activeDirectivesPanel');
        if (activeDirectives.length === 0) {
            activePanel.innerHTML = '';
        } else {
            activePanel.innerHTML = `
                <div class="text-[0.65rem] font-semibold text-txt-3 uppercase tracking-wider mb-2">Active Directives (${activeDirectives.length})</div>
                ${activeDirectives.map(d => {
                    const statusBadge = d.status === 'active'
                        ? '<span class="badge badge-in_progress" style="font-size:0.6rem;">Active</span>'
                        : '<span class="badge badge-ready" style="font-size:0.6rem;">In Progress</span>';
                    const riskDot = d.risk_level === 'high' ? '#FF6B6B' : d.risk_level === 'medium' ? '#FFD93D' : '#06D6A0';
                    const domains = d.target_domains || (d.domain ? [d.domain] : []);
                    const domainChips = domains.length > 0 ? domains.map(dm => `<span class="domain-chip" style="font-size:0.55rem;">${esc(dm)}</span>`).join('') : '';
                    return `
                        <div class="history-row">
                            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${riskDot}"></div>
                            <span class="text-txt flex-1 truncate" title="${esc(d.title)}">${esc(d.title)}</span>
                            ${statusBadge}
                            ${domainChips}
                            <span class="text-txt-3 text-[0.6rem] whitespace-nowrap">${timeAgo(d.created_at)}</span>
                        </div>
                    `;
                }).join('')}
            `;
        }

        // Decision history
        if (directiveHistory.length === 0) {
            histPanel.innerHTML = '<div class="text-center py-3 text-txt-3 text-xs">No recent decisions</div>';
        } else {
            histPanel.innerHTML = `
                <div class="text-[0.65rem] font-semibold text-txt-3 uppercase tracking-wider mb-2">Recent Decisions</div>
                ${directiveHistory.map(h => {
                    const statusBadge = h.status === 'active'
                        ? '<span class="badge badge-blocked" style="font-size:0.6rem;animation:pulse 2s infinite;">Decomposing\u2026</span>'
                        : h.status === 'in_progress'
                            ? '<span class="badge badge-ready" style="font-size:0.6rem;">In Progress</span>'
                        : h.status === 'completed'
                            ? '<span class="badge badge-ready" style="font-size:0.6rem;">completed</span>'
                        : h.status === 'cancelled'
                            ? '<span class="badge badge-failed" style="font-size:0.6rem;">rejected</span>'
                            : `<span class="badge" style="font-size:0.6rem;">${esc(h.status)}</span>`;
                    const riskDot = h.risk_level === 'high' ? '#FF6B6B' : h.risk_level === 'medium' ? '#FFD93D' : '#06D6A0';
                    return `
                        <div class="history-row">
                            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${riskDot}"></div>
                            <span class="text-txt flex-1 truncate" title="${esc(h.title)}">${esc(h.title)}</span>
                            ${statusBadge}
                            ${h.approval_notes ? `<span class="text-txt-3 truncate max-w-[150px]" title="${esc(h.approval_notes)}">${esc(h.approval_notes)}</span>` : ''}
                            <span class="text-txt-3 text-[0.6rem] whitespace-nowrap">${timeAgo(h.approved_at)}</span>
                        </div>
                    `;
                }).join('')}
            `;
        }
    }

    async function approveDirective(directiveId, idx) {
        const notes = document.getElementById(`dir-notes-${idx}`)?.value?.trim() || '';
        const btn = event?.target; if (btn) btn.disabled = true;

        const result = await fetchJSON(API.directiveAction, {
            action: 'approve',
            directive_id: directiveId,
            feedback: notes || '',
            reviewer_name: 'Bradford',
        });

        if (result?.success) {
            toast(`Approved: ${directiveData[idx]?.title || directiveId}`, 'success');
            directiveData.splice(idx, 1);
            renderDirectives();
            updateStatusBar();
        } else {
            toast(`Failed to approve: ${result?.error || 'Unknown error'}`, 'error');
            if (btn) btn.disabled = false;
        }
    }

    async function rejectDirective(directiveId, idx) {
        const notes = document.getElementById(`dir-notes-${idx}`)?.value?.trim() || '';
        const btn = event?.target; if (btn) btn.disabled = true;

        const result = await fetchJSON(API.directiveAction, {
            action: 'deny',
            directive_id: directiveId,
            feedback: notes || undefined,
            reviewer_name: 'Bradford',
        });

        if (result?.success) {
            toast(`Rejected: ${directiveData[idx]?.title || directiveId}`, 'success');
            directiveData.splice(idx, 1);
            renderDirectives();
            updateStatusBar();
        } else {
            toast(`Failed to reject: ${result?.error || 'Unknown error'}`, 'error');
            if (btn) btn.disabled = false;
        }
    }

    // ═══════════════════════════════════════
    // RENDER: HUMAN REVIEW
    // ═══════════════════════════════════════
    function renderReviews() {
        const panel = document.getElementById('reviewPanel');
        const countEl = document.getElementById('reviewCount');
        countEl.textContent = reviewData.length;

        if (reviewData.length === 0) {
            panel.innerHTML = '<div class="empty-state"><div class="mb-2 text-2xl opacity-40">✓</div>No items pending review</div>';
            return;
        }

        const DISPLAY_LIMIT = 5;
        const showAll = panel.dataset.showAll === 'true';
        const displayItems = showAll ? reviewData : reviewData.slice(0, DISPLAY_LIMIT);
        let html = displayItems.map((item, i) => {
            const taskId = item.task_id || 'Unknown';
            const contentType = item.content_type || '';
            const content = item.content || '';
            const aiDecision = item.ai_decision || '';
            const reason = item.escalation_reason || '';
            const confidence = item.confidence;
            const summary = item.summary || '';
            const isInfra = contentType === 'infrastructure/install_request';

            // Parse issues: infrastructure items have object {type, risk_level, integrations}, content items have array of strings
            let issuesDisplay = '';
            let infraIntegrations = [];
            let infraRiskLevel = '';
            if (isInfra && item.issues && typeof item.issues === 'object' && !Array.isArray(item.issues)) {
                infraRiskLevel = item.issues.risk_level || 'high';
                infraIntegrations = Array.isArray(item.issues.integrations) ? item.issues.integrations : [];
            } else {
                issuesDisplay = Array.isArray(item.issues) ? item.issues.join(', ') : (item.issues || '');
            }

            // Header badges
            const typeBadge = isInfra
                ? `<span class="badge badge-infra">INFRASTRUCTURE</span><span class="badge badge-risk-high">${esc(infraRiskLevel.toUpperCase())} RISK</span>`
                : (contentType ? `<span class="badge badge-domain">${esc(contentType)}</span>` : '');
            const confidenceLabel = isInfra
                ? '<span class="text-xs text-warn">Requires Manual Approval</span>'
                : (confidence ? `<span class="text-xs text-txt-3">Confidence: ${esc(String(confidence))}</span>` : '');

            // Detail section
            let detailContent = '';
            if (isInfra) {
                const integrationsList = infraIntegrations.length
                    ? `<div class="mb-3"><span class="text-xs text-txt-3 uppercase tracking-wider font-medium">Integrations to Install</span><ul class="mt-1 text-xs text-txt-2 list-disc list-inside">${infraIntegrations.map(pkg => `<li class="py-0.5">${esc(String(pkg))}</li>`).join('')}</ul></div>`
                    : '';
                detailContent = `
                    ${integrationsList}
                    <div class="mb-3">
                        <span class="text-xs text-txt-3 uppercase tracking-wider font-medium">Justification</span>
                        <div class="mt-1 p-3 rounded text-xs text-txt-2 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto" style="background: rgba(0,0,0,0.3); border: 1px solid #1E2130;">
${esc(content)}
                        </div>
                    </div>`;
            } else {
                detailContent = `
                    ${issuesDisplay ? `<div class="mb-3"><span class="text-xs text-txt-3 uppercase tracking-wider font-medium">Issues</span><p class="text-xs text-warn mt-1">${esc(issuesDisplay)}</p></div>` : ''}
                    <div class="mb-3">
                        <span class="text-xs text-txt-3 uppercase tracking-wider font-medium">Content</span>
                        <div class="mt-1 p-3 rounded text-xs text-txt-2 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto" style="background: rgba(0,0,0,0.3); border: 1px solid #1E2130;">
${esc(content)}
                        </div>
                    </div>`;
            }

            return `
                <div class="review-card mb-3 p-4" id="review-${i}">
                    <div class="flex items-start justify-between gap-3 cursor-pointer" onclick="toggleReview(${i})">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span class="font-mono text-xs text-info">${esc(taskId)}</span>
                                ${typeBadge}
                                ${confidenceLabel}
                            </div>
                            ${summary ? `<p class="text-sm text-txt mb-1">${esc(summary)}</p>` : ''}
                            ${reason ? `<p class="text-xs text-alert"><span class="text-txt-3">Escalation:</span> ${esc(reason)}</p>` : ''}
                        </div>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="text-txt-3 flex-shrink-0 mt-1 transition-transform" id="chevron-${i}">
                            <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                        </svg>
                    </div>

                    <div class="hidden mt-4" id="review-detail-${i}">
                        ${detailContent}

                        <div class="mb-3">
                            <label class="text-xs text-txt-3 uppercase tracking-wider font-medium block mb-1">Notes / Feedback</label>
                            <textarea class="form-input text-xs" rows="2" placeholder="Add notes about your decision..." id="review-notes-${i}"></textarea>
                        </div>

                        <div class="flex gap-2 flex-wrap">
                            <button class="btn btn-approve text-xs" onclick="submitDecision('${esc(taskId)}', 'approved', ${i})">
                                ✓ Approve
                            </button>
                            ${isInfra ? '' : `<button class="btn btn-modify text-xs" onclick="openModify('${esc(taskId)}', ${i})">
                                ✎ Modify
                            </button>`}
                            <button class="btn btn-deny text-xs" onclick="submitDecision('${esc(taskId)}', 'denied', ${i})">
                                ✕ Deny
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        if (reviewData.length > DISPLAY_LIMIT) {
            const btnText = showAll ? 'Show Less' : `Show All (${reviewData.length} total)`;
            html += `<div class="text-center mt-3 pt-3" style="border-top: 1px solid var(--deft-border, #2A2E3D);">
                <button onclick="this.closest('.panel-body').dataset.showAll = this.closest('.panel-body').dataset.showAll === 'true' ? 'false' : 'true'; renderReviews();" class="btn btn-ghost text-xs py-1.5 px-4">${btnText}</button>
            </div>`;
        }
        panel.innerHTML = html;
    }

    function toggleReview(i) {
        const detail = document.getElementById(`review-detail-${i}`);
        const chevron = document.getElementById(`chevron-${i}`);
        const card = document.getElementById(`review-${i}`);
        const isHidden = detail.classList.contains('hidden');
        detail.classList.toggle('hidden');
        card.classList.toggle('expanded', isHidden);
        chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
    }

    // ═══════════════════════════════════════
    // RENDER: TASK QUEUE
    // ═══════════════════════════════════════
    function renderTasks() {
        const panel = document.getElementById('taskPanel');
        const statusFilter = document.getElementById('filterStatus').value;
        const domainFilter = document.getElementById('filterDomain').value;

        let filtered = taskData.filter(t => ['pending', 'ready', 'in_progress', 'blocked', 'review'].includes(t.status));
        if (statusFilter !== 'all') filtered = filtered.filter(t => t.status === statusFilter);
        if (domainFilter !== 'all') filtered = filtered.filter(t => t.domain === domainFilter);

        if (filtered.length === 0) {
            panel.innerHTML = '<div class="empty-state">No active tasks</div>';
            return;
        }

        const DISPLAY_LIMIT = 5;
        const showAll = panel.dataset.showAll === 'true';
        const displayItems = showAll ? filtered : filtered.slice(0, DISPLAY_LIMIT);
        let html = displayItems.map(t => {
            const displayDomain = t.payload?.original_domain || t.domain || '—';
            const icon = DOMAIN_ICONS[t.domain] || DOMAIN_ICONS[t.payload?.original_domain] || '⚙️';
            const age = timeAgo(t.created_at);
            const p = Math.max(1, Math.min(5, t.priority || 3));
            const dirId = t.directive_id || t.payload?.directive_id;
            const directiveLabel = dirId ? `<div class="text-[0.6rem] text-txt-3 opacity-70">DIR: ${esc(dirId)}</div>` : '';
            return `
                <div class="task-row">
                    <span class="badge badge-${t.status}">${t.status.replace('_', ' ')}</span>
                    <span class="badge badge-p${p}">P${p}</span>
                    <div class="min-w-0">
                        <div class="text-txt truncate" title="${esc(t.title || '')}">${esc(t.title || 'Untitled')}</div>
                        <div class="text-xs text-txt-3 mt-0.5">${icon} ${displayDomain}</div>
                        ${directiveLabel}
                    </div>
                    <span class="text-xs text-txt-3 font-mono whitespace-nowrap">${age}</span>
                    ${t.revenue_impact ? `<span class="text-xs text-accent font-mono">$${t.revenue_impact}</span>` : '<span></span>'}
                </div>
            `;
        }).join('');
        if (filtered.length > DISPLAY_LIMIT) {
            const btnText = showAll ? 'Show Less' : `Show All (${filtered.length} total)`;
            html += `<div class="text-center mt-3 pt-3" style="border-top: 1px solid var(--deft-border, #2A2E3D);">
                <button onclick="this.closest('.panel-body').dataset.showAll = this.closest('.panel-body').dataset.showAll === 'true' ? 'false' : 'true'; renderTasks();" class="btn btn-ghost text-xs py-1.5 px-4">${btnText}</button>
            </div>`;
        }
        panel.innerHTML = html;
    }

    // ═══════════════════════════════════════
    // RENDER: ACTIVITY
    // ═══════════════════════════════════════
    function renderActivity() {
        const panel = document.getElementById('activityPanel');

        if (activityData.length === 0) {
            panel.innerHTML = '<div class="empty-state">No recent activity</div>';
            return;
        }

        const DISPLAY_LIMIT = 5;
        const showAll = panel.dataset.showAll === 'true';
        const displayItems = showAll ? activityData : activityData.slice(0, DISPLAY_LIMIT);
        let html = displayItems.map(t => {
            const isCompleted = t.status === 'completed';
            const dotColor = isCompleted ? '#22C55E' : '#FF6B6B';
            const icon = DOMAIN_ICONS[t.domain] || '⚙️';
            const age = timeAgo(t.completed_at || t.updated_at || t.created_at);

            return `
                <div class="timeline-item">
                    <div class="timeline-dot" style="background: ${dotColor};"></div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-0.5">
                            <span class="text-txt truncate">${esc(t.title || 'Untitled')}</span>
                            <span class="badge badge-domain text-[0.6rem]">${icon} ${t.domain || ''}</span>
                        </div>
                        ${t.result_summary ? `<p class="text-xs text-txt-3 truncate">${esc(t.result_summary)}</p>` : ''}
                        ${!isCompleted && t.error_message ? `<p class="text-xs text-alert truncate">${esc(t.error_message)}</p>` : ''}
                        ${t.source === 'directive' && (t.human_action_type || t.operation) && !t.result_summary ? `<p class="text-xs text-txt-3 truncate">${esc(t.human_action_type || t.operation)}</p>` : ''}
                        <span class="text-[0.65rem] text-txt-3 font-mono">${age}${t.retry_count ? ` · retry ${t.retry_count}` : ''}</span>
                    </div>
                </div>
            `;
        }).join('');
        if (activityData.length > DISPLAY_LIMIT) {
            const btnText = showAll ? 'Show Less' : `Show All (${activityData.length} total)`;
            html += `<div class="text-center mt-3 pt-3" style="border-top: 1px solid var(--deft-border, #2A2E3D);">
                <button onclick="this.closest('.panel-body').dataset.showAll = this.closest('.panel-body').dataset.showAll === 'true' ? 'false' : 'true'; renderActivity();" class="btn btn-ghost text-xs py-1.5 px-4">${btnText}</button>
            </div>`;
        }
        panel.innerHTML = html;
    }

    // ═══════════════════════════════════════
    // RENDER: HEALTH
    // ═══════════════════════════════════════
    function renderHealth(logs) {
        const panel = document.getElementById('healthPanel');

        if (logs.length === 0) {
            panel.innerHTML = '<div class="empty-state">No execution data available</div>';
            return;
        }

        // Error rate
        const errors = logs.filter(l => l.result === 'failure' || l.result === 'error').length;
        const errorRate = logs.length > 0 ? ((errors / logs.length) * 100).toFixed(1) : 0;
        const errorColor = errorRate > 20 ? '#FF6B6B' : errorRate > 10 ? '#FFD93D' : '#06D6A0';

        // Workflow counts
        const wfCounts = {};
        logs.forEach(l => {
            const wf = l.workflow || 'Unknown';
            wfCounts[wf] = (wfCounts[wf] || 0) + 1;
        });
        const sorted = Object.entries(wfCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

        // Recent errors
        const recentErrors = logs.filter(l => l.result === 'failure' || l.result === 'error').slice(0, 4);

        panel.innerHTML = `
            <div class="mb-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs text-txt-3 uppercase tracking-wider font-medium">Error Rate (last 50 executions)</span>
                    <span class="font-heading font-bold text-sm" style="color: ${errorColor};">${errorRate}%</span>
                </div>
                <div class="error-bar">
                    <div class="error-fill" style="width: ${Math.min(errorRate, 100)}%; background: ${errorColor};"></div>
                </div>
            </div>

            <div class="mb-4">
                <span class="text-xs text-txt-3 uppercase tracking-wider font-medium block mb-2">Workflow Activity</span>
                ${sorted.map(([wf, count]) => `
                    <div class="flex items-center gap-2 mb-1.5">
                        <span class="text-[0.65rem] font-mono text-txt-2 w-32 truncate" title="${esc(wf)}">${esc(wf)}</span>
                        <div class="flex-1 h-2 rounded" style="background: rgba(255,255,255,0.04);">
                            <div class="h-full rounded" style="width: ${(count / maxCount) * 100}%; background: rgba(6,214,160,0.5);"></div>
                        </div>
                        <span class="text-[0.6rem] font-mono text-txt-3 w-5 text-right">${count}</span>
                    </div>
                `).join('')}
            </div>

            ${recentErrors.length > 0 ? `
                <div>
                    <span class="text-xs text-txt-3 uppercase tracking-wider font-medium block mb-2">Recent Errors</span>
                    ${recentErrors.map(e => `
                        <div class="text-xs mb-2 p-2 rounded" style="background: rgba(255,107,107,0.06); border: 1px solid rgba(255,107,107,0.1);">
                            <div class="flex items-center gap-2 mb-0.5">
                                <span class="font-mono text-alert">${esc(e.workflow || '')}</span>
                                <span class="text-txt-3 font-mono text-[0.6rem]">${timeAgo(e.timestamp)}</span>
                            </div>
                            ${e.error_message ? `<p class="text-txt-3 truncate">${esc(e.error_message)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    }

    // ═══════════════════════════════════════
    // RENDER: REVENUE
    // ═══════════════════════════════════════
    function renderRevenue(snapshot) {
        const panel = document.getElementById('revenuePanel');

        if (!snapshot) {
            panel.innerHTML = '<div class="empty-state">No financial data available</div>';
            return;
        }

        const target = 100000;
        const actual = parseFloat(snapshot.actual_revenue) || 0;
        const pipeline = parseFloat(snapshot.total_pipeline) || 0;
        const weighted = parseFloat(snapshot.weighted_pipeline) || 0;
        const daysRemaining = parseInt(snapshot.days_remaining) || 0;
        const progress = Math.min((actual / target) * 100, 100);

        panel.innerHTML = `
            <div class="mb-4">
                <div class="flex items-baseline gap-2 mb-1">
                    <span class="font-heading font-bold text-2xl text-accent">$${formatNum(actual)}</span>
                    <span class="text-xs text-txt-3">/ $${formatNum(target)}</span>
                </div>
                <div class="progress-bar mb-2">
                    <div class="progress-fill" style="width: ${progress}%;"></div>
                </div>
                <span class="text-xs text-txt-3">${progress.toFixed(1)}% of target</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <div class="text-xs text-txt-3 mb-0.5">Pipeline</div>
                    <div class="font-heading font-semibold text-sm text-txt">$${formatNum(pipeline)}</div>
                </div>
                <div>
                    <div class="text-xs text-txt-3 mb-0.5">Weighted</div>
                    <div class="font-heading font-semibold text-sm text-txt">$${formatNum(weighted)}</div>
                </div>
                <div>
                    <div class="text-xs text-txt-3 mb-0.5">Days Left</div>
                    <div class="font-heading font-semibold text-sm" style="color: ${daysRemaining < 14 ? '#FF6B6B' : daysRemaining < 30 ? '#FFD93D' : '#E8ECF1'};">${daysRemaining}</div>
                </div>
                <div>
                    <div class="text-xs text-txt-3 mb-0.5">Deals Active</div>
                    <div class="font-heading font-semibold text-sm text-txt">${snapshot.deals_in_progress || 0}</div>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════
    // ACTIONS: APPROVAL
    // ═══════════════════════════════════════
    async function submitDecision(taskId, decision, reviewIndex) {
        const notesEl = document.getElementById(`review-notes-${reviewIndex}`);
        const notes = notesEl ? notesEl.value.trim() : '';

        if (decision === 'denied' && !notes) {
            toast('Please add a note explaining why you denied this.', 'error');
            if (notesEl) notesEl.focus();
            return;
        }

        // Build updates
        const updates = {
            decision: decision,
            decided_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        if (notes) {
            updates.reviewer_notes = notes;
        }

        try {
            // Step 1: Update Supabase directly
            await fetch(`${SUPABASE_URL}/rest/v1/human_review_queue?task_id=eq.${taskId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify(updates),
            });

            // Step 2: Trigger immediate processing
            await fetchJSON(API.approve, { trigger: 'dashboard', task_id: taskId, user_id: activeProfileId });

            toast(`${decision.charAt(0).toUpperCase() + decision.slice(1)}: ${taskId}`, 'success');

            // Remove from local data and re-render
            reviewData = reviewData.filter((_, idx) => idx !== reviewIndex);
            renderReviews();
            updateStatusBar();
        } catch (err) {
            toast(`Failed to submit decision: ${err.message}`, 'error');
        }
    }

    function openModify(taskId, reviewIndex) {
        currentModifyTaskId = taskId;
        const item = reviewData[reviewIndex];
        document.getElementById('modifyTaskId').textContent = taskId;
        document.getElementById('modifyContent').value = item ? (item.content || '') : '';
        document.getElementById('modifyNotes').value = '';
        openModal('modifyModal');
    }

    async function confirmModify() {
        const content = document.getElementById('modifyContent').value.trim();
        const notes = document.getElementById('modifyNotes').value.trim();

        if (!content) {
            toast('Modified content cannot be empty.', 'error');
            return;
        }

        const btn = document.getElementById('confirmModifyBtn');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        try {
            const updates = {
                decision: 'modified',
                decided_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                modified_content: content,
            };
            if (notes) {
                updates.reviewer_notes = notes;
            }

            await fetch(`${SUPABASE_URL}/rest/v1/human_review_queue?task_id=eq.${currentModifyTaskId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify(updates),
            });

            await fetchJSON(API.approve, { trigger: 'dashboard', task_id: currentModifyTaskId, user_id: activeProfileId });

            toast(`Modified: ${currentModifyTaskId}`, 'success');
            closeModal('modifyModal');

            reviewData = reviewData.filter(r => r.task_id !== currentModifyTaskId);
            renderReviews();
            updateStatusBar();
        } catch (err) {
            toast(`Failed: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Submit Modified';
        }
    }

    // ═══════════════════════════════════════
    // ACTIONS: NEW TASK / SOCIAL POST
    // ═══════════════════════════════════════
    function submitNewTask() {
        openModal('taskModal');
    }

    function switchTaskType(type) {
        document.getElementById('taskForm').style.display = type === 'task' ? '' : 'none';
        document.getElementById('socialForm').style.display = type === 'social' ? '' : 'none';
        document.getElementById('tabTask').classList.toggle('active', type === 'task');
        document.getElementById('tabSocial').classList.toggle('active', type === 'social');
    }

    async function handleNewTask(e) {
        e.preventDefault();
        const btn = document.getElementById('submitTaskBtn');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        const payload = {
            task_type: document.getElementById('taskDomain').value,
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDesc').value.trim(),
            priority: parseInt(document.getElementById('taskPriority').value),
            dependencies: [],
            metadata: {},
            user_id: activeProfileId,
        };

        const notes = document.getElementById('taskNotes').value.trim();
        if (notes) payload.metadata = { notes };

        try {
            const result = await fetchJSON(API.intake, payload);
            const taskId = result?.task_id || 'submitted';
            toast(`Task created: ${taskId}`, 'success');

            // Reset form
            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDesc').value = '';
            document.getElementById('taskNotes').value = '';
            document.getElementById('taskDomain').value = 'research';
            document.getElementById('taskPriority').value = '3';

            closeModal('taskModal');
            setTimeout(fetchTaskQueue, 2000);
        } catch (err) {
            toast(`Failed to submit task: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Submit Task';
        }
        return false;
    }

    // Image handling for social posts
    let socialImageData = null; // { base64, filename, mimeType }

    function handleImageSelect(input) {
        const file = input.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast('Image must be under 5MB', 'error');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            socialImageData = {
                base64: e.target.result.split(',')[1], // strip data:...;base64, prefix
                filename: file.name,
                mimeType: file.type,
                size: file.size,
            };

            // Show preview
            const preview = document.getElementById('socialImagePreview');
            const placeholder = document.getElementById('socialImagePlaceholder');
            const zone = document.getElementById('socialUploadZone');
            preview.innerHTML = `
                <div class="relative inline-block">
                    <img src="${e.target.result}" alt="Preview">
                    <button type="button" onclick="event.stopPropagation(); clearSocialImage();"
                        class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem]"
                        style="background: rgba(255,107,107,0.9); color: white; border: none; cursor: pointer;">x</button>
                </div>
                <div class="text-[0.6rem] text-txt-3 mt-1">${esc(file.name)} · ${(file.size / 1024).toFixed(0)}KB</div>
            `;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
            zone.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }

    function clearSocialImage() {
        socialImageData = null;
        document.getElementById('socialImage').value = '';
        document.getElementById('socialImagePreview').classList.add('hidden');
        document.getElementById('socialImagePreview').innerHTML = '';
        document.getElementById('socialImagePlaceholder').classList.remove('hidden');
        document.getElementById('socialUploadZone').classList.remove('has-image');
    }

    async function handleSocialPost(e) {
        e.preventDefault();
        const btn = document.getElementById('submitSocialBtn');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        const platform = document.getElementById('socialPlatform').value;
        const socialNotes = document.getElementById('socialNotes').value.trim();
        const payload = {
            platform: platform,
            content: document.getElementById('socialTopic').value.trim(),
            parameters: {
                tone: document.getElementById('socialTone').value,
                hashtags: [],
            },
            user_id: activeProfileId,
        };
        if (socialNotes) payload.parameters.notes = socialNotes;
        if (socialImageData) {
            payload.parameters.image = {
                base64: socialImageData.base64,
                filename: socialImageData.filename,
                mimeType: socialImageData.mimeType,
                size: socialImageData.size,
            };
        }

        try {
            if (platform === 'all') {
                const platforms = ['linkedin', 'twitter', 'instagram', 'facebook'];
                for (const p of platforms) {
                    await fetchJSON(API.social, { ...payload, platform: p });
                }
                toast(`Social post sent to all platforms`, 'success');
            } else {
                await fetchJSON(API.social, payload);
                toast(`Social post sent to ${platform}`, 'success');
            }

            // Reset form
            document.getElementById('socialTopic').value = '';
            document.getElementById('socialNotes').value = '';
            document.getElementById('socialPlatform').value = 'linkedin';
            document.getElementById('socialTone').value = 'professional';
            clearSocialImage();

            closeModal('taskModal');
            setTimeout(fetchTaskQueue, 2000);
        } catch (err) {
            toast(`Failed to submit social post: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Submit Social Post';
        }
        return false;
    }

    // ═══════════════════════════════════════
    // MODALS
    // ═══════════════════════════════════════
    function openModal(id) {
        document.getElementById(id).classList.add('active');
    }

    function closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }

    // Close modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target === el) el.classList.remove('active');
        });
    });

    // Close modals on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
        }
    });

    // ═══════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════
    function esc(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function timeAgo(dateStr) {
        if (!dateStr) return '—';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    }

    function formatNum(n) {
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return n.toFixed(0);
    }

    function toast(message, type = 'success') {
        const container = document.getElementById('toasts');
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
    }

    // ═══════════════════════════════════════
    // WORKFLOW CONTROL
    // ═══════════════════════════════════════
    let lastActivateResult = null;

    function toggleWfPanel() {
        wfPanelOpen = !wfPanelOpen;
        document.getElementById('wfPanel').style.display = wfPanelOpen ? '' : 'none';
        document.getElementById('wfCollapseBtn').classList.toggle('open', wfPanelOpen);
    }

    // Fetch workflow list from system_registry
    async function fetchWorkflows() {
        const result = await supabaseSelect('system_registry', 'category=eq.workflow&select=name,metadata&order=name.asc');
        workflowRegistry = Array.isArray(result) ? result : [];
        renderWorkflows();
    }

    // Call rdgr-activate webhook
    async function activateWorkflows(mode) {
        const btnId = mode === 'all' ? 'wfBtnAll' : mode === 'core' ? 'wfBtnCore' : 'wfBtnInfra';
        const btn = document.getElementById(btnId);

        // Disable all buttons
        document.querySelectorAll('.wf-activate-btn').forEach(b => b.classList.add('busy'));
        if (btn) btn.textContent = 'Activating...';

        try {
            const result = await fetchJSON(API.activate, { mode, user_id: activeProfileId });
            lastActivateResult = result;

            if (result && result.success) {
                toast(`${result.activated_count}/${result.total} workflows activated`, 'success');
            } else if (result && !result.success) {
                toast(`${result.activated_count}/${result.total} activated — ${result.failed_count} failed`, 'error');
            } else {
                toast('Activation request sent', 'success');
            }

            renderActivateResult(result);
            renderWorkflows();
        } catch (err) {
            toast(`Activation failed: ${err.message}`, 'error');
        } finally {
            document.querySelectorAll('.wf-activate-btn').forEach(b => b.classList.remove('busy'));
            // Restore button text
            document.getElementById('wfBtnAll').innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Activate All (24)';
            document.getElementById('wfBtnCore').textContent = 'Core (12)';
            document.getElementById('wfBtnInfra').textContent = 'Infrastructure (4)';
        }
    }

    function renderActivateResult(result) {
        const badge = document.getElementById('wfResultBadge');
        if (!result) { badge.classList.add('hidden'); return; }

        const isOk = result.success;
        const color = isOk ? '#06D6A0' : '#FF6B6B';
        const icon = isOk
            ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

        let html = `<span style="color:${color}">${icon}</span>`;
        html += `<span style="color:${color}">${result.activated_count}/${result.total} active</span>`;

        if (result.failed && result.failed.length > 0) {
            const failNames = result.failed.map(f => f.name || f.error || 'unknown').join(', ');
            html += `<span class="text-alert" title="${esc(failNames)}">· ${result.failed_count} failed</span>`;
        }

        if (result.timestamp) {
            const t = new Date(result.timestamp);
            html += `<span class="text-txt-3 ml-1">${t.toLocaleTimeString()}</span>`;
        }

        badge.innerHTML = html;
        badge.classList.remove('hidden');
        badge.classList.add('flex');
    }

    function renderWorkflows() {
        const grid = document.getElementById('wfGrid');
        const countEl = document.getElementById('wfActiveCount');

        // Build list from registry
        const workflows = workflowRegistry.map(entry => {
            const meta = entry.metadata || {};
            return {
                id: meta.workflow_id,
                name: entry.name || meta.name || 'Unknown',
                description: meta.description || '',
                status: meta.status || 'unknown',
                trigger: meta.trigger || '',
            };
        });

        // If we have a recent activate result, mark which are activated
        const activatedNames = lastActivateResult?.activated ? new Set(lastActivateResult.activated) : null;
        const failedNames = lastActivateResult?.failed ? new Map(lastActivateResult.failed.map(f => [f.name, f.error])) : null;

        // Count by registry status
        const statusCounts = { active: 0, inactive: 0, broken: 0 };
        workflows.forEach(wf => {
            if (wf.status === 'active') statusCounts.active++;
            else if (wf.status === 'broken') statusCounts.broken++;
            else if (wf.status === 'inactive' || wf.status === 'inactive_pending_credentials') statusCounts.inactive++;
        });

        if (activatedNames) {
            countEl.textContent = `${lastActivateResult.activated_count}/${lastActivateResult.total} active`;
        } else {
            const parts = [`${statusCounts.active} active`];
            if (statusCounts.inactive > 0) parts.push(`${statusCounts.inactive} inactive`);
            if (statusCounts.broken > 0) parts.push(`${statusCounts.broken} broken`);
            countEl.textContent = `${workflows.length} total · ${parts.join(' · ')}`;
        }

        if (workflows.length === 0) {
            grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No workflows found in registry</div>';
            return;
        }

        // Sort: failed first, then by name
        workflows.sort((a, b) => {
            const aFailed = failedNames?.has(a.name);
            const bFailed = failedNames?.has(b.name);
            if (aFailed && !bFailed) return -1;
            if (!aFailed && bFailed) return 1;
            return a.name.localeCompare(b.name);
        });

        grid.innerHTML = workflows.map(wf => {
            const isFailed = failedNames?.has(wf.name);
            const isActivated = activatedNames?.has(wf.name);
            const failError = isFailed ? failedNames.get(wf.name) : null;

            // Card border color
            const cardClass = isFailed ? 'error'
                : wf.status === 'broken' ? 'error'
                : wf.status === 'inactive' || wf.status === 'inactive_pending_credentials' ? 'inactive'
                : '';

            // Status dot
            let dotColor, dotTitle;
            if (isFailed) {
                dotColor = '#FF6B6B'; dotTitle = `Failed: ${failError}`;
            } else if (isActivated) {
                dotColor = '#06D6A0'; dotTitle = 'Active';
            } else if (wf.status === 'active') {
                dotColor = 'rgba(6,214,160,0.4)'; dotTitle = 'Registered active';
            } else if (wf.status === 'broken') {
                dotColor = '#FF6B6B'; dotTitle = 'Broken';
            } else {
                dotColor = '#525E73'; dotTitle = wf.status;
            }

            // Registry badge
            const regBadge = wf.status === 'broken'
                ? '<span class="badge badge-failed">broken</span>'
                : wf.status === 'inactive' || wf.status === 'inactive_pending_credentials'
                    ? '<span class="badge badge-blocked">inactive</span>'
                    : '';

            return `
                <div class="wf-card ${cardClass}" title="${esc(wf.description)}">
                    <div class="flex items-center gap-2 min-w-0 flex-1">
                        <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${dotColor}" title="${esc(dotTitle)}"></div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="text-xs font-medium text-txt truncate">${esc(wf.name)}</span>
                                ${regBadge}
                            </div>
                            ${wf.id ? `<span class="text-[0.6rem] font-mono text-txt-3">${esc(wf.id)}</span>` : ''}
                        </div>
                    </div>
                    ${isFailed ? `<span class="text-[0.6rem] text-alert truncate max-w-[120px]" title="${esc(failError)}">${esc(failError)}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    // Add workflow fetching to refreshAll
    const _origRefreshAll = refreshAll;
    refreshAll = async function() {
        await Promise.all([
            _origRefreshAll(),
            fetchWorkflows(),
        ]);
    };

    // (Chat functions moved to chat.html)




    // (All chat functions removed — now in chat.html)

    // ── Profile Switcher ──
    (function initProfileSwitcher() {

        const saved = localStorage.getItem('rdgr-active-profile');
        if (saved) {
            try {
                const p = JSON.parse(saved);
                activeProfileId = p.id;
                const nameEl = document.getElementById('profileName');
                const avatarEl = document.getElementById('profileAvatar');
                if (nameEl) nameEl.textContent = p.name;
                if (avatarEl) avatarEl.textContent = (p.name || 'B')[0].toUpperCase();
            } catch(e) {}
        }
        getCachedProfiles(function(profiles) {
            const dd = document.getElementById('profileDropdown');
                        if (!dd || !profiles || profiles.length === 0) return;
                        const activeId = saved ? JSON.parse(saved).id : null;
                        dd.innerHTML = profiles.map(p => {
                            const name = p.display_name || p.email || '?';
                            const initial = name[0].toUpperCase();
                            const isActive = p.user_id === activeId;
                            return `<button onclick="selectProfileGlobal('${p.user_id}','${name.replace(/'/g, '&#39;')}')" class="w-full text-left px-3 py-2 text-xs flex items-center gap-2" style="color:#E8ECF1;background:transparent;" onmouseenter="this.style.background='rgba(255,255,255,0.04)'" onmouseleave="this.style.background='transparent'">
                                <div class="w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] font-bold" style="background:${isActive?'rgba(6,214,160,0.15)':'rgba(255,255,255,0.06)'};color:${isActive?'#06D6A0':'#8A95A9'};">${initial}</div>
                                <span>${name}</span>
                                ${isActive ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" class="ml-auto"><path d="M2 6l3 3 5-5" stroke="#06D6A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
                            </button>`;
                        }).join('');
                        dd.innerHTML += '<div style="border-top:1px solid #2A2E3D;margin-top:0.25rem;padding-top:0.25rem;"><button onclick="signOut()" class="w-full text-left px-3 py-2 text-xs flex items-center gap-2" style="color:#FF6B6B;background:transparent;" onmouseenter="this.style.background=\'rgba(255,107,107,0.06)\'" onmouseleave="this.style.background=\'transparent\'"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 10.5H2.5a1 1 0 01-1-1v-7a1 1 0 011-1h2M8 8.5l2.5-2.5L8 3.5M10.5 6h-6" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Sign Out</span></button></div>';
                    }
        });
    })();

    function toggleProfileDD() {
        const dd = document.getElementById('profileDropdown');
        dd.classList.toggle('hidden');
        if (!dd.classList.contains('hidden')) {
            setTimeout(() => document.addEventListener('click', function closePDD(e) {
                if (!document.getElementById('profileSwitcher').contains(e.target)) {
                    dd.classList.add('hidden');
                }
                document.removeEventListener('click', closePDD);
            }), 0);
        }
    }

    function selectProfileGlobal(userId, name) {
        localStorage.setItem('rdgr-active-profile', JSON.stringify({ id: userId, name: name }));
        location.reload();
    }

    function signOut() {
        localStorage.removeItem('rdgr-session');
        localStorage.removeItem('rdgr-active-profile');
        location.reload();
    }

    