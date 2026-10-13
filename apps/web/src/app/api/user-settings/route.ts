import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { useNeon, EC2_API_URL } from '@/server/mode';
import { userSettingsService } from '@/server';
import { HttpException } from '@/server/http-errors';

export const dynamic = 'force-dynamic';

async function userId(): Promise<number | null> {
  try {
    const s = await auth();
    return s?.user?.id ? Number(s.user.id) : null;
  } catch {
    return null;
  }
}

function toResponse(e: unknown) {
  if (e instanceof HttpException) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('[user-settings]', e);
  return NextResponse.json({ error: 'internal error' }, { status: 500 });
}

export async function GET() {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!useNeon()) {
    const res = await fetch(`${EC2_API_URL}/user-settings?userId=${uid}`, { cache: 'no-store' });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  try {
    return NextResponse.json(await userSettingsService.get(uid));
  } catch (e) { return toResponse(e); }
}

export async function PUT(req: NextRequest) {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const patch = await req.json();
  if (!useNeon()) {
    const res = await fetch(`${EC2_API_URL}/user-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...patch, userId: uid }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  try {
    return NextResponse.json(await userSettingsService.update(uid, patch));
  } catch (e) { return toResponse(e); }
}
