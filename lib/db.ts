// ─── Types ────────────────────────────────────────────────────────────────────
// All database access now goes through the Supabase client in each API route.
// This file is kept for shared TypeScript interfaces only.

/* REMOVED — SQLite schema & seed (now handled by Supabase)
function _removedInitSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#f59e0b',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER REFERENCES routes(id),
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radius INTEGER DEFAULT 100,
      stop_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('student','driver','admin','transport_head')) NOT NULL,
      route_id INTEGER REFERENCES routes(id),
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS buses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL,
      driver_id INTEGER REFERENCES users(id),
      route_id INTEGER REFERENCES routes(id),
      capacity INTEGER DEFAULT 50,
      model TEXT DEFAULT 'Standard Bus',
      status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','maintenance'))
    );

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bus_id INTEGER REFERENCES buses(id),
      driver_id INTEGER REFERENCES users(id),
      route_id INTEGER REFERENCES routes(id),
      start_time TEXT DEFAULT (datetime('now')),
      end_time TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','disconnected')),
      tracking_status TEXT DEFAULT 'connected' CHECK(tracking_status IN ('connected','disconnected')),
      last_seen TEXT DEFAULT (datetime('now')),
      current_lat REAL,
      current_lng REAL,
      current_speed REAL DEFAULT 0,
      battery_level INTEGER DEFAULT 100
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER REFERENCES trips(id),
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      speed REAL DEFAULT 0,
      battery_level INTEGER DEFAULT 100,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER REFERENCES users(id),
      trip_id INTEGER REFERENCES trips(id),
      stop_id INTEGER REFERENCES stops(id),
      boarding_time TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('sos_driver','sos_student','device_failure','low_battery','delay','geofence','info')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      bus_id INTEGER REFERENCES buses(id),
      trip_id INTEGER REFERENCES trips(id),
      triggered_by INTEGER REFERENCES users(id),
      severity TEXT DEFAULT 'info' CHECK(severity IN ('info','warning','critical')),
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed only if empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  if (count > 0) return;

  const hash = (p: string) => bcrypt.hashSync(p, 10);

  // Routes
  const r1 = db.prepare('INSERT INTO routes (name, description, color) VALUES (?,?,?)').run('Route A - North Campus', 'From North Gate to Main Campus', '#f59e0b');
  const r2 = db.prepare('INSERT INTO routes (name, description, color) VALUES (?,?,?)').run('Route B - South Campus', 'From South Hostel to Tech Block', '#0ea5e9');
  const r3 = db.prepare('INSERT INTO routes (name, description, color) VALUES (?,?,?)').run('Route C - City Express', 'City Center to College Main Gate', '#10b981');

  // Stops
  const si = db.prepare('INSERT INTO stops (route_id, name, lat, lng, radius, stop_order) VALUES (?,?,?,?,100,?)');
  [
    [r1.lastInsertRowid, 'North Gate',     12.9352, 77.6245, 1],
    [r1.lastInsertRowid, 'Science Block',  12.9378, 77.6280, 2],
    [r1.lastInsertRowid, 'Library',        12.9401, 77.6310, 3],
    [r1.lastInsertRowid, 'Main Campus',    12.9430, 77.6340, 4],
    [r2.lastInsertRowid, 'South Hostel',   12.9290, 77.6200, 1],
    [r2.lastInsertRowid, 'Sports Complex', 12.9310, 77.6225, 2],
    [r2.lastInsertRowid, 'Tech Block',     12.9335, 77.6255, 3],
    [r3.lastInsertRowid, 'City Center',       12.9716, 77.5946, 1],
    [r3.lastInsertRowid, 'Railway Station',   12.9762, 77.6000, 2],
    [r3.lastInsertRowid, 'Old Town',          12.9630, 77.6100, 3],
    [r3.lastInsertRowid, 'College Main Gate', 12.9430, 77.6340, 4],
  ].forEach(([rid, name, lat, lng, ord]) => si.run(rid, name, lat, lng, ord));

  // Users
  const ui = db.prepare('INSERT INTO users (name, email, password_hash, role, route_id, phone) VALUES (?,?,?,?,?,?)');
  ui.run('Admin Kumar',        'admin@college.edu',      hash('admin123'),     'admin',          null,               '+91-9000000001');
  ui.run('Transport Head Rao', 'transport@college.edu',  hash('transport123'), 'transport_head', null,               '+91-9000000002');
  const d1 = ui.run('Raju Kumar',    'driver1@college.edu',  hash('driver123'),  'driver',  r1.lastInsertRowid, '+91-9000000003');
  const d2 = ui.run('Suresh Babu',   'driver2@college.edu',  hash('driver123'),  'driver',  r2.lastInsertRowid, '+91-9000000004');
  const d3 = ui.run('Venkat Rao',    'driver3@college.edu',  hash('driver123'),  'driver',  r3.lastInsertRowid, '+91-9000000005');
  const s1 = ui.run('Priya Sharma',  'student1@college.edu', hash('student123'), 'student', r1.lastInsertRowid, '+91-9000000006');
  const s2 = ui.run('Arjun Singh',   'student2@college.edu', hash('student123'), 'student', r1.lastInsertRowid, '+91-9000000007');
  ui.run('Sneha Patel',    'student3@college.edu', hash('student123'), 'student', r2.lastInsertRowid, '+91-9000000008');

  // Buses
  const bi = db.prepare('INSERT INTO buses (number, driver_id, route_id, capacity, model) VALUES (?,?,?,?,?)');
  const b1 = bi.run('KA-01-F-1234', d1.lastInsertRowid, r1.lastInsertRowid, 45, 'Tata Starbus');
  const b2 = bi.run('KA-01-F-5678', d2.lastInsertRowid, r2.lastInsertRowid, 40, 'Ashok Leyland');
  const b3 = bi.run('KA-01-F-9012', d3.lastInsertRowid, r3.lastInsertRowid, 50, 'Eicher Pro');

  // One active trip
  const t1 = db.prepare(`
    INSERT INTO trips (bus_id, driver_id, route_id, status, tracking_status, last_seen, current_lat, current_lng, current_speed, battery_level)
    VALUES (?,?,?,'active','connected',datetime('now'),?,?,?,?)
  `).run(b1.lastInsertRowid, d1.lastInsertRowid, r1.lastInsertRowid, 12.9352, 77.6245, 35, 87);

  // Location trail
  const li = db.prepare("INSERT INTO locations (trip_id, lat, lng, speed, battery_level, timestamp) VALUES (?,?,?,?,?,datetime('now', ? || ' seconds'))");
  li.run(t1.lastInsertRowid, 12.9340, 77.6230, 30, 90, '-120');
  li.run(t1.lastInsertRowid, 12.9345, 77.6237, 33, 89, '-60');
  li.run(t1.lastInsertRowid, 12.9352, 77.6245, 35, 87,  '0');

  // Alerts
  const ai = db.prepare('INSERT INTO alerts (type, title, message, bus_id, severity) VALUES (?,?,?,?,?)');
  ai.run('low_battery',    'Low Battery Warning',   'Driver device battery is at 18% for Bus KA-01-F-1234. Please ensure charging.', b1.lastInsertRowid, 'warning');
  ai.run('delay',          'Route Delay Detected',  'Bus KA-01-F-5678 is delayed by 8 minutes due to traffic near City Junction.',   b2.lastInsertRowid, 'info');
  ai.run('device_failure', 'Tracking Signal Lost',  'Bus KA-01-F-9012 has not sent a heartbeat in 2 minutes. Last seen near Old Town.', b3.lastInsertRowid, 'critical');

  // Pre-seeded attendance
  const attI = db.prepare("INSERT INTO attendance (student_id, trip_id, stop_id, boarding_time) VALUES (?,?,?,datetime('now'))");
*/

export interface User {
  id: string; // UUID from Supabase Auth
  name: string;
  email: string;
  role: 'student' | 'driver' | 'admin' | 'transport_head';
  route_id: number | null;
  phone: string | null;
  created_at: string;
}

export interface Bus {
  id: number;
  number: string;
  driver_id: string | null; // UUID
  route_id: number | null;
  capacity: number;
  model: string;
  status: 'active' | 'inactive' | 'maintenance';
}

export interface Route {
  id: number;
  name: string;
  description: string;
  color: string;
}

export interface Stop {
  id: number;
  route_id: number;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  stop_order: number;
}

export interface Trip {
  id: number;
  bus_id: number;
  driver_id: string; // UUID
  route_id: number;
  start_time: string;
  end_time: string | null;
  status: 'active' | 'completed' | 'disconnected';
  tracking_status: 'connected' | 'disconnected';
  last_seen: string;
  current_lat: number | null;
  current_lng: number | null;
  current_speed: number;
  battery_level: number;
}

export interface Location {
  id: number;
  trip_id: number;
  lat: number;
  lng: number;
  speed: number;
  battery_level: number;
  timestamp: string;
}

export interface Alert {
  id: number;
  type: string;
  title: string;
  message: string;
  bus_id: number | null;
  trip_id: number | null;
  triggered_by: string | null; // UUID
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  created_at: string;
}

export interface Attendance {
  id: number;
  student_id: string; // UUID
  trip_id: number;
  stop_id: number | null;
  boarding_time: string;
}
