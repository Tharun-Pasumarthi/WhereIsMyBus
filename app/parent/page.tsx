'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/dashboard-nav';
import BusMap from '@/components/bus-map';
import {
  Bus, MapPin, Clock, Users, CheckCircle, Bell, BatteryLow, AlertTriangle,
  Navigation, RefreshCw, WifiOff, Wifi, XCircle, Shield
} from 'lucide-react';

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-400/10 border-red-400/30 text-red-400',
  warning: 'bg-primary/10 border-primary/30 text-primary',
  info: 'bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#0ea5e9]',
};

const ALERT_ICON: Record<string, any> = {
  sos_driver: Shield, sos_student: Shield, device_failure: XCircle,
  low_battery: BatteryLow, delay: Clock, geofence: MapPin, info: Bell,
};

export default function ParentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<{
    students: any[];
    buses: any[];
    stops: any[];
    attendance: any[];
    alerts: any[];
  }>({ students: [], buses: [], stops: [], attendance: [], alerts: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/'); return; }
      if (d.user.role !== 'parent') {
        const role = d.user.role;
        if (role === 'admin' || role === 'transport_head') router.replace('/admin');
        else if (role === 'driver') router.replace('/driver');
        else router.replace('/student');
        return;
      }
      setUser(d.user);
    });
  }, [router]);

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/parent/dashboard');
    if (res.ok) {
      const d = await res.json();
      setData(d);
      if (!selectedStudent && d.students.length > 0) {
        setSelectedStudent(d.students[0]?.id ?? null);
      }
    }
  }, [selectedStudent]);

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

  const currentStudent = data.students.find((s: any) => s.id === selectedStudent) ?? data.students[0];
  const studentRouteId = currentStudent?.route_id;
  const studentBus = data.buses.find((b: any) => b.route_id === studentRouteId);
  const studentAttendance = data.attendance.filter((a: any) => a.student_id === currentStudent?.id);
  const visibleStops = data.stops.filter((s: any) => s.route_id === studentRouteId);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Loading parent dashboard...</p>
      </div>
    </div>
  );

  const isConnected = studentBus?.tracking_status === 'connected';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {user && <DashboardNav user={user} />}

      <main className="flex-1 p-4 lg:p-6 max-w-6xl mx-auto w-full space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              Parent Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">Track your child's bus in real-time</p>
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

        {/* No children linked */}
        {data.students.length === 0 && (
          <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-semibold">No children linked to your account</p>
            <p className="text-muted-foreground text-sm mt-2">Contact your school administrator to link your account to your child.</p>
          </div>
        )}

        {data.students.length > 0 && (
          <>
            {/* Child selector (if multiple) */}
            {data.students.length > 1 && (
              <div className="flex gap-2">
                {data.students.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudent(s.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      selectedStudent === s.id
                        ? 'bg-purple-400/15 text-purple-400 border-purple-400/30'
                        : 'bg-muted text-muted-foreground border-border/50 hover:border-border'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            {/* Status cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Child's Name",
                  value: currentStudent?.name ?? '—',
                  icon: Users,
                  color: 'text-purple-400',
                  bg: 'bg-purple-400/10',
                },
                {
                  label: 'Bus Status',
                  value: studentBus ? (isConnected ? 'Live' : 'Offline') : 'No Bus',
                  icon: Bus,
                  color: studentBus ? (isConnected ? 'text-[#10b981]' : 'text-red-400') : 'text-muted-foreground',
                  bg: studentBus ? (isConnected ? 'bg-[#10b981]/10' : 'bg-red-400/10') : 'bg-muted',
                },
                {
                  label: 'Speed',
                  value: studentBus ? `${studentBus.current_speed || 0} km/h` : '—',
                  icon: Navigation,
                  color: 'text-[#0ea5e9]',
                  bg: 'bg-[#0ea5e9]/10',
                },
                {
                  label: 'Trips Today',
                  value: studentAttendance.length,
                  icon: CheckCircle,
                  color: 'text-[#10b981]',
                  bg: 'bg-[#10b981]/10',
                },
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

            {/* Live map + bus info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#10b981] pulse-dot' : 'bg-red-400'}`} />
                    <span className="text-sm font-semibold text-foreground">Live Bus Map</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Updates every 8s</span>
                </div>
                <div className="h-72">
                  <BusMap
                    buses={data.buses.map((b: any) => ({
                      id: b.id,
                      bus_number: b.bus_number,
                      route_name: b.route_name,
                      route_color: b.route_color,
                      current_lat: b.current_lat,
                      current_lng: b.current_lng,
                      current_speed: b.current_speed,
                      tracking_status: b.tracking_status,
                      driver_name: b.driver_name,
                    }))}
                    stops={visibleStops}
                    height="h-full"
                  />
                </div>
              </div>

              {/* Bus details */}
              <div className="bg-card rounded-xl border border-border/50 flex flex-col">
                <div className="px-4 py-3 border-b border-border/50">
                  <span className="text-sm font-semibold text-foreground">Bus Details</span>
                </div>
                <div className="p-4 flex-1">
                  {!studentBus ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-6">
                      <Bus className="w-10 h-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No active bus for your child's route</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                        isConnected ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 'bg-red-400/10 text-red-400 border-red-400/20'
                      }`}>
                        {isConnected ? <Wifi className="w-4 h-4 shrink-0" /> : <WifiOff className="w-4 h-4 shrink-0" />}
                        <span className="font-semibold">{isConnected ? 'GPS Signal Active' : 'GPS Signal Lost'}</span>
                      </div>

                      {[
                        { label: 'Bus Number', value: studentBus.bus_number },
                        { label: 'Route', value: studentBus.route_name },
                        { label: 'Speed', value: `${studentBus.current_speed || 0} km/h` },
                        { label: 'Battery', value: `${studentBus.battery_level ?? 100}%`, warn: (studentBus.battery_level ?? 100) < 20 },
                        { label: 'Last Update', value: timeAgo(studentBus.last_seen), warn: !isConnected },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className={`font-medium ${(row as any).warn ? 'text-red-400' : 'text-foreground'}`}>
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Attendance + Alerts in 2 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Child's boarding history */}
              <div className="bg-card rounded-xl border border-border/50">
                <div className="px-4 py-3 border-b border-border/50">
                  <span className="text-sm font-semibold text-foreground">
                    {currentStudent?.name}'s Boarding History
                  </span>
                </div>
                <div className="p-4">
                  {studentAttendance.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-6">No boarding records today</p>
                  ) : (
                    <div className="space-y-2">
                      {studentAttendance.slice(0, 8).map((rec: any) => (
                        <div key={rec.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
                              <CheckCircle className="w-3.5 h-3.5 text-[#10b981]" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground">{rec.bus_number ?? 'Bus'}</div>
                              <div className="text-xs text-muted-foreground">
                                {rec.route_name ?? ''}
                                {rec.stop_name ? ` · ${rec.stop_name}` : ''}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(rec.boarding_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Alerts */}
              <div className="bg-card rounded-xl border border-border/50">
                <div className="px-4 py-3 border-b border-border/50">
                  <span className="text-sm font-semibold text-foreground">Bus Alerts</span>
                </div>
                <div className="p-3 space-y-2">
                  {data.alerts.length === 0 ? (
                    <div className="text-center py-6">
                      <CheckCircle className="w-8 h-8 text-[#10b981] mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No active alerts</p>
                    </div>
                  ) : data.alerts.slice(0, 6).map((alert: any) => {
                    const Icon = ALERT_ICON[alert.type] ?? Bell;
                    return (
                      <div key={alert.id} className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info}`}>
                        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{alert.title}</div>
                          <div className="opacity-80 line-clamp-2 mt-0.5">{alert.message}</div>
                          <div className="opacity-60 mt-1">{timeAgo(alert.created_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
