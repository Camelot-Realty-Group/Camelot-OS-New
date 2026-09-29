# Sublet Renewal Tracker

Finds co-op/condo **sublet** leases expiring soon across the Camelot-managed
portfolio (Spire MDS), turns them into a trackable work queue, and emails the
team. Page: **Portfolio → Sublet Renewals** (`/sublet-renewals`).

## Why
- **Renewal filing fee.** The owner does the renewal paperwork (and any board
  approval); Camelot files it in the building record and bills the owner a
  renewal fee (default **$150**, the same way FirstService re-registers the rental).
- **Brokerage.** An owner who isn't renewing needs a new subtenant, or may sell.
  Camelot Brokerage gets there first.

## How it works
1. **Daily after 6 AM ET** (and on "Scan MDS now") the server pulls every
   co-op/condo building from Spire (`/RM/BuildingsList`), then
   `/RM/UnitsList?BuildingRcds=…&LeaseEndFrom=…&LeaseEndTo=…` for leases ending
   between 30 days ago and 120 days out (re-filtered client-side).
2. For each hit it reads `/RM/Contacts` + `/RM/Occupant` to split **owner**
   vs **subtenant**, get authoritative lease dates, and the owner's billing address.
3. Rows are upserted into `sublet_renewals` (migration 028). Scans never
   overwrite status, fee, assignee, notes, or confirmed rent.
4. **Digest email** to `SUBLET_RENEWAL_RECIPIENTS` whenever something newly
   enters the 60–90 day window, and a full list every Monday (CSV attached).
5. From the page: assign, set follow-up, send the **owner renewal notice**
   (preview first, then send), track the fee (not billed → billed → paid), or
   flag for brokerage.

## Sublet detection (calibrate on day one)
Spire has no "is sublet" flag, so two signals are combined:
- **Confirmed**: a category, status code, or contact category matching
  `SUBLET_CATEGORY_PATTERN` (default matches Sublet / Subtenant / Sublessee…).
- **Likely / verify**: a lease date on a unit in a co-op/condo building
  (owners don't have leases).

Run `GET /api/renewals/sublets/diagnostics?buildings=10` once live to see
the actual category/status values Camelot's MDS uses, then set
`SUBLET_CATEGORY_PATTERN` if they differ.

## Setup
1. Supabase SQL editor: run `supabase/migrations/028_sublet_renewals.sql`.
2. Render → Environment:
   | Var | Value |
   |---|---|
   | `CAMELOT_OPS_KEY` | **required**: a long random string; staff enter it once per browser |
   | `SUBLET_RENEWAL_RECIPIENTS` | e.g. `info@camelot.nyc,sam@camelot.nyc` |
   | `SUBLET_RENEWAL_FEE` | optional, default `150` |
   | `SUBLET_CATEGORY_PATTERN` | optional regex after calibration |
   | `SUBLET_INCLUDE_RENTALS` | optional `true` to also scan rental buildings |
   | `SUBLET_RENEWALS_SCHEDULER` | `off` to disable the daily run |
   Existing `SPIRE_MDS_API_KEY`, `SPIRE_MDS_CLIENT_SECRET`, `SUPABASE_*`, and
   `RESEND_API_KEY` are reused.
3. Deploy, open `/sublet-renewals`, enter the ops key, click **Scan MDS now**.

## Security
The table holds subtenant PII. RLS is on with no browser policies, and every
route requires a Supabase session **or** the `X-Camelot-Ops-Key` header. With
neither configured, the routes refuse to serve anything.

## Not yet (next steps)
- Post the $150 fee straight to the owner's MDS ledger via `/RM/AddCharges`
  (needs the charge code, and a human approves each post).
- Push brokerage opportunities to HubSpot as deals.
- Write back the renewed lease dates to MDS (`/RM/EditOccupant`).
