'use client';

import { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

interface ScorePoint {
  date: string;
  score: number;
  action: string;
}

interface ScoreTrendChartProps {
  data: ScorePoint[];
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
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

  const option = {
    grid: { left: 36, right: 12, top: 16, bottom: 36 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        const p = params[0];
        return `${p.axisValue}<br/>점수: <strong>${Number(p.data).toFixed(1)}</strong>`;
      },
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date.slice(0, 10)),
      axisLabel: { fontSize: 9, rotate: 30, color: '#888' },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      interval: 25,
      axisLabel: { fontSize: 9, color: '#888' },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        data: data.map(d => d.score),
        smooth: true,
        symbolSize: 5,
        lineStyle: { width: 2, color: '#3b82f6' },
        itemStyle: {
          color: (p: any) => {
            const v = p.value as number;
            if (v >= 65) return '#22c55e';
            if (v >= 45) return '#f59e0b';
            return '#ef4444';
          },
        },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.18)' },
              { offset: 1, color: 'rgba(59,130,246,0.0)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          data: [
            { yAxis: 65, lineStyle: { color: '#22c55e', type: 'dashed', width: 1 } },
            { yAxis: 45, lineStyle: { color: '#f59e0b', type: 'dashed', width: 1 } },
          ],
        },
      },
    ],
  };

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }}>
      {data.length === 0
        ? <p className="text-xs text-muted-foreground text-center py-6">점수 이력 없음</p>
        : <ReactECharts ref={chartRef} option={option} style={{ height: 160 }} />
      }
    </div>
  );
}
