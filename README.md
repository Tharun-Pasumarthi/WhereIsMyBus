# WhereIsMyBus 🚌

A real-time GPS bus tracking system for colleges, built with Next.js and Supabase. Supports multiple user roles — Admin, Driver, Student, and Parent — each with their own dashboard and live tracking features.

---

## Features

### 🗺️ Real-Time Bus Tracking
- Live GPS location updates on an interactive map
- Fleet overview with bus status, speed, and battery level
- Visual disconnect indicators when a bus goes offline
- "Last updated X ago" timestamps per bus

### 👨‍💼 Admin Dashboard
- Fleet management: view all buses, routes, and active trips
- Attendance overview with route name, student count, and export to CSV
- Alerts panel: SOS, battery warnings, geo-fence breaches, device failures
- System stats: active buses, trips, total students

### 🚗 Driver Dashboard
- Start/end trips with one click
- Live QR code (rotates every 2 minutes) for student attendance
- Real-time attendance counter
- SOS button for emergencies
- GPS tracking auto-sends location every few seconds

### 🎓 Student Dashboard
- QR code scanner for boarding check-in
- Live bus map showing current bus location
- Today's attendance status

### 👨‍👩‍👧 Parent Dashboard
- Track child's bus in real-time
- View boarding/attendance history
- Bus details: route, speed, battery, connection status
- Alerts for SOS and device issues
- Supports multiple children per parent

### 🔐 Profile Management
- All users can update name and phone number
- Change email or password from the profile page

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Maps | Leaflet (via `bus-map` component) |
| QR Code | `qrcode.react` + `jsqr` |
| Edge Functions | Supabase Edge Functions (Deno) |

---

## User Roles & Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@college.edu | admin123 |
| Driver | driver1@college.edu | driver123 |
| Student | student1@college.edu | student123 |
| Parent | parent1@college.edu | parent123 |
| Parent | parent2@college.edu | parent123 |

> Parent 1 tracks **Priya Sharma's** bus · Parent 2 tracks **Arjun Singh's** bus

---

## Project Structure

```
app/
├── page.tsx               # Login page
├── admin/page.tsx         # Admin dashboard
├── driver/page.tsx        # Driver dashboard
├── student/page.tsx       # Student dashboard
├── parent/page.tsx        # Parent dashboard
├── profile/page.tsx       # Profile settings (all roles)
└── api/
    ├── auth/              # Login, logout, session
    ├── buses/             # Bus CRUD
    ├── trips/             # Trip start/end
    ├── locations/         # GPS location updates + geo-fencing
    ├── attendance/        # Attendance records + CSV export
    ├── qr/                # QR generate (driver) + validate (student)
    ├── alerts/            # Alerts management
    ├── parent/dashboard/  # Parent-specific data
    ├── profile/           # Profile update
    └── stats/             # System statistics

components/
├── bus-map.tsx            # Leaflet map component
├── dashboard-nav.tsx      # Shared nav with role-aware links
└── ui/                    # shadcn/ui components

lib/
├── auth.ts                # Auth helpers + User type
├── db.ts                  # Supabase client helpers
└── supabase/              # Client, server, service clients

supabase/
└── functions/
    └── heartbeat-check/   # Edge Function: marks buses offline after 60s

scripts/
├── supabase-schema.sql    # Full DB schema
├── seed-supabase.mjs      # Seed demo data
├── parent-migration.sql   # Parent role + parent_students table
└── seed-parents.mjs       # Seed parent accounts
```

---

## Database Schema

Key tables:
- `profiles` — user accounts with roles (`admin`, `driver`, `student`, `parent`, `transport_head`)
- `buses` — bus registry
- `routes` — named routes with stop coordinates
- `trips` — active/completed trips linking driver, bus, and route
- `locations` — GPS pings with speed, battery, accuracy
- `attendance` — student check-in records per trip
- `alerts` — SOS, battery, geo-fence, device failure events
- `parent_students` — maps parent accounts to their children

---

## QR Attendance System

1. Driver starts a trip → QR code generated server-side
2. QR token = HMAC-SHA256(`tripId::timeBucket`) — rotates every **2 minutes**
3. Student scans QR with device camera
4. Server validates token (accepts current + previous bucket for grace period)
5. Attendance record inserted; duplicate scans return a friendly "already checked in" message

---

## Heartbeat Monitoring

A Supabase Edge Function (`heartbeat-check`) runs on a cron schedule:
- Checks all buses with `tracking_status = 'connected'`
- If `last_seen` is older than 60 seconds → marks bus as `disconnected`
- Creates a `device_failure` critical alert
- Admin and parent dashboards reflect the offline status visually

---

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm
- Supabase account

### Setup

```bash
# Install dependencies
pnpm install

# Set environment variables
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### Database

Run the schema in your Supabase SQL editor:
```bash
# Apply schema
scripts/supabase-schema.sql

# Apply parent role migration
scripts/parent-migration.sql

# Seed demo data
node scripts/seed-supabase.mjs
node scripts/seed-parents.mjs
```

### Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with any demo account.

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
QR_SECRET=your-random-secret-for-hmac
```

---

## License

MIT
