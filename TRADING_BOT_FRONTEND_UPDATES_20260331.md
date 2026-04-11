# Trading Bot — Frontend Updates (2026-03-31)

> Updates to the frontend handoff document (`docs/TRADING_BOT_FRONTEND_HANDOFF.md`) based on real testing results and new modules built since the original spec.

---

## New Data Available in Supabase

### bot_combinations — Now Populated (88,938+ rows)

The backtest sweep has run and populated real data. The frontend can now display actual strategy results.

```
GET /rest/v1/bot_combinations?select=*&order=composite_score.desc.nullslast&limit=20
```

**Sample real data:**
```json
{
  "strategy_name": "vwap_reversion",
  "pair": "HYPE/USDT",
  "timeframe": "5m",
  "order_type": "limit",
  "capital_tier": "C",
  "composite_score": 92.8,
  "avg_profit_per_trade": 0.005588,
  "win_rate": 0.567,
  "trades_per_day": 24.1,
  "max_drawdown": 0.032,
  "total_trades": 724,
  "status": "qualified"
}
```

### bot_events — Has Real Events

```
GET /rest/v1/bot_events?select=*&order=created_at.desc&limit=20
```

### bot_metrics — Has Snapshots

```
GET /rest/v1/bot_metrics?select=*&order=recorded_at.desc&limit=100
```

---

## New Pages to Add

### Page 8: Pattern Discovery Dashboard (Priority 2)

The system now has a `discover` command that finds statistical patterns from raw price data — no named indicators, just pure math on price/volume.

**Discovery Results Display:**

Source: Run `python3 -m src.main discover` on the VPS, results go to SQLite. For now, display from the API endpoint or a new Supabase table (to be created).

**Top Section — Discovery Summary:**
- Total pairs scanned
- Total rules discovered
- Total rules surviving out-of-sample validation
- Last discovery run timestamp

**Discovery Leaderboard Table:**
| Column | Description |
|--------|-------------|
| Rule Name | e.g., "return_20_low AND mean_reversion_20_low" |
| Pair | e.g., "HYPE/USDT" |
| Direction | "buy" or "sell" |
| Avg Forward Return | e.g., +0.0252% |
| Trades/Day | Estimated frequency |
| p-value | Statistical significance (lower = better) |
| Sample Count | How many times rule triggered |
| OOS Survived | Yes/No — did it pass out-of-sample? |

**Filter controls:** By pair, by direction, by OOS status (show only survivors)

**Feature Heatmap (nice to have):**
- Grid showing which features predict price direction for each pair
- Rows = features (34 total), Columns = pairs
- Color = avg forward return (green = positive, red = negative)

### Page 9: Cross-Pair Analysis (Priority 2)

Displays lead-lag relationships between pairs.

**Cross-Pair Edges Table:**
| Column | Description |
|--------|-------------|
| Leader | Pair that moves first |
| Follower | Pair that follows |
| Lag (bars) | How many bars the follower lags |
| Correlation | Return correlation at optimal lag |
| Direction Accuracy | % of time follower moves same direction |
| Expected Profit | After fees |
| Sample Count | Number of events tested |

**Real data from first run:**
```
XRP/USDT → DOGE/USDT: lag=1bar, corr=0.797, dir_acc=97.4%, profit=0.1364%, n=1324
```

### Page 10: Multi-Exchange View (Priority 3)

The system now supports multiple exchanges. Show which exchanges are accessible and their pair counts.

**Exchange Status Cards:**
| Exchange | Pairs | High-Volume | Status |
|----------|-------|-------------|--------|
| OKX | 575 | 65 | Active |
| Gate.io | 6,182 | 83 | Available |
| MEXC | 2,748 | 91 | Available |
| Binance US | 232 | 1 | Dev only |
| Kraken | 48 | 6 | Available |

---

## Updates to Existing Pages

### Page 2: Strategy Explorer — NOW HAS REAL DATA

The `bot_combinations` table now has 88,938 rows from the first backtest sweep. The leaderboard should display:

**Highlight row for HYPE/USDT VWAP Reversion** — this is the only strategy that passed the threshold. Show it prominently with a "QUALIFIED" badge.

**Add filter by exchange:** Since we're using OKX now (not just Binance), add an exchange filter if the data includes exchange info.

**Add "Run Backtest" button:** Trigger a new backtest sweep via the VPS. This would SSH or call an API endpoint to start `python3 -m src.main backtest`. (Future: expose via n8n webhook)

### Page 1: Overview Dashboard — New Metric Cards

Add these cards from the first real results:

| Card | Value | Source |
|------|-------|--------|
| Best Strategy | VWAP Reversion on HYPE/USDT | bot_combinations top 1 |
| Best Avg Profit | +0.56% per trade | bot_combinations |
| Combos Tested | 88,938 | bot_combinations count |
| Combos Passing | 15 | bot_combinations where status=qualified |
| Patterns Found | 689 (89 OOS) | Discovery results |
| Cross-Pair Edges | 1 (XRP→DOGE) | Cross-pair results |

### Page 4: Risk & Circuit Breakers — Add Observation Mode

When no strategies pass the threshold, the system enters "observation mode." Add a banner:

```
⚠ OBSERVATION MODE
No strategies currently meet profitability thresholds.
The system is monitoring and backtesting but not trading.
Last sweep: 88,938 combinations tested, 15 passing.
```

---

## New API Endpoints Needed

The bot currently serves these endpoints. Some are placeholders that need to be populated with real data as the system matures:

### GET /discovery (new)

Returns pattern discovery results. Currently not implemented — needs to be added to `src/api/server.py`. Suggested response:

```json
{
  "last_run": "2026-03-31T20:19:53Z",
  "pairs_scanned": 8,
  "total_rules": 689,
  "oos_survivors": 89,
  "top_rules": [
    {
      "name": "return_20_low AND mean_reversion_20_low",
      "pair": "HYPE/USDT",
      "direction": "buy",
      "avg_return": 0.000252,
      "trades_per_day": 192.5,
      "p_value": 0.0000,
      "samples": 4043,
      "oos_survived": true
    }
  ]
}
```

### GET /cross-pairs (new)

Returns cross-pair edge analysis. Suggested response:

```json
{
  "last_run": "2026-03-31T20:04:38Z",
  "edges": [
    {
      "leader": "XRP/USDT",
      "follower": "DOGE/USDT",
      "lag_bars": 1,
      "correlation": 0.797,
      "direction_accuracy": 0.974,
      "expected_profit": 0.001364,
      "sample_count": 1324
    }
  ]
}
```

---

## Design Notes from Real Data

### HYPE/USDT is the Star

Every visualization should highlight HYPE/USDT — it's the only pair with passing strategies and the richest pattern landscape. Consider:
- A dedicated "HYPE/USDT Deep Dive" section
- Showing its equity curve from the backtest
- Comparing its performance across all 3 capital tiers and order types

### Scores Are High but Profits Are Small

The composite scores go up to 95.3, which looks great. But the actual avg profit per trade is 0.56% — about $0.28 on a $50 trade. The frontend should show both the score AND the dollar amount to keep expectations realistic.

### Most Combinations Fail

88,938 tested, 15 passed (0.017%). The visualization should make this clear — maybe a funnel chart showing how many combos get filtered at each stage.

### OOS Validation Matters

Out-of-sample validation is the quality filter. 689 rules found in-sample but only 89 survived OOS (12.9%). Always show both numbers and highlight OOS survivors.

---

## Supabase Connection (unchanged)

- URL: `https://yrwrswyjawmgtxrgbnim.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8`
- All tables have open RLS policies
