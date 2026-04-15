// ═══════════════════════════════════════
// DEFT — Analytics Tab
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// ANALYTICS TAB
// ═══════════════════════════════════════
let chartJsLoaded = false;
let weightChart = null;
let calorieChart = null;
let macroChart = null;
let waterChart = null;
let analyticsRange = '7d';
let analyticsStartDate = null;
let analyticsEndDate = null;

async function loadChartJs() {
    if (chartJsLoaded) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
        script.onload = () => { chartJsLoaded = true; resolve(); };
        script.onerror = () => { toast('Failed to load charting library', 'error'); reject(new Error('Chart.js load failed')); };
        document.head.appendChild(script);
    });
}

function setAnalyticsRange(range) {
    analyticsRange = range;
    document.querySelectorAll('.range-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.range === range);
    });
    const customDates = document.getElementById('customDateRange');
    customDates.style.display = range === 'custom' ? 'flex' : 'none';
    if (range !== 'custom') loadAnalytics();
}

function applyCustomRange() {
    analyticsStartDate = document.getElementById('analyticsStart').value;
    analyticsEndDate = document.getElementById('analyticsEnd').value;
    if (analyticsStartDate && analyticsEndDate) {
        if (new Date(analyticsStartDate) > new Date(analyticsEndDate)) {
            toast('Start date must be before end date', 'error');
            return;
        }
        loadAnalytics();
    } else {
        toast('Please select both start and end dates', 'error');
    }
}

function getAnalyticsDateRange() {
    const end = new Date();
    let start = new Date();
    if (analyticsRange === '7d') start.setDate(start.getDate() - 7);
    else if (analyticsRange === '30d') start.setDate(start.getDate() - 30);
    else if (analyticsRange === '90d') start.setDate(start.getDate() - 90);
    else if (analyticsRange === 'custom') {
        start = new Date(analyticsStartDate);
        end.setTime(new Date(analyticsEndDate).getTime());
    }
    return {
        startStr: start.toLocaleDateString('en-CA'),
        endStr: end.toLocaleDateString('en-CA')
    };
}

async function loadAnalytics() {
    if (!activeProfileId) return;

    try {
        await loadChartJs();
    } catch (e) {
        return;
    }

    const { startStr, endStr } = getAnalyticsDateRange();

    // Fetch all analytics data in parallel (silent: true so fallback can handle failures)
    let [weightData, calData, macroData] = await Promise.all([
        deftApi('get_analytics', { metric: 'weight', start_date: startStr, end_date: endStr }, { silent: true }),
        deftApi('get_analytics', { metric: 'calories', start_date: startStr, end_date: endStr }, { silent: true }),
        deftApi('get_analytics', { metric: 'macros', start_date: startStr, end_date: endStr }, { silent: true }),
    ]);

    // Fallback: if webhook returned no data, read directly from Supabase
    const allEmpty = !weightData?.data?.series?.length && !calData?.data?.series?.length && !macroData?.data?.series?.length;
    let fallback = null;
    if (allEmpty) {
        fallback = await loadAnalyticsFallback(startStr, endStr);
        if (fallback) {
            weightData = fallback.weightData;
            calData = fallback.calData;
            macroData = fallback.macroData;
        }
    }

    renderAnalyticsSummary(weightData, calData, macroData);
    renderWeightChart(weightData);
    renderCalorieChart(calData);
    renderMacroChart(macroData);
    renderKetoAdherence(macroData);

    // Water chart: use fallback data if available, otherwise fetch directly
    let waterData = allEmpty && fallback ? fallback.waterData : null;
    if (!waterData) {
        const { startStr: ws, endStr: we } = getAnalyticsDateRange();
        const waterLogs = await supabaseSelect('deft_daily_logs',
            `user_id=eq.${activeProfileId}&log_date=gte.${ws}&log_date=lte.${we}&select=log_date,water_oz&order=log_date`
        );
        waterData = { data: { series: (waterLogs || []).map(l => ({ date: l.log_date, water_oz: l.water_oz || 0 })) } };
    }
    renderWaterChart(waterData);
}

async function loadAnalyticsFallback(startStr, endStr) {
    try {
        const logs = await supabaseSelect('deft_daily_logs',
            `user_id=eq.${activeProfileId}&log_date=gte.${startStr}&log_date=lte.${endStr}&select=log_date,weight_lbs,water_oz,consumed_totals,target_calories,target_macros&order=log_date`
        );
        if (!logs || logs.length === 0) return null;

        // Build weight series
        const weightSeries = logs.filter(l => l.weight_lbs).map(l => ({ date: l.log_date, value: l.weight_lbs }));
        const wChange = weightSeries.length >= 2 ? weightSeries[weightSeries.length - 1].value - weightSeries[0].value : null;
        const weightData = { data: { stats: { change: wChange }, series: weightSeries } };

        // Build calorie series
        const calSeries = logs.map(l => ({
            date: l.log_date,
            consumed: l.consumed_totals?.calories || 0,
            target: l.target_calories || l.target_macros?.calories || 2000
        }));
        const calData = { data: { series: calSeries } };

        // Build macro series
        const macroSeries = logs.map(l => ({
            date: l.log_date,
            fat_g: l.consumed_totals?.fat_g || l.consumed_totals?.total_fat_g || 0,
            protein_g: l.consumed_totals?.protein_g || 0,
            net_carbs_g: l.consumed_totals?.net_carbs_g || 0
        }));
        const macroData = { data: { series: macroSeries } };

        // Build water series (used by water chart in Phase 4)
        const waterSeries = logs.map(l => ({ date: l.log_date, water_oz: l.water_oz || 0 }));
        const waterData = { data: { series: waterSeries } };

        return { weightData, calData, macroData, waterData };
    } catch (err) {
        console.warn('loadAnalyticsFallback error:', err.message);
        return null;
    }
}

function renderAnalyticsSummary(weightData, calData, macroData) {
    const wStats = weightData?.data?.stats || {};
    const cSeries = calData?.data?.series || [];
    const mSeries = macroData?.data?.series || [];

    // Average calories
    const avgCal = cSeries.length > 0
        ? Math.round(cSeries.reduce((s, d) => s + (d.consumed || 0), 0) / cSeries.length)
        : 0;
    document.getElementById('avgCalories').textContent = avgCal || '--';

    // Average net carbs from macro data
    const avgCarbs = mSeries.length > 0
        ? (mSeries.reduce((s, d) => s + (d.net_carbs_g || 0), 0) / mSeries.length).toFixed(1)
        : null;
    document.getElementById('avgNetCarbs').textContent = avgCarbs ? `${avgCarbs}g` : '--';

    // Weight change
    const weightChange = wStats.change;
    const changeEl = document.getElementById('weightChange');
    if (weightChange != null && weightChange !== undefined) {
        changeEl.textContent = `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} lbs`;
        changeEl.style.color = weightChange < 0 ? 'var(--deft-success)' : weightChange > 0 ? 'var(--deft-danger)' : 'var(--deft-txt)';
    } else {
        changeEl.textContent = '--';
        changeEl.style.color = 'var(--deft-txt)';
    }

    // Adherence: % of days where net carbs <= 20g
    if (mSeries.length > 0) {
        const daysUnder = mSeries.filter(d => (d.net_carbs_g || 0) <= 20).length;
        const pct = Math.round((daysUnder / mSeries.length) * 100);
        document.getElementById('avgAdherence').textContent = `${pct}%`;
    } else {
        document.getElementById('avgAdherence').textContent = '--';
    }
}

function getChartColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
        accent: styles.getPropertyValue('--deft-accent').trim(),
        accentWarm: styles.getPropertyValue('--deft-accent-warm').trim(),
        success: styles.getPropertyValue('--deft-success').trim(),
        danger: styles.getPropertyValue('--deft-danger').trim(),
        txt: styles.getPropertyValue('--deft-txt').trim(),
        txt2: styles.getPropertyValue('--deft-txt-2').trim(),
        txt3: styles.getPropertyValue('--deft-txt-3').trim(),
        border: styles.getPropertyValue('--deft-border').trim(),
        surface: styles.getPropertyValue('--deft-surface').trim(),
    };
}

function chartDefaults(c) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: c.txt3,
                    font: { family: "'JetBrains Mono', monospace", size: 10 },
                    boxWidth: 12,
                    padding: 16,
                }
            },
            tooltip: {
                backgroundColor: c.surface,
                titleColor: c.txt,
                bodyColor: c.txt2,
                borderColor: c.border,
                borderWidth: 1,
                padding: 10,
                titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
                bodyFont: { family: "'DM Sans', system-ui", size: 12 },
                cornerRadius: 6,
            }
        },
        scales: {
            x: {
                ticks: { color: c.txt3, font: { family: "'JetBrains Mono', monospace", size: 10 }, maxTicksLimit: 10 },
                grid: { color: c.border + '30' },
                border: { color: c.border + '40' },
            },
            y: {
                ticks: { color: c.txt3, font: { family: "'JetBrains Mono', monospace", size: 10 } },
                grid: { color: c.border + '30' },
                border: { color: c.border + '40' },
            }
        }
    };
}

function formatDateLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderWeightChart(data) {
    const canvas = document.getElementById('weightCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const series = data?.data?.series || [];
    const emptyEl = document.getElementById('weightEmptyState');

    if (series.length === 0) {
        emptyEl.style.display = '';
        canvas.parentElement.style.display = 'none';
        return;
    }
    emptyEl.style.display = 'none';
    canvas.parentElement.style.display = '';

    // Compute 7-day rolling average
    const rollingAvg = series.map((d, i) => {
        const windowSlice = series.slice(Math.max(0, i - 6), i + 1);
        return windowSlice.reduce((s, x) => s + x.value, 0) / windowSlice.length;
    });

    const c = getChartColors();
    if (weightChart) weightChart.destroy();

    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: series.map(d => formatDateLabel(d.date)),
            datasets: [
                {
                    label: 'Weight',
                    data: series.map(d => d.value),
                    borderColor: c.accent,
                    backgroundColor: c.accent + '18',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: c.accent,
                    pointBorderColor: c.accent,
                    tension: 0.3,
                    fill: true,
                    borderWidth: 2,
                },
                {
                    label: '7-Day Avg',
                    data: rollingAvg,
                    borderColor: c.txt3,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0.4,
                    fill: false,
                    borderWidth: 1.5,
                }
            ]
        },
        options: chartDefaults(c),
    });
}

function renderCalorieChart(data) {
    const canvas = document.getElementById('calorieCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const series = data?.data?.series || [];
    const emptyEl = document.getElementById('calorieEmptyState');

    if (series.length === 0) {
        emptyEl.style.display = '';
        canvas.parentElement.style.display = 'none';
        return;
    }
    emptyEl.style.display = 'none';
    canvas.parentElement.style.display = '';

    const c = getChartColors();
    if (calorieChart) calorieChart.destroy();

    calorieChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: series.map(d => formatDateLabel(d.date)),
            datasets: [
                {
                    label: 'Consumed',
                    data: series.map(d => d.consumed || 0),
                    backgroundColor: c.accent + '50',
                    borderColor: c.accent,
                    borderWidth: 1,
                    borderRadius: 4,
                },
                {
                    label: 'Target',
                    data: series.map(d => d.target || 0),
                    backgroundColor: 'transparent',
                    borderColor: c.txt3 + '60',
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    borderRadius: 4,
                }
            ]
        },
        options: chartDefaults(c),
    });
}

function renderMacroChart(data) {
    const canvas = document.getElementById('macroCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const series = data?.data?.series || [];
    const emptyEl = document.getElementById('macroEmptyState');

    if (series.length === 0) {
        emptyEl.style.display = '';
        canvas.parentElement.style.display = 'none';
        return;
    }
    emptyEl.style.display = 'none';
    canvas.parentElement.style.display = '';

    const c = getChartColors();
    if (macroChart) macroChart.destroy();

    const opts = chartDefaults(c);
    opts.scales.x.stacked = true;
    opts.scales.y.stacked = true;

    macroChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: series.map(d => formatDateLabel(d.date)),
            datasets: [
                {
                    label: 'Fat (g)',
                    data: series.map(d => d.fat_g || 0),
                    backgroundColor: c.accentWarm + '70',
                    borderRadius: 2,
                },
                {
                    label: 'Protein (g)',
                    data: series.map(d => d.protein_g || 0),
                    backgroundColor: c.success + '70',
                    borderRadius: 2,
                },
                {
                    label: 'Net Carbs (g)',
                    data: series.map(d => d.net_carbs_g || 0),
                    backgroundColor: c.accent + '70',
                    borderRadius: 2,
                }
            ]
        },
        options: opts,
    });
}

function renderKetoAdherence(macroData) {
    const series = macroData?.data?.series || [];
    const container = document.getElementById('ketoAdherenceDots');

    if (series.length === 0) {
        container.innerHTML = '<div class="empty-state" style="width:100%;"><p>No data available</p></div>';
        document.getElementById('ketoStreak').textContent = '0';
        document.getElementById('ketoBestStreak').textContent = '0';
        document.getElementById('ketoDaysUnder').textContent = '0';
        return;
    }

    let bestStreak = 0;
    let tempStreak = 0;
    let daysUnder = 0;

    // Build dots and compute stats
    container.innerHTML = series.map(d => {
        const under = (d.net_carbs_g || 0) <= 20;
        if (under) {
            daysUnder++;
            tempStreak++;
            if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else {
            tempStreak = 0;
        }
        const label = `${formatDateLabel(d.date)}: ${(d.net_carbs_g || 0).toFixed(1)}g net carbs`;
        return `<div class="adherence-dot ${under ? 'under' : 'over'}" title="${label}"></div>`;
    }).join('');

    // Current streak: count consecutive "under" days from the end
    let currentStreak = 0;
    for (let i = series.length - 1; i >= 0; i--) {
        if ((series[i].net_carbs_g || 0) <= 20) currentStreak++;
        else break;
    }

    document.getElementById('ketoStreak').textContent = currentStreak;
    document.getElementById('ketoBestStreak').textContent = bestStreak;
    document.getElementById('ketoDaysUnder').textContent = daysUnder;
}

function renderWaterChart(waterData) {
    const canvas = document.getElementById('waterCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const series = waterData?.data?.series || [];
    const emptyEl = document.getElementById('waterEmptyState');

    if (series.length === 0 || series.every(d => !d.water_oz)) {
        if (emptyEl) emptyEl.style.display = '';
        canvas.style.display = 'none';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = '';

    const c = getChartColors();
    if (waterChart) waterChart.destroy();

    waterChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: series.map(d => formatDateLabel(d.date)),
            datasets: [{
                label: 'Water (oz)',
                data: series.map(d => d.water_oz || 0),
                backgroundColor: '#38BDF850',
                borderColor: '#38BDF8',
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            ...chartDefaults(c),
            plugins: {
                ...chartDefaults(c).plugins,
                annotation: undefined,
            },
            scales: {
                ...chartDefaults(c).scales,
                y: {
                    ...chartDefaults(c).scales.y,
                    suggestedMax: 80,
                }
            }
        },
        plugins: [{
            id: 'waterGoalLine',
            afterDraw(chart) {
                const yScale = chart.scales.y;
                const goalY = yScale.getPixelForValue(64);
                const ctx = chart.ctx;
                ctx.save();
                ctx.strokeStyle = c.txt3 + '80';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(chart.chartArea.left, goalY);
                ctx.lineTo(chart.chartArea.right, goalY);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = c.txt3;
                ctx.font = '9px JetBrains Mono';
                ctx.fillText('64oz goal', chart.chartArea.right - 50, goalY - 5);
                ctx.restore();
            }
        }]
    });
}

