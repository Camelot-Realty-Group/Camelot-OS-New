/**
 * Server-only client for the RealtyMX Data API.
 *
 * RealtyMX is used here for listing, price-history, and lease data only.
 * It does not provide operating-expense data; those records belong in Spire.
 */

const DEFAULT_BASE_URL = 'https://dataapi.realtymx.com';
const REQUEST_TIMEOUT_MS = 10 * 1000;

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
  if (Array.isArray(payload?.Results)) return payload.Results;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function totalPages(payload) {
  const candidate = payload?.TotalPages ?? payload?.totalPages ?? payload?.total_pages;
  const numeric = Number(candidate);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

export function createRealtyMxClient({
  env = process.env,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const apiKey = String(env.REALTYMX_API_KEY || '').trim();
  const baseUrl = normalizedBaseUrl(env.REALTYMX_BASE_URL);

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
    const missingConfig = configured();
    if (missingConfig) return missingConfig;

    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(cleanParams({ ...params, apiKey }))) {
      url.searchParams.set(key, String(value));
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

  async function list(path, { fetchAll = false, maxPages = 100, ...params } = {}) {
    const firstPage = Number(params.page || 1);
    const requestedLimit = Number(params.limit || 20);
    let page = firstPage;
    let lastPayload;
    const items = [];

    while (page < firstPage + maxPages) {
      const result = await get(path, { ...params, page });
      if (!result.ok) return result;

      lastPayload = result.data;
      const pageItems = extractItems(result.data);
      items.push(...pageItems);
      if (!fetchAll) break;

      const knownTotalPages = totalPages(result.data);
      if (knownTotalPages ? page >= knownTotalPages : pageItems.length < requestedLimit) break;
      page += 1;
    }

    return successResult({
      items,
      page: firstPage,
      pagesFetched: page - firstPage + 1,
      raw: lastPayload,
    });
  }

  function listBuildings(options = {}) {
    return list('/buildings', options);
  }

  /**
   * The convenience fields map directly to RealtyMX's documented query names:
   * neighborhoodId -> neighborhood_id and squareFootageMin -> square_footage_min.
   */
  function listListings({
    neighborhoodId,
    bedsMin,
    bedsMax,
    bathMin,
    bathMax,
    squareFootageMin,
    status,
    ...options
  } = {}) {
    return list('/listings', {
      ...options,
      neighborhood_id: neighborhoodId,
      bedsMin,
      bedsMax,
      bathMin,
      bathMax,
      square_footage_min: squareFootageMin,
      status,
    });
  }

  function getListingsHistory({ listingId, ...options } = {}) {
    if (!listingId) {
      return Promise.resolve(errorResult('REALTYMX_INVALID_REQUEST', 'listingId is required to retrieve RealtyMX listing history.'));
    }
    return list('/listingsHistory', { ...options, listing_id: listingId });
  }

  function getLeases({ email, id, ...options } = {}) {
    if (!email && !id) {
      return Promise.resolve(errorResult('REALTYMX_INVALID_REQUEST', 'email or id is required to retrieve RealtyMX leases.'));
    }
    return list('/leases', { ...options, email, id });
  }

  return {
    isConfigured: Boolean(apiKey),
    listBuildings,
    listListings,
    getListingsHistory,
    getLeases,
  };
}
