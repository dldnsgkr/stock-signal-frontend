// 지지선·저항선 + 이동평균 + 단기 가격 범위 + (US) Forward P/E 전망.
// analysis-service/app/routers/analysis.py 의 /technical-levels 이식판 — 계산 로직은 1:1 대응.
// 차이점: Forward P/E·시나리오의 입력을 화면 요청마다 yfinance 실시간 호출 대신
// analyst_estimates 테이블(재무 수집기가 월 1회 적재)에서 읽는다.
import { HttpException, NotFoundException } from '../http-errors';
import { PrismaService } from '../prisma';

// 2024-2025 US 섹터별 기준 P/E (S&P500 구성 섹터 중앙값) — Python 원본과 동일
const SECTOR_PE: Record<string, number> = {
  Technology: 28.0,
  'Information Technology': 28.0,
  'Communication Services': 22.0,
  Healthcare: 22.0,
  'Consumer Discretionary': 24.0,
  'Consumer Staples': 20.0,
  Financials: 14.0,
  'Financial Services': 14.0,
  Energy: 12.0,
  Industrials: 20.0,
  'Basic Materials': 17.0,
  Materials: 17.0,
  'Real Estate': 35.0,
  Utilities: 18.0,
};
const DEFAULT_PE = 20.0;

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** 로컬 극값 탐지 → 클러스터링 → 지지/저항 레벨 */
function findSupportResistance(highs: number[], lows: number[], current: number, window = 3) {
  const n = highs.length;
  if (n < window * 2 + 2) return { support: [] as number[], resistance: [] as number[] };

  const resRaw: number[] = [];
  const supRaw: number[] = [];
  for (let i = window; i < n - window; i++) {
    let isHi = true;
    let isLo = true;
    for (let j = 1; j <= window; j++) {
      if (!(highs[i] >= highs[i - j] && highs[i] >= highs[i + j])) isHi = false;
      if (!(lows[i] <= lows[i - j] && lows[i] <= lows[i + j])) isLo = false;
    }
    if (isHi) resRaw.push(highs[i]);
    if (isLo) supRaw.push(lows[i]);
  }

  const cluster = (levels: number[], pct = 0.015) => {
    if (!levels.length) return [];
    const sorted = [...levels].sort((a, b) => a - b);
    const groups: number[][] = [[sorted[0]]];
    for (const lv of sorted.slice(1)) {
      const last = groups[groups.length - 1];
      const prev = last[last.length - 1];
      if ((lv - prev) / Math.max(prev, 1e-9) <= pct) last.push(lv);
      else groups.push([lv]);
    }
    return groups.map((g) => r4(g.reduce((a, b) => a + b, 0) / g.length));
  };

  const allR = cluster(resRaw);
  const allS = cluster(supRaw);
  return {
    resistance: allR.filter((r) => current < r && r <= current * 1.3).sort((a, b) => a - b).slice(0, 3),
    support: allS.filter((s) => current * 0.7 <= s && s < current).sort((a, b) => b - a).slice(0, 3),
  };
}

/** ATR(EWM com=13) 기반 단기·중기 가격 범위 + 20일 선형 추세 */
function calcPriceTargets(closes: number[], highs: number[], lows: number[], current: number) {
  if (closes.length < 15) return {};

  // pandas: tr = max(h-l, |h-prev|, |l-prev|) — 첫 행은 prev 가 NaN 이라 h-l 만 남는다
  const tr = closes.map((_, i) => {
    const hl = highs[i] - lows[i];
    if (i === 0) return hl;
    const prev = closes[i - 1];
    return Math.max(hl, Math.abs(highs[i] - prev), Math.abs(lows[i] - prev));
  });
  // ewm(com=13, adjust=False): alpha = 1/(1+com)
  const alpha = 1 / 14;
  let atr = tr[0];
  for (let i = 1; i < tr.length; i++) atr = alpha * tr[i] + (1 - alpha) * atr;

  let trend1w = 0;
  let trend1m = 0;
  if (closes.length >= 20) {
    // np.polyfit(x=0..19, y, 1) 의 기울기 — 최소제곱
    const y = closes.slice(-20);
    const xMean = 9.5;
    const yMean = y.reduce((a, b) => a + b, 0) / 20;
    let num = 0;
    let den = 0;
    for (let x = 0; x < 20; x++) {
      num += (x - xMean) * (y[x] - yMean);
      den += (x - xMean) ** 2;
    }
    const slope = num / den;
    trend1w = slope * 5;
    trend1m = slope * 20;
  }

  const c1w = r4(current + trend1w);
  const c1m = r4(current + trend1m);
  const b1w = r4(atr);
  const b1m = r4(atr * Math.sqrt(20));
  return {
    week1: { low: r4(c1w - b1w), center: c1w, high: r4(c1w + b1w) },
    month1: { low: r4(c1m - b1m), center: c1m, high: r4(c1m + b1m) },
  };
}

type Estimates = {
  forward_eps: string | null;
  trailing_eps: string | null;
  trailing_pe: string | null;
  target_mean: string | null;
  target_high: string | null;
  target_low: string | null;
  analyst_count: number | null;
};

const num = (v: string | null | undefined) => (v == null ? null : Number(v));

function calcForwardPE(est: Estimates, sector: string, current: number) {
  const forwardEps = num(est.forward_eps);
  if (!forwardEps || forwardEps <= 0) return null;
  const trailingEps = num(est.trailing_eps);
  const trailingPe = num(est.trailing_pe);
  const sectorPe = SECTOR_PE[sector] ?? DEFAULT_PE;

  // 적정 P/E: trailing(40%)·섹터(60%) 블렌드. trailing 이 과열(섹터 2배 초과)이거나 비정상이면 섹터만
  const fairPe = trailingPe && trailingPe > 5 && trailingPe < sectorPe * 2 ? r1(trailingPe * 0.4 + sectorPe * 0.6) : sectorPe;
  const target = r2(forwardEps * fairPe);
  const epsGrowth = trailingEps && trailingEps > 0 ? r4((forwardEps - trailingEps) / trailingEps) : null;
  return {
    target,
    upside: current > 0 ? r4((target - current) / current) : null,
    forwardEps: r4(forwardEps),
    fairPE: fairPe,
    sectorPE: sectorPe,
    sector,
    epsGrowth,
  };
}

function calcScenarios(est: Estimates, pe: ReturnType<typeof calcForwardPE>, current: number) {
  const mean = num(est.target_mean);
  const high = num(est.target_high);
  const low = num(est.target_low);
  const peTarget = pe?.target ?? null;

  let base: number;
  let source: string;
  if (peTarget && mean) {
    base = r2((peTarget + mean) / 2);
    source = 'pe+analyst';
  } else if (peTarget) {
    base = peTarget;
    source = 'pe';
  } else if (mean) {
    base = r2(mean);
    source = 'analyst';
  } else {
    return null;
  }
  const bull = high ? r2(high) : r2(base * 1.2);
  const bear = low ? r2(low) : r2(base * 0.8);
  const pct = (p: number) => (current > 0 ? r4((p - current) / current) : null);
  return {
    bull: { price: bull, upside: pct(bull) },
    base: { price: base, upside: pct(base) },
    bear: { price: bear, upside: pct(bear) },
    analystCount: est.analyst_count,
    source,
  };
}

export class TechnicalLevelsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLevels(symbol: string, market: string, days = 90) {
    const sym = symbol.toUpperCase();
    const mkt = market.toUpperCase();

    const stock = await this.prisma.stock.findFirst({
      where: { symbol: sym, isActive: true, market: { code: mkt } },
      select: { id: true, sector: true },
    });
    if (!stock) throw new NotFoundException('Stock not found');

    const since = new Date();
    since.setDate(since.getDate() - days);
    const prices = await this.prisma.priceDaily.findMany({
      where: { stockId: stock.id, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { close: true, high: true, low: true },
    });
    if (prices.length < 20) throw new HttpException(422, 'Insufficient price data');

    const closes = prices.map((p) => Number(p.close));
    const highs = prices.map((p) => Number(p.high));
    const lows = prices.map((p) => Number(p.low));
    const current = closes[closes.length - 1];
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

    const sr = findSupportResistance(highs, lows, current);
    const targets = calcPriceTargets(closes, highs, lows, current);

    let forwardPE = null;
    let scenarios = null;
    if (mkt === 'US') {
      const rows = await this.prisma.$queryRaw<Estimates[]>`
        SELECT forward_eps, trailing_eps, trailing_pe, target_mean, target_high, target_low, analyst_count
        FROM analyst_estimates WHERE stock_id = ${stock.id}
      `;
      if (rows[0]) {
        forwardPE = calcForwardPE(rows[0], stock.sector ?? '', current);
        scenarios = calcScenarios(rows[0], forwardPE, current);
      }
    }

    return {
      symbol: sym,
      market: mkt,
      currentPrice: current,
      ma20: closes.length >= 20 ? r4(mean(closes.slice(-20))) : null,
      ma60: closes.length >= 60 ? r4(mean(closes.slice(-60))) : null,
      support: sr.support,
      resistance: sr.resistance,
      priceTargets: targets,
      forwardPE,
      scenarios,
    };
  }
}
