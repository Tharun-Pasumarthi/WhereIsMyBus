import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

const QR_SECRET = process.env.QR_SECRET || 'gps-qr-secret-changeme';
const BUCKET_MS = 120_000;

function validateToken(tripId: number | string, token: string): boolean {
  const now = Math.floor(Date.now() / BUCKET_MS);
  // Accept current bucket and previous bucket (grace period for scan right after rotation)
  for (const bucket of [now, now - 1]) {
    const expected = createHmac('sha256', QR_SECRET)
      .update(`${tripId}::${bucket}`)
      .digest('hex')
      .slice(0, 24);
    if (expected === token) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'Students only' }, { status: 403 });
  }

  let body: { trip_id?: number; token?: string; qr_data?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Support both direct fields and a JSON-encoded qr_data string
  let tripId = body.trip_id;
  let token = body.token;

  if (body.qr_data && (!tripId || !token)) {
    try {
      const parsed = JSON.parse(body.qr_data);
      tripId = parsed.trip_id;
      token = parsed.token;
    } catch {
      return NextResponse.json({ error: 'Invalid QR data' }, { status: 400 });
    }
  }

  if (!tripId || !token) {
    return NextResponse.json({ error: 'trip_id and token required' }, { status: 400 });
  }

  if (!validateToken(tripId, token)) {
    return NextResponse.json({ error: 'Invalid or expired QR code. Please scan again.' }, { status: 422 });
  }

  const db = createServiceClient();

  // Verify trip is still active
  const { data: trip } = await db
    .from('trips')
    .select('id, route_id, bus_id')
    .eq('id', tripId)
    .eq('status', 'active')
    .maybeSingle();

  if (!trip) {
    return NextResponse.json({ error: 'Trip is no longer active' }, { status: 404 });
  }

  // Check for duplicate attendance this trip
  const { data: existing } = await db
    .from('attendance')
    .select('id')
    .eq('trip_id', tripId)
    .eq('student_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Already checked in for this trip' }, { status: 409 });
  }

  // Record attendance
  const { error } = await db.from('attendance').insert({
    student_id: user.id,
    trip_id: tripId,
    boarding_time: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Checked in successfully!' });
}
