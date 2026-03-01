'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/dashboard-nav';
import BusMap from '@/components/bus-map';
import {
  Bus, MapPin, Clock, Wifi, WifiOff, Battery, BatteryLow,
  QrCode, CheckCircle, AlertTriangle, RefreshCw, Navigation,
  Shield, Radio, ChevronRight, XCircle
} from 'lucide-react';

interface User { id: number; name: string; email: string; role: string; route_id: number | null; }
interface BusData {
  id: number; number: string; driver_name: string; route_name: string; route_color: string;
  active_trip_id: number | null; trip_status: string; tracking_status: string;
  current_lat: number | null; current_lng: number | null; current_speed: number;
  battery_level: number; last_seen: string; trip_start_time: string;
}
interface StopData { id: number; name: string; lat: number; lng: number; route_id: number; }

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function etaEstimate(bus: BusData): string {
  if (!bus.active_trip_id) return 'Not running';
  if (bus.tracking_status === 'disconnected') return 'Signal lost';
  const speed = bus.current_speed || 20;
  const minutes = Math.round((2.5 / (speed / 60)));
  return `~${minutes} min`;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [buses, setBuses] = useState<BusData[]>([]);
  const [stops, setStops] = useState<StopData[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qrTripId, setQrTripId] = useState<number | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInMsg, setCheckInMsg] = useState('');
  const [selectedBus, setSelectedBus] = useState<number | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null);
  const [scanMsg, setScanMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/'); return; }
      if (!['student'].includes(d.user.role)) { router.push('/admin'); return; }
      setUser(d.user);
    });
  }, [router]);

  const fetchData = useCallback(async () => {
    const [busRes, routeRes, attRes] = await Promise.all([
      fetch('/api/buses'),
      fetch('/api/routes'),
      fetch('/api/attendance'),
    ]);
    const [busData, routeData, attData] = await Promise.all([
      busRes.json(), routeRes.json(), attRes.json()
    ]);
    setBuses(busData.buses || []);
    setStops(routeData.stops || []);
    setAttendance(attData.attendance || []);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchData().finally(() => setLoading(false));
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [user, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const openScanner = () => {
    setScanResult(null);
    setScanMsg('');
    setScannerOpen(true);
  };

  const closeScanner = () => {
    setScannerOpen(false);
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  const handleQrScanned = async (qrDataStr: string) => {
    setCheckingIn(true);
    try {
      const res = await fetch('/api/qr/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_data: qrDataStr }),
      });
      const data = await res.json();
      if (res.ok) {
        setScanResult('success');
        setScanMsg(data.message || 'Checked in!');
        await fetchData();
        setTimeout(() => closeScanner(), 2500);
      } else if (res.status === 409) {
        // Already checked in = still a success state
        setScanResult('success');
        setScanMsg('Already checked in for this trip ✓');
        setTimeout(() => closeScanner(), 2500);
      } else {
        setScanResult('error');
        setScanMsg(data.error || 'Check-in failed. Try again.');
        // Restart scanning after showing error
        setTimeout(() => setScanResult(null), 2500);
      }
    } catch {
      setScanResult('error');
      setScanMsg('Network error. Please try again.');
      setTimeout(() => setScanResult(null), 2500);
    }
    setCheckingIn(false);
  };

  // Start camera when scanner opens
  useEffect(() => {
    if (!scannerOpen) return;
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; }
        setScanning(true);
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || !canvasRef.current || scanResult === 'success') return;
          const video = videoRef.current;
          if (video.readyState < video.HAVE_ENOUGH_DATA) return;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const jsQR = (await import('jsqr')).default;
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
            if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
            await handleQrScanned(code.data);
          }
        }, 350);
      })
      .catch(() => {
        setScanResult('error');
        setScanMsg('Camera access denied. Please allow camera permissions and try again.');
      });
    return () => {
      active = false;
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  const handleCheckIn = async (tripId: number) => {
    setCheckingIn(true);
    setCheckInMsg('');
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      });
      const data = await res.json();
      if (res.ok) { setCheckInMsg('Checked in successfully!'); await fetchData(); }
      else setCheckInMsg(data.error || 'Check-in failed');
    } catch { setCheckInMsg('Network error'); }
    finally { setCheckingIn(false); setTimeout(() => setCheckInMsg(''), 3000); }
  };

  const myBus = buses.find(b => b.id && user?.route_id ? true : false);
  const activeBuses = buses.filter(b => b.active_trip_id);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Loading your dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {user && <DashboardNav user={user} />}

      <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-sm text-muted-foreground">Track your bus in real-time</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-lg px-3 py-2 hover:bg-muted transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active Buses', value: activeBuses.length, icon: Bus, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'My Route', value: buses.find(b => b.route_name)?.route_name?.split(' ')[0] || 'N/A', icon: Navigation, color: 'text-[#0ea5e9]', bg: 'bg-[#0ea5e9]/10' },
            { label: 'ETA', value: activeBuses.length ? etaEstimate(activeBuses[0]) : 'N/A', icon: Clock, color: 'text-[#10b981]', bg: 'bg-[#10b981]/10' },
            { label: 'Trips Today', value: attendance.length, icon: CheckCircle, color: 'text-primary', bg: 'bg-primary/10' },
          ].map(card => (
            <div key={card.label} className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold text-foreground leading-none truncate">{card.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Map + Bus List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#10b981] pulse-dot" />
                  <span className="text-sm font-semibold text-foreground">Live Map</span>
                </div>
                <span className="text-xs text-muted-foreground">Auto-refreshes every 8s</span>
              </div>
              <div className="h-72 lg:h-80">
                <BusMap
                  buses={buses.map(b => ({
                    id: b.id, bus_number: b.number, route_name: b.route_name,
                    route_color: b.route_color, current_lat: b.current_lat,
                    current_lng: b.current_lng, current_speed: b.current_speed,
                    tracking_status: b.tracking_status || 'disconnected',
                    driver_name: b.driver_name,
                  }))}
                  stops={stops}
                  focusBusId={selectedBus}
                  height="h-full"
                />
              </div>
            </div>
          </div>

          {/* Bus List */}
          <div className="bg-card rounded-xl border border-border/50 flex flex-col">
            <div className="px-4 py-3 border-b border-border/50">
              <span className="text-sm font-semibold text-foreground">All Buses</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {buses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No buses found</div>
              ) : buses.map(bus => (
                <div
                  key={bus.id}
                  onClick={() => setSelectedBus(selectedBus === bus.id ? null : bus.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedBus === bus.id ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        bus.active_trip_id
                          ? bus.tracking_status === 'connected' ? 'bg-[#10b981] pulse-dot' : 'bg-red-400'
                          : 'bg-muted-foreground'
                      }`} />
                      <span className="font-semibold text-foreground text-sm">{bus.number}</span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      bus.active_trip_id
                        ? bus.tracking_status === 'connected' ? 'bg-[#10b981]/15 text-[#10b981]' : 'bg-red-400/15 text-red-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {bus.active_trip_id ? (bus.tracking_status === 'connected' ? 'Live' : 'Offline') : 'Parked'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>{bus.route_name || 'No Route'}</span>
                      <span className="text-foreground">{bus.current_speed || 0} km/h</span>
                    </div>
                    {bus.active_trip_id && (
                      <div className="flex items-center justify-between">
                        <span>Last seen: {timeAgo(bus.last_seen)}</span>
                        <div className="flex items-center gap-1">
                          <BatteryLow className="w-3 h-3" />
                          <span>{bus.battery_level}%</span>
                        </div>
                      </div>
                    )}
                    {bus.active_trip_id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openScanner(); }}
                        disabled={checkingIn}
                        className="w-full mt-1 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium flex items-center justify-center gap-1 border border-primary/20 transition-all"
                      >
                        <QrCode className="w-3 h-3" />
                        Scan QR to Check In
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {checkInMsg && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${
            checkInMsg.includes('success') ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30' : 'bg-red-400/20 text-red-400 border-red-400/30'
          }`}>
            {checkInMsg}
          </div>
        )}

        {/* Attendance History */}
        {attendance.length > 0 && (
          <div className="bg-card rounded-xl border border-border/50">
            <div className="px-4 py-3 border-b border-border/50">
              <span className="text-sm font-semibold text-foreground">My Boarding History</span>
            </div>
            <div className="p-4 space-y-2">
              {attendance.slice(0, 5).map((rec: any) => (
                <div key={rec.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-[#10b981]" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{rec.bus_number || 'Bus'}</div>
                      <div className="text-xs text-muted-foreground">{rec.route_name} {rec.stop_name ? `• ${rec.stop_name}` : ''}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    {new Date(rec.boarding_time + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* QR Scanner Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border/50 shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Scan QR to Check In</span>
              </div>
              <button onClick={closeScanner} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>

            {/* Camera viewport */}
            <div className="relative bg-black" style={{ aspectRatio: '1/1' }}>
              {scanResult === 'success' ? (
                <div className="flex items-center justify-center w-full h-full">
                  <div className="text-center space-y-3">
                    <CheckCircle className="w-20 h-20 text-[#10b981] mx-auto" />
                    <p className="text-[#10b981] font-bold text-lg">Checked In!</p>
                    <p className="text-[#10b981]/70 text-sm">{scanMsg}</p>
                  </div>
                </div>
              ) : (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  {/* Scan-area overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-56 h-56 relative">
                      <div className="absolute inset-0 border border-white/20 rounded-lg" />
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                      <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-primary/70 -translate-y-1/2 animate-pulse rounded-full" />
                    </div>
                  </div>
                  {scanResult === 'error' && (
                    <div className="absolute bottom-3 left-3 right-3 bg-red-500/95 rounded-xl px-4 py-3 text-white">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-sm">{scanMsg}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground text-center">
                {checkingIn
                  ? 'Verifying with server…'
                  : scanResult === 'success'
                  ? 'Closing automatically…'
                  : scanning
                  ? 'Point your camera at the QR code on the driver\u2019s phone'
                  : 'Starting camera…'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
