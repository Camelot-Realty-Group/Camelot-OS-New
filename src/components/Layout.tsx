import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutGrid,
  Bookmark,
  Upload,
  GitBranch,
  Mail,
  MessageSquare,
  Archive,
  Download,
  Bot,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  HelpCircle,
  ShieldCheck,
  Bell,
  FileText,
  Swords,
  Sword,
  Crown,
  Eye,
  BarChart3,
  Zap,
  AlertTriangle,
  Menu,
  X,
  Megaphone,
  Sparkles,
  Activity,
  Receipt,
  Newspaper,
  Briefcase,
  TrendingDown,
  Building2,
  Users,
  UserSearch,
  Phone,
  Home,
  ListTodo,
  ScrollText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/store';
import { APP_NAME_SHORT } from '@/lib/app-brand';
import { parseMerlinCommand } from '@/lib/merlin-commands';
import { createTask, logMerlinActivity } from '@/lib/merlin-api';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  tourId?: string;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

const HUD_ROUTES = new Set(['/', '/tasks', '/marketing', '/templates']);

const navigation: NavSection[] = [
  {
    id: 'merlin',
    title: 'Merlin',
    items: [
      { label: 'Command', href: '/', icon: <Sparkles size={18} /> },
      { label: 'Tasks', href: '/tasks', icon: <ListTodo size={18} /> },
      { label: 'Merlin chat', href: '/chat', icon: <MessageSquare size={18} />, tourId: 'scout-ai' },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing',
    items: [
      { label: 'Campaign desk', href: '/marketing', icon: <Megaphone size={18} /> },
      { label: 'Instant Proposal', href: '/instant-proposal', icon: <Zap size={18} /> },
      { label: 'Proposal Library', href: '/proposals', icon: <FileText size={18} /> },
      { label: 'Engagement Reports', href: '/report-center', icon: <Crown size={18} /> },
      { label: 'Scout Search', href: '/search', icon: <Search size={18} />, tourId: 'search' },
      { label: 'Results & Scoring', href: '/results', icon: <LayoutGrid size={18} />, tourId: 'results' },
      { label: 'Daily Hunt', href: '/daily-hunt', icon: <Sparkles size={18} /> },
      { label: 'Pipeline', href: '/pipeline', icon: <GitBranch size={18} />, tourId: 'pipeline' },
      { label: 'Outreach', href: '/outreach', icon: <Mail size={18} />, tourId: 'outreach' },
      { label: 'Partner Pitch Decks', href: '/partner-pitches', icon: <Briefcase size={18} /> },
      { label: 'Neighborhood Leads', href: '/neighborhood-leads', icon: <Users size={18} /> },
      { label: 'Needs Email', href: '/needs-email', icon: <UserSearch size={18} /> },
      { label: 'Call Queue', href: '/call-queue', icon: <Phone size={18} /> },
      { label: 'Postcard Mailer', href: '/postcard-mailer', icon: <Mail size={18} /> },
      { label: 'Merlin Content', href: '/content-engine', icon: <Megaphone size={18} /> },
      { label: 'Welcome Home', href: '/welcome-home', icon: <Home size={18} /> },
      { label: 'Saved', href: '/saved', icon: <Bookmark size={18} /> },
      { label: 'Factory Engine', href: '/factory-engine', icon: <Bot size={18} /> },
    ],
  },
  {
    id: 'templates',
    title: 'Templates',
    items: [
      { label: 'Template Library', href: '/templates', icon: <ScrollText size={18} /> },
      { label: 'Generate Agreement', href: '/agreements', icon: <Sword size={18} /> },
      { label: 'Templates & Billing', href: '/template-billing', icon: <Receipt size={18} /> },
    ],
  },
  {
    id: 'operations',
    title: 'Buildings',
    items: [
      { label: 'Portfolio', href: '/portfolio', icon: <Building2 size={18} /> },
      { label: 'Cost Optimization', href: '/cost-cutting', icon: <TrendingDown size={18} /> },
      { label: 'Cost-Beat Report', href: '/cost-beat-report', icon: <FileText size={18} /> },
      { label: 'Alerts', href: '/alerts', icon: <Bell size={18} /> },
      { label: 'Shield — Compliance', href: '/compliance', icon: <ShieldCheck size={18} /> },
      { label: 'Violations', href: '/violations', icon: <AlertTriangle size={18} /> },
      { label: 'Competitors', href: '/intelligence', icon: <Swords size={18} /> },
      { label: 'Reports', href: '/reports', icon: <FileText size={18} /> },
      { label: 'Sentinel — Market', href: '/sentinel', icon: <Eye size={18} /> },
      { label: 'Arthur — Underwriting', href: '/arthur', icon: <BarChart3 size={18} /> },
      { label: 'Traded NY', href: '/traded-ny', icon: <Newspaper size={18} /> },
      { label: 'Import', href: '/import', icon: <Upload size={18} />, tourId: 'import' },
      { label: 'Archive', href: '/archive', icon: <Archive size={18} /> },
      { label: 'Integrations', href: '/integrations', icon: <GitBranch size={18} /> },
      { label: 'Export', href: '/export', icon: <Download size={18} />, tourId: 'export' },
      { label: 'AI Bots', href: '/bots', icon: <Bot size={18} /> },
      { label: 'QA Console', href: '/qa', icon: <Activity size={18} /> },
      { label: 'Settings', href: '/settings', icon: <Settings size={18} />, tourId: 'settings' },
      { label: 'Tutorials', href: '/tutorials', icon: <BookOpen size={18} /> },
    ],
  },
];

function sectionForPath(pathname: string) {
  return navigation.find((section) =>
    section.items.some((item) => (item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`))),
  )?.id || 'merlin';
}

function isActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface LayoutProps {
  children: ReactNode;
  onStartTour?: () => void;
}

export default function Layout({ children, onStartTour }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    merlin: true,
    marketing: true,
    templates: true,
    operations: true,
  });
  const [command, setCommand] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authReady, setAuthReady] = useState(true);
  const [accessToken, setAccessToken] = useState('');
  const [viewKey, setViewKey] = useState(0);
  const activeSection = useMemo(() => sectionForPath(location.pathname), [location.pathname]);
  const hud = HUD_ROUTES.has(location.pathname);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setOpenSections((current) => ({ ...current, [activeSection]: true }));
  }, [activeSection]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/merlin/session')
      .then((res) => res.json())
      .then((data: { required?: boolean; authenticated?: boolean }) => {
        if (cancelled) return;
        setAuthRequired(Boolean(data.required));
        setAuthReady(data.required ? Boolean(data.authenticated) : true);
      })
      .catch(() => {
        if (!cancelled) setAuthRequired(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewKey]);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    const res = await fetch('/api/merlin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: accessToken }),
    });
    if (!res.ok) {
      toast.error('That Merlin token was not accepted.');
      return;
    }
    setAccessToken('');
    setAuthReady(true);
    setViewKey((value) => value + 1);
    setReply('Merlin is unlocked on this browser for 12 hours.');
  };

  const onCommand = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseMerlinCommand(command);
    if (parsed.type === 'empty') return;
    setSending(true);
    try {
      if (parsed.type === 'navigate') {
        setReply(`Opening ${parsed.label}.`);
        setCommand('');
        navigate(parsed.href);
        return;
      }
      if (parsed.type === 'task') {
        await createTask({ title: parsed.title, source: 'command', created_by: 'staff' });
        setReply(`Added “${parsed.title}” to the queue.`);
        setCommand('');
        navigate('/tasks');
        return;
      }
      await logMerlinActivity({
        actor: 'staff',
        action: 'command',
        module: 'merlin',
        summary: parsed.summary,
      });
      setReply('Logged for Merlin. This screen does not invent an answer — an agent reading the activity log can pick it up.');
      setCommand('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Merlin could not take that command.';
      setReply(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const sidebarContent = (
    <>
      <Link to="/" className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        <img
          src="/images/camelot-gold-logo.png"
          alt="Camelot"
          className={cn('flex-shrink-0 rounded-lg object-cover', sidebarCollapsed && !mobileMenuOpen ? 'h-9 w-9' : 'h-12 w-12')}
          onError={(event) => {
            (event.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {(!sidebarCollapsed || mobileMenuOpen) && (
          <div className="min-w-0 flex-1">
            <div className="font-heading text-sm tracking-[0.22em] text-[#f4e4a8]">{APP_NAME_SHORT}</div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Merlin</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="grid h-8 w-8 place-items-center rounded-full text-slate-300 md:hidden"
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
      </Link>

      <nav className="sidebar-scroll flex-1 overflow-y-auto py-3" aria-label="Camelot modules">
        {navigation.map((section) => {
          const expanded = openSections[section.id] || (sidebarCollapsed && !mobileMenuOpen);
          return (
            <div key={section.id} className="mb-2">
              {(!sidebarCollapsed || mobileMenuOpen) && (
                <button
                  type="button"
                  onClick={() => setOpenSections((current) => ({ ...current, [section.id]: !current[section.id] }))}
                  className="flex w-full items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400"
                >
                  {section.title}
                  <ChevronDown size={14} className={cn('transition', expanded && 'rotate-180')} />
                </button>
              )}
              {expanded && section.items.map((item) => {
                const active = isActive(item.href, location.pathname);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    data-tour={item.tourId}
                    title={sidebarCollapsed && !mobileMenuOpen ? item.label : undefined}
                    className={cn(
                      'mx-2 flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition',
                      active ? 'border-[#7ef0ff] bg-[#7ef0ff]/10 text-[#e8f8ff]' : 'border-transparent text-slate-300 hover:border-[#7ef0ff]/40 hover:text-white',
                    )}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {(!sidebarCollapsed || mobileMenuOpen) && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="flex items-center justify-between border-t border-white/10 px-2 py-2">
        {onStartTour && (
          <button type="button" onClick={onStartTour} className="grid h-9 w-9 place-items-center text-slate-400 hover:text-[#f4e4a8]" title="Restart guided tour">
            <HelpCircle size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className="ml-auto hidden h-9 w-9 place-items-center text-slate-400 hover:text-white md:grid"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </>
  );

  return (
    <div className="jarvis-grid flex h-screen overflow-hidden font-sans text-slate-100">
      <aside className={cn('hidden border-r border-[#7ef0ff]/25 bg-[#02070d]/95 md:flex md:flex-col', sidebarCollapsed ? 'w-[4.5rem]' : 'w-72')}>
        {sidebarContent}
      </aside>

      {mobileMenuOpen && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#050910] transition-transform md:hidden', mobileMenuOpen ? 'translate-x-0' : '-translate-x-full')}>
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-[#7ef0ff]/30 bg-[#02070d]/90 py-2 pl-3 pr-40 md:pl-5 md:pr-48">
          <button type="button" onClick={() => setMobileMenuOpen(true)} className="grid h-10 w-10 place-items-center text-[#7ef0ff] md:hidden" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <div className="font-sans text-[10px] uppercase tracking-[0.42em] text-[#7ef0ff]">Camelot command</div>
            <p className="truncate font-heading text-lg tracking-wide text-white">Merlin interface</p>
          </div>
        </header>

        {authRequired && !authReady && (
          <form onSubmit={unlock} className="flex flex-wrap items-center gap-2 border-b border-[#e8cc5a]/30 bg-[#1a1404] px-4 py-2 text-sm text-[#f4e4a8]">
            <label htmlFor="merlin-token" className="uppercase tracking-[0.16em] text-[11px]">Merlin token</label>
            <input
              id="merlin-token"
              type="password"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              autoComplete="current-password"
              className="min-w-0 flex-1 rounded-md border border-[#e8cc5a]/40 bg-black/40 px-3 py-1.5 text-white"
              placeholder="Enter the server token once"
            />
            <button type="submit" className="rounded-md bg-[#e8cc5a] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#1a1404]">
              Unlock
            </button>
          </form>
        )}

        <main key={viewKey} className="min-h-0 flex-1 overflow-y-auto">
          {hud ? children : <div className="jarvis-workbench">{children}</div>}
        </main>

        <form onSubmit={onCommand} className="border-t border-[#7ef0ff]/35 bg-[#02070d]/95 px-3 py-3 md:px-5">
          <label htmlFor="merlin-command" className="sr-only">Command Merlin</label>
          <div className="jarvis-panel flex items-center gap-2 px-3 py-1.5">
            <span className="hidden font-sans text-[10px] tracking-[0.28em] text-[#7ef0ff] sm:inline">&gt;</span>
            <input
              id="merlin-command"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder='Awaiting command — “go to tasks” or “new task call the super”'
              className="min-w-0 flex-1 bg-transparent py-1.5 font-sans text-sm text-white outline-none placeholder:text-[#7a93a3]"
            />
            <button type="submit" disabled={sending} className="border border-[#e8cc5a] bg-[#e8cc5a] px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-[#1a1404] disabled:opacity-60">
              {sending ? 'Sending' : 'Send'}
            </button>
          </div>
          {reply && <p className="px-3 pt-2 text-xs text-slate-400">{reply}</p>}
        </form>
      </div>
    </div>
  );
}
