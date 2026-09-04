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

import { useEffect, type ReactNode } from 'react';
import {
  Building2,
  Calculator,
  Users,
  HeartHandshake,
  TrendingUp,
  CalendarDays,
  Landmark,
  Home,
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
  CAMELOT_LEADERSHIP,
  LAFAYETTE_TO_BE_CONFIRMED,
  LAFAYETTE_NEIGHBORING_PORTFOLIO,
  LAFAYETTE_FAR_PORTFOLIO_NOTE,
  LAFAYETTE_CASE_STUDIES,
  LAFAYETTE_TECH_PARTNERS,
  LAFAYETTE_TO_OFFICE_MILES,
  MDS_SAMPLE_PAGE_COUNT,
  MDS_SAMPLE_BASE,
  type Fact,
} from '@/lib/pitches/382-lafayette-street';
import RealNeighborhoodMap from '@/components/RealNeighborhoodMap';
import BoroughCoverageMap from '@/components/BoroughCoverageMap';
import FlipBookViewer from '@/components/FlipBookViewer';

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
    <h2 className="font-heading text-3xl md:text-4xl mb-6" style={{ color: NAVY }}>
      {children}
    </h2>
  );
}

function Rule() {
  return <div className="w-16 h-px mb-8" style={{ backgroundColor: GOLD }} />;
}

const SERVICE_ICONS: Record<string, typeof Building2> = {
  'Day-to-day management': Building2,
  'Financial & compliance': Calculator,
  'Governance & transition': Users,
  'Resident experience': HeartHandshake,
  'Beyond management': TrendingUp,
};

// Real coordinates for the map's subject property and Camelot's office,
// sourced via MapQuest address lookups (see 382-lafayette-street.ts).
const MAP_SUBJECT = { label: '382 Lafayette Street', neighborhood: 'NoHo', lat: 40.72768, lng: -73.99354 };
const MAP_OFFICE = { label: '57 West 57th Street', neighborhood: 'Midtown', lat: 40.76438, lng: -73.97654 };

function NeighborhoodMapSection() {
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
        portfolio={portfolioPoints}
        officeDistanceMiles={LAFAYETTE_TO_OFFICE_MILES}
        goldHex={GOLD}
        navyHex={NAVY}
      />
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
        {LAFAYETTE_NEIGHBORING_PORTFOLIO.map((p, i) => (
          <p key={p.address} className="text-xs leading-relaxed" style={{ color: MUTED }}>
            <span className="font-semibold" style={{ color: NAVY }}>{i + 1}.</span> {p.address} <span className="italic">— {p.neighborhood}, {p.crossStreets}</span>
          </p>
        ))}
      </div>
      <p className="mt-4 text-xs italic" style={{ color: MUTED }}>{LAFAYETTE_FAR_PORTFOLIO_NOTE}</p>
    </div>
  );
}

const NAV_SECTIONS: { id: string; label: string }[] = [
  { id: 'cover-letter', label: 'Introduction' },
  { id: 'about', label: 'About Camelot' },
  { id: 'services', label: 'Services' },
  { id: 'track-record', label: 'Track Record' },
  { id: 'case-studies', label: 'Case Studies' },
  { id: 'technology', label: 'Technology' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'team', label: 'Team' },
  { id: 'next-step', label: 'Next Step' },
];

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
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500;1,600&display=swap';
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
      `}</style>

      {/* ============ MASTHEAD ============ */}
      <div className="flex items-center justify-between gap-4 px-6 md:px-10 py-3 text-[11px] font-sans uppercase tracking-[0.15em] border-b" style={{ borderColor: DIVIDER, color: MUTED }}>
        <img src={LOGO_BLACK} alt="Camelot Realty Group" className="h-4 md:h-5 w-auto shrink-0" />
        <span className="text-right">Private Introduction &middot; 382 Lafayette Street &middot; NoHo</span>
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
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] mb-4" style={{ color: GOLD }}>
            Prepared for Samantha Gasmer and the Board at 382 Lafayette Street
          </p>
          <h1 className="font-heading text-4xl md:text-6xl text-white leading-tight mb-6 max-w-3xl">
            An introduction, before anything else.
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mb-2">
            Who Camelot is, how long we've been doing this, and where we've already done it — a short
            walk from {LAFAYETTE_PROPERTY.name}.
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
              <p key={i} className="mb-5 text-base leading-relaxed last:mb-0" style={{ color: NAVY }}>
                {p}
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
          <SectionTitle>{LAFAYETTE_PROPERTY.name}, {LAFAYETTE_PROPERTY.neighborhood}.</SectionTitle>
          <Rule />
          <div className="grid md:grid-cols-[1fr_260px] gap-8 mb-8">
            <p className="text-base leading-relaxed" style={{ color: NAVY }}>
              {LAFAYETTE_PROPERTY.character} Everything below comes from a property report David pulled
              directly — nothing here is a guess, and anything not yet confirmed is marked as such.
              The ground floor is home to Screaming Mimi's, the longtime NoHo vintage shop, and the
              building has an elevator modernization and a facade/roof restoration underway — an
              active, well-kept building, not one that's been left alone.
            </p>
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
          <p className="mt-4 text-xs italic" style={{ color: MUTED }}>
            {LAFAYETTE_CONTACT.context}
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
            <FactValue fact={CAMELOT_FACTS.boutiqueCondos} /> of them boutique, full-amenity condominiums much like
            382 Lafayette Street. Our full managed portfolio is browsable on our website at{' '}
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
          <p className="mb-10 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            None of this is priced yet — that's a conversation for after the Board tells us what you actually
            need. This is simply the full range of what a Camelot-managed building has access to.
          </p>
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

        {/* ============ TRACK RECORD ============ */}
        <section id="track-record" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Track record</SectionLabel>
          <SectionTitle>We already work a few blocks from you.</SectionTitle>
          <Rule />
          <p className="mb-8 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            Downtown Manhattan's boutique loft condominiums — small owner counts, pre-war construction,
            full-floor or duplex units — are exactly the kind of building Camelot was built to manage well.
          </p>
          <div className="grid md:grid-cols-3 gap-px mb-10" style={{ backgroundColor: '#e5decc' }}>
            {LAFAYETTE_NEARBY_TRACK_RECORD.map((item) => (
              <div key={item.name} className="p-6" style={{ backgroundColor: PAPER }}>
                <p className="font-heading text-lg mb-1" style={{ color: NAVY }}>{item.name}</p>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: GOLD }}>
                  {item.neighborhood}{item.distance ? ` — ${item.distance}` : ''}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: NAVY }}>{item.note}</p>
              </div>
            ))}
          </div>
          <p className="font-heading text-xl mb-4" style={{ color: NAVY }}>Elsewhere in the portfolio</p>
          <ul className="space-y-4 mb-14">
            {CAMELOT_PORTFOLIO_HIGHLIGHTS.map((item, i) => (
              <li key={item.name} className="flex gap-4">
                <span className="font-heading text-2xl leading-none" style={{ color: GOLD }}>{String(i + 1).padStart(2, '0')}</span>
                <span className="text-base leading-relaxed pt-1" style={{ color: NAVY }}>
                  <strong>{item.name}</strong> ({item.neighborhood}) — {item.note}
                </span>
              </li>
            ))}
          </ul>
          <p className="font-heading text-xl mb-2" style={{ color: NAVY }}>Past and present, in this exact neighborhood</p>
          <p className="mb-6 text-sm leading-relaxed max-w-3xl" style={{ color: MUTED }}>
            The addresses below are Camelot-portfolio buildings, past and present, within the TriBeCa,
            SoHo, and NoLIta corridor immediately surrounding 382 Lafayette Street — the same streets,
            often the very same block. Our office sits {LAFAYETTE_TO_OFFICE_MILES} miles north, a short
            trip when a Board wants to sit down in person.
          </p>
          <NeighborhoodMapSection />
        </section>

        {/* ============ CASE STUDIES ============ */}
        <section id="case-studies" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Case studies</SectionLabel>
          <SectionTitle>What happens after we take over.</SectionTitle>
          <Rule />
          <div className="space-y-10">
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
            Corp”), not 382 Lafayette's actual financials. Flip through it below, or download the full PDF.
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
          <p className="mb-10 text-sm italic max-w-3xl" style={{ color: MUTED }}>
            We haven't assigned a day-to-day property manager yet — that's a decision we make once we
            understand the building and the Board's priorities, not before. These are the senior people who
            oversee every Camelot account, including yours if we move forward.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {CAMELOT_LEADERSHIP.map((person) => (
              <div key={person.name}>
                <img src={person.photo} alt={person.name} className="w-full aspect-square object-cover mb-3" style={{ backgroundColor: PAPER }} />
                <p className="font-heading text-base" style={{ color: NAVY }}>{person.name}</p>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: GOLD }}>{person.role}</p>
                <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{person.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ NEXT STEP ============ */}
        <section id="next-step" className="py-20 border-b" style={{ borderColor: DIVIDER }}>
          <SectionLabel>Next step</SectionLabel>
          <SectionTitle>Let's find a time.</SectionTitle>
          <Rule />
          <p className="mb-8 text-lg leading-relaxed max-w-2xl" style={{ color: NAVY }}>
            {LAFAYETTE_NEXT_STEP}
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 font-sans text-sm font-semibold uppercase tracking-wider"
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              Propose a time (Calendly)
            </a>
            <a
              href="mailto:dgoldoff@camelot.nyc?subject=382%20Lafayette%20Street%20%E2%80%94%20a%20few%20times%20for%20the%20Board"
              className="inline-flex items-center gap-2 px-6 py-3 font-sans text-sm font-semibold uppercase tracking-wider border"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              Or email David directly
            </a>
          </div>
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
          <p>{CAMELOT_FACTS.website} &middot; Prepared exclusively for 382 Lafayette Street</p>
        </div>
      </footer>
    </div>
  );
}
