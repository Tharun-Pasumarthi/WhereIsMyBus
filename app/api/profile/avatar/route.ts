import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth';

const BUCKET = 'avatars';
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// POST /api/profile/avatar
// multipart/form-data: field "avatar" = image file
// Returns: { avatar_url: string }
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('avatar');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, WebP and GIF images are allowed' },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Image must be smaller than 2 MB' }, { status: 400 });
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${user.id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const db = createServiceClient();

  // Ensure bucket exists; ignore "already exists" errors
  await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE_BYTES }).catch(() => null);

  // Upload (upsert to overwrite previous avatar)
  const { error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600',
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Get public URL
  const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path);
  // Bust cache by appending timestamp
  const avatar_url = `${publicUrl}?t=${Date.now()}`;

  // Persist URL in profiles table
  await db.from('profiles').update({ avatar_url }).eq('id', user.id);

  return NextResponse.json({ avatar_url });
}

// DELETE /api/profile/avatar — remove avatar
export async function DELETE() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient();

  // Try common extensions
  for (const ext of ['jpg', 'png', 'webp', 'gif']) {
    await db.storage.from(BUCKET).remove([`${user.id}.${ext}`]).catch(() => null);
  }

  await db.from('profiles').update({ avatar_url: null }).eq('id', user.id);

  return NextResponse.json({ message: 'Avatar removed' });
}
