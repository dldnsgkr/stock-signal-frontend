export interface Stock {
  id: number;
  marketId: number;
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  isActive: boolean;
}

export interface PriceDaily {
  id: number;
  stockId: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number | null;
}

export interface FinancialMetrics {
  id: number;
  stockId: number;
  periodType: 'ANNUAL' | 'QUARTERLY';
  periodEnd: string;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  roe: number | null;
  per: number | null;
  pbr: number | null;
  debtRatio: number | null;
}

export interface NewsArticle {
  id: number;
  source: string;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string;
  sentimentScore: number | null;
  language: string;
}

export interface StockDetail extends Stock {
  latestPrice: PriceDaily | null;
  latestFinancials: FinancialMetrics | null;
  recentNews: NewsArticle[];
}
