/**
 * RealNeighborhoodMap — a real, labeled street map (Leaflet + Esri Light
 * Gray Canvas tiles — free, no API key required), matching the same
 * runtime-CDN-loaded pattern as QueensPresenceMap.tsx (Oak Park pitch) so
 * this page adds zero new npm build dependencies. Plots the subject
 * property, Camelot's two Manhattan offices, and nearby Camelot-portfolio
 * buildings as color-coded, clickable pins with popups, plus dashed
 * distance lines from each office to the subject property.
 *
 * Hover-to-highlight: pass `highlightedIndex` (the portfolio array index
 * to visually emphasize) and the corresponding marker pulses/enlarges —
 * driven by hovering the property table rendered below the map.
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
  secondOffice?: MapPoint;
  portfolio: MapPoint[];
  officeDistanceMiles: number;
  secondOfficeDistanceMiles?: number;
  goldHex: string;
  navyHex: string;
  highlightedIndex?: number | null;
}

// Distinct, colorblind-safe marker palette:
//   subject property -> gold star
//   57 West 57th St (main office) -> navy "C"
//   501 Madison Ave (executive office) -> deep teal "E"
//   neighboring portfolio -> cream/gold numbered pins
const TEAL = '#1f6f6b';

export default function RealNeighborhoodMap({
  subject,
  office,
  secondOffice,
  portfolio,
  officeDistanceMiles,
  secondOfficeDistanceMiles,
  goldHex,
  navyHex,
  highlightedIndex,
}: RealNeighborhoodMapProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
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

    // Esri World Light Gray Canvas — free, no API key required.
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 16,
      }
    ).addTo(map);
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 16, pane: 'shadowPane' }
    ).addTo(map);

    const subjectIcon = L.divIcon({
      html: `<div style="width:28px;height:28px;border-radius:50%;background:${goldHex};border:2px solid ${navyHex};box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;">&#9733;</div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const officeIcon = L.divIcon({
      html: `<div style="width:24px;height:24px;border-radius:50%;background:${navyHex};border:2px solid ${goldHex};box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:${goldHex};font-weight:700;font-size:12px;font-family:Georgia,serif;">C</div>`,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    const secondOfficeIcon = L.divIcon({
      html: `<div style="width:22px;height:22px;border-radius:50%;background:${TEAL};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:11px;font-family:Georgia,serif;">E</div>`,
      className: '',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const portfolioIcon = (n: number, active = false) =>
      L.divIcon({
        html: `<div style="width:${active ? 28 : 22}px;height:${active ? 28 : 22}px;border-radius:50%;background:${active ? goldHex : '#fff'};border:2px solid ${goldHex};box-shadow:0 1px ${active ? 8 : 4}px rgba(0,0,0,${active ? 0.45 : 0.3});display:flex;align-items:center;justify-content:center;color:${active ? '#fff' : navyHex};font-weight:700;font-size:${active ? 12 : 11}px;transition:all .15s ease;">${n}</div>`,
        className: '',
        iconSize: [active ? 28 : 22, active ? 28 : 22],
        iconAnchor: [active ? 14 : 11, active ? 14 : 11],
      });

    const bounds: [number, number][] = [[subject.lat, subject.lng], [office.lat, office.lng]];

    L.polyline(
      [[office.lat, office.lng], [subject.lat, subject.lng]],
      { color: navyHex, weight: 2, opacity: 0.7, dashArray: '6,6' }
    ).addTo(map).bindTooltip(`${officeDistanceMiles} mi to 57 W 57th`, { permanent: true, direction: 'center', className: 'lafayette-map-tooltip' });

    L.marker([office.lat, office.lng], { icon: officeIcon })
      .addTo(map)
      .bindPopup(`<strong>${office.label}</strong><br/>Camelot Realty Group \u2014 main office`);

    if (secondOffice) {
      bounds.push([secondOffice.lat, secondOffice.lng]);
      L.polyline(
        [[secondOffice.lat, secondOffice.lng], [subject.lat, subject.lng]],
        { color: TEAL, weight: 2, opacity: 0.6, dashArray: '3,7' }
      ).addTo(map).bindTooltip(
        secondOfficeDistanceMiles ? `${secondOfficeDistanceMiles} mi to 501 Madison` : '501 Madison Ave',
        { permanent: false, direction: 'top', className: 'lafayette-map-tooltip' }
      );
      L.marker([secondOffice.lat, secondOffice.lng], { icon: secondOfficeIcon })
        .addTo(map)
        .bindPopup(`<strong>${secondOffice.label}</strong><br/>Camelot Realty Group \u2014 executive office`);
    }

    L.marker([subject.lat, subject.lng], { icon: subjectIcon })
      .addTo(map)
      .bindPopup(`<strong>${subject.label}</strong><br/>${subject.neighborhood} \u2014 the subject property`);

    markerRefs.current = [];
    portfolio.forEach((p, idx) => {
      bounds.push([p.lat, p.lng]);
      const marker = L.marker([p.lat, p.lng], { icon: portfolioIcon(p.number ?? 0) })
        .addTo(map)
        .bindPopup(
          `<strong>${p.number}. ${p.label}</strong><br/>${p.neighborhood}${p.crossStreets ? ` \u2014 ${p.crossStreets}` : ''}<br/><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.label + ', New York, NY')}" target="_blank" rel="noreferrer">View on Google Maps &rarr;</a>`
        );
      markerRefs.current[idx] = marker;
    });

    map.fitBounds(bounds, { padding: [40, 40] });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [ready, subject, office, secondOffice, portfolio, officeDistanceMiles, secondOfficeDistanceMiles, goldHex, navyHex]);

  // Hover-highlight: re-render the hovered marker's icon larger/gold, and reopen its popup.
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    markerRefs.current.forEach((marker, idx) => {
      if (!marker) return;
      const p = portfolio[idx];
      const active = idx === highlightedIndex;
      marker.setIcon(
        L.divIcon({
          html: `<div style="width:${active ? 28 : 22}px;height:${active ? 28 : 22}px;border-radius:50%;background:${active ? goldHex : '#fff'};border:2px solid ${goldHex};box-shadow:0 1px ${active ? 8 : 4}px rgba(0,0,0,${active ? 0.45 : 0.3});display:flex;align-items:center;justify-content:center;color:${active ? '#fff' : navyHex};font-weight:700;font-size:${active ? 12 : 11}px;transition:all .15s ease;">${p?.number ?? ''}</div>`,
          className: '',
          iconSize: [active ? 28 : 22, active ? 28 : 22],
          iconAnchor: [active ? 14 : 11, active ? 14 : 11],
        })
      );
      if (active) marker.openPopup();
    });
  }, [highlightedIndex, portfolio, goldHex, navyHex]);

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
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[11px]" style={{ backgroundColor: '#faf8f3', color: '#6e6858' }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: goldHex, border: `2px solid ${navyHex}` }} />
          Subject property
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: navyHex, border: `2px solid ${goldHex}` }} />
          57 West 57th St (main office)
        </span>
        {secondOffice && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: TEAL, border: '2px solid #fff', boxShadow: `0 0 0 1px ${TEAL}` }} />
            501 Madison Ave (executive office)
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-white" style={{ border: `2px solid ${goldHex}` }} />
          Neighboring portfolio — hover a row below or click a pin
        </span>
        <span className="ml-auto italic">Map data © Esri, HERE, Garmin</span>
      </div>
    </div>
  );
}
