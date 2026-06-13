'use client';

import { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

interface ScoreRadarChartProps {
  scoreDetail: {
    technicalScore: number;
    fundamentalScore: number;
    newsScore: number;
    macroScore: number;
    flowScore: number;
  };
}

export function ScoreRadarChart({ scoreDetail }: ScoreRadarChartProps) {
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

  const option = {
    radar: {
      indicator: [
        { name: '기술적', max: 100 },
        { name: '펀더멘털', max: 100 },
        { name: '뉴스', max: 100 },
        { name: '거시', max: 100 },
        { name: '수급', max: 100 },
      ],
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [
              scoreDetail.technicalScore,
              scoreDetail.fundamentalScore,
              scoreDetail.newsScore,
              scoreDetail.macroScore,
              scoreDetail.flowScore,
            ],
            name: '점수',
            areaStyle: { color: 'rgba(59,130,246,0.2)' },
            lineStyle: { color: '#3b82f6' },
          },
        ],
      },
    ],
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <ReactECharts ref={chartRef} option={option} style={{ height: '240px', width: '100%' }} />
    </div>
  );
}
