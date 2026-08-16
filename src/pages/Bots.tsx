import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BotStatus } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import { SCOUT_AGENT_DOCTRINES } from '@/lib/scout-ai-doctrines';
import { CAMELOT_BOT_OPERATING_MODEL, JACKIE_SPLIT_RULES } from '@/lib/camelot-bot-operating-model';
import { NY_OWNERSHIP_HUNT_SOURCE_NAMES, NY_PEOPLE_ENTITY_COMP_SOURCE_NAMES } from '@/lib/ny-research-sources';
import { CAMELOT_ACQUISITION_PIPELINE, JACKIE_ACQUISITION_FIT_SECTIONS, SENTINEL_HANDOFF_RULES } from '@/lib/acquisition-pipeline';
import { TWIN_KNOWLEDGE_IMPORTED_AT, TWIN_KNOWLEDGE_PROJECTS, TWIN_KNOWLEDGE_STATS } from '@/lib/twin-knowledge';
import {
  AlertCircle,
  Archive,
  Bot as BotIcon,
  CheckCircle,
  Clock,
  Crown,
  Database,
  FileText,
  Gavel,
  GitBranch,
  Landmark,
  Mail,
  Megaphone,
  Pause,
  Play,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';

type BotSource = {
  name: string;
  kind: 'Drive' | 'Repo' | 'Generated' | 'Twin';
  status: 'synced' | 'reference' | 'pending';
};

type DashboardBot = {
  id: string;
  name: string;
  type: string;
  description: string;
  status: BotStatus;
  owner: string;
  last_run_at?: string;
  tasks_completed: number;
  tasks_queued: number;
  outputs: string[];
  quality_gates: string[];
  sources: BotSource[];
  actions: { label: string; href: string; icon: typeof BotIcon }[];
  error_message?: string;
};

type BotRun = {
  id: string;
  bot_id: string;
  status: 'completed' | 'failed' | 'queued';
  summary: string;
  started_at: string;
};

const DRIVE_FOLDER = 'Google Drive folder 1T6WD8q-2h9Cq1kxCwFmIcdb4lo-A3EAF';

const doctrineById = Object.fromEntries(SCOUT_AGENT_DOCTRINES.map((agent) => [agent.id, agent]));
const NY_WEB_SOURCE_CARDS: BotSource[] = NY_PEOPLE_ENTITY_COMP_SOURCE_NAMES.map((name) => ({
  name: `NY web source: ${name}`,
  kind: 'Generated',
  status: 'reference',
}));
const NY_OWNERSHIP_HUNT_SOURCE_CARDS: BotSource[] = NY_OWNERSHIP_HUNT_SOURCE_NAMES.map((name) => ({
  name: `NY ownership hunt: ${name}`,
  kind: 'Generated',
  status: 'reference',
}));
const TWIN_KNOWLEDGE_SOURCE_CARDS: BotSource[] = TWIN_KNOWLEDGE_PROJECTS.map((project) => ({
  name: `Twin AI: ${project.name}`,
  kind: 'Twin',
  status: project.instructionChars > 0 ? 'synced' : 'pending',
}));

const DEMO_BOTS: DashboardBot[] = [
  {
    id: 'twin-knowledge',
    name: 'Twin AI Knowledge Vault',
    type: 'integrations',
    description:
      'Imported Twin AI projects and instruction builds are now available inside Camelot OS as a searchable bot knowledge layer for future Scout, Jackie, Sentinel, Merlin, Excalibur, and operations workflows.',
    status: 'active',
    owner: 'Camelot OS',
    tasks_completed: TWIN_KNOWLEDGE_STATS.instructionBackedProjects,
    tasks_queued: TWIN_KNOWLEDGE_STATS.totalProjects - TWIN_KNOWLEDGE_STATS.instructionBackedProjects,
    last_run_at: TWIN_KNOWLEDGE_IMPORTED_AT,
    outputs: [
      `${TWIN_KNOWLEDGE_STATS.totalProjects} Twin projects inventoried`,
      `${TWIN_KNOWLEDGE_STATS.instructionBackedProjects} instruction-backed projects cataloged`,
      'Project purpose, workflow steps, headings, and metadata are available in Camelot OS',
      'Ready for mapping into Scout, Jackie, Sentinel, Merlin, Excalibur, and content workflows',
    ],
    quality_gates: [
      'Twin API token verified through read-only workspace and agent endpoints',
      'Every available Twin instruction build exported before app integration',
      'Projects without instruction content are marked pending instead of treated as complete',
      'No public report output is changed automatically until each Twin skill is mapped to a Camelot OS bot',
    ],
    sources: TWIN_KNOWLEDGE_SOURCE_CARDS,
    actions: [
      { label: 'Merlin AI', href: '/chat', icon: Sparkles },
      { label: 'Property Engagement Reports', href: '/report-center', icon: Crown },
      { label: 'Content Engine', href: '/content-engine', icon: Megaphone },
      { label: 'Integrations', href: '/integrations', icon: GitBranch },
    ],
  },
  {
    id: 'dailyhunt',
    name: 'Daily Hunt Lead Verifier',
    type: 'dailyhunt',
    description:
      'Imports property lists, Kimi/Twin/Claude handoffs, saved-search leads, and Merlin inbox signals into a verified Scout lead queue before Pipeline, HubSpot, outreach, or reports.',
    status: 'active',
    owner: 'Scout / Merlin',
    tasks_completed: 84,
    tasks_queued: 0,
    last_run_at: '2026-05-25T18:00:00.000Z',
    outputs: [
      'Daily verified lead queue',
      'Corrected / rejected / unverified lead stats',
      'Source trail and verification panel',
      'Pipeline-ready next actions',
      'Merlin inbox and outbound audit path',
    ],
    quality_gates: [
      ...(doctrineById.dailyhunt?.releaseGates || []),
      'CSV/XLSX imports are candidate lists only until verifier checks unit count, owner, status, and contact path',
      'Kimi, Twin, Claude, and other AI research outputs are not accepted as final verification',
      'Demo fallback rows cannot mutate Supabase records',
      'No outreach or HubSpot push without verification status and contact-source trail',
    ],
    sources: [
      { name: 'reference/claude-daily-hunt/VERIFICATION_GATE.md', kind: 'Repo', status: 'synced' },
      { name: 'reference/claude-daily-hunt/lead-verifier_SKILL.md', kind: 'Repo', status: 'synced' },
      { name: 'reference/claude-daily-hunt/leads_2026-05-25.csv', kind: 'Repo', status: 'synced' },
      { name: 'supabase/migrations/007_lead_hunt.sql', kind: 'Repo', status: 'synced' },
      { name: 'supabase/migrations/008_merlin_inbox.sql', kind: 'Repo', status: 'synced' },
      ...NY_WEB_SOURCE_CARDS,
      ...NY_OWNERSHIP_HUNT_SOURCE_CARDS,
    ],
    actions: [
      { label: 'Daily Hunt', href: '/daily-hunt', icon: RefreshCw },
      { label: 'Results', href: '/results', icon: Database },
      { label: 'Pipeline', href: '/pipeline', icon: RefreshCw },
      { label: 'Outreach', href: '/outreach', icon: Mail },
    ],
  },
  {
    id: 'jackie',
    name: 'Jackie Pitch Engine',
    type: 'jackie',
    description:
      'Builds a full new-business pitch package: property intelligence report, transition plan, management agreement, and review-ready email draft.',
    status: 'active',
    owner: 'David Goldoff',
    tasks_completed: 7,
    tasks_queued: 1,
    last_run_at: new Date(Date.now() - 1000 * 60 * 21).toISOString(),
    outputs: ['Property Intelligence PDF', '90-Day Transition Plan', 'Management Agreement PDF', 'Gmail draft'],
    quality_gates: [
      'Pre-publish lock blocks GitHub, Render, email, PDF, and dashboard release until verified',
      'Subject property address verified against source property record',
      'Address matches across report, proposal, agreement, email draft, filenames, and dashboard labels',
      'Fixes, errors, script runs, builds, and smoke tests rechecked clean after final edit',
      '42 properties and Founded 2006 facts locked',
      'BankUnited callout included',
      'Active Now vs Deploying 2026 tech table',
      '32BJ and LL97 checks applied when relevant',
      'Commercial and amenity sources checked: LoopNet, CoStar, PropertyShark, HPD, DOF, DOB/DOT parking, operators, StreetEasy, official site',
      'No self-managed language unless confirmed; known staffed buildings show board/staff/management context',
      'Gut Check, Quarterly Market Reports, DOF link, partner logos, case studies, and duplicate closing pages verified',
      'Acquisition-fit mode sits after Sentinel and before Arthur: no financial underwriting until Jackie validates operations',
      'Acquisition Fit Brief includes current management, building condition, compliance, tenant base, vendor/super landscape, 90-day plan, value-add levers, red flags, capex and score',
    ],
    sources: [
      { name: 'Jackie_SKILL_Updated.md', kind: 'Drive', status: 'synced' },
      { name: 'build_jackie_manual.py', kind: 'Drive', status: 'reference' },
      { name: 'build_tur_proposal.py', kind: 'Drive', status: 'reference' },
      { name: 'build_tur_agreement.py', kind: 'Drive', status: 'reference' },
      { name: 'reference/jackie-skill.md', kind: 'Repo', status: 'synced' },
      ...NY_WEB_SOURCE_CARDS,
      ...NY_OWNERSHIP_HUNT_SOURCE_CARDS,
    ],
    actions: [
      { label: 'Instant Proposal', href: '/instant-proposal', icon: Zap },
      { label: 'Proposal Library', href: '/proposals', icon: FileText },
      { label: 'Property Engagement Reports', href: '/report-center', icon: Crown },
      { label: 'Agreements', href: '/agreements', icon: ShieldCheck },
    ],
  },
  {
    id: 'arthur',
    name: 'Arthur Financial Underwriter',
    type: 'arthur',
    description:
      'Runs institutional acquisition underwriting only after Sentinel finds the deal and Jackie validates the operating thesis, capex, lease-up and compliance path.',
    status: 'idle',
    owner: 'Camelot Acquisition & Equity Group',
    tasks_completed: 0,
    tasks_queued: 0,
    outputs: ['Base/downside/upside/lender models', 'Investor deck', 'Lender deck', 'Sponsor summary', 'LOI'],
    quality_gates: [
      ...(doctrineById.arthur?.releaseGates || []),
      'Arthur receives Jackie-validated capex, lease-up timeline, rent assumptions, transition cost and compliance cost',
      'No Arthur model runs on Sentinel-only leads',
      'Caveats from Jackie become sensitivity cases',
    ],
    sources: [
      { name: 'src/lib/acquisition-pipeline.ts', kind: 'Repo', status: 'synced' },
      { name: 'Jackie Acquisition Fit Brief', kind: 'Generated', status: 'reference' },
      { name: 'Sentinel Memo', kind: 'Generated', status: 'reference' },
      ...NY_WEB_SOURCE_CARDS,
      ...NY_OWNERSHIP_HUNT_SOURCE_CARDS,
    ],
    actions: [
      { label: 'Arthur Underwriting', href: '/arthur', icon: Landmark },
      { label: 'Sentinel', href: '/sentinel', icon: Sparkles },
      { label: 'Property Engagement Reports', href: '/report-center', icon: Crown },
      { label: 'Integrations', href: '/integrations', icon: GitBranch },
    ],
  },
  {
    id: 'merlin',
    name: 'Merlin Operating Copilot',
    type: 'merlin',
    description:
      'Answers operational, pipeline, compliance, market, proposal, staffing, and savings questions with the same fact discipline as Jackie.',
    status: 'active',
    owner: 'Camelot OS',
    tasks_completed: 64,
    tasks_queued: 2,
    last_run_at: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    outputs: ['Pipeline brief', 'Board talking points', 'Outreach draft', 'Savings plan', 'Verification checklist'],
    quality_gates: [
      ...(doctrineById.merlin?.releaseGates || []),
      'Local quick actions work without an external AI backend',
      'Answers identify missing documents instead of inventing them',
      'Client-facing copy says Camelot, not internal bot language',
    ],
    sources: [
      { name: 'src/lib/ai-client.ts', kind: 'Repo', status: 'synced' },
      { name: 'src/lib/scout-ai-doctrines.ts', kind: 'Repo', status: 'synced' },
      { name: 'src/components/ChatInterface.tsx', kind: 'Repo', status: 'synced' },
      ...NY_WEB_SOURCE_CARDS,
      ...NY_OWNERSHIP_HUNT_SOURCE_CARDS,
    ],
    actions: [
      { label: 'Chat', href: '/chat', icon: Sparkles },
      { label: 'Pipeline', href: '/pipeline', icon: RefreshCw },
      { label: 'Outreach', href: '/outreach', icon: Mail },
    ],
  },
  {
    id: 'merlin-content',
    name: 'Merlin Content Distribution Engine',
    type: 'content',
    description:
      'Generates, reviews, schedules, publishes, and tracks Camelot thought leadership across WordPress, social, email, and video with human approval required.',
    status: 'active',
    owner: 'Camelot Growth',
    tasks_completed: 4,
    tasks_queued: 3,
    last_run_at: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    outputs: ['Approval queue', 'Weekly content calendar', 'SEO/social prompts', 'Integration health map', 'Performance snapshot'],
    quality_gates: [
      'No content publishes without explicit human approval',
      'David personal cell number is prohibited in every output',
      'Every public item includes approved Camelot CTA and office contact',
      'No negative competitor mentions by name',
      'Resident/client data excluded unless explicitly approved',
      'Every status change keeps an audit trail',
    ],
    sources: [
      { name: 'src/lib/content-engine.ts', kind: 'Repo', status: 'synced' },
      { name: 'WordPress REST API plan', kind: 'Generated', status: 'reference' },
      { name: 'Social distribution prompt library', kind: 'Generated', status: 'reference' },
    ],
    actions: [
      { label: 'Content Engine', href: '/content-engine', icon: Megaphone },
      { label: 'Integrations', href: '/integrations', icon: GitBranch },
      { label: 'Tutorials', href: '/tutorials', icon: Sparkles },
    ],
  },
  {
    id: 'scout',
    name: 'Scout Market Intelligence',
    type: 'scout',
    description:
      'Finds target buildings, scores opportunities, enriches owner/manager data, and moves qualified leads into the pipeline.',
    status: 'active',
    owner: 'Scout',
    tasks_completed: 156,
    tasks_queued: 8,
    last_run_at: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
    outputs: ['Lead scores', 'Violation signals', 'Owner intel', 'Pipeline tasks'],
    quality_gates: [
      ...(doctrineById.scout?.releaseGates || []),
      'Source address verified before content is exported or published',
      'HPD/DOF/DOB or state/local equivalents checked',
      'Pipeline stage updated with the next useful action',
      'Image, owner, management and unit-count enrichment gaps flagged',
    ],
    sources: [
      { name: 'src/lib/scoring.ts', kind: 'Repo', status: 'synced' },
      { name: 'src/lib/nyc-api.ts', kind: 'Repo', status: 'synced' },
      { name: 'Scout_Unit_Intelligence.html', kind: 'Drive', status: 'pending' },
      ...NY_WEB_SOURCE_CARDS,
      ...NY_OWNERSHIP_HUNT_SOURCE_CARDS,
    ],
    actions: [
      { label: 'Search', href: '/', icon: Database },
      { label: 'Pipeline', href: '/pipeline', icon: RefreshCw },
      { label: 'Reports', href: '/reports', icon: FileText },
    ],
  },
  {
    id: 'sentinel',
    name: 'Sentinel Market Watch',
    type: 'sentinel',
    description:
      'Packages market signals and competitor intelligence into reports for buildings that need a sharper follow-up angle.',
    status: 'idle',
    owner: 'Camelot OS',
    tasks_completed: 18,
    tasks_queued: 2,
    last_run_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    outputs: ['Market report', 'Competitive summary', 'Pricing context'],
    quality_gates: [
      ...(doctrineById.sentinel?.releaseGates || []),
      'Subject property address checked against selected market source',
      'Charts, maps, comps and neighborhood proof included',
      'No broken links or missing sections before publish',
    ],
    sources: [
      { name: 'reference/sentinel_generate_report.py', kind: 'Repo', status: 'synced' },
      { name: 'reference/sentinel_parse_realtymx.py', kind: 'Repo', status: 'synced' },
      ...NY_WEB_SOURCE_CARDS,
      ...NY_OWNERSHIP_HUNT_SOURCE_CARDS,
    ],
    actions: [
      { label: 'Sentinel', href: '/sentinel', icon: Sparkles },
      { label: 'Intelligence', href: '/intelligence', icon: Database },
    ],
  },
  {
    id: 'integrations',
    name: 'Scout + HubSpot Sync Bot',
    type: 'integrations',
    description:
      'Audits lead quality, routes qualified buildings, pushes records to Scout and HubSpot, and prepares the feedback loop for outcome tracking.',
    status: 'active',
    owner: 'Scout',
    tasks_completed: 12,
    tasks_queued: 1,
    last_run_at: new Date(Date.now() - 1000 * 60 * 13).toISOString(),
    outputs: ['Lead Quality Audit', 'Scout API push', 'HubSpot contact sync', 'Routing tags', 'Sync status report', 'Daily manager review'],
    quality_gates: [
      'SCOUT_API_URL, SCOUT_API_KEY, SCOUT_WORKSPACE_ID, and HUBSPOT_PRIVATE_APP_TOKEN validation visible before push',
      'Single-word contact names do not duplicate into firstname and lastname',
      'HubSpot associations use the v3 batch endpoint before deal linkage is considered complete',
      'Every bot activity includes property, contact, CTA scenario, next task, due date, and recommended pipeline stage before HubSpot sync',
      'CTA scenarios cover compliance, LL97, financing, board management, transition, vendor savings, arrears, capital projects, resident experience, proposals, and new engagements',
      'HubSpot rollout script runs dry-run by default; --apply is required before custom fields are created or updated',
      'Daily HubSpot review flags unassigned deals, missing report links, low-confidence records, and proposal follow-ups',
      'No lead is pushed without property address and quality/routing metadata',
      'Lead Generator Deployment Prompt covers hybrid batch processing, real-time webhooks, Slack alerts, Scout export, and HubSpot sync',
      'Bidirectional Scout outcome and HubSpot deal status sync is tracked as the next lifecycle phase',
    ],
    sources: [
      { name: 'src/pages/Integrations.tsx', kind: 'Repo', status: 'synced' },
      { name: 'src/lib/integrations.ts', kind: 'Repo', status: 'synced' },
      { name: 'server.js /api/integrations/*', kind: 'Repo', status: 'synced' },
      { name: 'scripts/hubspot-rollout.mjs', kind: 'Repo', status: 'synced' },
      { name: 'docs/HUBSPOT_CAMELOT_OS_OPERATING_MODEL.md', kind: 'Repo', status: 'synced' },
    ],
    actions: [
      { label: 'Integrations', href: '/integrations', icon: GitBranch },
      { label: 'Export', href: '/export', icon: FileText },
      { label: 'Pipeline', href: '/pipeline', icon: RefreshCw },
    ],
  },
  {
    id: 'guardian',
    name: 'Guardian Compliance Shield',
    type: 'guardian',
    description:
      'Turns violations, liens, lawsuits, LL97/FISP, insurance, claims, and release blockers into a source-checked risk plan.',
    status: 'active',
    owner: 'Camelot OS',
    tasks_completed: 42,
    tasks_queued: 3,
    last_run_at: new Date(Date.now() - 1000 * 60 * 17).toISOString(),
    outputs: ['Compliance risk brief', 'Violation resolution plan', 'LL97/FISP workplan', 'Release blocker memo'],
    quality_gates: [
      ...(doctrineById.guardian?.releaseGates || []),
      'State-specific compliance language only',
      'All-zero result must show source coverage and confidence',
      'Current management score reconciled against liens, violations, claims, and court signals',
    ],
    sources: [
      { name: 'src/lib/nyc-violations.ts', kind: 'Repo', status: 'synced' },
      { name: 'src/lib/nyc-api.ts', kind: 'Repo', status: 'synced' },
      { name: 'src/lib/ll97-calculator.ts', kind: 'Repo', status: 'synced' },
      { name: 'src/lib/gut-check.ts', kind: 'Repo', status: 'synced' },
      ...NY_WEB_SOURCE_CARDS,
      ...NY_OWNERSHIP_HUNT_SOURCE_CARDS,
    ],
    actions: [
      { label: 'Shield', href: '/compliance', icon: ShieldCheck },
      { label: 'Violations', href: '/violations', icon: AlertCircle },
      { label: 'Reports', href: '/reports', icon: FileText },
    ],
  },
  {
    id: 'excalibur',
    name: 'Excalibur Proposal Engine',
    type: 'excalibur',
    description:
      'Builds proposal logic, fee comparisons, service menus, rate assumptions, agreement support, and board-safe scope language.',
    status: 'active',
    owner: 'Camelot OS',
    tasks_completed: 26,
    tasks_queued: 4,
    last_run_at: new Date(Date.now() - 1000 * 60 * 36).toISOString(),
    outputs: ['Fee comparison', 'Service menu', 'Proposal of services', 'Agreement checklist'],
    quality_gates: [
      ...(doctrineById.excalibur?.releaseGates || []),
      'Camelot minimum fee rules applied',
      'Ancillary services separated from included services',
      'Formal proposal waits for budget, audited financials, prior report, and service scope',
    ],
    sources: [
      { name: 'Management agreement rate sheet', kind: 'Drive', status: 'reference' },
      { name: 'src/lib/pitch-report.ts', kind: 'Repo', status: 'synced' },
      { name: 'src/pages/InstantProposal.tsx', kind: 'Repo', status: 'synced' },
      ...NY_WEB_SOURCE_CARDS,
      ...NY_OWNERSHIP_HUNT_SOURCE_CARDS,
    ],
    actions: [
      { label: 'Instant Proposal', href: '/instant-proposal', icon: Zap },
      { label: 'Agreements', href: '/agreements', icon: Gavel },
      { label: 'Report Center', href: '/report-center', icon: Crown },
    ],
  },
  {
    id: 'outreach',
    name: 'Outreach Follow-Up Bot',
    type: 'outreach',
    description:
      'Turns building status, proposal activity, and nurture timing into next-step reminders and draft outreach.',
    status: 'paused',
    owner: 'Sales',
    tasks_completed: 31,
    tasks_queued: 5,
    last_run_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    outputs: ['Follow-up prompts', 'Email drafts', 'Pipeline nudges'],
    quality_gates: [
      ...(doctrineById.outreach?.releaseGates || []),
      'Property address verified before any draft is handed off',
      'Draft only, never auto-send',
      'Building context and selected report focus included',
      'Corrections rechecked clean before release',
    ],
    sources: [
      { name: 'src/lib/email-templates.ts', kind: 'Repo', status: 'synced' },
      { name: 'src/pages/Outreach.tsx', kind: 'Repo', status: 'synced' },
      ...NY_WEB_SOURCE_CARDS,
      ...NY_OWNERSHIP_HUNT_SOURCE_CARDS,
    ],
    actions: [
      { label: 'Outreach', href: '/outreach', icon: Mail },
      { label: 'Archive', href: '/archive', icon: Archive },
    ],
  },
];

const DEMO_RUNS: BotRun[] = [
  {
    id: 'run-dailyhunt-1',
    bot_id: 'dailyhunt',
    status: 'completed',
    summary: 'Imported Claude/Twin 2026-05-25 lead export into Daily Hunt with verification-gate references and demo fallback queue.',
    started_at: '2026-05-25T18:00:00.000Z',
  },
  {
    id: 'run-1',
    bot_id: 'jackie',
    status: 'completed',
    summary: 'Drive package reviewed; Jackie dashboard entry synced with canonical facts and quality gates.',
    started_at: new Date(Date.now() - 1000 * 60 * 21).toISOString(),
  },
  {
    id: 'run-2',
    bot_id: 'scout',
    status: 'completed',
    summary: 'NYC source checks and score refresh completed for active demo inventory.',
    started_at: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
  },
  {
    id: 'run-3',
    bot_id: 'sentinel',
    status: 'queued',
    summary: 'Waiting for next selected building or uploaded market source.',
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
];

const BOT_ICONS: Record<string, typeof BotIcon> = {
  jackie: Crown,
  arthur: Landmark,
  merlin: Sparkles,
  dailyhunt: RefreshCw,
  scout: Database,
  sentinel: Sparkles,
  integrations: GitBranch,
  guardian: ShieldCheck,
  excalibur: Gavel,
  outreach: Mail,
};

const STATUS_CONFIG: Record<BotStatus, { color: string; bg: string; label: string }> = {
  active: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Active' },
  paused: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Paused' },
  error: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Error' },
  idle: { color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', label: 'Idle' },
};

const SOURCE_CONFIG: Record<BotSource['status'], string> = {
  synced: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reference: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function Bots() {
  const [bots, setBots] = useState(DEMO_BOTS);
  const [selectedBotId, setSelectedBotId] = useState('jackie');

  const selectedBot = useMemo(
    () => bots.find((bot) => bot.id === selectedBotId) ?? bots[0],
    [bots, selectedBotId]
  );

  const runs = DEMO_RUNS.filter((run) => run.bot_id === selectedBot.id);

  const toggleBot = (id: string) => {
    setBots((prev) =>
      prev.map((bot) => {
        if (bot.id !== id) return bot;
        const status: BotStatus = bot.status === 'active' ? 'paused' : 'active';
        toast.success(`${bot.name} ${status === 'active' ? 'started' : 'paused'}`);
        return { ...bot, status };
      })
    );
  };

  const runBot = (id: string) => {
    setBots((prev) =>
      prev.map((bot) => {
        if (bot.id !== id) return bot;
        toast.success(`${bot.name} run queued`);
        return { ...bot, status: 'active', last_run_at: new Date().toISOString(), tasks_queued: bot.tasks_queued + 1 };
      })
    );
  };

  const selectedStatus = STATUS_CONFIG[selectedBot.status];
  const SelectedIcon = BOT_ICONS[selectedBot.type] || BotIcon;

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b border-gray-200 px-6 md:px-8 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BotIcon size={24} className="text-camelot-gold" /> AI Bots and Tools
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Operational dashboard for Scout, Jackie, Sentinel, and follow-up automation.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Active" value={bots.filter((bot) => bot.status === 'active').length} />
            <Metric label="Queued" value={bots.reduce((sum, bot) => sum + bot.tasks_queued, 0)} />
            <Metric label="Completed" value={bots.reduce((sum, bot) => sum + bot.tasks_completed, 0)} />
            <Metric label="Sources" value={bots.reduce((sum, bot) => sum + bot.sources.length, 0)} />
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">Acquisition Pipeline Doctrine</h2>
              <p className="text-sm text-gray-500">
                Scout sources. Sentinel screens. Jackie validates operations. Arthur underwrites only after Jackie passes the deal.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Sentinel gates: kill &lt; {SENTINEL_HANDOFF_RULES.killBelow} | watch {SENTINEL_HANDOFF_RULES.watchRange} | promote {SENTINEL_HANDOFF_RULES.promoteAt}+
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
            {CAMELOT_ACQUISITION_PIPELINE.map((stage, index) => (
              <div key={stage.id} className="relative border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-[10px] uppercase tracking-wide text-camelot-gold font-bold">Stage {index + 1}</p>
                <h3 className="font-bold mt-1">{stage.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{stage.role}</p>
                <p className="text-[11px] text-gray-400 mt-2">{stage.handoffTrigger}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Jackie Acquisition Fit sections: {JACKIE_ACQUISITION_FIT_SECTIONS.join(' | ')}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">Jackie Split Operating Model</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-3xl">
                Jackie now acts as the fact authority, not the whole factory. Specialist desks own media, compliance,
                financing, proposals, meeting handouts, HubSpot handoff, and follow-up so heavy report work can be
                tested and repaired in smaller pieces.
              </p>
            </div>
            <Link
              to="/integrations"
              className="inline-flex items-center gap-2 text-sm border border-camelot-gold text-camelot-dark px-3 py-2 rounded-md hover:bg-camelot-gold/10"
            >
              <GitBranch size={14} /> HubSpot Sync
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
            {CAMELOT_BOT_OPERATING_MODEL.map((bot) => (
              <div key={bot.id} className="border border-gray-200 rounded-lg p-3 bg-[#FCFBF7]">
                <p className="text-[10px] uppercase tracking-wide text-camelot-gold font-bold">{bot.phase}</p>
                <h3 className="font-bold mt-1">{bot.name}</h3>
                <p className="text-xs text-gray-500 mt-2">{bot.owns.slice(0, 2).join(' • ')}</p>
                <p className="text-[11px] text-gray-400 mt-2">Handoff: {bot.handoffTo.join(', ') || 'none'}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
            {JACKIE_SPLIT_RULES.map((rule) => (
              <div key={rule} className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#263747] text-white border border-[#C9A227]/40 rounded-lg p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#DBBA2E] font-bold">Twin AI Knowledge Import</p>
              <h2 className="text-xl font-bold mt-1">{TWIN_KNOWLEDGE_STATS.totalProjects} projects now inside Camelot OS</h2>
              <p className="text-sm text-white/75 mt-2 max-w-3xl">
                The Twin AI workspace has been pulled into the Camelot OS bot layer. Instruction-backed projects are marked synced; empty drafts stay pending so we do not pretend incomplete agents are production-ready.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-white/10 px-3 py-2">
                <div className="text-lg font-bold text-[#DBBA2E]">{TWIN_KNOWLEDGE_STATS.totalProjects}</div>
                <div className="text-[10px] uppercase tracking-wide text-white/60">Projects</div>
              </div>
              <div className="rounded-md bg-white/10 px-3 py-2">
                <div className="text-lg font-bold text-[#DBBA2E]">{TWIN_KNOWLEDGE_STATS.instructionBackedProjects}</div>
                <div className="text-[10px] uppercase tracking-wide text-white/60">Synced</div>
              </div>
              <div className="rounded-md bg-white/10 px-3 py-2">
                <div className="text-lg font-bold text-[#DBBA2E]">{Math.round(TWIN_KNOWLEDGE_STATS.totalInstructionChars / 1000)}k</div>
                <div className="text-[10px] uppercase tracking-wide text-white/60">Chars</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-5">
          <div className="space-y-3">
            {bots.map((bot) => {
              const Icon = BOT_ICONS[bot.type] || BotIcon;
              const statusConfig = STATUS_CONFIG[bot.status];
              const isSelected = bot.id === selectedBot.id;

              return (
                <button
                  key={bot.id}
                  onClick={() => setSelectedBotId(bot.id)}
                  className={cn(
                    'w-full text-left bg-white border rounded-lg p-4 transition-all',
                    isSelected ? 'border-camelot-gold shadow-sm' : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 bg-camelot-navy rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon size={21} className="text-camelot-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-bold leading-tight">{bot.name}</h2>
                        <span className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium', statusConfig.bg, statusConfig.color)}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{bot.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-camelot-navy rounded-lg flex items-center justify-center flex-shrink-0">
                    <SelectedIcon size={28} className="text-camelot-gold" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold">{selectedBot.name}</h2>
                      <span className={cn('text-xs px-2 py-1 rounded-full border font-medium', selectedStatus.bg, selectedStatus.color)}>
                        {selectedStatus.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 max-w-3xl">{selectedBot.description}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Owner: {selectedBot.owner} | Source: {selectedBot.id === 'jackie' ? DRIVE_FOLDER : 'Camelot Scout repo'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => runBot(selectedBot.id)}
                    className="inline-flex items-center gap-2 text-sm bg-camelot-gold text-camelot-dark px-3 py-2 rounded-md hover:bg-camelot-gold-light"
                  >
                    <Play size={14} /> Run
                  </button>
                  <button
                    onClick={() => toggleBot(selectedBot.id)}
                    className="inline-flex items-center gap-2 text-sm border border-gray-200 px-3 py-2 rounded-md hover:bg-gray-50"
                  >
                    {selectedBot.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                    {selectedBot.status === 'active' ? 'Pause' : 'Start'}
                  </button>
                  <button className="inline-flex items-center gap-2 text-sm border border-gray-200 px-3 py-2 rounded-md hover:bg-gray-50">
                    <Settings size={14} /> Configure
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 border-b border-gray-200">
              <DetailMetric label="Completed tasks" value={selectedBot.tasks_completed} />
              <DetailMetric label="Queued tasks" value={selectedBot.tasks_queued} />
              <DetailMetric label="Last run" value={selectedBot.last_run_at ? formatDate(selectedBot.last_run_at) : 'Never'} />
            </div>

            {selectedBot.error_message && (
              <div className="mx-5 mt-5 flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-md border border-red-100">
                <AlertCircle size={16} /> {selectedBot.error_message}
              </div>
            )}

            {selectedBot.id === 'twin-knowledge' && (
              <div className="p-5 border-b border-gray-200 bg-[#F8F6EF]">
                <Section title="Imported Twin Projects">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                    {TWIN_KNOWLEDGE_PROJECTS.map((project) => (
                      <div key={project.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-sm">{project.name}</h3>
                            <p className="text-[11px] text-gray-400 mt-0.5">{project.id}</p>
                          </div>
                          <span className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full border font-semibold',
                            project.instructionChars > 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          )}>
                            {project.instructionChars > 0 ? 'Synced' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-3 line-clamp-4">{project.purpose}</p>
                        {project.headings.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {project.headings.slice(0, 5).map((heading) => (
                              <span key={heading} className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-1">
                                {heading}
                              </span>
                            ))}
                          </div>
                        )}
                        {project.planSteps.length > 0 && (
                          <div className="mt-3 text-[11px] text-gray-500">
                            Workflow: {project.planSteps.slice(0, 3).map((step) => step.title).join(' -> ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}

            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Section title="Outputs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedBot.outputs.map((output) => (
                    <div key={output} className="flex items-center gap-2 text-sm bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                      <FileText size={14} className="text-camelot-gold flex-shrink-0" />
                      <span>{output}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Quick Actions">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedBot.actions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.href}
                        to={action.href}
                        className="flex items-center justify-between gap-3 text-sm border border-gray-200 rounded-md px-3 py-2 hover:border-camelot-gold hover:bg-camelot-gold/5"
                      >
                        <span className="flex items-center gap-2">
                          <Icon size={14} className="text-camelot-gold" />
                          {action.label}
                        </span>
                        <span className="text-gray-300">/</span>
                      </Link>
                    );
                  })}
                </div>
              </Section>

              <Section title="Source Files">
                <div className="space-y-2">
                  {selectedBot.sources.map((source) => (
                    <div key={`${source.kind}-${source.name}`} className="flex items-center justify-between gap-3 text-sm border border-gray-200 rounded-md px-3 py-2">
                      <span className="truncate">{source.name}</span>
                      <span className={cn('text-[11px] px-2 py-0.5 rounded-full border flex-shrink-0', SOURCE_CONFIG[source.status])}>
                        {source.kind} {source.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Quality Gates">
                <div className="space-y-2">
                  {selectedBot.quality_gates.map((gate) => (
                    <div key={gate} className="flex items-start gap-2 text-sm">
                      <CheckCircle size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>{gate}</span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            <div className="px-5 pb-5">
              <Section title="Run History">
                {runs.length === 0 ? (
                  <p className="text-sm text-gray-400">No runs logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {runs.map((run) => (
                      <div key={run.id} className="flex items-start gap-3 text-sm bg-gray-50 border border-gray-200 rounded-md p-3">
                        {run.status === 'completed' ? (
                          <CheckCircle size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                        ) : run.status === 'queued' ? (
                          <Clock size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium capitalize">{run.status}</p>
                          <p className="text-gray-500 mt-0.5">{run.summary}</p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(run.started_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md px-4 py-2 min-w-[92px]">
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="p-4 border-b lg:border-b-0 lg:border-r last:border-r-0 border-gray-200">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </section>
  );
}
