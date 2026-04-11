# Trading Platform — Frontend Handoff

## Purpose
This document provides the frontend developer with everything needed to build a dashboard for the trading research platform and (eventually) the live trading interface.

---

## What Exists (Backend)

A research pipeline stores structured trading knowledge in Supabase. The frontend needs to display this data and provide controls for the research and trading systems.

### Supabase Tables to Read

**`trading_research`** — Main research findings
```
id, research_id, category, subcategory, market, title, summary, raw_content,
structured_data (JSONB), source_type, source_url, source_author,
confidence_score, verification_status, cross_references, contradiction_ids,
discovered_concepts, tags, queue_item_id, batch_id, created_at, updated_at
```

Key fields in `structured_data` (JSONB — varies per finding):
- `key_concepts` — array of strings
- `equations` — array of `{name, formula, variables}`
- `parameters` — array of `{name, value, range, description}`
- `strategy_rules` — string describing entry/exit conditions
- `performance_data` — object with reported metrics
- `conditions` — when this works vs fails
- `risks_and_limitations` — string
- `practical_insights` — implementation tips
- `fee_structure` — object (for exchange findings)
- `api_details` — object (for exchange findings)
- `source_urls` — array of cited URLs

**`trading_research_queue`** — Research topic queue
```
id, category, subcategory, market, topic, research_depth, priority,
status (ready/in_progress/completed/failed/blocked),
depth (0=seed, 1+=synthesis-generated),
discovered_from_id, retry_count, error,
started_at, completed_at, created_at
```

**`trading_research_contradictions`** — Where sources disagree
```
id, finding_a_id, finding_b_id, contradiction_type, description, resolution
```

### RPC for Dashboard Stats
```sql
SELECT * FROM get_trading_research_stats('carlton');
```
Returns:
```json
{
  "total_findings": 24,
  "verified": 0,
  "contradicted": 0,
  "queue_total": 78,
  "queue_ready": 46,
  "queue_completed": 16,
  "queue_failed": 0,
  "by_category": {"technical_indicators": 7, "trading_strategies": 2, ...},
  "by_depth": {"0": 46, "1": 13, "2": 1},
  "avg_confidence": 0.5,
  "total_contradictions": 0,
  "unresolved_contradictions": 0
}
```

### Supabase Connection
- URL: `https://yrwrswyjawmgtxrgbnim.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8`
- All tables have RLS policies allowing full access via anon key

---

## Dashboard Pages to Build

### Page 1: Research Dashboard (Priority 1)

**Purpose:** Monitor the research pipeline progress and browse findings.

**Top Section — Stats Bar:**
- Total findings count
- Queue progress (completed/total with progress bar)
- Depth distribution (how many items at each depth level)
- Math depth breakdown: implementation_ready / partial_math / conceptual_only (pie chart or bar)
- Average confidence score

**Middle Section — Category Coverage Grid:**
- One card per category (technical_indicators, trading_strategies, mathematical_models, etc.)
- Each card shows: finding count, math depth distribution (green/yellow/red dots), latest finding timestamp
- Click a category → filters the findings list below

**Bottom Section — Findings Browser:**
- Sortable/filterable table of all findings
- Columns: Title, Category, Source Type, Confidence, Math Depth, Date
- Click a finding → expands to show:
  - Full summary
  - Equations (rendered nicely — LaTeX if possible, otherwise code blocks)
  - Parameters table
  - Strategy rules
  - Performance data
  - Risks and limitations
  - Source URL link
  - Raw content (collapsible)

**Sidebar — Queue Monitor:**
- Items by status (ready, in_progress, completed, failed)
- Items by depth level
- Currently processing item (if any in_progress)
- Failed items with error messages

### Page 2: Research Report (Priority 1)

**Purpose:** View the generated research report.

**Implementation:** The report workflow returns markdown. Render it with a markdown viewer.

**Trigger button:** "Generate Report" button that calls the report webhook and displays the result.

**Sections in the report:**
- Executive Summary
- Category sections (equations, strategies, exchanges, etc.)
- Contradictions register
- Paper trade candidates

### Page 3: Queue Management (Priority 2)

**Purpose:** View and manage the research queue.

**Features:**
- View all queue items grouped by depth
- See which items are ready, in_progress, completed, failed
- Retry failed items (update status back to ready)
- Add new research questions manually
- Block/unblock items

### Page 4: Trading Dashboard (Priority 3 — Future)

**Purpose:** Once the trading platform is built, this shows live trading activity.

**Planned features:**
- Current positions
- Recent trades with P&L
- Active strategy and its indicator values
- Account balance and equity curve
- Risk metrics (drawdown, position size)
- Paper trade vs live toggle

---

## API Patterns

### Reading data (Supabase REST API)
```javascript
// Get all findings
const { data } = await supabase
  .from('trading_research')
  .select('*')
  .order('category', { ascending: true });

// Get findings by category
const { data } = await supabase
  .from('trading_research')
  .select('*')
  .eq('category', 'technical_indicators');

// Get stats
const { data } = await supabase
  .rpc('get_trading_research_stats', { p_brand_id: 'carlton' });

// Get queue items by depth
const { data } = await supabase
  .from('trading_research_queue')
  .select('*')
  .eq('depth', 0)
  .order('priority', { ascending: true });
```

### Triggering workflows (webhook calls)
```javascript
// Generate report
const response = await fetch('https://n8n.carltonaiservices.com/webhook/trade-research-report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});
const report = await response.json();
// report.report contains the markdown string

// Trigger orchestrator
await fetch('https://n8n.carltonaiservices.com/webhook/trade-research-orchestrator', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ depth: 0 })
});
// Returns 202 immediately, runs in background
```

---

## Research Categories (for display labels)

| Category Key | Display Label |
|-------------|--------------|
| `technical_indicators` | Technical Indicators |
| `trading_strategies` | Trading Strategies |
| `mathematical_models` | Mathematical Models |
| `fee_optimization` | Exchanges & Fees |
| `risk_management` | Risk Management |
| `market_microstructure` | Market Microstructure |
| `backtesting_validation` | Backtesting & Validation |
| `execution_infrastructure` | Execution Infrastructure |
| `market_specific` | Market-Specific |
| `sentiment_alt_data` | Sentiment & Alt Data |
| `regulatory_legal` | Regulatory & Legal |
| `real_world_reports` | Practitioner Insights |

## Verification Status Values

| Status | Meaning | Color Suggestion |
|--------|---------|-----------------|
| `unverified` | Not yet evaluated | Gray |
| `partially_verified` | Some corroboration | Yellow |
| `verified` | Multiple sources agree | Green |
| `contradicted` | Sources disagree | Red |
| `disputed` | Under investigation | Orange |
| `paper_trade_pending` | Ready to test via paper trading | Blue |
| `paper_trade_validated` | Confirmed by paper trading | Dark Green |

## Math Depth Scoring (computed client-side)

```javascript
function getMathDepth(structured_data) {
  const sd = structured_data || {};
  const hasEquations = sd.equations?.length > 0;
  const hasParameters = sd.parameters?.length > 0;
  const hasStrategyRules = !!sd.strategy_rules;
  const hasPerformanceData = sd.performance_data && Object.keys(sd.performance_data).length > 0;
  const score = (hasEquations ? 2 : 0) + (hasParameters ? 2 : 0) +
                (hasStrategyRules ? 1 : 0) + (hasPerformanceData ? 1 : 0);
  if (score >= 4) return 'implementation_ready';  // Green
  if (score >= 2) return 'partial_math';           // Yellow
  return 'conceptual_only';                        // Red
}
```

---

## Design Notes

- All times should display in **Pacific Time** (America/Los_Angeles)
- The system is designed for Bradford Carlton's trading research — brand_id is always 'carlton'
- Equations may contain LaTeX notation — consider a LaTeX renderer (KaTeX is lightweight)
- The dashboard should auto-refresh stats every 30-60 seconds during active research sweeps
- Source types: `perplexity` (AI research), `reddit` (practitioner), `twitter` (practitioner), `synthesis` (system-generated)
