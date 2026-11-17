import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createCampaign, fetchCampaigns, updateCampaign, type CampaignStatus, type MerlinCampaign, type MerlinStorage } from '@/lib/merlin-api';

const TOOLS: { href: string; title: string; detail: string }[] = [
  { href: '/instant-proposal', title: 'Instant Proposal', detail: 'Search a property, verify it, and draft a Jackie engagement report.' },
  { href: '/proposals', title: 'Proposal library', detail: 'Saved management proposals.' },
  { href: '/report-center', title: 'Engagement reports', detail: 'Jackie board-facing reports and the report desk.' },
  { href: '/search', title: 'Scout search', detail: 'Find buildings and decision-makers.' },
  { href: '/results', title: 'Results & scoring', detail: 'Review scored properties.' },
  { href: '/daily-hunt', title: 'Daily Hunt', detail: 'The bot-sourced lead queue.' },
  { href: '/pipeline', title: 'Pipeline', detail: 'Move opportunities across stages.' },
  { href: '/outreach', title: 'Outreach', detail: 'Email templates and the composer.' },
  { href: '/partner-pitches', title: 'Partner pitch decks', detail: 'Pitch materials for partner conversations.' },
  { href: '/neighborhood-leads', title: 'Neighborhood leads', detail: 'City-wide lead search and send workflow.' },
  { href: '/call-queue', title: 'Call queue', detail: 'Calls waiting on a person.' },
  { href: '/postcard-mailer', title: 'Postcard mailer', detail: 'Owner mailer campaigns.' },
  { href: '/content-engine', title: 'Merlin content', detail: 'Content packages and the editorial calendar.' },
  { href: '/welcome-home', title: 'Welcome Home', detail: 'Property microsite intake.' },
  { href: '/qa', title: 'QA console', detail: 'Route, package, and release checks before a report goes out.' },
];

const STATUSES: CampaignStatus[] = ['draft', 'active', 'paused', 'completed'];

export default function Marketing() {
  const [campaigns, setCampaigns] = useState<MerlinCampaign[]>([]);
  const [storage, setStorage] = useState<MerlinStorage>('memory');
  const [warning, setWarning] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('');
  const [audience, setAudience] = useState('');
  const [summary, setSummary] = useState('');

  const load = async () => {
    try {
      const data = await fetchCampaigns();
      setCampaigns(data.campaigns || []);
      setStorage(data.storage);
      setWarning(data.warning);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : 'Could not load campaigns');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('A campaign needs a name.');
      return;
    }
    try {
      await createCampaign({
        name: name.trim(),
        channel: channel.trim() || null,
        audience: audience.trim() || null,
        summary: summary.trim() || null,
        status: 'draft',
      });
      setName('');
      setChannel('');
      setAudience('');
      setSummary('');
      toast.success('Campaign saved as a draft.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the campaign');
    }
  };

  const setStatus = async (campaign: MerlinCampaign, status: CampaignStatus) => {
    try {
      await updateCampaign(campaign.id, { status });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the campaign');
    }
  };

  return (
    <div className="jarvis-grid min-h-full text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
        <header className="jarvis-rise">
          <p className="text-[11px] uppercase tracking-[0.36em] text-[#e8cc5a]">Marketing</p>
          <h1 className="mt-1 font-heading text-4xl text-white md:text-5xl">Campaign desk</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Scout, Jackie, Instant Proposal, and outreach stay where they are. This desk is the register Merlin can read: name a campaign when you actually have one.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            Store: {storage === 'supabase' ? 'Supabase' : 'this server’s memory (clears on restart)'}
          </p>
          {warning && <p className="mt-2 text-sm text-amber-200">{warning}</p>}
        </header>

        <section className="jarvis-panel p-4">
          <h2 className="font-heading text-2xl text-white">Campaigns</h2>
          {campaigns.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No campaigns yet. Drafts you add here are the only rows Merlin will see.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{campaign.name}</div>
                    <p className="text-xs text-slate-400">
                      {[campaign.channel, campaign.audience, campaign.status].filter(Boolean).join(' · ')}
                    </p>
                    {campaign.summary && <p className="mt-1 text-sm text-slate-300">{campaign.summary}</p>}
                  </div>
                  <select
                    value={campaign.status}
                    onChange={(event) => void setStatus(campaign, event.target.value as CampaignStatus)}
                    className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm text-white"
                    aria-label={`Status for ${campaign.name}`}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={onCreate} className="mt-4 grid gap-2 md:grid-cols-4">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Campaign name" className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            <input value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="Channel" className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Audience" className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            <input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="One-line summary" className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            <button type="submit" className="md:col-span-4 w-fit rounded-lg bg-[#e8cc5a] px-4 py-2 text-sm font-semibold text-[#1a1404]">
              Save draft
            </button>
          </form>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-2xl text-white">Tools already on the desk</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => (
              <Link key={tool.href} to={tool.href} className="jarvis-panel block p-4 transition hover:border-[#e8cc5a]/40">
                <div className="font-heading text-xl text-white">{tool.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{tool.detail}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
