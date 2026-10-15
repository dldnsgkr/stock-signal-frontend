// 예전 KRX 실시간 호출(analysis-service)을 DB 조회로 대체한 라우트 — investor-flow.service.ts 참조.
import { wrapHandler, q } from '@/server/handler';
import { investorFlowService } from '@/server';

export const dynamic = 'force-dynamic';

export const GET = wrapHandler(async (req) =>
  investorFlowService.topStocks(
    q(req, 'market', 'KOSPI')!,
    q(req, 'date'),
    q(req, 'investor_type', 'institution')!,
    Number(q(req, 'limit', '20')),
  ),
);
