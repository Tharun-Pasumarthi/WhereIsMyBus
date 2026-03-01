import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

/** Haversine distance between two lat/lng points in metres */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'driver') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { trip_id, lat, lng, speed, battery_level } = await req.json();
  if (!trip_id || !lat || !lng) {
    return NextResponse.json({ error: 'trip_id, lat, lng required' }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: trip } = await db
    .from('trips')
    .select('*, buses!trips_bus_id_fkey(number)')
    .eq('id', trip_id)
    .eq('driver_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!trip) return NextResponse.json({ error: 'Active trip not found' }, { status: 404 });

  const batt = battery_level ?? 100;

  // Insert location history
  await db.from('locations').insert({ trip_id, lat, lng, speed: speed || 0, battery_level: batt });

  // Update trip current position & heartbeat
  await db
    .from('trips')
    .update({
      current_lat: lat,
      current_lng: lng,
      current_speed: speed || 0,
      battery_level: batt,
      last_seen: new Date().toISOString(),
      tracking_status: 'connected',
    })
    .eq('id', trip_id);

  // ── Battery alerts (tiered) ────────────────────────────────────────────────
  if (battery_level !== undefined) {
    // 20% early warning
    if (batt <= 20 && batt > 15) {
      const { data: exist } = await db
        .from('alerts')
        .select('id')
        .eq('trip_id', trip_id)
        .eq('type', 'low_battery')
        .ilike('title', '%20%%')
        .maybeSingle();
      if (!exist) {
        await db.from('alerts').insert({
          type: 'low_battery',
          title: 'Battery Low (20%) — Early Warning',
          message: `Bus ${trip.buses?.number} driver device is at ${batt}%. Consider plugging in soon.`,
          bus_id: trip.bus_id,
          trip_id,
          severity: 'info',
        });
      }
    }
    // 15% critical warning
    if (batt <= 15) {
      const { data: exist } = await db
        .from('alerts')
        .select('id')
        .eq('trip_id', trip_id)
        .eq('type', 'low_battery')
        .ilike('title', '%15%%')
        .maybeSingle();
      if (!exist) {
        await db.from('alerts').insert({
          type: 'low_battery',
          title: 'Critical Battery (15%) — Charge Immediately',
          message: `Bus ${trip.buses?.number} driver device is critically low at ${batt}%. GPS tracking may be lost soon.`,
          bus_id: trip.bus_id,
          trip_id,
          severity: 'warning',
        });
      }
    }
  }

  // ── Geo-fencing: check proximity to route stops ────────────────────────────
  if (trip.route_id) {
    const { data: routeStops } = await db
      .from('stops')
      .select('id, name, lat, lng, radius')
      .eq('route_id', trip.route_id);

    for (const stop of routeStops ?? []) {
      const dist = haversine(lat, lng, stop.lat, stop.lng);
      const radius = stop.radius ?? 100;

      if (dist <= radius) {
        // Only fire once per (trip, stop) pair
        const { data: existFence } = await db
          .from('alerts')
          .select('id')
          .eq('trip_id', trip_id)
          .eq('type', 'geofence')
          .ilike('title', `%${stop.name}%`)
          .maybeSingle();

        if (!existFence) {
          await db.from('alerts').insert({
            type: 'geofence',
            title: `Bus Arrived at ${stop.name}`,
            message: `Bus ${trip.buses?.number} has entered the stop zone for "${stop.name}" (${Math.round(dist)}m away).`,
            bus_id: trip.bus_id,
            trip_id,
            severity: 'info',
          });
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const trip_id = searchParams.get('trip_id');
  if (!trip_id) return NextResponse.json({ error: 'trip_id required' }, { status: 400 });

  const db = createServiceClient();
  const { data: locations } = await db
    .from('locations')
    .select('*')
    .eq('trip_id', trip_id)
    .order('timestamp', { ascending: false })
    .limit(50);

  return NextResponse.json({ locations: locations || [] });
}
