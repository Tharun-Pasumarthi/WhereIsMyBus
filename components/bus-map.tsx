'use client';

import { useState } from 'react';

function timeAgo(ts?: string): string {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

interface BusPosition {
  id: number;
  bus_number: string;
  route_name: string;
  route_color: string;
  current_lat: number | null;
  current_lng: number | null;
  current_speed: number;
  tracking_status: string;
  driver_name: string;
  battery_level?: number;
  last_seen?: string;
}

interface Stop {
  id: number;
  name: string;
  lat: number;
  lng: number;
  route_id: number;
}

interface BusMapProps {
  buses: BusPosition[];
  stops?: Stop[];
  focusBusId?: number | null;
  height?: string;
}

const ROUTE_LINE_COLORS = ['#f59e0b', '#0ea5e9', '#10b981', '#8b5cf6', '#ef4444'];

export default function BusMap({ buses, stops = [], focusBusId, height = 'h-full' }: BusMapProps) {
  const [selected, setSelected] = useState<BusPosition | null>(null);

  const allPoints = [
    ...buses.filter(b => b.current_lat && b.current_lng).map(b => ({ lat: b.current_lat!, lng: b.current_lng! })),
    ...stops.map(s => ({ lat: s.lat, lng: s.lng })),
  ];

  const defaultCenter = { lat: 12.9400, lng: 77.6280 };
  const minLat = allPoints.length ? Math.min(...allPoints.map(p => p.lat)) - 0.005 : defaultCenter.lat - 0.02;
  const maxLat = allPoints.length ? Math.max(...allPoints.map(p => p.lat)) + 0.005 : defaultCenter.lat + 0.02;
  const minLng = allPoints.length ? Math.min(...allPoints.map(p => p.lng)) - 0.008 : defaultCenter.lng - 0.02;
  const maxLng = allPoints.length ? Math.max(...allPoints.map(p => p.lng)) + 0.008 : defaultCenter.lng + 0.02;

  const W = 800, H = 500;
  const toX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * W;
  const toY = (lat: number) => H - ((lat - minLat) / (maxLat - minLat)) * H;

  const routeGroups: Record<number, Stop[]> = {};
  stops.forEach(s => {
    if (!routeGroups[s.route_id]) routeGroups[s.route_id] = [];
    routeGroups[s.route_id].push(s);
  });

  return (
    <div className={`relative ${height} rounded-xl overflow-hidden border border-border/50 bg-[#0d1117]`}>
      <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none" style={{ opacity: 0.06 }}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ minHeight: 200 }}>
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
          </filter>
        </defs>

        {Object.entries(routeGroups).map(([routeId, routeStops], idx) => {
          const sorted = [...routeStops].sort((a, b) => (a as any).stop_order - (b as any).stop_order);
          if (sorted.length < 2) return null;
          const pts = sorted.map(s => `${toX(s.lng)},${toY(s.lat)}`).join(' ');
          return (
            <polyline
              key={routeId}
              points={pts}
              fill="none"
              stroke={ROUTE_LINE_COLORS[idx % ROUTE_LINE_COLORS.length]}
              strokeWidth="2"
              strokeOpacity="0.4"
              strokeDasharray="6,4"
            />
          );
        })}

        {stops.map(stop => {
          const x = toX(stop.lng);
          const y = toY(stop.lat);
          return (
            <g key={stop.id}>
              <circle cx={x} cy={y} r="5" fill="#1e2447" stroke="#0ea5e9" strokeWidth="1.5" strokeOpacity="0.8" />
              <circle cx={x} cy={y} r="2" fill="#0ea5e9" fillOpacity="0.9" />
              <text x={x + 8} y={y + 4} fontSize="8" fill="#94a3b8" fontFamily="system-ui">{stop.name}</text>
            </g>
          );
        })}

        {buses.filter(b => b.current_lat && b.current_lng).map(bus => {
          const x = toX(bus.current_lng!);
          const y = toY(bus.current_lat!);
          const isSelected = selected?.id === bus.id || focusBusId === bus.id;
          const isConnected = bus.tracking_status === 'connected';
          const busColor = isConnected ? '#f59e0b' : '#ef4444';
          return (
            <g key={bus.id} onClick={() => setSelected(isSelected ? null : bus)} style={{ cursor: 'pointer' }}>
              {isConnected && (
                <circle cx={x} cy={y} r={isSelected ? 22 : 18} fill={busColor} fillOpacity="0.12">
                  <animate attributeName="r" values={isSelected ? '22;28;22' : '18;24;18'} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.12;0.04;0.12" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <rect x={x - 10} y={y - 8} width="20" height="16" rx="4" fill={busColor} filter="url(#shadow)" />
              <rect x={x - 8} y={y - 6} width="6" height="5" rx="1" fill="rgba(0,0,0,0.3)" />
              <rect x={x + 2} y={y - 6} width="6" height="5" rx="1" fill="rgba(0,0,0,0.3)" />
              <rect x={x - 8} y={y + 1} width="16" height="4" rx="1" fill="rgba(0,0,0,0.2)" />
              <circle cx={x - 5} cy={y + 8} r="3" fill="#0d1117" stroke={busColor} strokeWidth="1" />
              <circle cx={x + 5} cy={y + 8} r="3" fill="#0d1117" stroke={busColor} strokeWidth="1" />
              <rect x={x - 14} y={y - 22} width="28" height="11" rx="3" fill="#1e2447" stroke={busColor} strokeWidth="0.8" fillOpacity="0.95" />
              <text x={x} y={y - 14} fontSize="7" fill={busColor} textAnchor="middle" fontWeight="bold" fontFamily="system-ui">
                {bus.bus_number.split('-').pop()}
              </text>
            </g>
          );
        })}
      </svg>

      {selected && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-64 bg-card/95 backdrop-blur-sm border border-primary/30 rounded-xl p-4 shadow-xl z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${selected.tracking_status === 'connected' ? 'bg-[#10b981]' : 'bg-red-400'}`} />
              <span className="font-bold text-foreground text-sm">{selected.bus_number}</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Route</span><span className="text-foreground">{selected.route_name}</span></div>
            <div className="flex justify-between"><span>Driver</span><span className="text-foreground">{selected.driver_name || 'N/A'}</span></div>
            <div className="flex justify-between"><span>Speed</span><span className="text-foreground">{selected.current_speed} km/h</span></div>
            {selected.battery_level != null && (
              <div className="flex justify-between"><span>Battery</span><span className="text-foreground">{selected.battery_level}%</span></div>
            )}
            {selected.last_seen && (
              <div className="flex justify-between"><span>Last seen</span><span className="text-foreground">{timeAgo(selected.last_seen)}</span></div>
            )}
            <div className="flex justify-between">
              <span>Status</span>
              <span className={selected.tracking_status === 'connected' ? 'text-[#10b981]' : 'text-red-400'}>
                {selected.tracking_status === 'connected' ? 'Live' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-2.5 py-1 text-xs font-medium text-foreground pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse inline-block" />
        {buses.filter(b => b.tracking_status === 'connected').length} live
      </div>

      <div className="absolute top-3 right-3 z-10 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 text-xs space-y-1 pointer-events-none">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block" />Live Bus</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Disconnected</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#0ea5e9] inline-block" />Stop</div>
      </div>
    </div>
  );
}
