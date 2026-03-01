import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createServiceClient();
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date'); // optional YYYY-MM-DD filter

  let query = db
    .from('attendance')
    .select(
      '*, profiles!attendance_student_id_fkey(name, email), ' +
      'trips!attendance_trip_id_fkey(start_time, buses!trips_bus_id_fkey(number), routes!trips_route_id_fkey(name)), ' +
      'stops!attendance_stop_id_fkey(name)'
    )
    .order('boarding_time', { ascending: false })
    .limit(5000);

  if (dateParam) {
    // Filter by a specific date
    const start = new Date(dateParam + 'T00:00:00.000Z').toISOString();
    const end = new Date(dateParam + 'T23:59:59.999Z').toISOString();
    query = query.gte('boarding_time', start).lte('boarding_time', end);
  }

  const { data: records, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build CSV
  const headers = ['Student Name', 'Email', 'Bus Number', 'Route', 'Stop', 'Boarding Time'];
  const rows = (records || []).map((r: any) => [
    csvCell(r.profiles?.name ?? ''),
    csvCell(r.profiles?.email ?? ''),
    csvCell(r.trips?.buses?.number ?? ''),
    csvCell(r.trips?.routes?.name ?? ''),
    csvCell(r.stops?.name ?? ''),
    csvCell(r.boarding_time ? new Date(r.boarding_time).toLocaleString() : ''),
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = dateParam ? `attendance-${dateParam}.csv` : 'attendance-all.csv';

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function csvCell(val: string): string {
  // Wrap in quotes if contains comma, quote or newline
  if (/[",\r\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}
