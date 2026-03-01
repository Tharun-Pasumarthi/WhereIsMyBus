'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLoadScript, GoogleMap, MarkerF, InfoWindowF, PolylineF } from '@react-google-maps/api';

const MAP_LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];
const DEFAULT_CENTER = { lat: 12.9400, lng: 77.6280 };

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8892b0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#232946' }] },
  { featureType: 'landscape', stylers: [{ color: '#161b22' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#21262d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#30363d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6e7681' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2d333b' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#444c56' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#30363d' }] },
];

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

const ROUTE_COLORS = ['#f59e0b', '#0ea5e9', '#10b981', '#8b5cf6', '#ef4444'];

function makeBusIcon(isConnected: boolean, color: string): google.maps.Symbol {
  return {
    path: 'M-9,-14 L9,-14 Q11,-14 11,-12 L11,8 Q11,10 9,10 L7,10 L7,14 L3,14 L3,10 L-3,10 L-3,14 L-7,14 L-7,10 L-9,10 Q-11,10 -11,8 L-11,-12 Q-11,-14 -9,-14 Z M-8,-9 L8,-9 L8,-2 L-8,-2 Z',
    fillColor: isConnected ? color : '#6e7681',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 1.5,
    scale: 1.1,
    anchor: new google.maps.Point(0, 0),
  };
}

function makeStopIcon(): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: '#f59e0b',
    fillOpacity: 0.9,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 6,
  };
}

export default function BusMap({ buses, stops = [], focusBusId, height = 'h-full' }: BusMapProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: MAP_LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Pan to focused bus
  useEffect(() => {
    if (!mapRef.current || focusBusId == null) return;
    const bus = buses.find(b => b.id === focusBusId);
    if (bus?.current_lat && bus?.current_lng) {
      mapRef.current.panTo({ lat: bus.current_lat, lng: bus.current_lng });
      mapRef.current.setZoom(16);
    }
  }, [focusBusId, buses]);

  // Auto-fit all buses into view
  useEffect(() => {
    if (!mapRef.current || !isLoaded || focusBusId != null) return;
    const valid = buses.filter(b => b.current_lat && b.current_lng);
    if (valid.length === 0) return;
    if (valid.length === 1) {
      mapRef.current.panTo({ lat: valid[0].current_lat!, lng: valid[0].current_lng! });
      mapRef.current.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    valid.forEach(b => bounds.extend({ lat: b.current_lat!, lng: b.current_lng! }));
    stops.forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }));
    mapRef.current.fitBounds(bounds, 60);
  }, [buses, stops, isLoaded, focusBusId]);

  // Group stops by route for polylines
  const routeGroups: Record<number, Stop[]> = {};
  stops.forEach(s => {
    if (!routeGroups[s.route_id]) routeGroups[s.route_id] = [];
    routeGroups[s.route_id].push(s);
  });

  const selectedBus = buses.find(b => b.id === selectedBusId) ?? null;
  const selectedStop = stops.find(s => s.id === selectedStopId) ?? null;

  if (loadError) {
    return (
      <div className={`${height} flex items-center justify-center rounded-xl bg-card border border-border/50`}>
        <div className="text-center space-y-1 p-6">
          <p className="text-sm font-medium text-red-400">Map failed to load</p>
          <p className="text-xs text-muted-foreground">Verify NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${height} flex items-center justify-center rounded-xl bg-card border border-border/50`}>
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Loading map…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${height} rounded-xl overflow-hidden border border-border/50`}>
      <GoogleMap
        mapContainerClassName="w-full h-full"
        center={DEFAULT_CENTER}
        zoom={13}
        onLoad={onMapLoad}
        options={{
          styles: DARK_STYLE,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
        }}
        onClick={() => { setSelectedBusId(null); setSelectedStopId(null); }}
      >
        {/* Route polylines */}
        {Object.entries(routeGroups).map(([routeId, routeStops], idx) => (
          <PolylineF
            key={`route-${routeId}`}
            path={routeStops.map(s => ({ lat: s.lat, lng: s.lng }))}
            options={{
              strokeColor: ROUTE_COLORS[idx % ROUTE_COLORS.length],
              strokeOpacity: 0.7,
              strokeWeight: 4,
              geodesic: true,
            }}
          />
        ))}

        {/* Stop markers */}
        {stops.map(stop => (
          <MarkerF
            key={`stop-${stop.id}`}
            position={{ lat: stop.lat, lng: stop.lng }}
            icon={makeStopIcon()}
            title={stop.name}
            onClick={() => { setSelectedStopId(stop.id); setSelectedBusId(null); }}
          />
        ))}

        {/* Bus markers */}
        {buses
          .filter(b => b.current_lat && b.current_lng)
          .map(bus => (
            <MarkerF
              key={`bus-${bus.id}`}
              position={{ lat: bus.current_lat!, lng: bus.current_lng! }}
              icon={makeBusIcon(bus.tracking_status === 'connected', bus.route_color || '#f59e0b')}
              title={`Bus ${bus.bus_number}`}
              onClick={() => { setSelectedBusId(bus.id); setSelectedStopId(null); }}
            />
          ))}

        {/* Bus info window */}
        {selectedBus?.current_lat && selectedBus?.current_lng && (
          <InfoWindowF
            position={{ lat: selectedBus.current_lat, lng: selectedBus.current_lng }}
            onCloseClick={() => setSelectedBusId(null)}
            options={{ pixelOffset: new google.maps.Size(0, -22) }}
          >
            <div style={{ background: '#1a1a2e', color: '#e6edf3', padding: '10px 14px', borderRadius: 8, minWidth: 180, fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🚌 Bus {selectedBus.bus_number}</div>
              <div style={{ color: '#8892b0', fontSize: 12, marginBottom: 6 }}>{selectedBus.route_name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                <span>Speed: <b>{selectedBus.current_speed ?? 0} km/h</b></span>
                {selectedBus.battery_level != null && <span>Battery: <b>{selectedBus.battery_level}%</b></span>}
                <span style={{ color: selectedBus.tracking_status === 'connected' ? '#10b981' : '#ef4444' }}>
                  ● {selectedBus.tracking_status === 'connected' ? 'Live' : 'Disconnected'}
                </span>
                {selectedBus.last_seen && (
                  <span style={{ color: '#6e7681', fontSize: 11 }}>Updated {timeAgo(selectedBus.last_seen)}</span>
                )}
              </div>
            </div>
          </InfoWindowF>
        )}

        {/* Stop info window */}
        {selectedStop && (
          <InfoWindowF
            position={{ lat: selectedStop.lat, lng: selectedStop.lng }}
            onCloseClick={() => setSelectedStopId(null)}
          >
            <div style={{ background: '#1a1a2e', color: '#e6edf3', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>📍 {selectedStop.name}</div>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>

      {/* Live badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-2.5 py-1 text-xs font-medium text-foreground pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse inline-block" />
        {buses.filter(b => b.tracking_status === 'connected').length} live
      </div>
    </div>
  );
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

// SVG-based map using relative coordinates with a stylized grid
export default function BusMap({ buses, stops = [], focusBusId, height = 'h-full' }: BusMapProps) {
  const [selected, setSelected] = useState<BusPosition | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, zoom: 1 });

  // Calculate bounding box for all points
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

  // Group stops by route
  const routeColors: Record<number, string> = {};
  stops.forEach(s => {
    if (!routeColors[s.route_id]) {
      routeColors[s.route_id] = '#f59e0b';
    }
  });

  const routeGroups: Record<number, Stop[]> = {};
  stops.forEach(s => {
    if (!routeGroups[s.route_id]) routeGroups[s.route_id] = [];
    routeGroups[s.route_id].push(s);
  });

  const routeLineColors = ['#f59e0b', '#0ea5e9', '#10b981'];

  return (
    <div className={`relative ${height} map-container rounded-xl overflow-hidden border border-border/50`}>
      {/* Grid overlay */}
      <svg width="100%" height="100%" className="absolute inset-0" style={{ opacity: 0.06 }}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-foreground" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Main SVG Map */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ minHeight: 200 }}>
        <defs>
          <radialGradient id="busGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Route lines */}
        {Object.entries(routeGroups).map(([routeId, routeStops], idx) => {
          const sorted = [...routeStops].sort((a, b) => (a as any).stop_order - (b as any).stop_order);
          if (sorted.length < 2) return null;
          const pts = sorted.map(s => `${toX(s.lng)},${toY(s.lat)}`).join(' ');
          return (
            <polyline
              key={routeId}
              points={pts}
              fill="none"
              stroke={routeLineColors[idx % routeLineColors.length]}
              strokeWidth="2"
              strokeOpacity="0.35"
              strokeDasharray="6,4"
            />
          );
        })}

        {/* Stops */}
        {stops.map((stop, idx) => {
          const x = toX(stop.lng);
          const y = toY(stop.lat);
          return (
            <g key={stop.id}>
              <circle cx={x} cy={y} r="5" fill="#1e2447" stroke="#0ea5e9" strokeWidth="1.5" strokeOpacity="0.7" />
              <circle cx={x} cy={y} r="2" fill="#0ea5e9" fillOpacity="0.8" />
              <text x={x + 8} y={y + 4} fontSize="8" fill="#94a3b8" fontFamily="system-ui">{stop.name}</text>
            </g>
          );
        })}

        {/* Buses */}
        {buses.filter(b => b.current_lat && b.current_lng).map((bus, idx) => {
          const x = toX(bus.current_lng!);
          const y = toY(bus.current_lat!);
          const isSelected = selected?.id === bus.id || focusBusId === bus.id;
          const isConnected = bus.tracking_status === 'connected';
          const busColor = isConnected ? '#f59e0b' : '#ef4444';

          return (
            <g key={bus.id} onClick={() => setSelected(isSelected ? null : bus)} style={{ cursor: 'pointer' }}>
              {/* Pulse ring */}
              {isConnected && (
                <circle cx={x} cy={y} r={isSelected ? 22 : 18} fill={busColor} fillOpacity="0.12">
                  <animate attributeName="r" values={isSelected ? '22;28;22' : '18;24;18'} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.12;0.04;0.12" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Bus icon body */}
              <rect x={x - 10} y={y - 8} width="20" height="16" rx="4" fill={busColor} filter="url(#shadow)" />
              <rect x={x - 8} y={y - 6} width="6" height="5" rx="1" fill="rgba(0,0,0,0.3)" />
              <rect x={x + 2} y={y - 6} width="6" height="5" rx="1" fill="rgba(0,0,0,0.3)" />
              <rect x={x - 8} y={y + 1} width="16" height="4" rx="1" fill="rgba(0,0,0,0.2)" />
              {/* Wheels */}
              <circle cx={x - 5} cy={y + 8} r="3" fill="#1e2447" stroke={busColor} strokeWidth="1" />
              <circle cx={x + 5} cy={y + 8} r="3" fill="#1e2447" stroke={busColor} strokeWidth="1" />
              {/* Bus number label */}
              <rect x={x - 14} y={y - 22} width="28" height="11" rx="3" fill="#1e2447" stroke={busColor} strokeWidth="0.8" fillOpacity="0.9" />
              <text x={x} y={y - 14} fontSize="7" fill={busColor} textAnchor="middle" fontWeight="bold" fontFamily="system-ui">
                {bus.bus_number.split('-').pop()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Selected bus tooltip */}
      {selected && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-64 bg-card/95 backdrop-blur-sm border border-primary/30 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${selected.tracking_status === 'connected' ? 'bg-[#10b981]' : 'bg-red-400'}`} />
              <span className="font-bold text-foreground text-sm">{selected.bus_number}</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Route</span><span className="text-foreground">{selected.route_name}</span>
            </div>
            <div className="flex justify-between">
              <span>Driver</span><span className="text-foreground">{selected.driver_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Speed</span><span className="text-foreground">{selected.current_speed} km/h</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span className={selected.tracking_status === 'connected' ? 'text-[#10b981]' : 'text-red-400'}>
                {selected.tracking_status === 'connected' ? 'Live' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-3 left-3 bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 text-xs space-y-1">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block" />Live Bus</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Disconnected</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#0ea5e9] inline-block" />Stop</div>
      </div>
    </div>
  );
}
