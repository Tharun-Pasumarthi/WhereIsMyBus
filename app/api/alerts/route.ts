import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';
import { sendPush } from '@/lib/push';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient();
  const { data: alerts } = await db
    .from('alerts')
    .select('*, buses!alerts_bus_id_fkey(number)')
    .order('created_at', { ascending: false })
    .limit(100);

  const formatted = (alerts || []).map((a: any) => ({
    ...a,
    bus_number: a.buses?.number ?? null,
  }));

  return NextResponse.json({ alerts: formatted });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, title, message, bus_id, trip_id, severity } = await req.json();
  const db = createServiceClient();

  const { data, error } = await db
    .from('alerts')
    .insert({ type: type || 'info', title, message, bus_id: bus_id || null, trip_id: trip_id || null, triggered_by: user.id, severity: severity || 'info' })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Push notification to admins for critical/warning alerts
  if (severity === 'critical' || severity === 'warning') {
    sendPush({
      roles: ['admin', 'transport_head'],
      payload: {
        title: `${severity === 'critical' ? '🚨' : '⚠️'} ${title}`,
        body: message ?? '',
        tag: `alert-${data.id}`,
        url: '/admin',
      },
    });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  const db = createServiceClient();
  await db.from('alerts').update({ is_read: true }).eq('id', id);
  return NextResponse.json({ success: true });
}
