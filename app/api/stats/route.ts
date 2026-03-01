import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

export async function GET() {
  const user = await getSession();
  if (!user || !['admin', 'transport_head'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createServiceClient();

  const today = new Date().toISOString().split('T')[0];

  const [
    { count: totalBuses },
    { count: activeBuses },
    { count: totalStudents },
    { count: totalDrivers },
    { count: totalRoutes },
    { count: todayAttendance },
    { count: unreadAlerts },
    { count: criticalAlerts },
    { data: recentTrips },
  ] = await Promise.all([
    db.from('buses').select('*', { count: 'exact', head: true }),
    db.from('trips').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'driver'),
    db.from('routes').select('*', { count: 'exact', head: true }),
    db.from('attendance').select('*', { count: 'exact', head: true }).gte('boarding_time', today),
    db.from('alerts').select('*', { count: 'exact', head: true }).eq('is_read', false),
    db.from('alerts').select('*', { count: 'exact', head: true }).eq('severity', 'critical').eq('is_read', false),
    db.from('trips').select('*, buses!trips_bus_id_fkey(number), profiles!trips_driver_id_fkey(name), routes!trips_route_id_fkey(name)').order('start_time', { ascending: false }).limit(5),
  ]);

  const formattedTrips = (recentTrips || []).map((t: any) => ({
    ...t,
    bus_number: t.buses?.number,
    driver_name: t.profiles?.name,
    route_name: t.routes?.name,
  }));

  return NextResponse.json({
    totalBuses: totalBuses ?? 0,
    activeBuses: activeBuses ?? 0,
    totalStudents: totalStudents ?? 0,
    totalDrivers: totalDrivers ?? 0,
    totalRoutes: totalRoutes ?? 0,
    todayAttendance: todayAttendance ?? 0,
    unreadAlerts: unreadAlerts ?? 0,
    criticalAlerts: criticalAlerts ?? 0,
    recentTrips: formattedTrips,
  });
}
