// Run AFTER the main schema and main seed:
//   node scripts/seed-parents.mjs
//
// This script:
//   1. Creates two parent user accounts in Supabase Auth
//   2. Links each parent to a student via parent_students table

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const supabase = createClient(
  envVars['NEXT_PUBLIC_SUPABASE_URL'],
  envVars['SUPABASE_SERVICE_ROLE_KEY'],
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log('Seeding parent users...\n');

  // --- look up existing student IDs by email ---
  const { data: student1 } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('name', 'Priya Sharma')
    .maybeSingle();

  const { data: student2 } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('name', 'Arjun Singh')
    .maybeSingle();

  if (!student1 || !student2) {
    console.error('Could not find student profiles. Run the main seed script first.');
    process.exit(1);
  }
  console.log(`Found students: ${student1.name} (${student1.id}), ${student2.name} (${student2.id})`);

  // --- create parent accounts ---
  const parents = [
    { name: 'Parent One', email: 'parent1@college.edu', password: 'parent123', studentId: student1.id },
    { name: 'Parent Two', email: 'parent2@college.edu', password: 'parent123', studentId: student2.id },
  ];

  for (const p of parents) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true,
      user_metadata: { name: p.name, role: 'parent' },
    });
    if (error && !error.message.includes('already registered')) {
      console.error(`Failed to create ${p.email}:`, error.message);
      continue;
    }
    const parentId = data?.user?.id ?? (await supabase
      .from('profiles').select('id').eq('name', p.name).maybeSingle()
      .then(r => r.data?.id));
    if (!parentId) { console.error(`Could not resolve parent id for ${p.name}`); continue; }

    // link parent -> student
    const { error: linkErr } = await supabase
      .from('parent_students')
      .upsert({ parent_id: parentId, student_id: p.studentId }, { onConflict: 'parent_id,student_id' });
    if (linkErr) console.error(`Link error for ${p.name}:`, linkErr.message);
    else console.log(`✓ ${p.name} linked to ${p.email}'s student`);
  }

  console.log('\nDone! Parent logins:');
  console.log('  parent1@college.edu / parent123');
  console.log('  parent2@college.edu / parent123');
}

main().catch(console.error);
