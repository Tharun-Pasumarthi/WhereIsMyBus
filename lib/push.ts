import webpush from 'web-push';
import { createServiceClient } from '@/lib/supabase/service';
import type { PushPayload } from '@/app/api/push/send/route';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const email = process.env.VAPID_EMAIL;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (email && pub && priv) {
    webpush.setVapidDetails(email, pub, priv);
    vapidConfigured = true;
  }
}

/**
 * Send push notification to specific users or all users with a given role.
 * Fire-and-forget safe — catches errors internally.
 */
export async function sendPush(opts: {
  userIds?: string[];
  roles?: string[];
  payload: PushPayload;
}): Promise<void> {
  try {
    ensureVapid();
    if (!vapidConfigured) return;

    const db = createServiceClient();
    let query = db.from('push_subscriptions').select('*');
    if (opts.userIds?.length) {
      query = query.in('user_id', opts.userIds);
    } else if (opts.roles?.length) {
      const { data: profiles } = await db
        .from('profiles')
        .select('id')
        .in('role', opts.roles);
      const ids = (profiles ?? []).map((p: { id: string }) => p.id);
      if (!ids.length) return;
      query = query.in('user_id', ids);
    }

    const { data: subs } = await query;
    if (!subs?.length) return;

    await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(opts.payload),
          { TTL: 3600 }
        ).catch(async err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        })
      )
    );
  } catch (err) {
    console.error('[push]', err);
  }
}
