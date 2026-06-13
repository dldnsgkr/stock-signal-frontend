'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2 } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

type MarketCode = 'KOSPI' | 'KOSDAQ';
type Period = '1w' | '1m' | '3m';

interface InvestorEntry {
  net: number;
  buy: number;
  sell: number;
}

interface TradingRow {
  date: string;
  institution: InvestorEntry;  // 기관합계 (TRDVAL1)
  foreign: InvestorEntry;      // 외국인 (TRDVAL2)
  individual: InvestorEntry;   // 개인 (TRDVAL3)
  otherCorp: InvestorEntry;    // 기타법인+기타 (TRDVAL4)
  total: InvestorEntry;        // 전체합계 (TRDVAL_TOT)
}

interface TradingData {
  market: string;
  fromdate: string;
  todate: string;
  data: TradingRow[];
  summary: Record<string, number>;
}

const PERIOD_DAYS: Record<Period, number> = { '1w': 7, '1m': 30, '3m': 90 };
const PERIOD_LABELS: Record<Period, string> = { '1w': '1주', '1m': '1달', '3m': '3달' };

function toDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// 억원 단위로 변환 + 부호 포함 포맷
function fmtValue(v: number, short = false): string {
  if (v === 0) return '0';
  const sign = v > 0 ? '+' : '';
  const abs = Math.abs(v);
  // pykrx 반환값이 원(KRW) 단위인 경우 억원으로 변환
  // 최대값이 1억 이상이면 원 단위, 아니면 이미 억원 단위
  const inWon = abs > 100_000_000;
  const billions = inWon ? abs / 100_000_000 : abs;

  if (!short) {
    return `${sign}${Math.round(billions).toLocaleString()}억`;
  }
  if (billions >= 10000) return `${sign}${(billions / 10000).toFixed(1)}조`;
  return `${sign}${Math.round(billions).toLocaleString()}억`;
}

function fmtAxisValue(v: number): string {
  const abs = Math.abs(v);
  const inWon = abs > 100_000_000;
  const billions = inWon ? abs / 100_000_000 : abs;
  if (Math.abs(billions) >= 10000) return `${(billions / 10000).toFixed(0)}조`;
  return `${Math.round(billions).toLocaleString()}억`;
}

function netColor(v: number) {
  return v > 0 ? 'text-blue-600 dark:text-blue-400' : v < 0 ? 'text-red-500' : 'text-muted-foreground';
}

const INVESTOR_COLS = [
  { key: 'institution', label: '기관합계' },
  { key: 'otherCorp',   label: '기타법인·기타' },
] as const;

export default function InvestorTradingPage() {
  const [market, setMarket] = useState<MarketCode>('KOSPI');
  const [period, setPeriod] = useState<Period>('1m');
  const [data, setData] = useState<TradingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chartRef.current?.getEchartsInstance()?.resize({ width });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    const fromdate = toDateStr(PERIOD_DAYS[period]);
    const todate = toDateStr(0);
    try {
      const res = await fetch(
        `/api/proxy?endpoint=/market/investor-trading&market=${market}&fromdate=${fromdate}&todate=${todate}`,
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);  // 503 포함 모든 에러 처리
      setData(json);
    } catch (e: any) {
      setError(e.message ?? '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [market, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 차트 데이터 (날짜 오름차순)
  const chartRows = data?.data ? [...data.data].reverse() : [];

  const chartOption = {
    grid: { left: 64, right: 16, top: 24, bottom: 56 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        return params.map((p: any) =>
          `${p.marker}${p.seriesName}: <strong>${fmtValue(p.value)}</strong>`
        ).join('<br/>');
      },
    },
    legend: {
      data: ['개인·기타', '외국인', '기관합계'],
      bottom: 4,
      textStyle: { fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: chartRows.map(r => r.date.slice(5)),  // MM-DD
      axisLabel: { fontSize: 10, rotate: 30, color: '#888' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 10,
        color: '#888',
        formatter: (v: number) => fmtAxisValue(v),
      },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: [
      {
        name: '개인·기타',
        type: 'bar',
        data: chartRows.map(r => r.individual?.net ?? 0),
        itemStyle: {
          color: (p: any) => (p.value >= 0 ? '#3b82f6' : '#93c5fd'),
        },
      },
      {
        name: '외국인',
        type: 'bar',
        data: chartRows.map(r => r.foreign?.net ?? 0),
        itemStyle: {
          color: (p: any) => (p.value >= 0 ? '#22c55e' : '#86efac'),
        },
      },
      {
        name: '기관합계',
        type: 'bar',
        data: chartRows.map(r => r.institution?.net ?? 0),
        itemStyle: {
          color: (p: any) => (p.value >= 0 ? '#f59e0b' : '#fcd34d'),
        },
      },
    ],
  };

  const summary = data?.summary ?? {};
  const summaryCards = [
    { key: 'individual', label: '개인·기타법인', color: 'blue' },
    { key: 'foreign', label: '외국인', color: 'green' },
    { key: 'institution', label: '기관합계', color: 'amber' },
  ] as const;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">투자자별 매매동향</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            KRX 기준 투자주체별 순매수 동향 (단위: 억원)
          </p>
        </div>
        <div className="flex gap-2">
          {/* 시장 토글 */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['KOSPI', 'KOSDAQ'] as MarketCode[]).map(m => (
              <button key={m} onClick={() => setMarket(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  market === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {m}
              </button>
            ))}
          </div>
          {/* 기간 토글 */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([p, label]) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">KRX 데이터 조회 중... (최초 로딩 시 10~20초 소요)</p>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            {error === 'KRX 인증 필요' ? (
              <>
                <p className="text-sm font-semibold text-foreground">KRX 계정 설정 필요</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  KRX 데이터 포털이 2026년부터 로그인을 요구합니다.<br />
                  <a href="https://data.krx.co.kr" target="_blank" rel="noopener noreferrer"
                    className="underline text-blue-500">data.krx.co.kr</a>에서 무료 회원가입 후
                  EC2 .env에 <code className="bg-muted px-1 rounded">KRX_ID</code> /&nbsp;
                  <code className="bg-muted px-1 rounded">KRX_PW</code> 를 추가하고
                  PM2를 재시작하세요.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">데이터 조회 실패: {error}</p>
            )}
          </CardContent>
        </Card>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            해당 기간에 거래 데이터가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-3">
            {summaryCards.map(({ key, label }) => {
              const v = summary[key] ?? 0;
              const inWon = Math.abs(v) > 100_000_000;
              const billions = inWon ? v / 100_000_000 : v;
              const isPos = billions > 0;
              return (
                <Card key={key}>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`mt-1 text-xl font-bold tabular-nums ${isPos ? 'text-blue-600' : billions < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {fmtValue(v, true)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">기간 누적 순매수</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 추세 차트 */}
          <Card className="min-w-0 overflow-hidden">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">순매수 추이</p>
              <p className="text-xs text-muted-foreground">개인·기타 / 외국인 / 기관합계 일별 순매수</p>
            </div>
            <div ref={containerRef} className="px-2 py-3" style={{ overflow: 'hidden' }}>
              <ReactECharts ref={chartRef} option={chartOption} style={{ height: 280 }} />
            </div>
          </Card>

          {/* 상세 테이블 */}
          <Card className="min-w-0">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">투자자별 순매수 상세</p>
              <p className="text-xs text-muted-foreground">단위: 억원 · 파란색 순매수 / 빨간색 순매도</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">날짜</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">개인·기타</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">외국인</th>
                    {INVESTOR_COLS.map(c => (
                      <th key={c.key} className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.data.map(row => (
                    <tr key={row.date} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium tabular-nums whitespace-nowrap">{row.date}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap ${netColor(row.individual?.net ?? 0)}`}>
                        {fmtValue(row.individual?.net ?? 0)}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap ${netColor(row.foreign?.net ?? 0)}`}>
                        {fmtValue(row.foreign?.net ?? 0)}
                      </td>
                      {INVESTOR_COLS.map(c => {
                        const v = (row as any)[c.key]?.net ?? 0;
                        return (
                          <td key={c.key} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${netColor(v)}`}>
                            {fmtValue(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-xs text-muted-foreground text-center pb-2">
            * 출처: KRX · 개인 = 개인투자자 · 최종 데이터는 장 마감(오후 6시) 후 확정
          </p>
        </>
      )}
    </div>
  );
}
