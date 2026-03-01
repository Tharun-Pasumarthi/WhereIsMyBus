import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient();
  const { searchParams } = new URL(req.url);
  const trip_id = searchParams.get('trip_id');

  if (trip_id) {
    const { data: records } = await db
      .from('attendance')
      .select('*')
      .eq('trip_id', trip_id)
      .order('boarding_time', { ascending: false });

    const studentIds = [...new Set((records || []).map((r: any) => r.student_id).filter(Boolean))];
    const stopIds = [...new Set((records || []).map((r: any) => r.stop_id).filter(Boolean))];

    const [{ data: profiles }, { data: stops }] = await Promise.all([
      studentIds.length ? db.from('profiles').select('id, name, email').in('id', studentIds) : Promise.resolve({ data: [] }),
      stopIds.length ? db.from('stops').select('id, name').in('id', stopIds) : Promise.resolve({ data: [] }),
    ]);

    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
    const stopMap = Object.fromEntries((stops || []).map((s: any) => [s.id, s]));

    const formatted = (records || []).map((r: any) => ({
      ...r,
      student_name: profileMap[r.student_id]?.name,
      student_email: profileMap[r.student_id]?.email,
      stop_name: stopMap[r.stop_id]?.name,
    }));
    return NextResponse.json({ attendance: formatted });
  }

  if (user.role === 'student') {
    const { data: records } = await db
      .from('attendance')
      .select('*')
      .eq('student_id', user.id)
      .order('boarding_time', { ascending: false })
      .limit(20);

    const tripIds = [...new Set((records || []).map((r: any) => r.trip_id).filter(Boolean))];
    const stopIds = [...new Set((records || []).map((r: any) => r.stop_id).filter(Boolean))];

    const [{ data: trips }, { data: stops }] = await Promise.all([
      tripIds.length ? db.from('trips').select('id, start_time, bus_id, route_id').in('id', tripIds) : Promise.resolve({ data: [] }),
      stopIds.length ? db.from('stops').select('id, name').in('id', stopIds) : Promise.resolve({ data: [] }),
    ]);

    const busIds = [...new Set((trips || []).map((t: any) => t.bus_id).filter(Boolean))];
    const routeIds = [...new Set((trips || []).map((t: any) => t.route_id).filter(Boolean))];

    const [{ data: buses }, { data: routes }] = await Promise.all([
      busIds.length ? db.from('buses').select('id, number').in('id', busIds) : Promise.resolve({ data: [] }),
      routeIds.length ? db.from('routes').select('id, name').in('id', routeIds) : Promise.resolve({ data: [] }),
    ]);

    const tripMap = Object.fromEntries((trips || []).map((t: any) => [t.id, t]));
    const busMap = Object.fromEntries((buses || []).map((b: any) => [b.id, b]));
    const routeMap = Object.fromEntries((routes || []).map((r: any) => [r.id, r]));
    const stopMap = Object.fromEntries((stops || []).map((s: any) => [s.id, s]));

    const formatted = (records || []).map((r: any) => {
      const trip = tripMap[r.trip_id];
      return {
        ...r,
        start_time: trip?.start_time,
        bus_number: busMap[trip?.bus_id]?.number,
        route_name: routeMap[trip?.route_id]?.name,
        stop_name: stopMap[r.stop_id]?.name,
      };
    });
    return NextResponse.json({ attendance: formatted });
  }

  // Admin — all recent
  const { data: records } = await db
    .from('attendance')
    .select('*')
    .order('boarding_time', { ascending: false })
    .limit(100);

  const studentIds = [...new Set((records || []).map((r: any) => r.student_id).filter(Boolean))];
  const tripIds = [...new Set((records || []).map((r: any) => r.trip_id).filter(Boolean))];
  const stopIds = [...new Set((records || []).map((r: any) => r.stop_id).filter(Boolean))];

  const [{ data: profiles }, { data: trips }, { data: stops }] = await Promise.all([
    studentIds.length ? db.from('profiles').select('id, name').in('id', studentIds) : Promise.resolve({ data: [] }),
    tripIds.length ? db.from('trips').select('id, start_time, bus_id, route_id').in('id', tripIds) : Promise.resolve({ data: [] }),
    stopIds.length ? db.from('stops').select('id, name').in('id', stopIds) : Promise.resolve({ data: [] }),
  ]);

  const busIds = [...new Set((trips || []).map((t: any) => t.bus_id).filter(Boolean))];
  const routeIds = [...new Set((trips || []).map((t: any) => t.route_id).filter(Boolean))];

  const [{ data: buses }, { data: routes }] = await Promise.all([
    busIds.length ? db.from('buses').select('id, number').in('id', busIds) : Promise.resolve({ data: [] }),
    routeIds.length ? db.from('routes').select('id, name').in('id', routeIds) : Promise.resolve({ data: [] }),
  ]);

  const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
  const tripMap = Object.fromEntries((trips || []).map((t: any) => [t.id, t]));
  const busMap = Object.fromEntries((buses || []).map((b: any) => [b.id, b]));
  const routeMap = Object.fromEntries((routes || []).map((r: any) => [r.id, r]));
  const stopMap = Object.fromEntries((stops || []).map((s: any) => [s.id, s]));

  const formatted = (records || []).map((r: any) => {
    const trip = tripMap[r.trip_id];
    return {
      ...r,
      student_name: profileMap[r.student_id]?.name,
      start_time: trip?.start_time,
      bus_number: busMap[trip?.bus_id]?.number,
      route_name: routeMap[trip?.route_id]?.name,
      stop_name: stopMap[r.stop_id]?.name,
  }));
  return NextResponse.json({ attendance: formatted });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { trip_id, stop_id } = await req.json();
  const db = createServiceClient();

  const { data: trip } = await db
    .from('trips')
    .select('id')
    .eq('id', trip_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!trip) return NextResponse.json({ error: 'No active trip found' }, { status: 400 });

  const { data: existing } = await db
    .from('attendance')
    .select('id')
    .eq('student_id', user.id)
    .eq('trip_id', trip_id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: 'Already checked in' }, { status: 409 });

  const { data, error } = await db
    .from('attendance')
    .insert({ student_id: user.id, trip_id, stop_id: stop_id || null })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
