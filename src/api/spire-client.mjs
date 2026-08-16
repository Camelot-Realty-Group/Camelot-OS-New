/**
 * Server-only client for Camelot's Spire MDS API.
 *
 * Do not import this module from src/lib or any browser entry point. Its
 * credentials are read exclusively from the server environment.
 *
 * PORTED VERBATIM from branch feature/spire-realtymx-clients (PR #12) with two
 * additive methods appended (listUnits, getApVouchers) — the original exported
 * functions are unchanged.
 */

const DEFAULT_BASE_URL = 'https://camelot.spiremds.com/api';
const TOKEN_TTL_MS = 15 * 60 * 1000;
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;

function errorResult(code, message, { status, retryable = false } = {}) {
  return { ok: false, error: { code, message, ...(status ? { status } : {}), retryable } };
}

function successResult(data) {
  return { ok: true, data };
}

function normalizedBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function responseMessage(response, serviceName = 'Spire') {
  return `${serviceName} request failed (HTTP ${response.status}).`;
}

function toNumberOrUndefined(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.Results)) return payload.Results;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

/**
 * Build a Spire client. fetchImpl and now are injectable solely to make
 * deterministic, fully mocked unit tests possible.
 */
export function createSpireClient({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const config = {
    apiKey: String(env.SPIRE_API_KEY || '').trim(),
    clientSecret: String(env.SPIRE_CLIENT_SECRET || '').trim(),
    baseUrl: normalizedBaseUrl(env.SPIRE_BASE_URL),
  };
  let tokenCache = { token: '', expiresAt: 0 };

  function notConfigured() {
    return errorResult(
      'SPIRE_NOT_CONFIGURED',
      'Spire is not configured. Set SPIRE_API_KEY and SPIRE_CLIENT_SECRET on the server.',
    );
  }

  function validateConfiguration() {
    if (!config.apiKey || !config.clientSecret) return notConfigured();
    if (typeof fetchImpl !== 'function') {
      return errorResult('SPIRE_UNAVAILABLE', 'Spire cannot be reached because server fetch is unavailable.', { retryable: true });
    }
    return null;
  }

  async function fetchWithTimeout(url, options) {
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timeout = controller ? setTimeout(() => controller.abort(), requestTimeoutMs) : null;
    try {
      return await fetchImpl(url, { ...options, ...(controller ? { signal: controller.signal } : {}) });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async function authorize() {
    const missingConfig = validateConfiguration();
    if (missingConfig) return missingConfig;

    let response;
    try {
      response = await fetchWithTimeout(`${config.baseUrl}/Authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ APIKey: config.apiKey, ClientSecret: config.clientSecret }),
      });
    } catch {
      return errorResult('SPIRE_AUTH_UNREACHABLE', 'Could not reach Spire to authorize.', { retryable: true });
    }

    if (!response.ok) {
      return errorResult('SPIRE_AUTH_FAILED', responseMessage(response, 'Spire authorization'), { status: response.status, retryable: response.status >= 500 });
    }

    const token = (await response.text()).trim().replace(/^"|"$/g, '');
    if (!token) {
      return errorResult('SPIRE_AUTH_EMPTY_TOKEN', 'Spire authorization returned an empty token.', { retryable: true });
    }

    tokenCache = {
      token,
      expiresAt: now() + TOKEN_TTL_MS - TOKEN_REFRESH_MARGIN_MS,
    };
    return successResult(token);
  }

  async function getToken() {
    if (tokenCache.token && tokenCache.expiresAt > now()) return successResult(tokenCache.token);
    return authorize();
  }

  async function request(path, { params = {}, retriedAfterUnauthorized = false } = {}) {
    const tokenResult = await getToken();
    if (!tokenResult.ok) return tokenResult;

    const url = new URL(`${config.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }

    let response;
    try {
      response = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${tokenResult.data}` },
      });
    } catch {
      return errorResult('SPIRE_REQUEST_UNREACHABLE', `Could not reach Spire for ${path}.`, { retryable: true });
    }

    if (response.status === 401 && !retriedAfterUnauthorized) {
      tokenCache = { token: '', expiresAt: 0 };
      return request(path, { params, retriedAfterUnauthorized: true });
    }
    if (!response.ok) {
      return errorResult(
        response.status === 401 ? 'SPIRE_UNAUTHORIZED' : 'SPIRE_REQUEST_FAILED',
        response.status === 401
          ? `Spire rejected the request to ${path} after re-authorization.`
          : responseMessage(response),
        { status: response.status, retryable: response.status >= 500 },
      );
    }

    if (response.status === 204) return successResult(null);
    try {
      return successResult(await response.json());
    } catch {
      return errorResult('SPIRE_INVALID_RESPONSE', `Spire returned an invalid JSON response for ${path}.`, { retryable: true });
    }
  }

  async function listBuildings({ search } = {}) {
    const response = await request('/RM/BuildingsList', {
      params: search ? { SearchCriteria: search } : {},
    });
    if (!response.ok) return response;

    const items = extractRows(response.data).map((row) => {
      const addressParts = [row.Address || row.Address1, row.City, row.State, row.ZipCode].filter(Boolean);
      return {
        buildingId: row.BuildingRcd ?? row.ID ?? null,
        name: row.RentalBuildingName || row.CoopCondoCompanyName || row.BuildingNumber || '',
        address: addressParts.join(', '),
        unitCount: toNumberOrUndefined(row.TotalUnits ?? row.NumberOfUnits ?? row.Units),
        companyRcd: row.RentalCompanyRcd ?? row.CoopCondoCompanyRcd ?? null,
        raw: row,
      };
    });
    return successResult({ items });
  }

  async function listCompanies({ search } = {}) {
    const response = await request('/PM/Lookup/Company', {
      params: search ? { SearchCriteria: search } : {},
    });
    if (!response.ok) return response;
    return successResult({ items: extractRows(response.data) });
  }

  async function getGlAccountLabels() {
    const response = await request('/GL/Lookup/GlAccount');
    if (!response.ok) return response;
    const labels = new Map();
    for (const row of extractRows(response.data)) {
      const accountRcd = row.Rcd ?? row.GlAccountRcd;
      if (accountRcd === undefined || accountRcd === null) continue;
      const number = row.AccountNumber || row.GlAccountNumber || '';
      const name = row.GlAccountName || row.Name || '';
      labels.set(String(accountRcd), `${number} ${name}`.trim() || `GL Account ${accountRcd}`);
    }
    return successResult(labels);
  }

  async function resolveCompanyRcd(buildingId) {
    const buildings = await listBuildings();
    if (!buildings.ok) return buildings;
    const matchingBuilding = buildings.data.items.find((building) => String(building.buildingId) === String(buildingId));
    if (!matchingBuilding?.companyRcd) {
      return errorResult(
        'SPIRE_COMPANY_NOT_FOUND',
        `Spire could not resolve a company record for building ${buildingId}.`,
      );
    }
    return successResult(matchingBuilding.companyRcd);
  }

  async function getBudget({ buildingId, year, companyRcd } = {}) {
    if (!buildingId || !Number.isInteger(Number(year))) {
      return errorResult('SPIRE_INVALID_REQUEST', 'buildingId and a numeric year are required to retrieve a Spire budget.');
    }
    const company = companyRcd ? successResult(companyRcd) : await resolveCompanyRcd(buildingId);
    if (!company.ok) return company;
    const accounts = await getGlAccountLabels();
    if (!accounts.ok) return accounts;

    const items = [];
    let page = 1;
    let totalPages = 1;
    do {
      const response = await request('/GL/Budgets', {
        params: { Page: page, Year: year, CompanyRcd: company.data },
      });
      if (!response.ok) return response;

      for (const row of extractRows(response.data)) {
        const amount = toNumberOrUndefined(row.Amount);
        if (amount === undefined) continue;
        const accountCode = row.GLAccountRcd ?? row.GlAccountRcd ?? '';
        items.push({
          accountCode: String(accountCode),
          label: accounts.data.get(String(accountCode)) || `GL Account ${accountCode}`,
          amount: Math.abs(amount),
          raw: row,
        });
      }
      totalPages = Math.max(1, Number(response.data?.TotalPages || response.data?.totalPages || 1));
      page += 1;
    } while (page <= totalPages);

    return successResult({ buildingId, companyRcd: company.data, year: Number(year), items });
  }

  async function getGlActuals({ buildingId, periodFrom, periodTo, fiscalYear, companyRcd } = {}) {
    if (!buildingId || !periodFrom || !periodTo) {
      return errorResult('SPIRE_INVALID_REQUEST', 'buildingId, periodFrom, and periodTo are required to retrieve Spire GL actuals.');
    }
    const company = companyRcd ? successResult(companyRcd) : await resolveCompanyRcd(buildingId);
    if (!company.ok) return company;
    const accounts = await getGlAccountLabels();
    if (!accounts.ok) return accounts;

    const items = [];
    for (const [accountRcd, label] of accounts.data) {
      const response = await request('/GL/GLSummary', {
        params: {
          CompanyRcd: company.data,
          GlAccountRcd: accountRcd,
          PeriodFrom: periodFrom,
          PeriodTo: periodTo,
          ...(fiscalYear ? { FiscalYear: fiscalYear } : {}),
        },
      });
      if (!response.ok) return response;
      const rows = extractRows(response.data);
      const amount = rows.reduce((total, row) => total + (toNumberOrUndefined(row.NetChange) || 0), 0);
      if (amount !== 0) items.push({ accountCode: accountRcd, label, amount: Math.abs(amount), raw: rows });
    }

    return successResult({ buildingId, companyRcd: company.data, periodFrom, periodTo, items });
  }

  // --- Additive: raw building rows (sync needs every field, not the trimmed
  // shape listBuildings returns) -----------------------------------------------
  async function listBuildingsRaw({ search } = {}) {
    const response = await request('/RM/BuildingsList', {
      params: search ? { SearchCriteria: search } : {},
    });
    if (!response.ok) return response;
    return successResult({ items: extractRows(response.data) });
  }

  // --- Additive: units within a building ---------------------------------------
  async function listUnits({ buildingId } = {}) {
    if (!buildingId) {
      return errorResult('SPIRE_INVALID_REQUEST', 'buildingId is required to list Spire units.');
    }
    const response = await request('/RM/UnitsList', { params: { BuildingRcd: buildingId } });
    if (!response.ok) return response;
    return successResult({ items: extractRows(response.data) });
  }

  // --- Additive: AP vouchers = itemized vendor invoice history. This is the
  // hard evidence behind a quarterly savings claim, and the raw material for
  // vendor-spend leverage.
  //
  // ⚠️ VERIFIED 2026-08-15 — READ BEFORE CHANGING:
  //   • The endpoint IGNORES the CompanyRcd parameter. Passing CompanyRcd 430,
  //     521 or nothing at all returns an identical 105,893-row result set with
  //     the same first voucher. Filtering MUST be done client-side on the
  //     CompanyRcd / CompanyName fields of each row.
  //   • Rows are voucher HEADERS. `IsGlRow` is false on every list row, and
  //     GlChartOfAccountNumber / GlChartOfAccountDescription / GlExpenseAmount
  //     are empty. To get a voucher's GL category breakdown you must call
  //     /AP/GetGlLedgerDistributions per voucher — do NOT attempt that across
  //     the full ledger (105,893 calls). Use GL/GLSummary for category data.
  //   • `BuildingRcd` is 0 on virtually every row (3 of 4,000 sampled were
  //     populated). Attribute spend by CompanyRcd instead — one company maps to
  //     one building in this portfolio.
  //   • Use `InvoiceAmount` for the invoice value. `NetAmount` is signed
  //     negative and `GlExpenseAmount` is 0 on header rows.
  //   • 424 pages at 250 rows each. Always bound with maxPages.
  //
  // @param {number|number[]} [companyRcd] filtered client-side, not server-side
  async function getApVouchers({ companyRcd, maxPages = 40, sinceYear } = {}) {
    const wanted = companyRcd === undefined || companyRcd === null
      ? null
      : new Set((Array.isArray(companyRcd) ? companyRcd : [companyRcd]).map(Number));

    const items = [];
    let page = 1;
    let totalPages = 1;
    let scanned = 0;

    do {
      const response = await request('/AP/VoucherList', { params: { Page: page } });
      if (!response.ok) return response;

      const rows = extractRows(response.data);
      scanned += rows.length;
      for (const row of rows) {
        if (wanted && !wanted.has(Number(row.CompanyRcd))) continue;
        if (sinceYear && String(row.InvoiceDate || '').slice(0, 4) < String(sinceYear)) continue;
        items.push(row);
      }
      totalPages = Math.max(1, Number(response.data?.TotalPages || response.data?.totalPages || 1));
      page += 1;
    } while (page <= totalPages && page <= maxPages);

    return successResult({
      companyRcd: companyRcd ?? null,
      items,
      scanned,
      pagesFetched: page - 1,
      totalPages,
      truncated: page - 1 < totalPages,
    });
  }

  /**
   * Vendor spend rollup — who Camelot actually pays, how much, and across how
   * many buildings. This is the negotiating instrument for the vendor program:
   * a vendor billing 9 buildings has far more to lose than one billing 1.
   */
  async function getVendorSpend({ sinceYear, maxPages = 40 } = {}) {
    const vouchers = await getApVouchers({ sinceYear, maxPages });
    if (!vouchers.ok) return vouchers;

    const byVendor = new Map();
    for (const v of vouchers.data.items) {
      const name = (v.VendorName || '').trim() || '(unnamed vendor)';
      const amount = Math.abs(Number(v.InvoiceAmount) || 0);
      if (!byVendor.has(name)) {
        byVendor.set(name, { vendor: name, vendorRcd: v.VendorRcd ?? null, totalSpend: 0, invoiceCount: 0, companies: new Set() });
      }
      const entry = byVendor.get(name);
      entry.totalSpend += amount;
      entry.invoiceCount += 1;
      if (v.CompanyRcd) entry.companies.add(Number(v.CompanyRcd));
    }

    const vendors = [...byVendor.values()]
      .map((e) => ({
        vendor: e.vendor,
        vendorRcd: e.vendorRcd,
        totalSpend: Math.round(e.totalSpend),
        invoiceCount: e.invoiceCount,
        buildingCount: e.companies.size,
        companyRcds: [...e.companies],
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);

    return successResult({
      vendors,
      vouchersScanned: vouchers.data.scanned,
      vouchersMatched: vouchers.data.items.length,
      truncated: vouchers.data.truncated,
      totalPages: vouchers.data.totalPages,
    });
  }

  return {
    isConfigured: Boolean(config.apiKey && config.clientSecret),
    listBuildings,
    listBuildingsRaw,
    listCompanies,
    listUnits,
    getBudget,
    getGlActuals,
    getApVouchers,
    getVendorSpend,
  };
}
