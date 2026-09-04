/**
 * BoroughCoverageMap — a real, zoomed-out map (Leaflet + Esri Light Gray
 * Canvas tiles, loaded from CDN at runtime — same zero-npm-dependency
 * pattern as RealNeighborhoodMap / QueensPresenceMap) of the NYC metro
 * area, with labeled markers highlighting where Camelot actively
 * manages buildings, has a satellite office, or is expanding. South
 * Florida (Camelot's first out-of-market engagement) is far outside
 * this frame and is called out as its own marker with an inset note.
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

type AreaKind = 'core' | 'office' | 'expansion';

interface CoverageArea {
  label: string;
  detail: string;
  lat: number;
  lng: number;
  kind: AreaKind;
}

// Real neighborhoods/addresses named directly by David, not generic
// borough centroids where avoidable.
const AREAS: CoverageArea[] = [
  { label: 'Harlem to Lower Manhattan', detail: 'Full Manhattan corridor', lat: 40.7549, lng: -73.9840, kind: 'core' },
  { label: 'Brooklyn', detail: 'Brooklyn Heights and beyond', lat: 40.696, lng: -73.9936, kind: 'core' },
  { label: 'Queens / Long Island City', detail: 'LIC and Western Queens', lat: 40.7447, lng: -73.9485, kind: 'core' },
  { label: 'Riverdale, Bronx', detail: 'Riverdale portfolio', lat: 40.8875, lng: -73.9109, kind: 'core' },
  { label: 'Quaker Ridge, Scarsdale, NY', detail: 'Westchester County presence', lat: 40.9723, lng: -73.7649, kind: 'expansion' },
  { label: '501 Madison Ave, NYC', detail: 'Camelot executive office', lat: 40.7605, lng: -73.9733, kind: 'office' },
  { label: '57 W 57th St, NYC', detail: 'Camelot main office', lat: 40.7644, lng: -73.9765, kind: 'office' },
  { label: 'Florham Park, NJ', detail: 'Accounting & tax satellite office', lat: 40.7838, lng: -74.3824, kind: 'expansion' },
];

// South Florida is far outside the NYC-metro frame; called out separately
// rather than forcing an unusable zoom level onto the primary map.
const SOUTH_FLORIDA = {
  label: 'Three Horizons East, North Miami, FL',
  address: '12500 NE 15th Ave, North Miami, FL 33161',
  url: 'https://www.compass.com/building/three-horizons-east-north-miami-fl/756645226776466741/',
};

const KIND_COLOR: Record<AreaKind, (gold: string, navy: string) => { fill: string; stroke: string }> = {
  core: (gold, navy) => ({ fill: gold, stroke: navy }),
  office: (_gold, navy) => ({ fill: navy, stroke: '#9c7c46' }),
  expansion: (_gold, _navy) => ({ fill: '#1f6f6b', stroke: '#fff' }),
};

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

    // Esri World Light Gray Canvas — free, no API key required.
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ', maxZoom: 16 }
    ).addTo(map);
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 16, pane: 'shadowPane' }
    ).addTo(map);

    const bounds: [number, number][] = [];
    AREAS.forEach((a) => {
      bounds.push([a.lat, a.lng]);
      const { fill, stroke } = KIND_COLOR[a.kind](goldHex, navyHex);
      L.circleMarker([a.lat, a.lng], {
        radius: a.kind === 'office' ? 10 : 14,
        color: stroke,
        weight: 2,
        fillColor: fill,
        fillOpacity: 0.65,
      })
        .addTo(map)
        .bindTooltip(`${a.label} \u2014 ${a.detail}`, { permanent: true, direction: 'top', className: 'lafayette-map-tooltip' });
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
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px]" style={{ backgroundColor: '#faf8f3', color: '#6e6858' }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: goldHex, border: `2px solid ${navyHex}` }} />
          Core managed portfolio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: navyHex, border: '2px solid #9c7c46' }} />
          Camelot offices
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#1f6f6b', border: '2px solid #fff', boxShadow: '0 0 0 1px #1f6f6b' }} />
          Expanding presence
        </span>
      </div>
      <div className="px-4 pb-3 text-[11px]" style={{ backgroundColor: '#faf8f3', color: '#6e6858' }}>
        Also outside this frame: Camelot manages{' '}
        <a href={SOUTH_FLORIDA.url} target="_blank" rel="noreferrer" className="underline" style={{ color: goldHex }}>
          {SOUTH_FLORIDA.label}
        </a>{' '}
        ({SOUTH_FLORIDA.address}) — its first South Florida engagement, sometimes called the &ldquo;sixth borough.&rdquo; Map data © Esri, HERE, Garmin.
      </div>
    </div>
  );
}
