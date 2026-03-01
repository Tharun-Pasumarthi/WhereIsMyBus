import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'bus_tracker.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────

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

// ─── Seed Data ────────────────────────────────────────────────────────────────

const existing = db.prepare("SELECT COUNT(*) as count FROM users").get();
if (existing.count > 0) {
  console.log('Database already seeded. Skipping.');
  db.close();
  process.exit(0);
}

const hash = (pwd) => bcrypt.hashSync(pwd, 10);

// Routes
const r1 = db.prepare("INSERT INTO routes (name, description, color) VALUES (?,?,?)").run('Route A - North Campus', 'From North Gate to Main Campus', '#f59e0b');
const r2 = db.prepare("INSERT INTO routes (name, description, color) VALUES (?,?,?)").run('Route B - South Campus', 'From South Hostel to Tech Block', '#0ea5e9');
const r3 = db.prepare("INSERT INTO routes (name, description, color) VALUES (?,?,?)").run('Route C - City Express', 'City Center to College Main Gate', '#10b981');

// Stops for Route A
const stops_a = [
  { name: 'North Gate', lat: 12.9352, lng: 77.6245, order: 1 },
  { name: 'Science Block', lat: 12.9378, lng: 77.6280, order: 2 },
  { name: 'Library', lat: 12.9401, lng: 77.6310, order: 3 },
  { name: 'Main Campus', lat: 12.9430, lng: 77.6340, order: 4 },
];
const stopInsert = db.prepare("INSERT INTO stops (route_id, name, lat, lng, radius, stop_order) VALUES (?,?,?,?,100,?)");
for (const s of stops_a) stopInsert.run(r1.lastInsertRowid, s.name, s.lat, s.lng, s.order);

const stops_b = [
  { name: 'South Hostel', lat: 12.9290, lng: 77.6200, order: 1 },
  { name: 'Sports Complex', lat: 12.9310, lng: 77.6225, order: 2 },
  { name: 'Tech Block', lat: 12.9335, lng: 77.6255, order: 3 },
];
for (const s of stops_b) stopInsert.run(r2.lastInsertRowid, s.name, s.lat, s.lng, s.order);

const stops_c = [
  { name: 'City Center', lat: 12.9716, lng: 77.5946, order: 1 },
  { name: 'Railway Station', lat: 12.9762, lng: 77.6000, order: 2 },
  { name: 'Old Town', lat: 12.9630, lng: 77.6100, order: 3 },
  { name: 'College Main Gate', lat: 12.9430, lng: 77.6340, order: 4 },
];
for (const s of stops_c) stopInsert.run(r3.lastInsertRowid, s.name, s.lat, s.lng, s.order);

// Users
const userInsert = db.prepare("INSERT INTO users (name, email, password_hash, role, route_id, phone) VALUES (?,?,?,?,?,?)");
const admin = userInsert.run('Admin Kumar', 'admin@college.edu', hash('admin123'), 'admin', null, '+91-9000000001');
const transport = userInsert.run('Transport Head Rao', 'transport@college.edu', hash('transport123'), 'transport_head', null, '+91-9000000002');
const driver1 = userInsert.run('Raju Kumar', 'driver1@college.edu', hash('driver123'), 'driver', r1.lastInsertRowid, '+91-9000000003');
const driver2 = userInsert.run('Suresh Babu', 'driver2@college.edu', hash('driver123'), 'driver', r2.lastInsertRowid, '+91-9000000004');
const driver3 = userInsert.run('Venkat Rao', 'driver3@college.edu', hash('driver123'), 'driver', r3.lastInsertRowid, '+91-9000000005');
const student1 = userInsert.run('Priya Sharma', 'student1@college.edu', hash('student123'), 'student', r1.lastInsertRowid, '+91-9000000006');
const student2 = userInsert.run('Arjun Singh', 'student2@college.edu', hash('student123'), 'student', r1.lastInsertRowid, '+91-9000000007');
const student3 = userInsert.run('Sneha Patel', 'student3@college.edu', hash('student123'), 'student', r2.lastInsertRowid, '+91-9000000008');

// Buses
const busInsert = db.prepare("INSERT INTO buses (number, driver_id, route_id, capacity, model) VALUES (?,?,?,?,?)");
const bus1 = busInsert.run('KA-01-F-1234', driver1.lastInsertRowid, r1.lastInsertRowid, 45, 'Tata Starbus');
const bus2 = busInsert.run('KA-01-F-5678', driver2.lastInsertRowid, r2.lastInsertRowid, 40, 'Ashok Leyland');
const bus3 = busInsert.run('KA-01-F-9012', driver3.lastInsertRowid, r3.lastInsertRowid, 50, 'Eicher Pro');

// Active trip for bus1
const tripInsert = db.prepare(`INSERT INTO trips (bus_id, driver_id, route_id, status, tracking_status, last_seen, current_lat, current_lng, current_speed, battery_level)
  VALUES (?,?,?,'active','connected', datetime('now'), ?, ?, ?, ?)`);
const trip1 = tripInsert.run(bus1.lastInsertRowid, driver1.lastInsertRowid, r1.lastInsertRowid, 12.9352, 77.6245, 35, 87);

// Sample location history
const locInsert = db.prepare("INSERT INTO locations (trip_id, lat, lng, speed, battery_level, timestamp) VALUES (?,?,?,?,?,datetime('now', ? || ' seconds'))");
locInsert.run(trip1.lastInsertRowid, 12.9340, 77.6230, 30, 90, '-120');
locInsert.run(trip1.lastInsertRowid, 12.9345, 77.6237, 33, 89, '-60');
locInsert.run(trip1.lastInsertRowid, 12.9352, 77.6245, 35, 87, '0');

// Alerts
const alertInsert = db.prepare("INSERT INTO alerts (type, title, message, bus_id, severity) VALUES (?,?,?,?,?)");
alertInsert.run('low_battery', 'Low Battery Warning', 'Driver device battery is at 18% for Bus KA-01-F-1234. Please ensure device is charging.', bus1.lastInsertRowid, 'warning');
alertInsert.run('delay', 'Route Delay Detected', 'Bus KA-01-F-5678 is delayed by 8 minutes due to traffic near City Junction.', bus2.lastInsertRowid, 'info');
alertInsert.run('device_failure', 'Tracking Signal Lost', 'Bus KA-01-F-9012 has not sent a heartbeat in the last 2 minutes. Last seen near Old Town.', bus3.lastInsertRowid, 'critical');

// Attendance
const attInsert = db.prepare("INSERT INTO attendance (student_id, trip_id, stop_id, boarding_time) VALUES (?,?,?,datetime('now'))");
attInsert.run(student1.lastInsertRowid, trip1.lastInsertRowid, 1);
attInsert.run(student2.lastInsertRowid, trip1.lastInsertRowid, 2);

console.log('✅ Database seeded successfully!');
console.log('');
console.log('Test Accounts:');
console.log('  Admin:     admin@college.edu     / admin123');
console.log('  Transport: transport@college.edu / transport123');
console.log('  Driver 1:  driver1@college.edu   / driver123');
console.log('  Driver 2:  driver2@college.edu   / driver123');
console.log('  Student 1: student1@college.edu  / student123');
console.log('  Student 2: student2@college.edu  / student123');
console.log('  Student 3: student3@college.edu  / student123');

db.close();
