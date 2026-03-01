import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'active';
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = db
    .from('trips')
    .select('*, buses!trips_bus_id_fkey(number, model), profiles!trips_driver_id_fkey(name), routes!trips_route_id_fkey(name, color)')
    .order('start_time', { ascending: false })
    .limit(limit);

  if (user.role === 'driver') {
    query = query.eq('driver_id', user.id);
  } else if (user.role === 'student') {
    query = query.eq('route_id', user.route_id!).eq('status', 'active');
  } else if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: trips, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const formatted = (trips || []).map((t: any) => ({
    ...t,
    bus_number: t.buses?.number,
    bus_model: t.buses?.model,
    driver_name: t.profiles?.name,
    route_name: t.routes?.name,
    route_color: t.routes?.color,
  }));

  return NextResponse.json({ trips: formatted });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'driver') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createServiceClient();

  // Check for existing active trip
  const { data: existing } = await db
    .from('trips')
    .select('id')
    .eq('driver_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'You already have an active trip', trip_id: existing.id }, { status: 409 });
  }

  const { data: bus } = await db
    .from('buses')
    .select('*')
    .eq('driver_id', user.id)
    .maybeSingle();

  if (!bus) return NextResponse.json({ error: 'No bus assigned to you' }, { status: 400 });

  const { data: trip, error } = await db
    .from('trips')
    .insert({ bus_id: bus.id, driver_id: user.id, route_id: bus.route_id, status: 'active', tracking_status: 'connected' })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from('alerts').insert({
    type: 'info',
    title: 'Trip Started',
    message: `Bus ${bus.number} has started a new trip.`,
    bus_id: bus.id,
    trip_id: trip.id,
    severity: 'info',
  });

  return NextResponse.json({ trip_id: trip.id }, { status: 201 });
}
