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

## Daily automation (split — the cloud sandbox cannot reach Yahoo)
- **Local:** Windows task `stock-screener-fetch` runs `run-fetch.cmd` 08:00 Tue-Sat local:
  `git pull` → `npm run fetch` → commit + push to GitHub (public repo). Needs PC on + logged in.
- **Cloud:** routine `stock-screener-daily` (trig_01LFj67z31qhLHbXjqm7dDeK), cron `40 0 * * 2-6`
  (00:40 UTC): clone → check data freshness → analysis + flagging + brief subagents →
  email `brief/<date>.md` to benedictgrino6@gmail.com → archive brief to Drive folder
  `stock-screener-snapshots`. If data is >30h stale it emails "no fresh data" instead.
- Repo is PUBLIC (zero secrets) so the cloud clone needs no auth. OI continuity rides the
  committed `data/*.json` history.

## Next
1. Confirm the cloud routine test run emails a real brief (fetch step removed).
2. After ~2 weeks, fill in `flags-log.csv` outcome columns.

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
