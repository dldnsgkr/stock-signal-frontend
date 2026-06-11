export type SignalAction = 'BUY' | 'WATCH' | 'AVOID';

export interface FeatureSnapshot {
  technical: {
    ma20Position: number;
    ma60Position: number;
    volumeGrowthRate: number;
    momentum5d: number;
    momentum20d: number;
  };
  fundamental: {
    roe: number | null;
    operatingIncomeGrowth: number | null;
    perRelative: number | null;
    pbrRelative: number | null;
  };
  news: {
    sentimentAvg: number;
    negativeCount: number;
    positiveCount: number;
    newsFrequencySpike: boolean;
  };
  macro: {
    vix: number | null;
    interestRateSensitivity: number;
    fxImpact: number;
  };
  flow: {
    foreignNetBuy: number | null;
    institutionalNetBuy: number | null;
    tradingValueGrowth: number;
  };
}

export interface RecommendationScoreDetail {
  technicalScore: number;
  fundamentalScore: number;
  newsScore: number;
  macroScore: number;
  flowScore: number;
  totalScore: number;
}

export interface Recommendation {
  id: number;
  recommendationRunId: number;
  stockId: number;
  stock: {
    symbol: string;
    name: string;
    sector: string | null;
  };
  action: SignalAction;
  score: number;
  confidence: number;
  entryPrice: number;
  reasons: string[];
  scoreDetail: RecommendationScoreDetail;
  featureSnapshot: FeatureSnapshot;
  recommendedAt: string;
  modelVersion: string;
}

export interface RecommendationRun {
  id: number;
  modelVersion: string;
  runType: 'SCHEDULED' | 'MANUAL';
  marketCode: string;
  executedAt: string;
  notes: string | null;
  recommendationCount: number;
}

export interface ModelVersion {
  id: number;
  versionName: string;
  strategyType: string;
  config: Record<string, unknown>;
  deployedAt: string;
  isActive: boolean;
}
