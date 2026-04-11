# Trading Bot — Frontend Handoff

## Purpose

Build a dashboard for the crypto trading bot. The bot runs as a Python service exposing a REST API on port 8420. All data is available via these endpoints AND via Supabase tables (for historical data). The frontend reads from both.

---

## Bot API Endpoints (Real-Time Data)

Base URL: `http://localhost:8420` (local dev) or `http://crypto-trading-bot:8420` (Docker)

When deployed on VPS, the API should be reverse-proxied behind a subdomain (e.g., `https://trading.carltonaiservices.com`).

### GET /health

Liveness check. Poll every 30 seconds.

```json
{
  "status": "healthy",           // "healthy" | "degraded" | "down"
  "uptime_seconds": 43200,
  "mode": "paper",               // "paper" | "live"
  "version": "0.1.0",
  "circuit_breaker": {
    "level": "normal",           // "normal" | "reduced" | "halted" | "observation"
    "can_trade": true,
    "position_scale": 1.0,       // 1.0 = full, 0.5 = reduced, 0.0 = stopped
    "trigger_reason": "",
    "triggered_at": null,
    "resume_at": null
  },
  "equity": 103.50
}
```

### GET /metrics

Current performance snapshot. Poll every 60 seconds.

```json
{
  "equity": 103.50,
  "peak_equity": 105.00,
  "drawdown_pct": 0.014,        // 0.0 - 1.0 (1.4% drawdown)
  "open_positions": 1,
  "total_exposure": 50.0,
  "daily_pnl": 3.50,
  "consecutive_losses": 0,
  "mode": "paper",
  "circuit_breaker": { ... },    // same as /health
  "today": {
    "total_trades": 12,
    "wins": 8,
    "total_pnl": 3.50,
    "avg_pnl": 0.29,
    "win_rate": 0.667
  }
}
```

### GET /strategies

Strategy exploration results and active strategy instances.

```json
{
  "exploration_summary": {
    "total_tested": 29646,
    "total_passing": 14,
    "top_score": 68.2,
    "top_avg_profit": 0.0032,
    "best_combo": {
      "strategy_name": "mean_reversion",
      "pair": "ETH/USDT",
      "timeframe": "5m",
      "order_type": "limit",
      "capital_tier": "A"
    },
    "strategies_passing": ["mean_reversion", "vwap_reversion"],
    "pairs_passing": ["ETH/USDT", "BTC/USDT", "SOL/USDT"]
  },
  "total_candidates": 20,
  "total_passing": 14,
  "top_20": [
    {
      "uid": "a1b2c3d4e5f6",
      "strategy_name": "mean_reversion",
      "pair": "ETH/USDT",
      "timeframe": "5m",
      "order_type": "limit",
      "capital_tier": "A",
      "parameters": "{\"entry_zscore\": 2.0, \"adx_threshold\": 25}",
      "avg_profit": 0.0032,
      "win_rate": 0.72,
      "trades_per_day": 8.5,
      "max_drawdown": 0.03,
      "composite_score": 68.2,
      "total_trades": 142,
      "net_pnl": 4.56,
      "passed_threshold": 1
    }
  ]
}
```

### GET /trades/recent?limit=20&mode=paper

Recent completed trades.

```json
{
  "trades": [
    {
      "trade_id": "abc123",
      "combination_uid": "a1b2c3d4e5f6",
      "strategy_name": "mean_reversion",
      "pair": "ETH/USDT",
      "side": "buy",
      "entry_price": 1850.25,
      "exit_price": 1853.10,
      "quantity": 0.027,
      "pnl": 0.08,
      "pnl_pct": 0.0015,
      "fees": 0.04,
      "mode": "paper",
      "entry_reason": "bb_zscore=-2.1, rsi=28, adx=18",
      "exit_reason": "bb_zscore returned to 0",
      "opened_at": "2026-03-31T08:15:00Z",
      "closed_at": "2026-03-31T08:22:00Z"
    }
  ]
}
```

### GET /exploration

Raw exploration engine state.

```json
{
  "total_tested": 29646,
  "total_passing": 14,
  "top_score": 68.2,
  "top_avg_profit": 0.0032,
  "best_combo": { ... },
  "strategies_passing": ["mean_reversion", "vwap_reversion"],
  "pairs_passing": ["ETH/USDT", "BTC/USDT"]
}
```

### POST /control

Control the bot. Body is JSON.

```json
// Start trading
{"action": "start", "confirm": false}

// Stop trading (close positions gracefully)
{"action": "stop", "confirm": false}

// Resume after circuit breaker halt
{"action": "resume", "confirm": false}

// Emergency close all positions
{"action": "emergency_close", "confirm": true}

// Get current status
{"action": "status", "confirm": false}
```

Response:
```json
{"action": "resume", "result": "ok"}
```

Emergency close returns error 400 if `confirm` is not `true`.

### GET /tax?year=2026

Tax report (FIFO cost basis).

```json
{
  "total_dispositions": 450,
  "total_gain": 12.50,
  "total_loss": -8.20,
  "net_gain_loss": 4.30,
  "wash_sale_disallowed": 1.20,
  "adjusted_net": 5.50,
  "short_term_count": 450,
  "long_term_count": 0
}
```

---

## Supabase Tables (Historical Data)

Connection:
- URL: `https://yrwrswyjawmgtxrgbnim.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8`
- All tables have open RLS policies (anon key has full access)

### bot_config

Key-value configuration store. 14 rows with keys like `mode`, `starting_equity`, `min_trade_size`, etc.

```
GET /rest/v1/bot_config?select=key,value,description&order=key
```

### bot_combinations

Strategy+pair+timeframe combinations with backtest scores. This is the main exploration results table.

```
-- Top 20 passing combinations
GET /rest/v1/bot_combinations?select=*&status=eq.qualified&order=composite_score.desc&limit=20

-- All results for a specific pair
GET /rest/v1/bot_combinations?select=*&pair=eq.ETH/USDT&order=composite_score.desc
```

Key columns:
| Column | Type | Description |
|--------|------|-------------|
| strategy_name | text | e.g., "mean_reversion" |
| pair | text | e.g., "ETH/USDT" |
| timeframe | text | "1m" or "5m" |
| order_type | text | "limit", "market", "hybrid" |
| capital_tier | text | "A" ($100), "B" ($200), "C" ($500) |
| parameters | jsonb | Strategy params |
| status | text | "candidate", "qualified", "paper_trading", "live", "demoted" |
| avg_profit_per_trade | float | Primary metric |
| win_rate | float | 0.0 - 1.0 |
| trades_per_day | float | Trade frequency |
| max_drawdown | float | 0.0 - 1.0 |
| composite_score | float | 0 - 100 |
| total_trades | int | Backtest trade count |
| last_backtest_at | timestamptz | When last tested |

### bot_trades

Every executed trade (paper or live).

```
-- Recent trades
GET /rest/v1/bot_trades?select=*&order=closed_at.desc&limit=50

-- Today's trades
GET /rest/v1/bot_trades?select=*&closed_at=gte.2026-03-31T00:00:00Z&order=closed_at.desc

-- Trades for a specific strategy
GET /rest/v1/bot_trades?select=*&strategy_name=eq.mean_reversion&order=closed_at.desc
```

Key columns:
| Column | Type | Description |
|--------|------|-------------|
| trade_id | text | Unique ID |
| strategy_name | text | Which strategy |
| pair | text | Trading pair |
| side | text | "buy" or "sell" |
| entry_price | numeric | Entry fill price |
| exit_price | numeric | Exit fill price |
| quantity | numeric | Amount traded |
| pnl | numeric | Realized P&L in USDT |
| pnl_pct | numeric | P&L as percentage |
| fees_paid | numeric | Total fees |
| order_type | text | "limit", "market", "hybrid" |
| mode | text | "paper" or "live" |
| entry_reason | text | Why entered |
| exit_reason | text | Why exited |
| signal_data | jsonb | Indicator snapshot at signal time |
| opened_at | timestamptz | Entry time |
| closed_at | timestamptz | Exit time |

### bot_metrics

Time-series performance snapshots (every 5 minutes when bot is running, synced hourly to Supabase).

```
-- Last 24 hours of metrics
GET /rest/v1/bot_metrics?select=*&recorded_at=gte.2026-03-30T08:00:00Z&order=recorded_at.desc
```

Key columns: `equity`, `drawdown_pct`, `open_positions`, `active_strategies`, `total_trades_today`, `avg_profit_per_trade`, `win_rate`, `bot_status`, `circuit_breaker`.

### bot_events

State changes, alerts, control actions. Useful for audit trail and notification history.

```
GET /rest/v1/bot_events?select=*&order=created_at.desc&limit=50
```

Key columns: `event_type`, `severity` (info/warning/critical), `message`, `details` (jsonb).

### bot_pair_universe

Qualifying trading pairs with liquidity data.

```
GET /rest/v1/bot_pair_universe?select=*&is_qualified=eq.true&order=volume_24h.desc
```

### bot_tax_lots

FIFO cost basis lots for tax tracking.

---

## Dashboard Pages

### Page 1: Overview Dashboard (Priority 1)

**Real-time status bar at top:**
- Bot status indicator (green/yellow/red based on /health status)
- Mode badge ("PAPER" in blue, "LIVE" in red)
- Equity display with change since start
- Circuit breaker level indicator

**Key metrics cards row:**
| Card | Source | Format |
|------|--------|--------|
| Equity | `/metrics` → equity | $103.50 |
| Today's P&L | `/metrics` → today.total_pnl | +$3.50 (green/red) |
| Win Rate | `/metrics` → today.win_rate | 66.7% |
| Trades Today | `/metrics` → today.total_trades | 12 |
| Drawdown | `/metrics` → drawdown_pct | 1.4% (warn if > 10%) |
| Open Positions | `/metrics` → open_positions | 1 of 2 max |

**Equity curve chart (large, center):**
- Source: Supabase `bot_metrics` table, `equity` column over time
- Line chart, x-axis = time, y-axis = equity in USDT
- Show peak equity line (dotted)
- Show drawdown shading (area between equity and peak)
- Timeframe toggles: 24h, 7d, 30d, all

**Recent trades table (below chart):**
- Source: `/trades/recent?limit=20`
- Columns: Time, Pair, Side, Entry, Exit, P&L, Strategy, Duration
- Color P&L green (positive) or red (negative)
- Click a trade → expand to show signal_data (indicator values at entry)

### Page 2: Strategy Explorer (Priority 1)

**Exploration status:**
- Total combinations tested
- Total passing threshold
- Last sweep timestamp
- Next sweep (daily at 00:00 UTC)
- Source: `/strategies` endpoint

**Strategy leaderboard table:**
- Source: Supabase `bot_combinations` ordered by `composite_score DESC`
- Columns: Rank, Strategy, Pair, TF, Order Type, Tier, Avg Profit, Win Rate, Trades/Day, MDD, Score, Status
- Color-code status: green=qualified, blue=paper_trading, gray=candidate, red=demoted
- Filter controls: by strategy_name, by pair, by status, by capital_tier
- Search box for pair name

**Strategy detail panel (click a row):**
- Full backtest results from `backtest_results` jsonb column
- Parameters used
- Indicator configuration
- Performance chart (if available)

**Capital tier comparison:**
- For any given strategy+pair combo, show the results across all 3 tiers side by side
- Answers: "Do I need $500 to make this work, or does $100 suffice?"

### Page 3: Live Trading Monitor (Priority 2)

**Active strategy instances:**
- Source: `/strategies` → active instances from trading engine
- Show for each: pair, strategy, timeframe, current position (if any), bars processed
- Green dot = actively receiving data, gray = idle

**Open positions:**
- Current open positions with real-time P&L
- Entry price, current price, unrealized P&L
- Stop loss and take profit levels (if set)

**Trade feed (real-time):**
- Auto-updating list of trades as they happen
- Poll `/trades/recent` every 10 seconds
- New trades animate in at the top

### Page 4: Risk & Circuit Breakers (Priority 2)

**Risk dashboard:**
- Portfolio risk manager status from `/metrics`
- Visual drawdown gauge (0% - 20%, color gradient green → yellow → red)
- Daily P&L bar chart (last 30 days, from `bot_metrics`)
- Consecutive loss counter

**Circuit breaker panel:**
- Current level with visual indicator
- Level thresholds and current values:
  - Drawdown: current vs 10%/15%/20% thresholds (progress bar)
  - Daily loss: current vs 5% threshold
  - Consecutive losses: current vs 3 threshold
- History of circuit breaker triggers from `bot_events`

**Control buttons:**
- Resume Trading (calls POST /control with action=resume)
- Emergency Close All (calls POST /control with action=emergency_close, confirm=true)
  - Should have a confirmation modal: "Are you sure? This will close all positions at market price."
- Start / Stop bot

### Page 5: Configuration (Priority 3)

**Config editor:**
- Source: Supabase `bot_config` table
- Display all config keys with current values and descriptions
- Editable fields for: mode, min_trade_size, starting_equity, daily_loss_limit_pct, drawdown thresholds
- Save button → PATCH to Supabase `bot_config`
- Non-editable fields shown as read-only (health_port, etc.)

**Pair universe browser:**
- Source: Supabase `bot_pair_universe`
- Table: Symbol, Volume 24h, Spread, Qualified (yes/no), Last Scanned
- Filter: qualified only toggle
- Sort by volume

### Page 6: Reports (Priority 3)

**Daily report viewer:**
- Trigger on-demand report via n8n webhook: `POST https://n8n.carltonaiservices.com/webhook/trade-bot-daily-report`
- Display returned HTML report
- Historical reports from `bot_events` where event_type = "daily_report"

**Performance report:**
- Trigger via: `POST https://n8n.carltonaiservices.com/webhook/trade-bot-performance`
- Body: `{"report_type": "summary"}` or `{"report_type": "exploration"}` or `{"report_type": "tax", "year": 2026}`
- Display returned data

**Tax report:**
- Year selector
- Summary: total gains, total losses, wash sale adjustments, net
- Table of individual dispositions (from bot_tax_lots if available)

### Page 7: Event Log (Priority 3)

**Chronological event log:**
- Source: Supabase `bot_events` ordered by `created_at DESC`
- Filter by event_type, severity
- Color-code severity: info=gray, warning=yellow, critical=red
- Auto-refresh every 30 seconds

---

## Technical Notes

### Polling Strategy

| Data | Source | Poll Interval | Notes |
|------|--------|--------------|-------|
| Health | Bot API /health | 30s | Status indicator |
| Metrics | Bot API /metrics | 60s | Dashboard cards + equity |
| Strategies | Bot API /strategies | 5 min | Exploration results |
| Recent trades | Bot API /trades/recent | 10s | Trade feed |
| Equity curve | Supabase bot_metrics | 5 min | Historical chart |
| Leaderboard | Supabase bot_combinations | 5 min | Strategy rankings |
| Events | Supabase bot_events | 30s | Event log |
| Config | Supabase bot_config | On page load | Settings page |
| Pair universe | Supabase bot_pair_universe | On page load | Pair browser |

### Error Handling

- If bot API returns non-200: show "Bot Offline" status in red
- If Supabase returns non-200: show stale data with "Last updated X minutes ago" warning
- If bot is in observation mode (no strategies passing): show prominent banner explaining why

### Authentication

No authentication on the bot API currently (internal network only). If the API is exposed publicly, add API key header authentication.

For Supabase, use the anon key in the `apikey` header.

### n8n Webhook URLs

| Purpose | URL | Method |
|---------|-----|--------|
| Trigger daily report | `https://n8n.carltonaiservices.com/webhook/trade-bot-daily-report` | POST |
| Trigger performance report | `https://n8n.carltonaiservices.com/webhook/trade-bot-performance` | POST |
| Send control command | `https://n8n.carltonaiservices.com/webhook/trade-bot-control` | POST |

### n8n Workflow IDs (for reference)

| Workflow | n8n ID |
|----------|--------|
| TRADE-BOT-MONITOR | `1imLu2jNJwq2s9TT` |
| TRADE-BOT-CONTROL | `vkOhP1kwuVENuTA4` |
| TRADE-BOT-DAILY-REPORT | `D2kLdtKikKnaY1xT` |
| TRADE-BOT-PERFORMANCE | `gLunW0PO1zQV2Jzp` |

---

## Design Direction

### Color Scheme
- Green: positive P&L, healthy status, qualified strategies
- Red: negative P&L, critical alerts, emergency actions
- Yellow: warnings, circuit breaker triggers, degraded status
- Blue: paper mode badge, informational
- Gray: inactive, candidate strategies, observation mode

### Key UX Principles
- **Always show mode prominently** — users must always know if they're looking at paper or live data
- **P&L is king** — the equity curve and daily P&L should be the most prominent elements
- **No trading without visibility** — all open positions and active strategies must be visible at a glance
- **Circuit breaker = big red warning** — if trading is halted, make it impossible to miss
- **Mobile-friendly** — Bradford will check this on his phone. The overview page must work at 375px width.

---

## Deployment

The frontend should be deployed to Coolify on the existing VPS alongside the bot and n8n, or as a static site on `pages.bradfordcarlton.com`. If using the existing `claude-built-websites` repo pattern, deploy via git push to Coolify.
