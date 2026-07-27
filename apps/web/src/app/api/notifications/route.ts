import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function GET() {
  let uid: number | null = null;
  try {
    const s = await auth();
    uid = s?.user?.id ? Number(s.user.id) : null;
  } catch {
    /* noop */
  }
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const res = await fetch(`${API_URL}/notifications?userId=${uid}&limit=50`, { cache: 'no-store' });
  return NextResponse.json(await res.json(), { status: res.status });
}
