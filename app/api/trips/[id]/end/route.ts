import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== 'driver') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createServiceClient();

  const { data: trip } = await db
    .from('trips')
    .select('*, buses!trips_bus_id_fkey(number)')
    .eq('id', id)
    .eq('driver_id', user.id)
    .maybeSingle();

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  await db
    .from('trips')
    .update({ status: 'completed', end_time: new Date().toISOString(), tracking_status: 'disconnected' })
    .eq('id', id);

  await db.from('alerts').insert({
    type: 'info',
    title: 'Trip Completed',
    message: `Bus ${trip.buses?.number || ''} has completed its trip.`,
    bus_id: trip.bus_id,
    trip_id: Number(id),
    severity: 'info',
  });

  return NextResponse.json({ success: true });
}
