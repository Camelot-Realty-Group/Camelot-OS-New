/**
 * BoroughCoverageMap — a real, zoomed-out map (Leaflet + CARTO tiles,
 * loaded from CDN at runtime — same zero-npm-dependency pattern as
 * RealNeighborhoodMap / QueensPresenceMap) of the NYC metro area,
 * with labeled markers highlighting where Camelot actively manages
 * buildings or is expanding. South Florida (Camelot's first
 * out-of-market engagement) is far outside this frame and is called
 * out as text below rather than forced onto the same zoom level.
 */

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    L?: any;
  }
}

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

let leafletLoadPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (typeof window !== 'undefined' && window.L) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;
  leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.body.appendChild(script);
  });
  return leafletLoadPromise;
}

interface CoverageArea {
  label: string;
  lat: number;
  lng: number;
}

const AREAS: CoverageArea[] = [
  { label: 'Manhattan', lat: 40.758, lng: -73.9855 },
  { label: 'Brooklyn', lat: 40.696, lng: -73.9936 },
  { label: 'Queens / LIC', lat: 40.7447, lng: -73.9485 },
  { label: 'Riverdale, Bronx', lat: 40.8875, lng: -73.9109 },
  { label: 'Westchester County', lat: 41.034, lng: -73.7629 },
  { label: 'New Jersey', lat: 40.7357, lng: -74.0431 },
];

export default function BoroughCoverageMap({ goldHex, navyHex }: { goldHex: string; navyHex: string }) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapDivRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapDivRef.current, { scrollWheelZoom: false, zoomControl: true });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);

    const bounds: [number, number][] = [];
    AREAS.forEach((a) => {
      bounds.push([a.lat, a.lng]);
      L.circleMarker([a.lat, a.lng], {
        radius: 14,
        color: navyHex,
        weight: 2,
        fillColor: goldHex,
        fillOpacity: 0.55,
      })
        .addTo(map)
        .bindTooltip(a.label, { permanent: true, direction: 'top', className: 'lafayette-map-tooltip' });
    });

    map.fitBounds(bounds, { padding: [50, 50] });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [ready, goldHex, navyHex]);

  if (failed) {
    return (
      <div className="w-full h-80 flex items-center justify-center text-sm border" style={{ background: '#F0EDE4', color: '#6b665c', borderColor: '#d9d2c2' }}>
        Map could not be loaded.
      </div>
    );
  }

  return (
    <div className="border" style={{ borderColor: '#d9d2c2' }}>
      <div ref={mapDivRef} className="w-full" style={{ height: '460px', background: '#f6f3ec' }} />
      <div className="px-4 py-3 text-[11px]" style={{ backgroundColor: '#faf8f3', color: '#6e6858' }}>
        Highlighted areas are where Camelot actively manages buildings or is expanding a presence. Camelot also
        manages Three Horizons East Condominium in North Miami, FL — its first South Florida engagement — well
        outside this map's frame. Map data © OpenStreetMap contributors, © CARTO.
      </div>
    </div>
  );
}
