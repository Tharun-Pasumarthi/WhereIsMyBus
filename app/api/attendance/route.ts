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
      .select('*, profiles!attendance_student_id_fkey(name, email), stops!attendance_stop_id_fkey(name)')
      .eq('trip_id', trip_id)
      .order('boarding_time', { ascending: false });

    const formatted = (records || []).map((r: any) => ({
      ...r,
      student_name: r.profiles?.name,
      student_email: r.profiles?.email,
      stop_name: r.stops?.name,
    }));
    return NextResponse.json({ attendance: formatted });
  }

  if (user.role === 'student') {
    const { data: records } = await db
      .from('attendance')
      .select('*, trips!attendance_trip_id_fkey(start_time, buses!trips_bus_id_fkey(number), routes!trips_route_id_fkey(name)), stops!attendance_stop_id_fkey(name)')
      .eq('student_id', user.id)
      .order('boarding_time', { ascending: false })
      .limit(20);

    const formatted = (records || []).map((r: any) => ({
      ...r,
      start_time: r.trips?.start_time,
      bus_number: r.trips?.buses?.number,
      route_name: r.trips?.routes?.name,
      stop_name: r.stops?.name,
    }));
    return NextResponse.json({ attendance: formatted });
  }

  // Admin — all recent
  const { data: records } = await db
    .from('attendance')
    .select('*, profiles!attendance_student_id_fkey(name), trips!attendance_trip_id_fkey(start_time, routes!trips_route_id_fkey(name), buses!trips_bus_id_fkey(number)), stops!attendance_stop_id_fkey(name)')
    .order('boarding_time', { ascending: false })
    .limit(100);

  const formatted = (records || []).map((r: any) => ({
    ...r,
    student_name: r.profiles?.name,
    start_time: r.trips?.start_time,
    bus_number: r.trips?.buses?.number,
    route_name: r.trips?.routes?.name,
    stop_name: r.stops?.name,
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
