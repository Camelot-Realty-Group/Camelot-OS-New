import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ListTodo, Megaphone, ScrollText, TriangleAlert } from 'lucide-react';
import { fetchMerlinSummary, type MerlinSummary } from '@/lib/merlin-api';

const EMPTY_SUMMARY: MerlinSummary = {
  storage: 'memory',
  warning: null,
  tasks: { total: 0, open: 0, in_progress: 0, blocked: 0, done: 0, cancelled: 0 },
  campaigns: { total: 0, draft: 0, active: 0, paused: 0, completed: 0 },
  templates: { total: 0 },
  activity: [],
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-heading text-3xl text-[#f4e4a8]">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
    </div>
  );
}

export default function MerlinConsole() {
  const [summary, setSummary] = useState<MerlinSummary>(EMPTY_SUMMARY);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMerlinSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message);
      });
    fetch('/api/health')
      .then((res) => {
        if (!cancelled) setApiOnline(res.ok);
      })
      .catch(() => {
        if (!cancelled) setApiOnline(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const queueLine = summary.tasks.open + summary.tasks.in_progress + summary.tasks.blocked;
  const presence = loadError
    ? 'The command center could not read the Merlin API.'
    : queueLine === 0
      ? 'Queue is clear. No open tasks are waiting.'
      : `${queueLine} task${queueLine === 1 ? '' : 's'} still open, in progress, or blocked.`;

  return (
    <div className="jarvis-grid min-h-full text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        <section className="jarvis-panel jarvis-rise relative overflow-hidden px-6 py-8 md:px-10">
          <div className="flex flex-col items-center text-center">
            <div className="merlin-orb relative mb-5 grid h-28 w-28 place-items-center rounded-full border border-[#e8cc5a]/50 bg-[radial-gradient(circle_at_40%_35%,#1c3c52,#071018_68%)]">
              <div className="absolute inset-2 rounded-full border border-cyan-200/20" />
              <div className="absolute inset-5 rounded-full border border-[#e8cc5a]/30" />
              <span className="font-heading text-lg tracking-[0.28em] text-[#f4e4a8]">M</span>
            </div>
            <p className="text-[11px] uppercase tracking-[0.42em] text-[#e8cc5a]">Camelot OS</p>
            <h1 className="mt-2 font-heading text-5xl text-white md:text-6xl">Merlin</h1>
            <p className="mt-3 max-w-xl text-base text-slate-300">{presence}</p>
            <p className="mt-2 max-w-lg text-sm text-slate-500">
              Use the command bar to open a module, add a task, or leave a note for the agent. Merlin does not invent buildings, fees, or alerts.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.16em]">
            <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
              API {apiOnline === null ? 'checking' : apiOnline ? 'online' : 'offline'}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
              Store {summary.storage === 'supabase' ? 'Supabase' : 'memory'}
            </span>
            <Link to="/chat" className="rounded-full border border-[#e8cc5a]/40 px-3 py-1 text-[#f4e4a8] hover:bg-[#e8cc5a]/10">
              Open Merlin chat
            </Link>
          </div>
          {(summary.warning || loadError) && (
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-amber-200/90">{loadError || summary.warning}</p>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="jarvis-panel jarvis-rise p-5" style={{ animationDelay: '60ms' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-heading text-2xl text-white">
                <ListTodo size={18} className="text-[#e8cc5a]" /> Tasks
              </h2>
              <Link to="/tasks" className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-cyan-100/80 hover:text-white">
                Queue <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Open" value={summary.tasks.open} />
              <Stat label="Active" value={summary.tasks.in_progress} />
              <Stat label="Blocked" value={summary.tasks.blocked} />
            </div>
            {summary.tasks.total === 0 && (
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                No tasks yet. Add one from the queue, the command bar (“new task …”), or <span className="text-slate-200">POST /api/merlin/tasks</span>.
              </p>
            )}
          </section>

          <section className="jarvis-panel jarvis-rise p-5" style={{ animationDelay: '120ms' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-heading text-2xl text-white">
                <TriangleAlert size={18} className="text-[#e8cc5a]" /> Alerts
              </h2>
              <Link to="/alerts" className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-cyan-100/80 hover:text-white">
                Alert desk <ArrowUpRight size={14} />
              </Link>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              Building alerts stay on the Alerts desk. Merlin only shows activity that was actually logged.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Campaigns" value={summary.campaigns.total} />
              <Stat label="Templates" value={summary.templates.total} />
            </div>
            <Link to="/marketing" className="mt-4 inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-[#f4e4a8]">
              <Megaphone size={14} /> Marketing desk
            </Link>
          </section>

          <section className="jarvis-panel jarvis-rise p-5" style={{ animationDelay: '180ms' }}>
            <h2 className="mb-4 flex items-center gap-2 font-heading text-2xl text-white">
              <ScrollText size={18} className="text-[#e8cc5a]" /> Recent activity
            </h2>
            {summary.activity.length === 0 ? (
              <p className="text-sm leading-relaxed text-slate-400">
                No Merlin activity yet. Commands you leave in the bar, QA reviews, and agent writes will show up here.
              </p>
            ) : (
              <ul className="space-y-3">
                {summary.activity.map((item) => (
                  <li key={item.id} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-[#e8cc5a]">{item.action}</div>
                    <p className="mt-1 text-sm text-slate-200">{item.summary || item.module || item.actor}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
