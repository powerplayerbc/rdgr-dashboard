// ═══════════════════════════════════════
// DEFT — Profile Tab
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// PROFILE TAB
// ═══════════════════════════════════════
let profileDirty = false;
let profileLoaded = false;

async function loadProfile() {
    if (!activeProfileId) return;
    // Try webhook first, fall back to direct Supabase read
    let result = await deftApi('get_profile', {}, { silent: true });
    let p;
    if (result && result.data) {
        p = result.data.profile || result.data;
    } else {
        // Fallback: read directly from Supabase
        const rows = await supabaseSelect('deft_user_profiles', `user_id=eq.${activeProfileId}&select=*`);
        if (!rows || rows.length === 0) return;
        p = rows[0];
    }
    if (!p) return;
    profileLoaded = true;

    // Populate form fields
    setVal('profHeight', p.height_inches);
    setVal('profWeight', p.current_weight_lbs);
    setVal('profTargetWeight', p.target_weight_lbs);
    setVal('profAge', p.age);
    setVal('profSex', p.sex);
    setVal('profActivity', p.activity_level);
    setVal('profDiet', p.diet_type);
    setVal('profMeals', p.meal_count_default);

    // Macro targets
    const mt = p.macro_targets || {};
    setVal('profCalories', mt.calories);
    setVal('profFat', mt.fat_g);
    setVal('profProtein', mt.protein_g);
    setVal('profNetCarbs', mt.net_carbs_g);
    setVal('profFiber', mt.fiber_g);
    setVal('profSugar', mt.sugar_limit_g);

    // Preferences
    const prefs = p.preferences || {};
    setVal('profTimezone', prefs.timezone);
    setVal('profUnits', prefs.unit_system);

    // Render allergen/avoid chips
    renderChips('allergenChips', prefs.allergens || []);
    renderChips('avoidChips', prefs.avoid_ingredients || []);

    // Compute TDEE
    computeTDEE();

    profileDirty = false;
    document.getElementById('profileSaveBar').style.display = 'none';
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
}

function markProfileDirty() {
    profileDirty = true;
    document.getElementById('profileSaveBar').style.display = '';
}

function computeTDEE() {
    const weight = parseFloat(document.getElementById('profWeight')?.value) || 0;
    const height = parseFloat(document.getElementById('profHeight')?.value) || 0;
    const age = parseInt(document.getElementById('profAge')?.value) || 0;
    const sex = document.getElementById('profSex')?.value || 'male';
    const activity = document.getElementById('profActivity')?.value || 'sedentary';

    // Update height display
    if (height > 0) {
        const ft = Math.floor(height / 12);
        const inches = Math.round(height % 12);
        document.getElementById('heightDisplay').textContent = `${ft}'${inches}"`;
    } else {
        document.getElementById('heightDisplay').textContent = '--';
    }

    if (!weight || !height || !age) {
        document.getElementById('bmrValue').textContent = '--';
        document.getElementById('tdeeValue').textContent = '--';
        document.getElementById('activityMult').textContent = '--';
        return;
    }

    // Mifflin-St Jeor
    const weightKg = weight * 0.453592;
    const heightCm = height * 2.54;
    let bmr;
    if (sex === 'male') {
        bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    } else {
        bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }

    const multipliers = { sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725, extra_active: 1.9 };
    const mult = multipliers[activity] || 1.2;
    const tdee = Math.round(bmr * mult);

    document.getElementById('bmrValue').textContent = Math.round(bmr);
    document.getElementById('tdeeValue').textContent = tdee;
    document.getElementById('activityMult').textContent = `\u00d7${mult}`;
}

async function saveProfile() {
    const data = {
        height_inches: parseFloat(document.getElementById('profHeight').value) || null,
        current_weight_lbs: parseFloat(document.getElementById('profWeight').value) || null,
        target_weight_lbs: parseFloat(document.getElementById('profTargetWeight').value) || null,
        age: parseInt(document.getElementById('profAge').value) || null,
        sex: document.getElementById('profSex').value || null,
        activity_level: document.getElementById('profActivity').value || null,
        diet_type: document.getElementById('profDiet').value || null,
        meal_count_default: parseInt(document.getElementById('profMeals').value) || null,
        macro_targets: {
            calories: parseFloat(document.getElementById('profCalories').value) || null,
            fat_g: parseFloat(document.getElementById('profFat').value) || null,
            protein_g: parseFloat(document.getElementById('profProtein').value) || null,
            net_carbs_g: parseFloat(document.getElementById('profNetCarbs').value) || null,
            fiber_g: parseFloat(document.getElementById('profFiber').value) || null,
            sugar_limit_g: parseFloat(document.getElementById('profSugar').value) || null,
        },
        preferences: {
            timezone: document.getElementById('profTimezone').value || null,
            unit_system: document.getElementById('profUnits').value || null,
            allergens: getChipValues('allergenChips'),
            avoid_ingredients: getChipValues('avoidChips'),
        }
    };

    const btn = document.getElementById('saveProfileBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    // Try webhook first, fall back to direct Supabase write
    let result = await deftApi('update_profile', data, { silent: true });
    let saved = false;

    if (result) {
        saved = true;
    } else {
        // Fallback: write directly to Supabase
        const sbResult = await supabaseWrite('deft_user_profiles', 'PATCH', data, `user_id=eq.${activeProfileId}`);
        if (sbResult) saved = true;
    }

    btn.disabled = false;
    btn.textContent = 'Save Profile';

    if (saved) {
        toast('Profile saved', 'success');
        profileDirty = false;
        document.getElementById('profileSaveBar').style.display = 'none';
    } else {
        toast('Failed to save profile', 'error');
    }
}

// ── Chip management ──
function renderChips(containerId, values) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = values.map(v =>
        `<span class="chip">${v} <button onclick="removeChip('${containerId}', '${v.replace(/'/g, "\\'")}')" class="chip-remove" aria-label="Remove ${v}">&times;</button></span>`
    ).join('');
}

function addChip(containerId, inputId) {
    const input = document.getElementById(inputId);
    const val = input.value.trim();
    if (!val) return;
    const existing = getChipValues(containerId);
    if (!existing.includes(val)) {
        existing.push(val);
        renderChips(containerId, existing);
        markProfileDirty();
    }
    input.value = '';
}

function removeChip(containerId, value) {
    const existing = getChipValues(containerId).filter(v => v !== value);
    renderChips(containerId, existing);
    markProfileDirty();
}

function getChipValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('.chip'))
        .map(el => el.textContent.replace('\u00d7', '').trim());
}

