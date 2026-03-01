import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client — bypasses RLS, for server-side API routes only.
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
