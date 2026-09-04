/**
 * RealNeighborhoodMap — a real, labeled street map (Leaflet + CARTO
 * Positron tiles), matching the same runtime-CDN-loaded pattern as
 * QueensPresenceMap.tsx (Oak Park pitch) so this page adds zero new
 * npm build dependencies. Plots the subject property, Camelot's
 * office, and nearby Camelot-portfolio buildings as color-coded,
 * clickable pins with popups, plus a dashed line + distance label
 * from the office to the subject property.
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

export default function RealNeighborhoodMap({
  subject,
  office,
  portfolio,
  officeDistanceMiles,
  goldHex,
  navyHex,
}: RealNeighborhoodMapProps) {
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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    const subjectIcon = L.divIcon({
      html: `<div style="width:26px;height:26px;border-radius:50%;background:${goldHex};border:2px solid ${navyHex};box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;">&#9733;</div>`,
      className: '',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    const officeIcon = L.divIcon({
      html: `<div style="width:24px;height:24px;border-radius:50%;background:${navyHex};border:2px solid ${goldHex};box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:${goldHex};font-weight:700;font-size:12px;font-family:Georgia,serif;">C</div>`,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    const portfolioIcon = (n: number) =>
      L.divIcon({
        html: `<div style="width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid ${goldHex};box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:${navyHex};font-weight:700;font-size:11px;">${n}</div>`,
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

    const bounds: [number, number][] = [[subject.lat, subject.lng], [office.lat, office.lng]];

    L.polyline(
      [[office.lat, office.lng], [subject.lat, subject.lng]],
      { color: goldHex, weight: 2, opacity: 0.8, dashArray: '6,6' }
    ).addTo(map).bindTooltip(`${officeDistanceMiles} mi to office`, { permanent: true, direction: 'center', className: 'lafayette-map-tooltip' });

    L.marker([office.lat, office.lng], { icon: officeIcon })
      .addTo(map)
      .bindPopup(`<strong>${office.label}</strong><br/>Camelot Realty Group — main office`);

    L.marker([subject.lat, subject.lng], { icon: subjectIcon })
      .addTo(map)
      .bindPopup(`<strong>${subject.label}</strong><br/>${subject.neighborhood} — the subject property`);

    portfolio.forEach((p) => {
      bounds.push([p.lat, p.lng]);
      L.marker([p.lat, p.lng], { icon: portfolioIcon(p.number ?? 0) })
        .addTo(map)
        .bindPopup(
          `<strong>${p.number}. ${p.label}</strong><br/>${p.neighborhood}${p.crossStreets ? ` — ${p.crossStreets}` : ''}<br/><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.label + ', New York, NY')}" target="_blank" rel="noreferrer">View on Google Maps &rarr;</a>`
        );
    });

    map.fitBounds(bounds, { padding: [40, 40] });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [ready, subject, office, portfolio, officeDistanceMiles, goldHex, navyHex]);

  if (failed) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-sm border" style={{ background: '#F0EDE4', color: '#6b665c', borderColor: '#d9d2c2' }}>
        Map could not be loaded. See the address list below for details.
      </div>
    );
  }

  return (
    <div className="border" style={{ borderColor: '#d9d2c2' }}>
      <div ref={mapDivRef} className="w-full" style={{ height: '560px', background: '#f6f3ec' }} />
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
