// ═══════════════════════════════════════
// DEFT Shared — State, Init, View Switching, UI Utilities
// ═══════════════════════════════════════

// Global state variables
let activeProfileId = null;
let activeProfileName = 'Bradford';
let currentView = 'today';
let dailyLog = null;
let todayMeals = [];
let todayExercises = [];

// ═══════════════════════════════════════
// PROFILE SWITCHER
// ═══════════════════════════════════════
async function loadProfiles() {
    let profiles = await supabaseSelect('deft_user_profiles', 'select=user_id,display_name,email&order=display_name');

    // Fallback to cached profiles if Supabase fails
    if (!profiles) {
        try {
            const cached = JSON.parse(localStorage.getItem('rdgr-profiles-cache') || '{}');
            if (cached.profiles && Array.isArray(cached.profiles)) {
                profiles = cached.profiles;
            }
        } catch(e) {}
    }

    const dropdown = document.getElementById('profileDropdown');
    dropdown.innerHTML = '';

    if (profiles && profiles.length > 0) {
        profiles.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2';
            btn.style.cssText = 'color: #E8ECF1; background: transparent;';
            btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.04)';
            btn.onmouseleave = () => btn.style.background = 'transparent';

            const initial = (p.display_name || p.email || '?')[0].toUpperCase();
            const isActive = p.user_id === activeProfileId;
            btn.innerHTML = `
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                     style="background: ${isActive ? 'rgba(6,214,160,0.15)' : 'rgba(255,255,255,0.06)'}; color: ${isActive ? '#06D6A0' : '#8A95A9'};">
                    ${initial}
                </div>
                <span>${p.display_name || p.email}</span>
                ${isActive ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="ml-auto"><path d="M2 6l3 3 5-5" stroke="#06D6A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
            `;
            btn.setAttribute('role', 'menuitem');
            btn.onclick = () => selectProfile(p.user_id, p.display_name || p.email);
            dropdown.appendChild(btn);
        });
    } else {
        const errDiv = document.createElement('div');
        errDiv.className = 'px-3 py-2 text-xs';
        errDiv.style.color = '#E85D5D';
        errDiv.textContent = 'Could not load profiles. Check your connection.';
        dropdown.appendChild(errDiv);
    }

    // Divider + "New Profile" button
    const divider = document.createElement('div');
    divider.style.cssText = 'border-top: 1px solid #2A2E3D; margin: 4px 0;';
    dropdown.appendChild(divider);

    const addBtn = document.createElement('button');
    addBtn.className = 'w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2';
    addBtn.style.cssText = 'color: #06D6A0; background: transparent;';
    addBtn.onmouseenter = () => addBtn.style.background = 'rgba(255,255,255,0.04)';
    addBtn.onmouseleave = () => addBtn.style.background = 'transparent';
    addBtn.innerHTML = '<div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style="background: rgba(6,214,160,0.15); color: #06D6A0;">+</div><span>New Profile</span>';
    addBtn.setAttribute('role', 'menuitem');
    addBtn.onclick = () => { dropdown.classList.add('hidden'); openModal('createProfileModal'); };
    dropdown.appendChild(addBtn);

    // Sign Out button
    const signOutDiv = document.createElement('div');
    signOutDiv.style.cssText = 'border-top: 1px solid #2A2E3D; margin-top: 0.25rem; padding-top: 0.25rem;';
    signOutDiv.innerHTML = '<button onclick="signOut()" class="w-full text-left px-3 py-2 text-xs flex items-center gap-2" style="color:#FF6B6B;background:transparent;" onmouseenter="this.style.background=\'rgba(255,107,107,0.06)\'" onmouseleave="this.style.background=\'transparent\'"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 10.5H2.5a1 1 0 01-1-1v-7a1 1 0 011-1h2M8 8.5l2.5-2.5L8 3.5M10.5 6h-6" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Sign Out</span></button>';
    dropdown.appendChild(signOutDiv);
}

function signOut() {
    localStorage.removeItem('rdgr-session');
    localStorage.removeItem('rdgr-active-profile');
    location.reload();
}

async function createNewProfile() {
    const name = document.getElementById('newProfileName').value.trim();
    const email = document.getElementById('newProfileEmail').value.trim();
    if (!name) { toast('Name is required', 'error'); return; }

    const userId = crypto.randomUUID();
    const btn = document.getElementById('createProfileBtn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    const result = await supabaseWrite('deft_user_profiles', 'POST', {
        user_id: userId,
        display_name: name,
        email: email || null,
        height_inches: 68,
        current_weight_lbs: 170,
        target_weight_lbs: 160,
        age: 30,
        sex: 'male',
        activity_level: 'moderately_active',
        diet_type: 'keto',
        meal_count_default: 3,
        macro_targets: { calories: 2000, fat_g: 155, protein_g: 130, net_carbs_g: 20 },
        preferences: { timezone: 'America/New_York', unit_system: 'imperial', allergens: [], avoid_ingredients: [] }
    });

    btn.disabled = false;
    btn.textContent = 'Create Profile';

    if (result) {
        toast('Profile "' + name + '" created!', 'success');
        closeModal('createProfileModal');
        document.getElementById('newProfileName').value = '';
        document.getElementById('newProfileEmail').value = '';
        await loadProfiles();
        selectProfile(userId, name);
    }
}

function selectProfile(userId, name) {
    localStorage.setItem('rdgr-active-profile', JSON.stringify({ id: userId, name: name }));
    location.reload();
}

// Migrate old localStorage key
if (!localStorage.getItem('rdgr-active-profile') && localStorage.getItem('deft-active-profile')) {
    localStorage.setItem('rdgr-active-profile', localStorage.getItem('deft-active-profile'));
    localStorage.removeItem('deft-active-profile');
}

function toggleProfileDropdown() {
    const dd = document.getElementById('profileDropdown');
    const btn = document.getElementById('profileBtn');
    dd.classList.toggle('hidden');
    btn.setAttribute('aria-expanded', !dd.classList.contains('hidden'));
    if (!dd.classList.contains('hidden')) {
        setTimeout(() => {
            document.addEventListener('click', closeProfileDropdown, { once: true });
        }, 0);
    }
}

function closeProfileDropdown(e) {
    const dd = document.getElementById('profileDropdown');
    if (!document.getElementById('profileSwitcher').contains(e.target)) {
        dd.classList.add('hidden');
        document.getElementById('profileBtn').setAttribute('aria-expanded', 'false');
    }
}


// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
async function initDeft() {
    // Load saved profile
    const savedProfile = localStorage.getItem('rdgr-active-profile');
    if (savedProfile) {
        try {
            const p = JSON.parse(savedProfile);
            activeProfileId = p.id;
            activeProfileName = p.name;
            document.getElementById('profileName').textContent = p.name;
            document.getElementById('profileAvatar').textContent = p.name[0].toUpperCase();
        } catch(e) {}
    }

    // Apply theme
    const themeConfig = loadTheme();
    applyTheme(themeConfig);

    // Load profiles for switcher
    await loadProfiles();

    // Auto-select first profile if none saved
    if (!activeProfileId) {
        const profiles = await supabaseSelect('deft_user_profiles', 'select=user_id,display_name,email&order=display_name&limit=1');
        if (profiles && profiles.length > 0) {
            const p = profiles[0];
            selectProfile(p.user_id, p.display_name || p.email);
        }
    }

    // Load today's data
    if (activeProfileId) {
        await refreshToday();
    }
}

// ═══════════════════════════════════════
// VIEW SWITCHING
// ═══════════════════════════════════════
function switchView(view) {
    currentView = view;
    const views = ['today', 'recipes', 'foods', 'logmeal', 'exercise', 'analytics', 'profile'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.style.display = v === view ? '' : 'none';
        const tab = document.getElementById(`tab-${v}`);
        if (tab) {
            tab.classList.toggle('active', v === view);
            tab.setAttribute('aria-selected', v === view ? 'true' : 'false');
        }
    });

    // Re-trigger reveal animations
    const activeView = document.getElementById(`view-${view}`);
    if (activeView) {
        const revealEls = activeView.querySelectorAll('.deft-reveal');
        revealEls.forEach(el => {
            el.style.animation = 'none';
            el.offsetHeight; // trigger reflow
            el.style.animation = '';
        });
    }

    // Lazy-load data for views
    if (view === 'today') refreshToday();
    if (view === 'recipes') loadRecipes();
    if (view === 'foods') loadFoodBrowser();
    if (view === 'analytics') loadAnalytics();
    if (view === 'exercise') loadExercises();
    if (view === 'profile' && !profileLoaded) loadProfile();
}


// ═══════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════
function toast(message, type = 'success') {
    const container = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    el.setAttribute('role', 'status');
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

// ═══════════════════════════════════════
// BARCODE SCANNER + UI UTILITIES
// ═══════════════════════════════════════
let html5QrCode = null;

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function populateAddFoodFromScan(food) {
    const n = food.nutrition_per_serving || {};
    const set = (id, val) => { const el = document.getElementById(id); if (el && val != null && val !== '') el.value = val; };
    set('newFoodName', food.name);
    set('newFoodBrand', food.brand);
    set('newFoodServing', food.serving_size);
    set('newFoodCal', n.calories);
    set('newFoodFat', n.total_fat_g);
    set('newFoodProtein', n.protein_g);
    set('newFoodTotalCarbs', n.total_carbs_g);
    set('newFoodFiber', n.fiber_g);
    set('newFoodNetCarbs', n.net_carbs_g);
    set('newFoodSugar', n.sugar_g);
    set('newFoodSodium', n.sodium_mg);
    set('newFoodChol', n.cholesterol_mg);
}

let currentBarcodeContext = null;

// GTIN/UPC/EAN mod-10 checksum validator. Accepts 8/12/13/14 digit codes only.
function isValidGtin(text) {
    if (!text) return false;
    const digits = String(text).trim();
    if (!/^\d+$/.test(digits)) return false;
    if (![8, 12, 13, 14].includes(digits.length)) return false;
    const padded = digits.padStart(14, '0');
    let sum = 0;
    for (let i = 0; i < 13; i++) {
        const d = parseInt(padded[i], 10);
        sum += (i % 2 === 0) ? d * 3 : d;
    }
    const check = (10 - (sum % 10)) % 10;
    return check === parseInt(padded[13], 10);
}

// Restricted format list for Html5Qrcode — UPC/EAN only, no QR/Aztec/Code128/etc.
function deftBarcodeFormats() {
    if (typeof Html5QrcodeSupportedFormats === 'undefined') return undefined;
    return [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
    ];
}

async function processBarcodeText(decodedText) {
    const context = currentBarcodeContext;
    const resultDiv = document.getElementById('barcodeResult');
    resultDiv.style.display = '';

    // Validate the decoded value as a real UPC/EAN before sending to backend
    if (!isValidGtin(decodedText)) {
        resultDiv.innerHTML = `
            <p class="text-xs" style="color:var(--deft-warning);">Invalid barcode read (got "${escapeHtml(decodedText)}"). The scanner needs to see the full UPC/EAN — try moving the camera back, holding steady, or using a clearer photo.</p>
            <div class="flex gap-2 mt-2">
                <button class="btn btn-ghost text-xs" onclick="document.getElementById('barcodePhotoInput').click()">Try a photo</button>
                <button class="btn btn-ghost text-xs" onclick="closeBarcodeScanner();setTimeout(()=>openBarcodeScanner('${context||''}'),300);">Retry camera</button>
            </div>`;
        return;
    }

    resultDiv.innerHTML = '<p class="ai-loading" style="color: var(--deft-txt-2);">Looking up product...</p>';

    const result = await deftApi('scan_barcode', { barcode: decodedText });

    if (result && result.success !== false) {
        const food = result.data || result.food || result;
        const n = food.nutrition_per_serving || {};

        if (context === 'addFood') {
            populateAddFoodFromScan(food);
            closeBarcodeScanner();
            toast(`Filled from barcode: ${food.name || decodedText}`, 'success');
            return;
        }

        resultDiv.innerHTML = `
            <h4 class="font-heading font-bold text-sm mb-2" style="color:var(--deft-accent);">${escapeHtml(food.name || 'Unknown')}</h4>
            ${food.brand ? `<p class="text-xs mb-1" style="color:var(--deft-txt-2);">Brand: ${escapeHtml(food.brand)}</p>` : ''}
            <p class="text-xs mb-2 font-mono" style="color:var(--deft-txt-3);">${n.calories||0} cal | ${n.total_fat_g||0}g fat | ${n.protein_g||0}g protein | ${n.net_carbs_g||0}g carbs</p>
            <div class="flex gap-2 mt-3">
                <button class="btn btn-primary text-xs" onclick="closeBarcodeScanner(); document.getElementById('foodBrowserSearch').value='${escapeHtml(food.name || '')}'; searchFoodBrowser('${escapeHtml(food.name || '')}');">Find in Foods</button>
                <button class="btn btn-ghost text-xs" onclick="closeBarcodeScanner()">Cancel</button>
            </div>`;
    } else {
        resultDiv.innerHTML = `
            <p class="text-xs" style="color:var(--deft-warning);">Product not found for barcode: ${escapeHtml(decodedText)}</p>
            <div class="flex gap-2 mt-2">
                <button class="btn btn-ghost text-xs" onclick="document.getElementById('barcodePhotoInput').click()">Try a photo</button>
                <button class="btn btn-ghost text-xs" onclick="closeBarcodeScanner();setTimeout(()=>openBarcodeScanner('${context||''}'),300);">Retry camera</button>
            </div>`;
    }
}

function openBarcodeScanner(context) {
    currentBarcodeContext = context || null;
    openModal('barcodeScannerModal');
    document.getElementById('barcodeResult').style.display = 'none';
    document.getElementById('barcode-reader').style.display = '';

    const formatsToSupport = deftBarcodeFormats();
    html5QrCode = new Html5Qrcode("barcode-reader", { formatsToSupport, verbose: false });
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 120 }, formatsToSupport },
        async (decodedText) => {
            try { await html5QrCode.stop(); } catch(e) {}
            html5QrCode = null;
            await processBarcodeText(decodedText);
        },
        () => {}
    ).catch(() => {
        // Camera unavailable -- hide the live viewer and prompt for a photo upload
        const reader = document.getElementById('barcode-reader');
        if (reader) reader.style.display = 'none';
        const resultDiv = document.getElementById('barcodeResult');
        resultDiv.style.display = '';
        resultDiv.innerHTML = '<p class="text-xs" style="color:var(--deft-warning);">Camera not available. Use the Upload Photo button below to scan a barcode from an image.</p>';
    });
}

async function scanBarcodePhoto(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;

    // Stop any live camera scan in progress
    if (html5QrCode) {
        try { await html5QrCode.stop(); } catch(e) {}
        html5QrCode = null;
    }

    const reader = document.getElementById('barcode-reader');
    if (reader) reader.style.display = 'none';

    const resultDiv = document.getElementById('barcodeResult');
    resultDiv.style.display = '';
    resultDiv.innerHTML = '<p class="ai-loading" style="color:var(--deft-txt-2);">Reading barcode from photo...</p>';

    try {
        const tempScanner = new Html5Qrcode("barcode-reader", { formatsToSupport: deftBarcodeFormats(), verbose: false });
        const decodedText = await tempScanner.scanFile(file, /* showImage */ false);
        await processBarcodeText(decodedText);
    } catch (err) {
        resultDiv.innerHTML = `
            <p class="text-xs" style="color:var(--deft-warning);">Could not read a barcode from this photo. Try a clearer image with the barcode in focus and no glare.</p>
            <div class="flex gap-2 mt-2">
                <button class="btn btn-ghost text-xs" onclick="document.getElementById('barcodePhotoInput').click()">Try another photo</button>
                <button class="btn btn-ghost text-xs" onclick="closeBarcodeScanner()">Cancel</button>
            </div>`;
    } finally {
        // Clear input so the same file can be selected again later
        input.value = '';
    }
}

function closeBarcodeScanner() {
    if (html5QrCode) { html5QrCode.stop().catch(()=>{}); html5QrCode = null; }
    currentBarcodeContext = null;
    const photoInput = document.getElementById('barcodePhotoInput');
    if (photoInput) photoInput.value = '';
    closeModal('barcodeScannerModal');
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Keyboard: close modals on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.active').forEach(m => {
            m.classList.remove('active');
        });
        closeRecipeDetail();
        const dd = document.getElementById('profileDropdown');
        if (!dd.classList.contains('hidden')) {
            dd.classList.add('hidden');
            document.getElementById('profileBtn').setAttribute('aria-expanded', 'false');
        }
    }
});
