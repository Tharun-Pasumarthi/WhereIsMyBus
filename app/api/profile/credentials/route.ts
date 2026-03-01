import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSession } from '@/lib/auth';

// POST /api/profile/credentials — update email or password
// Body: { type: 'email', email: 'new@email.com' }
//    or { type: 'password', password: 'newpass123' }
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  let response = NextResponse.json({ success: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.json({ success: true });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  if (body.type === 'password') {
    if (!body.password || body.password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    const { error } = await supabase.auth.updateUser({ password: body.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (body.type === 'email') {
    if (!body.email?.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    const { error } = await supabase.auth.updateUser({ email: body.email });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    // Also update in profiles table
    const { createServiceClient } = await import('@/lib/supabase/service');
    const db = createServiceClient();
    // Note: auth email update requires email confirmation by default
  } else {
    return NextResponse.json({ error: 'type must be "email" or "password"' }, { status: 400 });
  }

  return response;
}
