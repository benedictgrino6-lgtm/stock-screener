# Progress

## Built
- `fetch.ts` — data agent (deterministic script). Pulls price/volume/options/OI for 10
  tickers from Yahoo (yahoo-finance2 v4), writes `data/<session-date>.json`, self-checks.
  Stores a full OI snapshot each run so the next run can diff open interest.
  Also: IV skew (~5% OTM put IV − call IV), dollar-weighted premium traded (call vs put),
  and a `sectors` rollup ranked by premium call/put ratio vs avg price change.
- `.claude/agents/market-analysis.md` — describes options-vs-price gaps, never interprets.
- `.claude/agents/market-flagging.md` — ≤5 research candidates + boring explanation each.
- `.claude/agents/market-brief.md` — 4th step: SHORT colour-coded email (🟢/🟡/🔴 verdict +
  ≤3 items, every term glossed, "Watch for" learning prompt). Reads `CONTEXT.md`.
- `CONTEXT.md` — reader profile (near-zero options knowledge, learning not trading,
  10-sec attention). The brief adapts to it; edit as the reader learns.
- `WHAT-OPTIONS-VOLUME-TELLS-YOU.md` — the "it's a screener not a signal" guardrail.
- `flags-log.csv` — hit-rate tracking (fill in by hand after 1-2 weeks).
- Samples: `analysis/`, `flags/`, `brief/` for 2026-09-08 (real OI deltas vs 09-04 prior).
- Windows scheduled task `stock-screener-fetch` runs the fetch 8am Tue–Sat.

## Daily automation (split — the cloud sandbox cannot reach Yahoo)
- **Local:** Windows task `stock-screener-fetch` runs `run-fetch.cmd` 08:00 Tue-Sat local:
  `git pull` → `npm run fetch` → commit + push to GitHub (public repo). Needs PC on + logged in.
- **Cloud:** routine `stock-screener-daily` (trig_01LFj67z31qhLHbXjqm7dDeK), cron `40 0 * * 2-6`
  (00:40 UTC ≈ 08:40 local). Repo attached as a `git_repository` source (works now that repo
  is public). Runs the 3 analysis passes INLINE (no subagents — they orphan) → emails the
  brief → archives to Drive → phone push → commits + pushes back. >30h stale data → emails
  "no fresh data" instead.
- **Confirmed working:** 2026-09-09 and 2026-09-10 cron runs emailed real briefs.

## Next
1. Confirm the short colour-coded brief format lands (test run 2026-09-10 12:19 UTC).
2. `flags-log.csv` accumulation: cloud push was blocked pre-source-attach; verify it pushes now.
3. After ~2 weeks, fill in `flags-log.csv` outcome columns.
4. Watch: `dateKey` stuck at 2026-09-08 across days (Yahoo last-bar not advancing in this
   window) → OI diff degrades to first-run. Self-corrects when the market calendar advances.

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
