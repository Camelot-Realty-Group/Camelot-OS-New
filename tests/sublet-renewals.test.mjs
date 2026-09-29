import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSpireDate, daysBetween, urgencyBucket, classifySublet, splitParties, buildRenewalRecord,
  revenueSummary, toCsv, buildOwnerNotice, buildDigestHtml, inWindow, isCoopCondoBuilding,
} from '../src/api/sublet-renewals-core.mjs';
import { runSubletRenewalScan, createOpsAccessMiddleware } from '../src/api/sublet-renewal-routes.mjs';

const COOP = { BuildingRcd: 7, BuildingNumber: '552', CoopCondoCompanyRcd: 99, CoopCondoCompanyName: '43 West Condominium', Address1: '552 West 43rd Street', PropertyManagerName: 'PM One' };
const RENTAL = { BuildingRcd: 8, BuildingNumber: '100', RentalCompanyRcd: 5, RentalBuildingName: 'Rental Co', Address1: '1 Main St' };

test('parseSpireDate handles ISO, US, and .NET empty dates', () => {
  assert.equal(parseSpireDate('2026-12-31T00:00:00'), '2026-12-31');
  assert.equal(parseSpireDate('3/5/2027'), '2027-03-05');
  assert.equal(parseSpireDate('0001-01-01T00:00:00'), null);
  assert.equal(parseSpireDate(''), null);
});

test('urgency buckets match the 60–90 day notice window', () => {
  assert.equal(urgencyBucket(-1), 'expired');
  assert.equal(urgencyBucket(10), 'critical');
  assert.equal(urgencyBucket(59), 'urgent');
  assert.equal(urgencyBucket(60), 'notice_window');
  assert.equal(urgencyBucket(90), 'notice_window');
  assert.equal(urgencyBucket(91), 'upcoming');
  assert.equal(daysBetween('2026-09-29', '2026-12-28'), 90);
});

test('co-op/condo detection', () => {
  assert.equal(isCoopCondoBuilding(COOP), true);
  assert.equal(isCoopCondoBuilding(RENTAL), false);
});

test('classifySublet: category = confirmed; lease on co-op unit = likely; plain rental = not a sublet', () => {
  const confirmed = classifySublet({ ContactCategories: 'Subtenant', LeaseExpireDate: '2026-12-15' }, { building: COOP });
  assert.equal(confirmed.confidence, 'confirmed');
  assert.equal(confirmed.occupancyIsSubtenant, true);
  const likely = classifySublet({ LeaseExpireDate: '2026-12-15' }, { building: COOP });
  assert.equal(likely.confidence, 'likely');
  const viaContact = classifySublet({ LeaseExpireDate: '2026-12-15' }, { building: RENTAL, contacts: [{ ContactCategoryDescriptions: 'Sub-Lessee' }] });
  assert.equal(viaContact.confidence, 'confirmed');
  const rental = classifySublet({ LeaseExpireDate: '2026-12-15' }, { building: RENTAL });
  assert.equal(rental.isSublet, false);
  const noLease = classifySublet({}, { building: COOP });
  assert.equal(noLease.isSublet, false);
});

test('custom SUBLET_CATEGORY_PATTERN is honored', () => {
  const r = classifySublet({ StatusCodes: 'SBL' }, { building: RENTAL, env: { SUBLET_CATEGORY_PATTERN: '\\bSBL\\b' } });
  assert.equal(r.confidence, 'confirmed');
});

test('splitParties: owner occupant + subtenant contact', () => {
  const p = splitParties(
    { OccupantName: 'Jane Owner', OccupantEmail: 'jane@x.com' },
    [{ FirstName: 'Sam', LastName: 'Sub', EmailAddress: 's@x.com', CellPhone: '555', ContactCategoryDescriptions: 'Subtenant' }],
  );
  assert.equal(p.owner.name, 'Jane Owner');
  assert.equal(p.subtenants[0].name, 'Sam Sub');
});

test('splitParties: occupancy is the subtenant, owner comes from contacts', () => {
  const p = splitParties(
    { OccupantName: 'Sam Sub' },
    [{ FirstName: 'Jane', LastName: 'Owner', ContactCategoryDescriptions: 'Owner' }],
    { occupancyIsSubtenant: true },
  );
  assert.equal(p.owner.name, 'Jane Owner');
  assert.equal(p.subtenants[0].name, 'Sam Sub');
});

test('buildRenewalRecord prefers occupant-detail lease dates and computes days', () => {
  const rec = buildRenewalRecord(
    { BuildingRcd: 7, UnitRcd: 3, OccupancyRcd: 11, UnitNumber: '12B', OccupantName: 'Jane Owner', LeaseExpireDate: '2026-12-01', BaseRent: 4200 },
    { building: COOP, today: '2026-09-29', occupant: { CurrentLeaseExpireDate: '2026-12-28T00:00:00', CurrentLeaseStartDate: '2025-12-29', BillingAddress1: '9 Elm', BillingCity: 'Scarsdale' },
      contacts: [{ FirstName: 'Sam', LastName: 'Sub', ContactCategoryDescriptions: 'Subtenant' }] },
  );
  assert.equal(rec.lease_end_date, '2026-12-28');
  assert.equal(rec.days_to_expiry, 90);
  assert.equal(rec.urgency, 'notice_window');
  assert.equal(rec.subtenant_name, 'Sam Sub');
  assert.equal(rec.owner_mailing_address, '9 Elm, Scarsdale');
  assert.equal(rec.building_name, '43 West Condominium');
  assert.equal(rec.recorded_rent, 4200);
  assert.equal(rec.renewal_key, '7:3:2026-12-28');
  assert.equal(inWindow(rec), true);
});

test('revenueSummary: fees on renewals, 1 month rent on brokerage path, dismissed excluded', () => {
  const s = revenueSummary([
    { status: 'identified', fee_status: 'not_billed', fee_amount: 150 },
    { status: 'fee_billed', fee_status: 'billed', fee_amount: 150 },
    { status: 'closed_renewed', fee_status: 'paid', fee_amount: 150 },
    { status: 'brokerage_opportunity', fee_status: 'not_billed', fee_amount: 150, sublease_rent: 5000 },
    { status: 'dismissed', fee_status: 'not_billed', fee_amount: 150, sublease_rent: 9999 },
  ]);
  assert.equal(s.feesPotential, 450);
  assert.equal(s.feesBilled, 300);
  assert.equal(s.feesPaid, 150);
  assert.equal(s.brokerageUpside, 5000);
});

test('CSV escapes commas/quotes; owner notice + digest include the fee', () => {
  const csv = toCsv([{ building_name: 'A, "B"', unit_number: '1' }]);
  assert.match(csv, /"A, ""B"""/);
  const n = buildOwnerNotice({ owner_name: 'Jane Owner', unit_number: '12B', building_name: '43 West Condominium', lease_end_date: '2026-12-28', fee_amount: 150, subtenant_name: 'Sam Sub' });
  assert.match(n.subject, /Apt 12B/);
  assert.match(n.text, /\$150 renewal filing fee/);
  assert.match(n.text, /Dear Jane/);
  const html = buildDigestHtml({ newlyInWindow: [], openInWindow: [{ unit_number: '12B', building_name: 'X', days_to_expiry: 75 }], fee: 150 });
  assert.match(html, /\$150/);
});

// ---------------------------------------------------------------------------
// Full scan with mocked Spire + in-memory Supabase
// ---------------------------------------------------------------------------
function fakeSupabase() {
  const tables = { sublet_renewals: [], sublet_renewal_activity: [], sublet_renewal_scans: [] };
  let id = 1;
  const q = (name) => {
    let rows = tables[name]; let filters = []; let op = 'select'; let payload = null;
    const api = {
      select() { return api; },
      in(col, vals) { filters.push((r) => vals.includes(r[col])); return api; },
      eq(col, v) { filters.push((r) => r[col] === v); if (op === 'update') return run(); return api; },
      not(col, _o, list) { const vals = list.replace(/[()]/g, '').split(','); filters.push((r) => !vals.includes(r[col])); return api; },
      insert(p) { op = 'insert'; payload = p; return api; },
      update(p) { op = 'update'; payload = p; return api; },
      single() { return run(true); },
      then(res, rej) { return run().then(res, rej); },
    };
    const run = async (single) => {
      if (op === 'insert') {
        const row = { id: id++, ...payload }; tables[name].push(row);
        return { data: single ? row : [row], error: null };
      }
      const matched = rows.filter((r) => filters.every((f) => f(r)));
      if (op === 'update') { matched.forEach((r) => Object.assign(r, payload)); return { data: matched, error: null }; }
      return { data: matched, error: null };
    };
    return api;
  };
  return { from: q, tables };
}

function fakeSpire() {
  const units = {
    7: [
      { BuildingRcd: 7, UnitRcd: 1, OccupancyRcd: 101, UnitNumber: '4A', OccupantName: 'Owner A', LeaseExpireDate: '2026-12-15', BaseRent: 3900 },
      { BuildingRcd: 7, UnitRcd: 2, OccupancyRcd: 102, UnitNumber: '5B', OccupantName: 'Owner B' }, // owner-occupied, no lease
      { BuildingRcd: 7, UnitRcd: 3, OccupancyRcd: 103, UnitNumber: '6C', OccupantName: 'Far Future', LeaseExpireDate: '2027-09-01' }, // outside horizon (filter ignored by server)
    ],
  };
  return {
    isConfigured: true,
    listBuildingsRaw: async () => ({ ok: true, data: { items: [COOP, RENTAL] } }),
    listUnitsFiltered: async ({ BuildingRcds }) => ({ ok: true, data: { items: units[BuildingRcds] || [] } }),
    getUnitContacts: async ({ occupancyRcd }) => ({ ok: true, data: { items: occupancyRcd === 101 ? [{ FirstName: 'Sub', LastName: 'Tenant', EmailAddress: 'sub@x.com', ContactCategoryDescriptions: 'Subtenant' }] : [] } }),
    getOccupant: async () => ({ ok: true, data: {} }),
  };
}

test('runSubletRenewalScan: co-op only, client-side date filter, idempotent upsert keeps workflow', async () => {
  const supabase = fakeSupabase();
  const now = new Date('2026-09-29T14:00:00Z');
  const r1 = await runSubletRenewalScan({ spire: fakeSpire(), supabase, env: {}, now, delayMs: 0 });
  assert.equal(r1.buildingsScanned, 1, 'rental building skipped');
  assert.equal(r1.subletsFound, 1);
  assert.equal(r1.inserted, 1);
  assert.equal(r1.enteredWindow, 1); // 77 days out
  const row = supabase.tables.sublet_renewals[0];
  assert.equal(row.subtenant_name, 'Sub Tenant');
  assert.equal(row.owner_name, 'Owner A');
  assert.equal(row.detection_confidence, 'confirmed');
  assert.equal(row.fee_amount, 150);
  assert.equal(row.status, 'identified');

  row.status = 'owner_notified'; row.assigned_to = 'Carl';
  const r2 = await runSubletRenewalScan({ spire: fakeSpire(), supabase, env: {}, now, delayMs: 0 });
  assert.equal(r2.inserted, 0);
  assert.equal(r2.updated, 1);
  assert.equal(r2.enteredWindow, 0);
  assert.equal(supabase.tables.sublet_renewals[0].status, 'owner_notified');
  assert.equal(supabase.tables.sublet_renewals[0].assigned_to, 'Carl');
  assert.equal(supabase.tables.sublet_renewal_scans.length, 2);
});

test('ops access middleware fails closed', async () => {
  const run = async (env, headers) => {
    let status = 200; let nexted = false;
    const res = { status(s) { status = s; return res; }, json() { return res; } };
    await createOpsAccessMiddleware({ env, getAuthClient: () => null })({ headers }, res, () => { nexted = true; });
    return nexted ? 'next' : status;
  };
  assert.equal(await run({}, {}), 503);
  assert.equal(await run({ CAMELOT_OPS_KEY: 'k1' }, {}), 401);
  assert.equal(await run({ CAMELOT_OPS_KEY: 'k1' }, { 'x-camelot-ops-key': 'nope' }), 401);
  assert.equal(await run({ CAMELOT_OPS_KEY: 'k1' }, { 'x-camelot-ops-key': 'k1' }), 'next');
});
