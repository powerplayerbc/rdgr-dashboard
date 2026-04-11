# Session Handoff — 2026-03-30

## What Was Built
A complete **trading research pipeline** — 7 n8n workflows that autonomously gather, structure, evaluate, and report on mathematical trading knowledge for building an autonomous crypto scalping platform.

## Key Decisions Made
1. **Pull-model, not push-model** — Synthesis decides what to research next (not each item blindly generating follow-ups). This prevents exponential fan-out.
2. **Math depth evaluation** — Findings are scored on whether they contain actual equations/parameters (implementation_ready) vs just concept names (conceptual_only).
3. **Breadth-first processing** — All depth-0 items complete before synthesis runs, then all depth-1, etc.
4. **No hardcoded depth limit** — System runs until synthesis says "ready for report" or hits the 750-item queue cap.
5. **Deterministic reports** — Report workflow uses Code nodes (no AI) to assemble markdown from structured Supabase data.

## Bugs Found and Fixed
| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Perplexity returned wrong content | Webhook data nested in `.body`, Code read `$json.topic` (undefined) | Use `$json.body \|\| $json` pattern |
| OpenAI "invalid syntax" | Expressions with special chars in jsonBody broke evaluation | Pre-build bodies in Code nodes via JSON.stringify |
| Reddit Wait 90s timeout | Code node setTimeout exceeded 60s hard limit | Replaced with native Wait node |
| Orchestrator execution storm | Recursive self-calls cascaded when dependency was down | Added error detection — stop on API failures |
| Synthesis too shallow | LLM used own knowledge to mark topics as "covered" | Added math depth scoring, structured_data evaluation |
| Exponential fan-out (2→27→49→300+) | Push model: every finding generated 10-15 follow-ups | Switched to pull model: synthesis is sole gatekeeper |

## Current State
- **46 seed questions** loaded in `trading_research_queue` (all depth-0, status=ready)
- **0 findings** (clean slate, ready for full sweep)
- All 7 workflows registered in `system_registry` (IDs 475-482)
- Reddit credential registered (ID 482, credential `f9C04f85zkbJVwjV`)

## Estimated Costs for Full Sweep
- Perplexity: ~$0.50 per depth level (46 items x $0.01)
- OpenAI structuring: ~$0.25 per depth level
- Synthesis: ~$0.05 per pass
- Total depth-0: ~$0.75. With 2-3 depth levels: ~$3-5 total

## Session Timing
- Started: ~2026-03-29 23:00 PDT
- Ended: ~2026-03-30 01:15 PDT
- Duration: ~2.5 hours
