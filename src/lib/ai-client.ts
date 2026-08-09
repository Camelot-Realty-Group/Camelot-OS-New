/**
 * AI Chat Client — OpenAI-compatible API
 * Works with: OpenAI, OpenRouter, Anthropic (via proxy), local LLMs (Ollama, LM Studio), etc.
 * All configuration via environment variables. No hard dependency on any provider.
 */

import { authenticatedApiFetch } from '@/lib/api-auth';

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

import { JACKIE_V2_ORCHESTRATOR_PROMPT } from './jackie-v2-orchestrator';
import { SCOUT_AGENT_DOCTRINE_PROMPT } from './scout-ai-doctrines';
import { nyOwnershipHuntSummary, nyPeopleEntityCompSourceSummary } from '@/lib/ny-research-sources';
import { DAVID_GOLDOFF_SIGNATURE_TEXT } from './camelot-signature';

export interface AIConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

const SCOUT_SYSTEM_PROMPT = `You are Merlin, the AI brain of Camelot OS — the operating system for property management by Camelot Realty Group.

You help the Camelot team with:
- Analyzing properties and lead scores
- Drafting outreach emails for buildings
- Providing pipeline summaries and recommendations
- Suggesting next actions for leads in the pipeline
- Answering questions about NYC building data (HPD violations, DOF assessments, etc.)
- Competitive analysis of other management companies
- Generating reports and summaries

Camelot Realty Group is a NYC-based property management firm led by David Goldoff. They specialize in co-ops, condos, and residential buildings. Their competitive advantages include personal attention, weekly inspections, ConciergePlus technology, transparent financials, compliance expertise, and zero bank fees.

The team includes: David Goldoff (Owner/Principal), Sam Lodge (Tech Lead), Carl (Cold Caller), Luigi (Operations), Jake, Valerie, Spencer, Danielle, and Merlin (Tech Lead/AI).

Be concise, data-driven, and actionable. Use specific numbers when available. Format responses with markdown for readability.

When the user asks about acquisitions, underwriting, capital markets, real estate investment strategy, value-add deals, distressed assets, HOA/condo turnarounds, zoning, debt, capital stacks, investor decks, lender decks, LOIs, or sponsor strategy, apply the Jackie v2 acquisition-orchestrator doctrine below.

${JACKIE_V2_ORCHESTRATOR_PROMPT}

Apply the Scout-wide agent doctrine below for Merlin, Scout, Guardian, Sentinel, Outreach, and Excalibur work.

${SCOUT_AGENT_DOCTRINE_PROMPT}`;

type LocalBuilding = {
  address: string;
  name?: string;
  score: number;
  grade: string;
  pipeline_stage: string;
  pipeline_moved_at?: string;
  status: string;
  units?: number;
  violations_count: number;
  open_violations_count: number;
  current_management?: string;
  contacts: { name: string; role: string; email?: string; phone?: string }[];
  borough?: string;
  region?: string;
  type: string;
};

function highestRiskBuildings(buildings: LocalBuilding[], count = 5) {
  return [...buildings]
    .sort((a, b) => {
      const riskA = (a.open_violations_count || 0) * 4 + (a.violations_count || 0) + (100 - (a.score || 0));
      const riskB = (b.open_violations_count || 0) * 4 + (b.violations_count || 0) + (100 - (b.score || 0));
      return riskB - riskA;
    })
    .slice(0, count);
}

function formatBuildingLine(building: LocalBuilding, index: number): string {
  const name = building.name || building.address;
  const place = building.borough || building.region || 'market';
  return `**${index + 1}. ${name}** - ${building.units || '?'} units, ${building.type}, ${place}, score ${building.score}/100, ${building.open_violations_count || 0} open violations, management: ${building.current_management || 'to verify'}`;
}

/**
 * Check if AI is configured (external API)
 */
export function isAIConfigured(): boolean {
  return String(import.meta.env.VITE_RUNTIME_MODE || '').toLowerCase() === 'server';
}

/**
 * Local query engine — handles quick actions without an external AI API.
 * Returns null if the query doesn't match a known local command.
 */
export function localQueryEngine(
  query: string,
  buildings: LocalBuilding[]
): string | null {
  const q = query.toLowerCase();
  const active = buildings.filter((b) => b.status === 'active');

  // Pipeline Summary
  if (q.includes('pipeline') && (q.includes('summary') || q.includes('status') || q.includes('how many'))) {
    const byStage: Record<string, number> = {};
    active.forEach((b) => { byStage[b.pipeline_stage] = (byStage[b.pipeline_stage] || 0) + 1; });
    const avgScore = active.length ? Math.round(active.reduce((s, b) => s + b.score, 0) / active.length) : 0;
    const totalUnits = active.reduce((s, b) => s + (b.units || 0), 0);
    const totalOpenViol = active.reduce((s, b) => s + (b.open_violations_count || 0), 0);

    let resp = `## 📊 Pipeline Summary\n\n`;
    resp += `**${active.length} active buildings** across ${Object.keys(byStage).length} pipeline stages:\n\n`;
    const stageOrder = ['discovered', 'scored', 'contacted', 'nurture', 'proposal', 'negotiation', 'won', 'lost'];
    stageOrder.forEach((s) => {
      if (byStage[s]) resp += `- **${s.charAt(0).toUpperCase() + s.slice(1)}:** ${byStage[s]} buildings\n`;
    });
    resp += `\n**Key Metrics:**\n`;
    resp += `- Average Score: **${avgScore}/100**\n`;
    resp += `- Total Units: **${totalUnits.toLocaleString()}**\n`;
    resp += `- Open Violations: **${totalOpenViol}**\n\n`;

    const gradeA = active.filter((b) => b.grade === 'A').length;
    const gradeB = active.filter((b) => b.grade === 'B').length;
    resp += `**Grade Distribution:** A: ${gradeA}, B: ${gradeB}, C: ${active.length - gradeA - gradeB}\n\n`;

    // Recommendations
    const discovered = active.filter((b) => b.pipeline_stage === 'discovered');
    if (discovered.length > 0) {
      resp += `💡 **Action Item:** ${discovered.length} buildings still in "Discovered" — review and score them to move the pipeline forward.`;
    }
    return resp;
  }

  // Top Leads
  if (q.includes('top') && (q.includes('lead') || q.includes('build') || q.includes('score'))) {
    const countMatch = q.match(/top\s+(\d+)/);
    const count = countMatch ? Math.min(parseInt(countMatch[1]), 20) : 10;
    const sorted = [...active].sort((a, b) => b.score - a.score).slice(0, count);

    let resp = `## 🎯 Top ${sorted.length} Leads by Score\n\n`;
    sorted.forEach((b, i) => {
      resp += `**${i + 1}. ${b.name || b.address}** — Score: **${b.score}** (Grade ${b.grade})\n`;
      resp += `   📍 ${b.address}${b.borough ? ' • ' + b.borough : ''}\n`;
      resp += `   🏢 ${b.units || '?'} units • ${b.type} • Stage: ${b.pipeline_stage}\n`;
      resp += `   ⚠️ ${b.open_violations_count} open / ${b.violations_count} total violations\n`;
      resp += `   🏗️ Mgmt: ${b.current_management || 'Unknown'}\n`;
      if (b.contacts?.length > 0) {
        resp += `   👤 ${b.contacts[0].name} (${b.contacts[0].role})${b.contacts[0].email ? ' — ' + b.contacts[0].email : ''}\n`;
      }
      resp += `\n`;
    });
    return resp;
  }

  // Draft Email
  if (q.includes('draft') && q.includes('email')) {
    // Find the building: either named in query or highest-scored untouched one
    let target = active.find((b) => {
      const bName = (b.name || '').toLowerCase();
      const bAddr = b.address.toLowerCase();
      return q.includes(bName) || q.includes(bAddr);
    });
    if (!target) {
      // Highest-scored building not yet contacted
      target = [...active]
        .filter((b) => b.pipeline_stage === 'discovered' || b.pipeline_stage === 'scored')
        .sort((a, b) => b.score - a.score)[0] || active[0];
    }
    if (!target) return 'No buildings in the database to draft an email for.';

    const contact = target.contacts?.[0];
    const contactName = contact?.name || 'Board Member';

    let resp = `## ✉️ Draft Email for ${target.name || target.address}\n\n`;
    resp += `**To:** ${contact?.email || '(no email on file)'}\n`;
    resp += `**Subject:** Property Management Services for ${target.name || target.address}\n\n`;
    resp += `---\n\n`;
    resp += `Dear ${contactName},\n\n`;
    resp += `My name is David Goldoff, and I'm the principal of Camelot Realty Group. I'm reaching out because I noticed ${target.name || target.address} at ${target.address} — a ${target.units || ''}-unit ${target.type} in ${target.borough || 'NYC'} — and I believe we can provide exceptional management services for your property.\n\n`;
    if (target.open_violations_count > 0) {
      resp += `With ${target.open_violations_count} open HPD violations on record, I understand the challenges of maintaining a well-run building. At Camelot, we take a hands-on approach with weekly inspections and proactive violation resolution.\n\n`;
    }
    resp += `Our key differentiators:\n`;
    resp += `• **Personal Attention** — I personally oversee every property\n`;
    resp += `• **Weekly Inspections** — On-site walkthroughs to catch issues early\n`;
    resp += `• **Zero Bank Fees** — Your money works for your building\n`;
    resp += `• **Transparent Financials** — Real-time budget tracking\n\n`;
    resp += `I'd love to schedule a 15-minute call to discuss how Camelot can serve ${target.name || target.address}. Would this week work?\n\n`;
    resp += `Best regards,\n`;
    resp += `${DAVID_GOLDOFF_SIGNATURE_TEXT}\n\n`;
    resp += `---\n*You can copy this email or go to **Outreach → Compose** to customize it further.*`;
    return resp;
  }

  // Untouched Leads
  if (q.includes('untouched') || (q.includes('discovered') && (q.includes('no') || q.includes('without') || q.includes('contact')))) {
    const untouched = active.filter((b) => b.pipeline_stage === 'discovered');
    if (untouched.length === 0) return '✅ No untouched leads — every building has been moved past the "Discovered" stage.';

    const sorted = [...untouched].sort((a, b) => b.score - a.score);
    let resp = `## 🔍 Untouched Leads (${sorted.length} buildings in "Discovered")\n\n`;
    resp += `These buildings haven't been scored or contacted yet:\n\n`;
    sorted.forEach((b, i) => {
      const daysSince = b.pipeline_moved_at
        ? Math.floor((Date.now() - new Date(b.pipeline_moved_at).getTime()) / 86400000)
        : 0;
      resp += `**${i + 1}. ${b.name || b.address}** — Score: ${b.score}, Grade ${b.grade}\n`;
      resp += `   ${b.address} • ${b.units || '?'} units • ${b.open_violations_count} open violations\n`;
      resp += `   In "Discovered" for **${daysSince} day${daysSince !== 1 ? 's' : ''}**\n`;
      if (b.contacts?.length > 0) {
        resp += `   Contact: ${b.contacts[0].name} (${b.contacts[0].role})\n`;
      } else {
        resp += `   ⚠️ No contacts on file — consider enrichment\n`;
      }
      resp += `\n`;
    });
    resp += `💡 **Recommendation:** Start with the highest-scored buildings and enrich contacts where missing.`;
    return resp;
  }

  // Competitive analysis
  if (q.includes('competitive') || q.includes('competition') || q.includes('landscape')) {
    const mgmtCounts: Record<string, number> = {};
    active.forEach((b) => {
      const mgmt = b.current_management || 'Unknown';
      mgmtCounts[mgmt] = (mgmtCounts[mgmt] || 0) + 1;
    });
    const sorted = Object.entries(mgmtCounts).sort(([, a], [, b]) => b - a);

    let resp = `## 🏢 Competitive Landscape (from Scout database)\n\n`;
    resp += `**Management companies across ${active.length} tracked buildings:**\n\n`;
    sorted.forEach(([mgmt, count]) => {
      resp += `- **${mgmt}:** ${count} building${count > 1 ? 's' : ''}\n`;
    });
    resp += `\n**Key observations:**\n`;
    const selfManaged = active.filter((b) => b.current_management?.toLowerCase().includes('self') || b.current_management?.toLowerCase() === 'unknown').length;
    resp += `- ${selfManaged} buildings are self-managed or have unknown management — prime targets\n`;
    resp += `- Focus outreach on buildings with high violation counts + weak management\n\n`;
    resp += `*For deeper competitive intel, configure the AI backend in Settings.*`;
    return resp;
  }

  if (q.includes('compliance') || q.includes('guardian') || q.includes('violation') || q.includes('risk brief')) {
    const risk = highestRiskBuildings(active, 5);
    let resp = `## Guardian Compliance Brief\n\n`;
    resp += `Scout should treat compliance as a source-backed operating risk, not a cosmetic score. For NYC assets, verify HPD, DOB BIS, DOB NOW, ECB/OATH, DOF, ACRIS, 311, LL97/FISP, liens and court-index signals. Outside NYC, switch to state, county, assessor, town clerk, building department, court and association-record equivalents.\n\n`;
    resp += `**Highest-risk buildings in the current database:**\n\n`;
    if (risk.length === 0) {
      resp += `No active buildings are available for compliance ranking.\n`;
    } else {
      risk.forEach((b, i) => {
        resp += `${formatBuildingLine(b, i)}\n`;
      });
    }
    resp += `\n**Release rule:** if every source returns zero, the report should show the source coverage and label the result as verified or still pending. A building with liens, open violations, complaints, claims, or penalties cannot receive a perfect current-management score.`;
    return resp;
  }

  if (q.includes('market') || q.includes('sentinel') || q.includes(' comps') || q.includes('comparable') || q.includes('quarterly')) {
    const totalUnits = active.reduce((sum, b) => sum + (b.units || 0), 0);
    const regions: Record<string, number> = {};
    active.forEach((b) => {
      const region = b.borough || b.region || 'Unknown';
      regions[region] = (regions[region] || 0) + 1;
    });
    const regionLines = Object.entries(regions)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => `- ${name}: ${count} tracked building${count === 1 ? '' : 's'}`)
      .join('\n');
    let resp = `## Sentinel Market Intelligence Brief\n\n`;
    resp += `Sentinel should turn market data into a board-facing value story: how the building stacks up in value, $/SF, leasing velocity, safety, amenities, cost pressure, sales activity, and neighborhood demand.\n\n`;
    resp += `**Current Scout footprint:** ${active.length} active buildings, ${totalUnits.toLocaleString()} total units.\n${regionLines || '- No region data yet'}\n\n`;
    resp += `**Source stack to use:** Miller Samuel / REBNY-style market reports, StreetEasy, Zillow, PropertyShark, local MLS, Niche, NeighborhoodScout, NYC Open Data or state/local equivalents, plus Camelot portfolio case studies and nearby managed buildings. For New York people, comps, owners, lenders, notes, entities, commercial occupants, and litigation, also scan: ${nyPeopleEntityCompSourceSummary()}. For New York decision-maker and ownership hunts, add: ${nyOwnershipHuntSummary()}.\n\n`;
    resp += `**Deliverable:** quarterly market report with maps, charts, comp table, local Camelot presence, and a clear "what your unit/building may be worth" explanation.`;
    return resp;
  }

  if (q.includes('proposal') || q.includes('board') || q.includes('excalibur') || q.includes('fee')) {
    const target = [...active].sort((a, b) => b.score - a.score)[0];
    let resp = `## Excalibur Proposal Angle\n\n`;
    if (target) {
      resp += `**Best current target:** ${target.name || target.address}\n`;
      resp += `- ${target.units || '?'} units, ${target.type}, ${target.borough || target.region || 'market to verify'}\n`;
      resp += `- Current management: ${target.current_management || 'to verify'}\n`;
      resp += `- Score: ${target.score}/100, Grade ${target.grade}, ${target.open_violations_count || 0} open violations\n\n`;
    }
    resp += `**Proposal logic:** start with the Camelot Intelligence package as the recommended pricing matrix because it includes the technology, automation, reporting, board support, and operating intelligence the market now expects. Classic and Premier remain alternatives, but the first recommendation should not waive the technology platform or price from the older benchmark-discount model. Keep ancillary services separate: lease renewals, sales packages, closings, alteration agreement review, after-hours meetings, project management over threshold, and state/local compliance work. Label all fee assumptions until the budget, audited financials, prior management report, rent roll, and service scope are reviewed.\n\n`;
    resp += `**Board-safe message:** Camelot can be creative with staffing, automation, accounting, reporting, and vendor oversight, but the formal proposal should wait for financials and a verified operating picture.`;
    return resp;
  }

  if (q.includes('savings') || q.includes('vendor') || q.includes('value creation') || q.includes('save money')) {
    let resp = `## Value Creation and Vendor Savings Plan\n\n`;
    resp += `Camelot's savings story should be positive but credible: reduce avoidable spend, improve scope control, catch issues earlier, and free board time without pretending inflation disappears.\n\n`;
    resp += `**Savings levers Scout should model:**\n`;
    resp += `- Vendor rebidding and scope control for recurring contracts\n`;
    resp += `- Insurance, utilities, repairs, supplies, payroll/staffing design, and consultant fee review\n`;
    resp += `- Preventive maintenance to avoid emergency pricing and resident disruption\n`;
    resp += `- Automation for work orders, payments, reporting, board packets, meeting minutes, document access, and resident communication\n`;
    resp += `- Project oversight that reduces change-order drift and improves closeout documentation\n\n`;
    resp += `**Report rule:** do not force a positive ROI or promise savings. Show a conservative five-year planning view only when the assumptions are labeled, separate cash savings from non-cash board-time benefits, and clearly state which figures are direct data pulls, which are benchmark references, and which still require actual budgets, management reports, utility bills, insurance, contracts, arrears, payroll, and debt schedules.`;
    return resp;
  }

  if (q.includes('hoa') || q.includes('recovery') || q.includes('field operations') || q.includes('facilities')) {
    let resp = `## HOA Recovery and Field Operations Brief\n\n`;
    resp += `For HOA and non-NYC communities, Scout should remove NYC-only law language and use state/county/town sources. The management model should separate virtual executive back-office strength from local field support.\n\n`;
    resp += `**Recommended structure:**\n`;
    resp += `- Core management: financials, billing, collections, board reporting, document controls, resident portal, vendor coordination\n`;
    resp += `- Local facilities retainer: weekly or biweekly inspections, photo reporting, vendor walkthroughs, emergency response, project monitoring\n`;
    resp += `- Claims/project oversight: separate cover with public adjuster, insurance, restoration and contractor workflow\n\n`;
    resp += `**Diligence needed before final fee:** current budget, last audited financials, prior manager report, insurance dec page, reserve study, vendor list, open claim status, bylaws/rules, rent/unit roster, and board priorities.`;
    return resp;
  }

  if (q.includes('agent') || q.includes('bot') || q.includes('skill set') || q.includes('skillset')) {
    return `## Scout Agent Skill Set\n\nScout now treats the bots as a coordinated operating bench:\n\n- **Merlin:** operating copilot for pipeline, drafts, strategy and board talking points.\n- **Scout:** lead intelligence, scoring, owner/manager enrichment and source gap detection.\n- **Guardian:** compliance, violations, liens, lawsuits, LL97/FISP and release-blocker discipline.\n- **Sentinel:** market reports, comps, neighborhood context, charts, maps and portfolio proof.\n- **Outreach:** first emails, follow-ups, call scripts and meeting requests with property-specific copy.\n- **Excalibur:** proposals, fee comparisons, service menus, rate assumptions and agreement support.\n\nEach agent uses the Jackie standard: creative in positioning, strict with facts, source conflicts blocked before client-facing release.`;
  }

  // No match: return null so the external AI backend can answer if configured.
  return null;
}

/**
 * Get AI configuration from environment
 */
export function getAIConfig(): AIConfig {
  return {
    apiUrl: '',
    apiKey: '',
    model: import.meta.env.VITE_AI_MODEL || 'gpt-4o',
  };
}

/**
 * Server-side AI proxy fallback: when no client-side key is configured, the
 * chat routes through /api/ai/chat where the key lives safely in Render env
 * (OPENAI_API_KEY). This is what "turns on" the Merlin bot agent without
 * shipping a secret in the public bundle.
 */
async function proxyChatCompletion(
  messages: AIChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const res = await authenticatedApiFetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'system', content: SCOUT_SYSTEM_PROMPT }, ...messages],
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    if (res.status === 400 && /not configured/i.test(data?.error || '')) throw new Error('AI_NOT_CONFIGURED');
    if (res.status === 401) throw new Error('AI_AUTH_FAILED');
    if (res.status === 429) throw new Error('AI_RATE_LIMITED');
    throw new Error(data?.error || `AI proxy error ${res.status}`);
  }
  return data.content || 'No response generated.';
}

/**
 * Send a chat completion request to any OpenAI-compatible endpoint
 */
export async function chatCompletion(
  messages: AIChatMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    stream?: false;
  }
): Promise<string> {
  const config = getAIConfig();

  if (!config.apiUrl || !config.apiKey) {
    return proxyChatCompletion(messages, options);
  }

  const body = {
    model: config.model,
    messages: [
      { role: 'system' as const, content: SCOUT_SYSTEM_PROMPT },
      ...messages,
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
    stream: false,
  };

  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error('AI_AUTH_FAILED');
    }
    if (res.status === 429) {
      throw new Error('AI_RATE_LIMITED');
    }
    throw new Error(`AI API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'No response generated.';
}

/**
 * Stream a chat completion (for real-time typing effect)
 */
export async function chatCompletionStream(
  messages: AIChatMessage[],
  onChunk: (text: string) => void,
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const config = getAIConfig();

  if (!config.apiUrl || !config.apiKey) {
    // No client-side key: use the server proxy (non-streaming) and deliver
    // the full reply in one chunk so the chat still works end-to-end.
    const text = await proxyChatCompletion(messages, options);
    onChunk(text);
    return text;
  }

  const body = {
    model: config.model,
    messages: [
      { role: 'system' as const, content: SCOUT_SYSTEM_PROMPT },
      ...messages,
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
    stream: true,
  };

  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) throw new Error('AI_AUTH_FAILED');
    if (res.status === 429) throw new Error('AI_RATE_LIMITED');
    throw new Error(`AI API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          onChunk(content);
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  return fullText;
}

/**
 * Generate an email draft using AI
 */
export async function generateEmail(params: {
  buildingName: string;
  address: string;
  contactName?: string;
  contactRole?: string;
  violations?: number;
  units?: number;
  tone?: string;
}): Promise<{ subject: string; body: string }> {
  const prompt = `Draft a professional outreach email for Camelot Property Management to send to ${params.contactName || 'the board'} at ${params.buildingName} (${params.address}).
Building details: ${params.units || 'unknown'} units, ${params.violations || 0} HPD violations.
${params.contactRole ? `Contact role: ${params.contactRole}` : ''}
Tone: ${params.tone || 'professional and personal'}

Return the email in this exact format:
SUBJECT: [subject line]
BODY:
[email body]`;

  const response = await chatCompletion([{ role: 'user', content: prompt }]);

  const subjectMatch = response.match(/SUBJECT:\s*(.+)/);
  const bodyMatch = response.match(/BODY:\s*([\s\S]+)/);

  return {
    subject: subjectMatch?.[1]?.trim() || `Property Management Services for ${params.buildingName}`,
    body: bodyMatch?.[1]?.trim() || response,
  };
}

/**
 * Summarize pipeline status using AI
 */
export async function summarizePipeline(data: {
  stageCounts: Record<string, number>;
  totalBuildings: number;
  recentMoves: string[];
}): Promise<string> {
  const prompt = `Summarize this pipeline status for the Camelot team:
Total buildings: ${data.totalBuildings}
Stage counts: ${JSON.stringify(data.stageCounts)}
Recent activity: ${data.recentMoves.join('; ')}

Be brief (3-4 sentences), highlight action items.`;

  return chatCompletion([{ role: 'user', content: prompt }]);
}

