import { createClient } from './supabase/server';
import { createServiceClient } from './supabase/service';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'driver' | 'admin' | 'transport_head' | 'parent';
  route_id: number | null;
  phone: string | null;
  created_at: string;
}

/**
 * Returns the currently authenticated user (profile) from the Supabase session,
 * or null if not signed in.
 *
 * - Uses getSession() (reads JWT from cookie, no network round-trip)
 * - Uses the SERVICE ROLE key to query profiles so RLS never blocks it
 * - Falls back to auth metadata if the profiles row is missing
 */
export async function getSession(): Promise<User | null> {
  try {
    // 1. Read the session JWT from cookies (no Supabase Auth network call)
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return null;
    const authUser = session.user;

    // 2. Fetch profile via service role to bypass any RLS restrictions
    const service = createServiceClient();
    const { data: profile } = await service
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    // 3. Fall back to auth metadata if profile row doesn't exist yet
    const meta = authUser.user_metadata ?? {};

    return {
      id: authUser.id,
      name: profile?.name ?? meta.name ?? authUser.email!.split('@')[0],
      email: authUser.email!,
      role: profile?.role ?? meta.role ?? 'student',
      route_id: profile?.route_id ?? meta.route_id ?? null,
      phone: profile?.phone ?? meta.phone ?? null,
      created_at: profile?.created_at ?? authUser.created_at,
    };
  } catch {
    return null;
  }
}
