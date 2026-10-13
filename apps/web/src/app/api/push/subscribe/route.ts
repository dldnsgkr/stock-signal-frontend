import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { useNeon, EC2_API_URL } from '@/server/mode';
import { pushService } from '@/server';

export const dynamic = 'force-dynamic';

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
    if (!useNeon()) {
      const res = await fetch(`${EC2_API_URL}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ...(userId ? { userId } : {}) }),
      });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      return NextResponse.json({ error: 'endpoint, keys.p256dh, keys.auth required' }, { status: 400 });
    }
    return NextResponse.json(await pushService.subscribe(body.endpoint, body.keys.p256dh, body.keys.auth, userId));
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}
