// 투자자 동향·외국인 동향 — 예전 analysis-service 의 KRX 실시간 호출 3종을 DB 조회로 대체.
//
// - 종목별 순매수 상위: investor_flow_daily(종목·일·투자자별 순매수, KR 파이프라인이 매일 적재)
// - 시장 전체 일별 합계: market_investor_daily(위를 일별 집계, 영구 보존)
// - 현재가·등락률: price_daily (KRX 종가 대신 우리 가격 데이터 — 같은 날 종가)
//
// 응답 형태는 예전 실시간 API 와 동일하게 맞춘다(화면 무변경).
// ⚠️ 예전 실시간 API 는 '기관' 에 KRX 코드 8000 을 썼는데 그건 '개인' 이다(기관합계는 7050).
//    DB 는 수집기가 7050 으로 적재하므로 이쪽이 맞다 — 화면의 기관 수치가 바뀌는 건 버그 수정이다.
import { BadRequestException } from '../http-errors';
import { PrismaService } from '../prisma';

const SUFFIX: Record<string, string> = { KOSPI: '.KS', KOSDAQ: '.KQ' };
const INVESTORS = ['institution', 'foreign', 'individual'] as const;

const ymdToDate = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

function resolveMarket(market: string): string {
  const m = market.toUpperCase();
  if (!SUFFIX[m]) throw new BadRequestException('market must be KOSPI or KOSDAQ');
  return m;
}

type TopRow = {
  symbol: string;
  name: string;
  net_buy_value: bigint;
  net_buy_volume: bigint | null;
  buy_value: bigint | null;
  sell_value: bigint | null;
  close: string | null;
  prev_close: string | null;
};

export class InvestorFlowService {
  constructor(private readonly prisma: PrismaService) {}

  /** 투자자 유형별 순매수·순매도 상위 종목 (그날 하루) */
  async topStocks(market: string, date: string | undefined, investorType: string, limit: number) {
    const mkt = resolveMarket(market);
    const inv = (INVESTORS as readonly string[]).includes(investorType) ? investorType : 'institution';
    const ymd = date ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const day = ymdToDate(ymd);

    const rows = await this.prisma.$queryRaw<TopRow[]>`
      SELECT s.symbol, s.name, f.net_buy_value, f.net_buy_volume, f.buy_value, f.sell_value,
             p.close, pp.close AS prev_close
      FROM investor_flow_daily f
      JOIN stocks s ON s.id = f.stock_id
      LEFT JOIN price_daily p ON p.stock_id = f.stock_id AND p.date = f.trade_date
      LEFT JOIN LATERAL (
        SELECT close FROM price_daily x
        WHERE x.stock_id = f.stock_id AND x.date < f.trade_date
        ORDER BY x.date DESC LIMIT 1
      ) pp ON true
      WHERE f.trade_date = ${day}::date
        AND f.investor_type = ${inv}
        AND s.symbol LIKE ${'%' + SUFFIX[mkt]}
      ORDER BY f.net_buy_value DESC
    `;

    const toStock = (r: TopRow) => {
      const close = r.close != null ? Number(r.close) : null;
      const prev = r.prev_close != null ? Number(r.prev_close) : null;
      return {
        code: r.symbol.replace(/\.(KS|KQ)$/, ''),
        name: r.name,
        netBuyVol: Number(r.net_buy_volume ?? 0),
        netBuyVal: Number(r.net_buy_value),
        // 총 매수·매도는 2026-10-15 부터 적재 — 그 이전 날짜는 null
        buyVal: r.buy_value != null ? Number(r.buy_value) : null,
        sellVal: r.sell_value != null ? Number(r.sell_value) : null,
        currentPrice: close,
        changeRate: close != null && prev ? Math.round(((close - prev) / prev) * 10000) / 100 : null,
      };
    };

    return {
      market: mkt,
      date: ymd,
      investorType: inv,
      topBuy: rows.slice(0, limit).filter((r) => Number(r.net_buy_value) > 0).map(toStock),
      topSell: rows.slice(-limit).reverse().filter((r) => Number(r.net_buy_value) < 0).map(toStock),
    };
  }

  /** 시장 전체 투자자별 일별 순매수 추이 */
  async marketTrading(market: string, fromdate?: string, todate?: string) {
    const mkt = resolveMarket(market);
    const today = new Date();
    const to = todate ?? today.toISOString().slice(0, 10).replace(/-/g, '');
    const from = fromdate ?? new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');

    type Row = { trade_date: Date; investor_type: string; net_buy_value: bigint };
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT trade_date, investor_type, net_buy_value
      FROM market_investor_daily
      WHERE market = ${mkt}
        AND trade_date BETWEEN ${ymdToDate(from)}::date AND ${ymdToDate(to)}::date
    `;

    const byDate = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const d = r.trade_date.toISOString().slice(0, 10);
      const e = byDate.get(d) ?? {};
      e[r.investor_type] = Number(r.net_buy_value);
      byDate.set(d, e);
    }

    const entry = (net: number) => ({ net, buy: 0, sell: 0 });
    const data = [...byDate.entries()]
      .map(([date, v]) => {
        const inst = v.institution ?? 0;
        const frgn = v.foreign ?? 0;
        const indv = v.individual ?? 0;
        return {
          date,
          institution: entry(inst),
          foreign: entry(frgn),
          individual: entry(indv),
          // 전체 순매수 합은 0 — 기타법인·기타는 나머지로 복원
          otherCorp: entry(-(inst + frgn + indv)),
          total: entry(0),
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    const keys = ['institution', 'foreign', 'individual', 'otherCorp', 'total'] as const;
    const summary = Object.fromEntries(
      keys.map((k) => [k, data.reduce((acc, r) => acc + r[k].net, 0)]),
    );

    return { market: mkt, fromdate: from, todate: to, data, summary };
  }
}
