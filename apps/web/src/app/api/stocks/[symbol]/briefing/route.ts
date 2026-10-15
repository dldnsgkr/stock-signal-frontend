// AI 브리핑 — analysis-service /analysis/briefing 을 대체하는 이식 라우트.
// 브리핑은 최신 추천(하루 1~2회 갱신)에만 의존하므로 6시간 CDN 캐시 —
// 같은 종목을 여러 번 열어도 LLM 무료 할당량을 쓰지 않는다.
import { wrapHandler } from '@/server/handler';
import { briefingService } from '@/server';

export const dynamic = 'force-dynamic';

export const GET = wrapHandler(async (_req, ctx) => {
  const { symbol } = await ctx.params;
  return briefingService.getBriefing(symbol);
}, { maxAge: 6 * 3600 });
