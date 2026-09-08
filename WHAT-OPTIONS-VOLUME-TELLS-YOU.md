# What options volume actually tells you

The most important file in this repo. From Step 3 of the guide. Read it before trusting any flag.

## Raw volume does not tell you direction

Every options contract has a buyer and a seller. A trade printing 10,000 calls does not
tell you whether someone **bought** 10,000 calls expecting a rally or **sold** 10,000 calls
collecting premium and expecting the opposite. The volume is identical either way. Without
knowing whether the trade hit the bid or the ask — and often not even then — direction is
an assumption you are adding, not information you received.

## Volume does not tell you whether positions opened or closed

10,000 contracts trading could be 10,000 new bets or someone exiting a position from last
month. The only thing that distinguishes them is the **change in open interest**, which
updates after the session. This is why `fetch.ts` stores an OI snapshot every run and diffs
it. A flag without a confirmed OI increase is not evidence of anything.

## Much institutional options activity is not a bet at all

Institutions hedge. A fund holding a large equity position buys puts to protect it. A desk
that sold you calls buys stock to stay neutral. A big block of calls can be a hedge on a
short position — in which case the "bullish signal" is attached to someone who is actually
bearish. You cannot tell these apart from the outside.

## "Net premium" is still not net

`fetch.ts` computes premium traded (volume x mid-price x 100) and splits it call vs put.
Dollar-weighting is genuinely more informative than counting contracts — a $600M call
premium day is different from a day with the same contract count in cheap far-OTM lottos.
But it is **gross premium traded**, not net positioning. Half of every dollar was a seller.
It tells you where the money churned, not which way anyone is leaning.

## IV skew is a level, not a verdict

Puts costing more than calls (positive skew) is the resting state of every equity — it is
what portfolio insurance demand looks like. A *change* in skew is mildly informative; a
single day's absolute number is not. Do not turn "skew is 0.04" into a market call.

## "Smart money" is a marketing frame

The filings that reveal real institutional positions (13Fs) are published ~45 days late. By
the time you see what a fund held, they may have exited. There is no public feed of what
informed money is doing right now. Anyone selling one is selling an inference, not a fact.

## So what is this system

A legitimate **attention-direction tool**. Unusual activity is a reason to go look at a
company. It is not a reason to take a position. The difference between those two sentences
is most of the money people lose in this corner of the market.

## Rules for using it without losing money

- Treat every flag as the **start** of research, not the end.
- Log every flag in `flags-log.csv` and check your real hit rate after 3 months.
- When the analysis describes activity, that is data. When it starts explaining *why*
  institutions are positioning for a move, it is writing fiction that sounds like analysis.
- Verify at the source before acting on anything. Delayed free data is sometimes wrong.
- Options are leveraged and they expire. Being right on direction and wrong on timing still
  loses everything. That is a different risk profile from owning shares.

---

*Educational only. Nothing here is financial advice. Never trade money you cannot afford to lose.*
