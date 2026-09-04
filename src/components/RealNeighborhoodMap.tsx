/**
 * RealNeighborhoodMap — an actual interactive street map (Leaflet +
 * CARTO Positron tiles, © OpenStreetMap contributors © CARTO), not a
 * schematic. Plots the subject property, Camelot's office, and a set
 * of nearby Camelot-portfolio buildings as color-coded, clickable
 * markers with popups, plus a dashed line from the office to the
 * subject property labeled with distance.
 */

import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapPoint {
  label: string;
  neighborhood: string;
  crossStreets?: string;
  lat: number;
  lng: number;
  number?: number;
}

interface RealNeighborhoodMapProps {
  subject: MapPoint;
  office: MapPoint;
  portfolio: MapPoint[];
  officeDistanceMiles: number;
  goldHex: string;
  navyHex: string;
}

function pinIcon(opts: { fill: string; stroke: string; size: number; label?: string; textColor?: string }) {
  const { fill, stroke, size, label, textColor = '#fff' } = opts;
  const html = `
    <div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${fill};border:2px solid ${stroke};
      box-shadow:0 1px 4px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-family:'Inter',sans-serif;font-weight:700;font-size:${Math.max(9, size * 0.4)}px;
      color:${textColor};
    ">${label ?? ''}</div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export default function RealNeighborhoodMap({
  subject,
  office,
  portfolio,
  officeDistanceMiles,
  goldHex,
  navyHex,
}: RealNeighborhoodMapProps) {
  const bounds = useMemo(() => {
    const pts: [number, number][] = [
      [subject.lat, subject.lng],
      ...portfolio.map((p): [number, number] => [p.lat, p.lng]),
    ];
    return L.latLngBounds(pts).pad(0.25);
  }, [subject, portfolio]);

  const subjectIcon = useMemo(() => pinIcon({ fill: goldHex, stroke: navyHex, size: 26, label: '★' }), [goldHex, navyHex]);
  const officeIcon = useMemo(() => pinIcon({ fill: navyHex, stroke: goldHex, size: 24, label: 'C' }), [goldHex, navyHex]);
  const portfolioIcon = (n: number) => pinIcon({ fill: '#ffffff', stroke: goldHex, size: 22, label: String(n), textColor: navyHex });

  return (
    <div className="border" style={{ borderColor: '#d9d2c2' }}>
      <MapContainer
        bounds={bounds}
        scrollWheelZoom={false}
        style={{ height: '560px', width: '100%', background: '#f6f3ec' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <Polyline
          positions={[[office.lat, office.lng], [subject.lat, subject.lng]]}
          pathOptions={{ color: goldHex, weight: 2, dashArray: '6,6' }}
        >
          <Tooltip direction="center" permanent opacity={0.95}>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>
              {officeDistanceMiles} mi to office
            </span>
          </Tooltip>
        </Polyline>

        <Marker position={[office.lat, office.lng]} icon={officeIcon}>
          <Popup>
            <strong>{office.label}</strong>
            <br />
            Camelot Realty Group — main office
          </Popup>
        </Marker>

        <Marker position={[subject.lat, subject.lng]} icon={subjectIcon}>
          <Popup>
            <strong>{subject.label}</strong>
            <br />
            {subject.neighborhood} — the subject property
          </Popup>
        </Marker>

        {portfolio.map((p) => (
          <Marker key={p.label} position={[p.lat, p.lng]} icon={portfolioIcon(p.number ?? 0)}>
            <Popup>
              <strong>{p.number}. {p.label}</strong>
              <br />
              {p.neighborhood}
              {p.crossStreets ? ` — ${p.crossStreets}` : ''}
              <br />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.label + ', New York, NY')}`}
                target="_blank"
                rel="noreferrer"
              >
                View on Google Maps →
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px]" style={{ backgroundColor: '#faf8f3', color: '#6e6858' }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: goldHex, border: `2px solid ${navyHex}` }} />
          Subject property
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: navyHex, border: `2px solid ${goldHex}` }} />
          Camelot office
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-white" style={{ border: `2px solid ${goldHex}` }} />
          Neighboring portfolio (click a pin)
        </span>
        <span className="ml-auto italic">Map data © OpenStreetMap contributors, © CARTO</span>
      </div>
    </div>
  );
}
