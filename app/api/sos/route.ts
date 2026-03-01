import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

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
  const sosMsg = message ||
    `${user.name} has triggered an SOS alert.${ lat && lng ? ` Location: ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : '' }`;

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
  return NextResponse.json({ id: data.id }, { status: 201 });
}
