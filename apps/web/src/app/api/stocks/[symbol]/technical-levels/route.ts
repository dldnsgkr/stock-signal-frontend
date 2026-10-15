// 지지·저항선 + 가격 전망 — analysis-service /analysis/technical-levels 를 대체하는 이식 라우트.
import { wrapHandler, q } from '@/server/handler';
import { technicalLevelsService } from '@/server';

export const dynamic = 'force-dynamic';

export const GET = wrapHandler(async (req, ctx) => {
  const { symbol } = await ctx.params;
  return technicalLevelsService.getLevels(symbol, q(req, 'market', 'US')!, Number(q(req, 'days', '90')));
});
