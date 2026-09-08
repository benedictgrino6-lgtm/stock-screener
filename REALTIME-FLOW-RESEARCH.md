# Real-time options flow — sources & cost

Research only. Nothing wired in. For the 10-name watchlist, not the whole market.

## First: do you actually need it?

The screener runs **once a day after the close**. For that design, real-time changes
nothing — 15-minute-delayed Yahoo data settled at end of day is the same picture. Real-time
only matters if the goal changes to **intraday alerts** ("tell me when unusual flow hits
*now*"). If that's not the goal, the answer is: stay on free Yahoo, $0.

## If the goal becomes intraday

You are buying OPRA options data. Every path passes through OPRA exchange fees, and there
are two big cost cliffs:

1. **Non-professional vs professional.** As long as this is personal use, you qualify
   non-pro (~$1–5/mo of OPRA fees). If it's run as a business / for clients, "professional"
   classification pushes exchange fees to **hundreds per month**. This is the single
   biggest cost driver.
2. **Real-time vs delayed.** Delayed (15 min) is cheap or free almost everywhere. Real-time
   is where the subscription tiers jump.

### Cheapest real paths (non-professional)

| Source | ~Cost/mo | Notes |
|---|---|---|
| **Interactive Brokers API** | ~$5 + small OPRA fee | Cheapest real-time, BUT needs a funded IBKR account. Data is a market-data add-on. Good if you'd open the account anyway. |
| **Tradier** (brokerage plan) | ~$0–10 | Real-time quotes with a funded brokerage account. Options chain API is decent. Delayed tier is free. |
| **ThetaData** | ~$30 delayed / ~$80 real-time (Standard) | Options-specialist API, no brokerage account needed. Standard tier = real-time OPRA. Probably the best "just an API" option. |
| **Polygon.io Options** | $79 (delayed 15m) / ~$199 (real-time) | Clean REST + websocket. Real-time is the "Advanced" tier. |

### Consumer flow products (not APIs)

Unusual Whales / Cheddar Flow / FlowAlgo — $30–75/mo. They *show* you the flow feed but
mostly aren't built to pipe into a custom pipeline. Skip unless you just want to look at
their dashboard.

## Recommendation

Do nothing now. Run the daily screener for a few weeks. If you find yourself wishing you'd
seen something *during* the day, revisit — and the move then is **ThetaData Standard
(~$80/mo)** for a clean API, or an **IBKR account** if you want to trade through it anyway.
Confirm non-professional data classification before subscribing anywhere.
