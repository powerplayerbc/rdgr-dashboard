// ═══════════════════════════════════════
// DEFT — Exercise Tab
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════
let selectedIntensity = 'moderate';
let allExerciseTypes = [];
let selectedExerciseType = null;
let editingExTypeId = null;
let activeExTypeFilter = 'all';
let exTypeSearchQuery = '';
let exTypeSearchTimeout;
let calOverrideActive = false;
let modalIntensity = 'moderate';

// Speed-based MET values for walking/running (Compendium of Physical Activities)
const SPEED_MET_TABLE = [
    { maxMph: 2.5, met: 2.8 },   // Walking slow
    { maxMph: 3.2, met: 3.5 },   // Walking moderate
    { maxMph: 4.0, met: 4.3 },   // Walking brisk
    { maxMph: 5.5, met: 8.3 },   // Jogging
    { maxMph: 6.5, met: 9.8 },   // Running easy
    { maxMph: 7.5, met: 11.0 },  // Running moderate
    { maxMph: 9.0, met: 11.8 },  // Running fast
    { maxMph: Infinity, met: 14.5 } // Running very fast
];

function getMetFromSpeed(mph) {
    for (const entry of SPEED_MET_TABLE) {
        if (mph <= entry.maxMph) return entry.met;
    }
    return 14.5;
}

// ═══════════════════════════════════════
// EXISTING: EXERCISE LOG FUNCTIONS
// ═══════════════════════════════════════

async function loadExercises() {
    if (!activeProfileId) return;
    const today = new Date().toLocaleDateString('en-CA');

    const result = await deftApi('get_exercises', { date: today }, { silent: true });
    todayExercises = (result && result.data) ? (result.data.exercises || result.data) : [];
    if (!Array.isArray(todayExercises)) todayExercises = [];
    renderExercises();

    // Also load exercise types when exercises load
    loadExerciseTypes();
}

function renderExercises() {
    const container = document.getElementById('exerciseList');

    if (todayExercises.length === 0) {
        container.innerHTML = '<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3" style="color: var(--deft-txt-3);"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg><p>No exercises logged today</p></div>';
        document.getElementById('exerciseSummary').style.display = 'none';
        return;
    }

    container.innerHTML = todayExercises.map(ex => {
        const typeColors = {
            cardio: 'var(--deft-accent)',
            strength: 'var(--deft-accent-warm)',
            flexibility: '#C084FC',
            sports: 'var(--deft-success)',
            other: 'var(--deft-txt-3)'
        };
        const color = typeColors[ex.exercise_type] || typeColors.other;
        const exId = ex.exercise_id || ex.id || '';
        return `
        <div class="exercise-card">
            <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                    <span class="badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}30;">${ex.exercise_type || 'other'}</span>
                    <span class="font-heading font-bold text-sm" style="color: var(--deft-txt);">${ex.exercise_name || 'Exercise'}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-mono" style="color: var(--deft-txt-3);">${ex.intensity || ''}</span>
                    <button onclick="deleteExerciseEntry('${exId}')" class="text-xs px-1.5 py-0.5 rounded hover:bg-red-500/20 transition-colors" style="color: var(--deft-danger);" title="Delete exercise">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 3.5h7M4.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M5 5.5v3M7 5.5v3M3.5 3.5l.5 6a1 1 0 001 1h2a1 1 0 001-1l.5-6" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
            </div>
            <div class="flex gap-3 text-xs" style="color: var(--deft-txt-2);">
                <span>${ex.duration_min || 0} min</span>
                <span>&middot;</span>
                <span>${Math.round(ex.calories_burned || 0)} cal burned</span>
            </div>
        </div>`;
    }).join('');

    // Summary
    const totalDuration = todayExercises.reduce((s, e) => s + (e.duration_min || 0), 0);
    const totalCal = todayExercises.reduce((s, e) => s + (e.calories_burned || 0), 0);
    document.getElementById('exerciseSummary').style.display = '';
    document.getElementById('totalDuration').textContent = totalDuration;
    document.getElementById('totalCalBurned').textContent = Math.round(totalCal);
}

function selectIntensity(level) {
    selectedIntensity = level;
    document.querySelectorAll('.intensity-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.level === level);
    });
}

function toggleExerciseDetails(btn) {
    btn.classList.toggle('open');
    document.getElementById('exerciseDetailsContent').classList.toggle('open');
}

async function logExercise() {
    const name = document.getElementById('exName').value.trim();
    const type = document.getElementById('exType').value;
    const duration = parseInt(document.getElementById('exDuration').value);
    const calories = parseInt(document.getElementById('exCalories').value);

    if (!name) { toast('Enter exercise name', 'error'); return; }
    if (!duration || duration <= 0) { toast('Enter duration', 'error'); return; }

    const details = {};
    const dist = parseFloat(document.getElementById('exDistance').value);
    if (dist) details.distance_miles = dist;
    const speed = parseFloat(document.getElementById('exSpeed').value);
    if (speed && speed > 0) {
        details.avg_speed_mph = speed;
    } else if (dist && duration > 0) {
        details.avg_speed_mph = Math.round((dist / (duration / 60)) * 10) / 10;
    }
    const sets = parseInt(document.getElementById('exSets').value);
    if (sets) details.sets = sets;
    const reps = parseInt(document.getElementById('exReps').value);
    if (reps) details.reps = reps;
    const wt = parseFloat(document.getElementById('exWeight').value);
    if (wt) details.weight_lbs = wt;
    const hr = parseInt(document.getElementById('exHR').value);
    if (hr) details.heart_rate_avg = hr;

    const btn = document.getElementById('logExerciseBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2">Logging...</span>';

    // Estimate calories if not entered
    let finalCalories = calories;
    let caloriesEstimated = false;
    if (!finalCalories || finalCalories <= 0) {
        const MET = {
            cardio:     { low: 4.0, moderate: 7.0, high: 10.0, max: 12.5 },
            strength:   { low: 3.0, moderate: 5.0, high: 6.0,  max: 8.0  },
            flexibility:{ low: 2.5, moderate: 3.5, high: 4.0,  max: 5.0  },
            sports:     { low: 4.0, moderate: 6.0, high: 8.0,  max: 10.0 },
            other:      { low: 3.0, moderate: 5.0, high: 7.0,  max: 9.0  }
        };
        let met;
        const speedMph = details.avg_speed_mph;
        if (type === 'cardio' && speedMph && speedMph > 0) {
            met = getMetFromSpeed(speedMph);
        } else {
            met = (MET[type] || MET.other)[selectedIntensity || 'moderate'];
        }
        const profWeightEl = document.getElementById('profWeight');
        const weightLbs = (profWeightEl && parseFloat(profWeightEl.value)) || (dailyLog?.weight_lbs) || 170;
        const weightKg = weightLbs * 0.453592;
        finalCalories = Math.round(met * weightKg * (duration / 60));
        caloriesEstimated = true;
    }

    const result = await deftApi('log_exercise', {
        exercise_name: name,
        exercise_type: type,
        duration_min: duration,
        calories_burned: finalCalories,
        intensity: selectedIntensity,
        details: Object.keys(details).length > 0 ? details : undefined
    });

    btn.disabled = false;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Log Exercise</span>';

    if (result) {
        toast(`${name} logged!${caloriesEstimated ? ' (~' + finalCalories + ' cal estimated)' : ''}`, 'success');
        // Clear form
        document.getElementById('exName').value = '';
        document.getElementById('exDuration').value = '';
        document.getElementById('exCalories').value = '';
        document.getElementById('exDistance').value = '';
        document.getElementById('exSpeed').value = '';
        document.getElementById('exSets').value = '';
        document.getElementById('exReps').value = '';
        document.getElementById('exWeight').value = '';
        document.getElementById('exHR').value = '';
        // Clear exercise type selection
        clearExerciseTypeSelection();
        // Refresh
        loadExercises();
        refreshToday();
    }
}


// ═══════════════════════════════════════
// EXERCISE TYPES: CRUD
// ═══════════════════════════════════════

async function loadExerciseTypes() {
    if (!activeProfileId) return;

    const data = await supabaseSelect(
        'deft_exercise_types',
        `user_id=eq.${activeProfileId}&status=eq.active&order=is_favorite.desc,name.asc`
    );

    allExerciseTypes = data || [];
    renderExerciseTypes();
}

function renderExerciseTypes() {
    const grid = document.getElementById('exerciseTypeGrid');
    const countEl = document.getElementById('exerciseTypeCount');
    if (!grid) return;

    // Apply filter and search
    let filtered = allExerciseTypes;

    if (activeExTypeFilter !== 'all') {
        filtered = filtered.filter(t => t.category === activeExTypeFilter);
    }

    if (exTypeSearchQuery) {
        const q = exTypeSearchQuery.toLowerCase();
        filtered = filtered.filter(t =>
            (t.name && t.name.toLowerCase().includes(q)) ||
            (t.category && t.category.toLowerCase().includes(q)) ||
            (t.description && t.description.toLowerCase().includes(q))
        );
    }

    // Update count
    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
        const isFiltered = activeExTypeFilter !== 'all' || exTypeSearchQuery;
        grid.innerHTML = `<div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3" style="color: var(--deft-txt-3);">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
            </svg>
            <p>${isFiltered ? 'No matching exercise types' : 'No exercise types yet'}</p>
            <p class="text-xs mt-1" style="color: var(--deft-txt-3);">${isFiltered ? 'Try a different filter or search' : 'Create your first exercise type to get started'}</p>
        </div>`;
        return;
    }

    const typeColors = {
        cardio: 'var(--deft-accent)',
        strength: 'var(--deft-accent-warm)',
        flexibility: '#C084FC',
        sports: 'var(--deft-success)',
        other: 'var(--deft-txt-3)'
    };

    grid.innerHTML = filtered.map(t => {
        const color = typeColors[t.category] || typeColors.other;
        const calPerMin = t.base_duration_min > 0 ? (t.base_calories / t.base_duration_min).toFixed(1) : '0.0';
        const isSelected = selectedExerciseType && selectedExerciseType.exercise_type_id === t.exercise_type_id;
        const descSnippet = t.description ? (t.description.length > 60 ? t.description.substring(0, 60) + '...' : t.description) : '';

        return `<div class="exercise-type-card${isSelected ? ' selected' : ''}" onclick="selectExerciseTypeForLog('${t.exercise_type_id}')">
            <div class="card-actions">
                <button onclick="event.stopPropagation(); editExerciseType('${t.exercise_type_id}')" title="Edit">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2L4 10H2v-2l6.5-6.5z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button class="btn-danger-ghost" onclick="event.stopPropagation(); deleteExerciseType('${t.exercise_type_id}')" title="Delete">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 3.5h7M4.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M5 5.5v3M7 5.5v3M3.5 3.5l.5 6a1 1 0 001 1h2a1 1 0 001-1l.5-6" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
            <div class="flex items-center gap-2 mb-1">
                <span class="badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}30;">${t.category || 'other'}</span>
                <span class="font-heading font-bold text-sm" style="color: var(--deft-txt);">${t.name}</span>
                ${t.is_favorite ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="var(--deft-accent-warm)" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : ''}
            </div>
            <div class="flex gap-2 text-xs font-mono" style="color: var(--deft-txt-2);">
                <span>${t.base_duration_min} min</span>
                <span style="color: var(--deft-txt-3);">/</span>
                <span>${Math.round(t.base_calories)} cal</span>
                <span style="color: var(--deft-txt-3);">/</span>
                <span>${calPerMin} cal/min</span>
            </div>
            ${descSnippet ? `<div class="text-xs mt-1.5" style="color: var(--deft-txt-3);">${descSnippet}</div>` : ''}
        </div>`;
    }).join('');
}


// ═══════════════════════════════════════
// EXERCISE TYPES: FILTER & SEARCH
// ═══════════════════════════════════════

function filterExerciseTypes(filter) {
    activeExTypeFilter = filter;
    document.querySelectorAll('.ex-type-filter-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.filter === filter);
    });
    renderExerciseTypes();
}

function searchExerciseTypes(query) {
    clearTimeout(exTypeSearchTimeout);
    exTypeSearchTimeout = setTimeout(() => {
        exTypeSearchQuery = query.trim();
        renderExerciseTypes();
    }, 250);
}


// ═══════════════════════════════════════
// EXERCISE TYPES: MODAL (ADD/EDIT)
// ═══════════════════════════════════════

function selectModalIntensity(level) {
    modalIntensity = level;
    document.querySelectorAll('.ex-type-modal-intensity-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.level === level);
    });
}

function openAddExerciseTypeModal() {
    editingExTypeId = null;
    modalIntensity = 'moderate';

    // Reset form
    document.getElementById('exTypeName').value = '';
    document.getElementById('exTypeCategory').value = 'cardio';
    document.getElementById('exTypeDescription').value = '';
    document.getElementById('exTypeBaseDuration').value = '';
    document.getElementById('exTypeBaseCalories').value = '';

    // Reset intensity pills
    document.querySelectorAll('.ex-type-modal-intensity-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.level === 'moderate');
    });

    // Set title
    document.getElementById('exTypeModalTitle').textContent = 'New Exercise Type';

    openModal('addExerciseTypeModal');
}

function editExerciseType(typeId) {
    const exType = allExerciseTypes.find(t => t.exercise_type_id === typeId);
    if (!exType) return;

    editingExTypeId = typeId;
    modalIntensity = exType.intensity || 'moderate';

    // Populate form
    document.getElementById('exTypeName').value = exType.name || '';
    document.getElementById('exTypeCategory').value = exType.category || 'other';
    document.getElementById('exTypeDescription').value = exType.description || '';
    document.getElementById('exTypeBaseDuration').value = exType.base_duration_min || '';
    document.getElementById('exTypeBaseCalories').value = exType.base_calories || '';

    // Set intensity pills
    document.querySelectorAll('.ex-type-modal-intensity-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.level === modalIntensity);
    });

    // Set title
    document.getElementById('exTypeModalTitle').textContent = 'Edit Exercise Type';

    openModal('addExerciseTypeModal');
}

async function saveExerciseType() {
    const name = document.getElementById('exTypeName').value.trim();
    const category = document.getElementById('exTypeCategory').value;
    const description = document.getElementById('exTypeDescription').value.trim();
    const baseDuration = parseFloat(document.getElementById('exTypeBaseDuration').value);
    const baseCalories = parseFloat(document.getElementById('exTypeBaseCalories').value);

    // Validate
    if (!name) { toast('Exercise name is required', 'error'); return; }
    if (!baseDuration || baseDuration <= 0) { toast('Base duration must be greater than 0', 'error'); return; }
    if (baseCalories === undefined || baseCalories === null || isNaN(baseCalories) || baseCalories < 0) { toast('Base calories must be 0 or greater', 'error'); return; }

    const btn = document.getElementById('saveExerciseTypeBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2">Saving...</span>';

    const body = {
        name,
        category,
        description: description || null,
        base_duration_min: baseDuration,
        base_calories: baseCalories,
        intensity: modalIntensity,
        user_id: activeProfileId,
        updated_at: new Date().toISOString()
    };

    let result;
    if (editingExTypeId) {
        // PATCH existing
        result = await supabaseWrite(
            'deft_exercise_types',
            'PATCH',
            body,
            `exercise_type_id=eq.${editingExTypeId}`
        );
    } else {
        // POST new
        result = await supabaseWrite('deft_exercise_types', 'POST', body);
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 4L5.5 9.5L3 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Save Type</span>';

    if (result) {
        toast(editingExTypeId ? `${name} updated!` : `${name} created!`, 'success');
        closeModal('addExerciseTypeModal');
        editingExTypeId = null;
        await loadExerciseTypes();
    } else {
        toast('Failed to save exercise type', 'error');
    }
}

async function deleteExerciseType(typeId) {
    const exType = allExerciseTypes.find(t => t.exercise_type_id === typeId);
    if (!exType) return;

    if (!confirm(`Archive "${exType.name}"? It will no longer appear in the library.`)) return;

    const result = await supabaseWrite(
        'deft_exercise_types',
        'PATCH',
        { status: 'archived', updated_at: new Date().toISOString() },
        `exercise_type_id=eq.${typeId}`
    );

    if (result) {
        toast(`${exType.name} archived`, 'success');
        // If the deleted type was selected, clear selection
        if (selectedExerciseType && selectedExerciseType.exercise_type_id === typeId) {
            clearExerciseTypeSelection();
        }
        await loadExerciseTypes();
    } else {
        toast('Failed to archive exercise type', 'error');
    }
}


// ═══════════════════════════════════════
// EXERCISE TYPES: SELECTION & SCALING
// ═══════════════════════════════════════

function selectExerciseTypeForLog(typeId) {
    const exType = allExerciseTypes.find(t => t.exercise_type_id === typeId);
    if (!exType) return;

    // If clicking the same type again, deselect it
    if (selectedExerciseType && selectedExerciseType.exercise_type_id === typeId) {
        clearExerciseTypeSelection();
        return;
    }

    selectedExerciseType = exType;
    calOverrideActive = false;

    // Populate form fields
    document.getElementById('exName').value = exType.name;
    document.getElementById('exType').value = exType.category || 'other';
    document.getElementById('exDuration').value = exType.base_duration_min;
    document.getElementById('exCalories').value = Math.round(exType.base_calories);

    // Set intensity
    const intensity = exType.intensity || 'moderate';
    selectIntensity(intensity);

    // Show scaling info bar
    const calPerMin = exType.base_duration_min > 0 ? (exType.base_calories / exType.base_duration_min).toFixed(1) : '0.0';
    const infoBar = document.getElementById('scalingInfoBar');
    const infoText = document.getElementById('scalingInfoText');
    if (infoBar && infoText) {
        infoText.textContent = `Based on ${exType.name}: ${exType.base_duration_min} min / ${Math.round(exType.base_calories)} cal (${calPerMin} cal/min)`;
        infoBar.style.display = '';
    }

    // Show clear button
    const clearBtn = document.getElementById('clearTypeSelectionBtn');
    if (clearBtn) clearBtn.style.display = '';

    // Attach duration input handler for auto-scaling
    const durationInput = document.getElementById('exDuration');
    durationInput.oninput = function() {
        updateExerciseCaloriesFromType();
    };

    // Attach calorie input handler for manual override detection
    const calorieInput = document.getElementById('exCalories');
    calorieInput.oninput = function() {
        if (selectedExerciseType) {
            calOverrideActive = true;
            const infoBar = document.getElementById('scalingInfoBar');
            const infoText = document.getElementById('scalingInfoText');
            if (infoBar && infoText) {
                infoText.textContent = 'Manual override -- auto-scaling paused';
                infoBar.style.display = '';
            }
        }
    };

    // Re-render to show selected state
    renderExerciseTypes();
}

function updateExerciseCaloriesFromType() {
    if (!selectedExerciseType || calOverrideActive) return;

    const newDuration = parseFloat(document.getElementById('exDuration').value);
    if (!newDuration || newDuration <= 0) return;

    const baseDuration = selectedExerciseType.base_duration_min;
    const baseCalories = selectedExerciseType.base_calories;

    if (!baseDuration || baseDuration <= 0) return;

    const scaledCalories = Math.round((newDuration / baseDuration) * baseCalories);
    document.getElementById('exCalories').value = scaledCalories;

    // Update scaling info bar
    const calPerMin = (baseCalories / baseDuration).toFixed(1);
    const infoText = document.getElementById('scalingInfoText');
    if (infoText) {
        infoText.textContent = `${newDuration} min x ${calPerMin} cal/min = ${scaledCalories} cal (scaled from ${baseDuration} min base)`;
    }
}

function clearExerciseTypeSelection() {
    selectedExerciseType = null;
    calOverrideActive = false;

    // Hide scaling info bar
    const infoBar = document.getElementById('scalingInfoBar');
    if (infoBar) infoBar.style.display = 'none';

    // Hide clear button
    const clearBtn = document.getElementById('clearTypeSelectionBtn');
    if (clearBtn) clearBtn.style.display = 'none';

    // Remove oninput handlers
    const durationInput = document.getElementById('exDuration');
    if (durationInput) durationInput.oninput = null;
    const calorieInput = document.getElementById('exCalories');
    if (calorieInput) calorieInput.oninput = null;

    // Re-render to remove selected state
    renderExerciseTypes();
}

// Auto-calculate speed from distance and duration
(function setupSpeedAutoCalc() {
    function init() {
        const distEl = document.getElementById('exDistance');
        const durEl = document.getElementById('exDuration');
        const speedEl = document.getElementById('exSpeed');
        if (!distEl || !durEl || !speedEl) return;

        function autoCalcSpeed() {
            if (speedEl.value && !speedEl.dataset.auto) return;
            const dist = parseFloat(distEl.value);
            const dur = parseFloat(durEl.value);
            if (dist > 0 && dur > 0) {
                speedEl.value = (dist / (dur / 60)).toFixed(1);
                speedEl.dataset.auto = '1';
            }
        }

        distEl.addEventListener('input', autoCalcSpeed);
        durEl.addEventListener('input', autoCalcSpeed);
        speedEl.addEventListener('input', function () {
            delete speedEl.dataset.auto;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
