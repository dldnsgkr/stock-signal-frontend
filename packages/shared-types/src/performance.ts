export interface RecommendationResult {
  id: number;
  recommendationId: number;
  return1d: number | null;
  return7d: number | null;
  return30d: number | null;
  benchmarkReturn1d: number | null;
  benchmarkReturn7d: number | null;
  benchmarkReturn30d: number | null;
  alpha1d: number | null;
  alpha7d: number | null;
  alpha30d: number | null;
  hit1d: boolean | null;
  hit7d: boolean | null;
  hit30d: boolean | null;
  evaluatedAt: string;
}

export interface PerformanceOverview {
  period: '7d' | '30d' | '90d';
  totalRecommendations: number;
  hitRate1d: number;
  hitRate7d: number;
  hitRate30d: number;
  avgReturn1d: number;
  avgReturn7d: number;
  avgReturn30d: number;
  avgAlpha7d: number;
  avgAlpha30d: number;
  byAction: {
    BUY: ActionPerformance;
    WATCH: ActionPerformance;
    AVOID: ActionPerformance;
  };
}

export interface ActionPerformance {
  count: number;
  hitRate7d: number;
  avgReturn7d: number;
  avgAlpha7d: number;
}

export interface ModelVersionPerformance {
  modelVersion: string;
  period: string;
  hitRate7d: number;
  hitRate30d: number;
  avgReturn7d: number;
  avgReturn30d: number;
  totalRuns: number;
  totalRecommendations: number;
}
