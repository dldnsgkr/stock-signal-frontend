// 관리자 API — backend admin.service.ts 의 서버리스 판.
//
// DB 기반 조회(실행 이력·데이터 신선도·품질·스코어링 분석)는 그대로 이식했고,
// 서버 전용이던 것(Bull 큐·PM2·로그 파일·RAM/디스크)은 GitHub Actions 런으로 대체했다.
// 응답 형태는 화면이 읽는 필드에 맞춰 유지한다.
import { HttpException } from '../http-errors';
import { dispatch, GitHubError, listRuns, WorkflowRun } from '../github';
import { PrismaService } from '../prisma';

// 관리자 화면의 '작업 실행' 엔드포인트 → (워크플로, 입력)
const JOB_MAP: Record<string, { workflow: string; job?: string }> = {
  '/admin/jobs/run-pipeline': { workflow: 'pipeline.yml', job: 'run-pipeline' },
  '/admin/jobs/collect-stock-list': { workflow: 'pipeline.yml', job: 'collect-stock-list' },
  '/admin/jobs/collect-prices': { workflow: 'pipeline.yml', job: 'collect-prices' },
  '/admin/jobs/collect-news': { workflow: 'pipeline.yml', job: 'collect-news' },
  '/admin/jobs/collect-financials': { workflow: 'pipeline.yml', job: 'collect-financials' },
  '/admin/jobs/collect-macro': { workflow: 'pipeline.yml', job: 'collect-macro' },
  '/admin/jobs/collect-investor-flow': { workflow: 'pipeline.yml', job: 'collect-investor-flow' },
  '/admin/jobs/generate-recommendations': { workflow: 'pipeline.yml', job: 'generate-recommendations' },
  '/admin/jobs/check-sell-signals': { workflow: 'pipeline.yml', job: 'check-sell-signals' },
  '/admin/jobs/evaluate-recommendations': { workflow: 'evaluate.yml' },
};

const runStatus = (r: WorkflowRun) =>
  r.status !== 'completed' ? (r.status === 'in_progress' ? 'active' : 'waiting')
    : r.conclusion === 'success' ? 'completed' : 'failed';

export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 작업 실행 (Bull 큐 → Actions workflow_dispatch) ──────────────────────
  async triggerJob(endpoint: string, market: string) {
    const target = JOB_MAP[endpoint];
    if (!target) throw new HttpException(404, `알 수 없는 작업: ${endpoint}`);
    const startedAt = Date.now();
    const inputs: Record<string, string> = target.workflow === 'pipeline.yml'
      ? { market: market === 'KR' ? 'KR' : 'US', job: target.job! }
      : {};
    try {
      await dispatch(target.workflow, inputs);
    } catch (e) {
      if (e instanceof GitHubError) throw new HttpException(e.status === 503 ? 503 : 502, e.message);
      throw e;
    }
    // jobId 에 워크플로와 실행 시각을 담는다 — 상태 조회 때 그 이후 생성된 수동 런을 찾는다
    return { jobId: `gh:${target.workflow}:${startedAt}`, status: 'queued' };
  }

  async getJobStatus(jobId: string) {
    const m = /^gh:([\w.-]+):(\d+)$/.exec(jobId);
    if (!m) return { status: 'failed', failedReason: '잘못된 작업 ID' };
    const [, workflow, ts] = m;
    const since = Number(ts) - 15_000; // 시계 오차 여유
    const runs = await listRuns(workflow, 10, '&event=workflow_dispatch');
    const run = runs
      .filter((r) => new Date(r.created_at).getTime() >= since)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (!run) return { id: jobId, status: 'waiting', data: { currentStep: 'GitHub 대기열' } };
    return {
      id: jobId,
      status: runStatus(run),
      data: { currentStep: run.status === 'in_progress' ? '실행 중 (GitHub Actions)' : run.status },
      failedReason: runStatus(run) === 'failed' ? `${run.conclusion} — ${run.html_url}` : undefined,
      url: run.html_url,
    };
  }

  // ── 실행 이력 (DB) ──────────────────────────────────────────────────────
  async getRecentRunsDetailed(limit: number) {
    const runs = await this.prisma.recommendationRun.findMany({
      include: { modelVersion: true, _count: { select: { recommendations: true } } },
      orderBy: { executedAt: 'desc' },
      take: limit,
    });
    return runs.map((run) => ({
      id: run.id,
      marketCode: run.marketCode,
      executedAt: run.executedAt,
      runType: run.runType,
      modelVersion: run.modelVersion?.versionName ?? '-',
      count: run._count.recommendations,
      notes: run.notes,
    }));
  }

  // ── 실패 로그 (Bull failed jobs → Actions 실패 런) ───────────────────────
  async getRecentFailures(limit = 30) {
    const [pipe, evalRuns] = await Promise.all([listRuns('pipeline.yml', 50), listRuns('evaluate.yml', 20)]);
    return [...pipe, ...evalRuns]
      .filter((r) => r.status === 'completed' && r.conclusion !== 'success' && r.conclusion !== 'skipped')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((r) => ({
        queue: r.path.endsWith('evaluate.yml') ? '성과 평가' : '파이프라인',
        jobId: String(r.id),
        market: /\bKR\b/.test(r.display_title) ? 'KR' : /\bUS\b/.test(r.display_title) ? 'US' : null,
        failedAt: r.updated_at,
        reason: `${r.conclusion} (${r.event}) — 로그: ${r.html_url}`,
        attemptsMade: 1,
      }));
  }

  // ── 로그 (PM2 로그 파일 → 최근 Actions 런 요약) ──────────────────────────
  async getLogs(_service: string, lines: number) {
    const runs = await listRuns('pipeline.yml', Math.min(lines, 50));
    const out = runs.map((r) =>
      `${r.created_at}  [${r.event}] ${r.status}${r.conclusion ? '/' + r.conclusion : ''}  ${r.display_title}  ${r.html_url}`);
    return {
      lines: out,
      service: 'github-actions',
      total: out.length,
      notice: '서버리스 전환으로 서버 로그 파일이 없습니다. 각 런의 상세 로그는 링크(GitHub Actions)에서 확인하세요.',
    };
  }

  // ── 시스템 (PM2/RAM/디스크 → 워크플로별 최근 상태 + DB 용량) ──────────────
  async getSystemStatus() {
    const [pipe, evalRuns] = await Promise.all([listRuns('pipeline.yml', 5), listRuns('evaluate.yml', 5)]);
    type SizeRow = { size: string };
    const [db] = await this.prisma.$queryRaw<SizeRow[]>`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`;
    const proc = (name: string, runs: WorkflowRun[]) => {
      const last = runs[0];
      return {
        id: name,
        name,
        status: !last ? 'unknown' : last.status !== 'completed' ? 'running'
          : last.conclusion === 'success' ? 'online' : 'errored',
        uptimeMs: last ? Date.now() - new Date(last.updated_at).getTime() : null,
        restarts: runs.filter((r) => r.conclusion && r.conclusion !== 'success').length,
        memoryBytes: 0,
        cpu: 0,
        pid: last?.id ?? null,
        url: last?.html_url ?? null,
      };
    };
    return {
      processes: [proc('pipeline (Actions)', pipe), proc('evaluate (Actions)', evalRuns)],
      memory: `서버리스 — 상시 서버 없음 (GitHub Actions 러너는 실행 때만 생성)`,
      disk: `Neon DB 사용량 ${db?.size ?? '?'} / 무료 512MB`,
      uptime: '',
    };
  }

  // ── 데이터 신선도 (DB) — Bull 큐 통계 대신 최근 7일 Actions 실패 수 ────────
  async getDataHealth() {
    const now = new Date();
    type RunRow = { market_code: string; last_run: Date; run_count: bigint };
    const runRows = await this.prisma.$queryRaw<RunRow[]>`
      SELECT market_code, MAX(executed_at) AS last_run, COUNT(*) AS run_count
      FROM recommendation_runs WHERE executed_at >= NOW() - INTERVAL '30 days'
      GROUP BY market_code
    `;
    type PriceRow = { market_code: string; last_date: Date; stock_count: bigint };
    const priceRows = await this.prisma.$queryRaw<PriceRow[]>`
      SELECT m.code AS market_code, MAX(pd.date) AS last_date, COUNT(DISTINCT pd.stock_id) AS stock_count
      FROM price_daily pd JOIN stocks s ON s.id = pd.stock_id JOIN markets m ON m.id = s.market_id
      WHERE pd.date >= NOW() - INTERVAL '30 days'
      GROUP BY m.code
    `;
    type NewsRow = { period: string; count: bigint };
    const newsRows = await this.prisma.$queryRaw<NewsRow[]>`
      SELECT '24h' AS period, COUNT(*) AS count FROM news_articles WHERE created_at >= NOW() - INTERVAL '24 hours'
      UNION ALL
      SELECT '7d'  AS period, COUNT(*) AS count FROM news_articles WHERE created_at >= NOW() - INTERVAL '7 days'
    `;
    type FinRow = { market_code: string; latest_period: Date; count: bigint };
    const finRows = await this.prisma.$queryRaw<FinRow[]>`
      SELECT m.code AS market_code, MAX(fm.period_end) AS latest_period, COUNT(*) AS count
      FROM financial_metrics fm JOIN stocks s ON s.id = fm.stock_id JOIN markets m ON m.id = s.market_id
      GROUP BY m.code
    `;

    let failed7d = 0;
    let actionsError: string | null = null;
    try {
      const weekAgo = Date.now() - 7 * 86400000;
      const runs = [...(await listRuns('pipeline.yml', 30)), ...(await listRuns('evaluate.yml', 10))];
      failed7d = runs.filter((r) => new Date(r.created_at).getTime() >= weekAgo
        && r.status === 'completed' && r.conclusion !== 'success' && r.conclusion !== 'skipped').length;
    } catch (e) {
      actionsError = e instanceof Error ? e.message : String(e);
    }

    const hoursAgo = (d: Date | null) => (d ? Math.round((now.getTime() - new Date(d).getTime()) / 3600000) : null);
    const newsMap = Object.fromEntries(newsRows.map((r) => [r.period, Number(r.count)]));

    const markets = ['US', 'KR'].map((code) => {
      const run = runRows.find((r) => r.market_code === code);
      const price = priceRows.find((r) => r.market_code === code);
      const fin = finRows.find((r) => r.market_code === code);
      const signalAgeH = hoursAgo(run?.last_run ?? null);
      const priceAgeDays = price?.last_date
        ? Math.round((now.getTime() - new Date(price.last_date).getTime()) / 86400000) : null;
      return {
        market: code,
        signal: {
          lastRunAt: run?.last_run ?? null,
          ageHours: signalAgeH,
          runCount30d: Number(run?.run_count ?? 0),
          status: signalAgeH === null ? 'unknown' : signalAgeH > 72 ? 'danger' : signalAgeH > 48 ? 'warn' : 'ok',
        },
        price: {
          lastDate: price?.last_date ?? null,
          ageDays: priceAgeDays,
          stockCount: Number(price?.stock_count ?? 0),
          status: priceAgeDays === null ? 'unknown' : priceAgeDays > 5 ? 'danger' : priceAgeDays > 2 ? 'warn' : 'ok',
        },
        financial: {
          latestPeriod: fin?.latest_period ?? null,
          count: Number(fin?.count ?? 0),
          status: fin ? 'ok' : 'unknown',
        },
      };
    });

    return {
      checkedAt: now,
      markets,
      news: {
        last24h: newsMap['24h'] ?? 0,
        last7d: newsMap['7d'] ?? 0,
        status: (newsMap['24h'] ?? 0) === 0 ? 'warn' : 'ok',
      },
      // 큐가 없어졌으므로 Actions 최근 7일 실패 런 수로 대체
      queues: { 'GitHub Actions 최근 7일': actionsError ? null : { waiting: 0, active: 0, failed: failed7d } },
      summary: {
        hasWarning: markets.some((m) => m.signal.status !== 'ok' || m.price.status !== 'ok') || (newsMap['24h'] ?? 0) === 0,
        hasDanger: markets.some((m) => m.signal.status === 'danger' || m.price.status === 'danger'),
        totalFailedJobs: failed7d,
      },
    };
  }

  // ── 데이터 품질 (DB, 원본과 동일) ────────────────────────────────────────
  async getDataQualityIssues(market = 'US') {
    type PriceAnomalyRow = { symbol: string; name: string; date: Date; close: string; prev_close: string; change_ratio: string };
    const priceAnomalies = await this.prisma.$queryRaw<PriceAnomalyRow[]>`
      WITH daily_changes AS (
        SELECT s.symbol, s.name, pd.date, pd.close,
               LAG(pd.close) OVER (PARTITION BY pd.stock_id ORDER BY pd.date) AS prev_close
        FROM price_daily pd JOIN stocks s ON s.id = pd.stock_id JOIN markets m ON m.id = s.market_id
        WHERE m.code = ${market} AND pd.date >= NOW() - INTERVAL '7 days' AND pd.close > 0
      )
      SELECT symbol, name, date, close, prev_close, ABS((close - prev_close) / prev_close) AS change_ratio
      FROM daily_changes
      WHERE prev_close IS NOT NULL AND prev_close > 0 AND ABS((close - prev_close) / prev_close) > 0.5
      ORDER BY change_ratio DESC LIMIT 30
    `;
    type ZeroPriceRow = { symbol: string; name: string; date: Date; close: string };
    const zeroPrices = await this.prisma.$queryRaw<ZeroPriceRow[]>`
      SELECT s.symbol, s.name, pd.date, pd.close
      FROM price_daily pd JOIN stocks s ON s.id = pd.stock_id JOIN markets m ON m.id = s.market_id
      WHERE m.code = ${market} AND pd.date >= NOW() - INTERVAL '7 days' AND pd.close <= 0
      LIMIT 20
    `;
    type FinAnomalyRow = { symbol: string; name: string; roe: string | null; per: string | null; pbr: string | null; period_end: Date };
    const finAnomalies = await this.prisma.$queryRaw<FinAnomalyRow[]>`
      SELECT DISTINCT ON (s.id) s.symbol, s.name, fm.roe, fm.per, fm.pbr, fm.period_end
      FROM financial_metrics fm JOIN stocks s ON s.id = fm.stock_id JOIN markets m ON m.id = s.market_id
      WHERE m.code = ${market}
        AND (ABS(fm.roe) > 5
             OR (fm.per IS NOT NULL AND (fm.per < 0 OR fm.per > 500))
             OR (fm.pbr IS NOT NULL AND (fm.pbr < 0 OR fm.pbr > 50)))
      ORDER BY s.id, fm.period_end DESC LIMIT 30
    `;

    const priceIssues = [
      ...priceAnomalies.map((r) => ({
        type: 'price_spike' as const,
        severity: Number(r.change_ratio) > 0.8 ? 'danger' : 'warn',
        symbol: r.symbol,
        name: r.name,
        detail: `${(Number(r.change_ratio) * 100).toFixed(1)}% 급변 (${Number(r.prev_close).toFixed(2)} → ${Number(r.close).toFixed(2)})`,
        date: r.date,
      })),
      ...zeroPrices.map((r) => ({
        type: 'zero_price' as const,
        severity: 'danger' as const,
        symbol: r.symbol,
        name: r.name,
        detail: `가격 ${Number(r.close).toFixed(4)} (0 이하)`,
        date: r.date,
      })),
    ];
    const finIssues = finAnomalies.map((r) => {
      const flags: string[] = [];
      if (r.roe && Math.abs(Number(r.roe)) > 5) flags.push(`ROE ${(Number(r.roe) * 100).toFixed(0)}%`);
      if (r.per && (Number(r.per) < 0 || Number(r.per) > 500)) flags.push(`PER ${Number(r.per).toFixed(1)}`);
      if (r.pbr && (Number(r.pbr) < 0 || Number(r.pbr) > 50)) flags.push(`PBR ${Number(r.pbr).toFixed(1)}`);
      return { type: 'financial_anomaly' as const, severity: 'warn' as const, symbol: r.symbol, name: r.name, detail: flags.join(', '), date: r.period_end };
    });
    const allIssues = [...priceIssues, ...finIssues].sort((a) => (a.severity === 'danger' ? -1 : 1));
    return {
      market,
      checkedAt: new Date(),
      total: allIssues.length,
      danger: allIssues.filter((i) => i.severity === 'danger').length,
      warn: allIssues.filter((i) => i.severity === 'warn').length,
      issues: allIssues,
    };
  }

  // ── 스코어링 분석 (DB) ──────────────────────────────────────────────────
  async getScoringAnalysis(market = 'US') {
    // ⚠️ `${WINDOW_DAYS}::int` 캐스트 필수 — Prisma 가 number 를 bigint 로 바인딩하는데
    //    make_interval(days => ...) 는 int 만 받는다(EC2 판에서 실제로 500 을 겪음).
    const WINDOW_DAYS = 90;
    const CURRENT_THRESHOLD = 65;

    type ThresholdRow = { thr: number; cnt: number; hit_rate: number | null; avg_return: number | null; avg_alpha: number | null };
    const thresholdRows = await this.prisma.$queryRaw<ThresholdRow[]>`
      WITH ev AS (
        SELECT rec.score, res.hit_7d, res.return_7d, res.alpha_7d
        FROM recommendations rec
        JOIN recommendation_runs r ON r.id = rec.recommendation_run_id
        JOIN recommendation_results res ON res.recommendation_id = rec.id
        WHERE r.market_code = ${market} AND res.hit_7d IS NOT NULL
          AND rec.recommended_at >= NOW() - make_interval(days => ${WINDOW_DAYS}::int)
      )
      SELECT t.thr::int AS thr, COUNT(ev.score)::int AS cnt,
             AVG(CASE WHEN ev.hit_7d THEN 1.0 ELSE 0 END)::float AS hit_rate,
             AVG(ev.return_7d)::float AS avg_return, AVG(ev.alpha_7d)::float AS avg_alpha
      FROM (VALUES (50),(55),(60),(65),(70),(75),(80)) AS t(thr)
      LEFT JOIN ev ON ev.score >= t.thr
      GROUP BY t.thr ORDER BY t.thr
    `;

    type BandRow = { band: string; lo: number; cnt: number; hit_rate: number | null; avg_return: number | null; avg_alpha: number | null };
    const bandRows = await this.prisma.$queryRaw<BandRow[]>`
      WITH ev AS (
        SELECT rec.score, res.hit_7d, res.return_7d, res.alpha_7d
        FROM recommendations rec
        JOIN recommendation_runs r ON r.id = rec.recommendation_run_id
        JOIN recommendation_results res ON res.recommendation_id = rec.id
        WHERE r.market_code = ${market} AND res.hit_7d IS NOT NULL
          AND rec.recommended_at >= NOW() - make_interval(days => ${WINDOW_DAYS}::int)
      )
      SELECT CASE WHEN score < 50 THEN '<50'   WHEN score < 55 THEN '50–55'
                  WHEN score < 60 THEN '55–60' WHEN score < 65 THEN '60–65'
                  WHEN score < 70 THEN '65–70' WHEN score < 75 THEN '70–75'
                  ELSE '75+' END AS band,
             MIN(score)::float AS lo, COUNT(*)::int AS cnt,
             AVG(CASE WHEN hit_7d THEN 1.0 ELSE 0 END)::float AS hit_rate,
             AVG(return_7d)::float AS avg_return, AVG(alpha_7d)::float AS avg_alpha
      FROM ev GROUP BY 1 ORDER BY 2
    `;

    // 주도 전략 = 서브스코어 최대. ⚠️ Neon 은 용량 때문에 비 BUY 과거 행의 score_detail_json 을
    // '{}' 로 비웠다(neon-retention.sql) — 그 행을 넣으면 0/0/0 이 전부 'momentum' 으로 분류된다.
    // JSON 이 남아 있는 행(BUY 전체 + 최신 런)만 집계한다.
    type StratRow = { strat: string; cnt: number; hit_rate: number | null; avg_return: number | null; avg_alpha: number | null };
    const stratRows = await this.prisma.$queryRaw<StratRow[]>`
      WITH ev AS (
        SELECT res.hit_7d, res.return_7d, res.alpha_7d,
               COALESCE((rec.score_detail_json->>'momentum_score')::numeric, 0)  AS mom,
               COALESCE((rec.score_detail_json->>'value_score')::numeric, 0)     AS val,
               COALESCE((rec.score_detail_json->>'sentiment_score')::numeric, 0) AS sent
        FROM recommendations rec
        JOIN recommendation_runs r ON r.id = rec.recommendation_run_id
        JOIN recommendation_results res ON res.recommendation_id = rec.id
        WHERE r.market_code = ${market} AND res.hit_7d IS NOT NULL
          AND rec.recommended_at >= NOW() - make_interval(days => ${WINDOW_DAYS}::int)
          AND rec.score_detail_json <> '{}'::jsonb
      )
      SELECT CASE WHEN mom >= val AND mom >= sent THEN 'momentum'
                  WHEN val > mom AND val >= sent  THEN 'value'
                  ELSE 'sentiment' END AS strat,
             COUNT(*)::int AS cnt,
             AVG(CASE WHEN hit_7d THEN 1.0 ELSE 0 END)::float AS hit_rate,
             AVG(return_7d)::float AS avg_return, AVG(alpha_7d)::float AS avg_alpha
      FROM ev GROUP BY 1
    `;

    const totalEvaluated = bandRows.reduce((sum, r) => sum + r.cnt, 0);
    const thresholdSensitivity = thresholdRows.map((r) => ({
      threshold: r.thr,
      count: r.cnt,
      hitRate7d: r.cnt > 0 ? r.hit_rate : null,
      avgReturn7d: r.cnt > 0 ? r.avg_return : null,
      avgAlpha7d: r.cnt > 0 ? r.avg_alpha : null,
      isCurrent: r.thr === CURRENT_THRESHOLD,
    }));
    const scoreBands = bandRows.map((r) => ({
      band: r.band,
      count: r.cnt,
      hitRate7d: r.hit_rate,
      avgReturn7d: r.avg_return,
      avgAlpha7d: r.avg_alpha,
      isCurrentBuyZone: r.lo >= CURRENT_THRESHOLD,
    }));

    type StratKey = 'momentum' | 'value' | 'sentiment';
    const WEIGHTS: Record<StratKey, number> = { momentum: 0.45, value: 0.25, sentiment: 0.3 };
    const LABELS: Record<StratKey, string> = { momentum: '모멘텀', value: '가치', sentiment: '감성' };
    const strategyBreakdown = (['momentum', 'value', 'sentiment'] as StratKey[]).map((strat) => {
      const row = stratRows.find((r) => r.strat === strat);
      return {
        strategy: strat,
        label: LABELS[strat],
        count: row?.cnt ?? 0,
        hitRate7d: row?.hit_rate ?? null,
        avgReturn7d: row?.avg_return ?? null,
        avgAlpha7d: row?.avg_alpha ?? null,
        currentWeight: WEIGHTS[strat],
      };
    });

    const currentThr = thresholdSensitivity.find((t) => t.isCurrent);
    const bestThr = thresholdSensitivity
      .filter((t) => t.count >= 5 && t.hitRate7d != null)
      .sort((a, b) => (b.hitRate7d ?? 0) - (a.hitRate7d ?? 0))[0];
    const bestStrat = [...strategyBreakdown]
      .filter((s) => s.count >= 3 && s.hitRate7d != null)
      .sort((a, b) => (b.hitRate7d ?? 0) - (a.hitRate7d ?? 0))[0];

    return {
      market,
      windowDays: WINDOW_DAYS,
      totalEvaluated,
      thresholdSensitivity,
      scoreBands,
      strategyBreakdown,
      insight: {
        currentThreshold: CURRENT_THRESHOLD,
        currentThresholdHitRate: currentThr?.hitRate7d ?? null,
        bestThreshold: bestThr?.threshold ?? null,
        bestThresholdHitRate: bestThr?.hitRate7d ?? null,
        dominantStrategy: bestStrat?.label ?? null,
        dominantStrategyHitRate: bestStrat?.hitRate7d ?? null,
      },
    };
  }
}
