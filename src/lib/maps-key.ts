/**
 * Single source of truth for the Google Maps API key.
 *
 * Prefers VITE_GOOGLE_MAPS_API_KEY (set in Render / .env). Falls back to the
 * public Google Maps Embed demo key, which works for Embed API iframes but is
 * shared/rate-limited and does NOT reliably serve Street View Static images.
 * Set your own key (with Embed API + Street View Static API enabled) for
 * production-quality reports.
 */
export const GOOGLE_MAPS_KEY: string =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ||
  'AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8';
