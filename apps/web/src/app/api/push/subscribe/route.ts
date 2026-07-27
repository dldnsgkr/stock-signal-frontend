import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// 푸시 구독 등록. 로그인 상태면 세션 userId 를 주입 → 관심종목 타겟 알림 가능.
// 비로그인도 허용(시장 전체 알림만 수신).
export async function POST(req: NextRequest) {
  let userId: number | undefined;
  try {
    const session = await auth();
    if (session?.user?.id) userId = Number(session.user.id);
  } catch {
    /* 비로그인 */
  }
  try {
    const body = await req.json();
    const res = await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, ...(userId ? { userId } : {}) }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}
