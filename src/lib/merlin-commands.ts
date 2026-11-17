const ROUTES: { keys: string[]; href: string; label: string }[] = [
  { keys: ['home', 'merlin', 'console'], href: '/', label: 'Merlin' },
  { keys: ['tasks', 'task queue', 'queue'], href: '/tasks', label: 'Tasks' },
  { keys: ['marketing', 'campaigns'], href: '/marketing', label: 'Marketing' },
  { keys: ['templates', 'template library', 'template'], href: '/templates', label: 'Templates' },
  { keys: ['search', 'scout'], href: '/search', label: 'Scout search' },
  { keys: ['instant proposal', 'proposal'], href: '/instant-proposal', label: 'Instant Proposal' },
  { keys: ['proposals', 'proposal library'], href: '/proposals', label: 'Proposal library' },
  { keys: ['jackie', 'engagement reports', 'report center'], href: '/report-center', label: 'Engagement reports' },
  { keys: ['pipeline'], href: '/pipeline', label: 'Pipeline' },
  { keys: ['outreach'], href: '/outreach', label: 'Outreach' },
  { keys: ['qa', 'qa console', 'diagnostics'], href: '/qa', label: 'QA console' },
  { keys: ['chat', 'merlin chat'], href: '/chat', label: 'Merlin chat' },
  { keys: ['alerts'], href: '/alerts', label: 'Alerts' },
  { keys: ['portfolio'], href: '/portfolio', label: 'Portfolio' },
  { keys: ['violations'], href: '/violations', label: 'Violations' },
  { keys: ['settings'], href: '/settings', label: 'Settings' },
  { keys: ['daily hunt', 'hunt'], href: '/daily-hunt', label: 'Daily Hunt' },
];

export type MerlinCommand =
  | { type: 'empty' }
  | { type: 'navigate'; href: string; label: string }
  | { type: 'task'; title: string }
  | { type: 'note'; summary: string };

function normalize(input: string) {
  return input.trim().replace(/\s+/g, ' ');
}

export function parseMerlinCommand(input: string): MerlinCommand {
  const text = normalize(input);
  if (!text) return { type: 'empty' };

  const taskMatch = text.match(/^(?:new task|task|add task)\s*[:\-]?\s+(.+)$/i);
  if (taskMatch?.[1]) return { type: 'task', title: taskMatch[1].slice(0, 200) };

  const stripped = text.replace(/^(?:go to|open|show|take me to)\s+/i, '').toLowerCase();
  const route = ROUTES.find((entry) => entry.keys.some((key) => stripped === key));
  if (route) return { type: 'navigate', href: route.href, label: route.label };

  return { type: 'note', summary: text.slice(0, 2000) };
}
