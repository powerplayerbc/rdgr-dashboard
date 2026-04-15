// ═══════════════════════════════════════
// DEFT — Recipes Tab
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// RECIPES TAB
// ═══════════════════════════════════════
let allRecipes = [];
let activeRecipeFilter = 'all';
let recipeSearchQuery = '';


// ── Unit conversion tables ──
const VOLUME_ML = { ml: 1, l: 1000, cup: 236.588, tbsp: 14.787, tsp: 4.929 };
const WEIGHT_G = { g: 1, oz: 28.3495, lb: 453.592 };
const UNIT_ALIASES = {
    'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbs': 'tbsp', 'tbsp.': 'tbsp', 'tb': 'tbsp',
    'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tsp.': 'tsp',
    'cup': 'cup', 'cups': 'cup', 'c': 'cup',
    'ounce': 'oz', 'ounces': 'oz', 'oz.': 'oz',
    'pound': 'lb', 'pounds': 'lb', 'lbs': 'lb', 'lb.': 'lb',
    'gram': 'g', 'grams': 'g', 'gr': 'g',
    'milliliter': 'ml', 'milliliters': 'ml', 'ml.': 'ml',
    'liter': 'l', 'liters': 'l',
    'piece': 'piece', 'pieces': 'piece', 'pc': 'piece', 'pcs': 'piece',
    'medium': 'medium', 'med': 'medium', 'med.': 'medium',
    'large': 'large', 'lg': 'large', 'lg.': 'large',
    'small': 'small', 'sm': 'small', 'sm.': 'small',
    'slice': 'slice', 'slices': 'slice',
    'whole': 'whole',
};
const INGREDIENT_UNITS = ['g','oz','cup','tbsp','tsp','piece','ml','lb','medium','large','small','slice','whole'];

function normalizeUnit(raw) {
    if (!raw) return raw;
    const lower = raw.toLowerCase().replace(/[()]/g, '').trim();
    return UNIT_ALIASES[lower] || lower;
}

function parseServingSize(str) {
    if (!str) return null;
    const s = str.toLowerCase().trim();
    const match = s.match(/^([\d./]+)\s*(.+)$/);
    if (!match) return null;
    let qty = match[1];
    const rawUnit = match[2].trim();
    const unit = normalizeUnit(rawUnit);
    if (qty.includes('/')) {
        const parts = qty.split('/');
        qty = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else {
        qty = parseFloat(qty);
    }
    if (isNaN(qty) || qty <= 0) return null;
    return { quantity: qty, unit, rawUnit, ml: VOLUME_ML[unit] ? qty * VOLUME_ML[unit] : null, g: WEIGHT_G[unit] ? qty * WEIGHT_G[unit] : null };
}

function getConversionRatio(baseParsed, newQty, newUnit) {
    if (!baseParsed || !newQty) return newQty || 1;
    const baseMl = baseParsed.ml, baseG = baseParsed.g;
    const newMl = VOLUME_ML[newUnit] ? newQty * VOLUME_ML[newUnit] : null;
    const newG = WEIGHT_G[newUnit] ? newQty * WEIGHT_G[newUnit] : null;
    if (baseMl && newMl) return newMl / baseMl;
    if (baseG && newG) return newG / baseG;
    return newQty / baseParsed.quantity;
}

function recalcIngredientNutrition(index) {
    const ing = newRecipeIngredients[index];
    if (!ing || !ing.baseNutrition) return;
    let ratio, approx = false;
    if (ing.baseServingParsed) {
        ratio = getConversionRatio(ing.baseServingParsed, ing.quantity, ing.unit);
        approx = (VOLUME_ML[ing.unit] && ing.baseServingParsed.g && !ing.baseServingParsed.ml) ||
                 (WEIGHT_G[ing.unit] && ing.baseServingParsed.ml && !ing.baseServingParsed.g);
    } else {
        ratio = ing.quantity || 1;
    }
    const base = ing.baseNutrition;
    ing.nutrition = {
        calories: +(base.calories * ratio).toFixed(1),
        total_fat_g: +(base.total_fat_g * ratio).toFixed(2),
        protein_g: +(base.protein_g * ratio).toFixed(2),
        total_carbs_g: +(base.total_carbs_g * ratio).toFixed(2),
        fiber_g: +(base.fiber_g * ratio).toFixed(2),
        net_carbs_g: +(base.net_carbs_g * ratio).toFixed(2),
        sugar_g: +(base.sugar_g * ratio).toFixed(2),
    };
    ing._approxConversion = approx;
    // Update nutrition fields via DOM instead of re-rendering (preserves quantity input mid-typing)
    const rows = document.getElementById('ingredientRows').children;
    if (rows[index]) {
        const inputs = rows[index].querySelectorAll('input[type="number"]');
        if (inputs[1]) inputs[1].value = ing.nutrition.calories || '';
        if (inputs[2]) inputs[2].value = ing.nutrition.total_fat_g || '';
        if (inputs[3]) inputs[3].value = ing.nutrition.protein_g || '';
        if (inputs[4]) inputs[4].value = ing.nutrition.total_carbs_g || '';
        if (inputs[5]) inputs[5].value = ing.nutrition.net_carbs_g || '';
        if (inputs[6]) inputs[6].value = ing.nutrition.sugar_g || '';
    }
}

// Food DB autocomplete for recipe ingredients
let ingredientSearchTimeout;
async function searchFoodForIngredient(query, index) {
    if (!query || query.length < 2) {
        hideIngredientSuggestions(index);
        return;
    }
    clearTimeout(ingredientSearchTimeout);
    ingredientSearchTimeout = setTimeout(async () => {
        const results = await supabaseSelect('deft_food_database',
            'name=ilike.*' + encodeURIComponent(query) + '*&select=name,brand,serving_size,nutrition_per_serving&limit=6&order=name'
        );
        if (!results || results.length === 0) { hideIngredientSuggestions(index); return; }

        const container = document.getElementById('ingSuggestions-' + index);
        if (!container) return;
        container.innerHTML = results.map(f => {
            const n = f.nutrition_per_serving || {};
            const brandTag = f.brand ? '<span class="text-xs" style="color:var(--deft-txt-2);">' + f.brand + '</span> · ' : '';
            const servingTag = f.serving_size ? '<span class="text-xs" style="color:var(--deft-txt-3);">' + f.serving_size + '</span>' : '';
            return '<button type="button" onclick="selectFoodForIngredient(' + index + ', this)" data-name="' + f.name + '" data-brand="' + (f.brand||'') + '" data-cal="' + (n.calories||0) + '" data-fat="' + (n.total_fat_g||0) + '" data-protein="' + (n.protein_g||0) + '" data-carbs="' + (n.total_carbs_g||0) + '" data-fiber="' + (n.fiber_g||0) + '" data-netcarbs="' + (n.net_carbs_g||0) + '" data-sugar="' + (n.sugar_g||0) + '" data-serving="' + (f.serving_size||'') + '" class="recipe-search-item">' +
                '<span class="font-medium">' + f.name + '</span>' +
                '<div class="flex items-center gap-1 flex-wrap">' + brandTag + servingTag + '</div>' +
                '<span class="text-xs font-mono" style="color:var(--deft-txt-3);">' + Math.round(n.calories||0) + ' cal · ' + (n.net_carbs_g||0).toFixed(1) + 'g carbs</span>' +
            '</button>';
        }).join('');
        container.style.display = '';
    }, 250);
}

function selectFoodForIngredient(index, btn) {
    const ing = newRecipeIngredients[index];
    if (!ing) return;
    ing.name = btn.dataset.name;
    ing.baseNutrition = {
        calories: parseFloat(btn.dataset.cal) || 0,
        total_fat_g: parseFloat(btn.dataset.fat) || 0,
        protein_g: parseFloat(btn.dataset.protein) || 0,
        total_carbs_g: parseFloat(btn.dataset.carbs) || 0,
        fiber_g: parseFloat(btn.dataset.fiber) || 0,
        net_carbs_g: parseFloat(btn.dataset.netcarbs) || 0,
        sugar_g: parseFloat(btn.dataset.sugar) || 0,
    };
    ing.baseServing = btn.dataset.serving || '';
    ing.baseServingParsed = parseServingSize(btn.dataset.serving || '');
    ing.nutrition = { ...ing.baseNutrition };
    ing._approxConversion = false;
    // Default quantity/unit from serving size if parseable
    if (ing.baseServingParsed) {
        ing.quantity = ing.baseServingParsed.quantity;
        ing.unit = ing.baseServingParsed.unit;
    }
    hideIngredientSuggestions(index);
    renderIngredientRows();
}

function hideIngredientSuggestions(index) {
    const el = document.getElementById('ingSuggestions-' + index);
    if (el) el.style.display = 'none';
}

async function loadRecipes() {
    if (!activeProfileId) return;

    const data = await supabaseSelect('deft_recipes',
        `user_id=eq.${activeProfileId}&status=eq.active&select=recipe_id,name,servings,nutrition_per_serving,keto_analysis,tags,is_favorite&order=name`
    );
    allRecipes = data || [];
    renderRecipes();
}

function renderRecipes() {
    let filtered = allRecipes;

    // Apply search
    if (recipeSearchQuery) {
        const q = recipeSearchQuery.toLowerCase();
        filtered = filtered.filter(r => r.name.toLowerCase().includes(q));
    }

    // Apply tag filter
    if (activeRecipeFilter === 'favorites') {
        filtered = filtered.filter(r => r.is_favorite);
    } else if (activeRecipeFilter !== 'all') {
        filtered = filtered.filter(r => r.tags && r.tags.includes(activeRecipeFilter));
    }

    const grid = document.getElementById('recipeGrid');
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state col-span-full"><p>No recipes found</p><p class="text-sm mt-1" style="color: var(--deft-txt-3);">${recipeSearchQuery ? 'Try a different search term' : 'Add your first recipe to get started'}</p></div>`;
        document.getElementById('recipeCount').textContent = '0 recipes';
        return;
    }

    grid.innerHTML = filtered.map(r => {
        const n = r.nutrition_per_serving || {};
        const tier = getKetoTier(n.net_carbs_g || 0);
        return `
        <div class="recipe-card" onclick="openRecipeDetail('${r.recipe_id}')">
            <div class="flex items-start justify-between mb-2">
                <h3 class="font-heading font-bold text-sm" style="color: var(--deft-txt);">${r.name}</h3>
                <button onclick="event.stopPropagation();toggleFavorite('${r.recipe_id}', ${!r.is_favorite})"
                    class="p-1 transition-colors" style="color: ${r.is_favorite ? 'var(--deft-accent-warm)' : 'var(--deft-txt-3)'};" title="${r.is_favorite ? 'Remove favorite' : 'Add favorite'}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${r.is_favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
            </div>
            <div class="flex gap-2 text-xs font-mono mb-2" style="color: var(--deft-txt-2);">
                <span>${Math.round(n.calories || 0)} cal</span>
                <span>&middot;</span>
                <span>${(n.total_fat_g || 0).toFixed(0)}g F</span>
                <span>&middot;</span>
                <span>${(n.protein_g || 0).toFixed(0)}g P</span>
                <span>&middot;</span>
                <span>${(n.net_carbs_g || 0).toFixed(1)}g C</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
                <span class="badge badge-keto-${tier.toLowerCase()}">${tier}</span>
                ${(r.tags || []).slice(0, 3).map(t => `<span class="badge badge-tag">${t}</span>`).join('')}
            </div>
        </div>`;
    }).join('');

    document.getElementById('recipeCount').textContent = `${filtered.length} recipe${filtered.length !== 1 ? 's' : ''}`;
}

function getKetoTier(netCarbs) {
    if (netCarbs < 2) return 'Excellent';
    if (netCarbs <= 5) return 'Good';
    if (netCarbs <= 10) return 'Moderate';
    return 'Avoid';
}

function filterRecipes(filter) {
    activeRecipeFilter = filter;
    document.querySelectorAll('.recipe-filter').forEach(f => {
        f.classList.toggle('active', f.dataset.filter === filter);
    });
    renderRecipes();
}

function searchRecipes(query) {
    recipeSearchQuery = query;
    renderRecipes();
}

async function toggleFavorite(recipeId, isFav) {
    await supabaseWrite('deft_recipes', 'PATCH', { is_favorite: isFav }, `recipe_id=eq.${recipeId}`);
    const r = allRecipes.find(x => x.recipe_id === recipeId);
    if (r) r.is_favorite = isFav;
    renderRecipes();
    toast(isFav ? 'Added to favorites' : 'Removed from favorites', 'success');
}

async function openRecipeDetail(recipeId) {
    const results = await supabaseSelect('deft_recipes', `recipe_id=eq.${recipeId}&select=*,deft_ingredients(*)`);
    if (!results || results.length === 0) return;
    const recipe = results[0];

    const panel = document.getElementById('recipeDetailPanel');
    const overlay = document.getElementById('recipeDetailOverlay');

    document.getElementById('detailName').textContent = recipe.name;
    document.getElementById('detailServings').textContent = `${recipe.servings} serving(s)`;

    const n = recipe.nutrition_per_serving || {};
    document.getElementById('detailCal').textContent = Math.round(n.calories || 0);
    document.getElementById('detailFat').textContent = (n.total_fat_g || 0).toFixed(1);
    document.getElementById('detailProtein').textContent = (n.protein_g || 0).toFixed(1);
    document.getElementById('detailCarbs').textContent = (n.net_carbs_g || 0).toFixed(1);
    document.getElementById('detailFiber').textContent = (n.fiber_g || 0).toFixed(1);
    document.getElementById('detailSugar').textContent = (n.sugar_g || 0).toFixed(1);

    // Ingredients
    const ingredients = (recipe.deft_ingredients || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    document.getElementById('detailIngredients').innerHTML = ingredients.length > 0
        ? ingredients.map(i => `<div class="flex justify-between py-1.5 border-b" style="border-color: var(--deft-border);">
            <span class="text-sm" style="color: var(--deft-txt);">${i.name}</span>
            <span class="text-xs font-mono" style="color: var(--deft-txt-3);">${i.quantity} ${i.unit}</span>
        </div>`).join('')
        : '<p class="text-sm" style="color: var(--deft-txt-3);">No ingredients listed</p>';

    // Keto analysis
    const ka = recipe.keto_analysis || {};
    document.getElementById('detailKetoFriendly').textContent = ka.is_keto_friendly ? 'Yes' : 'No';
    document.getElementById('detailKetoFriendly').style.color = ka.is_keto_friendly ? 'var(--deft-success)' : 'var(--deft-danger)';
    document.getElementById('detailFatPct').textContent = (ka.fat_calories_pct || 0).toFixed(0) + '%';

    // Store for archive
    panel.dataset.recipeId = recipeId;

    overlay.classList.add('active');
}

function closeRecipeDetail() {
    document.getElementById('recipeDetailOverlay').classList.remove('active');
}

async function archiveRecipe() {
    const recipeId = document.getElementById('recipeDetailPanel').dataset.recipeId;
    if (!recipeId) return;
    if (!confirm('Archive this recipe?')) return;

    const result = await deftApi('delete_recipe', { recipe_id: recipeId });
    if (result) {
        toast('Recipe archived', 'success');
        closeRecipeDetail();
        loadRecipes();
    }
}

// ── Add Recipe Modal ──
let newRecipeIngredients = [];
let editingRecipeId = null;

function openAddRecipeModal() {
    editingRecipeId = null;
    document.getElementById('recipeModalTitle').textContent = 'New Recipe';
    document.getElementById('saveRecipeBtn').textContent = 'Save Recipe';
    document.getElementById('newRecipeName').value = '';
    document.getElementById('newRecipeServings').value = '1';
    document.getElementById('newRecipeTags').value = '';
    newRecipeIngredients = [{ name: '', quantity: '', unit: 'g', nutrition: {} }];
    renderIngredientRows();
    openModal('addRecipeModal');
}

async function editRecipe() {
    const recipeId = document.getElementById('recipeDetailPanel').dataset.recipeId;
    if (!recipeId) return;

    const results = await supabaseSelect('deft_recipes', `recipe_id=eq.${recipeId}&select=*`);
    const ingResults = await supabaseSelect('deft_ingredients', `recipe_id=eq.${recipeId}&select=*&order=sort_order`);
    if (!results || results.length === 0) { toast('Recipe not found', 'error'); return; }

    const recipe = results[0];
    const ingredients = ingResults || [];

    closeRecipeDetail();

    editingRecipeId = recipeId;
    document.getElementById('recipeModalTitle').textContent = 'Edit Recipe';
    document.getElementById('saveRecipeBtn').textContent = 'Update Recipe';
    document.getElementById('newRecipeName').value = recipe.name || '';
    document.getElementById('newRecipeServings').value = recipe.servings || 1;
    document.getElementById('newRecipeTags').value = (recipe.tags || []).join(', ');

    newRecipeIngredients = ingredients.length > 0
        ? ingredients.map(i => ({
            name: i.name || '',
            quantity: i.quantity || '',
            unit: i.unit || 'g',
            nutrition: i.nutrition_per_unit || i.nutrition || {},
            food_id: i.food_id || null,
            baseServing: i.base_serving || null,
            _approxConversion: i.approx_conversion || false,
        }))
        : [{ name: '', quantity: '', unit: 'g', nutrition: {} }];

    renderIngredientRows();
    openModal('addRecipeModal');
}

async function duplicateRecipe() {
    const recipeId = document.getElementById('recipeDetailPanel').dataset.recipeId;
    if (!recipeId) return;

    const results = await supabaseSelect('deft_recipes', `recipe_id=eq.${recipeId}&select=*`);
    const ingResults = await supabaseSelect('deft_ingredients', `recipe_id=eq.${recipeId}&select=*&order=sort_order`);
    if (!results || results.length === 0) { toast('Recipe not found', 'error'); return; }

    const recipe = results[0];
    const ingredients = ingResults || [];

    closeRecipeDetail();

    editingRecipeId = null;
    document.getElementById('recipeModalTitle').textContent = 'Duplicate Recipe';
    document.getElementById('saveRecipeBtn').textContent = 'Save Recipe';
    document.getElementById('newRecipeName').value = (recipe.name || '') + ' (copy)';
    document.getElementById('newRecipeServings').value = recipe.servings || 1;
    document.getElementById('newRecipeTags').value = (recipe.tags || []).join(', ');

    newRecipeIngredients = ingredients.length > 0
        ? ingredients.map(i => ({
            name: i.name || '',
            quantity: i.quantity || '',
            unit: i.unit || 'g',
            nutrition: i.nutrition_per_unit || i.nutrition || {},
            food_id: i.food_id || null,
            baseServing: i.base_serving || null,
            _approxConversion: i.approx_conversion || false,
        }))
        : [{ name: '', quantity: '', unit: 'g', nutrition: {} }];

    renderIngredientRows();
    openModal('addRecipeModal');
}

function renderIngredientRows() {
    const container = document.getElementById('ingredientRows');
    container.innerHTML = newRecipeIngredients.map((ing, i) => `
    <div class="mb-3 p-2.5 rounded-lg" style="background: rgba(255,255,255,0.015); border: 1px solid var(--deft-border);">
        <div class="flex gap-2 items-end">
            <div class="flex-1 relative">
                <input type="text" class="form-input text-xs py-1.5" placeholder="Search food database..." value="${ing.name}" oninput="newRecipeIngredients[${i}].name=this.value; searchFoodForIngredient(this.value, ${i})" autocomplete="off">
                <div id="ingSuggestions-${i}" class="absolute left-0 right-0 top-full mt-1 rounded-lg border overflow-hidden" style="background: var(--deft-surface-el); border-color: var(--deft-border); z-index: 10000; display: none; max-height: 200px; overflow-y: auto;"></div>
            </div>
            <div style="width: 4rem;">
                <input type="number" step="any" class="form-input text-xs py-1.5 text-center" placeholder="Qty" value="${ing.quantity}" oninput="const v=this.value; newRecipeIngredients[${i}].quantity=v===''?0:(parseFloat(v)||0); recalcIngredientNutrition(${i})">
            </div>
            <div style="width: 5rem;">
                <select class="form-input text-xs py-1.5" onchange="newRecipeIngredients[${i}].unit=this.value; recalcIngredientNutrition(${i})">
                    ${(function(){ const units = [...INGREDIENT_UNITS]; if (ing.unit && !units.includes(ing.unit)) units.push(ing.unit); return units; })().map(u => `<option value="${u}" ${ing.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
                </select>
            </div>
            <button onclick="removeIngredientRow(${i})" class="p-1.5 rounded transition-colors flex-shrink-0" style="color: var(--deft-txt-3);" title="Remove">
                <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
        </div>
        ${ing.baseServing ? `<div class="flex items-center gap-2 mt-1.5 px-0.5"><span class="text-[10px] font-mono" style="color: var(--deft-txt-3);">Base: ${ing.baseServing}</span>${ing._approxConversion ? '<span class="text-[10px] font-mono" style="color: var(--deft-warning, #FB923C);">(approx.)</span>' : ''}</div>` : ''}
        <div class="flex gap-2 mt-2">
            <div class="flex-1">
                <div class="text-[10px] mb-0.5 font-mono" style="color: var(--deft-txt-3);">Cal</div>
                <input type="number" class="form-input text-xs py-1 text-center" placeholder="0" value="${ing.nutrition.calories || ''}" oninput="newRecipeIngredients[${i}].nutrition.calories=parseFloat(this.value)||0" title="Calories">
            </div>
            <div class="flex-1">
                <div class="text-[10px] mb-0.5 font-mono" style="color: var(--deft-txt-3);">Fat (g)</div>
                <input type="number" step="0.1" class="form-input text-xs py-1 text-center" placeholder="0" value="${ing.nutrition.total_fat_g || ''}" oninput="newRecipeIngredients[${i}].nutrition.total_fat_g=parseFloat(this.value)||0" title="Fat (g)">
            </div>
            <div class="flex-1">
                <div class="text-[10px] mb-0.5 font-mono" style="color: var(--deft-txt-3);">Pro (g)</div>
                <input type="number" step="0.1" class="form-input text-xs py-1 text-center" placeholder="0" value="${ing.nutrition.protein_g || ''}" oninput="newRecipeIngredients[${i}].nutrition.protein_g=parseFloat(this.value)||0" title="Protein (g)">
            </div>
            <div class="flex-1">
                <div class="text-[10px] mb-0.5 font-mono" style="color: var(--deft-txt-3);">Carbs (g)</div>
                <input type="number" step="0.1" class="form-input text-xs py-1 text-center" placeholder="0" value="${ing.nutrition.total_carbs_g || ''}" oninput="newRecipeIngredients[${i}].nutrition.total_carbs_g=parseFloat(this.value)||0" title="Carbs (g)">
            </div>
            <div class="flex-1">
                <div class="text-[10px] mb-0.5 font-mono" style="color: var(--deft-accent, #06D6A0); font-weight: 600;">Net C (g)</div>
                <input type="number" step="0.1" class="form-input text-xs py-1 text-center" placeholder="0" value="${ing.nutrition.net_carbs_g || ''}" oninput="newRecipeIngredients[${i}].nutrition.net_carbs_g=parseFloat(this.value)||0" title="Net Carbs (g)" style="color: var(--deft-accent); font-weight: 600;">
            </div>
            <div class="flex-1">
                <div class="text-[10px] mb-0.5 font-mono" style="color: var(--deft-txt-3);">Sugar (g)</div>
                <input type="number" step="0.1" class="form-input text-xs py-1 text-center" placeholder="0" value="${ing.nutrition.sugar_g || ''}" oninput="newRecipeIngredients[${i}].nutrition.sugar_g=parseFloat(this.value)||0" title="Sugar (g)">
            </div>
        </div>
    </div>`).join('');
}

function addIngredientRow() {
    newRecipeIngredients.push({ name: '', quantity: '', unit: 'g', nutrition: {} });
    renderIngredientRows();
}

function removeIngredientRow(index) {
    newRecipeIngredients.splice(index, 1);
    if (newRecipeIngredients.length === 0) addIngredientRow();
    else renderIngredientRows();
}

async function saveNewRecipe() {
    const name = document.getElementById('newRecipeName').value.trim();
    if (!name) { toast('Recipe name required', 'error'); return; }

    const servings = parseFloat(document.getElementById('newRecipeServings').value) || 1;
    const tagsStr = document.getElementById('newRecipeTags').value.trim();
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

    const ingredients = newRecipeIngredients.filter(i => i.name.trim()).map(i => ({
        name: i.name.trim(),
        quantity: i.quantity || 0,
        unit: i.unit || 'g',
        nutrition: i.nutrition || {}
    }));

    if (ingredients.length === 0) { toast('Add at least one ingredient', 'error'); return; }

    const btn = document.getElementById('saveRecipeBtn');
    const isEditing = !!editingRecipeId;
    btn.disabled = true;
    btn.textContent = isEditing ? 'Updating...' : 'Saving...';

    let result;
    if (isEditing) {
        result = await deftApi('update_recipe', { recipe_id: editingRecipeId, name, servings, tags, ingredients });
    } else {
        result = await deftApi('add_recipe', { name, servings, tags, ingredients });
    }

    btn.disabled = false;
    btn.textContent = isEditing ? 'Update Recipe' : 'Save Recipe';

    if (result) {
        toast(isEditing ? `${name} updated!` : `${name} saved!`, 'success');
        editingRecipeId = null;
        closeModal('addRecipeModal');
        loadRecipes();
    }
}

