/**
 * The DATA AGENT — deterministic, not an LLM.
 *
 * Its only job: gather clean, dated, sourced market data. It never analyzes and
 * never recommends. Every missing figure is written as "UNAVAILABLE" — nothing is
 * estimated or carried forward from a previous day.
 *
 * Output: data/YYYY-MM-DD.json  (one snapshot per run, so days can be compared)
 *
 * Run AFTER the US market close so options volume is a full session. Open interest
 * from Yahoo is the prior session's settlement value, so OI *changes* are lagged
 * by a day — that is a known limitation, not a bug.
 */
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import YahooFinance from "yahoo-finance2";

const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

const DIR = import.meta.dirname;
const DATA_DIR = join(DIR, "data");
const EXPIRATIONS_TO_PULL = 3; // nearest N expirations carry the great majority of volume
const TOP_STRIKES = 8;
const SOURCE =
  "Yahoo Finance via yahoo-finance2 v4 (price/options delayed ~15min; open interest = prior-session settlement)";

type Num = number | "UNAVAILABLE";

interface ActiveStrike {
  type: "call" | "put";
  contractSymbol: string;
  strike: number;
  expiration: string;
  volume: number;
  openInterest: Num;
  oiChangeFromPrior: Num;
  impliedVolatility: Num;
}

interface Snapshot {
  ticker: string;
  fetchedAt: string;
  sector: string; // "UNAVAILABLE" or "Index" for ETFs
  price: { current: Num; priorClose: Num; changePct: Num };
  history90d: { date: string; close: number; volume: number }[] | "UNAVAILABLE";
  volume: { today: Num; avg30d: Num; relativeToAvg: Num };
  options: {
    expirationsPulled: string[];
    totalVolume: Num;
    callVolume: Num;
    putVolume: Num;
    callPutRatio: Num;
    // Dollar-weighted flow: volume x mid-price x 100. Gross premium *traded*, not
    // net positioning — we still cannot tell bought from sold.
    callPremiumTraded: Num;
    putPremiumTraded: Num;
    premiumCallPutRatio: Num;
    // ~5% OTM put IV minus ~5% OTM call IV, nearest expiration. Positive = downside
    // protection is bid up (the normal equity state); a jump vs its own recent level = fear.
    ivSkew: {
      otmPutIV: Num;
      otmCallIV: Num;
      skew: Num;
      atmIV: Num;
    };
    mostActiveStrikes: ActiveStrike[];
  };
  oiSnapshot: Record<string, number>; // contractSymbol -> OI, kept so tomorrow's run can diff it
  events: {
    nextEarnings: string | "UNAVAILABLE";
    exDividend: string | "UNAVAILABLE";
    dividendPay: string | "UNAVAILABLE";
    within30d: string[];
  };
  errors: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dayStr = (d: Date | number | string) => new Date(d).toISOString().slice(0, 10);
/** Calendar date in US Eastern — the market's own clock. */
const etDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

function loadPrior(): {
  priorDate: string | null;
  priorOI: Map<string, Record<string, number>>;
} {
  const priorOI = new Map<string, Record<string, number>>();
  if (!existsSync(DATA_DIR)) return { priorDate: null, priorOI };
  const et = etDate();
  const files = readdirSync(DATA_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < et)
    .sort();
  if (!files.length) return { priorDate: null, priorOI };
  const priorFile = files.at(-1)!;
  try {
    // OI snapshots live in a sibling <date>.oi.json (keeps the main file under the
    // 256KB agent read limit). Fall back to an embedded oiSnapshot for old files.
    const oiPath = join(DATA_DIR, priorFile.replace(/\.json$/, ".oi.json"));
    if (existsSync(oiPath)) {
      const oi = JSON.parse(readFileSync(oiPath, "utf8")) as Record<string, Record<string, number>>;
      for (const [ticker, snap] of Object.entries(oi)) priorOI.set(ticker, snap);
    } else {
      const j = JSON.parse(readFileSync(join(DATA_DIR, priorFile), "utf8"));
      for (const t of j.tickers ?? []) if (t.oiSnapshot) priorOI.set(t.ticker, t.oiSnapshot);
    }
    return { priorDate: priorFile.slice(0, 10), priorOI };
  } catch {
    return { priorDate: null, priorOI };
  }
}

function mkStrike(
  type: "call" | "put",
  c: any,
  exp: string,
  priorOI: Record<string, number>,
): ActiveStrike {
  const oi: Num = typeof c.openInterest === "number" ? c.openInterest : "UNAVAILABLE";
  const prior = priorOI[c.contractSymbol];
  const oiChangeFromPrior: Num =
    typeof oi === "number" && typeof prior === "number" ? oi - prior : "UNAVAILABLE";
  return {
    type,
    contractSymbol: c.contractSymbol,
    strike: c.strike,
    expiration: exp,
    volume: c.volume ?? 0,
    openInterest: oi,
    oiChangeFromPrior,
    impliedVolatility:
      typeof c.impliedVolatility === "number" ? +c.impliedVolatility.toFixed(4) : "UNAVAILABLE",
  };
}

/** IV of the contract whose strike is closest to `target`, from a list. */
function ivNearest(contracts: any[], target: number): number | null {
  let best: any = null;
  let bestDist = Infinity;
  for (const c of contracts ?? []) {
    if (typeof c.strike !== "number" || typeof c.impliedVolatility !== "number") continue;
    const d = Math.abs(c.strike - target);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best ? best.impliedVolatility : null;
}

/** ~5% OTM put IV minus ~5% OTM call IV for the nearest expiration. */
function computeSkew(nearestChain: any, spot: number | null): Snapshot["options"]["ivSkew"] {
  const blank = {
    otmPutIV: "UNAVAILABLE" as Num,
    otmCallIV: "UNAVAILABLE" as Num,
    skew: "UNAVAILABLE" as Num,
    atmIV: "UNAVAILABLE" as Num,
  };
  if (!nearestChain || spot == null) return blank;
  const putIV = ivNearest(nearestChain.puts, spot * 0.95);
  const callIV = ivNearest(nearestChain.calls, spot * 1.05);
  const atmCall = ivNearest(nearestChain.calls, spot);
  const atmPut = ivNearest(nearestChain.puts, spot);
  const atm =
    atmCall != null && atmPut != null
      ? (atmCall + atmPut) / 2
      : (atmCall ?? atmPut);
  return {
    otmPutIV: putIV != null ? +putIV.toFixed(4) : "UNAVAILABLE",
    otmCallIV: callIV != null ? +callIV.toFixed(4) : "UNAVAILABLE",
    skew: putIV != null && callIV != null ? +(putIV - callIV).toFixed(4) : "UNAVAILABLE",
    atmIV: atm != null ? +atm.toFixed(4) : "UNAVAILABLE",
  };
}

async function buildSnapshot(
  ticker: string,
  priorOIForTicker: Record<string, number>,
): Promise<Snapshot> {
  const errors: string[] = [];
  const s: Snapshot = {
    ticker,
    fetchedAt: new Date().toISOString(),
    sector: "UNAVAILABLE",
    price: { current: "UNAVAILABLE", priorClose: "UNAVAILABLE", changePct: "UNAVAILABLE" },
    history90d: "UNAVAILABLE",
    volume: { today: "UNAVAILABLE", avg30d: "UNAVAILABLE", relativeToAvg: "UNAVAILABLE" },
    options: {
      expirationsPulled: [],
      totalVolume: "UNAVAILABLE",
      callVolume: "UNAVAILABLE",
      putVolume: "UNAVAILABLE",
      callPutRatio: "UNAVAILABLE",
      callPremiumTraded: "UNAVAILABLE",
      putPremiumTraded: "UNAVAILABLE",
      premiumCallPutRatio: "UNAVAILABLE",
      ivSkew: {
        otmPutIV: "UNAVAILABLE",
        otmCallIV: "UNAVAILABLE",
        skew: "UNAVAILABLE",
        atmIV: "UNAVAILABLE",
      },
      mostActiveStrikes: [],
    },
    oiSnapshot: {},
    events: {
      nextEarnings: "UNAVAILABLE",
      exDividend: "UNAVAILABLE",
      dividendPay: "UNAVAILABLE",
      within30d: [],
    },
    errors,
  };

  try {
    const q: any = await yf.quote(ticker);
    s.price.current = q.regularMarketPrice ?? "UNAVAILABLE";
    s.price.priorClose = q.regularMarketPreviousClose ?? "UNAVAILABLE";
    s.price.changePct =
      typeof q.regularMarketChangePercent === "number"
        ? +q.regularMarketChangePercent.toFixed(2)
        : "UNAVAILABLE";
    s.volume.today = q.regularMarketVolume ?? "UNAVAILABLE";
  } catch (e) {
    errors.push(`quote: ${(e as Error).message}`);
  }

  try {
    const chart: any = await yf.chart(ticker, {
      period1: new Date(Date.now() - 130 * 864e5),
      interval: "1d",
    });
    const bars = (chart.quotes ?? [])
      .filter((b: any) => b.close != null && b.volume != null)
      .map((b: any) => ({ date: dayStr(b.date), close: +b.close.toFixed(2), volume: b.volume }));
    const last90 = bars.slice(-90);
    s.history90d = last90.length ? last90 : "UNAVAILABLE";
    const last30 = bars.slice(-30);
    if (last30.length) {
      const avg = last30.reduce((a: number, b: any) => a + b.volume, 0) / last30.length;
      s.volume.avg30d = Math.round(avg);
      if (typeof s.volume.today === "number")
        s.volume.relativeToAvg = +(s.volume.today / avg).toFixed(2);
    }
    if (s.price.current === "UNAVAILABLE" && last90.length) s.price.current = last90.at(-1)!.close;
  } catch (e) {
    errors.push(`chart: ${(e as Error).message}`);
  }

  try {
    const base: any = await yf.options(ticker);
    const expDates: Date[] = (base.expirationDates ?? []).slice(0, EXPIRATIONS_TO_PULL);
    const chains: any[] = [];
    if (base.options?.[0]) chains.push(base.options[0]);
    for (const d of expDates.slice(1)) {
      const more: any = await yf.options(ticker, { date: d });
      if (more.options?.[0]) chains.push(more.options[0]);
      await sleep(250);
    }
    let callVol = 0;
    let putVol = 0;
    let callPrem = 0;
    let putPrem = 0;
    const oiSnap: Record<string, number> = {};
    const all: ActiveStrike[] = [];
    const mid = (o: any): number | null => {
      if (typeof o.bid === "number" && typeof o.ask === "number" && o.ask > 0)
        return (o.bid + o.ask) / 2;
      return typeof o.lastPrice === "number" ? o.lastPrice : null;
    };
    for (const ch of chains) {
      const exp = dayStr(ch.expirationDate);
      for (const c of ch.calls ?? []) {
        callVol += c.volume ?? 0;
        const m = mid(c);
        if (m != null) callPrem += (c.volume ?? 0) * m * 100;
        if (typeof c.openInterest === "number") oiSnap[c.contractSymbol] = c.openInterest;
        all.push(mkStrike("call", c, exp, priorOIForTicker));
      }
      for (const p of ch.puts ?? []) {
        putVol += p.volume ?? 0;
        const m = mid(p);
        if (m != null) putPrem += (p.volume ?? 0) * m * 100;
        if (typeof p.openInterest === "number") oiSnap[p.contractSymbol] = p.openInterest;
        all.push(mkStrike("put", p, exp, priorOIForTicker));
      }
    }
    s.options.expirationsPulled = chains.map((ch) => dayStr(ch.expirationDate));
    s.options.callVolume = callVol;
    s.options.putVolume = putVol;
    s.options.totalVolume = callVol + putVol;
    s.options.callPutRatio = putVol > 0 ? +(callVol / putVol).toFixed(2) : "UNAVAILABLE";
    s.options.callPremiumTraded = Math.round(callPrem);
    s.options.putPremiumTraded = Math.round(putPrem);
    s.options.premiumCallPutRatio = putPrem > 0 ? +(callPrem / putPrem).toFixed(2) : "UNAVAILABLE";
    s.options.mostActiveStrikes = all.sort((a, b) => b.volume - a.volume).slice(0, TOP_STRIKES);
    s.options.ivSkew = computeSkew(chains[0], typeof s.price.current === "number" ? s.price.current : null);
    s.oiSnapshot = oiSnap;
  } catch (e) {
    errors.push(`options: ${(e as Error).message}`);
  }

  try {
    const qp: any = await yf.quoteSummary(ticker, { modules: ["assetProfile", "quoteType"] });
    if (qp.quoteType?.quoteType === "ETF") s.sector = "Index";
    else s.sector = qp.assetProfile?.sector ?? "UNAVAILABLE";
  } catch (e) {
    errors.push(`sector: ${(e as Error).message}`);
  }

  try {
    const qs: any = await yf.quoteSummary(ticker, { modules: ["calendarEvents"] });
    const ce = qs.calendarEvents ?? {};
    const earn = ce.earnings?.earningsDate?.[0];
    s.events.nextEarnings = earn ? dayStr(earn) : "UNAVAILABLE";
    s.events.exDividend = ce.exDividendDate ? dayStr(ce.exDividendDate) : "UNAVAILABLE";
    s.events.dividendPay = ce.dividendDate ? dayStr(ce.dividendDate) : "UNAVAILABLE";
    const horizon = Date.now() + 30 * 864e5;
    const within: string[] = [];
    for (const [label, val] of [
      ["earnings", earn],
      ["ex-dividend", ce.exDividendDate],
      ["dividend pay", ce.dividendDate],
    ] as const) {
      if (!val) continue;
      const t = new Date(val).getTime();
      if (t >= Date.now() && t <= horizon) within.push(`${label} ${dayStr(val)}`);
    }
    s.events.within30d = within;
  } catch (e) {
    errors.push(`events: ${(e as Error).message}`);
  }

  return s;
}

function selfCheck(tickers: Snapshot[], expected: number): void {
  let bad = 0;
  let total = 0;
  console.assert(tickers.length === expected, `expected ${expected} tickers, got ${tickers.length}`);
  for (const s of tickers) {
    console.assert(!!s.fetchedAt, `${s.ticker}: missing fetchedAt`);
    for (const v of [s.price.current, s.volume.today, s.volume.avg30d, s.options.totalVolume]) {
      total++;
      if (v === "UNAVAILABLE") bad++;
    }
    if (s.errors.length) console.log(`  warn ${s.ticker}: ${s.errors.join(" | ")}`);
  }
  const pct = total ? bad / total : 1;
  console.log(`self-check: ${tickers.length} tickers, ${(pct * 100).toFixed(0)}% of key fields UNAVAILABLE`);
  if (pct > 0.5) {
    console.log("FAIL: over half the key fields are missing — Yahoo likely rate-limited you. Wait and re-run.");
    process.exit(1);
  }
  console.log("PASS");
}

const n = (v: Num): number => (typeof v === "number" ? v : 0);

/** Group tickers by sector and roll up the flow. Ranked by premium call/put ratio. */
function rollupSectors(tickers: Snapshot[]) {
  const groups = new Map<string, Snapshot[]>();
  for (const s of tickers) {
    const key = s.sector === "UNAVAILABLE" ? "Unknown" : s.sector;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  const rows = [...groups.entries()].map(([sector, members]) => {
    const callVol = members.reduce((a, s) => a + n(s.options.callVolume), 0);
    const putVol = members.reduce((a, s) => a + n(s.options.putVolume), 0);
    const callPrem = members.reduce((a, s) => a + n(s.options.callPremiumTraded), 0);
    const putPrem = members.reduce((a, s) => a + n(s.options.putPremiumTraded), 0);
    const chgs = members.map((s) => s.price.changePct).filter((v): v is number => typeof v === "number");
    return {
      sector,
      tickers: members.map((s) => s.ticker),
      callVolume: callVol,
      putVolume: putVol,
      volumeCallPutRatio: putVol > 0 ? +(callVol / putVol).toFixed(2) : ("UNAVAILABLE" as Num),
      callPremiumTraded: Math.round(callPrem),
      putPremiumTraded: Math.round(putPrem),
      premiumCallPutRatio: putPrem > 0 ? +(callPrem / putPrem).toFixed(2) : ("UNAVAILABLE" as Num),
      avgPriceChangePct: chgs.length ? +(chgs.reduce((a, b) => a + b, 0) / chgs.length).toFixed(2) : ("UNAVAILABLE" as Num),
    };
  });
  // Most call-skewed premium first — the analysis agent reads this against avgPriceChangePct.
  return rows.sort((a, b) => n(b.premiumCallPutRatio) - n(a.premiumCallPutRatio));
}

/** The date of the last completed trading session, from the newest chart bar. */
function sessionDate(tickers: Snapshot[], fallback: string): string {
  const bars = tickers
    .flatMap((s) => (Array.isArray(s.history90d) ? s.history90d : []))
    .map((b) => b.date)
    .sort();
  return bars.at(-1) ?? fallback;
}

async function main() {
  const now = new Date();
  mkdirSync(DATA_DIR, { recursive: true });

  const watchlist: string[] = JSON.parse(readFileSync(join(DIR, "watchlist.json"), "utf8"));
  const { priorDate, priorOI } = loadPrior();
  console.log(`watchlist: ${watchlist.join(", ")}`);
  console.log(`prior snapshot for OI diff: ${priorDate ?? "none (first run)"}`);

  const tickers: Snapshot[] = [];
  for (const t of watchlist) {
    process.stdout.write(`  ${t} ... `);
    const snap = await buildSnapshot(t, priorOI.get(t) ?? {});
    console.log(snap.errors.length ? `done (${snap.errors.length} errors)` : "done");
    tickers.push(snap);
    await sleep(400);
  }

  const dateKey = sessionDate(tickers, dayStr(now));
  // If the newest existing file IS this session, it's a re-run — no real prior to diff.
  const effectivePriorDate = priorDate && priorDate !== dateKey ? priorDate : null;
  const out = {
    meta: {
      generatedAt: now.toISOString(),
      dateKey,
      dateKeyMeaning: "date of the last completed trading session this data represents",
      source: SOURCE,
      priorSnapshotDate: effectivePriorDate ?? "NONE (first run — OI changes are UNAVAILABLE)",
      policy: "Every missing figure is 'UNAVAILABLE'. Nothing is estimated or carried forward.",
      expirationsPulledPerTicker: EXPIRATIONS_TO_PULL,
    },
    sectors: rollupSectors(tickers),
    tickers,
  };
  // Split the bulky per-contract OI snapshot into a sibling file so the main file
  // stays under the 256KB agent read limit. Both are committed — .oi.json feeds
  // tomorrow's diff, .json feeds the analysis agents.
  const oiByTicker: Record<string, Record<string, number>> = {};
  for (const t of tickers) {
    oiByTicker[t.ticker] = t.oiSnapshot;
    delete (t as { oiSnapshot?: unknown }).oiSnapshot;
  }
  const outPath = join(DATA_DIR, `${dateKey}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  writeFileSync(join(DATA_DIR, `${dateKey}.oi.json`), JSON.stringify(oiByTicker));
  console.log(`\nwrote ${outPath} (+ ${dateKey}.oi.json)`);
  selfCheck(tickers, watchlist.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
