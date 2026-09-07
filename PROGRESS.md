# Progress

## Built
- `fetch.ts` — data agent (deterministic script). Pulls price/volume/options/OI for 10
  tickers from Yahoo (yahoo-finance2 v4), writes `data/<session-date>.json`, self-checks.
  Stores a full OI snapshot each run so the next run can diff open interest.
- `.claude/agents/market-analysis.md` — describes options-vs-price gaps, never interprets.
- `.claude/agents/market-flagging.md` — ≤5 research candidates + boring explanation each.
- `WHAT-OPTIONS-VOLUME-TELLS-YOU.md` — the "it's a screener not a signal" guardrail.
- `flags-log.csv` — hit-rate tracking (fill in by hand after 1-2 weeks).
- Sample `analysis/2026-09-04.md` + `flags/2026-09-04.md` — hand-run to show the pipeline.

## Next
1. Run `npm run fetch` a second day → get real OI-change numbers (first run has none).
2. Run the two subagents in Claude Code opened in this folder, compare to the hand-written samples.
3. After ~2 weeks, fill in `flags-log.csv` outcome columns.

## Decisions
- Data agent is a script, not an LLM — LLMs can't reliably fetch structured market data.
- Nearest 3 expirations only (carry most volume; far-dated blocks are missed).
- File named by last trading session date, not fetch date (Labor Day / weekend safe).
- Free Yahoo data: delayed ~15min, OI lags one session. Fine for a daily screener.

## Known noise
- Deep-OTM strikes with 0 OI and 100%+ implied vol appear across names — ignore them.
- SPY/QQQ have no earnings events (ETFs) — expected, not an error.
