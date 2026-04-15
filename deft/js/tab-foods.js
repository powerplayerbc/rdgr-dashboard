// ═══════════════════════════════════════
// DEFT — Foods Tab
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// FOOD SELECTION & COMPARISON STATE
// ═══════════════════════════════════════
let selectedFoodIds = new Set();
let compareRecipeIds = new Set();
let selectedFoodCache = new Map();  // preserves food objects when allFoods changes on search/filter

// ═══════════════════════════════════════
// FOOD DATABASE BROWSER
// ═══════════════════════════════════════
let allFoods = [];
let foodBrowserLoaded = false;
let foodSearchQuery = '';
let foodCategory = 'all';
let foodOffset = 0;
let editingFoodId = null;
const FOOD_LIMIT = 50;

async function loadFoodBrowser() {
    if (foodBrowserLoaded && foodSearchQuery === '' && foodCategory === 'all') return;
    foodOffset = 0;
    await fetchFoods();
}

async function fetchFoods(append = false) {
    let query = `select=food_id,name,brand,serving_size,nutrition_per_serving,category,is_keto_friendly,keto_tier&order=name&limit=${FOOD_LIMIT}&offset=${foodOffset}`;

    if (foodSearchQuery) {
        query += `&name=ilike.*${encodeURIComponent(foodSearchQuery)}*`;
    }
    if (foodCategory !== 'all') {
        query += `&category=eq.${foodCategory}`;
    }
    if (document.getElementById('ketoOnlyToggle')?.checked) {
        query += `&is_keto_friendly=eq.true`;
    }

    const results = await supabaseSelect('deft_food_database', query);

    if (append) {
        allFoods = allFoods.concat(results || []);
    } else {
        allFoods = results || [];
    }

    foodBrowserLoaded = true;
    renderFoodTable();

    // Show/hide load more
    const loadMore = document.getElementById('foodLoadMore');
    if (loadMore) {
        loadMore.style.display = (results && results.length === FOOD_LIMIT) ? '' : 'none';
    }
}

function renderFoodTable() {
    const tbody = document.getElementById('foodTableBody');
    document.getElementById('foodCount').textContent = `${allFoods.length} food${allFoods.length !== 1 ? 's' : ''}`;

    if (allFoods.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center" style="color: var(--deft-txt-3);">No foods found${foodSearchQuery ? ' — try a different search' : ''}</td></tr>`;
        return;
    }

    tbody.innerHTML = allFoods.map(f => {
        const n = f.nutrition_per_serving || {};
        const tierColors = {
            excellent: 'var(--deft-success)',
            good: 'var(--deft-accent)',
            moderate: 'var(--deft-warning)',
            avoid: 'var(--deft-danger)'
        };
        const tierColor = tierColors[f.keto_tier] || 'var(--deft-txt-3)';
        const isChecked = selectedFoodIds.has(f.food_id);

        return `<tr style="border-bottom: 1px solid var(--deft-border); transition: background 0.15s;" onmouseenter="this.style.background='rgba(255,255,255,0.02)'" onmouseleave="this.style.background='transparent'">
            <td class="py-2.5 px-2 text-center">
                <input type="checkbox" class="food-select-cb" data-food-id="${f.food_id}" onchange="toggleFoodSelection('${f.food_id}')" ${isChecked ? 'checked' : ''} style="accent-color: var(--deft-accent);">
            </td>
            <td class="py-2.5 px-3">
                <div class="font-medium text-sm" style="color: var(--deft-txt);">${f.name}</div>
                ${f.brand ? `<div class="text-xs" style="color: var(--deft-txt-3);">${f.brand}</div>` : ''}
            </td>
            <td class="py-2.5 px-3 text-xs font-mono" style="color: var(--deft-txt-2);">${f.serving_size || '—'}</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs" style="color: var(--deft-txt);">${Math.round(n.calories || 0)}</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs" style="color: var(--deft-txt-2);">${(n.total_fat_g || 0).toFixed(1)}g</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs" style="color: var(--deft-txt-2);">${(n.protein_g || 0).toFixed(1)}g</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs font-bold" style="color: var(--deft-accent);">${(n.net_carbs_g || 0).toFixed(1)}g</td>
            <td class="py-2.5 px-3 text-right font-mono text-xs" style="color: var(--deft-txt-2);">${(n.fiber_g || 0).toFixed(1)}g</td>
            <td class="py-2.5 px-3 text-center">
                ${f.keto_tier ? `<span class="badge" style="background: ${tierColor}20; color: ${tierColor}; border: 1px solid ${tierColor}30;">${f.keto_tier}</span>` : '—'}
            </td>
            <td class="py-2.5 px-2 text-center">
                <button onclick="editFood('${f.food_id}')" class="btn btn-ghost text-xs py-1 px-2" title="Edit food" style="color:var(--deft-txt-3);">&#9998;</button>
            </td>
        </tr>`;
    }).join('');

    // Sync "select all" checkbox state
    syncSelectAllCheckbox();
}

function syncSelectAllCheckbox() {
    const selectAllCb = document.getElementById('foodSelectAll');
    if (!selectAllCb) return;
    const visibleIds = allFoods.map(f => f.food_id);
    if (visibleIds.length === 0) {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = false;
        return;
    }
    const selectedCount = visibleIds.filter(id => selectedFoodIds.has(id)).length;
    if (selectedCount === 0) {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = false;
    } else if (selectedCount === visibleIds.length) {
        selectAllCb.checked = true;
        selectAllCb.indeterminate = false;
    } else {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = true;
    }
}

// ═══════════════════════════════════════
// FOOD SELECTION FUNCTIONS
// ═══════════════════════════════════════

function toggleFoodSelection(foodId) {
    if (selectedFoodIds.has(foodId)) {
        selectedFoodIds.delete(foodId);
        selectedFoodCache.delete(foodId);
    } else {
        selectedFoodIds.add(foodId);
        // Cache the food object so it persists across search/filter changes
        const food = allFoods.find(f => f.food_id === foodId);
        if (food) selectedFoodCache.set(foodId, food);
    }
    syncSelectAllCheckbox();
    updateSelectionUI();
}

function toggleAllFoodSelection(checked) {
    if (checked) {
        allFoods.forEach(f => {
            selectedFoodIds.add(f.food_id);
            selectedFoodCache.set(f.food_id, f);
        });
    } else {
        // Only clear the currently visible foods
        allFoods.forEach(f => {
            selectedFoodIds.delete(f.food_id);
            selectedFoodCache.delete(f.food_id);
        });
    }
    // Update all visible checkboxes
    document.querySelectorAll('.food-select-cb').forEach(cb => {
        cb.checked = checked;
    });
    updateSelectionUI();
}

function clearFoodSelection() {
    selectedFoodIds.clear();
    compareRecipeIds.clear();
    selectedFoodCache.clear();
    document.querySelectorAll('.food-select-cb').forEach(cb => { cb.checked = false; });
    const selectAllCb = document.getElementById('foodSelectAll');
    if (selectAllCb) { selectAllCb.checked = false; selectAllCb.indeterminate = false; }
    updateSelectionUI();
}

function updateSelectionUI() {
    const count = selectedFoodIds.size + compareRecipeIds.size;
    const bar = document.getElementById('foodSelectionBar');
    const countEl = document.getElementById('selectedFoodCount');

    if (bar) bar.style.display = count > 0 ? '' : 'none';
    if (countEl) countEl.textContent = count;

    // If macro compare panel is visible, re-render it
    const panel = document.getElementById('macroComparePanel');
    if (panel && panel.style.display !== 'none') {
        renderMacroComparison();
    }
}

// ═══════════════════════════════════════
// MACRO COMPARISON PANEL
// ═══════════════════════════════════════

function showMacroComparison() {
    const panel = document.getElementById('macroComparePanel');
    if (!panel) return;
    panel.style.display = '';
    const body = panel.querySelector('.panel-body');
    if (body) body.style.display = '';
    const chevron = document.getElementById('compareChevron');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    renderMacroComparison();
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleMacroComparePanel() {
    const body = document.querySelector('#macroComparePanel .panel-body');
    const chevron = document.getElementById('compareChevron');
    if (!body) return;
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? '' : 'none';
    if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
}

function renderMacroComparison() {
    const listEl = document.getElementById('compareSelectedList');
    const totalsEl = document.getElementById('compareCombinedTotals');
    const barsEl = document.getElementById('deficiencyBars');
    const noteEl = document.getElementById('deficiencyNote');
    if (!listEl || !totalsEl || !barsEl || !noteEl) return;

    // Build items from selected foods + recipes
    const items = [];

    selectedFoodIds.forEach(foodId => {
        const food = selectedFoodCache.get(foodId) || allFoods.find(f => f.food_id === foodId);
        if (food) {
            items.push({ type: 'food', id: food.food_id, name: food.name, brand: food.brand, nutrition: food.nutrition_per_serving || {} });
        }
    });

    compareRecipeIds.forEach(recipeId => {
        const recipe = (typeof allRecipes !== 'undefined' ? allRecipes : []).find(r => r.recipe_id === recipeId);
        if (recipe) {
            items.push({ type: 'recipe', id: recipe.recipe_id, name: recipe.name, nutrition: recipe.nutrition_per_serving || {} });
        }
    });

    if (items.length === 0) {
        listEl.innerHTML = `<div class="py-4 text-center text-xs" style="color: var(--deft-txt-3);">No items selected. Check foods in the table above or add recipes below.</div>`;
        totalsEl.innerHTML = '';
        barsEl.innerHTML = '';
        noteEl.textContent = '';
        return;
    }

    // Render item cards
    listEl.innerHTML = items.map(item => {
        const n = item.nutrition;
        const servingsInputId = `compare-servings-${item.type}-${item.id}`;
        const existingInput = document.getElementById(servingsInputId);
        const currentServings = existingInput ? existingInput.value : '1';
        return `<div class="compare-item">
            <div class="flex-1 min-w-0 mr-3">
                <div class="text-sm font-medium truncate" style="color: var(--deft-txt);">${item.name}</div>
                <div class="text-xs font-mono mt-0.5" style="color: var(--deft-txt-3);">
                    ${Math.round(n.calories || 0)} cal &middot; ${(n.total_fat_g || 0).toFixed(1)}g F &middot; ${(n.protein_g || 0).toFixed(1)}g P &middot; ${(n.net_carbs_g || 0).toFixed(1)}g NC
                    ${item.brand ? `<span class="ml-1" style="color:var(--deft-txt-3);">(${item.brand})</span>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <label class="text-xs" style="color: var(--deft-txt-3);">Srv:</label>
                <input type="number" id="${servingsInputId}" class="servings-input" value="${currentServings}" min="0.25" max="20" step="0.25" onchange="updateCompareServings()">
                <button onclick="removeFromComparison('${item.type}','${item.id}')" class="btn btn-ghost text-xs py-0.5 px-1.5" style="color: var(--deft-danger);" title="Remove">&times;</button>
            </div>
        </div>`;
    }).join('');

    // Compute combined nutrition (item nutrition * servings)
    const combined = { calories: 0, fat_g: 0, protein_g: 0, net_carbs_g: 0, fiber_g: 0 };
    items.forEach(item => {
        const n = item.nutrition;
        const servingsInputId = `compare-servings-${item.type}-${item.id}`;
        const inputEl = document.getElementById(servingsInputId);
        const servings = inputEl ? parseFloat(inputEl.value) || 1 : 1;
        combined.calories += (n.calories || 0) * servings;
        combined.fat_g += (n.total_fat_g || 0) * servings;
        combined.protein_g += (n.protein_g || 0) * servings;
        combined.net_carbs_g += (n.net_carbs_g || 0) * servings;
        combined.fiber_g += (n.fiber_g || 0) * servings;
    });

    // Combined totals display
    totalsEl.innerHTML = `
        <div class="grid grid-cols-5 gap-2 text-center">
            <div>
                <div class="text-xs font-heading font-bold uppercase" style="color: var(--deft-txt-3);">Cal</div>
                <div class="text-sm font-mono font-bold" style="color: var(--deft-txt);">${Math.round(combined.calories)}</div>
            </div>
            <div>
                <div class="text-xs font-heading font-bold uppercase" style="color: var(--deft-txt-3);">Fat</div>
                <div class="text-sm font-mono font-bold" style="color: var(--deft-txt);">${combined.fat_g.toFixed(1)}g</div>
            </div>
            <div>
                <div class="text-xs font-heading font-bold uppercase" style="color: var(--deft-txt-3);">Protein</div>
                <div class="text-sm font-mono font-bold" style="color: var(--deft-txt);">${combined.protein_g.toFixed(1)}g</div>
            </div>
            <div>
                <div class="text-xs font-heading font-bold uppercase" style="color: var(--deft-txt-3);">Net Carbs</div>
                <div class="text-sm font-mono font-bold" style="color: var(--deft-accent);">${combined.net_carbs_g.toFixed(1)}g</div>
            </div>
            <div>
                <div class="text-xs font-heading font-bold uppercase" style="color: var(--deft-txt-3);">Fiber</div>
                <div class="text-sm font-mono font-bold" style="color: var(--deft-txt);">${combined.fiber_g.toFixed(1)}g</div>
            </div>
        </div>`;

    // Compute daily targets & consumed
    const targets = dailyLog?.target_macros || { calories: 2000, fat_g: 155, protein_g: 130, net_carbs_g: 20 };
    const consumed = todayMeals.length > 0
        ? calcConsumedFromMeals(todayMeals)
        : (dailyLog?.consumed_totals || { calories: 0, fat_g: 0, protein_g: 0, net_carbs_g: 0, fiber_g: 0, sugar_g: 0 });

    // Deficiency = max(0, target - consumed)
    const macros = [
        { key: 'calories', label: 'Calories', target: targets.calories, consumed: consumed.calories || 0, combined: combined.calories, unit: '', isCarb: false },
        { key: 'fat_g', label: 'Fat', target: targets.fat_g, consumed: consumed.fat_g || 0, combined: combined.fat_g, unit: 'g', isCarb: false },
        { key: 'protein_g', label: 'Protein', target: targets.protein_g, consumed: consumed.protein_g || 0, combined: combined.protein_g, unit: 'g', isCarb: false },
        { key: 'net_carbs_g', label: 'Net Carbs', target: targets.net_carbs_g, consumed: consumed.net_carbs_g || 0, combined: combined.net_carbs_g, unit: 'g', isCarb: true }
    ];

    barsEl.innerHTML = macros.map(m => {
        const deficiency = Math.max(0, m.target - m.consumed);
        const pct = deficiency > 0 ? (m.combined / deficiency) * 100 : (m.combined > 0 ? 999 : 0);
        const barWidth = Math.min(pct, 100);

        let color;
        if (m.isCarb && pct > 100) {
            color = 'var(--deft-danger)';
        } else if (pct > 100) {
            color = 'var(--deft-danger)';
        } else if (pct >= 80) {
            color = 'var(--deft-success)';
        } else {
            color = 'var(--deft-accent)';
        }

        const combinedVal = m.unit ? m.combined.toFixed(1) + m.unit : Math.round(m.combined);
        const deficiencyVal = m.unit ? deficiency.toFixed(1) + m.unit : Math.round(deficiency);
        const pctDisplay = deficiency > 0 ? Math.round(pct) + '%' : (m.combined > 0 ? 'over' : '--');

        return `<div class="mb-3">
            <div class="flex justify-between text-xs mb-1">
                <span style="color: var(--deft-txt-2);">${m.label} <span class="font-mono" style="color:var(--deft-txt-3);">(${pctDisplay})</span></span>
                <span class="font-mono" style="color: var(--deft-txt-3);">${combinedVal} / ${deficiencyVal} remaining</span>
            </div>
            <div class="deficiency-bar-track">
                <div class="deficiency-bar-fill" style="width: ${barWidth}%; background: ${color};"></div>
            </div>
        </div>`;
    }).join('');

    // Note
    const allMet = macros.every(m => {
        const def = Math.max(0, m.target - m.consumed);
        return def === 0 || m.combined >= def;
    });
    const carbsOver = (() => {
        const carbMacro = macros.find(m => m.isCarb);
        if (!carbMacro) return false;
        const def = Math.max(0, carbMacro.target - carbMacro.consumed);
        return carbMacro.combined > def && def > 0;
    })();

    if (carbsOver) {
        noteEl.textContent = 'Warning: this combination exceeds your remaining net carb budget.';
        noteEl.style.color = 'var(--deft-danger)';
    } else if (allMet) {
        noteEl.textContent = 'This combination meets or exceeds all remaining macro targets.';
        noteEl.style.color = 'var(--deft-success)';
    } else {
        noteEl.textContent = 'Bars show how much of your remaining daily target this selection covers.';
        noteEl.style.color = 'var(--deft-txt-3)';
    }
}

function removeFromComparison(type, id) {
    if (type === 'food') {
        selectedFoodIds.delete(id);
        selectedFoodCache.delete(id);
        // Uncheck the checkbox if visible
        const cb = document.querySelector(`.food-select-cb[data-food-id="${id}"]`);
        if (cb) cb.checked = false;
        syncSelectAllCheckbox();
    } else if (type === 'recipe') {
        compareRecipeIds.delete(id);
    }
    updateSelectionUI();
}

function updateCompareServings() {
    renderMacroComparison();
}

// ═══════════════════════════════════════
// RECIPE SEARCH FOR COMPARISON
// ═══════════════════════════════════════

let compareRecipeSearchTimeout;
function searchRecipesForCompare(query) {
    clearTimeout(compareRecipeSearchTimeout);
    const resultsEl = document.getElementById('compareRecipeResults');
    if (!resultsEl) return;

    if (!query || query.length < 2) {
        resultsEl.style.display = 'none';
        resultsEl.innerHTML = '';
        return;
    }

    compareRecipeSearchTimeout = setTimeout(() => {
        const recipes = (typeof allRecipes !== 'undefined' ? allRecipes : []);
        const q = query.toLowerCase();
        const matches = recipes.filter(r =>
            r.name.toLowerCase().includes(q) && !compareRecipeIds.has(r.recipe_id)
        ).slice(0, 8);

        if (matches.length === 0) {
            resultsEl.innerHTML = `<div class="px-3 py-2 text-xs" style="color: var(--deft-txt-3);">No recipes found</div>`;
        } else {
            resultsEl.innerHTML = matches.map(r => {
                const n = r.nutrition_per_serving || {};
                return `<div class="px-3 py-2 cursor-pointer text-sm hover:bg-white/5 transition-colors" onclick="addRecipeToComparison('${r.recipe_id}')" style="border-bottom: 1px solid var(--deft-border);">
                    <div style="color: var(--deft-txt);">${r.name}</div>
                    <div class="text-xs font-mono mt-0.5" style="color: var(--deft-txt-3);">
                        ${Math.round(n.calories || 0)} cal &middot; ${(n.total_fat_g || 0).toFixed(1)}g F &middot; ${(n.protein_g || 0).toFixed(1)}g P &middot; ${(n.net_carbs_g || 0).toFixed(1)}g NC
                    </div>
                </div>`;
            }).join('');
        }
        resultsEl.style.display = '';
    }, 200);
}

function addRecipeToComparison(recipeId) {
    compareRecipeIds.add(recipeId);
    const searchInput = document.getElementById('compareRecipeSearch');
    const resultsEl = document.getElementById('compareRecipeResults');
    if (searchInput) searchInput.value = '';
    if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
    updateSelectionUI();
}

// ═══════════════════════════════════════
// FOOD SEARCH & FILTER
// ═══════════════════════════════════════

let foodSearchTimeout;
function searchFoodBrowser(query) {
    foodSearchQuery = query;
    clearTimeout(foodSearchTimeout);
    foodSearchTimeout = setTimeout(() => {
        foodOffset = 0;
        fetchFoods();
    }, 300);
}

function filterFoodCategory(cat) {
    foodCategory = cat;
    document.querySelectorAll('#view-foods .recipe-filter').forEach(f => {
        f.classList.toggle('active', f.dataset.cat === cat);
    });
    foodOffset = 0;
    fetchFoods();
}

function loadMoreFoods() {
    foodOffset += FOOD_LIMIT;
    fetchFoods(true);
}

// ═══════════════════════════════════════
// FOOD EDIT / ADD
// ═══════════════════════════════════════

function editFood(foodId) {
    const food = allFoods.find(f => f.food_id === foodId);
    if (!food) { toast('Food not found', 'error'); return; }
    editingFoodId = foodId;

    document.getElementById('newFoodName').value = food.name || '';
    document.getElementById('newFoodBrand').value = food.brand || '';
    document.getElementById('newFoodServing').value = food.serving_size || '';
    document.getElementById('newFoodCategory').value = food.category || 'protein';
    document.getElementById('newFoodKetoTier').value = food.keto_tier || 'good';

    const n = food.nutrition_per_serving || {};
    document.getElementById('newFoodCal').value = n.calories || '';
    document.getElementById('newFoodFat').value = n.total_fat_g || '';
    document.getElementById('newFoodProtein').value = n.protein_g || '';
    document.getElementById('newFoodTotalCarbs').value = n.total_carbs_g || '';
    document.getElementById('newFoodFiber').value = n.fiber_g || '';
    document.getElementById('newFoodNetCarbs').value = n.net_carbs_g || '';
    document.getElementById('newFoodSugar').value = n.sugar_g || '';
    document.getElementById('newFoodSodium').value = n.sodium_mg || '';
    document.getElementById('newFoodChol').value = n.cholesterol_mg || '';

    document.querySelector('#addFoodModal .panel-header span').textContent = 'Edit Food';
    document.getElementById('saveFoodBtn').textContent = 'Update Food';
    openModal('addFoodModal');
}

function resetFoodModal() {
    editingFoodId = null;
    document.querySelector('#addFoodModal .panel-header span').textContent = 'Add Food to Database';
    document.getElementById('saveFoodBtn').textContent = 'Save Food';
    ['newFoodName','newFoodBrand','newFoodServing','newFoodCal','newFoodFat','newFoodProtein','newFoodTotalCarbs','newFoodFiber','newFoodNetCarbs','newFoodSugar','newFoodSodium','newFoodChol'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

async function saveNewFood() {
    const name = document.getElementById('newFoodName').value.trim();
    if (!name) { toast('Food name is required', 'error'); return; }
    const serving = document.getElementById('newFoodServing').value.trim();
    if (!serving) { toast('Serving size is required', 'error'); return; }

    const totalCarbs = parseFloat(document.getElementById('newFoodTotalCarbs').value) || 0;
    const fiber = parseFloat(document.getElementById('newFoodFiber').value) || 0;
    const netCarbsInput = parseFloat(document.getElementById('newFoodNetCarbs').value);
    const netCarbs = !isNaN(netCarbsInput) ? netCarbsInput : totalCarbs - fiber;

    const food = {
        name: name,
        brand: document.getElementById('newFoodBrand').value.trim() || null,
        serving_size: serving,
        category: document.getElementById('newFoodCategory').value,
        is_keto_friendly: netCarbs <= 10,
        keto_tier: netCarbs < 2 ? 'excellent' : netCarbs <= 5 ? 'good' : netCarbs <= 10 ? 'moderate' : 'avoid',
        nutrition_per_serving: {
            calories: parseFloat(document.getElementById('newFoodCal').value) || 0,
            total_fat_g: parseFloat(document.getElementById('newFoodFat').value) || 0,
            protein_g: parseFloat(document.getElementById('newFoodProtein').value) || 0,
            total_carbs_g: totalCarbs,
            fiber_g: fiber,
            net_carbs_g: netCarbs,
            sugar_g: parseFloat(document.getElementById('newFoodSugar').value) || 0,
            sodium_mg: parseFloat(document.getElementById('newFoodSodium').value) || 0,
            cholesterol_mg: parseFloat(document.getElementById('newFoodChol').value) || 0,
        }
    };

    const btn = document.getElementById('saveFoodBtn');
    btn.disabled = true;
    btn.textContent = editingFoodId ? 'Updating...' : 'Saving...';

    const result = editingFoodId
        ? await supabaseWrite('deft_food_database', 'PATCH', food, 'food_id=eq.' + editingFoodId)
        : await supabaseWrite('deft_food_database', 'POST', food);

    btn.disabled = false;
    btn.textContent = editingFoodId ? 'Update Food' : 'Save Food';

    if (result) {
        toast(name + (editingFoodId ? ' updated!' : ' added to food database!'), 'success');
        closeModal('addFoodModal');
        resetFoodModal();
        foodBrowserLoaded = false;
        loadFoodBrowser();
    } else {
        toast('Failed to save food', 'error');
    }
}
