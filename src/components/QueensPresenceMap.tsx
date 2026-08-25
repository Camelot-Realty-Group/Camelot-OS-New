/**
 * QueensPresenceMap — a small self-contained Leaflet map showing the
 * subject property alongside Camelot's other managed buildings in
 * Queens. Leaflet is loaded from a CDN at runtime (script/link tags
 * injected on mount) rather than as an npm dependency, so this
 * component adds zero new build-time dependencies or lockfile risk.
 */

import { useEffect, useRef, useState } from 'react';
import type { QueensPortfolioBuilding } from '@/lib/pitches/oak-park-douglaston';

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

interface QueensPresenceMapProps {
  center: { lat: number; lon: number };
  centerLabel: string;
  buildings: QueensPortfolioBuilding[];
  goldHex: string;
  navyHex: string;
}

export default function QueensPresenceMap({ center, centerLabel, buildings, goldHex, navyHex }: QueensPresenceMapProps) {
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

    const map = L.map(mapDivRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    const subjectIcon = L.divIcon({
      html: `<div style="background:${navyHex};border:3px solid ${goldHex};width:22px;height:22px;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
      className: '',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const buildingIcon = L.divIcon({
      html: `<div style="background:${goldHex};border:2px solid #fff;width:14px;height:14px;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>`,
      className: '',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    const bounds: [number, number][] = [[center.lat, center.lon]];

    L.marker([center.lat, center.lon], { icon: subjectIcon })
      .addTo(map)
      .bindPopup(`<strong>${centerLabel}</strong><br/>Subject property`);

    buildings.forEach((b) => {
      bounds.push([b.lat, b.lon]);
      L.polyline([[center.lat, center.lon], [b.lat, b.lon]], {
        color: goldHex,
        weight: 1,
        opacity: 0.45,
        dashArray: '4,5',
      }).addTo(map);
      L.marker([b.lat, b.lon], { icon: buildingIcon })
        .addTo(map)
        .bindPopup(
          `<strong>${b.entity}</strong><br/>${b.address}<br/>${b.units} units &middot; ${b.type}<br/><em>${b.distanceMiles} mi from subject property</em>`
        );
    });

    map.fitBounds(bounds, { padding: [40, 40] });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [ready, center, centerLabel, buildings, goldHex, navyHex]);

  if (failed) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-sm" style={{ background: '#F0EDE4', color: '#6b665c' }}>
        Map could not be loaded. See the table below for portfolio details.
      </div>
    );
  }

  return <div ref={mapDivRef} className="w-full h-96 rounded" style={{ background: '#F0EDE4' }} />;
}
