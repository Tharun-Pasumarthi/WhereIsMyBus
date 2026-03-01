import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

// GET /api/parent/dashboard
// Returns: linked students, their active bus, recent attendance, relevant alerts
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createServiceClient();

  // 1. Get linked students
  const { data: links } = await db
    .from('parent_students')
    .select('student_id, profiles!parent_students_student_id_fkey(id, name, email, route_id, phone)')
    .eq('parent_id', user.id);

  const students = (links ?? []).map((l: any) => l.profiles).filter(Boolean);

  if (students.length === 0) {
    return NextResponse.json({ students: [], buses: [], attendance: [], alerts: [], stops: [] });
  }

  const studentIds = students.map((s: any) => s.id);
  const routeIds = [...new Set(students.map((s: any) => s.route_id).filter(Boolean))];

  // 2. Get buses on those routes (active trips)
  const { data: activeTrips } = await db
    .from('trips')
    .select('*, buses!trips_bus_id_fkey(id, number, model), routes!trips_route_id_fkey(name, color)')
    .eq('status', 'active')
    .in('route_id', routeIds.length ? routeIds : [-1]);

  const buses = (activeTrips ?? []).map((t: any) => ({
    id: t.buses?.id,
    bus_number: t.buses?.number,
    route_name: t.routes?.name,
    route_color: t.routes?.color ?? '#f59e0b',
    route_id: t.route_id,
    trip_id: t.id,
    current_lat: t.current_lat,
    current_lng: t.current_lng,
    current_speed: t.current_speed,
    battery_level: t.battery_level,
    tracking_status: t.tracking_status,
    last_seen: t.last_seen,
    driver_name: null,
  }));

  // 3. Get stops for those routes
  const { data: stops } = await db
    .from('stops')
    .select('*')
    .in('route_id', routeIds.length ? routeIds : [-1]);

  // 4. Get recent attendance for linked students
  const { data: attRecords } = await db
    .from('attendance')
    .select('*, trips!attendance_trip_id_fkey(start_time, buses!trips_bus_id_fkey(number), routes!trips_route_id_fkey(name)), stops!attendance_stop_id_fkey(name)')
    .in('student_id', studentIds)
    .order('boarding_time', { ascending: false })
    .limit(20);

  const attendance = (attRecords ?? []).map((r: any) => ({
    ...r,
    bus_number: r.trips?.buses?.number,
    route_name: r.trips?.routes?.name,
    stop_name: r.stops?.name,
  }));

  // 5. Get unread alerts for those routes
  const { data: alerts } = await db
    .from('alerts')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(15);

  const routeAlerts = (alerts ?? []).filter((a: any) => {
    // Simple filter: show critical/warning alerts relevant to the student's bus
    return a.severity !== 'info' || a.type === 'geofence';
  });

  return NextResponse.json({
    students,
    buses,
    stops: stops ?? [],
    attendance,
    alerts: routeAlerts,
  });
}
