import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient();

  // Use separate queries to avoid FK name mismatches
  const [
    { data: buses, error },
    { data: profiles },
    { data: routes },
    { data: activeTrips },
  ] = await Promise.all([
    db.from('buses').select('*').order('number'),
    db.from('profiles').select('id, name, phone'),
    db.from('routes').select('id, name, color'),
    db.from('trips').select('*').eq('status', 'active'),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
  const routeMap = Object.fromEntries((routes || []).map((r: any) => [r.id, r]));

  const busesWithTrips = (buses || []).map((b: any) => {
    const trip = (activeTrips || []).find((t: any) => t.bus_id === b.id);
    const driver = profileMap[b.driver_id] ?? null;
    const route = routeMap[b.route_id] ?? null;
    return {
      ...b,
      driver_name: driver?.name ?? null,
      driver_phone: driver?.phone ?? null,
      route_name: route?.name ?? null,
      route_color: route?.color ?? null,
      active_trip_id: trip?.id ?? null,
      trip_status: trip?.status ?? null,
      tracking_status: trip?.tracking_status ?? null,
      current_lat: trip?.current_lat ?? null,
      current_lng: trip?.current_lng ?? null,
      current_speed: trip?.current_speed ?? null,
      battery_level: trip?.battery_level ?? null,
      last_seen: trip?.last_seen ?? null,
      trip_start_time: trip?.start_time ?? null,
    };
  });

  return NextResponse.json({ buses: busesWithTrips });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { number, driver_id, route_id, capacity, model } = await req.json();
  const db = createServiceClient();

  const { data, error } = await db
    .from('buses')
    .insert({ number, driver_id: driver_id || null, route_id: route_id || null, capacity: capacity || 45, model: model || 'Standard Bus' })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
