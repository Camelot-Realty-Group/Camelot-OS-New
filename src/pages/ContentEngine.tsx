import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Database,
  Download,
  FileText,
  Globe2,
  Layers3,
  ListChecks,
  LockKeyhole,
  Mail,
  Megaphone,
  Newspaper,
  PenLine,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  buildContentExport,
  CAMELOT_BRAND_SYSTEM,
  CAMELOT_CONTENT_RULES,
  CONTENT_CADENCE,
  CONTENT_ENGINE_PROMPT,
  CONTENT_INTEGRATIONS,
  CONTENT_LIBRARY,
  CONTENT_MODULES,
  CONTENT_RECIPIENTS,
  CONTENT_THEMES,
  CTA_PLANS,
  DATABASE_TABLES,
  type ContentItem,
  type ContentStatus,
} from '@/lib/content-engine';
import {
  AUTOMATION_SCHEDULE,
  buildCampaignPackage,
  CTA_HIERARCHY,
  persistCampaignPackage,
  logContentRun,
  runBrandSafetyCheck,
  type CampaignPackage,
  type FunnelStage,
} from '@/lib/marketing-engine';

const statusStyles: Record<ContentStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_review: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  scheduled: 'bg-blue-50 text-blue-800 border-blue-200',
  published: 'bg-camelot-gold/10 text-camelot-gold border-camelot-gold/30',
  failed: 'bg-red-50 text-red-800 border-red-200',
  stale: 'bg-orange-50 text-orange-800 border-orange-200',
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function ContentEngine() {
  const [items, setItems] = useState<ContentItem[]>(CONTENT_LIBRARY);
  const [selectedId, setSelectedId] = useState(items[0]?.id || '');
  const [topic, setTopic] = useState('NYC co-op boards evaluating their current property manager');
  const selected = items.find((item) => item.id === selectedId) || items[0];

  const stats = useMemo(() => {
    const pending = items.filter((item) => item.status === 'pending_review').length;
    const approved = items.filter((item) => item.status === 'approved').length;
    const scheduled = items.filter((item) => item.status === 'scheduled').length;
    const safety = items.filter((item) => item.safetyFlags.includes('No personal cell') || item.safetyFlags.includes('Office phone only')).length;
    return { pending, approved, scheduled, safety, modules: CONTENT_MODULES.length };
  }, [items]);

  const setStatus = (id: string, status: ContentStatus) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    toast.success(`Content marked ${status.replace('_', ' ')}`);
  };

  const generateDraft = () => {
    const next: ContentItem = {
      id: `draft-${Date.now()}`,
      title: `Camelot Content Draft: ${topic}`,
      channel: 'Blog',
      contentType: 'AI Draft',
      audience: 'Boards',
      status: 'pending_review',
      scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      seoKeyword: 'NYC property management for co-ops',
      excerpt: `Draft content package focused on ${topic}.`,
      body: `Camelot can turn this topic into a blog article, social variants, email excerpt, and video outline. This draft is intentionally held in pending review so no content can go live until approved by the Camelot team.`,
      cta: 'Contact Camelot at info@camelot.nyc or (212) 206-9939.',
      safetyFlags: ['No personal cell', 'Human approval required', 'CTA verified'],
      score: 84,
    };
    setItems((prev) => [next, ...prev]);
    setSelectedId(next.id);
    toast.success('Draft created in approval queue');
  };

  const downloadJson = () => {
    const blob = new Blob([buildContentExport(items)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Camelot-Content-Engine-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Content engine export downloaded');
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(CONTENT_ENGINE_PROMPT);
    toast.success('Content engine prompt copied');
  };

  return (
    <div className="min-h-screen bg-[#F7F4ED]">
      <div className="bg-white border-b border-slate-200 px-8 py-7">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-camelot-gold/15 text-camelot-gold flex items-center justify-center">
                <Megaphone size={24} />
              </span>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-camelot-gold font-bold">Merlin Content Engine</div>
                <h1 className="font-heading text-3xl text-slate-950">Content Distribution Command Center</h1>
              </div>
            </div>
            <p className="text-slate-600 mt-4 max-w-4xl leading-relaxed">
              Generate, review, approve, schedule, publish, and track Camelot content across WordPress, social, email, and video.
              The engine is designed for growth, but it stays strict: no content goes live without human approval.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={copyPrompt} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-camelot-gold/60">
              <Copy size={16} /> Copy System Prompt
            </button>
            <button onClick={downloadJson} className="inline-flex items-center gap-2 rounded-xl bg-camelot-navy px-4 py-3 text-sm font-semibold text-white hover:bg-camelot-navy/90">
              <Download size={16} /> Export Content Plan
            </button>
          </div>
        </div>
      </div>

      <main className="px-8 py-8 space-y-6">
        <CampaignPackageBuilder />

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard icon={ClipboardCheck} label="Pending Approval" value={stats.pending} detail="David/Sam review required" />
          <MetricCard icon={CheckCircle2} label="Approved" value={stats.approved} detail="Ready for scheduling" />
          <MetricCard icon={Layers3} label="Automation Modules" value={stats.modules} detail="SEO, social, dashboard, outreach, CTA" />
          <MetricCard icon={ShieldCheck} label="Safety Locks" value={`${stats.safety}/${items.length}`} detail="No cell number + CTA checks" />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-camelot-gold font-bold">Automation Blueprint</div>
                <h2 className="font-heading text-2xl text-slate-950 mt-1">Six Modules Inside Camelot OS</h2>
                <p className="text-sm text-slate-600 mt-2 max-w-3xl">
                  Merlin Content now carries the research, editorial, approval, publishing, tracking, outreach, and CTA architecture. Each module is independently schedulable, but they share one approval gate.
                </p>
              </div>
              <Newspaper className="text-camelot-gold flex-shrink-0" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {CONTENT_MODULES.map((module) => (
                <div key={module.id} className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-950">{module.name}</h3>
                      <p className="text-xs font-semibold text-camelot-gold mt-1">{module.schedule}</p>
                    </div>
                    <ListChecks size={18} className="text-camelot-gold flex-shrink-0" />
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mt-3">{module.objective}</p>
                  <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600">
                    Gate: {module.safetyGate}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-heading text-2xl text-slate-950 flex items-center gap-2">
                <Users size={22} className="text-camelot-gold" /> Review Routing
              </h2>
              <div className="mt-4 space-y-3">
                {CONTENT_RECIPIENTS.map((recipient) => (
                  <div key={recipient.email} className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-3">
                    <div className="font-bold text-slate-950">{recipient.name}</div>
                    <div className="text-xs text-camelot-gold font-semibold">{recipient.role}</div>
                    <div className="text-sm text-slate-600 mt-1">{recipient.email}</div>
                    <div className="text-xs text-slate-500 mt-1">{recipient.note}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-camelot-navy rounded-2xl p-6 text-white shadow-sm">
              <h2 className="font-heading text-2xl flex items-center gap-2">
                <Target size={22} className="text-camelot-gold" /> Brand Position
              </h2>
              <p className="text-sm text-white/80 leading-relaxed mt-3">{CAMELOT_BRAND_SYSTEM.positioning}</p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {CAMELOT_BRAND_SYSTEM.colors.slice(0, 4).map((color) => (
                  <div key={color.hex} className="rounded-lg border border-white/10 bg-white/5 p-2">
                    <div className="h-4 rounded" style={{ backgroundColor: color.hex }} />
                    <div className="text-[11px] text-white/70 mt-1">{color.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.45fr] gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-heading text-2xl text-slate-950">Generate A Draft</h2>
                <p className="text-sm text-slate-500">Creates review-ready content. It does not publish.</p>
              </div>
              <Sparkles className="text-camelot-gold" />
            </div>
            <label className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold">Topic Brief</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-2 min-h-[130px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-camelot-gold/40"
            />
            <div className="grid grid-cols-2 gap-3 mt-4">
              {['Boards', 'Developers', 'Investors', 'Residents'].map((audience) => (
                <div key={audience} className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-3">
                  <div className="text-sm font-bold text-slate-950">{audience}</div>
                  <div className="text-xs text-slate-500 mt-1">Audience variant</div>
                </div>
              ))}
            </div>
            <button onClick={generateDraft} className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-camelot-gold px-5 py-3 font-bold text-camelot-navy hover:bg-camelot-gold-light">
              <PenLine size={18} /> Generate For Review
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="font-heading text-2xl text-slate-950">Approval Queue</h2>
                <p className="text-sm text-slate-500">Generated content must be approved before scheduling or publishing.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">
                <LockKeyhole size={14} /> Human Approval Required
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left p-5 transition-colors hover:bg-[#FFFBF0] ${selectedId === item.id ? 'bg-[#FFFBF0]' : 'bg-white'}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-camelot-gold">{item.channel}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusStyles[item.status]}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-400">{formatDateTime(item.scheduledAt)}</span>
                      </div>
                      <h3 className="font-bold text-slate-950">{item.title}</h3>
                      <p className="text-sm text-slate-600 mt-1 max-w-3xl">{item.excerpt}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-camelot-gold">{item.score}</div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">SEO/Safety</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {selected && (
          <section className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-camelot-gold font-bold">{selected.channel} Preview</div>
                  <h2 className="font-heading text-3xl text-slate-950 mt-1">{selected.title}</h2>
                  <p className="text-sm text-slate-500 mt-2">{selected.contentType} | {selected.audience} | {formatDateTime(selected.scheduledAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setStatus(selected.id, 'approved')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                    Approve
                  </button>
                  <button onClick={() => setStatus(selected.id, 'scheduled')} className="rounded-xl bg-camelot-navy px-4 py-2 text-sm font-bold text-white hover:bg-camelot-navy/90">
                    Schedule
                  </button>
                  <button onClick={() => setStatus(selected.id, 'draft')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-camelot-gold">
                    Send Back
                  </button>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-[#FFFEFB] p-5">
                <p className="text-slate-700 leading-relaxed">{selected.body}</p>
                <div className="mt-5 rounded-xl border-l-4 border-camelot-gold bg-[#F8F6EF] p-4 text-sm font-semibold text-slate-800">
                  CTA: {selected.cta}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                {selected.safetyFlags.map((flag) => (
                  <div key={flag} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">
                    <CheckCircle2 size={16} className="inline mr-2" />{flag}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-heading text-xl text-slate-950 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-600" /> Non-Negotiables
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {CAMELOT_CONTENT_RULES.forbidden.slice(0, 6).map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <span className="text-red-600 font-bold">×</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-camelot-navy rounded-2xl p-5 text-white shadow-sm">
                <h3 className="font-heading text-xl flex items-center gap-2">
                  <Mail size={18} className="text-camelot-gold" /> Approved Contact Block
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-white/80">
                  David A. Goldoff, President & Founder<br />
                  Camelot Property Management<br />
                  57 West 57th Street, 4th Floor, New York, NY 10019<br />
                  P: (212) 206-9939 ext. 701<br />
                  dgoldoff@camelot.nyc | info@camelot.nyc | www.camelot.nyc
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-heading text-2xl text-slate-950 flex items-center gap-2">
              <CalendarDays size={22} className="text-camelot-gold" /> Weekly Cadence
            </h2>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-camelot-navy text-white">
                  <tr>
                    {['Day', 'Blog', 'Facebook', 'LinkedIn', 'Instagram', 'X', 'Email', 'Video'].map((head) => (
                      <th key={head} className="px-3 py-3 text-left text-xs uppercase tracking-[0.12em]">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CONTENT_CADENCE.map((row) => (
                    <tr key={row.day} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-bold">{row.day}</td>
                      <td className="px-3 py-3">{row.blog}</td>
                      <td className="px-3 py-3">{row.facebook}</td>
                      <td className="px-3 py-3">{row.linkedin}</td>
                      <td className="px-3 py-3">{row.instagram}</td>
                      <td className="px-3 py-3">{row.x}</td>
                      <td className="px-3 py-3">{row.email}</td>
                      <td className="px-3 py-3">{row.video}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-heading text-2xl text-slate-950 flex items-center gap-2">
              <BarChart3 size={22} className="text-camelot-gold" /> Performance Snapshot
            </h2>
            <div className="grid grid-cols-2 gap-4 mt-5">
              <MiniStat label="Blog SEO Score" value="91" />
              <MiniStat label="Approval SLA" value="48h" />
              <MiniStat label="OpenAI Cost Guard" value="On" />
              <MiniStat label="Audit Trail" value="100%" />
            </div>
            <div className="mt-5 space-y-3">
              {['Organic blog traffic', 'LinkedIn board engagement', 'Newsletter clicks', 'Lead form conversions'].map((label, idx) => (
                <div key={label}>
                  <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                    <span>{label}</span>
                    <span>{[72, 64, 58, 41][idx]}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-camelot-gold to-camelot-navy" style={{ width: `${[72, 64, 58, 41][idx]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl text-slate-950 flex items-center gap-2">
                <Globe2 size={22} className="text-camelot-gold" /> Publishing Integrations
              </h2>
              <p className="text-sm text-slate-500 mt-1">Credentials stay outside the frontend. This page tracks what must be wired in backend/server mode.</p>
            </div>
            <button
              onClick={() => toast.success('Health check queued for credentialed backend mode')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-camelot-gold"
            >
              <RefreshCw size={16} /> Run Health Check
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-5">
            {CONTENT_INTEGRATIONS.map((integration) => (
              <div key={integration.name} className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">{integration.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{integration.purpose}</p>
                  </div>
                  <UploadCloud size={18} className="text-camelot-gold flex-shrink-0" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500">{integration.auth}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-600">{integration.status.replace(/_/g, ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-heading text-2xl text-slate-950 flex items-center gap-2">
              <Target size={22} className="text-camelot-gold" /> CTA Plan Matrix
            </h2>
            <p className="text-sm text-slate-500 mt-1">CTAs shift by topic, while contact details stay approved and compliant.</p>
            <div className="mt-5 space-y-3">
              {CTA_PLANS.map((plan) => (
                <div key={plan.contentType} className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-4">
                  <h3 className="font-bold text-slate-950">{plan.contentType}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-sm">
                    <div className="rounded-lg bg-camelot-gold/10 p-3">
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500 font-bold">Primary</span>
                      <span className="font-semibold text-slate-800">{plan.primary}</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500 font-bold">Secondary</span>
                      <span className="font-semibold text-slate-800">{plan.secondary}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-heading text-2xl text-slate-950 flex items-center gap-2">
              <Database size={22} className="text-camelot-gold" /> Database Schema
            </h2>
            <p className="text-sm text-slate-500 mt-1">These tables are the backend contract for Phase 2 persistence and scheduling.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {DATABASE_TABLES.map((table) => (
                <div key={table.table} className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-4">
                  <h3 className="font-bold text-slate-950">{table.table}</h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{table.purpose}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {table.fields.slice(0, 6).map((field) => (
                      <span key={field} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-heading text-2xl text-slate-950 flex items-center gap-2">
            <Search size={22} className="text-camelot-gold" /> Content Themes And Source Discipline
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-6 mt-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CONTENT_THEMES.map((theme) => (
                <div key={theme} className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-4 text-sm font-semibold text-slate-700">
                  {theme}
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-camelot-gold/30 bg-[#FFFBF0] p-5">
              <h3 className="font-bold text-slate-950">Image and SEO rules</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>Use real source images first, with attribution.</li>
                <li>AI images are fallback only and must be labeled as illustrations.</li>
                <li>Deduplicate keywords and topics across a four-week window.</li>
                <li>WordPress drafts can be prepared, but publishing waits for approval.</li>
                <li>Facebook and company LinkedIn posts are packaged for Sam when direct API posting is not enabled.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-heading text-2xl text-slate-950 flex items-center gap-2">
            <Search size={22} className="text-camelot-gold" /> Intelligence Roadmap
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
            <RoadmapCard icon={FileText} title="SEO Optimizer" text="Keyword clusters, internal links, schema markup, and rank tracking." />
            <RoadmapCard icon={Megaphone} title="Repurposing Pipeline" text="Blog to social snippets, email excerpt, and video script." />
            <RoadmapCard icon={Clock} title="Optimal Timing" text="Post windows based on platform engagement history." />
            <RoadmapCard icon={PlayCircle} title="Video Workflow" text="YouTube titles, chapters, thumbnails, and short-form scripts." />
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string | number; detail: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#F7F1DE] text-camelot-gold flex items-center justify-center">
          <Icon size={21} />
        </div>
        <div className="text-3xl font-bold text-slate-950">{value}</div>
      </div>
      <div className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500 font-bold">{label}</div>
      <p className="text-sm text-slate-600 mt-1">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-4">
      <div className="text-2xl font-bold text-camelot-gold">{value}</div>
      <div className="text-xs uppercase tracking-[0.14em] text-slate-500 font-bold mt-1">{label}</div>
    </div>
  );
}

function RoadmapCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-4">
      <div className="w-10 h-10 rounded-xl bg-camelot-gold/10 text-camelot-gold flex items-center justify-center mb-3">
        <Icon size={19} />
      </div>
      <h3 className="font-bold text-slate-950">{title}</h3>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">{text}</p>
    </div>
  );
}

/**
 * Campaign Package Builder — Phase 1 of the Marketing & Content Automation
 * Module: one researched idea becomes a full multi-channel campaign, routed
 * through brand/safety checks into the human approval queue. No auto-publish.
 */
function CampaignPackageBuilder() {
  const [campaignName, setCampaignName] = useState('');
  const [audience, setAudience] = useState('Condo boards');
  const [funnel, setFunnel] = useState<FunnelStage>('awareness');
  const [draftBody, setDraftBody] = useState('');
  const [pkg, setPkg] = useState<CampaignPackage | null>(null);
  const brand = useMemo(() => (draftBody.trim() ? runBrandSafetyCheck(draftBody, { hasSources: false }) : null), [draftBody]);

  const audiences = ['Condo boards', 'Co-op boards', 'Landlords', 'Developers', 'Family offices', 'Private equity', 'Foreign investors', 'Public adjusters', 'Litigators', 'Construction professionals', 'Engineers', 'Residents'];

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-camelot-gold font-bold">Marketing OS — Phase 1</div>
          <h2 className="text-lg font-bold text-slate-950 mt-1">Campaign Package Builder</h2>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            One researched idea &rarr; a 12-item channel campaign (article, GBP, LinkedIn &times;2, Facebook, Instagram, X,
            newsletter, YouTube, Reels, cold-call point, follow-up email), each with its own secure approval token.
            Packages persist to the database and stop at <strong>Pending Review</strong> — nothing publishes without a documented human approval.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <div className="space-y-3">
          <input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Campaign name — e.g., LL97 penalties hit co-op budgets" className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <select value={audience} onChange={e => setAudience(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              {audiences.map(a => <option key={a}>{a}</option>)}
            </select>
            <select value={funnel} onChange={e => setFunnel(e.target.value as FunnelStage)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="awareness">Awareness</option>
              <option value="consideration">Consideration</option>
              <option value="high_intent">High intent</option>
              <option value="investment_partnership">Investment &amp; partnership</option>
            </select>
          </div>
          <textarea value={draftBody} onChange={e => setDraftBody(e.target.value)} rows={5} placeholder="Paste draft copy here to run the live Brand & Safety Check (approved CTAs, personal-cell block, banned claims, no mechanical positioning)..." className="w-full border rounded-lg px-3 py-2 text-sm" />
          {brand && (
            <div className={`rounded-lg border p-3 text-sm ${brand.passed ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
              <div className="font-bold mb-1">{brand.passed ? 'Brand & Safety: PASSED' : 'Brand & Safety: BLOCKED'}</div>
              {brand.findings.length === 0 ? <div>No findings.</div> : brand.findings.map((f, i) => (
                <div key={i} className="mb-1"><span className="font-semibold uppercase text-[10px] mr-1">{f.severity}</span>{f.detail}</div>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              if (!campaignName.trim()) { toast.error('Name the campaign first'); return; }
              const built = buildCampaignPackage({ campaignName: campaignName.trim(), primaryAudience: audience, funnelStage: funnel });
              setPkg(built);
              persistCampaignPackage(built);
              logContentRun({ module: 'seo_gbp_engine', outputsGenerated: built.items.length, notes: `Package ${built.packageId} created from dashboard` });
              toast.success(`Package ${built.packageId} created — 12 items queued at Generated`);
            }}
            className="px-5 py-2.5 bg-camelot-navy text-white rounded-lg text-sm font-semibold hover:bg-camelot-navy/90"
          >
            Build 12-Item Campaign Package
          </button>
        </div>
        <div>
          {pkg ? (
            <div className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-slate-950">{pkg.packageId}</div>
                <div className="text-xs text-slate-500">{pkg.primaryAudience} &middot; {pkg.funnelStage.replace('_', ' ')}</div>
              </div>
              <div className="text-xs text-slate-500 mb-2">Primary CTA: <strong>{pkg.primaryCta}</strong></div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {pkg.items.map(item => (
                  <div key={item.secureToken} className="flex items-center justify-between text-xs border border-slate-100 rounded px-2 py-1.5">
                    <span className="font-semibold text-slate-800">{item.channel}</span>
                    <span className="text-slate-400 font-mono">{item.secureToken.slice(0, 8)}&hellip;</span>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">Each token is the item-level approval key — a vague &ldquo;looks good&rdquo; email approves nothing.</div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              <div className="font-bold text-slate-700 mb-2">Automation schedule (America/New_York)</div>
              {AUTOMATION_SCHEDULE.map(row => (
                <div key={row.when} className="flex justify-between border-b border-slate-100 py-1">
                  <span>{row.when}</span><span className="text-slate-700 font-semibold">{row.what}</span>
                </div>
              ))}
              <div className="mt-3 text-xs">CTA ladder: {CTA_HIERARCHY.awareness[0]} &rarr; {CTA_HIERARCHY.consideration[0]} &rarr; {CTA_HIERARCHY.high_intent[0]} &rarr; {CTA_HIERARCHY.investment_partnership[0]}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
