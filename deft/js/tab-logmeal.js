// ═══════════════════════════════════════
// DEFT — Log Meal Tab
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// LOG MEAL TAB
// ═══════════════════════════════════════
let selectedRecipe = null;
let mealRecommendation = null;
let selectedMealType = 'lunch';
let recipeSearchTimeout = null;

async function searchRecipesForLog(query) {
    if (!query || query.length < 2) {
        document.getElementById('recipeSearchResults').style.display = 'none';
        return;
    }

    // Debounce search
    clearTimeout(recipeSearchTimeout);
    recipeSearchTimeout = setTimeout(async () => {
        const results = await supabaseSelect('deft_recipes',
            `user_id=eq.${activeProfileId}&status=eq.active&name=ilike.*${encodeURIComponent(query)}*&select=recipe_id,name,servings,nutrition_per_serving,keto_analysis&limit=10&order=name`
        );

        const container = document.getElementById('recipeSearchResults');
        if (!results || results.length === 0) {
            container.innerHTML = '<div class="p-3 text-sm" style="color: var(--deft-txt-3);">No recipes found</div>';
            container.style.display = '';
            return;
        }

        container.innerHTML = results.map(r => {
            const n = r.nutrition_per_serving || {};
            return `<button onclick="selectRecipeForLog('${r.recipe_id}')" class="recipe-search-item">
                <span class="font-medium">${r.name}</span>
                <span class="text-xs font-mono" style="color: var(--deft-txt-3);">
                    ${Math.round(n.calories || 0)} cal &middot; ${(n.net_carbs_g || 0).toFixed(1)}g carbs
                </span>
            </button>`;
        }).join('');
        container.style.display = '';
    }, 250);
}

async function selectRecipeForLog(recipeId) {
    const results = await supabaseSelect('deft_recipes', `recipe_id=eq.${recipeId}&select=*`);
    if (!results || results.length === 0) return;

    selectedRecipe = results[0];
    document.getElementById('recipeSearchResults').style.display = 'none';
    document.getElementById('recipeSearchInput').value = selectedRecipe.name;

    // Show selected recipe details, hide empty state
    renderSelectedRecipe();
    document.getElementById('logMealDetails').style.display = '';
    document.getElementById('logMealEmpty').style.display = 'none';

    // Reset recommendation
    mealRecommendation = null;
    document.getElementById('recCard').style.display = 'none';
    document.getElementById('logServings').value = '1.00';
    updateNutritionPreview();
}

function renderSelectedRecipe() {
    if (!selectedRecipe) return;
    const n = selectedRecipe.nutrition_per_serving || {};
    document.getElementById('selectedRecipeName').textContent = selectedRecipe.name;
    document.getElementById('selectedRecipeServings').textContent = `${selectedRecipe.servings} serving(s)`;
    document.getElementById('selectedRecipeCal').textContent = Math.round(n.calories || 0);
    document.getElementById('selectedRecipeFat').textContent = (n.total_fat_g || 0).toFixed(1);
    document.getElementById('selectedRecipeProtein').textContent = (n.protein_g || 0).toFixed(1);
    document.getElementById('selectedRecipeCarbs').textContent = (n.net_carbs_g || 0).toFixed(1);
}

async function getPortionRecommendation() {
    if (!selectedRecipe) return;

    const btn = document.getElementById('getRecBtn');
    btn.disabled = true;
    btn.textContent = 'Calculating...';

    const mealCount = todayMeals.length + 1;
    const totalMeals = dailyLog?.meal_count_planned || 3;

    const result = await deftApi('recommend_portion', {
        recipe_id: selectedRecipe.recipe_id,
        meal_number: mealCount,
        total_meals: totalMeals
    });

    btn.disabled = false;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Get Recommendation</span>';

    if (result && result.data) {
        mealRecommendation = result.data;
        document.getElementById('recCard').style.display = '';
        document.getElementById('recServings').textContent = mealRecommendation.recommended_servings?.toFixed(2) || '1.00';
        document.getElementById('recFactor').textContent = mealRecommendation.limiting_factor || 'calories';

        const wc = mealRecommendation.would_consume || {};
        document.getElementById('recCal').textContent = Math.round(wc.calories || 0);
        document.getElementById('recFat').textContent = (wc.fat_g || 0).toFixed(1);
        document.getElementById('recProtein').textContent = (wc.protein_g || 0).toFixed(1);
        document.getElementById('recCarbs').textContent = (wc.net_carbs_g || 0).toFixed(1);

        // Set servings input
        document.getElementById('logServings').value = mealRecommendation.recommended_servings?.toFixed(2) || '1.00';
        updateNutritionPreview();
    }
}

function updateNutritionPreview() {
    if (!selectedRecipe) return;
    const servings = parseFloat(document.getElementById('logServings').value) || 0;
    const n = selectedRecipe.nutrition_per_serving || {};

    document.getElementById('previewCal').textContent = Math.round((n.calories || 0) * servings);
    document.getElementById('previewFat').textContent = ((n.total_fat_g || 0) * servings).toFixed(1);
    document.getElementById('previewProtein').textContent = ((n.protein_g || 0) * servings).toFixed(1);
    document.getElementById('previewCarbs').textContent = ((n.net_carbs_g || 0) * servings).toFixed(1);
}

function selectMealType(type) {
    selectedMealType = type;
    document.querySelectorAll('.meal-type-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.type === type);
    });
}

async function logMeal() {
    if (!selectedRecipe) { toast('Select a recipe first', 'error'); return; }

    const servings = parseFloat(document.getElementById('logServings').value);
    if (!servings || servings <= 0) { toast('Enter a valid serving amount', 'error'); return; }

    const btn = document.getElementById('logMealBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2">Logging...</span>';

    const result = await deftApi('log_meal', {
        recipe_id: selectedRecipe.recipe_id,
        servings: servings,
        meal_type: selectedMealType,
        meal_number: todayMeals.length + 1
    });

    btn.disabled = false;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2"><svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M6 2.5v7M2.5 6h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Log This Meal</span>';

    if (result) {
        toast(`${selectedRecipe.name} logged!`, 'success');
        // Reset form
        selectedRecipe = null;
        mealRecommendation = null;
        document.getElementById('recipeSearchInput').value = '';
        document.getElementById('logMealDetails').style.display = 'none';
        document.getElementById('logMealEmpty').style.display = '';
        document.getElementById('recCard').style.display = 'none';
        // Refresh today's data
        refreshToday();
    }
}

// ── Quick Log toggle ──
function toggleQuickLog() {
    const body = document.getElementById('quickLogBody');
    const chevron = document.getElementById('quickLogChevron');
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ── Prepared Meals Log ──
let preparedMealsForLog = [];

function togglePreparedMealLog() {
    const body = document.getElementById('preparedMealLogBody');
    const chev = document.getElementById('preparedLogChevron');
    if (body.style.display === 'none') {
        body.style.display = '';
        chev.style.transform = 'rotate(180deg)';
        loadPreparedMealsForLog();
    } else {
        body.style.display = 'none';
        chev.style.transform = '';
    }
}

async function loadPreparedMealsForLog() {
    const data = await supabaseSelect('deft_prepared_meals',
        `user_id=eq.${activeProfileId}&status=eq.available&servings_remaining=gt.0&select=*&order=name`
    );
    preparedMealsForLog = data || [];
    document.getElementById('preparedMealLogCount').textContent = preparedMealsForLog.length;
    if (preparedMealsForLog.length === 0) {
        document.getElementById('preparedMealLogList').innerHTML =
            `<div class="text-center py-4"><p class="text-xs" style="color: var(--deft-txt-3);">No prepared meals available</p><p class="text-xs mt-1"><a href="/pantry" style="color: var(--deft-accent);">Add prepared meals in Pantry</a></p></div>`;
        return;
    }
    document.getElementById('preparedMealLogList').innerHTML = preparedMealsForLog.map(m => {
        const n = m.nutrition_per_serving || {};
        return `<div class="flex items-center justify-between p-3 rounded-lg mb-2" style="background: rgba(255,255,255,0.02); border: 1px solid var(--deft-border);">
            <div>
                <div class="font-heading font-bold text-sm" style="color: var(--deft-txt);">${m.name}</div>
                <div class="text-xs font-mono" style="color: var(--deft-txt-3);">${m.servings_remaining}/${m.total_servings} servings &middot; ${Math.round(n.calories || 0)} cal</div>
            </div>
            <button class="btn btn-primary text-xs" onclick="logPreparedMeal('${m.prepared_id}')">Log 1 Serving</button>
        </div>`;
    }).join('');
}

async function logPreparedMeal(preparedId) {
    const meal = preparedMealsForLog.find(m => m.prepared_id === preparedId);
    if (!meal) return;
    const mealType = selectedMealType || 'lunch';
    const result = await deftApi('consume_prepared', {
        prepared_id: preparedId,
        servings: 1,
        meal_type: mealType,
        meal_number: (todayMeals ? todayMeals.length : 0) + 1
    });
    if (result && result.success !== false) {
        toast(meal.name + ' logged');
        refreshToday();
        loadPreparedMealsForLog();
    } else {
        toast('Failed to log meal', 'error');
    }
}

// ── Food Database search ──
let foodDbTimeout = null;
async function searchFoodDb(query) {
    if (!query || query.length < 2) {
        document.getElementById('foodDbResults').innerHTML = '<div class="text-center text-xs py-4" style="color: var(--deft-txt-3);">Type at least 2 characters to search</div>';
        return;
    }

    clearTimeout(foodDbTimeout);
    foodDbTimeout = setTimeout(async () => {
        const results = await supabaseSelect('deft_food_database',
            `name=ilike.*${encodeURIComponent(query)}*&select=food_id,name,brand,serving_size,nutrition_per_serving&limit=10&order=name`
        );

        const container = document.getElementById('foodDbResults');
        if (!results || results.length === 0) {
            container.innerHTML = '<div class="text-center text-xs py-4" style="color: var(--deft-txt-3);">No foods found</div>';
            return;
        }

        container.innerHTML = results.map(f => {
            const n = f.nutrition_per_serving || {};
            const nJson = JSON.stringify(n).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
            const eName = (f.name || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
            const eBrand = (f.brand || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
            const eServing = (f.serving_size || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
            return `
            <button type="button" class="meal-card" style="width:100%; text-align:left; cursor:pointer;" onclick="selectFoodForQuickLog('${f.food_id}', '${eName}', '${eBrand}', '${eServing}', this)" data-nutrition="${nJson}">
                <div class="flex items-center justify-between mb-1">
                    <span class="font-medium text-sm">${f.name}</span>
                    <span class="text-xs font-mono" style="color: var(--deft-txt-3);">${f.serving_size || ''}</span>
                </div>
                ${f.brand ? `<div class="text-xs mb-1" style="color: var(--deft-txt-2);">${f.brand}</div>` : ''}
                <div class="flex gap-3 text-xs font-mono" style="color: var(--deft-txt-2);">
                    <span>${Math.round(n.calories || 0)} cal</span>
                    <span>${(n.total_fat_g || 0).toFixed(1)}g F</span>
                    <span>${(n.protein_g || 0).toFixed(1)}g P</span>
                    <span>${(n.net_carbs_g || 0).toFixed(1)}g C</span>
                </div>
            </button>`;
        }).join('');
    }, 250);
}

// ── Quick Log from Food Database ──
let selectedQuickFood = null;

function selectFoodForQuickLog(foodId, name, brand, servingSize, btn) {
    const nutrition = JSON.parse(btn.dataset.nutrition || '{}');
    selectedQuickFood = { food_id: foodId, name, brand, serving_size: servingSize, nutrition };

    const container = document.getElementById('quickLogFoodForm');
    const n = nutrition;
    container.innerHTML = `
        <div class="p-3 rounded-lg mt-3" style="background: var(--deft-surface-el); border: 1px solid color-mix(in srgb, var(--deft-accent) 30%, transparent);">
            <div class="flex items-center justify-between mb-1">
                <p class="font-medium text-sm">${name}</p>
                <button type="button" onclick="closeQuickLogForm()" class="p-1 rounded" style="color: var(--deft-txt-3);" title="Close">
                    <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </button>
            </div>
            ${brand ? `<p class="text-xs mb-1" style="color: var(--deft-txt-2);">${brand}</p>` : ''}
            <p class="text-xs mb-3" style="color: var(--deft-txt-3);">Serving: ${servingSize || 'N/A'}</p>
            <div class="flex gap-2 items-end mb-3">
                <div class="flex-1">
                    <label class="form-label">Servings</label>
                    <input type="number" id="quickLogServings" class="form-input text-sm" value="1" step="0.25" min="0.25" oninput="updateQuickLogPreview()">
                </div>
                <div class="flex-1">
                    <label class="form-label">Meal Type</label>
                    <select id="quickLogMealType" class="form-input text-sm">
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="dinner">Dinner</option>
                        <option value="snack">Snack</option>
                    </select>
                </div>
            </div>
            <div class="flex gap-3 text-xs font-mono mb-3" style="color: var(--deft-txt-2);" id="quickLogNutritionPreview">
                <span>${Math.round(n.calories || 0)} cal</span>
                <span>${(n.total_fat_g || 0).toFixed(1)}g F</span>
                <span>${(n.protein_g || 0).toFixed(1)}g P</span>
                <span>${(n.net_carbs_g || 0).toFixed(1)}g C</span>
            </div>
            <button class="btn btn-primary w-full" onclick="confirmQuickLogFood()">Log This Food</button>
        </div>`;
    container.style.display = '';
}

function updateQuickLogPreview() {
    if (!selectedQuickFood) return;
    const servings = parseFloat(document.getElementById('quickLogServings').value) || 1;
    const n = selectedQuickFood.nutrition;
    document.getElementById('quickLogNutritionPreview').innerHTML = `
        <span>${Math.round((n.calories || 0) * servings)} cal</span>
        <span>${((n.total_fat_g || 0) * servings).toFixed(1)}g F</span>
        <span>${((n.protein_g || 0) * servings).toFixed(1)}g P</span>
        <span>${((n.net_carbs_g || 0) * servings).toFixed(1)}g C</span>`;
}

function closeQuickLogForm() {
    selectedQuickFood = null;
    document.getElementById('quickLogFoodForm').style.display = 'none';
}

async function confirmQuickLogFood() {
    if (!selectedQuickFood || !activeProfileId) return;
    const servings = parseFloat(document.getElementById('quickLogServings').value) || 1;
    const mealType = document.getElementById('quickLogMealType').value;
    const n = selectedQuickFood.nutrition;

    const nutritionConsumed = {
        calories: Math.round((n.calories || 0) * servings),
        total_fat_g: +((n.total_fat_g || 0) * servings).toFixed(1),
        protein_g: +((n.protein_g || 0) * servings).toFixed(1),
        total_carbs_g: +((n.total_carbs_g || 0) * servings).toFixed(1),
        fiber_g: +((n.fiber_g || 0) * servings).toFixed(1),
        net_carbs_g: +((n.net_carbs_g || 0) * servings).toFixed(1),
    };

    // Try bridge first
    let result = await deftApi('log_meal', {
        food_id: selectedQuickFood.food_id,
        food_name: selectedQuickFood.name,
        servings, meal_type: mealType,
        meal_number: todayMeals.length + 1,
        nutrition_consumed: nutritionConsumed
    }, { silent: true });

    if (!result) {
        // Direct Supabase fallback
        result = await supabaseWrite('deft_meal_entries', 'POST', {
            user_id: activeProfileId,
            food_id: selectedQuickFood.food_id,
            recipe_name: selectedQuickFood.name,
            servings,
            meal_type: mealType,
            nutrition_consumed: nutritionConsumed,
            logged_at: new Date().toISOString(),
            meal_number: todayMeals.length + 1
        });
    }

    toast(`${selectedQuickFood.name} logged!`, 'success');
    closeQuickLogForm();
    document.getElementById('foodDbSearch').value = '';
    document.getElementById('foodDbResults').innerHTML = '<div class="text-center text-xs py-4" style="color: var(--deft-txt-3);">Type at least 2 characters to search</div>';
    refreshToday();
}

// Close recipe search dropdown on outside click
document.addEventListener('click', (e) => {
    const searchResults = document.getElementById('recipeSearchResults');
    const searchInput = document.getElementById('recipeSearchInput');
    if (searchResults && searchInput && !searchResults.contains(e.target) && e.target !== searchInput) {
        searchResults.style.display = 'none';
    }
});


// ═══════════════════════════════════════
// AI FEATURES (suggest_meals, analyze_nutrition, weekly_report)
// ═══════════════════════════════════════

async function openAiMealSuggestions() {
    const panel = document.getElementById('aiSuggestPanel');
    const content = document.getElementById('aiSuggestContent');
    panel.style.display = '';

    content.innerHTML = `<div class="empty-state ai-loading">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A882D6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg>
        <p style="color: #A882D6;">Generating meal suggestions...</p>
        <p class="text-xs mt-1" style="color: var(--deft-txt-3);">Based on your remaining macros and preferences</p>
    </div>`;

    const result = await deftApi('suggest_meals', { use_existing_recipes: true });
    if (!result || !result.data) {
        content.innerHTML = `<div class="empty-state"><p>Unable to generate suggestions right now</p><p class="text-xs mt-1" style="color: var(--deft-txt-3);">Check your profile settings and try again</p></div>`;
        return;
    }

    const suggestions = result.data.suggestions || result.data.meals || (Array.isArray(result.data) ? result.data : [result.data]);
    if (!suggestions.length) {
        content.innerHTML = `<div class="empty-state"><p>No suggestions available</p><p class="text-xs mt-1" style="color: var(--deft-txt-3);">Log more meals to improve suggestions</p></div>`;
        return;
    }

    content.innerHTML = suggestions.map((s, i) => {
        const name = esc(s.name || s.meal_name || s.recipe_name || `Suggestion ${i+1}`);
        const desc = esc(s.description || s.reason || '');
        const cal = s.calories || s.estimated_calories || '—';
        const protein = s.protein || s.estimated_protein || '—';
        const fat = s.fat || s.estimated_fat || '—';
        const carbs = s.net_carbs || s.carbs || s.estimated_carbs || '—';
        return `<div class="ai-card mb-3">
            <div class="ai-card-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A882D6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg>
                <span class="ai-card-title">${name}</span>
            </div>
            ${desc ? `<p class="text-xs mb-2" style="color: var(--deft-txt-2);">${desc}</p>` : ''}
            <div class="ai-macro-grid">
                <div class="ai-macro-item"><div class="label">Cal</div><div class="value">${cal}</div></div>
                <div class="ai-macro-item"><div class="label">Protein</div><div class="value">${protein}g</div></div>
                <div class="ai-macro-item"><div class="label">Fat</div><div class="value">${fat}g</div></div>
                <div class="ai-macro-item"><div class="label">Carbs</div><div class="value">${carbs}g</div></div>
            </div>
            ${s.recipe_id ? `<button class="ai-suggestion-btn mt-3 w-full text-center" onclick="logSuggestedMeal('${esc(s.recipe_id)}', '${esc(name)}')">Log This Meal</button>` : ''}
        </div>`;
    }).join('');

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function openWhatCanIMake() {
    const panel = document.getElementById('aiSuggestPanel');
    const content = document.getElementById('aiSuggestContent');
    panel.style.display = '';
    content.innerHTML = `<div class="empty-state ai-loading">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--deft-accent-warm)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        <p style="color: var(--deft-accent-warm);">Checking your pantry...</p>
        <p class="text-xs mt-1" style="color: var(--deft-txt-3);">Finding meals you can make with what you have</p>
    </div>`;

    const result = await deftApi('what_can_i_make', {});
    if (!result || !result.data) {
        content.innerHTML = `<div class="empty-state"><p>Unable to check pantry right now</p><p class="text-xs mt-1" style="color: var(--deft-txt-3);"><a href="/pantry" style="color: var(--deft-accent);">Add items to your pantry first</a></p></div>`;
        return;
    }
    const suggestions = result.data.suggestions || [];
    if (!suggestions.length) {
        content.innerHTML = `<div class="empty-state"><p>No meals found from your current pantry</p><p class="text-xs mt-1" style="color: var(--deft-txt-3);"><a href="/pantry" style="color: var(--deft-accent);">Stock up your pantry</a></p></div>`;
        return;
    }
    const typeLabels = { prepared: 'Ready to Eat', pantry_combo: 'From Pantry', recipe: 'Recipe' };
    const typeColors = { prepared: '#06D6A0', pantry_combo: 'var(--deft-accent-warm)', recipe: '#A882D6' };
    content.innerHTML = suggestions.map((s, i) => {
        const name = esc(s.name || `Suggestion ${i+1}`);
        const desc = esc(s.description || s.notes || '');
        const n = s.estimated_nutrition || s;
        const cal = n.calories || s.calories || '?';
        const protein = n.protein_g || s.protein || '?';
        const fat = n.fat_g || s.fat || '?';
        const carbs = n.net_carbs_g || s.net_carbs || '?';
        const type = s.type || 'general';
        const badge = typeLabels[type] || type;
        const badgeColor = typeColors[type] || 'var(--deft-txt-3)';
        return `<div class="ai-card mb-3">
            <div class="ai-card-header">
                <span class="text-xs px-2 py-0.5 rounded-full font-mono" style="background: ${badgeColor}20; color: ${badgeColor};">${badge}</span>
                <span class="ai-card-title">${name}</span>
            </div>
            ${desc ? `<p class="text-xs mb-2" style="color: var(--deft-txt-2);">${desc}</p>` : ''}
            <div class="ai-macro-grid">
                <div class="ai-macro-item"><div class="label">Cal</div><div class="value">${cal}</div></div>
                <div class="ai-macro-item"><div class="label">Protein</div><div class="value">${protein}g</div></div>
                <div class="ai-macro-item"><div class="label">Fat</div><div class="value">${fat}g</div></div>
                <div class="ai-macro-item"><div class="label">Carbs</div><div class="value">${carbs}g</div></div>
            </div>
        </div>`;
    }).join('');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAiSuggestions() {
    document.getElementById('aiSuggestPanel').style.display = 'none';
}

async function logSuggestedMeal(recipeId, name) {
    const result = await deftApi('log_meal', { recipe_id: recipeId, servings: 1, meal_type: 'meal' });
    if (result) {
        toast(`Logged: ${name}`, 'success');
        refreshToday();
    }
}

async function analyzeNutrition() {
    const input = document.getElementById('analyzeInput');
    const btn = document.getElementById('analyzeBtn');
    const resultDiv = document.getElementById('analyzeResult');
    const text = input.value.trim();

    if (!text) { toast('Please describe a food or meal to analyze', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2 ai-loading"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg> Analyzing...</span>';
    resultDiv.style.display = 'none';

    // Direct fetch to capture backend error details (deftApi swallows errors)
    let result = null;
    let backendError = null;
    try {
        const res = await fetch(DEFT_BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operation: 'analyze_nutrition', user_id: activeProfileId, data: { food_description: text } })
        });
        const raw = await res.text();
        if (raw) {
            try { result = JSON.parse(raw); } catch(e) { backendError = 'Invalid response from server'; }
            if (result && result.success === false) {
                backendError = result.error || 'Backend analysis failed';
                result = null;
            }
        } else {
            backendError = 'Empty response from server';
        }
    } catch (err) {
        backendError = 'Connection error: ' + err.message;
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg> Analyze Nutrition</span>';

    if (!result || !result.data) {
        resultDiv.style.display = 'block';
        const errMsg = backendError || 'Unable to analyze. Try a more specific description.';
        resultDiv.innerHTML = `<div class="ai-card"><p class="text-xs" style="color: var(--deft-danger);">${esc(errMsg)}</p></div>`;
        return;
    }

    const d = result.data;
    const foodName = esc(d.food_name || d.name || text);
    const cal = d.calories || d.estimated_calories || '—';
    const protein = d.protein || '—';
    const fat = d.fat || d.total_fat || '—';
    const carbs = d.net_carbs || d.carbs || '—';
    const fiber = d.fiber || '—';
    const servingSize = d.serving_size || d.portion || '';
    const ketoTier = d.keto_tier || d.keto_rating || '';
    const notes = d.notes || d.analysis || '';

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<div class="ai-card">
        <div class="ai-card-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A882D6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <span class="ai-card-title">${foodName}</span>
            ${ketoTier ? `<span class="badge badge-${ketoTier.toLowerCase() === 'excellent' ? 'excellent' : ketoTier.toLowerCase() === 'good' ? 'good' : ketoTier.toLowerCase() === 'moderate' ? 'moderate' : 'avoid'}">${esc(ketoTier)}</span>` : ''}
        </div>
        ${servingSize ? `<p class="text-xs mb-2" style="color: var(--deft-txt-3);">Serving: ${esc(servingSize)}</p>` : ''}
        <div class="ai-macro-grid">
            <div class="ai-macro-item"><div class="label">Cal</div><div class="value">${cal}</div></div>
            <div class="ai-macro-item"><div class="label">Protein</div><div class="value">${protein}g</div></div>
            <div class="ai-macro-item"><div class="label">Fat</div><div class="value">${fat}g</div></div>
            <div class="ai-macro-item"><div class="label">Net Carbs</div><div class="value">${carbs}g</div></div>
        </div>
        ${fiber !== '—' ? `<p class="text-xs mt-2" style="color: var(--deft-txt-3);">Fiber: ${fiber}g</p>` : ''}
        ${notes ? `<p class="text-xs mt-2" style="color: var(--deft-txt-2);">${esc(notes)}</p>` : ''}
    </div>`;
}

async function loadWeeklyReport() {
    const btn = document.getElementById('weeklyReportBtn');
    const content = document.getElementById('weeklyReportContent');

    btn.disabled = true;
    btn.innerHTML = '<span class="flex items-center gap-1.5 ai-loading"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg> Generating...</span>';
    content.innerHTML = `<div class="empty-state ai-loading"><p style="color: #A882D6;">Analyzing your week...</p><p class="text-xs mt-1" style="color: var(--deft-txt-3);">This may take a few seconds</p></div>`;

    const result = await deftApi('weekly_report', {});

    btn.disabled = false;
    btn.innerHTML = '<span class="flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg> Generate</span>';

    if (!result || !result.data) {
        content.innerHTML = `<div class="empty-state"><p>Unable to generate report</p><p class="text-xs mt-1" style="color: var(--deft-txt-3);">Log more meals and activities this week to get insights</p></div>`;
        return;
    }

    const d = result.data;
    const report = d.report || d.summary || d.text || '';
    const highlights = d.highlights || d.key_findings || [];
    const recommendations = d.recommendations || d.tips || [];
    const stats = d.stats || d.weekly_stats || {};

    let html = '';

    if (stats && Object.keys(stats).length) {
        html += `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">`;
        const statEntries = [
            { label: 'Avg Calories', value: stats.avg_calories || stats.average_calories },
            { label: 'Avg Protein', value: stats.avg_protein ? stats.avg_protein + 'g' : null },
            { label: 'Avg Carbs', value: stats.avg_carbs || stats.avg_net_carbs ? (stats.avg_carbs || stats.avg_net_carbs) + 'g' : null },
            { label: 'Days Logged', value: stats.days_logged || stats.total_days },
        ].filter(s => s.value != null);
        statEntries.forEach(s => {
            html += `<div class="ai-macro-item"><div class="label">${s.label}</div><div class="value">${s.value}</div></div>`;
        });
        html += `</div>`;
    }

    if (report) {
        const formatted = esc(report).replace(/\n/g, '<br>');
        html += `<div class="text-sm mb-3" style="color: var(--deft-txt); line-height: 1.7;">${formatted}</div>`;
    }

    if (highlights.length) {
        html += `<div class="mb-3"><p class="font-heading font-bold text-xs uppercase tracking-wide mb-2" style="color: #A882D6;">Highlights</p>`;
        highlights.forEach(h => {
            html += `<div class="flex items-start gap-2 mb-1.5"><span style="color: var(--deft-success); flex-shrink: 0;">&#x2713;</span><span class="text-xs" style="color: var(--deft-txt-2);">${esc(typeof h === 'string' ? h : h.text || h.description || '')}</span></div>`;
        });
        html += `</div>`;
    }

    if (recommendations.length) {
        html += `<div><p class="font-heading font-bold text-xs uppercase tracking-wide mb-2" style="color: var(--deft-accent-warm);">Recommendations</p>`;
        recommendations.forEach(r => {
            html += `<div class="flex items-start gap-2 mb-1.5"><span style="color: var(--deft-accent-warm); flex-shrink: 0;">&#x279C;</span><span class="text-xs" style="color: var(--deft-txt-2);">${esc(typeof r === 'string' ? r : r.text || r.description || '')}</span></div>`;
        });
        html += `</div>`;
    }

    if (!html) {
        html = `<div class="text-sm" style="color: var(--deft-txt-2); line-height: 1.7;">${esc(JSON.stringify(d, null, 2).substring(0, 1000))}</div>`;
    }

    content.innerHTML = `<div class="ai-card">${html}</div>`;
}

