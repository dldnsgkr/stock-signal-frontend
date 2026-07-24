'use client';

import ReactECharts from 'echarts-for-react';

export interface FlowPoint {
  date: string;
  foreign: number | null;
  institution: number | null;
}

interface InvestorFlowChartProps {
  flows: FlowPoint[];
}

// 투자자 식별 색은 투자자 동향 페이지와 동일하게 유지 (외국인=green, 기관=amber)
const COLOR_FOREIGN = '#22c55e';
const COLOR_INSTITUTION = '#f59e0b';

const toEok = (v: number | null) => (v == null ? null : Math.round((v / 1e8) * 10) / 10);

function fmtEok(v: number | null | undefined): string {
  if (v == null) return '-';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function InvestorFlowChart({ flows }: InvestorFlowChartProps) {
  const dates = flows.map(f => f.date.slice(5).replace('-', '/'));
  const foreignDaily = flows.map(f => toEok(f.foreign));
  const instDaily = flows.map(f => toEok(f.institution));

  // 누적: 결측일은 0으로 취급해 이어간다 (거래일만 존재하므로 실질 결측은 드묾)
  let fSum = 0;
  let iSum = 0;
  const foreignCum = flows.map(f => { fSum += (f.foreign ?? 0) / 1e8; return Math.round(fSum * 10) / 10; });
  const instCum = flows.map(f => { iSum += (f.institution ?? 0) / 1e8; return Math.round(iSum * 10) / 10; });

  const option = {
    color: [COLOR_FOREIGN, COLOR_INSTITUTION],
    legend: {
      top: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { fontSize: 11, color: '#888' },
      data: ['외국인', '기관'],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      textStyle: { fontSize: 11 },
      formatter: (params: any[]) => {
        if (!params?.length) return '';
        const idx = params[0].dataIndex;
        const raw = flows[idx];
        const day = WEEKDAYS[new Date(raw.date + 'T00:00:00').getDay()];
        const lines = [`${raw.date} (${day})`];
        for (const p of params) {
          lines.push(`${p.marker} ${p.seriesName}: <b>${fmtEok(p.value)}</b>`);
        }
        return lines.join('<br/>');
      },
    },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      { left: 56, right: 12, top: 28, height: '38%' },
      { left: 56, right: 12, top: '58%', height: '30%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        gridIndex: 0,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      {
        type: 'category',
        data: dates,
        gridIndex: 1,
        axisLabel: { fontSize: 10, color: '#888' },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: '일별 (억원)',
        nameTextStyle: { fontSize: 10, color: '#888', align: 'left' },
        axisLabel: { fontSize: 10, color: '#888' },
        splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        name: '누적 (억원)',
        nameTextStyle: { fontSize: 10, color: '#888', align: 'left' },
        axisLabel: { fontSize: 10, color: '#888' },
        splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
      },
    ],
    series: [
      {
        name: '외국인',
        type: 'bar',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: foreignDaily,
        barMaxWidth: 6,
        itemStyle: { borderRadius: [2, 2, 0, 0] },
      },
      {
        name: '기관',
        type: 'bar',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: instDaily,
        barMaxWidth: 6,
        itemStyle: { borderRadius: [2, 2, 0, 0] },
      },
      {
        name: '외국인',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: foreignCum,
        showSymbol: false,
        lineStyle: { width: 2 },
      },
      {
        name: '기관',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: instCum,
        showSymbol: false,
        lineStyle: { width: 2 },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 340 }} notMerge />;
}
