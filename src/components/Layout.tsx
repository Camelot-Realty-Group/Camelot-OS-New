import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/store';
import { APP_NAME_SHORT } from '@/lib/app-brand';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  tourId?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: 'Scout — New Business',
    items: [
      { label: 'Search', href: '/', icon: <Search size={18} />, tourId: 'search' },
      { label: 'Results & Scoring', href: '/results', icon: <LayoutGrid size={18} />, tourId: 'results' },
      { label: 'Daily Hunt', href: '/daily-hunt', icon: <Sparkles size={18} /> },
      { label: 'Pipeline', href: '/pipeline', icon: <GitBranch size={18} />, tourId: 'pipeline' },
      { label: 'Outreach', href: '/outreach', icon: <Mail size={18} />, tourId: 'outreach' },
      { label: 'Saved', href: '/saved', icon: <Bookmark size={18} /> },
      { label: 'Import', href: '/import', icon: <Upload size={18} />, tourId: 'import' },
      { label: 'Factory Engine', href: '/factory-engine', icon: <Bot size={18} /> },
    ],
  },
  {
    title: 'Traded NY — Deal Flow',
    items: [
      { label: 'Traded NY', href: '/traded-ny', icon: <Newspaper size={18} /> },
    ],
  },
  {
    title: 'Portfolio — Cost Optimization',
    items: [
      { label: 'Portfolio', href: '/portfolio', icon: <Building2 size={18} /> },
      { label: 'Cost Optimization', href: '/cost-cutting', icon: <TrendingDown size={18} /> },
      { label: 'Cost-Beat Report Builder', href: '/cost-beat-report', icon: <FileText size={18} /> },
    ],
  },
  {
    title: 'Engagement — Pitches',
    items: [
      { label: 'Instant Proposal', href: '/instant-proposal', icon: <Zap size={18} /> },
      { label: 'Proposal Library', href: '/proposals', icon: <FileText size={18} /> },
      { label: 'Engagement Reports', href: '/report-center', icon: <Crown size={18} /> },
      { label: 'Partner Pitch Decks', href: '/partner-pitches', icon: <Briefcase size={18} /> },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'Alerts', href: '/alerts', icon: <Bell size={18} /> },
      { label: 'Shield — Compliance', href: '/compliance', icon: <ShieldCheck size={18} /> },
      { label: 'Violations', href: '/violations', icon: <AlertTriangle size={18} /> },
      { label: 'Competitors', href: '/intelligence', icon: <Swords size={18} /> },
      { label: 'Reports', href: '/reports', icon: <FileText size={18} /> },
      { label: 'Sentinel — Market', href: '/sentinel', icon: <Eye size={18} /> },
      { label: 'Arthur — Underwriting', href: '/arthur', icon: <BarChart3 size={18} /> },
      { label: 'Merlin Content', href: '/content-engine', icon: <Megaphone size={18} /> },
    ],
  },
  {
    title: 'Excalibur — Agreements',
    items: [
      { label: 'Generate Agreement', href: '/agreements', icon: <Sword size={18} /> },
      { label: 'Template Concierge', href: '/templates', icon: <FileText size={18} /> },
      { label: 'Templates & Billing', href: '/template-billing', icon: <Receipt size={18} /> },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Merlin AI', href: '/chat', icon: <MessageSquare size={18} />, tourId: 'scout-ai' },
      { label: 'Archive', href: '/archive', icon: <Archive size={18} /> },
      { label: 'Integrations', href: '/integrations', icon: <GitBranch size={18} /> },
      { label: 'Export', href: '/export', icon: <Download size={18} />, tourId: 'export' },
      { label: 'AI Bots', href: '/bots', icon: <Bot size={18} /> },
      { label: 'Settings', href: '/settings', icon: <Settings size={18} />, tourId: 'settings' },
      { label: 'Tutorials', href: '/tutorials', icon: <BookOpen size={18} /> },
      { label: 'QA Console', href: '/qa', icon: <Activity size={18} /> },
    ],
  },
];

interface LayoutProps {
  children: ReactNode;
  onStartTour?: () => void;
}

export default function Layout({ children, onStartTour }: LayoutProps) {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarContent = (
    <>
      <Link
        to="/"
        className="flex items-center gap-3 px-4 py-5 border-b border-slate-200 hover:bg-[#F8F6EF] transition-colors cursor-pointer flex-shrink-0"
      >
        <img
          src="/images/camelot-gold-logo.png"
          alt="Camelot"
          className={cn(
            'flex-shrink-0 transition-all',
            sidebarCollapsed && !mobileMenuOpen
              ? 'w-9 h-9 rounded-lg object-cover shadow-sm'
              : 'w-16 h-16 rounded-xl object-cover shadow-sm'
          )}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {(!sidebarCollapsed || mobileMenuOpen) && (
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h1 className="font-heading font-bold text-sm tracking-wider text-camelot-gold">
                {APP_NAME_SHORT}
              </h1>
              <p className="text-[10px] text-slate-500 tracking-widest">
                PROPERTY MANAGEMENT SYSTEM
              </p>
            </div>
            <div className="flex items-center gap-1">
              {onStartTour && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStartTour();
                  }}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-camelot-gold/20 flex items-center justify-center transition-colors"
                  title="Restart guided tour"
                >
                  <HelpCircle size={14} className="text-camelot-gold" />
                </button>
              )}
              <button
                onClick={() => setMobileMenuOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-red-50 flex items-center justify-center transition-colors md:hidden"
              >
                <X size={14} className="text-slate-500" />
              </button>
            </div>
          </div>
        )}
      </Link>

      {sidebarCollapsed && !mobileMenuOpen && onStartTour && (
        <button
          onClick={onStartTour}
          className="flex items-center justify-center py-2 text-slate-400 hover:text-camelot-gold transition-colors"
          title="Restart guided tour"
        >
          <HelpCircle size={16} />
        </button>
      )}

      <nav className="flex-1 overflow-y-auto py-4 sidebar-scroll">
        {navigation.map((section) => (
          <div key={section.title} className="mb-6">
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <p className="px-4 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-body">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const isActive =
                item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  data-tour={item.tourId}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all font-body',
                    isActive
                      ? 'bg-[#F7F1DE] text-[#263747] font-semibold shadow-sm'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-[#F8F6EF]'
                  )}
                  title={sidebarCollapsed && !mobileMenuOpen ? item.label : undefined}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {(!sidebarCollapsed || mobileMenuOpen) && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <button
        onClick={toggleSidebar}
        className="hidden md:flex items-center justify-center py-2 border-t border-b border-slate-200 text-slate-400 hover:text-slate-900 transition-colors flex-shrink-0"
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden font-body">
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white text-slate-900 px-4 py-3 md:hidden border-b border-slate-200">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#F8F6EF] transition-colors"
        >
          <Menu size={22} />
        </button>

        <div className="flex items-center gap-2">
          <img
            src="/images/camelot-gold-logo.png"
            alt="Camelot"
            className="h-9 w-9 rounded-lg object-cover shadow-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="font-heading font-bold text-sm tracking-wider text-camelot-gold">
            {APP_NAME_SHORT}
          </span>
        </div>

        <div className="w-10" />
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'hidden md:flex flex-col bg-white text-slate-900 transition-all duration-300 sidebar-scroll border-r border-slate-200',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white text-slate-900 flex flex-col transition-transform duration-300 md:hidden border-r border-slate-200',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      <main className="flex-1 overflow-y-auto bg-[#F8F6EF] pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
