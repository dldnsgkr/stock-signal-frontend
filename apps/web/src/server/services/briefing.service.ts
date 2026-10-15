// AI 종목 브리핑 — analysis-service/app/routers/briefing.py 의 이식판.
// 시그널 근거 + 뉴스 + (KR) 수급을 LLM 으로 한국어 요약한다.
// 캐시는 CDN(라우트의 s-maxage)에 맡긴다 — 서버리스라 인메모리 캐시는 인스턴스마다 비어 있다.
import { HttpException, Logger, NotFoundException } from '../http-errors';
import { generateText, llmEnabled, LLMError } from '../llm';
import { PrismaService } from '../prisma';

type RecRow = {
  id: number;
  name: string;
  sector: string | null;
  market: string;
  action: string | null;
  score: string | null;
  confidence: number | null;
  reasons_json: unknown;
  score_detail_json: Record<string, unknown> | null;
  recommended_at: Date | null;
};

export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBriefing(symbol: string) {
    if (!llmEnabled()) throw new HttpException(503, 'LLM 미설정');
    const sym = symbol.toUpperCase();

    const rows = await this.prisma.$queryRaw<RecRow[]>`
      SELECT s.id, s.name, s.sector, m.code AS market,
             r.action, r.score, r.confidence, r.reasons_json, r.score_detail_json,
             r.recommended_at
      FROM stocks s
      JOIN markets m ON m.id = s.market_id
      LEFT JOIN LATERAL (
        SELECT * FROM recommendations rr
        WHERE rr.stock_id = s.id ORDER BY rr.recommended_at DESC LIMIT 1
      ) r ON true
      WHERE s.symbol = ${sym}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('종목 없음');

    type NewsRow = { title: string; sentiment_score: string | null };
    const news = await this.prisma.$queryRaw<NewsRow[]>`
      SELECT n.title, n.sentiment_score
      FROM news_articles n
      JOIN news_stock_relations nr ON nr.news_article_id = n.id
      WHERE nr.stock_id = ${row.id}
      ORDER BY n.published_at DESC LIMIT 5
    `;

    let flowLine = '';
    if (row.market === 'KR') {
      type FlowRow = { investor_type: string; net: bigint | null };
      const flows = await this.prisma.$queryRaw<FlowRow[]>`
        WITH d AS (SELECT DISTINCT trade_date FROM investor_flow_daily
                   WHERE stock_id = ${row.id} ORDER BY trade_date DESC LIMIT 5)
        SELECT investor_type, SUM(net_buy_value)::bigint AS net
        FROM investor_flow_daily
        WHERE stock_id = ${row.id} AND trade_date IN (SELECT trade_date FROM d)
        GROUP BY investor_type
      `;
      const parts: string[] = [];
      for (const f of flows) {
        if (f.investor_type !== 'foreign' && f.investor_type !== 'institution') continue;
        const label = f.investor_type === 'foreign' ? '외국인' : '기관';
        const eok = Math.round(Number(f.net ?? 0) / 1e8);
        parts.push(`${label} ${eok >= 0 ? '+' : ''}${eok}억`);
      }
      if (parts.length) flowLine = '최근 5거래일 수급: ' + parts.join(', ');
    }

    let text: string;
    try {
      // gemini-flash-latest 는 사고(thinking) 토큰을 ~500 소비하므로 넉넉히 준다.
      // thinkingBudget=0 은 이 모델에서 400 거부. 부족하면 답이 잘린다.
      text = await generateText(buildPrompt(row, news, flowLine), { maxTokens: 2000, temperature: 0.4 });
    } catch (e) {
      this.logger.error(`briefing LLM 실패 ${sym}: ${e instanceof LLMError ? e.message : e}`);
      throw new HttpException(503, '브리핑 생성 실패');
    }

    return {
      symbol: sym,
      name: row.name,
      briefing: text,
      basedOn: {
        action: row.action,
        score: row.score != null ? Number(row.score) : null,
        recommendedAt: row.recommended_at ? row.recommended_at.toISOString() : null,
      },
      generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      cached: false,
    };
  }
}

function buildPrompt(
  row: RecRow,
  news: { title: string; sentiment_score: string | null }[],
  flowLine: string,
): string {
  const actionKr =
    ({ BUY: '매수', WATCH: '관심', AVOID: '회피', SELL: '청산' } as Record<string, string>)[row.action ?? ''] ?? '관심';
  const sd = (row.score_detail_json ?? {}) as Record<string, unknown>;
  const reasons = Array.isArray(row.reasons_json) ? (row.reasons_json as string[]) : [];
  const reasonsTxt = reasons.slice(0, 4).join('; ');

  const newsTxt = news
    .map((n) => {
      let tone = '';
      if (n.sentiment_score != null) {
        const v = Number(n.sentiment_score);
        tone = v > 0.1 ? ' (긍정)' : v < -0.1 ? ' (부정)' : ' (중립)';
      }
      return `- ${n.title}${tone}`;
    })
    .join('\n');

  const pick = (...keys: string[]) => {
    for (const k of keys) if (sd[k] != null) return String(sd[k]);
    return '-';
  };

  return `당신은 한국의 주식 데이터 분석 어시스턴트입니다. 아래 정량 데이터만 근거로,
${row.name}(${row.sector || '섹터 미상'})에 대한 한국어 브리핑을 작성하세요.

[시스템 시그널]
- 판정: ${actionKr} (종합점수 ${row.score}, 신뢰도 ${row.confidence}%)
- 점수 구성: 모멘텀 ${pick('momentum_score', 'technical_score')}, 가치 ${pick('value_score', 'fundamental_score')}, 감성 ${pick('sentiment_score', 'news_score')}
- 근거: ${reasonsTxt || '특이 근거 없음'}

[최근 뉴스]
${newsTxt || '수집된 뉴스 없음'}

${flowLine}

작성 지침:
- 3~4문장, 존댓말, 과장 없이 담백하게. 마크다운 기호(**, #, - 등) 없이 순수 텍스트로.
- 시그널 판정의 이유를 위 데이터로 설명하고, 뉴스·수급이 이를 뒷받침하거나 반대하는지 언급.
- 데이터에 없는 내용(목표가, 실적 전망 등)은 지어내지 마세요.
- 마지막에 한 문장으로 "본 요약은 데이터 기반 참고 자료이며 투자 권유가 아닙니다." 를 덧붙이세요.`;
}
