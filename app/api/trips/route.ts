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
    .select('*')
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

  // Enrich with buses, drivers, routes using separate lookups
  const busIds = [...new Set((trips || []).map((t: any) => t.bus_id).filter(Boolean))];
  const driverIds = [...new Set((trips || []).map((t: any) => t.driver_id).filter(Boolean))];
  const routeIds = [...new Set((trips || []).map((t: any) => t.route_id).filter(Boolean))];

  const [{ data: buses }, { data: drivers }, { data: routes }] = await Promise.all([
    busIds.length ? db.from('buses').select('id, number, model').in('id', busIds) : Promise.resolve({ data: [] }),
    driverIds.length ? db.from('profiles').select('id, name').in('id', driverIds) : Promise.resolve({ data: [] }),
    routeIds.length ? db.from('routes').select('id, name, color').in('id', routeIds) : Promise.resolve({ data: [] }),
  ]);

  const busMap = Object.fromEntries((buses || []).map((b: any) => [b.id, b]));
  const driverMap = Object.fromEntries((drivers || []).map((d: any) => [d.id, d]));
  const routeMap = Object.fromEntries((routes || []).map((r: any) => [r.id, r]));

  const formatted = (trips || []).map((t: any) => ({
    ...t,
    bus_number: busMap[t.bus_id]?.number ?? null,
    bus_model: busMap[t.bus_id]?.model ?? null,
    driver_name: driverMap[t.driver_id]?.name ?? null,
    route_name: routeMap[t.route_id]?.name ?? null,
    route_color: routeMap[t.route_id]?.color ?? null,
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
