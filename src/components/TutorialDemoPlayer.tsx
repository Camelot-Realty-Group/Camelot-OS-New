import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  CheckCircle2,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';

interface DemoStep {
  title: string;
  caption: string;
  cursor: { x: number; y: number };
  highlight: { x: number; y: number; w: number; h: number };
  label: string;
}

interface TutorialDemo {
  route: string;
  sceneTitle: string;
  steps: DemoStep[];
}

const DEFAULT_DEMO: TutorialDemo = {
  route: '/',
  sceneTitle: 'Camelot OS Workflow',
  steps: [
    {
      title: 'Open the workspace',
      caption: 'Start on the dashboard and choose the bot or workflow you need.',
      cursor: { x: 18, y: 23 },
      highlight: { x: 5, y: 17, w: 22, h: 10 },
      label: 'Sidebar navigation',
    },
    {
      title: 'Enter the property or task',
      caption: 'Use the search and criteria area to define the building, contact, or report.',
      cursor: { x: 43, y: 33 },
      highlight: { x: 31, y: 26, w: 41, h: 13 },
      label: 'Input area',
    },
    {
      title: 'Review the output',
      caption: 'Open the generated result, check the facts, and save or export the package.',
      cursor: { x: 72, y: 67 },
      highlight: { x: 27, y: 52, w: 57, h: 26 },
      label: 'Output panel',
    },
  ],
};

const DEMOS: Record<string, TutorialDemo> = {
  'getting-started': {
    route: '/',
    sceneTitle: 'Getting Started with Camelot OS',
    steps: [
      {
        title: 'Start from the dashboard',
        caption: 'The first screen shows recent work, bot shortcuts, report attribution, alerts, and saved activity.',
        cursor: { x: 52, y: 29 },
        highlight: { x: 28, y: 17, w: 58, h: 23 },
        label: 'Dashboard overview',
      },
      {
        title: 'Use the left navigation',
        caption: 'The sidebar groups Scout, Jackie, intelligence, proposals, reports, and settings.',
        cursor: { x: 12, y: 42 },
        highlight: { x: 4, y: 13, w: 20, h: 66 },
        label: 'Bot menu',
      },
      {
        title: 'Launch the right bot',
        caption: 'Pick a bot card to begin the workflow, then come back here if you need a refresher.',
        cursor: { x: 48, y: 62 },
        highlight: { x: 31, y: 50, w: 47, h: 25 },
        label: 'Bot workspaces',
      },
    ],
  },
  'searching-buildings': {
    route: '/',
    sceneTitle: 'Building Search Demo',
    steps: [
      {
        title: 'Choose a search type',
        caption: 'Search by address, owner name, or unit lookup depending on what information you have.',
        cursor: { x: 37, y: 28 },
        highlight: { x: 30, y: 22, w: 30, h: 9 },
        label: 'Search tabs',
      },
      {
        title: 'Type the building address',
        caption: 'Enter the exact property address so Scout can keep the report tied to the correct building.',
        cursor: { x: 52, y: 39 },
        highlight: { x: 31, y: 34, w: 47, h: 11 },
        label: 'Address input',
      },
      {
        title: 'Open a result',
        caption: 'Click a result card or row to open the property detail and start deeper research.',
        cursor: { x: 44, y: 66 },
        highlight: { x: 30, y: 56, w: 50, h: 21 },
        label: 'Result card',
      },
    ],
  },
  'region-scans': {
    route: '/',
    sceneTitle: 'Region Scan Demo',
    steps: [
      {
        title: 'Pick the neighborhood',
        caption: 'Choose a borough, neighborhood, or source list so Scout knows the market area to scan.',
        cursor: { x: 41, y: 35 },
        highlight: { x: 30, y: 28, w: 31, h: 12 },
        label: 'Region selector',
      },
      {
        title: 'Run the scan',
        caption: 'Scout builds a lead set using distress, violations, ownership clues, and management signals.',
        cursor: { x: 71, y: 36 },
        highlight: { x: 64, y: 29, w: 18, h: 12 },
        label: 'Scan action',
      },
      {
        title: 'Save the best leads',
        caption: 'Promote promising buildings into saved leads, the pipeline, Jackie, or outreach.',
        cursor: { x: 75, y: 66 },
        highlight: { x: 28, y: 53, w: 57, h: 27 },
        label: 'Prioritized leads',
      },
    ],
  },
  'property-card': {
    route: '/results',
    sceneTitle: 'Property Detail Card Demo',
    steps: [
      {
        title: 'Open the detail card',
        caption: 'The property card keeps facts, contacts, violations, maps, and notes in one place.',
        cursor: { x: 46, y: 30 },
        highlight: { x: 26, y: 19, w: 58, h: 19 },
        label: 'Property header',
      },
      {
        title: 'Review data tabs',
        caption: 'Move through violations, financials, permits, energy, contacts, and notes before outreach.',
        cursor: { x: 52, y: 45 },
        highlight: { x: 29, y: 41, w: 50, h: 10 },
        label: 'Research tabs',
      },
      {
        title: 'Take action',
        caption: 'Save, enrich, add to pipeline, run Jackie, or generate a proposal from the same record.',
        cursor: { x: 70, y: 70 },
        highlight: { x: 31, y: 58, w: 52, h: 24 },
        label: 'Action panel',
      },
    ],
  },
  pipeline: {
    route: '/pipeline',
    sceneTitle: 'Pipeline Demo',
    steps: [
      {
        title: 'See every lead by stage',
        caption: 'The pipeline shows what is discovered, contacted, in meeting, proposal, won, or lost.',
        cursor: { x: 45, y: 30 },
        highlight: { x: 27, y: 20, w: 57, h: 15 },
        label: 'Deal stages',
      },
      {
        title: 'Move the building forward',
        caption: 'Drag cards or update the stage after calls, emails, meetings, or proposal delivery.',
        cursor: { x: 56, y: 57 },
        highlight: { x: 32, y: 43, w: 46, h: 28 },
        label: 'Lead card',
      },
      {
        title: 'Track the next follow-up',
        caption: 'Use notes and dates so the team knows exactly what should happen next.',
        cursor: { x: 73, y: 75 },
        highlight: { x: 49, y: 69, w: 32, h: 13 },
        label: 'Follow-up note',
      },
    ],
  },
  jackie: {
    route: '/report-center',
    sceneTitle: 'Jackie Report Demo',
    steps: [
      {
        title: 'Enter the subject property',
        caption: 'Use the exact address, upload property photos, and confirm the property type before generating.',
        cursor: { x: 47, y: 31 },
        highlight: { x: 30, y: 22, w: 50, h: 19 },
        label: 'Property intake',
      },
      {
        title: 'Choose the report package',
        caption: 'Preview the first email intro, board meeting deck, appendix, proposal, or PowerPoint.',
        cursor: { x: 55, y: 55 },
        highlight: { x: 27, y: 49, w: 58, h: 12 },
        label: 'Output packages',
      },
      {
        title: 'Export and send',
        caption: 'Download HTML/PDF, launch email, or save the generated package to the proposal library.',
        cursor: { x: 73, y: 68 },
        highlight: { x: 31, y: 63, w: 53, h: 15 },
        label: 'Export controls',
      },
    ],
  },
  'instant-proposal': {
    route: '/instant-proposal',
    sceneTitle: 'Instant Proposal Demo',
    steps: [
      {
        title: 'Find or load the property',
        caption: 'Start with address, contact, property type, unit count, and any meeting notes.',
        cursor: { x: 43, y: 32 },
        highlight: { x: 28, y: 22, w: 51, h: 18 },
        label: 'Proposal intake',
      },
      {
        title: 'Review pricing and scope',
        caption: 'Camelot OS builds the recommended Intelligence package, transition plan, and ancillary fee schedule.',
        cursor: { x: 52, y: 55 },
        highlight: { x: 29, y: 47, w: 54, h: 21 },
        label: 'Pricing logic',
      },
      {
        title: 'Generate the proposal',
        caption: 'Print, download, email, and archive the proposal with timestamp and proposal number.',
        cursor: { x: 74, y: 75 },
        highlight: { x: 55, y: 69, w: 28, h: 13 },
        label: 'Proposal actions',
      },
    ],
  },
  outreach: {
    route: '/outreach',
    sceneTitle: 'Outreach Demo',
    steps: [
      {
        title: 'Select the lead',
        caption: 'Pick the building or contact from the pipeline, saved list, or generated proposal.',
        cursor: { x: 37, y: 31 },
        highlight: { x: 27, y: 22, w: 32, h: 18 },
        label: 'Lead selector',
      },
      {
        title: 'Choose the message',
        caption: 'Use property-specific email, call, and follow-up language rather than a generic script.',
        cursor: { x: 61, y: 48 },
        highlight: { x: 43, y: 36, w: 39, h: 25 },
        label: 'Message draft',
      },
      {
        title: 'Log the next step',
        caption: 'Record what was sent, who it went to, and when Camelot should follow up.',
        cursor: { x: 73, y: 73 },
        highlight: { x: 45, y: 66, w: 38, h: 15 },
        label: 'Follow-up tracker',
      },
    ],
  },
  alerts: {
    route: '/alerts',
    sceneTitle: 'Alerts Demo',
    steps: [
      {
        title: 'Review the alert feed',
        caption: 'See new violations, 311 complaints, compliance events, and market activity.',
        cursor: { x: 43, y: 30 },
        highlight: { x: 27, y: 20, w: 56, h: 19 },
        label: 'Alert queue',
      },
      {
        title: 'Open the affected building',
        caption: 'Click the alert to see the building record and decide whether it is a lead, risk, or follow-up.',
        cursor: { x: 55, y: 53 },
        highlight: { x: 31, y: 44, w: 50, h: 17 },
        label: 'Alert detail',
      },
      {
        title: 'Assign the response',
        caption: 'Route urgent items to the right person or add them to the pipeline.',
        cursor: { x: 74, y: 72 },
        highlight: { x: 47, y: 66, w: 34, h: 12 },
        label: 'Action owner',
      },
    ],
  },
  'll97-compliance': {
    route: '/compliance',
    sceneTitle: 'LL97 Compliance Demo',
    steps: [
      {
        title: 'Enter the building',
        caption: 'Start with the address, BBL, or building record that needs a compliance gut check.',
        cursor: { x: 43, y: 31 },
        highlight: { x: 29, y: 23, w: 45, h: 15 },
        label: 'Building lookup',
      },
      {
        title: 'Review exposure',
        caption: 'Check open violations, estimated penalties, total exposure, and why the property may be non-compliant.',
        cursor: { x: 52, y: 55 },
        highlight: { x: 28, y: 45, w: 54, h: 24 },
        label: 'Compliance summary',
      },
      {
        title: 'Create the action plan',
        caption: 'Use the result to produce a board-safe summary and identify separately scoped remediation work.',
        cursor: { x: 71, y: 75 },
        highlight: { x: 43, y: 68, w: 39, h: 14 },
        label: 'Action plan',
      },
    ],
  },
  competitors: {
    route: '/intelligence',
    sceneTitle: 'Competitor Tracking Demo',
    steps: DEFAULT_DEMO.steps,
  },
  sentinel: {
    route: '/sentinel',
    sceneTitle: 'Sentinel Market Report Demo',
    steps: DEFAULT_DEMO.steps,
  },
  excalibur: {
    route: '/agreements',
    sceneTitle: 'Excalibur Agreement Demo',
    steps: DEFAULT_DEMO.steps,
  },
  importing: {
    route: '/import',
    sceneTitle: 'Import Demo',
    steps: DEFAULT_DEMO.steps,
  },
  exporting: {
    route: '/export',
    sceneTitle: 'Export Demo',
    steps: DEFAULT_DEMO.steps,
  },
  'scout-ai': {
    route: '/chat',
    sceneTitle: 'Merlin AI Demo',
    steps: DEFAULT_DEMO.steps,
  },
  settings: {
    route: '/settings',
    sceneTitle: 'Settings Demo',
    steps: DEFAULT_DEMO.steps,
  },
};

interface TutorialDemoPlayerProps {
  tutorialId: string;
  title: string;
  onClose: () => void;
}

export default function TutorialDemoPlayer({ tutorialId, title, onClose }: TutorialDemoPlayerProps) {
  const demo = DEMOS[tutorialId] || DEFAULT_DEMO;
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const step = demo.steps[stepIndex] || demo.steps[0];

  useEffect(() => {
    setStepIndex(0);
    setIsPlaying(true);
  }, [tutorialId]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => {
      setStepIndex((current) => (current + 1) % demo.steps.length);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [demo.steps.length, isPlaying, stepIndex]);

  const percentComplete = useMemo(() => ((stepIndex + 1) / demo.steps.length) * 100, [demo.steps.length, stepIndex]);

  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-slate-950/75 px-4 py-6 flex items-center justify-center">
      <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-camelot-gold/30">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-[#FFFEFB] px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-camelot-gold font-bold">Interactive Tutorial</div>
            <h2 className="text-xl font-heading text-slate-950">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            aria-label="Close guided demo"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] min-h-[560px]">
          <div className="relative bg-[#F4F1EA] p-5">
            <div className="relative h-[520px] rounded-2xl border border-slate-300 bg-white shadow-inner overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-11 bg-[#0D0D1A] flex items-center gap-2 px-4">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-300" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
                <div className="ml-4 h-6 flex-1 rounded bg-white/10 px-3 text-[11px] text-slate-300 flex items-center">
                  camelot-os-v10.onrender.com/{demo.route.replace('/', '') || 'dashboard'}
                </div>
              </div>

              <div className="absolute inset-y-11 left-0 w-[24%] bg-[#1F2933] p-4 text-white">
                <div className="mb-5 text-center">
                  <div className="text-camelot-gold font-heading tracking-[0.26em] text-sm">CAMELOT</div>
                  <div className="text-[9px] uppercase tracking-[0.2em] text-slate-300 mt-1">OS V10</div>
                </div>
                {['Search', 'Results', 'Pipeline', 'Outreach', 'Property Engagement Reports', 'Proposals', 'Alerts', 'Tutorials'].map((item, i) => (
                  <div
                    key={item}
                    className={`mb-2 h-8 rounded-lg px-3 flex items-center text-[11px] ${
                      i === 4 || (tutorialId === 'getting-started' && i === 7)
                        ? 'bg-camelot-gold/20 text-camelot-gold'
                        : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="absolute left-[24%] right-0 top-11 bottom-0 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-camelot-gold font-bold">{demo.sceneTitle}</div>
                    <div className="h-7 w-60 bg-slate-900 rounded mt-2 opacity-90" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-9 w-24 rounded-lg bg-camelot-gold" />
                    <div className="h-9 w-24 rounded-lg border border-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-3">
                      <div className="h-3 w-20 rounded bg-slate-200 mb-3" />
                      <div className="h-7 w-16 rounded bg-camelot-gold/25" />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-[1.15fr_.85fr] gap-4">
                  <div className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-4">
                    <div className="h-4 w-40 rounded bg-slate-900 mb-4" />
                    <div className="space-y-3">
                      <div className="h-10 rounded-lg border border-slate-200 bg-white" />
                      <div className="h-10 rounded-lg border border-slate-200 bg-white" />
                      <div className="h-24 rounded-lg bg-slate-100" />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-[#FFFEFB] p-4">
                    <div className="h-4 w-32 rounded bg-slate-900 mb-4" />
                    <div className="h-36 rounded-lg bg-slate-100 mb-3" />
                    <div className="h-10 rounded-lg bg-camelot-gold/20" />
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-4 w-52 rounded bg-slate-900" />
                    <div className="h-7 w-28 rounded bg-camelot-gold" />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((item) => (
                      <div key={item} className="h-14 rounded-lg bg-slate-100" />
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="absolute rounded-xl border-2 border-camelot-gold bg-camelot-gold/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.18)] transition-all duration-700 ease-in-out"
                style={{
                  left: `${step.highlight.x}%`,
                  top: `${step.highlight.y}%`,
                  width: `${step.highlight.w}%`,
                  height: `${step.highlight.h}%`,
                }}
              >
                <span className="absolute -top-7 left-0 rounded-md bg-slate-950 px-2 py-1 text-[10px] font-bold text-camelot-gold uppercase tracking-[0.12em]">
                  {step.label}
                </span>
              </div>

              <MousePointer2
                className="absolute text-slate-950 drop-shadow-lg transition-all duration-700 ease-in-out"
                size={32}
                fill="#C5A55A"
                style={{
                  left: `${step.cursor.x}%`,
                  top: `${step.cursor.y}%`,
                  transform: 'translate(-8px, -4px)',
                }}
              />
            </div>
          </div>

          <aside className="border-l border-slate-200 bg-white p-6 flex flex-col">
            <div className="mb-5">
              <div className="flex items-center gap-2 text-camelot-gold font-bold text-sm mb-2">
                <CheckCircle2 size={16} />
                Step {stepIndex + 1} of {demo.steps.length}
              </div>
              <h3 className="font-heading text-2xl text-slate-950">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.caption}</p>
            </div>

            <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-6">
              <div className="h-full bg-camelot-gold transition-all duration-500" style={{ width: `${percentComplete}%` }} />
            </div>

            <div className="space-y-2 mb-6">
              {demo.steps.map((demoStep, index) => (
                <button
                  key={demoStep.title}
                  onClick={() => {
                    setStepIndex(index);
                    setIsPlaying(false);
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    index === stepIndex
                      ? 'border-camelot-gold bg-[#F8F6EF] text-slate-950'
                      : 'border-slate-200 text-slate-500 hover:border-camelot-gold/50'
                  }`}
                >
                  {index + 1}. {demoStep.title}
                </button>
              ))}
            </div>

            <div className="mt-auto space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPlaying((current) => !current)}
                  className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white inline-flex items-center justify-center gap-2 hover:bg-slate-800"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={() => {
                    setStepIndex(0);
                    setIsPlaying(true);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-slate-600 hover:bg-slate-50"
                  aria-label="Restart demo"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
              <a
                href={demo.route}
                className="w-full rounded-xl border border-camelot-gold/50 px-4 py-3 text-sm font-bold text-camelot-gold inline-flex items-center justify-center gap-2 hover:bg-[#F8F6EF]"
              >
                Open This Section
                <ArrowRight size={16} />
              </a>
              <p className="text-xs leading-relaxed text-slate-500">
                This is recording-ready. Use Loom, Zoom, or Clipchamp while the demo plays to turn it into a narrated training video.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body
  );
}
