/**
 * BoroughCoverageMap — a real, zoomed-out Leaflet map (CARTO Positron
 * tiles) of the NYC metro area, with labeled markers highlighting the
 * boroughs and counties where Camelot actively manages buildings.
 * South Florida (Camelot's first out-of-market engagement) is well
 * outside this frame and is called out separately below the map
 * rather than forced onto the same zoom level.
 */

import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface CoverageArea {
  label: string;
  detail: string;
  lat: number;
  lng: number;
  active: boolean;
}

const AREAS: CoverageArea[] = [
  { label: 'Manhattan', detail: 'Core of the managed portfolio', lat: 40.758, lng: -73.9855, active: true },
  { label: 'Brooklyn', detail: 'Active management engagements', lat: 40.696, lng: -73.9936, active: true },
  { label: 'Queens / LIC', detail: 'Including Long Island City', lat: 40.7447, lng: -73.9485, active: true },
  { label: 'Riverdale, Bronx', detail: 'Expanding presence', lat: 40.8875, lng: -73.9109, active: true },
  { label: 'Westchester County', detail: 'Expanding presence', lat: 41.034, lng: -73.7629, active: true },
  { label: 'New Jersey', detail: 'Expanding presence', lat: 40.7357, lng: -74.0431, active: true },
];

export default function BoroughCoverageMap({ goldHex, navyHex }: { goldHex: string; navyHex: string }) {
  const bounds = useMemo(() => L.latLngBounds(AREAS.map((a): [number, number] => [a.lat, a.lng])).pad(0.3), []);

  return (
    <div className="border" style={{ borderColor: '#d9d2c2' }}>
      <MapContainer bounds={bounds} scrollWheelZoom={false} style={{ height: '460px', width: '100%', background: '#f6f3ec' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {AREAS.map((a) => (
          <CircleMarker
            key={a.label}
            center={[a.lat, a.lng]}
            radius={14}
            pathOptions={{ color: navyHex, weight: 2, fillColor: goldHex, fillOpacity: 0.55 }}
          >
            <Tooltip direction="top" permanent opacity={0.95}>
              <span style={{ fontSize: '11px', fontWeight: 700 }}>{a.label}</span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="px-4 py-3 text-[11px]" style={{ backgroundColor: '#faf8f3', color: '#6e6858' }}>
        Highlighted areas are where Camelot actively manages buildings or is expanding a presence. Camelot also
        manages Three Horizons East Condominium in North Miami, FL — its first South Florida engagement — well
        outside this map's frame. Map data © OpenStreetMap contributors, © CARTO.
      </div>
    </div>
  );
}
