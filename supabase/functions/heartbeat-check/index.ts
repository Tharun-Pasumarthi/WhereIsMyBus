// Supabase Edge Function: heartbeat-check
// Runs on a cron schedule (e.g. every 30 seconds via pg_cron or every minute).
// Marks active trips as "disconnected" when no heartbeat has been received for 60+ seconds.
//
// ────────────────────────────────────────────────────────────────────────────
// DEPLOYMENT INSTRUCTIONS
// ────────────────────────────────────────────────────────────────────────────
// ✅ DEPLOYED — v2.75.0 CLI, project: glwmfatnfsnpffagceeu
//
// To redeploy:
//   supabase functions deploy heartbeat-check --no-verify-jwt
//
// 5. Schedule with pg_cron — run this once in the Supabase SQL Editor:
//    (Dashboard → SQL Editor)
//
//    -- Enable required extensions first (Dashboard → Database → Extensions):
//    --   pg_net, pg_cron
//
//    select cron.schedule(
//      'heartbeat-check',
//      '* * * * *',   -- every minute
//      $$
//      select net.http_post(
//        url := 'https://glwmfatnfsnpffagceeu.supabase.co/functions/v1/heartbeat-check',
//        headers := '{"Authorization": "Bearer sb_publishable_eLBtQEHJA9XyjPMPOLxtbQ_Zpt8Z5w_"}'::jsonb,
//        body := '{}'::jsonb
//      );
//      $$
//    );
//
// 6. To unschedule:  select cron.unschedule('heartbeat-check');
// ────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DISCONNECT_THRESHOLD_SECONDS = 60;

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceKey);

  const cutoff = new Date(Date.now() - DISCONNECT_THRESHOLD_SECONDS * 1000).toISOString();

  // Find active trips that haven't sent a heartbeat in >60s and are still marked connected
  const { data: staleTrips, error } = await db
    .from('trips')
    .select('id, bus_id, driver_id, last_seen, buses!trips_bus_id_fkey(number)')
    .eq('status', 'active')
    .eq('tracking_status', 'connected')
    .lt('last_seen', cutoff);

  if (error) {
    console.error('Error fetching stale trips:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results: string[] = [];

  for (const trip of staleTrips ?? []) {
    // Mark as disconnected
    await db
      .from('trips')
      .update({ tracking_status: 'disconnected' })
      .eq('id', trip.id);

    const busNumber = (trip as any).buses?.number ?? 'Unknown';
    const lastSeenAgo = trip.last_seen
      ? Math.round((Date.now() - new Date(trip.last_seen).getTime()) / 1000)
      : '?';

    // Create device_failure alert (deduplicated — skip if one already exists in last 5 min)
    const recentCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingAlert } = await db
      .from('alerts')
      .select('id')
      .eq('trip_id', trip.id)
      .eq('type', 'device_failure')
      .gte('created_at', recentCutoff)
      .maybeSingle();

    if (!existingAlert) {
      await db.from('alerts').insert({
        type: 'device_failure',
        title: `GPS Signal Lost — Bus ${busNumber}`,
        message: `No heartbeat received from Bus ${busNumber} for ${lastSeenAgo}s. Driver device may be offline or out of range.`,
        bus_id: trip.bus_id,
        trip_id: trip.id,
        triggered_by: trip.driver_id,
        severity: 'critical',
      });
    }

    results.push(`Trip ${trip.id} (Bus ${busNumber}) marked disconnected`);
    console.log(`[heartbeat-check] ${results.at(-1)}`);
  }

  return new Response(
    JSON.stringify({ processed: results.length, trips: results }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
