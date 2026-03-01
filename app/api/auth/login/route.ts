import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // We need a mutable response so we can attach the session cookies Supabase sets.
    let response = NextResponse.json({ ok: true }); // placeholder, replaced below

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Write incoming cookies to the request (for subsequent getAll calls)
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
            // Build a fresh response each time so all cookies accumulate
            response = NextResponse.next({ request: req });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // Build the final JSON response and copy all session cookies onto it
    const finalResponse = NextResponse.json({
      user: {
        id: data.user.id,
        name: profile?.name,
        email: data.user.email,
        role: profile?.role,
        route_id: profile?.route_id ?? null,
        phone: profile?.phone ?? null,
      },
    });

    // Copy every cookie Supabase set (access token, refresh token, etc.)
    response.cookies.getAll().forEach(({ name, value, ...options }) => {
      finalResponse.cookies.set(name, value, options as any);
    });

    return finalResponse;
  } catch (err) {
    console.error('[Auth Login]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
