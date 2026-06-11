export type MarketCode = 'US' | 'KR';

export interface Market {
  id: number;
  code: MarketCode;
  name: string;
}

export interface MacroIndicator {
  id: number;
  marketCode: MarketCode;
  indicatorType: string;
  value: number;
  observedAt: string;
}

export interface MarketSummary {
  market: MarketCode;
  date: string;
  topSignals: StockSignalSummary[];
  hitRate7d: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  vix?: number;
}

export interface StockSignalSummary {
  symbol: string;
  name: string;
  action: SignalAction;
  score: number;
  confidence: number;
  priceChange1d: number;
}
