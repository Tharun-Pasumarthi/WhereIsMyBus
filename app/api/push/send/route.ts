import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

/**
 * POST /api/push/send
 * Body: { user_ids?: string[], role?: string, payload: PushPayload }
 * Sends a push notification to specified users or all users with a given role.
 * Requires admin or transport_head.
 */
export async function POST(req: NextRequest) {
  const caller = await getSession();
  if (!caller || !['admin', 'transport_head'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.payload) return NextResponse.json({ error: 'Missing payload' }, { status: 400 });

  const db = createServiceClient();

  let subQuery = db.from('push_subscriptions').select('*');
  if (body.user_ids?.length) {
    subQuery = subQuery.in('user_id', body.user_ids);
  }

  const { data: subs } = await subQuery;
  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(body.payload),
        { TTL: 60 * 60 }
      ).catch(async (err) => {
        // Remove expired/invalid subscriptions (410 Gone)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
        throw err;
      })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return NextResponse.json({ sent, total: subs.length });
}
