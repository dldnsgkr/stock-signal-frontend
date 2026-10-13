import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { useNeon, EC2_API_URL } from '@/server/mode';
import { subscriptionService } from '@/server';
import { HttpException } from '@/server/http-errors';

export const dynamic = 'force-dynamic';

// 로그인 유저 전용 알림 구독. 이메일·userId 를 세션에서 주입(클라 신뢰 안 함).
async function session() {
  try {
    const s = await auth();
    if (s?.user?.email) return { email: s.user.email, userId: s.user.id ? Number(s.user.id) : undefined };
  } catch { /* noop */ }
  return null;
}

function toResponse(e: unknown) {
  if (e instanceof HttpException) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('[subscriptions]', e);
  return NextResponse.json({ error: 'internal error' }, { status: 500 });
}

export async function GET() {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!useNeon()) {
    const res = await fetch(`${EC2_API_URL}/subscriptions?email=${encodeURIComponent(s.email)}`, { cache: 'no-store' });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  try {
    return NextResponse.json(await subscriptionService.listByEmail(s.email));
  } catch (e) { return toResponse(e); }
}

export async function POST(req: NextRequest) {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { symbol } = await req.json();
  if (!useNeon()) {
    const res = await fetch(`${EC2_API_URL}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: s.email, symbol, userId: s.userId }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  try {
    return NextResponse.json(await subscriptionService.subscribe(s.email, symbol, s.userId));
  } catch (e) { return toResponse(e); }
}

export async function DELETE(req: NextRequest) {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { symbol } = await req.json();
  if (!useNeon()) {
    const res = await fetch(`${EC2_API_URL}/subscriptions`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: s.email, symbol }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  try {
    return NextResponse.json(await subscriptionService.unsubscribe(s.email, symbol));
  } catch (e) { return toResponse(e); }
}
