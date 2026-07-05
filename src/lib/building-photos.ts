import { GOOGLE_MAPS_KEY } from '@/lib/maps-key';
/**
 * Building Photo Finder
 * Searches multiple free sources for building exterior and interior photos.
 * Sources: Wikimedia Commons, Google Street View, Google Maps Static
 */

const WIKI_API = 'https://commons.wikimedia.org/w/api.php';

export interface BuildingPhotos {
  exterior: string[];  // URLs to exterior photos
  interior: string[];  // URLs to lobby, amenity, and interior photos
  streetView: string;  // Google Street View URL
  satellite: string;   // Google Maps satellite URL
  source: string;      // where the photos came from
}

/**
 * Search Wikimedia Commons for building photos
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

        // Get the actual image URL
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
 * Get Google Street View and satellite URLs for a building
 */
function getGooglePhotos(address: string): { streetView: string; satellite: string } {
  const cleanAddress = /\b(new york|ny|brooklyn|queens|bronx|staten island|manhattan|florida|fl|miami|north miami|33161|connecticut|ct|new jersey|nj)\b/i.test(address)
    ? address
    : address;
  const encoded = encodeURIComponent(cleanAddress.replace(/\s*,\s*/g, ', ').replace(/\s{2,}/g, ' ').trim());
  return {
    streetView: `https://maps.googleapis.com/maps/api/streetview?size=1200x600&location=${encoded}&key=${GOOGLE_MAPS_KEY}`,
    satellite: `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${encoded}&zoom=18&maptype=satellite`,
  };
}

/**
 * Find the best available photos for a building
 */
export async function findBuildingPhotos(buildingName: string, address: string): Promise<BuildingPhotos> {
  const google = getGooglePhotos(address);

  // Try Wikimedia first
  let exterior: string[] = [];
  let source = 'Google Street View';

  try {
    exterior = await searchWikimedia(buildingName, address);
    if (exterior.length > 0) source = 'Wikimedia Commons';
  } catch (e) {
    // Wikimedia failed, fall back to Google
  }

  // If no Wikimedia photos, use Street View static image
  if (exterior.length === 0) {
    exterior = [google.streetView];
  }

  return {
    exterior,
    interior: [],
    streetView: google.streetView,
    satellite: google.satellite,
    source,
  };
}

/**
 * Generate photo HTML for a Jackie report
 */
export function generatePhotoHTML(photos: BuildingPhotos, buildingName: string): string {
  const mainPhoto = photos.exterior[0];
  const additionalPhotos = [...photos.interior, ...photos.exterior.slice(1)].slice(0, 4);

  return `
<!-- Building Photos — sourced from ${photos.source} -->
<div style="margin-bottom:16px">
<div style="border-radius:10px;overflow:hidden;border:1px solid #D5D0C6;height:300px;margin-bottom:8px;position:relative">
<img src="${mainPhoto}" alt="${buildingName}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<iframe src=\\'${photos.satellite}\\' width=\\'100%\\' height=\\'300\\' style=\\'border:0\\' allowfullscreen loading=\\'lazy\\'></iframe>'">
<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:12px 16px 8px;color:#fff">
<div style="font-size:14px;font-weight:700">${buildingName}</div>
<div style="font-size:9px;opacity:0.6">Photo: ${photos.source}</div>
</div>
</div>
${additionalPhotos.length > 0 ? `
<div style="display:grid;grid-template-columns:repeat(${Math.min(additionalPhotos.length, 3)},1fr);gap:6px">
${additionalPhotos.map(url => `<div style="border-radius:6px;overflow:hidden;height:120px;border:1px solid #D5D0C6"><img src="${url}" alt="${buildingName}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'"></div>`).join('\n')}
</div>` : ''}
</div>`;
}
