import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(decimals)}%`;
}

export function formatPrice(value: number | null | undefined, market = 'US'): string {
  if (value == null) return '-';
  if (market === 'KR') {
    return `₩${Math.round(value).toLocaleString('ko-KR')}`;
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '-';
  return value.toLocaleString('en-US');
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function getActionColor(action: string): string {
  switch (action) {
    case 'BUY': return 'text-green-600 bg-green-50 border-green-200';
    case 'WATCH': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'AVOID': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

export function getActionLabel(action: string): string {
  switch (action) {
    case 'BUY': return '매수 시그널';
    case 'WATCH': return '관심 종목';
    case 'AVOID': return '투자 주의';
    default: return action;
  }
}
