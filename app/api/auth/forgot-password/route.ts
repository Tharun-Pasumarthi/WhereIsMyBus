import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendMail, passwordResetEmail } from '@/lib/mailer';

// POST /api/auth/forgot-password
// Body: { email: string }
// Generates a Supabase password-reset link and sends it via NodeMailer
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? '').toString().trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const db = createServiceClient();

  const origin =
    req.headers.get('origin') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';

  // Generate reset link via Supabase Admin API
  const { data, error } = await db.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${origin}/reset-password` },
  });

  // Always return 200 to prevent user enumeration
  if (error || !data?.properties?.action_link) {
    // Still return 200 to not leak whether the email exists
    return NextResponse.json({
      message: 'If an account exists for that email, a reset link has been sent.',
    });
  }

  // Look up name for personalised email
  const { data: profile } = await db
    .from('profiles')
    .select('name')
    .eq('email', email)
    .maybeSingle();

  const resetLink = data.properties.action_link;
  const name = profile?.name ?? email.split('@')[0];

  try {
    await sendMail({
      to: email,
      subject: 'Reset your password — Where Is My Bus',
      html: passwordResetEmail(resetLink, name),
    });
  } catch (mailErr) {
    console.error('[forgot-password] NodeMailer error:', mailErr);
    // Fall back: still return success so UX is smooth; log server-side
  }

  return NextResponse.json({
    message: 'If an account exists for that email, a reset link has been sent.',
  });
}
