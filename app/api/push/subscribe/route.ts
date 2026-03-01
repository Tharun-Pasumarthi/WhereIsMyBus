import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

// POST /api/push/subscribe  — save or update subscription
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys?.p256dh ?? '',
      auth: body.keys?.auth ?? '',
      user_agent: req.headers.get('user-agent') ?? '',
    },
    { onConflict: 'endpoint' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe — remove subscription
export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

  const db = createServiceClient();
  await db.from('push_subscriptions').delete().eq('endpoint', body.endpoint).eq('user_id', user.id);

  return NextResponse.json({ ok: true });
}
