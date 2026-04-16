// ═══════════════════════════════════════
// School Tools — Interactive Draggable Student Tools
// ═══════════════════════════════════════

let toolboxOpen = false;
const activeTools = {};

// ═══════════════════════════════════════
// TOOLBOX MENU
// ═══════════════════════════════════════
function initToolbox() {
    if (document.getElementById('toolbox-toggle')) return;

    // Floating toggle button
    const toggle = document.createElement('button');
    toggle.id = 'toolbox-toggle';
    toggle.className = 'toolbox-toggle';
    toggle.title = 'Student Tools';
    toggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>';
    toggle.onclick = toggleToolbox;
    document.body.appendChild(toggle);

    // Menu
    const menu = document.createElement('div');
    menu.id = 'toolbox-menu';
    menu.className = 'toolbox-menu';
    menu.innerHTML = `
        <button class="toolbox-item" onclick="toggleTool('calculator')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="16" y1="10" x2="16.01" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="8" y1="18" x2="8.01" y2="18"/><line x1="12" y1="18" x2="16" y2="18"/></svg>
            Calculator
        </button>
        <button class="toolbox-item" onclick="toggleTool('scratchpad')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
            Scratch Pad
        </button>
        <button class="toolbox-item" onclick="toggleTool('beads')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="14" cy="6" r="3"/><circle cx="6" cy="14" r="3"/><circle cx="14" cy="14" r="3"/></svg>
            Counting Beads
        </button>
        <button class="toolbox-item" onclick="toggleTool('ruler')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.3 15.3a2.4 2.4 0 010 3.4l-2.6 2.6a2.4 2.4 0 01-3.4 0L2.7 8.7a2.4 2.4 0 010-3.4l2.6-2.6a2.4 2.4 0 013.4 0z"/><path d="M14.5 12.5l2-2"/><path d="M11.5 9.5l2-2"/><path d="M8.5 6.5l2-2"/><path d="M17.5 15.5l2-2"/></svg>
            Ruler
        </button>
        <button class="toolbox-item" onclick="toggleTool('protractor')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10H2c0 5.523 4.477 10 10 10z"/><line x1="12" y1="12" x2="12" y2="2"/></svg>
            Protractor
        </button>
    `;
    document.body.appendChild(menu);
}

function toggleToolbox() {
    toolboxOpen = !toolboxOpen;
    const menu = document.getElementById('toolbox-menu');
    if (menu) menu.classList.toggle('active', toolboxOpen);
}

function toggleTool(toolName) {
    if (activeTools[toolName]) {
        closeTool(toolName);
    } else {
        openTool(toolName);
    }
    toggleToolbox();
}

function closeTool(toolName) {
    const panel = activeTools[toolName];
    if (panel) { panel.remove(); delete activeTools[toolName]; }
}

// ═══════════════════════════════════════
// DRAGGABLE PANEL SYSTEM
// ═══════════════════════════════════════
function createToolPanel(toolName, title, width, height, bodyHtml) {
    const panel = document.createElement('div');
    panel.className = 'tool-panel active';
    panel.id = 'tool-' + toolName;
    panel.style.width = width + 'px';
    panel.style.left = (window.innerWidth / 2 - width / 2) + 'px';
    panel.style.top = '120px';

    panel.innerHTML = `
        <div class="tool-panel-header" onmousedown="startDrag(event, '${toolName}')">
            <span style="font-size:0.75rem;font-weight:600;color:var(--deft-txt-2);">${title}</span>
            <button onclick="closeTool('${toolName}')" style="background:none;border:none;color:var(--deft-txt-3);cursor:pointer;font-size:1rem;line-height:1;">&times;</button>
        </div>
        <div class="tool-panel-body">${bodyHtml}</div>
    `;

    document.body.appendChild(panel);
    activeTools[toolName] = panel;
    return panel;
}

let dragState = null;
function startDrag(e, toolName) {
    e.preventDefault();
    const panel = activeTools[toolName];
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragState = { panel, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
}
function onDrag(e) {
    if (!dragState) return;
    dragState.panel.style.left = (e.clientX - dragState.offsetX) + 'px';
    dragState.panel.style.top = (e.clientY - dragState.offsetY) + 'px';
}
function stopDrag() {
    dragState = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// ═══════════════════════════════════════
// CALCULATOR
// ═══════════════════════════════════════
function openTool_calculator() {
    const btnStyle = 'width:100%;padding:10px;border:none;border-radius:6px;font-size:1rem;cursor:pointer;font-family:var(--deft-body-font);';
    const numBtn = btnStyle + 'background:var(--deft-surface-hi);color:var(--deft-txt);';
    const opBtn = btnStyle + 'background:var(--deft-accent-dim);color:var(--deft-accent);font-weight:600;';
    const eqBtn = btnStyle + 'background:var(--deft-accent);color:#000;font-weight:700;';

    const html = `
        <div id="calc-display" style="width:100%;padding:12px;margin-bottom:8px;border-radius:8px;background:var(--deft-surface);border:1px solid var(--deft-border);font-family:'JetBrains Mono',monospace;font-size:1.5rem;text-align:right;color:var(--deft-txt);min-height:48px;overflow:hidden;">0</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
            <button style="${numBtn}" onclick="calcInput('7')">7</button>
            <button style="${numBtn}" onclick="calcInput('8')">8</button>
            <button style="${numBtn}" onclick="calcInput('9')">9</button>
            <button style="${opBtn}" onclick="calcInput('/')">&divide;</button>
            <button style="${numBtn}" onclick="calcInput('4')">4</button>
            <button style="${numBtn}" onclick="calcInput('5')">5</button>
            <button style="${numBtn}" onclick="calcInput('6')">6</button>
            <button style="${opBtn}" onclick="calcInput('*')">&times;</button>
            <button style="${numBtn}" onclick="calcInput('1')">1</button>
            <button style="${numBtn}" onclick="calcInput('2')">2</button>
            <button style="${numBtn}" onclick="calcInput('3')">3</button>
            <button style="${opBtn}" onclick="calcInput('-')">&minus;</button>
            <button style="${numBtn}" onclick="calcInput('0')">0</button>
            <button style="${numBtn}" onclick="calcInput('.')">.</button>
            <button style="${btnStyle}background:var(--deft-danger-dim,rgba(255,107,107,0.15));color:var(--deft-danger);" onclick="calcClear()">C</button>
            <button style="${opBtn}" onclick="calcInput('+')">+</button>
            <button style="${eqBtn};grid-column:span 4;" onclick="calcEquals()">=</button>
        </div>
    `;
    createToolPanel('calculator', 'Calculator', 220, 340, html);
}

let calcExpression = '';
let calcNewNumber = true;
function calcInput(val) {
    const display = document.getElementById('calc-display');
    if (!display) return;
    if ('+-*/'.includes(val)) {
        calcExpression += display.textContent + val;
        calcNewNumber = true;
    } else {
        if (calcNewNumber) { display.textContent = val; calcNewNumber = false; }
        else { display.textContent += val; }
    }
}
function calcClear() {
    calcExpression = '';
    calcNewNumber = true;
    const d = document.getElementById('calc-display');
    if (d) d.textContent = '0';
}
function calcEquals() {
    const d = document.getElementById('calc-display');
    if (!d) return;
    try {
        const expr = calcExpression + d.textContent;
        const result = Function('"use strict"; return (' + expr + ')')();
        d.textContent = Number.isFinite(result) ? parseFloat(result.toFixed(8)) : 'Error';
    } catch(e) { d.textContent = 'Error'; }
    calcExpression = '';
    calcNewNumber = true;
}

// ═══════════════════════════════════════
// SCRATCH PAD
// ═══════════════════════════════════════
function openTool_scratchpad() {
    const html = `
        <div style="display:flex;gap:4px;margin-bottom:8px;">
            <button id="sp-pen" class="btn btn-sm btn-primary" onclick="spSetMode('pen')" style="font-size:0.7rem;">Pencil</button>
            <button id="sp-eraser" class="btn btn-sm btn-ghost" onclick="spSetMode('eraser')" style="font-size:0.7rem;">Eraser</button>
            <button class="btn btn-sm btn-ghost" onclick="spClear()" style="font-size:0.7rem;margin-left:auto;">Clear</button>
        </div>
        <canvas id="sp-canvas" width="320" height="260" style="border-radius:8px;background:var(--deft-surface);border:1px solid var(--deft-border);cursor:crosshair;display:block;touch-action:none;"></canvas>
    `;
    createToolPanel('scratchpad', 'Scratch Pad', 352, 340, html);
    setTimeout(initScratchPad, 50);
}

let spMode = 'pen';
let spDrawing = false;
function initScratchPad() {
    const canvas = document.getElementById('sp-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--deft-txt').trim() || '#E8ECF1';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }

    function down(e) {
        e.preventDefault();
        spDrawing = true;
        const p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    }
    function move(e) {
        if (!spDrawing) return;
        e.preventDefault();
        const p = getPos(e);
        if (spMode === 'eraser') {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 20;
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ctx.restore();
        } else {
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
    }
    function up() { spDrawing = false; }

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', up);
    canvas.addEventListener('mouseleave', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up);
}

function spSetMode(mode) {
    spMode = mode;
    const pen = document.getElementById('sp-pen');
    const eraser = document.getElementById('sp-eraser');
    if (pen) { pen.className = mode === 'pen' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'; }
    if (eraser) { eraser.className = mode === 'eraser' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'; }
}

function spClear() {
    const canvas = document.getElementById('sp-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ═══════════════════════════════════════
// COUNTING BEADS
// ═══════════════════════════════════════
function openTool_beads() {
    let rows = '';
    const colors = ['#FF6B6B', '#FBBF24', '#06D6A0', '#60A5FA', '#C084FC', '#FB7185', '#2DD4BF', '#F59E0B', '#8B5CF6', '#38BDF8'];
    for (let r = 0; r < 10; r++) {
        let beads = '';
        for (let b = 0; b < 10; b++) {
            const x = 30 + b * 28;
            beads += `<circle class="bead" cx="${x}" cy="14" r="10" fill="${colors[r]}" stroke="${colors[r]}88" stroke-width="1" data-row="${r}" data-col="${b}" style="cursor:pointer;" onclick="beadToggle(this)"/>`;
        }
        rows += `<g transform="translate(0, ${r * 30})">
            <line x1="10" y1="14" x2="300" y2="14" stroke="var(--deft-border)" stroke-width="2"/>
            ${beads}
        </g>`;
    }
    const html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span id="bead-count" style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;color:var(--deft-accent);font-weight:700;">0</span>
            <button class="btn btn-sm btn-ghost" onclick="beadReset()" style="font-size:0.7rem;">Reset</button>
        </div>
        <svg id="bead-svg" viewBox="0 0 310 300" style="width:100%;border-radius:8px;background:var(--deft-surface);border:1px solid var(--deft-border);">
            ${rows}
        </svg>
    `;
    createToolPanel('beads', 'Counting Beads', 340, 400, html);
}

const beadState = {};
function beadToggle(el) {
    const r = el.getAttribute('data-row');
    const c = el.getAttribute('data-col');
    const key = r + '-' + c;
    if (beadState[key]) {
        el.setAttribute('cx', 30 + parseInt(c) * 28);
        el.style.opacity = '1';
        delete beadState[key];
    } else {
        el.setAttribute('cx', parseInt(el.getAttribute('cx')) - 15);
        el.style.opacity = '0.5';
        beadState[key] = true;
    }
    const count = Object.keys(beadState).length;
    const countEl = document.getElementById('bead-count');
    if (countEl) countEl.textContent = count;
}

function beadReset() {
    Object.keys(beadState).forEach(k => delete beadState[k]);
    document.querySelectorAll('#bead-svg .bead').forEach(b => {
        const c = b.getAttribute('data-col');
        b.setAttribute('cx', 30 + parseInt(c) * 28);
        b.style.opacity = '1';
    });
    const countEl = document.getElementById('bead-count');
    if (countEl) countEl.textContent = '0';
}

// ═══════════════════════════════════════
// RULER
// ═══════════════════════════════════════
function openTool_ruler() {
    let ticks = '';
    for (let i = 0; i <= 12; i++) {
        const x = 20 + i * 36;
        ticks += `<line x1="${x}" y1="10" x2="${x}" y2="35" stroke="var(--deft-txt-2)" stroke-width="1.5"/>`;
        ticks += `<text x="${x}" y="48" text-anchor="middle" fill="var(--deft-txt-2)" font-size="10" font-family="JetBrains Mono">${i}"</text>`;
        // Half-inch marks
        if (i < 12) {
            ticks += `<line x1="${x + 18}" y1="18" x2="${x + 18}" y2="35" stroke="var(--deft-txt-3)" stroke-width="0.75"/>`;
        }
        // Quarter-inch marks
        if (i < 12) {
            ticks += `<line x1="${x + 9}" y1="24" x2="${x + 9}" y2="35" stroke="var(--deft-txt-3)" stroke-width="0.5"/>`;
            ticks += `<line x1="${x + 27}" y1="24" x2="${x + 27}" y2="35" stroke="var(--deft-txt-3)" stroke-width="0.5"/>`;
        }
    }
    // CM scale on bottom
    let cmTicks = '';
    for (let i = 0; i <= 30; i++) {
        const x = 20 + i * 14.4;
        if (i % 10 === 0) {
            cmTicks += `<line x1="${x}" y1="55" x2="${x}" y2="80" stroke="var(--deft-accent)" stroke-width="1.5"/>`;
            cmTicks += `<text x="${x}" y="92" text-anchor="middle" fill="var(--deft-accent)" font-size="9" font-family="JetBrains Mono">${i}cm</text>`;
        } else if (i % 5 === 0) {
            cmTicks += `<line x1="${x}" y1="62" x2="${x}" y2="80" stroke="var(--deft-accent)" stroke-width="1"/>`;
        } else {
            cmTicks += `<line x1="${x}" y1="68" x2="${x}" y2="80" stroke="var(--deft-accent)" stroke-width="0.5"/>`;
        }
    }
    const html = `
        <svg viewBox="0 0 470 100" style="width:100%;border-radius:8px;background:var(--deft-surface);border:1px solid var(--deft-border);">
            <rect x="15" y="8" width="440" height="88" rx="4" fill="none" stroke="var(--deft-border)" stroke-width="0.5"/>
            ${ticks}
            ${cmTicks}
        </svg>
    `;
    createToolPanel('ruler', 'Ruler (12 inches / 30 cm)', 480, 160, html);
}

// ═══════════════════════════════════════
// PROTRACTOR
// ═══════════════════════════════════════
function openTool_protractor() {
    let marks = '';
    for (let deg = 0; deg <= 180; deg += 10) {
        const rad = deg * Math.PI / 180;
        const r1 = deg % 30 === 0 ? 115 : 125;
        const r2 = 135;
        const x1 = 150 + r1 * Math.cos(Math.PI - rad);
        const y1 = 150 + r1 * Math.sin(Math.PI - rad);
        const x2 = 150 + r2 * Math.cos(Math.PI - rad);
        const y2 = 150 + r2 * Math.sin(Math.PI - rad);
        marks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--deft-txt-3)" stroke-width="${deg % 30 === 0 ? 1.5 : 0.75}"/>`;
        if (deg % 30 === 0) {
            const tx = 150 + 105 * Math.cos(Math.PI - rad);
            const ty = 150 + 105 * Math.sin(Math.PI - rad);
            marks += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="var(--deft-txt-2)" font-size="11" font-family="JetBrains Mono">${deg}</text>`;
        }
    }
    // 5-degree marks
    for (let deg = 5; deg < 180; deg += 10) {
        const rad = deg * Math.PI / 180;
        const x1 = 150 + 128 * Math.cos(Math.PI - rad);
        const y1 = 150 + 128 * Math.sin(Math.PI - rad);
        const x2 = 150 + 135 * Math.cos(Math.PI - rad);
        const y2 = 150 + 135 * Math.sin(Math.PI - rad);
        marks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--deft-txt-3)" stroke-width="0.5"/>`;
    }
    const html = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:0.75rem;color:var(--deft-txt-3);">Angle:</span>
            <span id="protractor-angle" style="font-family:'JetBrains Mono',monospace;font-size:1rem;color:var(--deft-accent);font-weight:600;">0&deg;</span>
        </div>
        <svg id="protractor-svg" viewBox="0 0 300 170" style="width:100%;border-radius:8px;background:transparent;cursor:pointer;">
            <!-- Outer arc -->
            <path d="M 15,150 A 135,135 0 0,1 285,150" fill="none" stroke="var(--deft-border)" stroke-width="1"/>
            <!-- Inner arc -->
            <path d="M 30,150 A 120,120 0 0,1 270,150" fill="none" stroke="var(--deft-border)" stroke-width="0.5"/>
            <!-- Baseline -->
            <line x1="10" y1="150" x2="290" y2="150" stroke="var(--deft-txt-3)" stroke-width="1"/>
            <!-- Center dot -->
            <circle cx="150" cy="150" r="3" fill="var(--deft-accent)"/>
            ${marks}
            <!-- Angle arm -->
            <line id="protractor-arm" x1="150" y1="150" x2="285" y2="150" stroke="var(--deft-accent)" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `;
    const panel = createToolPanel('protractor', 'Protractor', 340, 250, html);
    // Make protractor panel transparent so it can overlay content
    panel.style.background = 'transparent';
    panel.style.border = 'none';
    panel.style.boxShadow = 'none';
    panel.querySelector('.tool-panel-header').style.background = 'rgba(17,19,26,0.8)';
    panel.querySelector('.tool-panel-header').style.borderRadius = '12px 12px 0 0';
    panel.querySelector('.tool-panel-body').style.background = 'transparent';
    setTimeout(() => {
        const svg = document.getElementById('protractor-svg');
        if (!svg) return;
        svg.addEventListener('mousemove', protractorMove);
        svg.addEventListener('click', protractorMove);
    }, 50);
}

function protractorMove(e) {
    const svg = document.getElementById('protractor-svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgW = 300, svgH = 170;
    const mx = (e.clientX - rect.left) / rect.width * svgW;
    const my = (e.clientY - rect.top) / rect.height * svgH;
    const dx = mx - 150, dy = -(my - 150);
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle = 0;
    if (angle > 180) angle = 180;
    // Snap to nearest 5 degrees
    angle = Math.round(angle / 5) * 5;
    const rad = angle * Math.PI / 180;
    const armX = 150 + 135 * Math.cos(rad);
    const armY = 150 - 135 * Math.sin(rad);
    const arm = document.getElementById('protractor-arm');
    if (arm) { arm.setAttribute('x2', armX.toFixed(1)); arm.setAttribute('y2', armY.toFixed(1)); }
    const label = document.getElementById('protractor-angle');
    if (label) label.innerHTML = angle + '&deg;';
}

// ═══════════════════════════════════════
// TOOL OPENER ROUTER
// ═══════════════════════════════════════
function openTool(name) {
    const openers = {
        calculator: openTool_calculator,
        scratchpad: openTool_scratchpad,
        beads: openTool_beads,
        ruler: openTool_ruler,
        protractor: openTool_protractor,
    };
    if (openers[name]) openers[name]();
}

// Initialize toolbox when Questions view is active
(function() {
    const origSwitch = window.switchView;
    if (origSwitch) {
        window.switchView = function(view) {
            origSwitch(view);
            if (view === 'questions') initToolbox();
            else {
                const toggle = document.getElementById('toolbox-toggle');
                const menu = document.getElementById('toolbox-menu');
                if (toggle) toggle.style.display = view === 'questions' ? '' : 'none';
                if (menu) menu.classList.remove('active');
            }
        };
    }
})();
