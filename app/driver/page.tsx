'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/dashboard-nav';
import BusMap from '@/components/bus-map';
import { useRealtime } from '@/hooks/use-realtime';
import { QRCodeSVG } from 'qrcode.react';
import {
  Play, Square, Navigation, Battery, BatteryLow, BatteryFull,
  Wifi, WifiOff, Shield, AlertTriangle, Users, Clock, Radio,
  CheckCircle, MapPin, Zap, Bus, RefreshCw, QrCode
} from 'lucide-react';

interface User { id: number; name: string; email: string; role: string; route_id: number | null; }

// Simulated GPS path around the seed data coordinates (Bangalore area)
const GPS_WAYPOINTS = [
  { lat: 12.9340, lng: 77.6230 },
  { lat: 12.9352, lng: 77.6245 },
  { lat: 12.9364, lng: 77.6258 },
  { lat: 12.9378, lng: 77.6280 },
  { lat: 12.9390, lng: 77.6295 },
  { lat: 12.9401, lng: 77.6310 },
  { lat: 12.9415, lng: 77.6322 },
  { lat: 12.9430, lng: 77.6340 },
];

export default function DriverDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tripId, setTripId] = useState<number | null>(null);
  const [tripActive, setTripActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [gpsIndex, setGpsIndex] = useState(0);
  const [currentPos, setCurrentPos] = useState(GPS_WAYPOINTS[0]);
  const [battery, setBattery] = useState(87);
  const [speed, setSpeed] = useState(0);
  const [tripDuration, setTripDuration] = useState(0);
  const [stops, setStops] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [sosActive, setSosActive] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrExpiresIn, setQrExpiresIn] = useState(120);
  const tripTimer = useRef<NodeJS.Timeout | null>(null);
  const gpsTimer = useRef<NodeJS.Timeout | null>(null);
  const qrTimer = useRef<NodeJS.Timeout | null>(null);
  const qrCountdown = useRef<NodeJS.Timeout | null>(null);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  };

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/'); return; }
      if (d.user.role !== 'driver') { router.push('/student'); return; }
      setUser(d.user);
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    // Check for active trip
    fetch('/api/trips?status=active').then(r => r.json()).then(d => {
      const myTrip = d.trips?.find((t: any) => t.driver_id === user.id);
      if (myTrip) { setTripId(myTrip.id); setTripActive(true); }
      setLoading(false);
    });
    fetch('/api/routes').then(r => r.json()).then(d => setStops(d.stops || []));
  }, [user]);

  // GPS simulation loop
  useEffect(() => {
    if (!tripActive || !tripId) return;

    gpsTimer.current = setInterval(() => {
      setGpsIndex(prev => {
        const next = (prev + 1) % GPS_WAYPOINTS.length;
        const pos = GPS_WAYPOINTS[next];
        setCurrentPos(pos);
        const spd = Math.floor(Math.random() * 20) + 25;
        setSpeed(spd);
        const bat = Math.max(10, battery - Math.random() * 0.3);
        setBattery(Math.round(bat));

        fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trip_id: tripId,
            lat: pos.lat, lng: pos.lng,
            speed: spd, battery_level: Math.round(bat),
          }),
        }).catch(() => {});
        return next;
      });
    }, 5000);

    tripTimer.current = setInterval(() => setTripDuration(d => d + 1), 1000);

    return () => {
      if (gpsTimer.current) clearInterval(gpsTimer.current);
      if (tripTimer.current) clearInterval(tripTimer.current);
    };
  }, [tripActive, tripId]);

  // QR code auto-refresh (2-minute rotating token)
  useEffect(() => {
    if (!tripActive) {
      setQrData(null);
      if (qrTimer.current) clearInterval(qrTimer.current);
      if (qrCountdown.current) clearInterval(qrCountdown.current);
      return;
    }
    const fetchQr = async () => {
      const res = await fetch('/api/qr/generate');
      if (res.ok) {
        const data = await res.json();
        setQrData(data.qr_data);
        setQrExpiresIn(data.expires_in);
      }
    };
    fetchQr();
    qrTimer.current = setInterval(fetchQr, 115_000);
    qrCountdown.current = setInterval(() => {
      setQrExpiresIn(prev => (prev <= 1 ? 120 : prev - 1));
    }, 1_000);
    return () => {
      if (qrTimer.current) clearInterval(qrTimer.current);
      if (qrCountdown.current) clearInterval(qrCountdown.current);
    };
  }, [tripActive]);

  // Load attendance for active trip
  const loadAttendance = useCallback(() => {
    if (!tripId) return;
    fetch(`/api/attendance?trip_id=${tripId}`).then(r => r.json()).then(d => setAttendance(d.attendance || []));
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    loadAttendance();
    // Fallback poll every 30s; Realtime handles instant updates
    const i = setInterval(loadAttendance, 30_000);
    return () => clearInterval(i);
  }, [tripId, loadAttendance]);

  // Realtime: refresh attendance immediately when a new row is inserted
  useRealtime({
    table: 'attendance',
    event: 'INSERT',
    enabled: !!tripId,
    onData: loadAttendance,
  });

  const startTrip = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/trips', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTripId(data.trip_id); setTripActive(true); setGpsIndex(0);
        setCurrentPos(GPS_WAYPOINTS[0]); setTripDuration(0); setSpeed(0);
        showMsg('Trip started! GPS simulation active.');
      } else {
        if (data.trip_id) { setTripId(data.trip_id); setTripActive(true); showMsg('Resumed active trip.'); }
        else showMsg(data.error || 'Failed to start trip', 'error');
      }
    } catch { showMsg('Network error', 'error'); }
    finally { setActionLoading(false); }
  };

  const endTrip = async () => {
    if (!tripId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/end`, { method: 'POST' });
      if (res.ok) {
        setTripActive(false); setTripId(null); setSpeed(0); setTripDuration(0);
        if (gpsTimer.current) clearInterval(gpsTimer.current);
        if (tripTimer.current) clearInterval(tripTimer.current);
        showMsg('Trip ended successfully.');
      } else showMsg('Failed to end trip', 'error');
    } catch { showMsg('Network error', 'error'); }
    finally { setActionLoading(false); }
  };

  const triggerSOS = async () => {
    if (!tripId) { showMsg('Start a trip first', 'error'); return; }
    setSosActive(true);
    try {
      await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          message: 'Driver triggered SOS. Immediate assistance required.',
          lat: currentPos.lat, lng: currentPos.lng,
        }),
      });
      showMsg('SOS alert sent to admin!', 'success');
    } catch { showMsg('SOS failed', 'error'); }
    setTimeout(() => setSosActive(false), 5000);
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}` : `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Loading driver panel...</p>
      </div>
    </div>
  );

  const BatteryIcon = battery > 50 ? BatteryFull : battery > 20 ? Battery : BatteryLow;
  const batteryColor = battery > 50 ? 'text-[#10b981]' : battery > 20 ? 'text-primary' : 'text-red-400';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {user && <DashboardNav user={user} />}

      <main className="flex-1 p-4 lg:p-6 max-w-5xl mx-auto w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              Driver Control Panel
            </h1>
            <p className="text-sm text-muted-foreground">Manage your trip and broadcast GPS location</p>
          </div>
          <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border font-medium ${
            tripActive ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30' : 'bg-muted text-muted-foreground border-border/50'
          }`}>
            <span className={`w-2 h-2 rounded-full ${tripActive ? 'bg-[#10b981] pulse-dot' : 'bg-muted-foreground'}`} />
            {tripActive ? 'On Trip' : 'Off Duty'}
          </div>
        </div>

        {/* Trip Control Card */}
        <div className="gradient-border rounded-xl p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {tripActive ? formatDuration(tripDuration) : '--:--'}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> Duration
              </div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${speed > 0 ? 'text-primary' : 'text-muted-foreground'}`} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {speed} <span className="text-sm font-normal">km/h</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <Navigation className="w-3 h-3" /> Speed
              </div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${batteryColor}`} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {battery}%
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <BatteryIcon className="w-3 h-3" /> Battery
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {attendance.length}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <Users className="w-3 h-3" /> Boarded
              </div>
            </div>
          </div>

          {/* GPS Coordinates */}
          {tripActive && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-4 font-mono">
              <Radio className="w-3 h-3 text-primary" />
              <span>GPS: {currentPos.lat.toFixed(4)}°N, {currentPos.lng.toFixed(4)}°E</span>
              <span className="ml-auto flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] pulse-dot inline-block" />
                Broadcasting
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!tripActive ? (
              <button
                onClick={startTrip}
                disabled={actionLoading}
                className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-60 text-sm"
              >
                {actionLoading
                  ? <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <><Play className="w-5 h-5" /> Start Trip</>
                }
              </button>
            ) : (
              <button
                onClick={endTrip}
                disabled={actionLoading}
                className="flex-1 py-3.5 rounded-xl bg-muted border border-border text-foreground font-bold flex items-center justify-center gap-2 hover:bg-destructive/20 hover:border-destructive/40 hover:text-red-400 transition-all disabled:opacity-60 text-sm"
              >
                {actionLoading
                  ? <span className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : <><Square className="w-5 h-5" /> End Trip</>
                }
              </button>
            )}

            <button
              onClick={triggerSOS}
              disabled={sosActive || !tripActive}
              className={`px-5 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all text-sm border ${
                sosActive
                  ? 'bg-red-500 text-white border-red-500 animate-pulse'
                  : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <Shield className="w-5 h-5" />
              {sosActive ? 'SOS Sent!' : 'SOS'}
            </button>
          </div>
        </div>

        {/* QR Code for Student Check-in */}
        {tripActive && qrData && (
          <div className="bg-card rounded-xl border border-border/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Student Check-in QR Code</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Refreshes in</span>
                <span className={`font-mono font-bold tabular-nums ${
                  qrExpiresIn < 20 ? 'text-red-400' : 'text-primary'
                }`}>{qrExpiresIn}s</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="bg-white p-3 rounded-xl shadow-lg flex-shrink-0">
                <QRCodeSVG value={qrData} size={168} level="M" />
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-foreground font-semibold">Show this QR to boarding students</p>
                  <p className="text-muted-foreground text-xs mt-1">Students scan it with their phone camera to check in. The code rotates every 2 minutes for security.</p>
                </div>
                <div className="flex items-center gap-2 text-xs bg-[#10b981]/10 text-[#10b981] rounded-lg px-3 py-2 border border-[#10b981]/20">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{attendance.length} student{attendance.length !== 1 ? 's' : ''} checked in this trip</span>
                </div>
                <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-3 py-2">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    qrExpiresIn > 20 ? 'bg-[#10b981]' : 'bg-red-400 animate-pulse'
                  }`} />
                  <span className="text-muted-foreground">
                    {qrExpiresIn > 20 ? 'Code is valid' : 'Code expiring — new code loading soon'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${tripActive ? 'bg-[#10b981] pulse-dot' : 'bg-muted-foreground'}`} />
              <span className="text-sm font-semibold text-foreground">Your Route Map</span>
            </div>
            {tripActive && <span className="text-xs text-primary font-medium">GPS Simulation Active</span>}
          </div>
          <div className="h-64">
            <BusMap
              buses={tripActive ? [{
                id: user?.id || 0,
                bus_number: 'My Bus',
                route_name: 'Active Route',
                route_color: '#f59e0b',
                current_lat: currentPos.lat,
                current_lng: currentPos.lng,
                current_speed: speed,
                tracking_status: 'connected',
                driver_name: user?.name || '',
              }] : []}
              stops={stops.filter((s: any) => s.route_id === user?.route_id)}
              height="h-full"
            />
          </div>
        </div>

        {/* Boarded Students */}
        <div className="bg-card rounded-xl border border-border/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Boarded Students ({attendance.length})</span>
            </div>
          </div>
          <div className="p-4">
            {attendance.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No students boarded yet</p>
            ) : (
              <div className="space-y-2">
                {attendance.map((rec: any) => (
                  <div key={rec.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#10b981]/15 flex items-center justify-center">
                        <CheckCircle className="w-3.5 h-3.5 text-[#10b981]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{rec.student_name}</div>
                        <div className="text-xs text-muted-foreground">{rec.stop_name || 'Stop not specified'}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(rec.boarding_time + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Battery Warning */}
        {battery < 20 && (
          <div className="flex items-center gap-3 p-4 bg-red-400/10 border border-red-400/30 rounded-xl text-sm text-red-400">
            <BatteryLow className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-semibold">Low Battery Warning ({battery}%)</span>
              <p className="text-red-400/80 text-xs mt-0.5">Please connect your device to a charger to maintain GPS tracking.</p>
            </div>
          </div>
        )}
      </main>

      {msg && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border z-50 ${
          msgType === 'success' ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30' : 'bg-red-400/20 text-red-400 border-red-400/30'
        }`}>
          {msg}
        </div>
      )}
    </div>
  );
}
