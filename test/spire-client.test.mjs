import assert from 'node:assert/strict';
import test from 'node:test';
import { createSpireClient } from '../src/api/spire-client.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('Spire reports an actionable configuration error without making a request', async () => {
  let calls = 0;
  const client = createSpireClient({ env: {}, fetchImpl: async () => { calls += 1; return jsonResponse({}); } });

  const result = await client.listBuildings();

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: 'SPIRE_NOT_CONFIGURED',
      message: 'Spire is not configured. Set SPIRE_API_KEY and SPIRE_CLIENT_SECRET on the server.',
      retryable: false,
    },
  });
  assert.equal(calls, 0);
});

test('Spire caches the bearer token until one minute before its expected expiry', async () => {
  let now = 1_000_000;
  const calls = [];
  const client = createSpireClient({
    env: { SPIRE_API_KEY: 'key', SPIRE_CLIENT_SECRET: 'secret', SPIRE_BASE_URL: 'https://spire.test/api' },
    now: () => now,
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).endsWith('/Authorize')) return new Response('"first-token"', { status: 200 });
      return jsonResponse([]);
    },
  });

  await client.listBuildings();
  now += 13 * 60 * 1000;
  await client.listBuildings();
  now += 61 * 1000;
  await client.listBuildings();

  assert.equal(calls.filter((url) => url.endsWith('/Authorize')).length, 2);
  assert.equal(calls.filter((url) => url.includes('/RM/BuildingsList')).length, 3);
});

test('Spire re-authorizes once after a 401 and retries the original request', async () => {
  const requests = [];
  let authorizationCalls = 0;
  const client = createSpireClient({
    env: { SPIRE_API_KEY: 'key', SPIRE_CLIENT_SECRET: 'secret', SPIRE_BASE_URL: 'https://spire.test/api' },
    fetchImpl: async (url, options = {}) => {
      const value = String(url);
      requests.push({ url: value, authorization: options.headers?.Authorization });
      if (value.endsWith('/Authorize')) {
        authorizationCalls += 1;
        return new Response(`"token-${authorizationCalls}"`, { status: 200 });
      }
      if (authorizationCalls === 1) return new Response('', { status: 401 });
      return jsonResponse([{ BuildingRcd: 7, RentalBuildingName: 'Example', Address1: '1 Test Street' }]);
    },
  });

  const result = await client.listBuildings();

  assert.equal(result.ok, true);
  assert.equal(result.data.items[0].buildingId, 7);
  assert.equal(authorizationCalls, 2);
  assert.deepEqual(
    requests.filter((request) => request.url.includes('/RM/BuildingsList')).map((request) => request.authorization),
    ['Bearer token-1', 'Bearer token-2'],
  );
});

test('Spire retrieves every budget page and maps account labels', async () => {
  const calls = [];
  const client = createSpireClient({
    env: { SPIRE_API_KEY: 'key', SPIRE_CLIENT_SECRET: 'secret', SPIRE_BASE_URL: 'https://spire.test/api' },
    fetchImpl: async (url) => {
      const value = String(url);
      calls.push(value);
      if (value.endsWith('/Authorize')) return new Response('"token"', { status: 200 });
      if (value.includes('/GL/Lookup/GlAccount')) return jsonResponse([{ Rcd: 33, AccountNumber: '6100', GlAccountName: 'Insurance' }]);
      if (value.includes('/GL/Budgets')) {
        const page = new URL(value).searchParams.get('Page');
        return jsonResponse(page === '1'
          ? { TotalPages: 2, Results: [{ GLAccountRcd: 33, Amount: '-1000' }] }
          : { TotalPages: 2, Results: [{ GLAccountRcd: 33, Amount: 250 }] });
      }
      throw new Error(`Unexpected request ${value}`);
    },
  });

  const result = await client.getBudget({ buildingId: 99, companyRcd: 44, year: 2026 });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data.items.map(({ accountCode, label, amount }) => ({ accountCode, label, amount })), [
    { accountCode: '33', label: '6100 Insurance', amount: 1000 },
    { accountCode: '33', label: '6100 Insurance', amount: 250 },
  ]);
  assert.equal(calls.filter((url) => url.includes('/GL/Budgets')).length, 2);
});
