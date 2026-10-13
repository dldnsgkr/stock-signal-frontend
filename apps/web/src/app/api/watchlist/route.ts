import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { useNeon, EC2_API_URL } from '@/server/mode';
import { watchlistService } from '@/server';
import { HttpException } from '@/server/http-errors';

export const dynamic = 'force-dynamic';

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

function toResponse(e: unknown) {
  if (e instanceof HttpException) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('[watchlist]', e);
  return NextResponse.json({ error: 'internal error' }, { status: 500 });
}

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!useNeon()) {
    try {
      const res = await fetch(`${EC2_API_URL}/watchlist?userId=${userId}`, { cache: 'no-store' });
      return NextResponse.json(await res.json(), { status: res.status });
    } catch {
      return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
    }
  }
  try {
    return NextResponse.json(await watchlistService.list(userId));
  } catch (e) { return toResponse(e); }
}

export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { symbol } = await req.json();
  if (!useNeon()) {
    try {
      const res = await fetch(`${EC2_API_URL}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, symbol }),
      });
      return NextResponse.json(await res.json(), { status: res.status });
    } catch {
      return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
    }
  }
  try {
    return NextResponse.json(await watchlistService.add(userId, symbol));
  } catch (e) { return toResponse(e); }
}

export async function DELETE(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { symbol } = await req.json();
  if (!useNeon()) {
    try {
      const res = await fetch(`${EC2_API_URL}/watchlist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, symbol }),
      });
      return NextResponse.json(await res.json(), { status: res.status });
    } catch {
      return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
    }
  }
  try {
    return NextResponse.json(await watchlistService.remove(userId, symbol));
  } catch (e) { return toResponse(e); }
}
