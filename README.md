# Stock Screener

A three-part screener built from the "How to Analyze the Stock Market with Claude" guide.

**It is a screener, not a signal.** The output is "go look at this," never "take this trade."
Read `WHAT-OPTIONS-VOLUME-TELLS-YOU.md` before trusting any flag.

## Parts

1. **`fetch.ts`** — the data agent, as a deterministic script. Pulls price history,
   volume, options volume, change in open interest, IV skew, dollar-weighted premium
   traded, and a sector rollup for the `watchlist.json` tickers. Stamps a source +
   timestamp, writes `UNAVAILABLE` for anything missing, never estimates.
   Output: `data/YYYY-MM-DD.json` (`meta`, `sectors`, `tickers`).
2. **`.claude/agents/market-analysis.md`** — reads the data file, describes the gap
   between options activity and price. Never says "bullish." Output: `analysis/YYYY-MM-DD.md`.
3. **`.claude/agents/market-flagging.md`** — reads the analysis, gives at most 5 research
   candidates with the boring explanation for each. Output: `flags/YYYY-MM-DD.md` +
   a row in `flags-log.csv`.

## Daily use

```
npm run fetch          # after US market close (approx 4pm ET)
```

Then, in Claude Code opened in this folder:

```
> use the market-analysis agent
> use the market-flagging agent
```

Then read `flags/<today>.md` and do the actual research yourself — filings, news, earnings calendar.

## The habit that makes it worth anything

Every 1-2 weeks, open `flags-log.csv` and fill in what actually happened to each flagged
ticker. After ~3 months you will know your real hit rate instead of remembering the flags
that worked.

## Known limits

- Free Yahoo data is delayed ~15 min. Fine for a daily screener.
- Open interest is the prior session's settlement value, so OI *changes* lag by a day.
- First run has no prior snapshot, so all OI changes are `UNAVAILABLE` until the second run.
- SPY / QQQ have no earnings events (they are ETFs); that is expected.
- Only the nearest 3 expirations are pulled — they carry most of the volume, but a
  far-dated block trade would be missed.
