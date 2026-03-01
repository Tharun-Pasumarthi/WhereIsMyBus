/**
 * scripts/seed-supabase.mjs
 *
 * Seeds the Supabase database with demo data.
 * Run AFTER applying scripts/supabase-schema.sql.
 *
 * Usage:
 *   node scripts/seed-supabase.mjs
 *
 * Requires .env.local to have:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
const envPath = resolve(__dirname, '..', '.env.local');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').trim()];
    })
);

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const serviceKey  = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || supabaseUrl.startsWith('your-') || !serviceKey || serviceKey.startsWith('your-')) {
  console.error('❌  Please fill in NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// ── Check if already seeded ──────────────────────────────────
const { count } = await db.from('profiles').select('*', { count: 'exact', head: true });
if (count > 0) {
  console.log('Database already seeded. Skipping.');
  process.exit(0);
}

// ── Routes ──────────────────────────────────────────────────
const { data: routes } = await db.from('routes').insert([
  { name: 'Route A - North Campus', description: 'From North Gate to Main Campus', color: '#f59e0b' },
  { name: 'Route B - South Campus', description: 'From South Hostel to Tech Block', color: '#0ea5e9' },
  { name: 'Route C - City Express',  description: 'City Center to College Main Gate', color: '#10b981' },
]).select('id, name');

const [r1, r2, r3] = routes;

// ── Stops ───────────────────────────────────────────────────
await db.from('stops').insert([
  { route_id: r1.id, name: 'North Gate',     lat: 12.9352, lng: 77.6245, radius: 100, stop_order: 1 },
  { route_id: r1.id, name: 'Science Block',  lat: 12.9378, lng: 77.6280, radius: 100, stop_order: 2 },
  { route_id: r1.id, name: 'Library',        lat: 12.9401, lng: 77.6310, radius: 100, stop_order: 3 },
  { route_id: r1.id, name: 'Main Campus',    lat: 12.9430, lng: 77.6340, radius: 100, stop_order: 4 },
  { route_id: r2.id, name: 'South Hostel',   lat: 12.9290, lng: 77.6200, radius: 100, stop_order: 1 },
  { route_id: r2.id, name: 'Sports Complex', lat: 12.9310, lng: 77.6225, radius: 100, stop_order: 2 },
  { route_id: r2.id, name: 'Tech Block',     lat: 12.9335, lng: 77.6255, radius: 100, stop_order: 3 },
  { route_id: r3.id, name: 'City Center',       lat: 12.9716, lng: 77.5946, radius: 100, stop_order: 1 },
  { route_id: r3.id, name: 'Railway Station',   lat: 12.9762, lng: 77.6000, radius: 100, stop_order: 2 },
  { route_id: r3.id, name: 'Old Town',          lat: 12.9630, lng: 77.6100, radius: 100, stop_order: 3 },
  { route_id: r3.id, name: 'College Main Gate', lat: 12.9430, lng: 77.6340, radius: 100, stop_order: 4 },
]);
console.log('✓ Routes & stops inserted');

// ── Auth Users ───────────────────────────────────────────────
async function createUser(name, email, password, role, routeId, phone) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role, route_id: routeId, phone },
  });
  if (error) throw new Error(`Failed to create ${email}: ${error.message}`);
  return data.user;
}

const admin     = await createUser('Admin Kumar',        'admin@college.edu',      'admin123',     'admin',          null,    '+91-9000000001');
const transport = await createUser('Transport Head Rao', 'transport@college.edu',  'transport123', 'transport_head', null,    '+91-9000000002');
const driver1   = await createUser('Raju Kumar',         'driver1@college.edu',    'driver123',    'driver',         r1.id,   '+91-9000000003');
const driver2   = await createUser('Suresh Babu',        'driver2@college.edu',    'driver123',    'driver',         r2.id,   '+91-9000000004');
const driver3   = await createUser('Venkat Rao',         'driver3@college.edu',    'driver123',    'driver',         r3.id,   '+91-9000000005');
const student1  = await createUser('Priya Sharma',       'student1@college.edu',   'student123',   'student',        r1.id,   '+91-9000000006');
const student2  = await createUser('Arjun Singh',        'student2@college.edu',   'student123',   'student',        r1.id,   '+91-9000000007');
const student3  = await createUser('Sneha Patel',        'student3@college.edu',   'student123',   'student',        r2.id,   '+91-9000000008');
console.log('✓ Auth users created');

// ── Buses ────────────────────────────────────────────────────
const { data: buses } = await db.from('buses').insert([
  { number: 'KA-01-F-1234', driver_id: driver1.id, route_id: r1.id, capacity: 45, model: 'Tata Starbus' },
  { number: 'KA-01-F-5678', driver_id: driver2.id, route_id: r2.id, capacity: 40, model: 'Ashok Leyland' },
  { number: 'KA-01-F-9012', driver_id: driver3.id, route_id: r3.id, capacity: 50, model: 'Eicher Pro' },
]).select('id, number');

const [b1, b2, b3] = buses;
console.log('✓ Buses inserted');

// ── Active Trip ──────────────────────────────────────────────
const { data: trips } = await db.from('trips').insert([{
  bus_id: b1.id, driver_id: driver1.id, route_id: r1.id,
  status: 'active', tracking_status: 'connected',
  current_lat: 12.9352, current_lng: 77.6245, current_speed: 35, battery_level: 87,
}]).select('id');

const trip1 = trips[0];

// ── Location Trail ───────────────────────────────────────────
const now = Date.now();
await db.from('locations').insert([
  { trip_id: trip1.id, lat: 12.9340, lng: 77.6230, speed: 30, battery_level: 90, timestamp: new Date(now - 120_000).toISOString() },
  { trip_id: trip1.id, lat: 12.9345, lng: 77.6237, speed: 33, battery_level: 89, timestamp: new Date(now -  60_000).toISOString() },
  { trip_id: trip1.id, lat: 12.9352, lng: 77.6245, speed: 35, battery_level: 87, timestamp: new Date(now).toISOString() },
]);
console.log('✓ Trip & locations inserted');

// ── Alerts ───────────────────────────────────────────────────
await db.from('alerts').insert([
  { type: 'low_battery',    title: 'Low Battery Warning',  message: 'Driver device battery is at 18% for Bus KA-01-F-1234. Please ensure device is charging.', bus_id: b1.id, severity: 'warning' },
  { type: 'delay',          title: 'Route Delay Detected', message: 'Bus KA-01-F-5678 is delayed by 8 minutes due to traffic near City Junction.',            bus_id: b2.id, severity: 'info' },
  { type: 'device_failure', title: 'Tracking Signal Lost', message: 'Bus KA-01-F-9012 has not sent a heartbeat in the last 2 minutes. Last seen near Old Town.', bus_id: b3.id, severity: 'critical' },
]);

// ── Attendance ───────────────────────────────────────────────
await db.from('attendance').insert([
  { student_id: student1.id, trip_id: trip1.id, stop_id: 1 },
  { student_id: student2.id, trip_id: trip1.id, stop_id: 2 },
]);
console.log('✓ Alerts & attendance inserted');

console.log('\n✅ Database seeded successfully!\n');
console.log('Test Accounts:');
console.log('  Admin:      admin@college.edu      / admin123');
console.log('  Transport:  transport@college.edu  / transport123');
console.log('  Driver 1:   driver1@college.edu    / driver123');
console.log('  Driver 2:   driver2@college.edu    / driver123');
console.log('  Student 1:  student1@college.edu   / student123');
console.log('  Student 2:  student2@college.edu   / student123');
console.log('  Student 3:  student3@college.edu   / student123');
