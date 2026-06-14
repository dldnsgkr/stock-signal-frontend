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
    grid: [
      { left: '5%', right: '8%', top: '8%', height: '55%' },
      { left: '5%', right: '8%', top: '70%', height: '15%' },
    ],
    xAxis: [
      { type: 'category', data: dates, gridIndex: 0, axisLabel: { show: false } },
      { type: 'category', data: dates, gridIndex: 1 },
    ],
    yAxis: [
      { type: 'value', gridIndex: 0, scale: true },
      { type: 'value', gridIndex: 1 },
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
