// 이식 라우트 공통 래퍼 — 서비스 예외(HttpException)를 HTTP 응답으로 변환한다.
import { NextRequest, NextResponse } from 'next/server';
import { HttpException } from './http-errors';

export function wrapHandler(fn: (req: NextRequest, ctx?: any) => Promise<unknown>) {
  return async (req: NextRequest, ctx?: any) => {
    try {
      return NextResponse.json(await fn(req, ctx));
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
