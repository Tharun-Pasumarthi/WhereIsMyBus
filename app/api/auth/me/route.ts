import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  const user = await getSession();
  // Always return 200 — callers check `data.user` for null
  return NextResponse.json({ user: user ?? null });
}
