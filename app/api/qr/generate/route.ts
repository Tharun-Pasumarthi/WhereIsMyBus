import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

const QR_SECRET = process.env.QR_SECRET || 'gps-qr-secret-changeme';
const BUCKET_MS = 120_000; // 2-minute windows

export function generateQrToken(tripId: number | string, bucket: number): string {
  return createHmac('sha256', QR_SECRET)
    .update(`${tripId}::${bucket}`)
    .digest('hex')
    .slice(0, 24);
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'driver') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createServiceClient();

  // Find active trip for this driver
  const { data: trip } = await db
    .from('trips')
    .select('id, bus_id')
    .eq('driver_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!trip) {
    return NextResponse.json({ error: 'No active trip' }, { status: 404 });
  }

  const bucket = Math.floor(Date.now() / BUCKET_MS);
  const token = generateQrToken(trip.id, bucket);
  const expiresMs = BUCKET_MS - (Date.now() % BUCKET_MS);

  const qrPayload = JSON.stringify({ trip_id: trip.id, token, v: 1 });

  return NextResponse.json({
    trip_id: trip.id,
    qr_data: qrPayload,
    token,
    expires_in: Math.ceil(expiresMs / 1000), // seconds until token rotates
  });
}
