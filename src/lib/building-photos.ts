import { GOOGLE_MAPS_KEY } from '@/lib/maps-key';
/**
 * Building Photo Finder — Scout Bot (CamelotOS v.10 / camelot-scout-v6)
 *
 * Real-photo pipeline for the report cover/"THE PROPERTY" image. This module
 * intentionally never returns an AI-generated image and never falls back to
 * Google Street View — both were explicitly ruled out for client-facing
 * reports (Street View reads as "we don't actually have a photo of your
 * building," and AI generation risks showing a building that doesn't exist).
 *
 * Fallback order:
 *   1. Google Places API (New) — Text Search, scoped to the exact address.
 *      Real, usually-current, user-submitted photos of the actual place.
 *      This is a different Google product from Street View.
 *   2. Wikimedia Commons — free, real, but sparse (mostly landmarked/notable
 *      buildings).
 *   3. Nothing found → a clearly labeled "no exterior photo available"
 *      placeholder. Never silently blank, never Street View, never AI.
 *
 * Known bug this replaces: the previous version fell back to a Street View
 * static image, and a separate code path in pitch-report.ts was pulling
 * `commercialIntel.brandingImages` (marketing/interior photos of *any*
 * nearby business — e.g. a restaurant a few doors down) into the same slot
 * as if it were a photo of the subject building. That is why reports were
 * showing a random tenant's interior instead of the building's exterior.
 * This file no longer participates in that fallback chain; see
 * pitch-report.ts (bestExteriorImage / propertyImageCard / contextualImageCard)
 * for the corresponding fix.
 *
 * REQUIRES SETUP (not done by this change): `VITE_GOOGLE_MAPS_API_KEY` must
 * be set in Render with a real, billing-enabled key that has "Places API
 * (New)" enabled. As of this commit, Render has no such key configured for
 * camelot-scout-v6, so `GOOGLE_MAPS_KEY` resolves to the shared public demo
 * key, which does not reliably serve Places (New) responses either. This is
 * a one-time manual step for whoever owns the Google Cloud project — see
 * TODO below.
 */

const WIKI_API = 'https://commons.wikimedia.org/w/api.php';
const PLACES_SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';

export interface BuildingPhotos {
  exterior: string[]; // URLs to real exterior photos, best first
  interior: string[]; // URLs to lobby/amenity photos (never used as a stand-in for exterior)
  attribution: string; // Required credit line for the lead photo, if the source requires one
  source: string; // Where the lead photo came from, for QA/debugging and report footnotes
  noPhotoAvailable: boolean; // True when nothing legitimate was found — render the labeled placeholder, not a blank box
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
}

/**
 * Build a displayable image URL for a Places (New) photo resource.
 * https://developers.google.com/maps/documentation/places/web-service/place-photos
 */
function placePhotoMediaUrl(photoName: string, maxHeightPx = 900): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeightPx}&key=${GOOGLE_MAPS_KEY}`;
}

/**
 * Search Google Places (New) for the specific address and return a real
 * photo of that place — not of whatever business Google ranks highest for
 * a loose nearby query. Requires "Places API (New)" enabled on the Maps key.
 */
async function searchGooglePlacesExteriorPhoto(address: string): Promise<{
  photoUrl: string;
  attribution: string;
} | null> {
  try {
    const res = await fetch(PLACES_SEARCH_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
        // Only ask for what we need — keeps the request cheap and fast.
        'X-Goog-FieldMask': 'places.formattedAddress,places.types,places.photos',
      },
      body: JSON.stringify({ textQuery: address, maxResultCount: 5 }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const results: PlacesTextSearchResult[] = data?.places || [];

    // Prefer an address-level result (premise / street_address / subpremise)
    // that actually matches the subject address, over the first result
    // Google's ranking happens to return.
    const addressLevelTypes = ['premise', 'street_address', 'subpremise'];
    const candidates = results.filter(r => placeMatchesAddress(r.formattedAddress || '', address));
    const best =
      candidates.find(r => (r.types || []).some(t => addressLevelTypes.includes(t))) ||
      candidates[0];

    if (!best || !best.photos || best.photos.length === 0) return null;

    const photo = best.photos[0];
    const attributionName = photo.authorAttributions?.[0]?.displayName;
    const attribution = attributionName
      ? `Photo: ${attributionName} via Google`
      : 'Photo via Google';

    return { photoUrl: placePhotoMediaUrl(photo.name), attribution };
  } catch (e) {
    console.error('Places (New) exterior photo lookup failed:', e);
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
 * Never returns a Street View URL and never generates anything — if nothing
 * legitimate is found, `noPhotoAvailable` is true and callers must render
 * the labeled placeholder (see generatePhotoHTML below).
 */
export async function findBuildingPhotos(buildingName: string, address: string): Promise<BuildingPhotos> {
  const placesResult = await searchGooglePlacesExteriorPhoto(address);
  if (placesResult) {
    return {
      exterior: [placesResult.photoUrl],
      interior: [],
      attribution: placesResult.attribution,
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
 * placeholder — never a blank box, never Street View, never an AI image —
 * when no real photo was found.
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
