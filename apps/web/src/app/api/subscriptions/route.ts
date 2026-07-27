import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// 로그인 유저 전용 알림 구독. 이메일·userId 를 세션에서 주입(클라 신뢰 안 함).
async function session() {
  try {
    const s = await auth();
    if (s?.user?.email) return { email: s.user.email, userId: s.user.id ? Number(s.user.id) : undefined };
  } catch { /* noop */ }
  return null;
}

export async function GET() {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const res = await fetch(`${API_URL}/subscriptions?email=${encodeURIComponent(s.email)}`, { cache: 'no-store' });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(req: NextRequest) {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { symbol } = await req.json();
  const res = await fetch(`${API_URL}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: s.email, symbol, userId: s.userId }),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function DELETE(req: NextRequest) {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { symbol } = await req.json();
  const res = await fetch(`${API_URL}/subscriptions`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: s.email, symbol }),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
