import { NextRequest, NextResponse } from 'next/server';
import { useNeon, EC2_API_URL } from '@/server/mode';
import { recommendationsService } from '@/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get('market') ?? 'US';
  const limit = Number(searchParams.get('limit') ?? '20');

  if (!useNeon()) {
    const params = new URLSearchParams({ market, limit: String(limit) });
    try {
      const res = await fetch(`${EC2_API_URL}/recommendations/sell-signals?${params}`, { cache: 'no-store' });
      return NextResponse.json(await res.json(), { status: res.status });
    } catch {
      return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
    }
  }

  try {
    return NextResponse.json(await recommendationsService.getSellSignals(market, limit));
  } catch (e) {
    console.error('[sell-signals]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
