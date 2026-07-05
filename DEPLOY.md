# Camelot OS — Deployment Guide

The app now deploys as a **Node web service** (not a static site). `server.js`
serves the built frontend from `dist/` **and** powers the `/api/*` backend
(HubSpot sync, Apollo enrichment, Scout scan/report, Daily Hunt, building
brand research).

## One-time: switch Render from Static Site to Web Service

The old static site (`camelot-scout-v6.onrender.com`) can't be converted in
place — create the web service, then retire the static one.

1. Render dashboard → **New +** → **Web Service**
2. Connect repo: `Camelot-Realty-Group/camelot-scout-v6`, branch `main`
3. Settings (should auto-fill from `render.yaml`):
   - Runtime: **Node**
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
4. Add Environment Variables (see below)
5. Deploy, verify, then **suspend/delete the old static site** and share the
   new URL with the team.

Free tier sleeps after 15 min of inactivity (30–60 s wake). Starter ($7/mo)
is always-on — recommended once the team uses it daily.

## Environment variables

### Build-time (baked into the frontend)

| Key | Value | Purpose |
| --- | --- | --- |
| `VITE_RUNTIME_MODE` | `server` | Tells the SPA a Node backend hosts it |
| `VITE_DISABLE_SERVER_INTEGRATIONS` | `false` | Enables HubSpot/Apollo/Daily Hunt UI |
| `VITE_SUPABASE_URL` | your project URL | Team logins + persistent data |
| `VITE_SUPABASE_ANON_KEY` | your anon key | Team logins + persistent data |

Without the Supabase pair the app runs in **demo mode** (works, but no logins
and nothing persists).

### Server-side (never exposed to the browser)

| Key | Where to get it | Enables |
| --- | --- | --- |
| `HUBSPOT_PRIVATE_APP_TOKEN` | HubSpot → Settings → Integrations → Private Apps → Create app → grant `crm.objects.*` read/write scopes → copy token | CRM contact/company/deal sync |
| `APOLLO_API_KEY` | apollo.io → Settings → API | Contact enrichment |
| `HUBSPOT_DEAL_STAGE_ID` (optional) | HubSpot → Settings → Objects → Deals → Pipelines (stage internal ID) | Deal creation in pipeline |
| `HUBSPOT_PIPELINE_ID` (optional) | Same page (pipeline internal ID) | Deal pipeline targeting |
| `HUBSPOT_CREATE_TASKS` (optional) | set to `true` | Follow-up task creation |
| `HUBSPOT_PORTAL_ID` (optional) | HubSpot account ID (top-right menu) | Deep links to deals in results |

**IMPORTANT:** changing any `VITE_*` variable requires a **redeploy** (they
are baked in at build time). Server-side keys take effect on restart.

## Supabase setup (team logins)

1. Create a project at supabase.com (Project Settings → API has the URL + anon key)
2. SQL Editor → run ALL `supabase/migrations/` files in order (001 → 010;
   note there are two files prefixed `009_` — run both)
3. Auth → Users → create accounts for:
   - dgoldoff@camelot.nyc (David Goldoff — Owner)
   - sam@camelot.nyc (Sam Lodge — Tech Lead)
   - carl@camelot.nyc (Carl Harkien — Sales)
   - luigi@camelot.nyc (Luigi — Operations)
4. Put the URL + anon key in Render env vars and redeploy

## Verifying a deploy

- `https://<service>.onrender.com/api/health` → `{"status":"ok",...}` with
  `hubspot: true` / `apollo: true` when keys are set
- `https://<service>.onrender.com/api/integrations/status` → shows what's configured
- In-app QA console: `/#/qa`

## CI

Every push to `main` runs GitHub Actions (`.github/workflows/ci.yml`):
typecheck + build, lint, QA route scan, and a server smoke test. Check the
Actions tab before assuming a deploy failure is Render's fault.
