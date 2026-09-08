# Progress

## Built
- `fetch.ts` — data agent (deterministic script). Pulls price/volume/options/OI for 10
  tickers from Yahoo (yahoo-finance2 v4), writes `data/<session-date>.json`, self-checks.
  Stores a full OI snapshot each run so the next run can diff open interest.
  Also: IV skew (~5% OTM put IV − call IV), dollar-weighted premium traded (call vs put),
  and a `sectors` rollup ranked by premium call/put ratio vs avg price change.
- `.claude/agents/market-analysis.md` — describes options-vs-price gaps, never interprets.
- `.claude/agents/market-flagging.md` — ≤5 research candidates + boring explanation each.
- `.claude/agents/market-brief.md` — 4th step: each flag in plain language (significance +
  opportunity), no buy/sell, no conviction. `brief/<date>.md` is what gets emailed.
- `WHAT-OPTIONS-VOLUME-TELLS-YOU.md` — the "it's a screener not a signal" guardrail.
- `flags-log.csv` — hit-rate tracking (fill in by hand after 1-2 weeks).
- Samples: `analysis/`, `flags/`, `brief/` for 2026-09-08 (real OI deltas vs 09-04 prior).
- Windows scheduled task `stock-screener-fetch` runs the fetch 8am Tue–Sat.

## Next
1. Cloud routine for the emailed daily brief — BLOCKED on Benedict: `gh auth login` +
   connect GitHub at claude.ai, then push repo + create routine.
2. Run the 4 subagents in Claude Code opened in this folder, compare to the samples.
3. After ~2 weeks, fill in `flags-log.csv` outcome columns.
4. Research real-time options-flow sources for the 10-name watchlist + report cost (no wiring yet).

## Decisions
- Data agent is a script, not an LLM — LLMs can't reliably fetch structured market data.
- Nearest 3 expirations only (carry most volume; far-dated blocks are missed).
- File named by last trading session date, not fetch date (Labor Day / weekend safe).
- Free Yahoo data: delayed ~15min, OI lags one session. Fine for a daily screener.
- 4th step is `market-brief` (plain-language significance + opportunity), NOT a trade agent.
  Benedict considered an explicit buy/sell + conviction call and decided against it; the
  guide deliberately stops at flagging.

## Known noise
- Deep-OTM strikes with 0 OI and 100%+ implied vol appear across names — ignore them.
- SPY/QQQ have no earnings events (ETFs) — expected, not an error.
