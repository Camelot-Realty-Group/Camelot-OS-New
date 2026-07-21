import { GOOGLE_MAPS_KEY } from '@/lib/maps-key';
/**
 * Building Photo Finder — Scout Bot (CamelotOS v.10 / camelot-scout-v6)
 *
 * Real-photo pipeline for the report cover/"THE PROPERTY" image.
 *
 * Fallback order:
 *   1. Google Places API (New) — Text Search, scoped to the exact address.
 *      Real, usually-current, user-submitted photos of the actual place.
 *      This is a different Google product from Street View.
 *   2. Wikimedia Commons — free, real, but sparse (mostly landmarked/notable
 *      buildings).
 *   3. Google Street View, aimed at the building — LAST RESORT ONLY. Unlike
 *      the old behavior (a generic street-facing static image), this looks
 *      up the nearest panorama, computes the compass bearing from that
 *      panorama to the building's own coordinates, and requests the image
 *      with that heading so the camera is actually pointed at the building
 *      rather than wherever the panorama happens to face. Always captioned
 *      "Photo via Google Street View" so it's never confused with a
 *      submitted Places photo.
 *   4. Nothing found → a clearly labeled "no exterior photo available"
 *      placeholder. Never silently blank, never AI-generated.
 *
 * Note on other sources that were researched but are NOT implemented here:
 * county/municipal property assessor photo portals and the NYC Municipal
 * Archives tax photo collections (1940s / 1980s) have no public API — they
 * are manual/scripted-browse-only and, for the NYC archives, decades out of
 * date. Both were evaluated and intentionally left out of this automated
 * pipeline; see the PR discussion for the full writeup.
 *
 * Known bug this replaces: the previous version fell back to a generic
 * Street View static image, and a separate code path in pitch-report.ts was
 * pulling `commercialIntel.brandingImages` (marketing/interior photos of
 * *any* nearby business — e.g. a restaurant a few doors down) into the same
 * slot as if it were a photo of the subject building. That is why reports
 * were showing a random tenant's interior instead of the building's
 * exterior. This file no longer participates in that fallback chain; see
 * pitch-report.ts (bestExteriorImage / propertyImageCard / contextualImageCard)
 * for the corresponding fix.
 *
 * REQUIRES SETUP (not done by this change): `VITE_GOOGLE_MAPS_API_KEY` must
 * be set in Render with a real, billing-enabled key that has "Places API
 * (New)" enabled (Street View Static + Street View Metadata APIs also need
 * to be enabled on that same key for the fallback below to work). As of
 * this commit, Render has no such key configured for camelot-scout-v6, so
 * `GOOGLE_MAPS_KEY` resolves to the shared public demo key, which does not
 * reliably serve any of these APIs. This is a one-time manual step for
 * whoever owns the Google Cloud project.
 */

const WIKI_API = 'https://commons.wikimedia.org/w/api.php';
const PLACES_SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const STREETVIEW_METADATA_URL = 'https://maps.googleapis.com/maps/api/streetview/metadata';
const STREETVIEW_STATIC_URL = 'https://maps.googleapis.com/maps/api/streetview';

export interface BuildingPhotos {
  exterior: string[]; // URLs to real exterior photos, best first
  interior: string[]; // URLs to lobby/amenity photos (never used as a stand-in for exterior)
  attribution: string; // Required credit line for the lead photo, if the source requires one
  source: string; // Where the lead photo came from, for QA/debugging and report footnotes
  noPhotoAvailable: boolean; // True when nothing legitimate was found — render the labeled placeholder, not a blank box
  // Legacy optional fields kept for compatibility with older consumers
  // (camelot-report.ts) that used to read these directly. Always empty/unset
  // from this module now — the aimed Street View fallback result is
  // returned via `exterior[0]` + `attribution`, not a separate field.
  streetView?: string;
  satellite?: string;
}

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Normalize an address for loose matching against what Google returns.
 * "257 Water Street, New York, NY 10038" -> "257 water street"
 */
function normalizeAddressForMatch(address: string): { streetNumber: string; streetName: string } {
  const clean = address.replace(/,.*/g, '').trim().toLowerCase();
  const match = clean.match(/^(\d+[a-z]?)\s+(.+)$/);
  if (!match) return { streetNumber: '', streetName: clean };
  return { streetNumber: match[1], streetName: match[2].replace(/[^a-z0-9 ]/g, '').trim() };
}

/**
 * Does a Places (New) result actually correspond to the subject address, as
 * opposed to "the most prominent business somewhere near that address"?
 * This is the guard that fixes the wrong-photo bug: we only accept a place
 * whose own formatted address contains the same street number and street
 * name we searched for.
 */
function placeMatchesAddress(formattedAddress: string, address: string): boolean {
  if (!formattedAddress) return false;
  const target = normalizeAddressForMatch(address);
  const candidate = formattedAddress.toLowerCase();
  if (!target.streetNumber || !target.streetName) return false;
  const streetNameFirstWord = target.streetName.split(' ')[0];
  return candidate.includes(target.streetNumber) && candidate.includes(streetNameFirstWord);
}

interface PlacesTextSearchPhoto {
  name: string; // e.g. "places/PLACE_ID/photos/PHOTO_ID"
  authorAttributions?: Array<{ displayName?: string; uri?: string }>;
}

interface PlacesTextSearchResult {
  formattedAddress?: string;
  types?: string[];
  photos?: PlacesTextSearchPhoto[];
  location?: { latitude: number; longitude: number };
}

/**
 * Build a displayable image URL for a Places (New) photo resource.
 * https://developers.google.com/maps/documentation/places/web-service/place-photos
 */
function placePhotoMediaUrl(photoName: string, maxHeightPx = 900): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeightPx}&key=${GOOGLE_MAPS_KEY}`;
}

/**
 * Search Google Places (New) for the specific address. Returns the best
 * address-matched result (photo, if any, plus lat/lng so a Street View
 * fallback — if we end up needing one — can be aimed at the right point).
 */
async function searchGooglePlacesForAddress(address: string): Promise<{
  photoUrl: string | null;
  attribution: string | null;
  location: LatLng | null;
}> {
  try {
    const res = await fetch(PLACES_SEARCH_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
        // Only ask for what we need — keeps the request cheap and fast.
        'X-Goog-FieldMask': 'places.formattedAddress,places.types,places.photos,places.location',
      },
      body: JSON.stringify({ textQuery: address, maxResultCount: 5 }),
    });
    if (!res.ok) return { photoUrl: null, attribution: null, location: null };

    const data = await res.json();
    const results: PlacesTextSearchResult[] = data?.places || [];

    // Prefer an address-level result (premise / street_address / subpremise)
    // that actually matches the subject address, over the first result
    // Google's ranking happens to return.
    const addressLevelTypes = ['premise', 'street_address', 'subpremise'];
    const candidates = results.filter(r => placeMatchesAddress(r.formattedAddress || '', address));
    const best =
      candidates.find(r => (r.types || []).some(t => addressLevelTypes.includes(t))) ||
      candidates[0] ||
      null;

    if (!best) return { photoUrl: null, attribution: null, location: null };

    const location: LatLng | null = best.location
      ? { lat: best.location.latitude, lng: best.location.longitude }
      : null;

    if (!best.photos || best.photos.length === 0) {
      return { photoUrl: null, attribution: null, location };
    }

    const photo = best.photos[0];
    const attributionName = photo.authorAttributions?.[0]?.displayName;
    const attribution = attributionName
      ? `Photo: ${attributionName} via Google`
      : 'Photo via Google';

    return { photoUrl: placePhotoMediaUrl(photo.name), attribution, location };
  } catch (e) {
    console.error('Places (New) address lookup failed:', e);
    return { photoUrl: null, attribution: null, location: null };
  }
}

/**
 * Fall back to the Geocoding API purely for coordinates, when the Places
 * search above didn't return a usable location (e.g. no address-matched
 * result at all). Only used to aim the last-resort Street View fallback.
 */
async function geocodeAddress(address: string): Promise<LatLng | null> {
  try {
    const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
    return { lat: loc.lat, lng: loc.lng };
  } catch (e) {
    console.error('Geocoding fallback failed:', e);
    return null;
  }
}

/**
 * Standard great-circle initial bearing (degrees, 0-360) from `from` to `to`.
 * This is what lets the Street View fallback actually point at the building
 * instead of showing whatever direction the panorama defaults to.
 */
function bearingBetween(from: LatLng, to: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const phi1 = toRad(from.lat);
  const phi2 = toRad(to.lat);
  const deltaLambda = toRad(to.lng - from.lng);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);

  return (toDeg(theta) + 360) % 360;
}

/**
 * Look up the nearest Street View panorama to `location` and, if one
 * exists, return a Static Street View image URL aimed at `location` (not at
 * whatever the panorama's own default heading is). Last-resort fallback
 * only — see module docs.
 */
async function aimedStreetViewImage(location: LatLng): Promise<{ photoUrl: string; attribution: string } | null> {
  try {
    const metaUrl = `${STREETVIEW_METADATA_URL}?location=${location.lat},${location.lng}&key=${GOOGLE_MAPS_KEY}`;
    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    if (meta?.status !== 'OK' || !meta?.pano_id || !meta?.location) return null;

    const panoLocation: LatLng = { lat: meta.location.lat, lng: meta.location.lng };
    const heading = bearingBetween(panoLocation, location);

    const photoUrl =
      `${STREETVIEW_STATIC_URL}?size=1200x600&pano=${encodeURIComponent(meta.pano_id)}` +
      `&heading=${heading.toFixed(1)}&pitch=8&fov=75&key=${GOOGLE_MAPS_KEY}`;

    return { photoUrl, attribution: 'Photo via Google Street View' };
  } catch (e) {
    console.error('Aimed Street View fallback failed:', e);
    return null;
  }
}

/**
 * Search Wikimedia Commons for building photos (secondary source — mostly
 * covers landmarked/notable buildings, so this is sparse but free and real).
 */
async function searchWikimedia(buildingName: string, address: string): Promise<string[]> {
  const photos: string[] = [];
  const regionHint = /\b(fl|florida|miami|north miami|33161)\b/i.test(address)
    ? ' Florida'
    : /\b(ct|connecticut|monroe)\b/i.test(address)
      ? ' Connecticut'
      : /\b(nj|new jersey)\b/i.test(address)
        ? ' New Jersey'
        : /\b(ny|new york|brooklyn|queens|bronx|staten island|manhattan)\b/i.test(address)
          ? ' New York'
          : '';
  const queries = [
    buildingName.replace(/[^a-zA-Z0-9 ]/g, ''),
    address.replace(/[^a-zA-Z0-9 ]/g, ''),
  ];

  for (const query of queries) {
    try {
      const searchUrl = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(`${query} building${regionHint}`)}&srnamespace=6&srlimit=5&format=json&origin=*`;
      const res = await fetch(searchUrl);
      if (!res.ok) continue;
      const data = await res.json();
      const results = data?.query?.search || [];

      for (const result of results) {
        const title = result.title;
        if (!title.match(/\.(jpg|jpeg|png|webp)$/i)) continue;

        const infoUrl = `${WIKI_API}?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json&origin=*`;
        const infoRes = await fetch(infoUrl);
        if (!infoRes.ok) continue;
        const infoData = await infoRes.json();
        const pages = infoData?.query?.pages || {};
        for (const page of Object.values(pages) as any[]) {
          const url = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
          if (url) photos.push(url);
        }
      }

      if (photos.length > 0) break;
    } catch (e) {
      console.error('Wikimedia search error:', e);
    }
  }

  return photos;
}

/**
 * Find the best available REAL exterior photo for a building.
 * Order: Places (New) -> Wikimedia -> aimed Street View (last resort) ->
 * "no photo available" placeholder. Never generates anything.
 */
export async function findBuildingPhotos(buildingName: string, address: string): Promise<BuildingPhotos> {
  const places = await searchGooglePlacesForAddress(address);
  if (places.photoUrl) {
    return {
      exterior: [places.photoUrl],
      interior: [],
      attribution: places.attribution || '',
      source: 'Google Places (New)',
      noPhotoAvailable: false,
    };
  }

  const wikimediaPhotos = await searchWikimedia(buildingName, address);
  if (wikimediaPhotos.length > 0) {
    return {
      exterior: wikimediaPhotos,
      interior: [],
      attribution: 'Photo: Wikimedia Commons',
      source: 'Wikimedia Commons',
      noPhotoAvailable: false,
    };
  }

  // Last resort: Street View, aimed at the building rather than a generic
  // street-facing shot. Needs coordinates — reuse whatever Places found
  // even without a photo, or fall back to geocoding.
  const location = places.location || (await geocodeAddress(address));
  if (location) {
    const streetView = await aimedStreetViewImage(location);
    if (streetView) {
      return {
        exterior: [streetView.photoUrl],
        interior: [],
        attribution: streetView.attribution,
        source: 'Google Street View',
        noPhotoAvailable: false,
      };
    }
  }

  return {
    exterior: [],
    interior: [],
    attribution: '',
    source: 'none',
    noPhotoAvailable: true,
  };
}

/**
 * Generate photo HTML for a Jackie report. Shows a clearly labeled
 * placeholder — never a blank box — when no real photo was found.
 */
export function generatePhotoHTML(photos: BuildingPhotos, buildingName: string): string {
  if (photos.noPhotoAvailable || !photos.exterior[0]) {
    return `
<div style="margin-bottom:16px">
  <div style="border-radius:10px;overflow:hidden;border:1px dashed #B8973A;height:300px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;background:#F5F0E5;text-align:center;padding:24px">
    <div style="color:#8a8174;font-size:13px;font-weight:700">
      No exterior photo available yet for ${buildingName}.<br>
      <span style="font-weight:400;font-size:11px">A team member can upload a verified photo, or one will populate automatically once a real photo is located.</span>
    </div>
  </div>
</div>`;
  }

  const mainPhoto = photos.exterior[0];
  const additionalPhotos = [...photos.interior, ...photos.exterior.slice(1)].slice(0, 4);

  return `
<!-- Building Photo — sourced from ${photos.source} -->
<div style="margin-bottom:16px">
  <div style="border-radius:10px;overflow:hidden;border:1px solid #D5D0C6;height:300px;margin-bottom:8px;position:relative">
    <img src="${mainPhoto}" alt="${buildingName}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<div style=&quot;height:100%;display:flex;align-items:center;justify-content:center;background:#F5F0E5;color:#8a8174;font-size:12px;font-weight:700;text-align:center;padding:16px&quot;>No exterior photo available for ${buildingName}</div>'">
    <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:12px 16px 8px;color:#fff">
      <div style="font-size:14px;font-weight:700">${buildingName}</div>
      <div style="font-size:9px;opacity:0.75">${photos.attribution || `Photo: ${photos.source}`}</div>
    </div>
  </div>
  ${additionalPhotos.length > 0 ? `
  <div style="display:grid;grid-template-columns:repeat(${Math.min(additionalPhotos.length, 3)},1fr);gap:6px">
    ${additionalPhotos.map(url => `<div style="border-radius:6px;overflow:hidden;height:120px;border:1px solid #D5D0C6"><img src="${url}" alt="${buildingName}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'"></div>`).join('\n')}
  </div>` : ''}
</div>`;
}
