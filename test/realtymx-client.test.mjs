import assert from 'node:assert/strict';
import test from 'node:test';
import { createRealtyMxClient } from '../src/api/realtymx-client.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('RealtyMX returns a clear result when not configured', async () => {
  const client = createRealtyMxClient({ env: {} });
  const result = await client.listBuildings();

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'REALTYMX_NOT_CONFIGURED');
  assert.match(result.error.message, /REALTYMX_API_KEY/);
});

test('RealtyMX builds listing-comp filters and always includes the API key query parameter', async () => {
  let requestUrl = '';
  const client = createRealtyMxClient({
    env: { REALTYMX_API_KEY: 'realty-key' },
    fetchImpl: async (url) => {
      requestUrl = String(url);
      return jsonResponse([{ id: 1 }]);
    },
  });

  const result = await client.listListings({
    neighborhoodId: '12',
    bedsMin: 1,
    bedsMax: 2,
    bathMin: 1,
    bathMax: 2,
    squareFootageMin: 700,
    status: '19,22',
    limit: 40,
  });

  const url = new URL(requestUrl);
  assert.equal(result.ok, true);
  assert.equal(url.pathname, '/listings');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    neighborhood_id: '12',
    bedsMin: '1',
    bedsMax: '2',
    bathMin: '1',
    bathMax: '2',
    square_footage_min: '700',
    status: '19,22',
    limit: '40',
    page: '1',
    apiKey: 'realty-key',
  });
});

test('RealtyMX collects all known pages when requested', async () => {
  const requestedPages = [];
  const client = createRealtyMxClient({
    env: { REALTYMX_API_KEY: 'realty-key' },
    fetchImpl: async (url) => {
      const page = Number(new URL(String(url)).searchParams.get('page'));
      requestedPages.push(page);
      return jsonResponse({
        TotalPages: 2,
        Results: page === 1 ? [{ id: 'building-1' }] : [{ id: 'building-2' }],
      });
    },
  });

  const result = await client.listBuildings({ fetchAll: true, limit: 20 });

  assert.equal(result.ok, true);
  assert.deepEqual(requestedPages, [1, 2]);
  assert.deepEqual(result.data.items.map((item) => item.id), ['building-1', 'building-2']);
  assert.equal(result.data.pagesFetched, 2);
});

test('RealtyMX validates endpoint-specific identifiers before making calls', async () => {
  let calls = 0;
  const client = createRealtyMxClient({
    env: { REALTYMX_API_KEY: 'realty-key' },
    fetchImpl: async () => { calls += 1; return jsonResponse([]); },
  });

  const [history, leases] = await Promise.all([client.getListingsHistory(), client.getLeases()]);

  assert.equal(history.error.code, 'REALTYMX_INVALID_REQUEST');
  assert.equal(leases.error.code, 'REALTYMX_INVALID_REQUEST');
  assert.equal(calls, 0);
});
