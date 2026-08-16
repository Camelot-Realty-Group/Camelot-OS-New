/**
 * Server-only client for the RealtyMX **Website API** (https://api.realtymx.com).
 *
 * RealtyMX supplies building/listing/market context only. It does NOT provide
 * operating-expense data — Spire MDS is the sole source of truth for anything
 * financial. Do not add expense fields here.
 *
 * ---------------------------------------------------------------------------
 * VERIFIED LIVE 2026-08-15 with the production key:
 *   GET /buildings?apiKey=...&count=50&page=1  -> 200 OK, TOTAL_COUNT: 200
 *   Real production data (THE KENT, East of East Lofts, Park East Owners Corp).
 *
 * IMPORTANT — this host is NOT the same API as dataapi.realtymx.com:
 *   • Field names are lowercase (`address`, `city`, `zip`, `units`, `name`, `id`)
 *     rather than UPPERCASE.
 *   • The street address is SPLIT across two fields: `house` ("533") and
 *     `address` ("Washington AVENUE"). Full street line = `house + ' ' + address`.
 *   • Pagination uses `count` (max 50 per page) + `page`, NOT `limit`.
 *   • Response envelope is { TOTAL_COUNT, BUILDINGS: [...] }.
 *   • No latitude/longitude is returned on the buildings payload.
 *
 * READ-ONLY FOR BUILDINGS: the documented resource list
 * (https://api.realtymx.com/?docs) exposes only GET /buildings,
 * GET /buildings/{id} and GET /buildings/photos/{id}. There is no
 * POST/PUT/PATCH to create or update a building, so Camelot buildings cannot be
 * pushed into RealtyMX through this API. Writable resources are limited to
 * /blog, /clients, /alerts, /marketplace, /vtour and /properties/viewCounter.
 * ---------------------------------------------------------------------------
 */

const DEFAULT_BASE_URL = 'https://api.realtymx.com';
/** Legacy public sandbox key for dataapi.realtymx.com — returns SOURCEDB:"demo" rows. */
const LEGACY_DEMO_API_KEY = '41706c356e32656b';
const MAX_COUNT_PER_PAGE = 50;
const REQUEST_TIMEOUT_MS = 15 * 1000;

function successResult(data) {
  return { ok: true, data };
}

function errorResult(code, message, { status, retryable = false } = {}) {
  return { ok: false, error: { code, message, ...(status ? { status } : {}), retryable } };
}

function normalizedBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.BUILDINGS)) return payload.BUILDINGS;
  if (Array.isArray(payload?.PROPERTIES)) return payload.PROPERTIES;
  if (Array.isArray(payload?.LISTINGS)) return payload.LISTINGS;
  if (Array.isArray(payload?.Results)) return payload.Results;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

/**
 * Join RealtyMX's split house/address fields into a single street line.
 * Exported because the portfolio matcher needs the exact same treatment.
 */
export function realtyMxStreetLine(building) {
  if (!building) return '';
  return `${building.house ?? ''} ${building.address ?? ''}`.replace(/\s+/g, ' ').trim();
}

export function createRealtyMxClient({
  env = process.env,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const apiKey = String(env.REALTYMX_API_KEY || '').trim();
  const baseUrl = normalizedBaseUrl(env.REALTYMX_BASE_URL);
  const isLegacyDemoKey = apiKey === LEGACY_DEMO_API_KEY;

  function configured() {
    if (!apiKey) {
      return errorResult(
        'REALTYMX_NOT_CONFIGURED',
        'RealtyMX is not configured. Set REALTYMX_API_KEY on the server.',
      );
    }
    if (typeof fetchImpl !== 'function') {
      return errorResult('REALTYMX_UNAVAILABLE', 'RealtyMX cannot be reached because server fetch is unavailable.', { retryable: true });
    }
    return null;
  }

  async function fetchWithTimeout(url) {
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timeout = controller ? setTimeout(() => controller.abort(), requestTimeoutMs) : null;
    try {
      return await fetchImpl(url, controller ? { signal: controller.signal } : undefined);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async function get(path, params = {}) {
    const missing = configured();
    if (missing) return missing;

    const url = new URL(`${baseUrl}${path}`);
    for (const [k, v] of Object.entries(cleanParams({ ...params, apiKey }))) {
      url.searchParams.set(k, String(v));
    }

    let response;
    try {
      response = await fetchWithTimeout(url);
    } catch {
      return errorResult('REALTYMX_REQUEST_UNREACHABLE', `Could not reach RealtyMX for ${path}.`, { retryable: true });
    }
    if (!response.ok) {
      return errorResult(
        'REALTYMX_REQUEST_FAILED',
        `RealtyMX request failed (HTTP ${response.status}).`,
        { status: response.status, retryable: response.status >= 500 },
      );
    }
    try {
      return successResult(await response.json());
    } catch {
      return errorResult('REALTYMX_INVALID_RESPONSE', `RealtyMX returned an invalid JSON response for ${path}.`, { retryable: true });
    }
  }

  /**
   * List buildings. Pages at 50/request (the documented maximum) and keeps
   * going until TOTAL_COUNT is satisfied or maxPages is hit.
   */
  async function listBuildings({ fetchAll = true, count = MAX_COUNT_PER_PAGE, maxPages = 40, ...rest } = {}) {
    const perPage = Math.min(Number(count) || MAX_COUNT_PER_PAGE, MAX_COUNT_PER_PAGE);
    const items = [];
    let page = Number(rest.page) || 1;
    let totalCount = null;
    let pagesFetched = 0;

    while (pagesFetched < maxPages) {
      const result = await get('/buildings', { ...rest, count: perPage, page });
      if (!result.ok) return result;

      if (totalCount === null) {
        const t = Number(result.data?.TOTAL_COUNT);
        totalCount = Number.isFinite(t) ? t : null;
      }
      const pageItems = extractItems(result.data);
      items.push(...pageItems);
      pagesFetched += 1;

      if (!fetchAll) break;
      if (pageItems.length < perPage) break;
      if (totalCount !== null && items.length >= totalCount) break;
      page += 1;
    }

    return successResult({ items, totalCount, pagesFetched });
  }

  function getBuilding({ id } = {}) {
    if (!id) {
      return Promise.resolve(errorResult('REALTYMX_INVALID_REQUEST', 'id is required to retrieve a RealtyMX building.'));
    }
    return get(`/buildings/${encodeURIComponent(id)}`);
  }

  function getBuildingPhotos({ id } = {}) {
    if (!id) {
      return Promise.resolve(errorResult('REALTYMX_INVALID_REQUEST', 'id is required to retrieve RealtyMX building photos.'));
    }
    return get(`/buildings/photos/${encodeURIComponent(id)}`);
  }

  /** Listings (a.k.a. properties) — market context for a building. */
  async function listProperties({ buildingId, status, perPage = 100, page = 1, ...rest } = {}) {
    const result = await get('/properties', { ...rest, buildingId, status, perPage, page });
    if (!result.ok) return result;
    return successResult({ items: extractItems(result.data), raw: result.data });
  }

  function listNeighborhoods() {
    return get('/neighborhoods');
  }

  return {
    isConfigured: Boolean(apiKey),
    /**
     * True only for the retired public sandbox key. The production Website API
     * key does not trigger this.
     */
    isDemoMode: isLegacyDemoKey,
    listBuildings,
    getBuilding,
    getBuildingPhotos,
    listProperties,
    listNeighborhoods,
  };
}
