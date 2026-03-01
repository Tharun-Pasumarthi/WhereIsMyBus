import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || !['admin', 'transport_head'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createServiceClient();
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date'); // YYYY-MM-DD
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  // Build query — use left joins so null FKs don't drop rows
  let query = db
    .from('attendance')
    .select(
      'id, boarding_time, created_at, ' +
      'profiles!attendance_student_id_fkey(name, email), ' +
      'trips!attendance_trip_id_fkey(start_time, buses!trips_bus_id_fkey(number), routes!trips_route_id_fkey(name))'
    )
    .order('created_at', { ascending: false })
    .limit(10000);

  // Date filter — prefer boarding_time, fallback handled in row building
  if (dateParam) {
    const start = `${dateParam}T00:00:00.000Z`;
    const end   = `${dateParam}T23:59:59.999Z`;
    query = query.gte('created_at', start).lte('created_at', end);
  } else if (from || to) {
    if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`);
    if (to)   query = query.lte('created_at', `${to}T23:59:59.999Z`);
  }

  const { data: records, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build CSV — BOM so Excel opens correctly
  const BOM = '\uFEFF';
  const headers = ['ID', 'Student Name', 'Email', 'Bus Number', 'Route', 'Boarding Time'];
  const rows = (records ?? []).map((r: any) => {
    const ts = r.boarding_time ?? r.created_at ?? '';
    const formatted = ts ? new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
    return [
      cell(String(r.id ?? '')),
      cell(r.profiles?.name ?? ''),
      cell(r.profiles?.email ?? ''),
      cell(r.trips?.buses?.number ?? ''),
      cell(r.trips?.routes?.name ?? ''),
      cell(formatted),
    ];
  });

  const csv = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = dateParam
    ? `attendance-${dateParam}.csv`
    : from && to ? `attendance-${from}-to-${to}.csv`
    : `attendance-all-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function cell(val: string): string {
  if (/[",\r\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

