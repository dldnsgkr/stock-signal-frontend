import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// userId 는 클라이언트가 아닌 NextAuth 세션에서 주입한다.
async function sessionUserId(): Promise<number | null> {
  try {
    const session = await auth();
    const id = session?.user?.id;
    return id ? Number(id) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const res = await fetch(`${API_URL}/watchlist?userId=${userId}`, { cache: 'no-store' });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { symbol } = await req.json();
    const res = await fetch(`${API_URL}/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, symbol }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { symbol } = await req.json();
    const res = await fetch(`${API_URL}/watchlist`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, symbol }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}
