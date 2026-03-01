'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/dashboard-nav';
import BusMap from '@/components/bus-map';
import { useMultiRealtime } from '@/hooks/use-realtime';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Bus, Users, MapPin, Bell, AlertTriangle, CheckCircle, XCircle,
  Shield, Radio, BatteryLow, Clock, Navigation, BarChart2,
  Activity, RefreshCw, Eye, TrendingUp, Map, List, Download
} from 'lucide-react';

interface Stats {
  totalBuses: number; activeBuses: number; totalStudents: number;
  totalDrivers: number; totalRoutes: number; todayAttendance: number;
  unreadAlerts: number; criticalAlerts: number; recentTrips: any[];
}

interface Alert {
  id: number; type: string; title: string; message: string;
  bus_number: string; severity: string; is_read: number; created_at: string;
}

interface BusData {
  id: number; number: string; driver_name: string; route_name: string; route_color: string;
  active_trip_id: number | null; trip_status: string; tracking_status: string;
  current_lat: number | null; current_lng: number | null; current_speed: number;
  battery_level: number; last_seen: string; status: string;
}

interface StopData { id: number; name: string; lat: number; lng: number; route_id: number; }

const MOCK_CHART_DATA = [
  { time: '6AM', students: 12, trips: 1 },
  { time: '7AM', students: 38, trips: 3 },
  { time: '8AM', students: 82, trips: 3 },
  { time: '9AM', students: 45, trips: 2 },
  { time: '10AM', students: 18, trips: 1 },
  { time: '11AM', students: 8, trips: 1 },
  { time: '12PM', students: 22, trips: 2 },
  { time: '1PM', students: 55, trips: 3 },
  { time: '2PM', students: 40, trips: 2 },
  { time: '3PM', students: 28, trips: 2 },
  { time: '4PM', students: 65, trips: 3 },
  { time: '5PM', students: 90, trips: 3 },
];

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-400/10 border-red-400/30 text-red-400',
  warning: 'bg-primary/10 border-primary/30 text-primary',
  info: 'bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#0ea5e9]',
};

const ALERT_ICON: Record<string, any> = {
  sos_driver: Shield, sos_student: Shield, device_failure: XCircle,
  low_battery: BatteryLow, delay: Clock, geofence: MapPin, info: Bell,
};

type Tab = 'overview' | 'fleet' | 'alerts' | 'attendance';

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [buses, setBuses] = useState<BusData[]>([]);
  const [stops, setStops] = useState<StopData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/'); return; }
      if (d.user.role === 'student') { router.push('/student'); return; }
      if (d.user.role === 'driver') { router.push('/driver'); return; }
      if (d.user.role === 'parent') { router.push('/parent'); return; }
      setUser(d.user);
    });
  }, [router]);

  const fetchAll = useCallback(async () => {
    const [statsRes, busRes, routeRes, alertRes, attRes] = await Promise.all([
      fetch('/api/stats'), fetch('/api/buses'),
      fetch('/api/routes'), fetch('/api/alerts'),
      fetch('/api/attendance'),
    ]);
    const [statsData, busData, routeData, alertData, attData] = await Promise.all([
      statsRes.json(), busRes.json(), routeRes.json(), alertRes.json(), attRes.json()
    ]);
    setStats(statsData);
    setBuses(busData.buses || []);
    setStops(routeData.stops || []);
    setAlerts(alertData.alerts || []);
    setAttendance(attData.attendance || []);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
    // 30s fallback; Realtime drives instant updates
    const i = setInterval(fetchAll, 30_000);
    return () => clearInterval(i);
  }, [user, fetchAll]);

  // Realtime: refresh on any key table change
  useMultiRealtime(
    [{ table: 'trips' }, { table: 'locations', event: 'INSERT' }, { table: 'alerts', event: 'INSERT' }, { table: 'attendance', event: 'INSERT' }],
    () => { if (user) fetchAll(); },
    !!user
  );

  const markAlertRead = async (id: number) => {
    await fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: 1 } : a));
    if (stats) setStats(prev => prev ? { ...prev, unreadAlerts: Math.max(0, prev.unreadAlerts - 1) } : prev);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'fleet', label: 'Fleet', icon: Bus },
    { id: 'alerts', label: `Alerts${stats?.unreadAlerts ? ` (${stats.unreadAlerts})` : ''}`, icon: Bell },
    { id: 'attendance', label: 'Attendance', icon: Users },
  ];

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Loading admin dashboard...</p>
      </div>
    </div>
  );

  const activeBusesList = buses.filter(b => b.active_trip_id);
  const unreadAlerts = alerts.filter(a => !a.is_read);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {user && <DashboardNav user={user} unreadAlerts={stats?.unreadAlerts || 0} />}

      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 lg:px-6 py-4 lg:py-6 gap-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              Admin Control Center
            </h1>
            <p className="text-sm text-muted-foreground">Fleet-wide monitoring and management</p>
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active Buses', value: stats?.activeBuses ?? 0, total: stats?.totalBuses ?? 0, icon: Bus, color: 'text-primary', bg: 'bg-primary/10', suffix: `/${stats?.totalBuses}` },
            { label: 'Students Today', value: stats?.todayAttendance ?? 0, icon: Users, color: 'text-[#0ea5e9]', bg: 'bg-[#0ea5e9]/10' },
            { label: 'Unread Alerts', value: stats?.unreadAlerts ?? 0, icon: Bell, color: stats?.criticalAlerts ? 'text-red-400' : 'text-primary', bg: stats?.criticalAlerts ? 'bg-red-400/10' : 'bg-primary/10' },
            { label: 'Total Routes', value: stats?.totalRoutes ?? 0, icon: MapPin, color: 'text-[#10b981]', bg: 'bg-[#10b981]/10' },
          ].map(card => (
            <div key={card.label} className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground leading-none">
                  {card.value}{(card as any).suffix || ''}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1 border border-border/30">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-card text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Live Map */}
            <div className="lg:col-span-3 bg-card rounded-xl border border-border/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
                <div className="w-2 h-2 rounded-full bg-[#10b981] pulse-dot" />
                <span className="text-sm font-semibold text-foreground">Live Fleet Map</span>
                <span className="ml-auto text-xs text-muted-foreground">{activeBusesList.length} active</span>
              </div>
              <div className="h-72">
                <BusMap
                  buses={buses.map(b => ({
                    id: b.id, bus_number: b.number, route_name: b.route_name || '',
                    route_color: b.route_color || '#f59e0b', current_lat: b.current_lat,
                    current_lng: b.current_lng, current_speed: b.current_speed || 0,
                    tracking_status: b.tracking_status || 'disconnected',
                    driver_name: b.driver_name || '',
                  }))}
                  stops={stops}
                  height="h-full"
                />
              </div>
            </div>

            {/* Right Panel */}
            <div className="lg:col-span-2 space-y-4">
              {/* Active trips */}
              <div className="bg-card rounded-xl border border-border/50">
                <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Active Trips</span>
                  <span className="text-xs text-muted-foreground">{activeBusesList.length} running</span>
                </div>
                <div className="p-3 space-y-2 max-h-52 overflow-y-auto">
                  {activeBusesList.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No active trips</p>
                  ) : activeBusesList.map(bus => (
                    <div key={bus.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/30">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${bus.tracking_status === 'connected' ? 'bg-[#10b981] pulse-dot' : 'bg-red-400'}`} />
                        <div>
                          <div className="text-sm font-semibold text-foreground">{bus.number}</div>
                          <div className="text-xs text-muted-foreground">{bus.driver_name}</div>
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-foreground font-medium">{bus.current_speed || 0} km/h</div>
                        <div className="text-muted-foreground">{bus.route_name?.split(' - ')[0]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Critical Alerts */}
              <div className="bg-card rounded-xl border border-border/50">
                <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Recent Alerts</span>
                  <button onClick={() => setTab('alerts')} className="text-xs text-primary hover:underline">View all</button>
                </div>
                <div className="p-3 space-y-2 max-h-44 overflow-y-auto">
                  {alerts.slice(0, 4).map(alert => {
                    const Icon = ALERT_ICON[alert.type] || Bell;
                    return (
                      <div key={alert.id} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info} ${alert.is_read ? 'opacity-50' : ''}`}>
                        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{alert.title}</div>
                          <div className="opacity-80 line-clamp-1">{alert.message}</div>
                        </div>
                      </div>
                    );
                  })}
                  {alerts.length === 0 && <p className="text-muted-foreground text-sm text-center py-3">No alerts</p>}
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="lg:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card rounded-xl border border-border/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Student Boarding (Today)</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={MOCK_CHART_DATA}>
                    <defs>
                      <linearGradient id="studentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.78 0.17 70)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="oklch(0.78 0.17 70)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.04 265)" />
                    <XAxis dataKey="time" tick={{ fill: 'oklch(0.60 0.03 265)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'oklch(0.60 0.03 265)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'oklch(0.18 0.035 265)', border: '1px solid oklch(0.26 0.04 265)', borderRadius: 8, color: 'oklch(0.96 0.01 265)', fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="students" stroke="oklch(0.78 0.17 70)" strokeWidth={2} fill="url(#studentGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card rounded-xl border border-border/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-[#0ea5e9]" />
                  <span className="text-sm font-semibold text-foreground">Active Trips per Hour</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={MOCK_CHART_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.04 265)" />
                    <XAxis dataKey="time" tick={{ fill: 'oklch(0.60 0.03 265)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'oklch(0.60 0.03 265)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'oklch(0.18 0.035 265)', border: '1px solid oklch(0.26 0.04 265)', borderRadius: 8, color: 'oklch(0.96 0.01 265)', fontSize: 12 }}
                    />
                    <Bar dataKey="trips" fill="oklch(0.60 0.16 222)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Fleet Tab */}
        {tab === 'fleet' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {buses.map(bus => (
                <div key={bus.id} className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        bus.active_trip_id ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        <Bus className={`w-4 h-4 ${bus.active_trip_id ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="font-bold text-foreground text-sm">{bus.number}</div>
                        <div className="text-xs text-muted-foreground">{bus.driver_name || 'No driver'}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                      bus.active_trip_id
                        ? bus.tracking_status === 'connected' ? 'bg-[#10b981]/15 text-[#10b981]' : 'bg-red-400/15 text-red-400'
                        : bus.status === 'maintenance' ? 'bg-orange-400/15 text-orange-400' : 'bg-muted text-muted-foreground'
                    }`}>
                      {bus.active_trip_id ? (bus.tracking_status === 'connected' ? 'Live' : 'Lost') : (bus.status || 'Parked')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <div className="text-muted-foreground mb-0.5">Route</div>
                      <div className="text-foreground font-medium truncate">{bus.route_name?.split(' - ')[0] || 'N/A'}</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <div className="text-muted-foreground mb-0.5">Speed</div>
                      <div className="text-foreground font-medium">{bus.current_speed || 0} km/h</div>
                    </div>
                    {bus.active_trip_id && (
                      <>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="text-muted-foreground mb-0.5">Battery</div>
                          <div className={`font-medium ${(bus.battery_level || 100) < 20 ? 'text-red-400' : 'text-foreground'}`}>
                            {bus.battery_level || 100}%
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="text-muted-foreground mb-0.5">GPS</div>
                          <div className="text-foreground font-medium text-[10px] truncate">
                            {bus.current_lat?.toFixed(3)}, {bus.current_lng?.toFixed(3)}
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2 col-span-2">
                          <div className="text-muted-foreground mb-0.5">Last Update</div>
                          <div className={`font-medium text-[11px] ${
                            bus.tracking_status !== 'connected' ? 'text-red-400' : 'text-foreground'
                          }`}>
                            {timeAgo(bus.last_seen)}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {tab === 'alerts' && (
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
                <CheckCircle className="w-10 h-10 text-[#10b981] mx-auto mb-3" />
                <p className="text-foreground font-medium">No alerts</p>
                <p className="text-muted-foreground text-sm">System is running smoothly</p>
              </div>
            ) : alerts.map(alert => {
              const Icon = ALERT_ICON[alert.type] || Bell;
              return (
                <div key={alert.id} className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info} ${alert.is_read ? 'opacity-50' : ''}`}>
                  <div className="w-9 h-9 rounded-lg bg-current/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{alert.title}</span>
                      {alert.bus_number && (
                        <span className="text-[10px] bg-current/10 px-1.5 py-0.5 rounded font-mono">{alert.bus_number}</span>
                      )}
                      <span className="text-[10px] opacity-70 ml-auto">
                        {new Date(alert.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm opacity-80 mt-1 leading-relaxed">{alert.message}</p>
                  </div>
                  {!alert.is_read && (
                    <button
                      onClick={() => markAlertRead(alert.id)}
                      className="shrink-0 text-xs bg-current/15 hover:bg-current/25 px-2.5 py-1 rounded-lg font-medium transition-all"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Attendance Tab */}
        {tab === 'attendance' && (
          <div className="bg-card rounded-xl border border-border/50">
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">All Boarding Records ({attendance.length})</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">Last 100 records</span>
                <a
                  href="/api/attendance/export"
                  download
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 hover:bg-primary/5 rounded-lg px-2.5 py-1.5 transition-all"
                >
                  <Download className="w-3 h-3" />
                  Export CSV
                </a>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Student', 'Bus', 'Route', 'Stop', 'Time'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No attendance records</td></tr>
                  ) : attendance.map((rec: any) => (
                    <tr key={rec.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{rec.student_name}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground">{rec.bus_number}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{rec.route_name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{rec.stop_name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(rec.boarding_time + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
