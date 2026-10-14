// 이식 라우트 공통 래퍼 — 서비스 예외(HttpException)를 HTTP 응답으로 변환한다.
import { NextRequest, NextResponse } from 'next/server';
import { HttpException } from './http-errors';

// 공개 조회 데이터는 하루 몇 번(파이프라인·평가 직후)만 바뀌므로 Vercel CDN 에 캐시한다.
// 시뮬레이션은 쿼리 자체는 0.9초지만 9만 행을 함수로 옮겨 객체화하는 데 15초가 걸렸다
// (2026-10-15 실측) — 첫 요청만 계산하고 이후 30분은 엣지가 즉시 응답한다.
// ⚠️ wrapHandler 는 사용자별 데이터(관심종목·설정·구독)에는 쓰지 말 것 — 그 라우트들은
//    세션별 응답이라 공유 캐시에 실리면 다른 사람에게 노출된다. 현재도 쓰지 않는다.
const PUBLIC_CACHE = 'public, s-maxage=1800, stale-while-revalidate=86400';

export function wrapHandler(fn: (req: NextRequest, ctx?: any) => Promise<unknown>) {
  return async (req: NextRequest, ctx?: any) => {
    try {
      return NextResponse.json(await fn(req, ctx), { headers: { 'Cache-Control': PUBLIC_CACHE } });
    } catch (e: unknown) {
      if (e instanceof HttpException) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error('[api]', e);
      return NextResponse.json({ error: 'internal error' }, { status: 500 });
    }
  };
}

export function q(req: NextRequest, key: string, def?: string): string | undefined {
  return new URL(req.url).searchParams.get(key) ?? def;
}
