import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';
import { sendMail, sosAlertEmail } from '@/lib/mailer';
import { sendPush } from '@/lib/push';

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { trip_id, message, lat, lng } = await req.json();
  const db = createServiceClient();

  const { data: trip } = await db
    .from('trips')
    .select('*, buses!trips_bus_id_fkey(number)')
    .eq('id', trip_id)
    .maybeSingle();

  const sosType = user.role === 'driver' ? 'sos_driver' : 'sos_student';
  const sosTitle = user.role === 'driver'
    ? `Driver SOS - Bus ${trip?.buses?.number || ''}`
    : `Student SOS - Bus ${trip?.buses?.number || ''}`;
  const locationStr = lat && lng
    ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`
    : 'Unknown';
  const sosMsg = message ||
    `${user.name} has triggered an SOS alert. Location: ${locationStr}`;

  const { data, error } = await db
    .from('alerts')
    .insert({
      type: sosType,
      title: sosTitle,
      message: sosMsg,
      bus_id: trip?.bus_id ?? null,
      trip_id: trip_id || null,
      triggered_by: user.id,
      severity: 'critical',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget: email + push to all admins and transport_heads
  db.from('profiles')
    .select('email')
    .in('role', ['admin', 'transport_head'])
    .then(({ data: admins }) => {
      if (!admins?.length) return;
      const emails = admins.map((a: { email: string }) => a.email);
      sendMail({
        to: emails,
        subject: `🚨 SOS Alert — Bus ${trip?.buses?.number ?? ''}`,
        html: sosAlertEmail(user.name, trip?.buses?.number ?? 'Unknown', locationStr),
      }).catch(err => console.error('[SOS mail]', err));
    });

  sendPush({
    roles: ['admin', 'transport_head'],
    payload: {
      title: `🚨 SOS — ${sosTitle}`,
      body: sosMsg,
      tag: 'sos-alert',
      url: '/admin',
    },
  });

  return NextResponse.json({ id: data.id }, { status: 201 });
}
