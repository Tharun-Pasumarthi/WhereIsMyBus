import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PgEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface RealtimeOptions {
  /** Supabase table to subscribe to */
  table: string;
  /** Postgres change events to listen for (default: '*') */
  event?: PgEvent;
  /** Optional schema (default: 'public') */
  schema?: string;
  /** Optional column=value filter applied server-side */
  filter?: string;
  /** Callback fired on every matching change */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onData: (payload: RealtimePostgresChangesPayload<any>) => void;
  /** If false, the subscription is not created (use to gate on auth) */
  enabled?: boolean;
}

/**
 * Subscribe to Supabase Realtime Postgres changes.
 *
 * Example:
 * ```ts
 * useRealtime({ table: 'trips', onData: () => refetch() });
 * ```
 *
 * The subscription is automatically removed when the component unmounts
 * or when `enabled` becomes false.
 */
export function useRealtime({
  table,
  event = '*',
  schema = 'public',
  filter,
  onData,
  enabled = true,
}: RealtimeOptions) {
  // Keep a stable ref to the callback so we don't recreate channels on every render
  const onDataRef = useRef(onData);
  useEffect(() => { onDataRef.current = onData; }, [onData]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channelName = `realtime-${schema}-${table}-${filter ?? 'all'}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event, schema, table, ...(filter ? { filter } : {}) },
        (payload) => onDataRef.current(payload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, schema, filter, enabled]);
}

/**
 * Subscribe to multiple tables at once. Each entry in `subscriptions` is an
 * independent Realtime subscription merged into a single channel.
 */
export function useMultiRealtime(
  subscriptions: Omit<RealtimeOptions, 'onData'>[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onData: (table: string, payload: RealtimePostgresChangesPayload<any>) => void,
  enabled = true
) {
  const onDataRef = useRef(onData);
  useEffect(() => { onDataRef.current = onData; }, [onData]);

  useEffect(() => {
    if (!enabled || subscriptions.length === 0) return;

    const supabase = createClient();
    const channelName = `multi-${subscriptions.map(s => s.table).join('-')}-${Date.now()}`;

    let ch = supabase.channel(channelName);

    for (const sub of subscriptions) {
      ch = ch.on(
        'postgres_changes',
        {
          event: sub.event ?? '*',
          schema: sub.schema ?? 'public',
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        (payload) => onDataRef.current(sub.table, payload)
      );
    }

    ch.subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(subscriptions)]);
}
