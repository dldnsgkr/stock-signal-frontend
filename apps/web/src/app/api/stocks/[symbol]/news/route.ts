// EC2 API 의 동일 경로를 대체하는 이식 라우트 (serverless-migration 5단계).
// DATA_SOURCE=neon 플립 후 api.ts/프록시가 이 경로를 자신의 오리진으로 호출한다.
import { wrapHandler, q } from '@/server/handler';
import { stocksService } from '@/server';

export const dynamic = 'force-dynamic';

export const GET = wrapHandler(async (req, ctx) => {
  const { symbol } = await ctx.params;
  return stocksService.getNews(symbol, Number(q(req, 'limit', '20')));
});
