'use client';

import { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

interface PriceData {
  date: string;
  close: number;
  volume: number;
}

export interface TechnicalLevels {
  support: number[];
  resistance: number[];
  ma20: number | null;
  ma60: number | null;
}

interface PriceChartProps {
  data: PriceData[];
  symbol: string;
  levels?: TechnicalLevels;
  market?: string;
}

function fmtPrice(v: number, market = 'US') {
  if (market === 'KR') return `₩${Math.round(v).toLocaleString('ko-KR')}`;
  return `$${v.toFixed(2)}`;
}

export function PriceChart({ data, symbol, levels, market = 'US' }: PriceChartProps) {
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

  const dates = data.map((d) => d.date.substring(0, 10));
  const closes = data.map((d) => Number(d.close));
  const volumes = data.map((d) => Number(d.volume));

  // 지지선·저항선 markLine 데이터
  const markLines: any[] = [];
  levels?.resistance.forEach((r) => {
    markLines.push([
      { xAxis: 0, yAxis: r, symbol: 'none' },
      { xAxis: dates.length - 1, yAxis: r, symbol: 'none',
        label: { formatter: `저항 ${fmtPrice(r, market)}`, position: 'end', fontSize: 10 } },
    ]);
  });
  levels?.support.forEach((s) => {
    markLines.push([
      { xAxis: 0, yAxis: s, symbol: 'none' },
      { xAxis: dates.length - 1, yAxis: s, symbol: 'none',
        label: { formatter: `지지 ${fmtPrice(s, market)}`, position: 'end', fontSize: 10 } },
    ]);
  });

  // MA 시리즈
  const extraSeries: any[] = [];
  if (levels?.ma20) {
    extraSeries.push({
      name: 'MA20',
      type: 'line',
      data: closes.map((_, i) => i >= 19 ? Number(closes.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20) : null),
      smooth: false,
      xAxisIndex: 0,
      yAxisIndex: 0,
      lineStyle: { color: '#f59e0b', width: 1, type: 'solid' },
      symbol: 'none',
      showInLegend: true,
    });
  }
  if (levels?.ma60) {
    extraSeries.push({
      name: 'MA60',
      type: 'line',
      data: closes.map((_, i) => i >= 59 ? Number(closes.slice(i - 59, i + 1).reduce((a, b) => a + b, 0) / 60) : null),
      smooth: false,
      xAxisIndex: 0,
      yAxisIndex: 0,
      lineStyle: { color: '#8b5cf6', width: 1, type: 'solid' },
      symbol: 'none',
      showInLegend: true,
    });
  }

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: [symbol, 'MA20', 'MA60', '거래량'], textStyle: { fontSize: 11 } },
    // left/right 를 좁히지 말 것 (2026-08-10 에 둘 다 실제로 깨져 있었다).
    //  · right : 지지·저항 markLine 라벨이 position:'end' 라 격자 바깥에 그려진다.
    //            8% 일 때 '저항 $344.57' 이 잘렸다.
    //  · left  : 원화 6자리(삼성전자 230,000)가 5% 폭에 안 들어가
    //            축 라벨이 전부 '000' 으로만 보였다. 포맷터와 함께 넓힌다.
    grid: [
      { left: '11%', right: '14%', top: '8%', height: '55%' },
      { left: '11%', right: '14%', top: '70%', height: '15%' },
    ],
    xAxis: [
      { type: 'category', data: dates, gridIndex: 0, axisLabel: { show: false } },
      { type: 'category', data: dates, gridIndex: 1 },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        scale: true,
        // 원화는 자릿수가 커서 그대로 두면 축이 안 읽힌다 (230000 → '000' 만 보였다)
        axisLabel: market === 'KR'
          ? { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v.toLocaleString()) }
          : undefined,
      },
      // 거래량은 자릿수가 커서 기본 포맷이면 축 라벨이 잘린다 —
      // AAPL 5천만주가 '50000000' 으로 렌더돼 뒷자리 '000' 만 보였다(2026-08-10).
      {
        type: 'value',
        gridIndex: 1,
        // 거래량 격자는 높이가 15% 뿐이다 — 기본 눈금 수(5~6개)면 라벨이 서로 겹쳐
        // 한 덩어리로 뭉개진다. 눈금을 줄이고 자릿수도 축약한다(2026-08-10).
        splitNumber: 2,
        axisLabel: {
          fontSize: 10,
          formatter: (v: number) =>
            v >= 1e8 ? `${(v / 1e8).toFixed(1)}억`
              : v >= 1e4 ? `${Math.round(v / 1e4).toLocaleString()}만`
                : v.toLocaleString(),
        },
      },
    ],
    series: [
      {
        name: symbol,
        type: 'line',
        data: closes,
        smooth: true,
        xAxisIndex: 0,
        yAxisIndex: 0,
        lineStyle: { color: '#3b82f6' },
        areaStyle: { color: 'rgba(59,130,246,0.08)' },
        markLine: markLines.length > 0 ? {
          silent: true,
          data: markLines,
          lineStyle: { type: 'dashed', width: 1 },
          // 저항은 빨강, 지지는 파랑으로 구분
          itemStyle: { color: '#ef4444' },
        } : undefined,
      },
      ...extraSeries,
      {
        name: '거래량',
        type: 'bar',
        data: volumes,
        xAxisIndex: 1,
        yAxisIndex: 1,
        itemStyle: { color: '#94a3b8' },
      },
    ],
  };

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }}>
      <ReactECharts ref={chartRef} option={option} style={{ height: '360px', width: '100%' }} />
      {levels && (levels.support.length > 0 || levels.resistance.length > 0) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
          {levels.resistance.map((r) => (
            <span key={r} className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-red-400" />
              저항 {fmtPrice(r, market)}
            </span>
          ))}
          {levels.support.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-blue-400" />
              지지 {fmtPrice(s, market)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
