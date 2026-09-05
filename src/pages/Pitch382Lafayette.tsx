/**
 * Public-facing intro pitch microsite for 382 Lafayette Street, NoHo
 * (route: /pitch/382-lafayette-street).
 *
 * This is a WARM INTRO page, not a priced proposal like the Oak Park at
 * Douglaston pitch (Template #1). Samantha Gasmer's board is exploring a
 * change of management company and asked for materials ahead of a
 * scheduling call — no pricing has been discussed, so this page
 * deliberately has no Proposal/Agreement generation, no fee tables, and
 * no assigned property manager. It covers company history, mission,
 * services, track record (leading with the immediate neighborhood), and
 * areas of coverage, then a simple next-step CTA.
 *
 * Reuses the same design language as PitchOakParkDouglaston.tsx (the
 * Camelot — A Journal of Considered Ownership palette: cream paper,
 * ink text, gold accent) for visual consistency across every instance
 * of this pitch pattern, but is intentionally a much shorter, standalone
 * component — it does not import the agreement/proposal/transition-plan
 * generation engines, since none of that applies pre-pricing.
 */

import { useEffect, useState, type ReactNode } from 'react';
import {
  Building2,
  Calculator,
  Users,
  HeartHandshake,
  TrendingUp,
  CalendarDays,
  Landmark,
  Home,
  Send,
  Award,
  ChevronDown,
  Sparkles,
  LayoutGrid,
  ShieldAlert,
  Radar,
  FileText,
  Cloud,
} from 'lucide-react';
import {
  LAFAYETTE_PROPERTY,
  LAFAYETTE_CONTACT,
  CAMELOT_FACTS,
  CAMELOT_MISSION,
  LAFAYETTE_NEARBY_TRACK_RECORD,
  CAMELOT_PORTFOLIO_HIGHLIGHTS,
  CAMELOT_SERVICES,
  LAFAYETTE_COVER_LETTER_PARAGRAPHS,
  LAFAYETTE_NEXT_STEP,
  LAFAYETTE_NEXT_STEP_FOLLOWUP,
  LAFAYETTE_WHAT_TO_BRING,
  LAFAYETTE_WHAT_YOU_GET,
  CAMELOT_AWARDS,
  CAMELOT_CHARITABLE_GIVING,
  CAMELOT_TESTIMONIALS,
  CAMELOT_TESTIMONIAL_STATS,
  CAMELOT_PROOF_STATS,
  CAMELOT_FEE_PHILOSOPHY,
  LAFAYETTE_LL97_NOTE,
  LAFAYETTE_FAQ,
  LAFAYETTE_INTERIOR_GALLERY,
  LAFAYETTE_GALLERY_NOTE,
  type GalleryPhoto,
  CAMELOT_OS_PORTFOLIO_MIX,
  LAFAYETTE_COST_PREVIEW,
  LAFAYETTE_COST_PREVIEW_NOTE,
  CAMELOT_OS_TOOLS,
  CAMELOT_DRIVE_NOTE,
  SENTINEL_NEARBY_STACKUP,
  CAMELOT_LEADERSHIP,
  LAFAYETTE_TO_BE_CONFIRMED,
  LAFAYETTE_NEIGHBORING_PORTFOLIO,
  LAFAYETTE_FAR_PORTFOLIO_NOTE,
  LAFAYETTE_CASE_STUDIES,
  LAFAYETTE_TECH_PARTNERS,
  LAFAYETTE_TO_OFFICE_MILES,
  LAFAYETTE_TO_EXEC_OFFICE_MILES,
  LAFAYETTE_90_DAY_PLAN,
  LAFAYETTE_90_DAY_COMMITMENT,
  MDS_SAMPLE_PAGE_COUNT,
  MDS_SAMPLE_BASE,
  type Fact,
} from '@/lib/pitches/382-lafayette-street';
import RealNeighborhoodMap from '@/components/RealNeighborhoodMap';
import BoroughCoverageMap from '@/components/BoroughCoverageMap';
import FlipBookViewer from '@/components/FlipBookViewer';
import { sendCamelotEmail } from '@/lib/pdf-generator';
import toast from 'react-hot-toast';

const PHOTO_BASE = '/pitch/382-lafayette-street';
const BRAND_BASE = `${PHOTO_BASE}/brand`;
const LOGO_BLACK = `${BRAND_BASE}/camelot-logo-black.png`;
const LOGO_CREAM = `${BRAND_BASE}/camelot-logo-cream.png`;
const STREET_VIEW = `${PHOTO_BASE}/street-view.jpg`;
const LOT_MAP = `${PHOTO_BASE}/lot-map.png`;
const SIGNATURE_IMG = `${BRAND_BASE}/david-goldoff-signature.png`;
const CALENDLY_URL = 'https://calendly.com/dgoldoff/intro-to-camelot-os-demo';

// Palette matches the Camelot — A Journal of Considered Ownership
// brochure design system: cream paper, ink text, brass/gold accent.
const GOLD = '#9c7c46';
const NAVY = '#16140f';
const IVORY = '#f6f3ec';
const CHARCOAL = '#16140f';
const MUTED = '#6e6858';
const DIVIDER = '#d9d2c2';
const PAPER = '#faf8f3';
// The subject property's own editorial ink — a deep oxblood/wine, the
// one color on the page reserved exclusively for 382 Lafayette Street
// itself, so every reference reads instantly against the gold/navy/cream
// system without competing with it. Set in italic Cormorant Garamond
// wherever it appears in running text (see the <Subject> component).
const SUBJECT_INK = '#7a2436';

// ============================================================
// Small shared bits
// ============================================================

function Unconfirmed({ note }: { note?: string }) {
  return (
    <span
      className="ml-2 inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-sans font-semibold uppercase tracking-wider"
      style={{ backgroundColor: `${GOLD}22`, color: '#8a6a2c' }}
      title={note}
    >
      To be confirmed
    </span>
  );
}

function FactValue({ fact, format }: { fact: Fact<number | string>; format?: (v: any) => string }) {
  const display = format ? format(fact.value) : String(fact.value);
  return (
    <span>
      {display}
      {!fact.confirmed && <Unconfirmed note={fact.note} />}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: GOLD }}>
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight mb-6" style={{ color: NAVY }}>
      {children}
    </h2>
  );
}

function Rule() {
  return <div className="w-16 h-px mb-8" style={{ backgroundColor: GOLD }} />;
}

// Every reference to the subject property renders through this — italic
// Cormorant Garamond in the dedicated oxblood ink, so "382 Lafayette
// Street" (or any shorthand of it) is instantly recognizable anywhere it
// appears on the page, the way a magazine sets a recurring subject's name
// in its own signature ink.
function Subject({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <em
      className="font-heading italic"
      style={{
        color: onDark ? '#e6a6b1' : SUBJECT_INK,
        fontWeight: 600,
        fontSize: '1.5em',
        lineHeight: 1.5,
        display: 'inline-block',
        margin: '0.05em 0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </em>
  );
}

// For prose pulled from the data file (cover letter, FAQ answers, the
// 90-day commitment, the LL97 note) rather than authored inline — splits
// on every mention of the subject property and runs it through <Subject>
// so the highlight reaches copy wherever it lives, not just hand-styled spots.
const SUBJECT_PATTERN = /(382 Lafayette Street|382 Lafayette)/g;
function Highlighted({ text }: { text: string }) {
  const parts = text.split(SUBJECT_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        part === '382 Lafayette Street' || part === '382 Lafayette' ? (
          <Subject key={i}>{part}</Subject>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const SERVICE_ICONS: Record<string, typeof Building2> = {
  'Day-to-day management': Building2,
  'Financial & compliance': Calculator,
  'Governance & transition': Users,
  'Resident experience': HeartHandshake,
  'Beyond management': TrendingUp,
};

const OS_TOOL_ICONS: Record<string, typeof Sparkles> = {
  'Report Center': Sparkles,
  Portfolio: LayoutGrid,
  'Cost-Beat Report Builder': Calculator,
  'Violation & Resolution Center': ShieldAlert,
  Sentinel: Radar,
  'Template Concierge': FileText,
};

// Real coordinates for the map's subject property and Camelot's office,
// sourced via MapQuest address lookups (see 382-lafayette-street.ts).
const MAP_SUBJECT = { label: '382 Lafayette Street', neighborhood: 'NoHo', lat: 40.72768, lng: -73.99354 };
const MAP_OFFICE = { label: '57 West 57th Street', neighborhood: 'Midtown', lat: 40.76438, lng: -73.97654 };
const MAP_EXEC_OFFICE = { label: '501 Madison Avenue', neighborhood: 'Midtown', lat: 40.7605, lng: -73.9733 };

function NeighborhoodMapSection() {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const portfolioPoints = LAFAYETTE_NEIGHBORING_PORTFOLIO.map((p, i) => ({
    label: p.address,
    neighborhood: p.neighborhood,
    crossStreets: p.crossStreets,
    lat: p.lat,
    lng: p.lng,
    number: i + 1,
  }));
  return (
    <div>
      <RealNeighborhoodMap
        subject={MAP_SUBJECT}
        office={MAP_OFFICE}
        secondOffice={MAP_EXEC_OFFICE}
        portfolio={portfolioPoints}
        officeDistanceMiles={LAFAYETTE_TO_OFFICE_MILES}
        secondOfficeDistanceMiles={LAFAYETTE_TO_EXEC_OFFICE_MILES}
        goldHex={GOLD}
        navyHex={NAVY}
        highlightedIndex={highlightedIndex}
      />
      <p className="mt-6 text-xs" style={{ color: MUTED }}>
        Hover a row below to light up its pin on the map above.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2" style={{ borderColor: NAVY }}>
              <th className="text-left py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>#</th>
              <th className="text-left py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>Address</th>
              <th className="text-left py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>Neighborhood</th>
              <th className="text-left py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>Cross streets</th>
            </tr>
          </thead>
          <tbody>
            {LAFAYETTE_NEIGHBORING_PORTFOLIO.map((p, i) => (
              <tr
                key={p.address}
                className="border-b cursor-pointer transition-colors"
                style={{ borderColor: DIVIDER, backgroundColor: highlightedIndex === i ? '#f3ecd9' : 'transparent' }}
                onMouseEnter={() => setHighlightedIndex(i)}
                onMouseLeave={() => setHighlightedIndex(null)}
              >
                <td className="py-2 pr-4 font-semibold" style={{ color: GOLD }}>{i + 1}</td>
                <td className="py-2 pr-4" style={{ color: NAVY }}>{p.address}</td>
                <td className="py-2 pr-4" style={{ color: MUTED }}>{p.neighborhood}</td>
                <td className="py-2" style={{ color: MUTED }}>{p.crossStreets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs italic" style={{ color: MUTED }}>{LAFAYETTE_FAR_PORTFOLIO_NOTE}</p>
    </div>
  );
}

// A mailto: link silently does nothing when the visitor has no default
// mail client configured in their browser -- exactly the failure mode
// reported for this page. This form sends a real email through
// Camelot OS's own Resend-backed endpoint instead, with the mailto:
// link kept only as a secondary fallback.
function ContactDavidForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim() || !message.trim()) {
      toast.error('Please add your email and a short message.');
      return;
    }
    setSending(true);
    const result = await sendCamelotEmail({
      to: 'dgoldoff@camelot.nyc',
      replyTo: email.trim(),
      subject: `382 Lafayette Street \u2014 message from ${name.trim() || 'the Board'}`,
      html: `<p><strong>From:</strong> ${name.trim() || '(no name given)'} &lt;${email.trim()}&gt;</p><p>${message.trim().replace(/\n/g, '<br/>')}</p>`,
      text: `From: ${name.trim() || '(no name given)'} <${email.trim()}>\n\n${message.trim()}`,
    });
    setSending(false);
    if (result.ok) {
      setSent(true);
      toast.success('Sent to David.');
    } else {
      toast.error(result.error || 'Send failed \u2014 try the direct email link below instead.');
    }
  };

  if (sent) {
    return (
      <p className="text-sm leading-relaxed max-w-md" style={{ color: NAVY }}>
        Thank you — your message is on its way to David. He’ll follow up directly.
      </p>
    );
  }

  return (
    <div className="max-w-md space-y-3">
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-2.5 text-sm border"
        style={{ borderColor: DIVIDER, backgroundColor: PAPER, color: NAVY }}
      />
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-2.5 text-sm border"
        style={{ borderColor: DIVIDER, backgroundColor: PAPER, color: NAVY }}
      />
      <textarea
        placeholder="A few times that work for the Board, or any questions before then"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="w-full px-4 py-2.5 text-sm border resize-none"
        style={{ borderColor: DIVIDER, backgroundColor: PAPER, color: NAVY }}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        className="inline-flex items-center gap-2 px-6 py-3 font-sans text-sm font-semibold uppercase tracking-wider disabled:opacity-60"
        style={{ backgroundColor: GOLD, color: NAVY }}
      >
        <Send size={14} />
        {sending ? 'Sending\u2026' : 'Send message to David'}
      </button>
    </div>
  );
}

const NAV_SECTIONS: { id: string; label: string }[] = [
  { id: 'cover-letter', label: 'Introduction' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'about', label: 'About Camelot' },
  { id: 'services', label: 'Services' },
  { id: 'nearby', label: 'A Few Blocks Away' },
  { id: 'case-studies', label: 'Case Studies' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'first-90-days', label: 'First 90 Days' },
  { id: 'technology', label: 'Technology' },
  { id: 'camelot-os', label: 'Camelot OS' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'team', label: 'Team' },
  { id: 'faq', label: 'FAQ' },
  { id: 'next-step', label: 'Next Step' },
];

function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="divide-y" style={{ borderColor: DIVIDER }}>
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.question} className="border-t" style={{ borderColor: DIVIDER }}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-4 py-5 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-heading text-lg" style={{ color: NAVY }}>{item.question}</span>
              <ChevronDown
                size={18}
                strokeWidth={1.5}
                style={{ color: GOLD, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease', flexShrink: 0 }}
              />
            </button>
            {isOpen && (
              <p className="pb-5 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
                <Highlighted text={item.answer} />
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TopNav() {
  // This app runs under react-router's HashRouter, which treats the full
  // URL fragment as its own route — a plain href="#section-id" would be
  // intercepted as "navigate to /section-id" instead of scrolling. Every
  // nav item scrolls via JS and calls preventDefault() instead.
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <nav className="sticky top-0 z-50 border-b overflow-x-auto" style={{ backgroundColor: IVORY, borderColor: DIVIDER }} aria-label="Section navigation">
      <div className="flex items-center gap-1 px-6 md:px-10 py-2 min-w-max">
        {NAV_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => scrollToSection(e, s.id)}
            className="px-3.5 py-2 font-sans text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap rounded-full transition-colors hover:opacity-100"
            style={{ color: NAVY, opacity: 0.65 }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.65')}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

// ============================================================
// Page
// ============================================================

export default function Pitch382Lafayette() {
  // Load the same Cormorant Garamond (display) + General Sans (body)
  // fonts used across the Camelot pitch pattern, scoped to this page.
  useEffect(() => {
    const existing = document.getElementById('lafayette-editorial-fonts');
    if (existing) return;
    const link = document.createElement('link');
    link.id = 'lafayette-editorial-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap';
    document.head.appendChild(link);
    const link2 = document.createElement('link');
    link2.rel = 'stylesheet';
    link2.href = 'https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap';
    document.head.appendChild(link2);
  }, []);

  return (
    <div id="lafayette-editorial" className="fixed inset-0 z-[60] overflow-y-auto font-sans" style={{ backgroundColor: IVORY, color: CHARCOAL }}>
      <style>{`
        #lafayette-editorial .font-heading { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; }
        #lafayette-editorial .font-sans { font-family: 'General Sans', Inter, 'Helvetica Neue', sans-serif; }
        #lafayette-editorial { font-family: 'General Sans', Inter, 'Helvetica Neue', sans-serif; }
        #lafayette-editorial .editorial-dropcap::first-letter {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 600;
          font-size: 4.2em;
          line-height: 0.78;
          float: left;
          padding-right: 0.08em;
          padding-top: 0.03em;
          color: ${GOLD};
        }
      `}</style>

      {/* ============ MASTHEAD ============ */}
      <div className="flex items-center justify-between gap-4 px-6 md:px-10 py-3 border-b" style={{ borderColor: DIVIDER }}>
        <img src={LOGO_BLACK} alt="Camelot Realty Group" className="h-4 md:h-5 w-auto shrink-0" />
        <span className="text-right text-[11px] font-sans uppercase tracking-[0.15em]" style={{ color: MUTED }}>
          Private Introduction &middot; On the cover: <Subject>382 Lafayette Street</Subject> &middot; NoHo
        </span>
      </div>

      <TopNav />

      {/* ============ HERO ============ */}
      <section className="relative min-h-[80vh] flex flex-col border-b" style={{ borderColor: DIVIDER }}>
        <img
          src={STREET_VIEW}
          alt="382 Lafayette Street, NoHo"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(22,20,15,0.45) 0%, rgba(22,20,15,0.25) 35%, rgba(22,20,15,0.92) 100%)' }}
        />
        <div className="relative z-10 px-6 md:px-10 pt-10">
          <img src={LOGO_CREAM} alt="Camelot Realty Group" className="h-8 md:h-10 w-auto" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-10 pb-16 md:pb-24 mt-auto w-full">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.35em] mb-5" style={{ color: GOLD }}>
            Prepared for Samantha Gasmer and the Board at <Subject onDark>382 Lafayette Street</Subject>
          </p>
          <h1 className="font-heading text-5xl md:text-7xl lg:text-8xl text-white leading-[0.95] mb-7 max-w-4xl tracking-tight">
            An introduction,<br />before anything else.
          </h1>
          <p className="text-white/80 text-lg md:text-xl max-w-2xl mb-3 font-heading italic" style={{ fontWeight: 400 }}>
            Who Camelot is, how long we've been doing this, and where we've already done it — a short
            walk from <Subject onDark>{LAFAYETTE_PROPERTY.name}</Subject>.
          </p>
          <p className="text-white/60 text-sm max-w-2xl">
            No pricing attached. We haven't discussed a fee yet, and we're not going to guess at one here.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 md:px-10">

        {/* ============ COVER LETTER ============ */}
        <section id="cover-letter" className="relative py-20 md:py-28 border-b overflow-hidden" style={{ borderColor: DIVIDER }}>
          <img src={LOGO_BLACK} alt="" aria-hidden="true" className="pointer-events-none select-none absolute -right-16 -bottom-16 w-[420px] opacity-[0.04] hidden md:block" />
          <div className="relative z-10 max-w-2xl">
            <SectionLabel>To Samantha and the Board</SectionLabel>
            <SectionTitle>Thank you for the introduction.</SectionTitle>
            <Rule />
            {LAFAYETTE_COVER_LETTER_PARAGRAPHS.map((p, i) => (
              <p
                key={i}
                className={`mb-5 text-base leading-relaxed last:mb-0 ${i === 0 ? 'editorial-dropcap' : ''}`}
                style={{ color: NAVY }}
              >
                <Highlighted text={p} />
              </p>
            ))}
            <img
              src={SIGNATURE_IMG}
              alt="David A. Goldoff signature"
              className="mt-10 h-16 md:h-20 w-auto object-contain object-left"
            />
            <p className="mt-1 font-heading text-lg" style={{ color: NAVY }}>David A. Goldoff</p>
            <p className="font-sans text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>President, Camelot Realty Group</p>
          </div>
        </section>

        {/* ============ PROPERTY SNAPSHOT ============ */}
        <section className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>What we understand so far</SectionLabel>
          <SectionTitle><Subject>{LAFAYETTE_PROPERTY.name}</Subject>, {LAFAYETTE_PROPERTY.neighborhood}.</SectionTitle>
          <Rule />
          <div className="grid md:grid-cols-[1fr_260px] gap-8 mb-8">
            <div>
              <p className="text-base leading-relaxed mb-4" style={{ color: NAVY }}>
                {LAFAYETTE_PROPERTY.character} Everything below comes from a property report David pulled
                directly — nothing here is a guess, and anything not yet confirmed is marked as such.
                The ground floor is home to Screaming Mimi's, the longtime NoHo vintage shop, and the
                building has an elevator modernization and a facade/roof restoration underway — an
                active, well-kept building, not one that's been left alone.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                Per the NYC Landmarks Preservation Commission's NoHo Historic District designation report, the
                building was designed by <strong style={{ color: NAVY }}>Cleverdon & Putzel</strong> in the{' '}
                <strong style={{ color: NAVY }}>{LAFAYETTE_PROPERTY.architecturalStyle.value}</strong> style,
                originally built as a warehouse for Edward Judson.
              </p>
              <img
                src={`${PHOTO_BASE}/street-view-2.jpg`}
                alt="382 Lafayette Street, alternate exterior view"
                className="mt-4 w-full max-w-md object-contain border"
                style={{ borderColor: DIVIDER }}
              />
              <p className="mt-1 text-[10px] italic" style={{ color: MUTED }}>Photo: CityRealty</p>
            </div>
            <img src={LOT_MAP} alt="382 Lafayette Street lot map" className="w-full object-contain border" style={{ borderColor: DIVIDER }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ backgroundColor: '#e5decc' }}>
            {[
              { label: 'Address', value: LAFAYETTE_PROPERTY.fullAddress },
              { label: 'Block & lot', value: <FactValue fact={LAFAYETTE_PROPERTY.blockLot} /> },
              { label: 'Neighborhood', value: `${LAFAYETTE_PROPERTY.neighborhood} (${LAFAYETTE_PROPERTY.historicDistrict.value})` },
              { label: 'Building type', value: 'Boutique pre-war loft condominium' },
              { label: 'Total units', value: <FactValue fact={LAFAYETTE_PROPERTY.totalUnits} format={(v) => `${v} (8 residential + 1 commercial)`} /> },
              { label: 'Stories', value: <FactValue fact={LAFAYETTE_PROPERTY.stories} /> },
              { label: 'Year built', value: <FactValue fact={LAFAYETTE_PROPERTY.yearBuilt} /> },
              { label: 'Exterior', value: <FactValue fact={LAFAYETTE_PROPERTY.exteriorWall} /> },
              { label: 'Zoning', value: <FactValue fact={LAFAYETTE_PROPERTY.zoning} /> },
              { label: 'Ownership', value: <FactValue fact={LAFAYETTE_PROPERTY.ownership} /> },
              { label: 'Building size', value: <FactValue fact={LAFAYETTE_PROPERTY.buildingSqFt} format={(v) => `${Number(v).toLocaleString()} sq. ft.`} /> },
              { label: 'Current managing agent', value: <FactValue fact={LAFAYETTE_PROPERTY.currentManagingAgent} /> },
            ].map((cell) => (
              <div key={cell.label} className="p-5" style={{ backgroundColor: PAPER }}>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>{cell.label}</p>
                <p className="text-sm leading-snug" style={{ color: NAVY }}>{cell.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-1 text-xs" style={{ color: MUTED }}>
            <span><strong style={{ color: NAVY }}>Bleecker St (6 train)</strong> — 0.14 mi</span>
            <span><strong style={{ color: NAVY }}>8 St-NYU (R/W train)</strong> — 0.19 mi</span>
            <span className="italic">Per Camelot's own property-intelligence pull, 9/3/2026 — bus, e-bike, rideshare, and taxi points mapped at onboarding.</span>
          </div>
          <div className="mt-6 p-5 flex items-start gap-3" style={{ backgroundColor: PAPER, border: `1px solid ${DIVIDER}` }}>
            <Landmark size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: GOLD }} />
            <p className="text-sm leading-relaxed" style={{ color: NAVY }}>
              <strong>On Local Law 97: </strong><Highlighted text={LAFAYETTE_LL97_NOTE} />
            </p>
          </div>
          <p className="mt-4 text-xs italic" style={{ color: MUTED }}>
            {LAFAYETTE_CONTACT.context}
          </p>
        </section>

        {/* ============ INTERIOR GALLERY ============ */}
        <section id="gallery" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Inside <Subject>382 Lafayette Street</Subject></SectionLabel>
          <SectionTitle>The home itself, not a rendering.</SectionTitle>
          <Rule />
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {LAFAYETTE_INTERIOR_GALLERY.map((photo: GalleryPhoto) => (
              <figure key={photo.src} className="m-0">
                <img
                  src={photo.src}
                  alt={photo.caption}
                  className="w-full aspect-[4/3] object-cover"
                  style={{ backgroundColor: PAPER }}
                />
                <figcaption className="mt-2 text-xs leading-snug" style={{ color: MUTED }}>
                  {photo.caption}
                  <span className="block mt-0.5 italic">Photo: {photo.credit}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="text-xs leading-relaxed max-w-3xl italic" style={{ color: MUTED }}>
            {LAFAYETTE_GALLERY_NOTE}
          </p>
        </section>

        {/* ============ ABOUT CAMELOT ============ */}
        <section id="about" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Who we are</SectionLabel>
          <SectionTitle>Twenty years managing buildings in this city.</SectionTitle>
          <Rule />
          <p className="mb-6 text-lg leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            {CAMELOT_MISSION}
          </p>
          <p className="mb-10 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            Camelot Realty Group has been managing buildings in New York City for twenty years. We got
            our start in Lower Manhattan — servicing buildings in TriBeCa, SoHo, NoHo, and the West
            Village — and have grown from there into a platform that today manages{' '}
            <FactValue fact={CAMELOT_FACTS.buildings} /> buildings and more than <FactValue fact={CAMELOT_FACTS.aum} /> in assets,{' '}
            <FactValue fact={CAMELOT_FACTS.boutiqueCondos} /> of them boutique, full-amenity condominiums much like{' '}
            <Subject>382 Lafayette Street</Subject>. Our full managed portfolio is browsable on our website at{' '}
            <a href="https://www.camelot.nyc/managed-buildings/" target="_blank" rel="noreferrer" style={{ color: GOLD }}>camelot.nyc/managed-buildings</a>.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ backgroundColor: '#e5decc' }}>
            {[
              { label: 'Founded', value: <FactValue fact={CAMELOT_FACTS.founded} />, Icon: CalendarDays },
              { label: 'Buildings managed', value: <FactValue fact={CAMELOT_FACTS.buildings} />, Icon: Building2 },
              { label: 'Assets under management', value: <FactValue fact={CAMELOT_FACTS.aum} />, Icon: Landmark },
              { label: 'Boutique condominiums', value: <FactValue fact={CAMELOT_FACTS.boutiqueCondos} />, Icon: Home },
            ].map((cell) => (
              <div key={cell.label} className="p-5" style={{ backgroundColor: PAPER }}>
                <cell.Icon className="mb-3" size={20} strokeWidth={1.5} style={{ color: GOLD }} />
                <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>{cell.label}</p>
                <p className="text-sm leading-snug" style={{ color: NAVY }}>{cell.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid sm:grid-cols-2 gap-px" style={{ backgroundColor: '#e5decc' }}>
            {CAMELOT_AWARDS.map((award) => (
              <div key={award.title} className="p-5 flex gap-3" style={{ backgroundColor: PAPER }}>
                <Award size={20} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: GOLD }} />
                <div>
                  <p className="font-heading text-base leading-snug mb-0.5" style={{ color: NAVY }}>{award.title}</p>
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>{award.organization} &middot; {award.date}</p>
                  <p className="text-xs leading-relaxed" style={{ color: MUTED }}>Awarded to {award.recipient}. {award.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-5 flex gap-3" style={{ backgroundColor: PAPER, border: `1px solid ${DIVIDER}` }}>
            <HeartHandshake size={20} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: GOLD }} />
            <div>
              <p className="font-heading text-base leading-snug mb-0.5" style={{ color: NAVY }}>{CAMELOT_CHARITABLE_GIVING.title}</p>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>
                {CAMELOT_CHARITABLE_GIVING.role} &middot; {CAMELOT_CHARITABLE_GIVING.date} &middot; {CAMELOT_CHARITABLE_GIVING.location}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                In benefit of the {CAMELOT_CHARITABLE_GIVING.cause}. {CAMELOT_CHARITABLE_GIVING.detail}
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            Affiliations: {CAMELOT_FACTS.affiliations.join(', ')} — David is also a {CAMELOT_FACTS.reBnyCommittee.toLowerCase()}.
          </p>
          <p className="mt-4 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            More on David Goldoff's track record is available at{' '}
            <a href={CAMELOT_FACTS.presidentTrackRecordUrl} target="_blank" rel="noreferrer" style={{ color: GOLD }}>david-goldoff-camelot-president.netlify.app</a>,
            and our current thinking on the co-op and condo market is in Camelot's{' '}
            <a href={CAMELOT_FACTS.ownersGuideUrl} target="_blank" rel="noreferrer" style={{ color: GOLD }}>2026 NYC Property Owners Guide</a>.
          </p>
        </section>

        {/* ============ SERVICES ============ */}
        <section id="services" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>What we do</SectionLabel>
          <SectionTitle>Management, compliance, and the resident experience — in one accountable team.</SectionTitle>
          <Rule />
          <p className="mb-6 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            None of this is priced yet — that's a conversation for after the Board tells us what you actually
            need. This is simply the full range of what a Camelot-managed building has access to.
          </p>
          <div className="mb-10 p-5 max-w-3xl" style={{ backgroundColor: PAPER, border: `1px solid ${DIVIDER}` }}>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: GOLD }}>How we think about fees, before we've discussed a number</p>
            <p className="text-sm leading-relaxed" style={{ color: NAVY }}>{CAMELOT_FEE_PHILOSOPHY}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
            {CAMELOT_SERVICES.map((group) => {
              const Icon = SERVICE_ICONS[group.category] ?? Building2;
              return (
              <div key={group.category}>
                <div className="flex items-center gap-3 mb-3">
                  <Icon size={22} strokeWidth={1.5} style={{ color: GOLD }} />
                  <p className="font-heading text-xl" style={{ color: NAVY }}>{group.category}</p>
                </div>
                <ul className="space-y-2">
                  {group.items.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: NAVY }}>
                      <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full" style={{ backgroundColor: GOLD }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              );
            })}
          </div>
        </section>

        {/* ============ A FEW BLOCKS AWAY ============ */}
        <section id="nearby" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>A few blocks away</SectionLabel>
          <SectionTitle>We already work a few blocks from you.</SectionTitle>
          <Rule />
          <p className="mb-8 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            Downtown Manhattan's boutique loft condominiums — small owner counts, pre-war construction,
            full-floor or duplex units — are exactly the kind of building Camelot was built to manage well.
            These are the three closest addresses in Camelot's own portfolio, ranked by straight-line
            distance from <Subject>382 Lafayette Street</Subject>.
          </p>
          <div className="grid md:grid-cols-3 gap-px mb-14" style={{ backgroundColor: '#e5decc' }}>
            {LAFAYETTE_NEARBY_TRACK_RECORD.map((item, i) => (
              <div key={item.name} className="p-6 relative" style={{ backgroundColor: PAPER }}>
                <span
                  className="absolute top-4 right-4 font-heading text-3xl leading-none"
                  style={{ color: `${GOLD}33` }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="font-heading text-lg mb-1" style={{ color: NAVY }}>{item.name}</p>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: GOLD }}>
                  {item.neighborhood}{item.distance ? ` — ${item.distance}` : ''}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: NAVY }}>{item.note}</p>
              </div>
            ))}
          </div>
          <p className="font-heading text-xl mb-2" style={{ color: NAVY }}>The full local portfolio, plotted</p>
          <p className="mb-6 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            Beyond the three closest, the map below plots every Camelot-portfolio address (past and present)
            within the TriBeCa, SoHo, and NoLIta corridor immediately surrounding <Subject>382 Lafayette Street</Subject>,
            alongside both Camelot offices. Subject property, offices, and neighboring portfolio are
            color-coded — hover an address in the table to see exactly where it sits.
          </p>
          <NeighborhoodMapSection />
        </section>

        {/* ============ CASE STUDIES ============ */}
        <section id="case-studies" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Case studies</SectionLabel>
          <SectionTitle>Track record, in practice: a negative situation, made positive.</SectionTitle>
          <Rule />
          <p className="mb-6 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            A track record is only useful if it shows the turn — the arrears that came down, the violation
            that closed, the claim that got paid instead of absorbed. These are real outcomes, not composites.
          </p>
          <p className="mb-10 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            Across the portfolio, boards find an average of <strong style={{ color: NAVY }}>{CAMELOT_PROOF_STATS.avgSavingsFirstYear.value}</strong> in savings in
            their first year with Camelot — the case studies below are what that actually looks like, building by building.
          </p>
          <div className="space-y-10 mb-14">
            {LAFAYETTE_CASE_STUDIES.map((cs) => (
              <div key={cs.title} className="grid md:grid-cols-[1fr_2fr] gap-6 pb-10 border-b last:border-b-0" style={{ borderColor: DIVIDER }}>
                <div>
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: GOLD }}>{cs.building}</p>
                  <p className="font-heading text-2xl leading-tight mb-3" style={{ color: NAVY }}>{cs.stat}</p>
                  {cs.url && (
                    <a href={cs.url} target="_blank" rel="noreferrer" className="text-sm underline" style={{ color: GOLD }}>
                      Read on camelot.nyc &rarr;
                    </a>
                  )}
                </div>
                <div>
                  <p className="font-heading text-lg mb-2" style={{ color: NAVY }}>{cs.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: NAVY }}>{cs.summary}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="font-heading text-xl mb-4" style={{ color: NAVY }}>Elsewhere in the portfolio</p>
          <ul className="space-y-4">
            {CAMELOT_PORTFOLIO_HIGHLIGHTS.map((item, i) => (
              <li key={item.name} className="flex gap-4">
                <span className="font-heading text-2xl leading-none" style={{ color: GOLD }}>{String(i + 1).padStart(2, '0')}</span>
                <span className="text-base leading-relaxed pt-1" style={{ color: NAVY }}>
                  <strong>{item.name}</strong> ({item.neighborhood}) — {item.note}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ============ TESTIMONIALS ============ */}
        <section id="testimonials" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>In their own words</SectionLabel>
          <SectionTitle>What boards and owners actually say, not what we’d like them to.</SectionTitle>
          <Rule />
          <p className="mb-10 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            Pulled directly from{' '}
            <a href="https://www.camelot.nyc/testimonials/" target="_blank" rel="noreferrer" style={{ color: GOLD }}>camelot.nyc/testimonials</a>
            {' '}— including one from 137 Franklin Street, a few blocks from you, and one from 949 Park Avenue, referenced in the case studies above.
          </p>
          <div className="grid md:grid-cols-3 gap-px mb-8" style={{ backgroundColor: '#e5decc' }}>
            {CAMELOT_TESTIMONIALS.map((t) => (
              <div key={t.name} className="p-6 flex flex-col" style={{ backgroundColor: PAPER }}>
                <p className="font-heading text-3xl leading-none mb-3" style={{ color: `${GOLD}55` }}>&ldquo;</p>
                <p className="text-sm leading-relaxed mb-4 flex-1" style={{ color: NAVY }}>{t.quote}</p>
                <p className="font-heading text-base" style={{ color: NAVY }}>{t.name}</p>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-wider" style={{ color: GOLD }}>{t.title}</p>
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            <strong style={{ color: NAVY }}>{CAMELOT_TESTIMONIAL_STATS.clientRating} client rating</strong>, <strong style={{ color: NAVY }}>{CAMELOT_TESTIMONIAL_STATS.yearsInNyc} years</strong> in New York City, and{' '}
            <strong style={{ color: NAVY }}>{CAMELOT_PROOF_STATS.betterCommunicationPct.value} of boards</strong> report better communication after switching to Camelot.
          </p>
        </section>

        {/* ============ FIRST 90 DAYS ============ */}
        <section id="first-90-days" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>What happens after we take over</SectionLabel>
          <SectionTitle>Your first 90 days, mapped out.</SectionTitle>
          <Rule />
          <p className="mb-12 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            A transition should never feel like a black box. This is the same three-phase plan Camelot runs
            for every incoming building, adapted here for <Subject>382 Lafayette Street</Subject> — what happens, who owns it,
            and what the Board sees at the end of each phase.
          </p>
          <div className="space-y-12">
            {LAFAYETTE_90_DAY_PLAN.map((phase, i) => (
              <div key={phase.phase} className="grid md:grid-cols-[220px_1fr] gap-6 md:gap-10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl leading-none" role="img" aria-hidden="true">{phase.emoji}</span>
                    <span className="font-heading text-4xl leading-none" style={{ color: `${GOLD}33` }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>
                    {phase.phase} &middot; {phase.days}
                  </p>
                  <p className="font-heading text-2xl leading-tight" style={{ color: NAVY }}>{phase.headline}</p>
                </div>
                <div className="border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-8" style={{ borderColor: DIVIDER }}>
                  <p className="text-base leading-relaxed mb-6" style={{ color: NAVY }}>{phase.summary}</p>
                  <ul className="space-y-3 mb-6">
                    {phase.activities.map((a) => (
                      <li key={a.activity} className="flex gap-3 text-sm leading-relaxed">
                        <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
                        <span style={{ color: NAVY }}>
                          {a.activity}
                          <span className="block mt-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                            &rarr; {a.outcome}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-start gap-3 p-4" style={{ backgroundColor: PAPER, border: `1px solid ${DIVIDER}` }}>
                    <span className="text-lg leading-none shrink-0" role="img" aria-hidden="true">📋</span>
                    <p className="text-sm leading-relaxed" style={{ color: NAVY }}>
                      <strong>What the Board receives: </strong>{phase.deliverable}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-14 pt-10 border-t" style={{ borderColor: DIVIDER }}>
            <p className="text-base leading-relaxed max-w-2xl" style={{ color: NAVY }}>
              <Highlighted text={LAFAYETTE_90_DAY_COMMITMENT} />
            </p>
          </div>
        </section>

        {/* ============ TECHNOLOGY & STRATEGIC PARTNERSHIPS ============ */}
        <section id="technology" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Technology & strategic partnerships</SectionLabel>
          <SectionTitle>The stack running quietly behind every building we manage.</SectionTitle>
          <Rule />
          <p className="mb-10 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            These aren't logos for decoration — each is a platform Camelot actually runs day to day, with a
            specific job to do. Click through to see each provider directly.
          </p>
          <div className="mb-14">
            {LAFAYETTE_TECH_PARTNERS.map((tp) => (
              <div
                key={tp.name}
                className="grid md:grid-cols-[160px_1fr] gap-4 md:gap-10 py-8 border-b items-start"
                style={{ borderColor: '#e5decc' }}
              >
                <div className="h-9 flex items-center md:justify-start">
                  {tp.logo ? (
                    <img src={tp.logo} alt={`${tp.name} logo`} className="max-h-full max-w-[150px] object-contain object-left" />
                  ) : tp.logoIsWordmark ? (
                    <span className="font-heading text-xl tracking-wide" style={{ color: NAVY }}>
                      {tp.name === 'Camelot OS' ? (
                        <>CAMELOT <span style={{ color: GOLD }}>OS</span></>
                      ) : (
                        <span style={{ color: GOLD }}>{tp.name}</span>
                      )}
                    </span>
                  ) : null}
                </div>
                <div>
                  <p className="font-heading text-lg mb-0.5" style={{ color: NAVY }}>{tp.name}</p>
                  <p className="font-sans text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: GOLD }}>{tp.role}</p>
                  <p className="text-sm leading-relaxed max-w-2xl" style={{ color: NAVY }}>{tp.description}</p>
                  {tp.url && (
                    <a
                      href={tp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 font-sans text-xs font-semibold uppercase tracking-wider"
                      style={{ color: GOLD }}
                    >
                      Learn more &rarr;
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="font-heading text-xl mb-2" style={{ color: NAVY }}>What our monthly reporting actually looks like</p>
          <p className="text-sm leading-relaxed mb-4 max-w-3xl" style={{ color: MUTED }}>
            An illustrative sample of the monthly board reporting package MDS produces — cash flow, bank
            reconciliations, check register, and paid-invoice images — for a fictional coop (“999 Owner's
            Corp”), not <Subject>382 Lafayette</Subject>'s actual financials. Flip through it below, or download the full PDF.
          </p>
          <FlipBookViewer
            pageSrc={(n) => `${MDS_SAMPLE_BASE}/mds-sample-report/page-${String(n).padStart(2, '0')}.jpg`}
            pageCount={MDS_SAMPLE_PAGE_COUNT}
            title="MDS Sample Monthly Report Package"
            goldHex={GOLD}
            navyHex={NAVY}
          />
          <a
            href={`${MDS_SAMPLE_BASE}/documents/Camelot-MDS-Sample-Monthly-Report-Package.pdf`}
            download
            className="inline-flex items-center gap-2 px-6 py-3 mt-4 font-sans text-sm font-semibold uppercase tracking-wider"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            Download Sample Report (PDF)
          </a>
        </section>

        {/* ============ CAMELOT OS ============ */}
        <section id="camelot-os" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Powered by Camelot OS</SectionLabel>
          <SectionTitle>The tooling behind every number on this page.</SectionTitle>
          <Rule />
          <p className="mb-12 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            Everything above — the case studies, the 90-day plan, the map — comes out of the same internal
            system Camelot runs every building on. Here’s a look at it directly, live, not a mockup.
          </p>

          <div className="grid md:grid-cols-2 gap-x-10 gap-y-8 mb-14">
            {CAMELOT_OS_TOOLS.map((tool) => {
              const Icon = OS_TOOL_ICONS[tool.name] ?? Sparkles;
              return (
                <a
                  key={tool.name}
                  href={tool.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex gap-4 p-5"
                  style={{ backgroundColor: PAPER, border: `1px solid ${DIVIDER}` }}
                >
                  <Icon size={22} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: GOLD }} />
                  <div>
                    <p className="font-heading text-lg leading-snug" style={{ color: NAVY }}>{tool.name}</p>
                    <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: GOLD }}>{tool.tagline}</p>
                    <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{tool.description}</p>
                    <span className="inline-block mt-2 font-sans text-xs font-semibold uppercase tracking-wider underline" style={{ color: NAVY }}>
                      Open {tool.name} &rarr;
                    </span>
                  </div>
                </a>
              );
            })}
          </div>

          <div className="grid md:grid-cols-3 gap-px mb-14" style={{ backgroundColor: '#e5decc' }}>
            <div className="p-6" style={{ backgroundColor: PAPER }}>
              <p className="font-heading text-4xl mb-1" style={{ color: NAVY }}>{CAMELOT_OS_PORTFOLIO_MIX.totalBuildings}</p>
              <p className="text-sm" style={{ color: MUTED }}>buildings, {CAMELOT_OS_PORTFOLIO_MIX.totalUnits} units, synced live from Spire MDS as of {CAMELOT_OS_PORTFOLIO_MIX.lastSync}</p>
            </div>
            <div className="p-6" style={{ backgroundColor: PAPER }}>
              <p className="font-heading text-4xl mb-1" style={{ color: NAVY }}>{CAMELOT_OS_PORTFOLIO_MIX.condoCoopPct}%</p>
              <p className="text-sm" style={{ color: MUTED }}>condo/co-op ({CAMELOT_OS_PORTFOLIO_MIX.condoCoopBuildings} buildings) — the same category <Subject>382 Lafayette Street</Subject> falls into</p>
            </div>
            <div className="p-6" style={{ backgroundColor: PAPER }}>
              <p className="font-heading text-4xl mb-1" style={{ color: NAVY }}>{CAMELOT_OS_PORTFOLIO_MIX.rentalPct}%</p>
              <p className="text-sm" style={{ color: MUTED }}>rental ({CAMELOT_OS_PORTFOLIO_MIX.rentalBuildings} buildings). Condos and co-ops are tracked as one combined category in Portfolio today, not split further.</p>
            </div>
          </div>

          <p className="font-heading text-2xl mb-2" style={{ color: NAVY }}>A cost-savings guesstimate for <Subject>382 Lafayette</Subject>, before we've seen your numbers</p>
          <p className="mb-6 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            <Highlighted text={LAFAYETTE_COST_PREVIEW_NOTE} />
          </p>
          <div className="grid md:grid-cols-2 gap-px mb-14" style={{ backgroundColor: '#e5decc' }}>
            {LAFAYETTE_COST_PREVIEW.map((c) => (
              <div key={c.category} className="p-5" style={{ backgroundColor: PAPER }}>
                <p className="font-heading text-base mb-1" style={{ color: NAVY }}>{c.category}</p>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{c.note}</p>
              </div>
            ))}
          </div>

          <p className="font-heading text-2xl mb-2" style={{ color: NAVY }}>We already ran your address through the Violation &amp; Resolution Center</p>
          <p className="mb-6 text-sm leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            A live pull against HPD, DOB, and ECB records for <Subject>382 Lafayette Street</Subject> found 127 total violation
            records on file, with roughly a dozen still open — including two Class C (immediately hazardous) heat and hot-water
            violations dating to December 2022 that appear to still be outstanding. We're running one more manual HPD/DOB pull to
            confirm the exact live open-count before it goes in front of the Board, but the heat violations are worth flagging
            regardless of the final number. This is the same live tool, run on the same address, that any Board member could ask
            us to run again in front of them.
          </p>
          <a
            href="https://camelot-os.onrender.com/#/violations"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 mb-14 font-sans text-sm font-semibold uppercase tracking-wider border"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            Open the Violation &amp; Resolution Center &rarr;
          </a>

          <p className="font-heading text-2xl mb-2" style={{ color: NAVY }}>What Sentinel already knows about this block</p>
          <p className="mb-6 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            Sentinel tracks quarterly market position building by building. Two of the addresses already in this page's
            "a few blocks away" map are inside Sentinel today:
          </p>
          <div className="overflow-x-auto mb-14">
            <table className="w-full text-sm max-w-2xl">
              <thead>
                <tr className="border-b-2" style={{ borderColor: NAVY }}>
                  <th className="text-left py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>Building</th>
                  <th className="text-left py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>$/sq ft</th>
                  <th className="text-left py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>Market position</th>
                </tr>
              </thead>
              <tbody>
                {SENTINEL_NEARBY_STACKUP.map((row) => (
                  <tr key={row.building} className="border-b" style={{ borderColor: DIVIDER }}>
                    <td className="py-2 pr-4" style={{ color: NAVY }}>{row.building}</td>
                    <td className="py-2 pr-4" style={{ color: NAVY }}>{row.pricePerSqFt}</td>
                    <td className="py-2" style={{ color: MUTED }}>{row.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-6 flex items-start gap-4" style={{ backgroundColor: PAPER, border: `1px solid ${DIVIDER}` }}>
            <Cloud size={24} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: GOLD }} />
            <div>
              <p className="font-heading text-lg mb-1" style={{ color: NAVY }}>Always connected, from day one</p>
              <p className="text-sm leading-relaxed" style={{ color: NAVY }}>{CAMELOT_DRIVE_NOTE}</p>
            </div>
          </div>
        </section>

        {/* ============ AREAS OF COVERAGE ============ */}
        <section id="coverage" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Where we operate</SectionLabel>
          <SectionTitle>New York City first. Expanding deliberately, not everywhere at once.</SectionTitle>
          <Rule />
          <p className="mb-8 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            {CAMELOT_FACTS.footprint.value}. {CAMELOT_FACTS.southFloridaNote.value}
          </p>
          <BoroughCoverageMap goldHex={GOLD} navyHex={NAVY} />
        </section>

        {/* ============ TEAM ============ */}
        <section id="team" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Who you'd be working with</SectionLabel>
          <SectionTitle>Senior oversight on every account — not just the one you're pitched.</SectionTitle>
          <Rule />
          <p className="mb-3 text-sm italic max-w-3xl" style={{ color: MUTED }}>
            We haven't assigned a day-to-day property manager yet — that's a decision we make once we
            understand the building and the Board's priorities, not before. These are the senior people who
            oversee every Camelot account, including yours if we move forward.
          </p>
          <p className="mb-10 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            This is the senior leadership team, not the full company roster — Camelot also runs a wider
            bench of property managers, leasing agents, controllers, administrative staff, and office
            management who do the day-to-day work under this team's oversight. The people below are the
            ones accountable for how every account, including this one, actually performs.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {CAMELOT_LEADERSHIP.map((person) => (
              <div key={person.name}>
                {person.photo ? (
                  <img src={person.photo} alt={person.name} className="w-full aspect-square object-cover mb-3" style={{ backgroundColor: PAPER }} />
                ) : (
                  <div
                    className="w-full aspect-square flex items-center justify-center mb-3"
                    style={{ backgroundColor: PAPER, border: `1px solid ${DIVIDER}` }}
                    aria-hidden="true"
                  >
                    <span className="font-heading text-3xl" style={{ color: GOLD }}>
                      {person.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('')}
                    </span>
                  </div>
                )}
                <p className="font-heading text-base" style={{ color: NAVY }}>{person.name}</p>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: GOLD }}>{person.role}</p>
                <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{person.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section id="faq" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Common questions</SectionLabel>
          <SectionTitle>What boards actually ask us, answered plainly.</SectionTitle>
          <Rule />
          <p className="mb-10 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            Adapted from{' '}
            <a href="https://www.camelot.nyc/faq/" target="_blank" rel="noreferrer" style={{ color: GOLD }}>camelot.nyc/faq</a>
            {' '}for a condominium board specifically — the published version also covers rental buildings, which isn't relevant here.
          </p>
          <FaqAccordion items={LAFAYETTE_FAQ} />
        </section>

        {/* ============ NEXT STEP ============ */}
        <section id="next-step" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Next step</SectionLabel>
          <SectionTitle>Tell us where it hurts. We'll tell you what we'd do about it.</SectionTitle>
          <Rule />
          <p className="mb-6 text-lg leading-relaxed max-w-2xl" style={{ color: NAVY }}>
            {LAFAYETTE_NEXT_STEP}
          </p>
          <p className="mb-12 text-base leading-relaxed max-w-2xl" style={{ color: NAVY }}>
            <Highlighted text={LAFAYETTE_NEXT_STEP_FOLLOWUP} />
          </p>
          <div className="grid md:grid-cols-2 gap-px mb-12" style={{ backgroundColor: '#e5decc' }}>
            <div className="p-6" style={{ backgroundColor: PAPER }}>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: GOLD }}>What to bring to the first conversation</p>
              <ul className="space-y-4">
                {LAFAYETTE_WHAT_TO_BRING.map((item) => (
                  <li key={item.label}>
                    <p className="font-heading text-base mb-0.5" style={{ color: NAVY }}>{item.label}</p>
                    <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6" style={{ backgroundColor: PAPER }}>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: GOLD }}>What you'll get back</p>
              <ul className="space-y-4">
                {LAFAYETTE_WHAT_YOU_GET.map((item) => (
                  <li key={item.label}>
                    <p className="font-heading text-base mb-0.5" style={{ color: NAVY }}>{item.label}</p>
                    <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mb-10">
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 font-sans text-sm font-semibold uppercase tracking-wider"
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              Propose a time (Calendly)
            </a>
          </div>
          <p className="font-heading text-xl mb-1" style={{ color: NAVY }}>Or send David a message directly</p>
          <p className="mb-5 text-sm leading-relaxed max-w-md" style={{ color: MUTED }}>
            This sends straight to David's inbox — no mail app required on your end.
          </p>
          <ContactDavidForm />
          <a
            href="mailto:dgoldoff@camelot.nyc?subject=382%20Lafayette%20Street%20%E2%80%94%20a%20few%20times%20for%20the%20Board"
            className="inline-block mt-4 font-sans text-xs font-semibold uppercase tracking-wider underline"
            style={{ color: MUTED }}
          >
            Prefer your own email client? Click here instead.
          </a>
        </section>

        {/* ============ OPEN ITEMS ============ */}
        <section className="py-16">
          <SectionLabel>Still to confirm</SectionLabel>
          <p className="mb-6 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            In the interest of transparency, here is everything we still need to confirm before this moves
            past an introduction:
          </p>
          <ul className="space-y-2 mb-16">
            {LAFAYETTE_TO_BE_CONFIRMED.map((item, i) => (
              <li key={i} className="text-sm leading-relaxed flex gap-3" style={{ color: MUTED }}>
                <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full" style={{ backgroundColor: GOLD }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ============ FOOTER ============ */}
      <footer className="py-10 border-t" style={{ borderColor: DIVIDER, backgroundColor: NAVY }}>
        <div className="max-w-5xl mx-auto px-6 md:px-10 flex flex-col md:flex-row justify-between gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <p>Camelot Realty Group &middot; {CAMELOT_FACTS.officeAddress} &middot; {CAMELOT_FACTS.officePhone}</p>
          <p>{CAMELOT_FACTS.website} &middot; Prepared exclusively for <Subject onDark>382 Lafayette Street</Subject></p>
        </div>
      </footer>
    </div>
  );
}
