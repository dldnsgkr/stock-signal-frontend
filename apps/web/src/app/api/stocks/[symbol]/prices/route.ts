import { NextRequest, NextResponse } from 'next/server';
import { useNeon, EC2_API_URL } from '@/server/mode';
import { stocksService } from '@/server';
import { HttpException } from '@/server/http-errors';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const days = new URL(req.url).searchParams.get('days') ?? '90';

  if (!useNeon()) {
    try {
      const res = await fetch(`${EC2_API_URL}/stocks/${symbol}/prices?days=${days}`, {
        cache: 'no-store',
      });
      return NextResponse.json(await res.json());
    } catch {
      return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
    }
  }

  try {
    return NextResponse.json(await stocksService.getPrices(symbol, Number(days)));
  } catch (e) {
    if (e instanceof HttpException) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[stocks/prices]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
