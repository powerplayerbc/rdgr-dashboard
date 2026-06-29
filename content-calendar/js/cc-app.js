/* ============================================================
   Dianna Instagram Content Calendar — app logic
   Data: carltondb ig_posts / ig_post_assets / ig_post_metrics / ig_calendar_template
   ============================================================ */
const SUPABASE_URL = 'https://carltondb.72.60.67.2.sslip.io';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6ImNhcmx0b24iLCJpYXQiOjE3ODE2OTUzMDksImV4cCI6MjA5NzA1NTMwOX0.Tazw1TnCAXYY6Na6E7muccoLad3NrJltf9GUCPbNnSc';
const BRAND_ID = 'dianna';
// Large-file uploader (VPS, rclone -> Drive). Handles all asset types incl. large video.
const UPLOADER_URL = 'https://uploader.72.60.67.2.sslip.io';
const UPLOAD_TOKEN = 'c41b24ea400dc78e7691a261555c998b77f6cc214143fc8f'; // matches content-uploader service
// Interim small-file upload (images/music/scripts) via existing n8n Drive webhook.
const ASSET_WEBHOOK = 'https://n8n.carltonaiservices.com/webhook/dianna-asset-upload';

const SB_HEADERS = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };

const TYPES = {
    reel_journey: { label: 'Reel · Journey', short: 'Journey', color: '#A855F7' },
    reel_music:   { label: 'Reel · Music',   short: 'Music',   color: '#4CC9F0' },
    infographic:  { label: 'Infographic',    short: 'Info',    color: '#06D6A0' },
    story:        { label: 'Story',          short: 'Story',   color: '#F0A830' }
};
const STAGES = ['idea', 'scripted', 'filmed', 'edited', 'ready', 'posted', 'archived'];
const STAGE_COLOR = { idea:'#525E73', scripted:'#8A95A9', filmed:'#4CC9F0', edited:'#C084FC', ready:'#06D6A0', posted:'#06D6A0', archived:'#525E73' };

/* ---------- data helpers ---------- */
async function sbGet(path) { const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: SB_HEADERS }); return r.json(); }
async function sbPost(table, body, prefer) { const r = await fetch(SUPABASE_URL + '/rest/v1/' + table, { method: 'POST', headers: { ...SB_HEADERS, 'Prefer': prefer || 'return=representation' }, body: JSON.stringify(body) }); return r.json(); }
async function sbPatch(table, q, body) { const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + q, { method: 'PATCH', headers: { ...SB_HEADERS, 'Prefer': 'return=representation' }, body: JSON.stringify(body) }); return r.json(); }
async function sbDelete(table, q) { return fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + q, { method: 'DELETE', headers: SB_HEADERS }); }
async function rpc(fn, body) { const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: SB_HEADERS, body: JSON.stringify(body || {}) }); return r.json(); }

/* ---------- util ---------- */
function esc(s) { const d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; }
function fmtDate(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function parseDate(s) { const p = s.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
function weekStartOf(d) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0,0,0,0); return x; }
function num(v) { return (v==null||v==='') ? null : Number(v); }
function toast(msg, type) { const t = document.getElementById('toast'); t.innerHTML = '<div class="panel" style="padding:.6rem 1rem;border-color:'+(type==='error'?'var(--deft-danger)':'var(--deft-accent)')+'">'+esc(msg)+'</div>'; t.style.display='block'; clearTimeout(t._t); t._t=setTimeout(()=>t.style.display='none', 2600); }

/* ============================================================ AUTH GATE ============================================================ */
let gateSelectedProfile = null;
function loadGateProfiles() {
    fetch(SUPABASE_URL + '/rest/v1/deft_user_profiles?select=user_id,display_name,email,role&order=display_name', { headers: SB_HEADERS })
      .then(r => r.json()).then(profiles => {
        const c = document.getElementById('gateProfiles'); if (!c || !profiles || !profiles.length) return;
        let savedId = null; try { savedId = JSON.parse(localStorage.getItem('rdgr-active-profile')||'{}').id; } catch(e){}
        const colors = { 'Bradford':'#06D6A0','Dianna':'#A855F7','Brianna':'#4CC9F0' };
        c.innerHTML = profiles.map(p => { const n = p.display_name||p.email||'?'; const col = colors[n]||'#8A95A9';
            return '<button type="button" onclick="selectGateProfile(\''+p.user_id+'\',\''+n.replace(/'/g,'&#39;')+'\',this,\''+(p.role||'admin')+'\')" class="gate-profile-btn" style="display:flex;flex-direction:column;align-items:center;gap:.4rem;padding:.7rem;border-radius:10px;background:rgba(255,255,255,.02);border:2px solid transparent;cursor:pointer;min-width:78px;"><div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;background:'+col+'20;color:'+col+'">'+n[0].toUpperCase()+'</div><span style="font-size:.75rem;color:#8A95A9">'+esc(n)+'</span></button>'; }).join('');
        if (savedId) { c.querySelectorAll('.gate-profile-btn').forEach(b => { if (b.getAttribute('onclick').includes(savedId)) b.click(); }); }
      }).catch(()=>{});
}
function selectGateProfile(id, name, el, role) {
    gateSelectedProfile = { id, name, role: role||'admin' };
    document.querySelectorAll('.gate-profile-btn').forEach(b => { b.style.borderColor='transparent'; b.style.background='rgba(255,255,255,.02)'; });
    el.style.borderColor = 'rgba(168,85,247,.5)'; el.style.background = 'rgba(168,85,247,.08)';
    const btn = document.getElementById('gateSubmitBtn'); btn.disabled=false; btn.style.opacity='1'; btn.textContent='Sign in as '+name;
    document.getElementById('gateInput').focus();
}
function handleGate(e) {
    e.preventDefault();
    if (document.getElementById('gateInput').value === 'Advance1!') {
        localStorage.setItem('rdgr-session', JSON.stringify({ authenticated:true, ts:Date.now() }));
        if (gateSelectedProfile) localStorage.setItem('rdgr-active-profile', JSON.stringify(gateSelectedProfile));
        document.getElementById('gate').classList.add('hidden');
        document.documentElement.classList.add('rdgr-authed');
        document.getElementById('ccApp').style.opacity = '1';
        CC.init();
        return false;
    }
    const er = document.getElementById('gateError'); er.classList.add('show'); document.getElementById('gateInput').value='';
    setTimeout(()=>er.classList.remove('show'), 2000); return false;
}

/* ============================================================ APP ============================================================ */
const CC = {
    week: weekStartOf(new Date()),
    view: 'calendar',
    leadMagnets: [],
    cache: [],

    async init() {
        try { this.leadMagnets = await sbGet('lead_magnets?brand_id=eq.'+BRAND_ID+'&select=id,title,slug&order=title'); } catch(e) { this.leadMagnets = []; }
        if (!Array.isArray(this.leadMagnets)) this.leadMagnets = [];
        this.render();
    },
    setView(v) { this.view = v; document.querySelectorAll('#viewToggle button').forEach(b=>b.classList.toggle('active', b.dataset.view===v)); this.render(); },
    shiftWeek(n) { this.week.setDate(this.week.getDate() + n*7); this.week = weekStartOf(this.week); this.render(); },
    thisWeek() { this.week = weekStartOf(new Date()); this.render(); },

    range() { const from = fmtDate(this.week); const e = new Date(this.week); e.setDate(e.getDate()+6); return { from, to: fmtDate(e) }; },

    async render() {
        const { from, to } = this.range();
        document.getElementById('weekLabel').textContent = from + '  →  ' + to;
        ['calendarView','boardView','leaderboardView'].forEach(id => document.getElementById(id).classList.add('hidden'));
        if (this.view === 'leaderboard') { document.getElementById('leaderboardView').classList.remove('hidden'); return this.renderLeaderboard(); }
        const res = await rpc('ig_get_calendar', { p_brand_id: BRAND_ID, p_from: from, p_to: to });
        this.cache = (res && res.posts) || [];
        if (this.view === 'board') { document.getElementById('boardView').classList.remove('hidden'); return this.renderBoard(); }
        document.getElementById('calendarView').classList.remove('hidden'); this.renderCalendar();
    },

    renderCalendar() {
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const today = fmtDate(new Date());
        let html = '<div class="grid gap-2" style="grid-template-columns:repeat(7,minmax(0,1fr));">';
        for (let i=0;i<7;i++) {
            const d = new Date(this.week); d.setDate(d.getDate()+i); const ds = fmtDate(d);
            const posts = this.cache.filter(p => p.scheduled_date === ds);
            html += '<div class="daycol p-2">';
            html += '<div class="flex items-center justify-between mb-2"><div><div style="font-size:.7rem;color:var(--deft-txt-3)">'+days[i]+'</div><div style="font-weight:700;'+(ds===today?'color:var(--deft-accent)':'')+'">'+d.getDate()+'</div></div><button class="btn btn-sm" style="padding:.1rem .4rem" onclick="CC.newPost(\''+ds+'\')">+</button></div>';
            html += posts.map(p => this.cardHtml(p)).join('');
            html += '</div>';
        }
        html += '</div>';
        document.getElementById('calendarView').innerHTML = html;
    },

    cardHtml(p) {
        const t = TYPES[p.content_type] || { short:p.content_type, color:'#888' };
        const m = p.latest_metric || {};
        const thumb = p.primary_asset && p.primary_asset.thumbnail_url;
        const metric = (p.production_status==='posted' && (m.reach||m.plays)) ? '<div style="font-size:.65rem;color:var(--deft-txt-3);margin-top:.2rem">'+( (m.plays||m.reach)||0 )+' '+(m.plays?'plays':'reach')+(m.leads_captured?' · '+m.leads_captured+' leads':'')+'</div>' : '';
        return '<div class="pcard mb-2" style="border-left-color:'+t.color+'" onclick="CC.openEditor(\''+p.id+'\')">'
            + '<div class="flex items-center justify-between gap-1"><span class="pill" style="background:'+t.color+'22;color:'+t.color+'">'+t.short+'</span>'
            + '<span class="pill" style="background:'+STAGE_COLOR[p.production_status]+'22;color:'+STAGE_COLOR[p.production_status]+'">'+p.production_status+'</span></div>'
            + '<div style="font-size:.8rem;font-weight:600;margin-top:.3rem;line-height:1.2">'+esc(p.title||p.slot_label||'Untitled')+'</div>'
            + (p.scheduled_time?'<div style="font-size:.65rem;color:var(--deft-txt-3)">'+p.scheduled_time.slice(0,5)+'</div>':'')
            + (thumb?'<img src="'+esc(thumb)+'" style="width:100%;height:64px;object-fit:cover;border-radius:6px;margin-top:.35rem" loading="lazy">':'')
            + (p.lead_magnet_id?'<div style="font-size:.62rem;color:var(--deft-accent);margin-top:.2rem">🎁 lead magnet'+(p.manychat_keyword?' · "'+esc(p.manychat_keyword)+'"':'')+'</div>':'')
            + (p.is_boosted?'<span class="pill" style="background:var(--deft-warning)22;color:var(--deft-warning);margin-top:.2rem">📈 boosted</span>':'')
            + metric + '</div>';
    },

    renderBoard() {
        const cols = ['idea','scripted','filmed','edited','ready','posted'];
        const label = { idea:'Idea', scripted:'Scripted', filmed:'Filmed', edited:'Edited', ready:'Ready', posted:'Posted' };
        let html = '<div class="grid gap-2" style="grid-template-columns:repeat('+cols.length+',minmax(0,1fr));">';
        cols.forEach(st => {
            const posts = this.cache.filter(p => p.production_status === st);
            html += '<div class="daycol p-2"><div class="flex items-center justify-between mb-2"><span class="pill" style="background:'+STAGE_COLOR[st]+'22;color:'+STAGE_COLOR[st]+'">'+label[st]+'</span><span style="font-size:.7rem;color:var(--deft-txt-3)">'+posts.length+'</span></div>';
            html += posts.map(p => this.cardHtml(p)).join('');
            html += '</div>';
        });
        html += '</div>';
        document.getElementById('boardView').innerHTML = html;
    },

    async renderLeaderboard() {
        const { from, to } = this.range();
        const res = await rpc('ig_get_leaderboard', { p_brand_id: BRAND_ID, p_from: from, p_to: to });
        const rows = (res && res.leaderboard) || [];
        let html = '<div class="panel p-4"><div class="text-sm text-txt-2 mb-3">Posted content this week, ranked by reach/plays + saves/shares/leads. Spot the virals.</div>';
        if (!rows.length) { html += '<div class="text-txt-3 text-sm">No posted content with metrics in this range yet.</div></div>'; document.getElementById('leaderboardView').innerHTML = html; return; }
        html += '<table style="width:100%;font-size:.85rem;border-collapse:collapse"><thead><tr style="color:var(--deft-txt-3);text-align:left">'
            + ['#','Post','Type','Plays','Reach','Saves','Shares','Leads','Spend','Score'].map(h=>'<th style="padding:.4rem .5rem;border-bottom:1px solid var(--deft-border)">'+h+'</th>').join('') + '</tr></thead><tbody>';
        rows.forEach((r,i)=>{ const t = TYPES[r.content_type]||{short:r.content_type,color:'#888'};
            html += '<tr style="cursor:pointer" onclick="CC.openEditor(\''+r.id+'\')"><td style="padding:.4rem .5rem">'+(i+1)+'</td>'
              + '<td style="padding:.4rem .5rem">'+esc(r.title||'Untitled')+(r.is_boosted?' 📈':'')+'</td>'
              + '<td style="padding:.4rem .5rem"><span class="pill" style="background:'+t.color+'22;color:'+t.color+'">'+t.short+'</span></td>'
              + ['plays','reach','saves','shares','leads_captured','ad_spend','score'].map(k=>'<td style="padding:.4rem .5rem">'+(r[k]!=null?r[k]:'—')+'</td>').join('')
              + '</tr>';
        });
        html += '</tbody></table></div>';
        document.getElementById('leaderboardView').innerHTML = html;
    },

    /* ---------- editor ---------- */
    newPost(date) { this.openEditor(null, date); },
    async openEditor(id, date) {
        let post = { content_type:'reel_journey', production_status:'idea', scheduled_date: date || fmtDate(this.week), hashtags:[], brand_id:BRAND_ID }, assets=[], metrics=[];
        if (id) { const res = await rpc('ig_get_post', { p_id: id }); if (res && res.post) { post = res.post; assets = post.assets||[]; metrics = post.metrics||[]; } }
        this._editing = { post, assets, metrics };
        document.getElementById('drawerInner').innerHTML = this.editorHtml(post, assets, metrics);
        document.getElementById('drawerBg').classList.add('open');
        document.getElementById('drawer').classList.add('open');
    },
    closeEditor() { document.getElementById('drawerBg').classList.remove('open'); document.getElementById('drawer').classList.remove('open'); },

    editorHtml(p, assets, metrics) {
        const lm = '<option value="">— none —</option>' + this.leadMagnets.map(m=>'<option value="'+m.id+'"'+(p.lead_magnet_id===m.id?' selected':'')+'>'+esc(m.title)+'</option>').join('');
        const typeOpts = Object.keys(TYPES).map(k=>'<option value="'+k+'"'+(p.content_type===k?' selected':'')+'>'+TYPES[k].label+'</option>').join('');
        const stageBtns = STAGES.map(s=>'<button type="button" class="btn btn-sm" data-stage="'+s+'" onclick="CC.pickStage(\''+s+'\')" style="'+(p.production_status===s?'background:'+STAGE_COLOR[s]+';color:#0b0710;border-color:transparent':'')+'">'+s+'</button>').join(' ');
        const isReel = (p.content_type||'').startsWith('reel');
        return ''
        + '<div class="flex items-center justify-between mb-4"><h2 class="text-xl font-bold">'+(p.id?'Edit post':'New post')+'</h2><button class="btn btn-sm" onclick="CC.closeEditor()">✕</button></div>'
        + '<input type="hidden" id="f_id" value="'+(p.id||'')+'">'
        + '<div class="grid grid-cols-2 gap-3 mb-3">'
        +   '<div><label class="fld">Date</label><input id="f_date" type="date" class="input" value="'+(p.scheduled_date||'')+'"></div>'
        +   '<div><label class="fld">Time</label><input id="f_time" type="time" class="input" value="'+(p.scheduled_time?p.scheduled_time.slice(0,5):'')+'"></div>'
        +   '<div><label class="fld">Type</label><select id="f_type" class="input" onchange="CC.refreshEditor()">'+typeOpts+'</select></div>'
        +   '<div><label class="fld">Slot label</label><input id="f_slot" class="input" value="'+esc(p.slot_label||'')+'"></div>'
        + '</div>'
        + '<div class="mb-3"><label class="fld">Title</label><input id="f_title" class="input" value="'+esc(p.title||'')+'"></div>'
        + '<div class="mb-3"><label class="fld">Hook</label><input id="f_hook" class="input" value="'+esc(p.hook||'')+'" placeholder="Opening line / scroll-stopper"></div>'
        + (isReel ? '<div class="mb-3"><label class="fld">Script</label><textarea id="f_script" class="input" rows="5" placeholder="Full reel script — Dianna films from this">'+esc(p.script||'')+'</textarea></div>' : '<input type="hidden" id="f_script" value="'+esc(p.script||'')+'">')
        + '<div class="mb-3"><label class="fld">Caption</label><textarea id="f_caption" class="input" rows="3">'+esc(p.caption||'')+'</textarea></div>'
        + '<div class="grid grid-cols-2 gap-3 mb-3">'
        +   '<div><label class="fld">CTA text</label><input id="f_cta" class="input" value="'+esc(p.cta_text||'')+'" placeholder="Comment WORD below..."></div>'
        +   '<div><label class="fld">ManyChat keyword</label><input id="f_keyword" class="input" value="'+esc(p.manychat_keyword||'')+'"></div>'
        +   '<div><label class="fld">Lead magnet</label><select id="f_lm" class="input">'+lm+'</select></div>'
        +   '<div><label class="fld">Hashtags (comma)</label><input id="f_tags" class="input" value="'+esc((p.hashtags||[]).join(', '))+'"></div>'
        + '</div>'
        + '<div class="mb-3"><label class="fld">Production stage</label><div class="flex flex-wrap gap-1" id="stageRow">'+stageBtns+'</div><input type="hidden" id="f_stage" value="'+(p.production_status||'idea')+'"></div>'
        + '<div class="mb-3 flex items-center gap-2"><input type="checkbox" id="f_boost" '+(p.is_boosted?'checked':'')+'><label for="f_boost" style="font-size:.85rem">Running paid ads / boosted</label></div>'
        + '<div class="mb-4"><label class="fld">Notes</label><textarea id="f_notes" class="input" rows="2">'+esc(p.notes||'')+'</textarea></div>'
        + '<div class="flex gap-2 mb-5"><button class="btn btn-primary" onclick="CC.savePost()">Save</button>'
        +   (p.id?'<button class="btn" onclick="CC.markPosted()">Mark posted</button><button class="btn" style="margin-left:auto;color:var(--deft-danger)" onclick="CC.deletePost()">Delete</button>':'')+'</div>'
        + (p.id ? this.assetsHtml(assets) + this.videoProcHtml(p, assets) + this.metricsHtml(p, metrics) : '<div class="text-txt-3 text-sm">Save the post first to attach assets &amp; metrics.</div>');
    },
    refreshEditor() { // re-render to toggle script field on type change, preserving inputs
        const p = this._collect(); Object.assign(this._editing.post, p);
        document.getElementById('drawerInner').innerHTML = this.editorHtml(this._editing.post, this._editing.assets, this._editing.metrics);
    },
    pickStage(s) { document.getElementById('f_stage').value = s; document.querySelectorAll('#stageRow [data-stage]').forEach(b=>{ const on=b.dataset.stage===s; b.style.background=on?STAGE_COLOR[s]:''; b.style.color=on?'#0b0710':''; b.style.borderColor=on?'transparent':''; }); },

    _collect() {
        const tags = (document.getElementById('f_tags').value||'').split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean);
        return {
            scheduled_date: document.getElementById('f_date').value || null,
            scheduled_time: document.getElementById('f_time').value || null,
            content_type: document.getElementById('f_type').value,
            slot_label: document.getElementById('f_slot').value || null,
            title: document.getElementById('f_title').value || null,
            hook: document.getElementById('f_hook').value || null,
            script: document.getElementById('f_script').value || null,
            caption: document.getElementById('f_caption').value || null,
            cta_text: document.getElementById('f_cta').value || null,
            manychat_keyword: document.getElementById('f_keyword').value || null,
            lead_magnet_id: document.getElementById('f_lm').value || null,
            hashtags: tags,
            production_status: document.getElementById('f_stage').value,
            is_boosted: document.getElementById('f_boost').checked,
            notes: document.getElementById('f_notes').value || null,
            brand_id: BRAND_ID
        };
    },
    async savePost() {
        const id = document.getElementById('f_id').value;
        const body = this._collect();
        let res;
        if (id) res = await sbPatch('ig_posts', 'id=eq.'+id, body);
        else { body.created_by = (JSON.parse(localStorage.getItem('rdgr-active-profile')||'{}').name)||'qa'; res = await sbPost('ig_posts', body); }
        if (Array.isArray(res) && res[0]) { toast('Saved'); if (!id) { this.openEditor(res[0].id); } else { this._editing.post = res[0]; } this.render(); }
        else toast('Save failed: '+JSON.stringify(res).slice(0,120), 'error');
    },
    async markPosted() {
        const id = document.getElementById('f_id').value; if (!id) return;
        const permalink = prompt('Instagram permalink (optional):', this._editing.post.ig_permalink||'') || null;
        await sbPatch('ig_posts', 'id=eq.'+id, { production_status:'posted', ig_permalink:permalink, posted_at:new Date().toISOString() });
        toast('Marked posted'); this.openEditor(id); this.render();
    },
    async deletePost() {
        const id = document.getElementById('f_id').value; if (!id) return;
        if (!confirm('Delete this post and its assets/metrics?')) return;
        await sbDelete('ig_posts', 'id=eq.'+id); this.closeEditor(); this.render(); toast('Deleted');
    },

    /* ---------- assets ---------- */
    assetsHtml(assets) {
        let h = '<div class="panel p-4 mb-4"><div class="flex items-center justify-between mb-3"><h3 class="font-bold">Assets</h3></div>';
        h += '<div id="assetList">' + (assets.length ? assets.map(a=>this.assetRow(a)).join('') : '<div class="text-txt-3 text-sm">No assets yet.</div>') + '</div>';
        h += '<div class="grid grid-cols-2 gap-2 mt-3">'
          +  '<div><label class="fld">Upload file (video / image / music / script)</label><input type="file" id="f_file" class="input" accept="video/*,image/*,audio/*,.pdf,.txt,.docx"></div>'
          +  '<div><label class="fld">Kind</label><select id="f_assetkind" class="input"><option value="image">image</option><option value="music">music</option><option value="thumbnail">thumbnail</option><option value="script_doc">script_doc</option><option value="raw_video">raw_video (link)</option><option value="edited_video">edited_video (link)</option></select></div>';
        h += '</div><div class="flex gap-2 mt-2"><button class="btn btn-sm" onclick="CC.uploadFile()">Upload file</button><button class="btn btn-sm" onclick="CC.addDriveLink()">Add by Drive link</button></div>';
        h += '<div class="text-txt-3" style="font-size:.7rem;margin-top:.4rem">Uploads stream straight to Dianna\'s Drive (Content folder) from any device. Each asset has View + ⬇ Download buttons. "Add by Drive link" also works for files already in Drive.</div>';
        h += '</div>';
        return h;
    },
    assetRow(a) {
        const icon = { image:'🖼️', thumbnail:'🖼️', music:'🎵', raw_video:'🎬', edited_video:'🎬', script_doc:'📄' }[a.asset_kind]||'📎';
        return '<div class="flex items-center gap-2 mb-2" style="font-size:.82rem">'
          + (a.thumbnail_url?'<img src="'+esc(a.thumbnail_url)+'" style="width:42px;height:42px;object-fit:cover;border-radius:6px">':'<span style="width:42px;text-align:center">'+icon+'</span>')
          + '<div style="flex:1;min-width:0"><div style="font-weight:600">'+esc(a.asset_kind)+'</div><div style="color:var(--deft-txt-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(a.file_name||a.drive_file_id||'')+'</div></div>'
          + (a.view_url?'<a class="btn btn-sm" href="'+esc(a.view_url)+'" target="_blank">View</a>':'')
          + (a.download_url?'<a class="btn btn-sm" href="'+esc(a.download_url)+'" target="_blank">⬇</a>':'')
          + '<button class="btn btn-sm" style="color:var(--deft-danger)" onclick="CC.deleteAsset(\''+a.id+'\')">✕</button></div>';
    },
    async uploadFile() {
        const id = document.getElementById('f_id').value; if (!id) return toast('Save the post first','error');
        const f = document.getElementById('f_file').files[0]; if (!f) return toast('Pick a file','error');
        const kind = document.getElementById('f_assetkind').value;
        // Primary path: stream everything (incl. large video) through the VPS uploader.
        if (UPLOADER_URL) return this._uploadViaVPS(id, f, kind);
        // Fallback (uploader offline): small files via webhook, video via Drive-link.
        if (kind==='raw_video'||kind==='edited_video') return toast('Videos: use "Add by Drive link"','error');
        toast('Uploading…');
        const b64 = await new Promise(r=>{ const fr=new FileReader(); fr.onload=()=>r(String(fr.result).split(',')[1]); fr.readAsDataURL(f); });
        let resp;
        try { resp = await (await fetch(ASSET_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ kind: kind==='music'?'music':(kind==='image'||kind==='thumbnail'?'image':'misc'), slug:'content-assets', file_name:f.name, mime_type:f.type||'application/octet-stream', file_base64:b64 }) })).json(); }
        catch(e) { return toast('Upload failed','error'); }
        if (!resp || !resp.drive_file_id) return toast('Upload failed: '+JSON.stringify(resp).slice(0,100),'error');
        await sbPost('ig_post_assets', { post_id:id, brand_id:BRAND_ID, asset_kind:kind, drive_file_id:resp.drive_file_id, file_name:f.name, mime_type:f.type, view_url:resp.view_url, download_url:resp.download_url, thumbnail_url:resp.thumbnail_url, uploaded_by:(JSON.parse(localStorage.getItem('rdgr-active-profile')||'{}').name)||'qa' }, 'return=minimal');
        toast('Uploaded'); this.openEditor(id);
    },
    async _uploadViaVPS(id, f, kind) {
        toast('Uploading video…');
        const fd = new FormData(); fd.append('file', f); fd.append('post_id', id); fd.append('asset_kind', kind); fd.append('content_type', this._editing.post.content_type||'');
        let resp; try { resp = await (await fetch(UPLOADER_URL.replace(/\/$/,'')+'/upload', { method:'POST', headers: UPLOAD_TOKEN?{'x-upload-token':UPLOAD_TOKEN}:{}, body: fd })).json(); } catch(e){ return toast('Upload failed','error'); }
        if (!resp || !resp.drive_file_id) return toast('Upload failed','error');
        toast('Uploaded'); this.openEditor(id);
    },
    async addDriveLink() {
        const id = document.getElementById('f_id').value; if (!id) return toast('Save the post first','error');
        const kind = document.getElementById('f_assetkind').value;
        const url = prompt('Paste the Google Drive share link:'); if (!url) return;
        const m = url.match(/[-\w]{25,}/); const fileId = m ? m[0] : null;
        const view = fileId ? 'https://drive.google.com/file/d/'+fileId+'/view' : url;
        const dl = fileId ? 'https://drive.google.com/uc?export=download&id='+fileId : null;
        const thumb = fileId ? 'https://drive.google.com/thumbnail?id='+fileId+'&sz=w400' : null;
        await sbPost('ig_post_assets', { post_id:id, brand_id:BRAND_ID, asset_kind:kind, drive_file_id:fileId, file_name:'(drive link)', view_url:view, download_url:dl, thumbnail_url:thumb, uploaded_by:(JSON.parse(localStorage.getItem('rdgr-active-profile')||'{}').name)||'qa' }, 'return=minimal');
        toast('Linked'); this.openEditor(id);
    },
    async deleteAsset(aid) { await sbDelete('ig_post_assets','id=eq.'+aid); this.openEditor(document.getElementById('f_id').value); },

    /* ---------- video processing (Submagic edit + auto-clip to inventory) ---------- */
    rawAsset(assets) { return assets.find(a=>a.asset_kind==='raw_video' && a.drive_file_id) || assets.find(a=>a.asset_kind==='raw_video'); },
    videoProcHtml(p, assets) {
        const raw = this.rawAsset(assets);
        let h = '<div class="panel p-4 mb-4"><h3 class="font-bold mb-1">Video processing</h3><div class="text-txt-3" style="font-size:.72rem;margin-bottom:.6rem">Works on the <b>raw</b> take (asset kind = raw_video). The edited reel comes back from Submagic; usable clips (outtakes removed) go to the Video Inventory.</div>';
        if (!raw || !raw.drive_file_id) { h += '<div class="text-txt-3 text-sm">Upload/link a <b>raw_video</b> asset (with a Drive link) to enable this.</div></div>'; return h; }
        // Submagic edit
        h += '<div class="flex items-center gap-2 mb-2"><span style="flex:1"><b>Submagic edit</b> &rarr; finished reel</span>';
        if (p.submagic_status==='ready') h += '<span class="pill" style="background:var(--deft-success)22;color:var(--deft-success)">✓ edited reel attached</span>';
        else if (p.submagic_status==='submitted') h += '<span class="pill" style="background:var(--deft-warning)22;color:var(--deft-warning)">editing…</span><button class="btn btn-sm" onclick="CC.checkSubmagic()">Check</button>';
        else h += '<button class="btn btn-sm" onclick="CC.sendToSubmagic()">Send to Submagic</button>';
        h += '</div>';
        // Auto-clip
        h += '<div class="flex items-center gap-2"><span style="flex:1"><b>Auto-clip</b> &rarr; Video Inventory (no outtakes)</span>';
        if (p.clip_status==='clipped' || p.clip_status==='ready') h += '<span class="pill" style="background:var(--deft-success)22;color:var(--deft-success)">✓ clips ready</span> <a class="btn btn-sm" href="/video-inventory" target="_blank">View</a>';
        else if (p.clip_status==='submitted') h += '<span class="pill" style="background:var(--deft-warning)22;color:var(--deft-warning)">clipping…</span><button class="btn btn-sm" onclick="CC.checkClips()">Check</button>';
        else h += '<button class="btn btn-sm" onclick="CC.sendToClips()">Send to clip library</button>';
        h += '</div></div>';
        return h;
    },
    _driveUrlFor(a) { return a.view_url || (a.drive_file_id ? 'https://drive.google.com/file/d/'+a.drive_file_id+'/view' : null); },
    async sendToSubmagic() {
        const id = document.getElementById('f_id').value; const raw = this.rawAsset(this._editing.assets);
        if (!raw) return toast('No raw_video asset','error');
        const p = this._editing.post;
        toast('Sending to Submagic…');
        let resp; try { resp = await (await fetch('https://n8n.carltonaiservices.com/webhook/rdgr-video-submagic', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ drive_url: this._driveUrlFor(raw), title: p.title||p.slot_label||'Dianna reel', script: p.script||'', brand_id: BRAND_ID, submitted_by: (JSON.parse(localStorage.getItem('rdgr-active-profile')||'{}').name)||'calendar' }) })).json(); } catch(e){ return toast('Submagic request failed','error'); }
        if (!resp || !resp.success) return toast('Submagic: '+JSON.stringify(resp).slice(0,120),'error');
        await sbPatch('ig_posts','id=eq.'+id, { submagic_source_id: resp.source_id, submagic_project_id: resp.project_id, submagic_status:'submitted' });
        toast('Sent to Submagic'); this.openEditor(id); this.render();
    },
    async checkSubmagic() {
        const id = document.getElementById('f_id').value; const sid = this._editing.post.submagic_source_id; if (!sid) return;
        const clips = await sbGet('video_clips?source_id=eq.'+sid+'&clip_type=eq.finished&select=*&limit=1');
        if (Array.isArray(clips) && clips[0]) {
            const c = clips[0];
            await sbPost('ig_post_assets', { post_id:id, brand_id:BRAND_ID, asset_kind:'edited_video', drive_file_id:c.drive_file_id, file_name:c.title||'Submagic edit', view_url:c.drive_url, download_url:(c.drive_file_id?'https://drive.google.com/uc?export=download&id='+c.drive_file_id:null), thumbnail_url:c.thumbnail_url, uploaded_by:'submagic' }, 'return=minimal');
            await sbPatch('ig_posts','id=eq.'+id, { submagic_status:'ready', production_status:'edited' });
            toast('Edited reel attached'); this.openEditor(id); this.render();
        } else toast('Still editing — check back soon');
    },
    async sendToClips() {
        const id = document.getElementById('f_id').value; const raw = this.rawAsset(this._editing.assets);
        if (!raw) return toast('No raw_video asset','error');
        const p = this._editing.post;
        toast('Sending to clip library…');
        let resp; try { resp = await (await fetch('https://n8n.carltonaiservices.com/webhook/rdgr-video-submit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ drive_url: this._driveUrlFor(raw), title: p.title||p.slot_label||'Dianna raw', kind:'longform', brand_id: BRAND_ID, submitted_by:(JSON.parse(localStorage.getItem('rdgr-active-profile')||'{}').name)||'calendar' }) })).json(); } catch(e){ return toast('Clip request failed','error'); }
        if (!resp || !resp.success) return toast('Clips: '+JSON.stringify(resp).slice(0,120),'error');
        const src = resp.source || {}; const srcId = src.id || (Array.isArray(src)?src[0]&&src[0].id:null);
        await sbPatch('ig_posts','id=eq.'+id, { clip_source_id: srcId, clip_status:'submitted' });
        toast('Sent for clipping (outtakes auto-removed)'); this.openEditor(id); this.render();
    },
    async checkClips() {
        const id = document.getElementById('f_id').value; const sid = this._editing.post.clip_source_id; if (!sid) return;
        const clips = await sbGet('video_clips?source_id=eq.'+sid+'&select=id,status&limit=50');
        if (Array.isArray(clips) && clips.length) { await sbPatch('ig_posts','id=eq.'+id, { clip_status:'clipped' }); toast(clips.length+' clip(s) in inventory'); this.openEditor(id); this.render(); }
        else toast('No clips yet — still processing');
    },

    /* ---------- metrics ---------- */
    metricsHtml(p, metrics) {
        const latest = metrics[metrics.length-1] || {};
        const fields = ['reach','plays','likes','comments','saves','shares','follows','profile_visits','link_clicks','ad_spend','manychat_triggers','manychat_dms_sent','manychat_link_clicks','leads_captured'];
        let h = '<div class="panel p-4 mb-6"><div class="flex items-center justify-between mb-3"><h3 class="font-bold">Metrics</h3><span class="text-txt-3" style="font-size:.7rem">'+metrics.length+' snapshot(s)</span></div>';
        // trend sparkline (reach or plays)
        if (metrics.length>1) {
            const key = (p.content_type||'').startsWith('reel') ? 'plays' : 'reach';
            const vals = metrics.map(m=>Number(m[key]||0)); const mx = Math.max(1,...vals);
            h += '<div class="text-txt-3" style="font-size:.7rem">'+key+' over time</div><div class="spark mb-3">'+vals.map(v=>'<span style="height:'+Math.max(3,(v/mx*34))+'px"></span>').join('')+'</div>';
        }
        h += '<div class="grid grid-cols-3 gap-2">' + fields.map(k=>'<div><label class="fld">'+k.replace(/_/g,' ')+'</label><input id="m_'+k+'" type="number" step="any" class="input" value="'+(latest[k]!=null?latest[k]:'')+'"></div>').join('') + '</div>';
        h += '<div class="flex items-center gap-2 mt-3"><label class="fld" style="margin:0">Source</label><select id="m_source" class="input" style="width:auto"><option value="manual">manual</option><option value="manychat">manychat</option></select>';
        h += '<button class="btn btn-primary btn-sm" onclick="CC.addSnapshot()">Add snapshot</button></div>';
        h += '</div>';
        return h;
    },
    async addSnapshot() {
        const id = document.getElementById('f_id').value; if (!id) return;
        const fields = ['reach','plays','likes','comments','saves','shares','follows','profile_visits','link_clicks','ad_spend','manychat_triggers','manychat_dms_sent','manychat_link_clicks','leads_captured'];
        const body = { post_id:id, brand_id:BRAND_ID, source: document.getElementById('m_source').value, captured_at:new Date().toISOString(), created_by:(JSON.parse(localStorage.getItem('rdgr-active-profile')||'{}').name)||'qa' };
        let any=false; fields.forEach(k=>{ const v=num(document.getElementById('m_'+k).value); if (v!=null){ body[k]=v; any=true; } });
        if (!any) return toast('Enter at least one metric','error');
        await sbPost('ig_post_metrics', body, 'return=minimal');
        toast('Snapshot saved'); this.openEditor(id); this.render();
    },

    /* ---------- template ---------- */
    async openTemplate() {
        const rows = await sbGet('ig_calendar_template?brand_id=eq.'+BRAND_ID+'&order=day_of_week,slot_order');
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        let h = '<div class="flex items-center justify-between mb-4"><h2 class="text-xl font-bold">Weekly template</h2><button class="btn btn-sm" onclick="CC.closeModal()">✕</button></div>';
        h += '<div class="text-txt-2 text-sm mb-3">Define your repeating cadence (e.g. 2 reels, 1 infographic, 3 stories/day). "Generate week" creates posts from this.</div>';
        h += '<div id="tplList">' + (Array.isArray(rows)&&rows.length ? rows.map(r=>'<div class="flex items-center gap-2 mb-1" style="font-size:.82rem"><span class="pill" style="background:var(--deft-surface-hi)">'+days[r.day_of_week]+'</span><span>'+esc(TYPES[r.default_content_type]?TYPES[r.default_content_type].label:r.default_content_type)+'</span><span class="text-txt-3">'+(r.default_time?r.default_time.slice(0,5):'')+'</span><span class="text-txt-3">'+esc(r.label||'')+'</span><button class="btn btn-sm" style="margin-left:auto;color:var(--deft-danger)" onclick="CC.delTpl(\''+r.id+'\')">✕</button></div>').join('') : '<div class="text-txt-3 text-sm">No template rows yet.</div>') + '</div>';
        h += '<div class="panel p-3 mt-3"><div class="grid grid-cols-2 gap-2">'
          + '<div><label class="fld">Day</label><select id="t_dow" class="input">'+days.map((d,i)=>'<option value="'+i+'">'+d+'</option>').join('')+'</select></div>'
          + '<div><label class="fld">Type</label><select id="t_type" class="input">'+Object.keys(TYPES).map(k=>'<option value="'+k+'">'+TYPES[k].label+'</option>').join('')+'</select></div>'
          + '<div><label class="fld">Time</label><input id="t_time" type="time" class="input"></div>'
          + '<div><label class="fld">Label</label><input id="t_label" class="input" placeholder="e.g. Morning reel"></div>'
          + '</div><button class="btn btn-primary btn-sm mt-2" onclick="CC.addTpl()">Add slot</button></div>';
        this._modal(h);
    },
    async addTpl() {
        const order = Date.now()%100000;
        const body = { brand_id:BRAND_ID, day_of_week:Number(document.getElementById('t_dow').value), slot_order:order, default_content_type:document.getElementById('t_type').value, default_time:document.getElementById('t_time').value||null, label:document.getElementById('t_label').value||null };
        const res = await sbPost('ig_calendar_template', body, 'return=minimal');
        toast('Slot added'); this.openTemplate();
    },
    async delTpl(id) { await sbDelete('ig_calendar_template','id=eq.'+id); this.openTemplate(); },
    async generateWeek() {
        const res = await rpc('ig_generate_slots_from_template', { p_brand_id:BRAND_ID, p_week_start: fmtDate(this.week) });
        if (res && res.success) { toast('Created '+res.created+' slots ('+res.skipped+' existed)'); this.render(); }
        else toast('Generate failed','error');
    },

    /* ---------- Meta CSV import ---------- */
    openMetaImport() {
        let h = '<div class="flex items-center justify-between mb-4"><h2 class="text-xl font-bold">Import Meta CSV</h2><button class="btn btn-sm" onclick="CC.closeModal()">✕</button></div>';
        h += '<div class="text-txt-2 text-sm mb-3">Meta Business Suite → Insights → Content → Export Data (CSV). Rows are matched to posts by Instagram permalink. Add the permalink to a post (Mark posted) so it can match.</div>';
        h += '<input type="file" id="csvFile" class="input mb-2" accept=".csv">';
        h += '<button class="btn btn-primary btn-sm" onclick="CC.runMetaImport()">Parse &amp; import</button><div id="csvResult" class="mt-3 text-sm"></div>';
        this._modal(h);
    },
    async runMetaImport() {
        const f = document.getElementById('csvFile').files[0]; if (!f) return toast('Pick a CSV','error');
        const text = await f.text();
        const rows = this._parseCsv(text); if (!rows.length) return toast('Empty CSV','error');
        const head = rows[0].map(h=>h.toLowerCase());
        const findCol = (...keys)=>{ for (let i=0;i<head.length;i++){ if (keys.some(k=>head[i].includes(k))) return i; } return -1; };
        const cPerma = findCol('permalink','post id','link');
        const map = { reach:findCol('reach'), impressions:findCol('impression'), plays:findCol('plays','video views','views'), likes:findCol('like'), comments:findCol('comment'), saves:findCol('save'), shares:findCol('share'), follows:findCol('follow'), profile_visits:findCol('profile visit'), link_clicks:findCol('link click') };
        const posts = await sbGet('ig_posts?brand_id=eq.'+BRAND_ID+'&ig_permalink=not.is.null&select=id,ig_permalink,ig_media_id');
        let matched=0, snaps=[];
        for (let i=1;i<rows.length;i++){ const row=rows[i]; if (!row.length) continue; const key=(cPerma>=0?row[cPerma]:'')||'';
            const post = posts.find(p=> p.ig_permalink && key && (p.ig_permalink.includes(key)||key.includes(p.ig_permalink)|| (p.ig_media_id&&key.includes(p.ig_media_id)) ));
            if (!post) continue; matched++;
            const snap = { post_id:post.id, brand_id:BRAND_ID, source:'meta_csv', captured_at:new Date().toISOString() };
            Object.keys(map).forEach(k=>{ if (map[k]>=0){ const v=num((row[map[k]]||'').replace(/[, ]/g,'')); if (v!=null) snap[k]=v; } });
            snaps.push(snap);
        }
        if (snaps.length) await sbPost('ig_post_metrics', snaps, 'return=minimal');
        document.getElementById('csvResult').innerHTML = '<span style="color:var(--deft-accent)">Imported '+snaps.length+' snapshot(s)</span> from '+(rows.length-1)+' rows; '+matched+' matched a post by permalink.';
        this.render();
    },
    _parseCsv(text) {
        const out=[]; let row=[], cur='', q=false;
        for (let i=0;i<text.length;i++){ const c=text[i];
            if (q){ if (c==='"'){ if (text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
            else { if (c==='"') q=true; else if (c===','){ row.push(cur); cur=''; } else if (c==='\n'){ row.push(cur); out.push(row); row=[]; cur=''; } else if (c==='\r'){} else cur+=c; }
        }
        if (cur.length||row.length){ row.push(cur); out.push(row); }
        return out.filter(r=>r.some(c=>c!==''));
    },

    /* ---------- modal ---------- */
    _modal(html) { document.getElementById('modalInner').innerHTML = html; document.getElementById('modal').style.display='flex'; document.getElementById('modalBg').classList.add('open'); },
    closeModal() { document.getElementById('modal').style.display='none'; document.getElementById('modalBg').classList.remove('open'); }
};

/* ---------- boot ---------- */
if (JSON.parse(localStorage.getItem('rdgr-session')||'{}').authenticated === true) {
    document.getElementById('gate').classList.add('hidden');
    document.getElementById('ccApp').style.opacity = '1';
    CC.init();
} else {
    loadGateProfiles();
}
