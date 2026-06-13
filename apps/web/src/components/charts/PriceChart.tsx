'use client';

import { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

interface PriceData {
  date: string;
  close: number;
  volume: number;
}

interface PriceChartProps {
  data: PriceData[];
  symbol: string;
}

export function PriceChart({ data, symbol }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance()?.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dates = data.map((d) => d.date.substring(0, 10));
  const closes = data.map((d) => Number(d.close));
  const volumes = data.map((d) => Number(d.volume));

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: [symbol, '거래량'] },
    grid: [
      { left: '5%', right: '5%', top: '8%', height: '55%' },
      { left: '5%', right: '5%', top: '70%', height: '15%' },
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
        areaStyle: { color: 'rgba(59,130,246,0.1)' },
      },
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
    <div ref={containerRef} style={{ width: '100%' }}>
      <ReactECharts ref={chartRef} option={option} style={{ height: '360px', width: '100%' }} />
    </div>
  );
}
