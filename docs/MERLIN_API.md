# Merlin API

Merlin is the command center inside Camelot OS. An external agent can read and write tasks, templates, marketing campaigns, and an activity log through the routes below. The Camelot OS staff UI uses the same routes.

Base URL on the running service: `https://camelot-os.onrender.com`

All paths are rooted at `/api/merlin`. Send and receive JSON (`Content-Type: application/json`).

## Authentication

| Variable | Where | Purpose |
| --- | --- | --- |
| `MERLIN_API_TOKEN` | Server only (Render / `.env`). Never prefix with `VITE_`. | Optional shared bearer token for agents. |

- When `MERLIN_API_TOKEN` is **unset**, routes accept calls the same way the rest of the internal Camelot OS API does.
- When it is **set**, every `/api/merlin/*` call except the session handshake must prove it:
  - An agent sends `Authorization: Bearer <MERLIN_API_TOKEN>`.
  - A staff browser posts the same token once to `POST /api/merlin/session`. The server sets an HttpOnly, SameSite=Strict cookie (`merlin_session`) for 12 hours. Later GETs from that browser send the cookie. The token is not written into the frontend bundle.
  - `GET /api/merlin/session` reports `{ "required": true, "authenticated": false }` until one of those credentials is present.
  - The `Origin` header is not accepted as proof. A wrong or missing credential returns `401`.

## Storage

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Server Supabase URL. Intended project ref: `lwfvbcmopyvyrtgkgluo` (`https://lwfvbcmopyvyrtgkgluo.supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Preferred server key. Bypasses RLS so the agent can write. |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Fallback only. Anon access is revoked on these tables. |

Apply `supabase/migrations/028_merlin_command_center.sql` in the Supabase SQL editor or CLI. This repository does not run that migration for you.

If Supabase is not configured, the process keeps records in memory and returns `"storage": "memory"`. Memory starts empty and is wiped on restart. It is not sample business data.

If Supabase is configured but the migration has not been applied, list endpoints return `"warning"` and an empty array. Creates return `503` with an explanation. Activity logging returns HTTP 200 with `"logged": false` so the QA console does not throw a browser console error.

## Resources

### Tasks — `tasks`

| Field | Notes |
| --- | --- |
| `title` | Required. Max 200 characters. |
| `description` | Optional. |
| `status` | `open`, `in_progress`, `blocked`, `done`, `cancelled`. Default `open`. |
| `priority` | `low`, `normal`, `high`, `urgent`. Default `normal`. |
| `building_label` | Free-text building name or address. Not a foreign key. |
| `assignee` | Free-text person. |
| `due_at` | ISO-8601 timestamp, or `null`. |
| `source` | Default `manual`. Use `merlin` when the agent creates the row. |
| `created_by` | Optional actor name. |

### Templates — `templates`

| Field | Notes |
| --- | --- |
| `title` | Required. |
| `slug` | Optional. Generated from the title when omitted. Unique. |
| `category` | Default `General`. |
| `kind` | `proposal`, `letter`, `notice`, `board_report`, `email`, `other`. |
| `body` | The copy staff can preview and copy. Empty string is allowed. |
| `description` | Optional. |
| `source` | Default `library`. |

The in-app Template Library also lists the existing Camelot document catalog (agreements, notices, board forms) served from `/templates`. Those files are not duplicated into this table until someone saves a copy through the API.

### Campaigns — `marketing_campaigns`

| Field | Notes |
| --- | --- |
| `name` | Required. |
| `channel` | Optional (`email`, `postcard`, `proposal`, `outreach`, …). |
| `status` | `draft`, `active`, `paused`, `completed`. Default `draft`. |
| `audience` | Optional. |
| `summary` | Optional. |
| `owner` | Optional. |

Scout, Instant Proposal, Jackie engagement reports, outreach, and the pipeline stay in their existing screens. This table is the campaign register Merlin can query. It is not a substitute for those tools.

### Activity — `merlin_activity_log`

| Field | Notes |
| --- | --- |
| `actor` | Default `merlin`. |
| `action` | Required. Short verb, for example `command`, `content_run`, `task_created`. |
| `module` | Optional (`tasks`, `marketing`, `templates`, `qa_console`, …). |
| `summary` | Optional sentence. |
| `metadata` | JSON object. |

## Endpoints

### Summary

`GET /api/merlin/summary`

```json
{
  "storage": "memory",
  "warning": null,
  "tasks": { "total": 0, "open": 0, "in_progress": 0, "blocked": 0, "done": 0, "cancelled": 0 },
  "campaigns": { "total": 0, "draft": 0, "active": 0, "paused": 0, "completed": 0 },
  "templates": { "total": 0 },
  "activity": []
}
```

### Tasks

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/api/merlin/tasks` | Query: `status`, `assignee`, `building`, `q` |
| `POST` | `/api/merlin/tasks` | Task fields. `201` and the row. |
| `GET` | `/api/merlin/tasks/:id` | |
| `PATCH` | `/api/merlin/tasks/:id` | Any subset of task fields. |
| `DELETE` | `/api/merlin/tasks/:id` | `204` |

Create:

```bash
curl -s -X POST https://camelot-os.onrender.com/api/merlin/tasks \
  -H "Authorization: Bearer $MERLIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Collect the May financials","assignee":"Ops","building_label":"Example House","priority":"high","source":"merlin"}'
```

List the queue:

```bash
curl -s "https://camelot-os.onrender.com/api/merlin/tasks?status=open&priority=high"
```

`priority` is not a list filter. Filter priority on the client, or patch status as the queue moves.

### Templates

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/api/merlin/templates` | Query: `q`, `kind`, `category` |
| `POST` | `/api/merlin/templates` | Template fields. `201`. |
| `GET` | `/api/merlin/templates/:id` | |
| `PATCH` | `/api/merlin/templates/:id` | |
| `DELETE` | `/api/merlin/templates/:id` | `204` |

```bash
curl -s -X POST https://camelot-os.onrender.com/api/merlin/templates \
  -H "Authorization: Bearer $MERLIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Board meeting notice","kind":"notice","category":"Board & Governance","body":""}'
```

### Campaigns

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/api/merlin/campaigns` | Query: `status`, `channel`, `q` |
| `POST` | `/api/merlin/campaigns` | Campaign fields. `201`. |
| `GET` | `/api/merlin/campaigns/:id` | |
| `PATCH` | `/api/merlin/campaigns/:id` | |
| `DELETE` | `/api/merlin/campaigns/:id` | `204` |

### Activity

| Method | Path |
| --- | --- |
| `GET` | `/api/merlin/activity?limit=50&q=` |
| `POST` | `/api/merlin/activity` |

```bash
curl -s -X POST https://camelot-os.onrender.com/api/merlin/activity \
  -H "Authorization: Bearer $MERLIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"actor":"merlin","action":"command","module":"tasks","summary":"Reviewed the open queue.","metadata":{}}'
```

## Errors

| Status | When |
| --- | --- |
| `400` | Missing title/name/action, or a status/kind outside the allowed list. |
| `401` | Token required or wrong. |
| `404` | Unknown id. |
| `503` | Supabase rejected a create or update (migration missing, or the service-role key is absent and RLS blocked the write). |

List responses stay `200` with an empty array and `warning` when the tables are missing, so the home screen can show an honest empty state.
