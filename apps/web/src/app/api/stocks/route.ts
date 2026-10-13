import { NextRequest, NextResponse } from 'next/server';
import { useNeon, EC2_API_URL } from '@/server/mode';
import { stocksService } from '@/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  if (!useNeon()) {
    const upstream = new URLSearchParams();
    for (const key of ['market', 'cursorId', 'pageSize', 'search']) {
      const v = searchParams.get(key);
      if (v) upstream.set(key, v);
    }
    try {
      const res = await fetch(`${EC2_API_URL}/stocks?${upstream}`, { cache: 'no-store' });
      return NextResponse.json(await res.json());
    } catch {
      return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
    }
  }

  try {
    const cursorId = searchParams.get('cursorId');
    return NextResponse.json(await stocksService.findAll(
      searchParams.get('market') ?? undefined,
      cursorId ? Number(cursorId) : undefined,
      Number(searchParams.get('pageSize') ?? '50'),
      searchParams.get('search') ?? undefined,
    ));
  } catch (e) {
    console.error('[stocks]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
