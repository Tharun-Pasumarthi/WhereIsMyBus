import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient();

  const [{ data: routes }, { data: stops }] = await Promise.all([
    db.from('routes').select('*').order('name'),
    db.from('stops').select('*').order('route_id').order('stop_order'),
  ]);

  return NextResponse.json({ routes: routes || [], stops: stops || [] });
}
