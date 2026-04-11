# Trading Desk — Frontend Specification

**For:** Frontend developer building the Trading Desk at `rdgr.bradfordcarlton.com/trading-desk`
**Date:** 2026-04-04
**Backend status:** Paper trading bot running on VPS, pushing data to Supabase in real-time

---

## Overview

Build a "Trading Desk" dashboard that feels like a Cookie Clicker / idle game for crypto trading. The user manages **capital blocks** — each block is a trading slot that runs autonomously. They can add/remove blocks at different tiers, and watch trades stream in live as the bot executes them.

The bot runs on a VPS and pushes all data to Supabase. The frontend reads exclusively from Supabase (REST for historical data, Realtime for live updates). There is no direct connection to the bot API.

---

## Data Sources

### Supabase Connection
- URL: `https://yrwrswyjawmgtxrgbnim.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8`
- Include Supabase JS v2 CDN: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`

### Tables Used

| Table | Purpose | How to read |
|-------|---------|-------------|
| `bot_metrics` | Equity, drawdown, positions, status | Realtime subscription (INSERT) + REST for history |
| `bot_trades` | Every completed trade | Realtime subscription (INSERT) + REST for history |
| `bot_events` | Alerts, status changes, trade notifications | Realtime subscription (INSERT) |
| `bot_playbook` | Active strategy configurations | REST on page load |
| `bot_config` | Capital block definitions (future) | REST on page load |

### Realtime Setup

```js
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

sb.channel('trading-desk')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bot_metrics' }, handleMetrics)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bot_trades' }, handleNewTrade)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bot_events' }, handleEvent)
  .subscribe();
```

The bot pushes:
- **Metrics** every 60 seconds (heartbeat)
- **Trades** instantly when a trade opens or closes
- **Events** on alerts, drawdown warnings, bot start/stop

---

## Page Layout

### Header Bar (fixed, always visible)
- **Bot Status Indicator**: Green pulsing dot + "LIVE" when connected, yellow "CONNECTING", red "OFFLINE"
- **Mode Badge**: "PAPER" (blue) or "LIVE" (red) — from `bot_metrics.mode`
- **Equity**: Large number, e.g., "$103.50" — from latest `bot_metrics.equity`
- **Today's P&L**: "+$3.50" (green) or "-$1.20" (red) — from `bot_metrics.daily_pnl` field (maps to `realized_pnl_today` in Supabase)
- **Drawdown Gauge**: Small horizontal bar, 0-20%, color gradient green -> yellow -> red

### Section 1: Capital Blocks (top section, most prominent)

This is the Cookie Clicker core. Each **block tier** is a card showing:

```
+------------------------------------------+
|  $50 Quick Flip                          |
|  Hold: 5 min max                         |
|                                          |
|  Active: [2] blocks                      |
|  [ - ]  ██ ██  [ + ]                    |
|                                          |
|  Today: 14 trades | +$1.82 | 68% WR     |
+------------------------------------------+
```

**Block Tiers** (initially hardcoded, later configurable via `bot_config`):

| Tier | Trade Size | Max Hold | Name |
|------|-----------|----------|------|
| 1 | $50 | 5 min | Quick Flip |
| 2 | $250 | 1 hour | Swing |
| 3 | $1,000 | 5 hours | Position |

**Each tier card shows:**
- Tier name and parameters (trade size, max hold time)
- **Active block count** — how many concurrent position slots this tier has
- **Plus/Minus buttons** — increment or decrement the block count
  - Plus (+): Adds one more concurrent trading slot for this tier
  - Minus (-): Removes one slot (minimum 0). If a position is open in that slot, it closes at market on next bar.
  - The buttons should feel satisfying to click (subtle animation, count updates instantly)
  - Disabled state: minus disabled at 0, plus disabled at max (configurable, default 10)
- **Visual blocks**: Small filled squares representing each active slot. Filled green when a position is open, outlined when idle/waiting for signal.
- **Today's stats for this tier**: trade count, P&L, win rate

**How blocks map to the bot:**
The frontend writes the block configuration to `bot_config` (or a new `capital_blocks` table). The bot reads this on each evaluation cycle and adjusts `max_concurrent_positions` accordingly. Each block = 1 concurrent position slot. Total concurrent positions = sum of all blocks across all tiers.

**Important:** For this first version, blocks are visual only. The bot currently has `MAX_POSITIONS=1` in its `.env`. The actual position limit change requires a backend update (reading from Supabase). Show the blocks UI now — it will become functional when the backend is updated.

For now, store block counts in `localStorage` (key: `trading-desk-blocks`) and display them. The backend integration comes next.

---

### Section 2: Live Trade Feed (center, scrolling)

A chronological feed of trades as they happen. New trades push in at the top, old ones scroll down and eventually leave view.

**Each trade entry:**
```
[07:15:32 PT]  BUY  RENDER/USDT  +$0.78 (+1.56%)
               mean_reversion | 5m | held 3 bars
```

**Design:**
- **Green left border** for wins (pnl > 0), **red left border** for losses
- Timestamp in Pacific time (America/Los_Angeles)
- Pair name is prominent
- P&L in dollars and percentage
- Strategy name, timeframe, and hold duration in smaller text below
- **Animate in**: new trades slide in from top with a brief highlight glow
- **Feed depth**: Show last 50 trades, then they scroll off
- If no trades yet: "Waiting for signals... Strategies are evaluating market conditions."

**Data source:**
- On page load: `GET /rest/v1/bot_trades?order=closed_at.desc&limit=50&brand_id=eq.carlton`
- Live: Realtime subscription on `bot_trades` INSERT events
- For `trade_opened` events (from `bot_events` where `event_type = 'trade_opened'`), show as a pending entry: "[OPEN] BUY RENDER/USDT @ $1.92 ..."

**Trade entry fields from `bot_trades`:**

| Field | Display |
|-------|---------|
| `closed_at` | Timestamp (convert to Pacific) |
| `side` | BUY or SELL badge |
| `pair` | Pair name |
| `pnl` | Dollar P&L with +/- sign |
| `pnl_pct` | Percentage P&L |
| `strategy_name` | Strategy label |
| `entry_price` | Show on expand/hover |
| `exit_price` | Show on expand/hover |
| `entry_reason` | Show on expand/hover |
| `exit_reason` | Show on expand/hover |

---

### Section 3: Performance Summary (right sidebar or below)

**Stats Cards:**

| Metric | Source | Format |
|--------|--------|--------|
| Total Equity | `bot_metrics.equity` | $103.50 |
| Peak Equity | `bot_metrics.peak_equity` | $105.00 |
| Drawdown | `bot_metrics.drawdown_pct` | 1.4% (gauge) |
| Today's Trades | `bot_metrics.total_trades_today` | 14 |
| Today's Win Rate | `bot_metrics.win_rate` | 68.2% |
| Active Strategies | `bot_metrics.active_strategies` | 929 |
| Open Positions | `bot_metrics.open_positions` | 1 |
| Circuit Breaker | `bot_metrics.bot_status` | "normal" (green) / "halted" (red) |

**Mini Equity Chart:**
- Sparkline or small line chart showing equity over last 24 hours
- Source: `bot_metrics` ordered by `created_at`, last 1440 rows (24h at 1/min)
- Show peak equity as a dotted line

**Alert Feed (below stats):**
- Last 5 events from `bot_events` where `severity` is `warning` or `critical`
- Color: yellow for warning, red for critical
- Example: "Drawdown alert: 18% — approaching halt threshold"

---

### Section 4: Playbook Overview (collapsible panel)

Shows what strategies the bot is running.

**Query:** `GET /rest/v1/bot_playbook?brand_id=eq.carlton&status=eq.active&order=bt_avg_profit.desc&limit=20`

**Table columns:**

| Column | Field | Format |
|--------|-------|--------|
| Strategy | `strategy_name` | Text |
| Pair | `pair` | Text |
| Timeframe | `timeframe` | "5m" |
| Backtest WR | `bt_win_rate` | 65.2% |
| Backtest Profit | `bt_avg_profit` | 0.21% |
| Live Trades | `live_total_trades` | 14 |
| Live WR | `live_win_rate` | 60.0% |
| Live P&L | `live_total_pnl` | +$2.30 |
| Status | `status` | active/paused badge |

**Pause/Resume button** per row: PATCH to `bot_playbook` changing `status` between `active` and `paused`. The bot reads this on next cycle.

---

## Supabase Table Schemas (exact columns)

### `bot_metrics` (heartbeat every 60s)
```
id              BIGSERIAL PRIMARY KEY
brand_id        TEXT DEFAULT 'carlton'
mode            TEXT DEFAULT 'paper'        -- "paper" or "live"
equity          NUMERIC                     -- current portfolio value
peak_equity     NUMERIC                     -- all-time high equity
drawdown_pct    NUMERIC                     -- 0.0 to 1.0
open_positions  INTEGER                     -- currently open trades
active_strategies INTEGER                   -- strategies evaluating
total_trades_today INTEGER                  -- trades closed today
win_rate        NUMERIC                     -- today's win rate (0.0-1.0)
daily_pnl       NUMERIC                     -- maps to realized_pnl_today column
bot_status      TEXT DEFAULT 'healthy'      -- "normal", "reduced", "halted", "observation"
circuit_breaker BOOLEAN DEFAULT FALSE       -- true = trading halted
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### `bot_trades` (instant on trade close)
```
id              BIGSERIAL PRIMARY KEY
brand_id        TEXT DEFAULT 'carlton'
trade_id        TEXT UNIQUE
combination_id  TEXT                        -- links to playbook entry
strategy_name   TEXT
pair            TEXT
timeframe       TEXT                        -- "1m", "5m"
side            TEXT                        -- "buy" or "sell"
entry_price     NUMERIC
exit_price      NUMERIC
quantity        NUMERIC
pnl             NUMERIC                     -- realized P&L in USDT
pnl_pct         NUMERIC                     -- P&L as decimal (0.015 = 1.5%)
fees_paid       NUMERIC
order_type      TEXT DEFAULT 'hybrid'
mode            TEXT DEFAULT 'paper'
entry_reason    TEXT
exit_reason     TEXT
signal_data     JSONB
status          TEXT DEFAULT 'open'         -- "open" or "filled"
opened_at       TIMESTAMPTZ
closed_at       TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### `bot_events` (on trade + alert + status change)
```
id              BIGSERIAL PRIMARY KEY
brand_id        TEXT DEFAULT 'carlton'
event_type      TEXT                        -- "trade_closed", "trade_opened", "drawdown_alert",
                                            -- "bot_started", "bot_stopped", "daily_summary"
severity        TEXT DEFAULT 'info'         -- "info", "warning", "critical"
message         TEXT                        -- human-readable summary
details         JSONB                       -- structured data
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### `bot_playbook` (strategy configurations)
```
uid             TEXT PRIMARY KEY
brand_id        TEXT DEFAULT 'carlton'
strategy_name   TEXT
pair            TEXT
timeframe       TEXT
order_type      TEXT
capital_tier    TEXT
parameters      JSONB
status          TEXT DEFAULT 'active'       -- "active", "paused", "retired"
bt_avg_profit   NUMERIC                     -- backtest expected profit per trade
bt_win_rate     NUMERIC                     -- backtest win rate
bt_trades_per_day NUMERIC                   -- backtest frequency
live_total_trades INTEGER DEFAULT 0         -- actual trades executed
live_wins       INTEGER DEFAULT 0
live_total_pnl  NUMERIC DEFAULT 0
live_win_rate   NUMERIC DEFAULT 0
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

---

## Capital Block System (Future Backend Integration)

When the backend is updated to read block configs from Supabase:

### New table: `capital_blocks`
```
id              BIGSERIAL PRIMARY KEY
brand_id        TEXT DEFAULT 'carlton'
tier_name       TEXT                        -- "quick_flip", "swing", "position"
trade_size      NUMERIC                     -- $50, $250, $1000
max_hold_minutes INTEGER                    -- 5, 60, 300
active_count    INTEGER DEFAULT 0           -- how many blocks user has activated
max_count       INTEGER DEFAULT 10          -- maximum blocks per tier
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**Frontend writes:** When user clicks +/-, PATCH `capital_blocks` row to update `active_count`.
**Bot reads:** On each evaluation cycle, queries `capital_blocks` to determine total concurrent position slots and per-tier sizing rules.

For now, store in `localStorage` and display visually. The backend hookup is a separate task.

---

## Real-Time Behavior

### On Page Load
1. Initialize Supabase client
2. Fetch latest metrics: `GET /rest/v1/bot_metrics?brand_id=eq.carlton&order=created_at.desc&limit=1`
3. Fetch recent trades: `GET /rest/v1/bot_trades?brand_id=eq.carlton&order=closed_at.desc&limit=50`
4. Fetch active playbook: `GET /rest/v1/bot_playbook?brand_id=eq.carlton&status=eq.active&order=bt_avg_profit.desc`
5. Fetch recent alerts: `GET /rest/v1/bot_events?brand_id=eq.carlton&severity=in.(warning,critical)&order=created_at.desc&limit=5`
6. Subscribe to Realtime channel

### On Metrics Insert (every 60s)
- Update header equity, P&L, drawdown gauge
- Update stats cards
- Append to equity chart data

### On Trade Insert (instant)
- Prepend trade to feed with slide-in animation
- Update trade count in header
- Flash the relevant capital block green briefly
- Play subtle sound effect (optional, configurable)

### On Event Insert
- If severity = "critical": Show toast notification at top of page
- If severity = "warning": Show yellow toast
- Append to alert feed

### Connection Loss
- If Realtime disconnects: Show yellow "RECONNECTING..." in header
- Auto-reconnect with exponential backoff (Supabase client handles this)
- On reconnect: Fetch latest data via REST to catch up on missed events

---

## Design Notes

- Follow existing RDGR dashboard theming (CSS variables, dark theme, Chakra Petch headings, IBM Plex Sans body)
- Mobile-responsive: Stack sections vertically on mobile, trade feed takes priority
- Capital block buttons should feel tactile — use scale transform on click, brief color flash
- Trade feed should feel alive — smooth animations, not jarring jumps
- Green = money made. Red = money lost. Keep it simple.
- "PAPER" mode badge should be visible at all times so there's no confusion about real money

---

## Page Location

- Source: `c:/Users/bradf/Documents/Claude Built Websites/sites/rdgr-dashboard/trading-desk.html`
- Deploy: `c:/Users/bradf/Documents/rdgr-dashboard-deploy/trading-desk/index.html`
- URL: `https://rdgr.bradfordcarlton.com/trading-desk`
