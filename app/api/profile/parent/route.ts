import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

// GET /api/profile/parent
// Returns parent(s) linked to the current student
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from('parent_students')
    .select('parent_id, profiles!parent_students_parent_id_fkey(id, name, email)')
    .eq('student_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const parents = (data ?? []).map((row: any) => row.profiles).filter(Boolean);
  return NextResponse.json({ parents });
}

// POST /api/profile/parent
// Body: { email: string }
// Links a parent account to the current student by parent's email
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? '').toString().trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Parent email is required' }, { status: 400 });
  }

  const db = createServiceClient();

  // Find parent account with that email
  const { data: parentProfile, error: fetchErr } = await db
    .from('profiles')
    .select('id, name, email, role')
    .eq('email', email)
    .eq('role', 'parent')
    .single();

  if (fetchErr || !parentProfile) {
    return NextResponse.json(
      { error: 'No parent account found with that email. Ask your parent to register first.' },
      { status: 404 }
    );
  }

  // Check if already linked
  const { data: existing } = await db
    .from('parent_students')
    .select('id')
    .eq('parent_id', parentProfile.id)
    .eq('student_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'This parent is already linked to your account.' }, { status: 409 });
  }

  // Create the link
  const { error: insertErr } = await db
    .from('parent_students')
    .insert({ parent_id: parentProfile.id, student_id: user.id });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({
    message: `Linked successfully! ${parentProfile.name} can now track your bus.`,
    parent: { id: parentProfile.id, name: parentProfile.name, email: parentProfile.email },
  });
}

// DELETE /api/profile/parent
// Body: { parent_id: string }
// Removes a parent link from the current student
export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parentId = body.parent_id;
  if (!parentId) {
    return NextResponse.json({ error: 'parent_id is required' }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db
    .from('parent_students')
    .delete()
    .eq('parent_id', parentId)
    .eq('student_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Parent access removed successfully.' });
}
