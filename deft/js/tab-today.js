// ═══════════════════════════════════════
// DEFT — Today Tab
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// TODAY TAB
// ═══════════════════════════════════════
async function refreshToday() {
    if (!activeProfileId) return;
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

    // Fetch daily log
    const logs = await supabaseSelect('deft_daily_logs', `user_id=eq.${activeProfileId}&log_date=eq.${today}&select=*`);
    dailyLog = logs && logs.length > 0 ? logs[0] : null;

    // Fetch today's meals (convert local day boundaries to UTC for PostgREST)
    const dayStartUtc = new Date(`${today}T00:00:00`).toISOString();
    const dayEndUtc = new Date(`${today}T23:59:59.999`).toISOString();
    const meals = await supabaseSelect('deft_meal_entries', `user_id=eq.${activeProfileId}&logged_at=gte.${dayStartUtc}&logged_at=lt.${dayEndUtc}&order=logged_at.asc&select=*`);
    todayMeals = meals || [];

    // Fetch today's exercises via bridge
    const exResult = await deftApi('get_exercises', { date: today }, { silent: true });
    todayExercises = (exResult && exResult.data) ? (exResult.data.exercises || exResult.data) : [];
    if (!Array.isArray(todayExercises)) todayExercises = [];

    // Fetch expiring pantry items (non-blocking)
    loadPantryStatus();

    renderToday();
}

async function loadPantryStatus() {
    try {
        const result = await deftApi('get_expiring_items', { days_ahead: 3 }, { silent: true });
        const items = (result && result.data) ? (Array.isArray(result.data) ? result.data : result.data.items || []) : [];
        const panel = document.getElementById('pantryStatusPanel');
        if (items.length > 0) {
            panel.style.display = '';
            document.getElementById('expiringCount').textContent = items.length;
            document.getElementById('pantryStatusContent').innerHTML = items.map(item => {
                const days = item.days_until_expiry != null ? item.days_until_expiry : Math.ceil((new Date(item.expiry_date) - new Date()) / 86400000);
                const color = days <= 0 ? 'var(--deft-danger)' : days <= 1 ? 'var(--deft-warning)' : 'var(--deft-txt-2)';
                return `<div class="flex items-center justify-between py-1.5" style="border-bottom: 1px solid var(--deft-border);">
                    <span class="text-sm" style="color: var(--deft-txt);">${item.name}</span>
                    <span class="text-xs font-mono" style="color: ${color};">${days <= 0 ? 'Expired' : days + 'd left'} &middot; ${item.location || ''}</span>
                </div>`;
            }).join('');
        } else {
            panel.style.display = 'none';
        }
    } catch(e) {
        // Non-critical, silently fail
    }
}

function calcConsumedFromMeals(meals) {
    const totals = { calories: 0, fat_g: 0, protein_g: 0, net_carbs_g: 0, fiber_g: 0, sugar_g: 0 };
    for (const m of meals) {
        const n = m.nutrition_consumed || {};
        totals.calories += (n.calories || 0);
        totals.fat_g += (n.total_fat_g || n.fat_g || 0);
        totals.protein_g += (n.protein_g || 0);
        totals.net_carbs_g += (n.net_carbs_g || 0);
        totals.fiber_g += (n.fiber_g || 0);
        totals.sugar_g += (n.sugar_g || 0);
    }
    return totals;
}

function renderToday() {
    // Get targets from daily log or defaults
    const targets = dailyLog?.target_macros || { calories: 2000, fat_g: 155, protein_g: 130, net_carbs_g: 20 };
    // Prefer client-calculated totals from actual meal entries (authoritative)
    // Falls back to daily log consumed_totals, then zeros
    const mealConsumed = todayMeals.length > 0 ? calcConsumedFromMeals(todayMeals) : null;
    const consumed = mealConsumed || dailyLog?.consumed_totals || { calories: 0, fat_g: 0, protein_g: 0, net_carbs_g: 0, fiber_g: 0, sugar_g: 0 };
    const targetCal = dailyLog?.target_calories || targets.calories || 2000;

    // Update net carbs bar
    updateNetCarbsBar(consumed.net_carbs_g || 0, targets.net_carbs_g || 20);

    // Update macro rings
    updateMacroRing('cal', consumed.calories || 0, targetCal, 'var(--deft-accent)');
    updateMacroRing('fat', consumed.fat_g || 0, targets.fat_g || 155, 'var(--deft-accent-warm)');
    updateMacroRing('protein', consumed.protein_g || 0, targets.protein_g || 130, 'var(--deft-success)');
    updateMacroRing('carbs', consumed.net_carbs_g || 0, targets.net_carbs_g || 20, 'var(--deft-accent)');

    // Update keto status
    updateKetoStatus(consumed, targets);

    // Update meals list
    renderMealsList();

    // Update exercise summary on today view
    renderTodayExercises();

    // Update water tracker
    const water = dailyLog?.water_oz || 0;
    document.getElementById('waterAmount').textContent = water;
    const waterPct = Math.min((water / 64) * 100, 100);
    document.getElementById('waterBarFill').style.width = waterPct + '%';

    // Update meal count badge
    document.getElementById('mealCount').textContent = todayMeals.length;
}

function renderTodayExercises() {
    const container = document.getElementById('todayExerciseList');
    const countEl = document.getElementById('todayExCount');
    const summaryEl = document.getElementById('todayExSummary');

    countEl.textContent = todayExercises.length;

    if (todayExercises.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No exercises logged yet today</p><p class="text-sm mt-1" style="color: var(--deft-txt-3);">Use the Exercise tab or quick action to log activity</p></div>';
        summaryEl.style.display = 'none';
        return;
    }

    const typeColors = {
        cardio: 'var(--deft-accent)', strength: 'var(--deft-accent-warm)',
        flexibility: '#C084FC', sports: 'var(--deft-success)', other: 'var(--deft-txt-3)'
    };

    container.innerHTML = todayExercises.map(ex => {
        const color = typeColors[ex.exercise_type] || typeColors.other;
        return `<div class="exercise-card">
            <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                    <span class="badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}30;">${ex.exercise_type || 'other'}</span>
                    <span class="font-heading font-bold text-sm" style="color: var(--deft-txt);">${ex.exercise_name || 'Exercise'}</span>
                </div>
                <span class="text-xs font-mono" style="color: var(--deft-txt-3);">${ex.intensity || ''}</span>
            </div>
            <div class="flex gap-3 text-xs" style="color: var(--deft-txt-2);">
                <span>${ex.duration_min || 0} min</span>
                <span>&middot;</span>
                <span>${Math.round(ex.calories_burned || 0)} cal burned</span>
            </div>
        </div>`;
    }).join('');

    const totalDuration = todayExercises.reduce((s, e) => s + (e.duration_min || 0), 0);
    const totalCal = todayExercises.reduce((s, e) => s + (e.calories_burned || 0), 0);
    summaryEl.style.display = '';
    document.getElementById('todayExDuration').textContent = totalDuration;
    document.getElementById('todayExCal').textContent = Math.round(totalCal);
}

function updateNetCarbsBar(consumed, target) {
    const pct = target > 0 ? Math.min((consumed / target) * 100, 150) : 0;
    const fill = document.getElementById('netCarbsFill');
    const label = document.getElementById('netCarbsLabel');
    const bar = document.getElementById('netCarbsBar');

    fill.style.width = Math.min(pct, 100) + '%';
    label.textContent = `${consumed.toFixed(1)}g / ${target}g`;

    // Color based on percentage
    if (pct > 100) {
        fill.style.background = 'var(--deft-danger)';
    } else if (pct > 80) {
        fill.style.background = 'var(--deft-warning)';
    } else {
        fill.style.background = 'var(--deft-accent)';
    }

    // Update ARIA
    bar.setAttribute('aria-valuenow', Math.round(pct));

    document.getElementById('netCarbsPct').textContent = Math.round(pct) + '%';
}

function updateMacroRing(id, consumed, target, color) {
    const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
    const circle = document.getElementById(`ring-${id}`);
    const circumference = 2 * Math.PI * 45; // r=45 => ~282.74
    if (circle) {
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = circumference * (1 - pct);
        circle.style.stroke = color;
    }
    const valEl = document.getElementById(`val-${id}`);
    if (valEl) valEl.textContent = Math.round(consumed);
    const targetEl = document.getElementById(`target-${id}`);
    if (targetEl) targetEl.textContent = `/ ${Math.round(target)}`;
}

function updateKetoStatus(consumed, targets) {
    const netCarbs = consumed.net_carbs_g || 0;
    const target = targets.net_carbs_g || 20;
    const badge = document.getElementById('ketoBadge');
    const text = document.getElementById('ketoText');

    if (netCarbs <= target * 0.8) {
        badge.className = 'keto-badge keto-good';
        text.textContent = 'In Ketosis';
    } else if (netCarbs <= target) {
        badge.className = 'keto-badge keto-near';
        text.textContent = 'Near Limit';
    } else {
        badge.className = 'keto-badge keto-over';
        text.textContent = 'Over Carbs';
    }

    document.getElementById('ketoCarbs').textContent = `${netCarbs.toFixed(1)}g net carbs`;
}

function renderMealsList() {
    const container = document.getElementById('mealsList');
    if (todayMeals.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No food logged yet today</p><p class="text-sm mt-1" style="color: var(--deft-txt-3);">Use the Log Meal tab or quick action to get started</p></div>`;
        return;
    }

    container.innerHTML = todayMeals.map(m => {
        const n = m.nutrition_consumed || {};
        const time = new Date(m.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const mealType = (m.meal_type || 'meal').toLowerCase();
        const badgeClass = `badge badge-${mealType}`;
        const mealId = m.meal_id || m.id || '';
        return `
        <div class="meal-card">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <span class="${badgeClass}">${m.meal_type || 'Meal'}</span>
                    <span class="font-medium text-sm">${m.recipe_name || 'Unnamed'}</span>${m.servings && m.servings !== 1 ? `<span class="text-xs font-mono px-1.5 py-0.5 rounded" style="background: var(--deft-accent, #06D6A0); color: var(--deft-bg); font-weight: 600;">&times;${m.servings}</span>` : ''}
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-mono" style="color: var(--deft-txt-3);">${time}</span>
                    <button onclick="deleteMealEntry('${mealId}')" class="text-xs px-1.5 py-0.5 rounded hover:bg-red-500/20 transition-colors" style="color: var(--deft-danger);" title="Delete meal">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 3.5h7M4.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M5 5.5v3M7 5.5v3M3.5 3.5l.5 6a1 1 0 001 1h2a1 1 0 001-1l.5-6" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
            </div>
            <div class="flex gap-3 text-xs" style="color: var(--deft-txt-2);">
                <span class="font-mono">${Math.round(n.calories || 0)} cal</span>
                <span class="font-mono">${(n.total_fat_g || 0).toFixed(1)}g fat</span>
                <span class="font-mono">${(n.protein_g || 0).toFixed(1)}g pro</span>
                <span class="font-mono">${(n.net_carbs_g || 0).toFixed(1)}g carbs</span>
            </div>
        </div>`;
    }).join('');
}

async function deleteMealEntry(mealId) {
    if (!mealId) return;
    if (!confirm('Delete this meal entry?')) return;
    const result = await deftApi('undo_meal', { meal_id: mealId });
    if (result) {
        toast('Meal deleted', 'success');
        refreshToday();
    }
}

async function deleteExerciseEntry(exerciseId) {
    if (!exerciseId) return;
    if (!confirm('Delete this exercise entry?')) return;
    const result = await supabaseWrite('deft_exercise_entries', 'DELETE', null, `exercise_id=eq.${exerciseId}`);
    if (result !== false) {
        toast('Exercise deleted', 'success');
        loadExercises();
        refreshToday();
    }
}

// ═══════════════════════════════════════
// WATER TRACKING
// ═══════════════════════════════════════
async function addWater(oz) {
    if (!oz || oz <= 0) return;
    if (!activeProfileId) { toast('Please select a profile first', 'error'); return; }
    let saved = false;
    const result = await deftApi('log_water', { amount_oz: oz }, { silent: true });
    if (result) {
        saved = true;
    } else {
        // Fallback: write directly to Supabase
        const today = new Date().toLocaleDateString('en-CA');
        const existing = await supabaseSelect('deft_daily_logs', `user_id=eq.${activeProfileId}&log_date=eq.${today}&select=log_id,water_oz`);
        if (existing && existing.length > 0) {
            const newOz = (existing[0].water_oz || 0) + oz;
            const wr = await supabaseWrite('deft_daily_logs', 'PATCH', { water_oz: newOz }, `log_id=eq.${existing[0].log_id}`);
            if (wr) saved = true;
        } else {
            // Daily log doesn't exist yet — need profile's macro targets for required columns
            const profile = await supabaseSelect('deft_user_profiles', `user_id=eq.${activeProfileId}&select=macro_targets,meal_count_default`);
            const mt = profile?.[0]?.macro_targets || { calories: 2000, fat_g: 155, protein_g: 130, net_carbs_g: 20 };
            const wr = await supabaseWrite('deft_daily_logs', 'POST', {
                user_id: activeProfileId,
                log_date: today,
                water_oz: oz,
                target_calories: mt.calories || 2000,
                target_macros: mt,
                consumed_totals: { calories: 0, fat_g: 0, protein_g: 0, net_carbs_g: 0, fiber_g: 0, sugar_g: 0 },
                meal_count_planned: profile?.[0]?.meal_count_default || 3,
            }, '');
            if (wr) saved = true;
        }
    }
    if (saved) {
        const el = document.getElementById('waterAmount');
        const newAmount = parseInt(el.textContent || '0') + oz;
        el.textContent = newAmount;
        const waterPct = Math.min((newAmount / 64) * 100, 100);
        document.getElementById('waterBarFill').style.width = waterPct + '%';
        toast(`+${oz}oz water logged`, 'success');
    } else {
        toast('Failed to log water — please try again', 'error');
    }
}

function addCustomWater() {
    const input = document.getElementById('customWaterInput');
    const oz = parseInt(input.value);
    if (oz && oz > 0) {
        addWater(oz);
        closeModal('waterModal');
        input.value = '';
    }
}

function openWaterInput() {
    openModal('waterModal');
}

// ═══════════════════════════════════════
// WEIGH-IN
// ═══════════════════════════════════════
function openWeighInModal() {
    document.getElementById('weighInInput').value = '';
    document.getElementById('weighInNotes').value = '';
    openModal('weighInModal');
    setTimeout(() => document.getElementById('weighInInput').focus(), 100);
}

async function submitWeighIn() {
    const weight = parseFloat(document.getElementById('weighInInput').value);
    const notes = document.getElementById('weighInNotes').value.trim();

    if (!weight || weight < 50 || weight > 500) {
        toast('Please enter a valid weight (50-500 lbs)', 'error');
        return;
    }

    const btn = document.getElementById('weighInSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const today = new Date().toLocaleDateString('en-CA');
    let saved = false;

    const result = await deftApi('log_weight', {
        weight_lbs: weight,
        weigh_date: today,
        notes: notes || null
    });

    if (result) {
        saved = true;
    } else {
        // Fallback: write directly to Supabase
        // 1. Write to weight history
        const historyWrite = await supabaseWrite('deft_weight_history', 'POST', {
            user_id: activeProfileId,
            weigh_date: today,
            weight_lbs: weight
        });

        // 2. Update daily log with today's weight
        const existing = await supabaseSelect('deft_daily_logs', `user_id=eq.${activeProfileId}&log_date=eq.${today}&select=log_id`);
        if (existing && existing.length > 0) {
            await supabaseWrite('deft_daily_logs', 'PATCH', { weight_lbs: weight }, `log_id=eq.${existing[0].log_id}`);
        } else {
            const profile = await supabaseSelect('deft_user_profiles', `user_id=eq.${activeProfileId}&select=macro_targets,meal_count_default`);
            const mt = profile?.[0]?.macro_targets || { calories: 2000, fat_g: 155, protein_g: 130, net_carbs_g: 20 };
            await supabaseWrite('deft_daily_logs', 'POST', {
                user_id: activeProfileId,
                log_date: today,
                weight_lbs: weight,
                target_calories: mt.calories || 2000,
                target_macros: mt,
                consumed_totals: { calories: 0, fat_g: 0, protein_g: 0, net_carbs_g: 0, fiber_g: 0, sugar_g: 0 },
                meal_count_planned: profile?.[0]?.meal_count_default || 3,
            }, '');
        }
        if (historyWrite) saved = true;
    }

    btn.disabled = false;
    btn.textContent = 'Save Weight';

    if (saved) {
        toast(`Weight logged: ${weight} lbs`, 'success');
        closeModal('weighInModal');
    } else {
        toast('Failed to save weight — please try again', 'error');
    }
}

