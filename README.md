# Camelot OS V10

**Property Intelligence & Lead Generation Platform**  
Built for Camelot Property Management Services Corp.

## What It Does

Camelot Scout is the core business development engine for Camelot Property Management. It finds buildings, identifies decision-makers, scores leads, runs outreach campaigns, and tracks the sales pipeline from discovery through closing.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your keys (see Configuration below)

# 3. Run development server
npm run dev
# → http://localhost:5173

# 4. Build for production
npm run build
```

## Configuration

### Required for Full Functionality
| Variable | Purpose | Required? |
|----------|---------|-----------|
| `VITE_SUPABASE_URL` | Supabase project URL | For persistent data (demo mode works without) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | For persistent data |
| `SUPABASE_URL` | Supabase project URL | Server authentication |
| `SUPABASE_ANON_KEY` | Supabase anon key | Server authentication |

### Optional Services
| Variable | Purpose |
|----------|---------|
| `AI_API_URL` | OpenAI-compatible API endpoint (server only) |
| `AI_API_KEY` or `OPENAI_API_KEY` | AI provider credential (server only) |
| `AI_MODEL` | Server model name (default: `gpt-4o-mini`) |
| `APOLLO_API_KEY` | Apollo.io contact enrichment (server only) |
| `PROSPEO_API_KEY` | Prospeo email verification (server only) |
| `HUBSPOT_PRIVATE_APP_TOKEN` | HubSpot CRM sync (server only) |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps embeds |

### What Works Without Any Configuration
- **Full UI** with demo data (10 NYC buildings with contacts, scores, pipeline stages)
- **NYC Open Data** APIs (HPD violations, DOF assessments, DOB permits, LL97 energy) — no API key needed
- **Lead scoring** algorithm
- **Pipeline management** (drag & drop Kanban)
- **Outreach templates** with variable substitution
- **CSV import/export**
- **Search** with region selector and advanced filters

### AI Chat Backend
The Scout AI chat feature works with **any OpenAI-compatible API**:
- **OpenAI** → `https://api.openai.com/v1/chat/completions`
- **OpenRouter** → `https://openrouter.ai/api/v1/chat/completions`
- **Anthropic (via proxy)** → Use a compatible proxy
- **Local LLMs** → Ollama (`http://localhost:11434/v1/chat/completions`), LM Studio, etc.

## Architecture

```
Frontend:  React + Vite + TypeScript + Tailwind CSS + shadcn/ui
State:     Zustand (global state management)
Database:  Supabase Postgres (with RLS policies)
Auth:      Supabase Auth (email/password)
APIs:      NYC Open Data (free), Apollo.io, Prospeo, HubSpot
AI:        Any OpenAI-compatible endpoint
```

## Pages (12)

| Page | Path | Description |
|------|------|-------------|
| **Search** | `/` | Quick building reports + region scanner |
| **Results** | `/results` | Property cards grid/list with filters |
| **Saved** | `/saved` | Folder-based property lists |
| **Import** | `/import` | CSV upload with column mapping |
| **Pipeline** | `/pipeline` | Kanban board (8 stages) |
| **Outreach** | `/outreach` | Email templates + composer |
| **Scout AI** | `/chat` | AI chat assistant |
| **Archive** | `/archive` | Dismissed/archived buildings |
| **Export** | `/export` | CSV/PDF/email export |
| **AI Bots** | `/bots` | Automated agent management |
| **Settings** | `/settings` | Service status, API keys, team, company |

## Database Schema

Run `supabase/migrations/001_initial_schema.sql` against your Supabase Postgres instance.

### Key Tables
- `scout_buildings` — Core building data, contacts (JSONB), scores, pipeline stages
- `scout_team` — Team members with roles
- `scout_scans` — Search/scan history
- `scout_activities` — Activity timeline per building
- `scout_outreach_templates` — Email templates with variables
- `scout_outreach_log` — Sent email tracking
- `scout_chat_messages` — AI chat history
- `scout_folders` / `scout_folder_buildings` — Saved lists
- `scout_bots` / `scout_bot_runs` — AI bot management
- `scout_settings` — App configuration

### Row Level Security
All tables have RLS enabled. Policies allow access for authenticated Supabase users.

## Lead Scoring Algorithm

Score 0–100. Grade A (75+), B (50–74), C (below 50).

| Factor | Weight | Logic |
|--------|--------|-------|
| HPD Violations | 0–30 | More violations = higher score |
| Building Size | 0–20 | 30+ units preferred |
| Current Management | 0–20 | Unknown/self-managed = highest |
| Building Age | 0–15 | Older = more maintenance needs |
| DOB Permits | 0–8 | Recent permits = capital planning |
| Energy/LL97 | 0–7 | Low Energy Star = compliance risk |

## NYC Open Data APIs (Free, No Key)

- **HPD Violations** — `wvxf-dwi5` — Violation history per building
- **HPD Registration** — `tesw-yqqr` — Owner and management company
- **DOF Property (PLUTO)** — `64uk-42ks` — Market value, assessed value, lot data
- **DOB Permits** — `ipu4-2vj7` — Permit history
- **LL97 Energy** — `7x5e-2fxh` — Energy Star scores, GHG emissions

## Team

Pre-configured team members:
- David Goldoff (Owner)
- Sam Lodge (Tech Lead)
- Carl (Cold Caller)
- Luigi (Operations)
- Jake, Valerie, Spencer, Danielle (Team)
- Merlin (Tech Lead / AI)

## Deployment

### Vercel
```bash
npm run build
# Deploy dist/ directory
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm install -g serve
CMD ["serve", "-s", "dist", "-l", "3000"]
```

## File Structure

```
camelot-scout-v6/
├── .env.example              # Environment variable template
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── index.html
├── supabase/migrations/
│   └── 001_initial_schema.sql  # Complete DB schema + seeds
├── src/
│   ├── main.tsx               # App entry
│   ├── App.tsx                # Router + layout
│   ├── index.css              # Tailwind + custom styles
│   ├── vite-env.d.ts          # Vite type declarations
│   ├── types/index.ts         # All TypeScript types
│   ├── lib/
│   │   ├── supabase.ts        # Supabase client
│   │   ├── ai-client.ts       # OpenAI-compatible AI client
│   │   ├── scoring.ts         # Lead scoring algorithm
│   │   ├── nyc-api.ts         # NYC Open Data API integration
│   │   ├── enrichment.ts      # Apollo.io + Prospeo
│   │   ├── email-templates.ts # Template variable engine
│   │   ├── regions.ts         # Region/area configuration
│   │   ├── store.ts           # Zustand global state
│   │   └── utils.ts           # Utility functions
│   ├── hooks/
│   │   ├── useBuildings.ts    # Building CRUD + demo data
│   │   ├── usePipeline.ts     # Pipeline stage management
│   │   └── useAuth.ts         # Authentication + team
│   ├── components/
│   │   ├── Layout.tsx         # Sidebar navigation
│   │   ├── PropertyCard.tsx   # Building card component
│   │   ├── PropertyDetail.tsx # Full property modal (8 tabs)
│   │   ├── PipelineBoard.tsx  # Kanban drag & drop
│   │   └── ChatInterface.tsx  # AI chat with streaming
│   └── pages/
│       ├── Search.tsx         # Quick reports + region scanner
│       ├── Results.tsx        # Grid/list view + filters
│       ├── Saved.tsx          # Folder management
│       ├── Import.tsx         # CSV import wizard
│       ├── Pipeline.tsx       # Kanban pipeline
│       ├── Outreach.tsx       # Templates + composer
│       ├── Chat.tsx           # Scout AI page
│       ├── Archive.tsx        # Archived buildings
│       ├── Export.tsx         # CSV/PDF/email export
│       ├── Bots.tsx           # AI bot management
│       └── Settings.tsx       # Configuration
└── public/
    └── favicon.png
```

---

*Built by Merlin for Camelot Property Management Services Corp.*
