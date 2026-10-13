import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { useNeon, EC2_API_URL } from '@/server/mode';
import { notificationsService } from '@/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  let uid: number | null = null;
  try {
    const s = await auth();
    uid = s?.user?.id ? Number(s.user.id) : null;
  } catch {
    /* noop */
  }
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!useNeon()) {
    const res = await fetch(`${EC2_API_URL}/notifications?userId=${uid}&limit=50`, { cache: 'no-store' });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  try {
    return NextResponse.json(await notificationsService.listForUser(uid, 50));
  } catch (e) {
    console.error('[notifications]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
