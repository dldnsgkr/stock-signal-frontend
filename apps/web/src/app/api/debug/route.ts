import { NextResponse } from 'next/server';

export async function GET() {
  const apiUrl = process.env.API_URL || '(not set)';
  let fetchResult = '';

  try {
    const res = await fetch(`${apiUrl}/health`, { cache: 'no-store' });
    fetchResult = `${res.status} ${await res.text()}`;
  } catch (e: any) {
    fetchResult = `error: ${e.message}`;
  }

  return NextResponse.json({ apiUrl, fetchResult });
}
