/**
 * Public-facing pitch microsite for Oak Park at Douglaston — Template #1
 * of the reusable Camelot pitch pattern (route: /pitch/oak-park-douglaston).
 *
 * Renders as a full-viewport overlay so it reads as a clean client-facing
 * page rather than the internal Camelot OS dashboard, while still living
 * inside the same app/deployment and reusing its existing Proposal and
 * Management Agreement generation engines against one shared data model
 * (src/lib/pitches/oak-park-douglaston.ts).
 *
 * This is a warm, in-progress-deal page for a specific Board — it is not
 * wired into the Scout prospecting/outreach pipeline.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { pdf } from '@react-pdf/renderer';
import toast from 'react-hot-toast';
import {
  OAK_PARK_PROPERTY,
  OAK_PARK_ENTITIES,
  OAK_PARK_MARKET_COMP,
  OAK_PARK_PAIN_POINTS,
  OAK_PARK_BOARD_CONTACTS,
  OAK_PARK_TEAM,
  OAK_PARK_TRANSITION_PLAN,
  OAK_PARK_TECH_STACK,
  OAK_PARK_TECH_NOTES,
  OAK_PARK_ANCILLARY_FEES,
  OAK_PARK_PRICING,
  OAK_PARK_TO_BE_CONFIRMED,
  OAK_PARK_COMPLIANCE_SNAPSHOT,
  OAK_PARK_COVER_LETTER_PARAGRAPHS,
  OAK_PARK_SOFTWARE_PROVIDERS,
  OAK_PARK_SELECT_PARTNERSHIP,
  OAK_PARK_EQUIPMENT_REQUESTS,
  OAK_PARK_REVENUE_PLAN,
  OAK_PARK_DOMECILE_REVENUE,
  OAK_PARK_TRANSITION_CHECKLIST,
  OAK_PARK_REFERENCES_NOTE,
  OAK_PARK_ROSTER_URL,
  OAK_PARK_MARKETING_NOTE,
  OAK_PARK_COORDS,
  OAK_PARK_QUEENS_PORTFOLIO,
  OAK_PARK_QUEENS_PORTFOLIO_NOTE,
  OAK_PARK_ANNUAL_CALENDAR,
  OAK_PARK_ANNUAL_CALENDAR_INTRO,
  CAMELOT_COMPANY_FACTS,
  oakParkAsBuilding,
  oakParkAgreementInputFor,
  type PitchEntity,
  type Fact,
} from '@/lib/pitches/oak-park-douglaston';
import { generateAgreement } from '@/lib/excalibur';
import { downloadAsPDF } from '@/lib/pdf-generator';
import { generateAgreementDocxBlob, downloadBlob } from '@/lib/agreement-docx-export';
import { generateProposalData } from '@/lib/proposal-generator';
import { generateTransitionPlanHtml } from '@/lib/transition-plan-generator';
import ProposalPDF from '@/components/ProposalPDF';
import QueensPresenceMap from '@/components/QueensPresenceMap';
import FlipBookViewer from '@/components/FlipBookViewer';
import { formatCurrency } from '@/lib/utils';

const PHOTO_BASE = '/pitch/oak-park-douglaston';
const PHOTOS = {
  aerial: `${PHOTO_BASE}/aerial-shot.jpg`,
  entrance: `${PHOTO_BASE}/entrance-sign.jpg`,
  pool: `${PHOTO_BASE}/pool-poolhouse.jpg`,
  gym: `${PHOTO_BASE}/fitness-center.jpg`,
  court: `${PHOTO_BASE}/basketball-court.jpg`,
  street: `${PHOTO_BASE}/rear-balconies-street.jpg`,
};
const MDS_SAMPLE_PAGE_COUNT = 20;
const mdsSamplePageSrc = (n: number) => `${PHOTO_BASE}/mds-sample-report/page-${String(n).padStart(2, '0')}.jpg`;
const MDS_SAMPLE_PDF_URL = `${PHOTO_BASE}/documents/Camelot-MDS-Sample-Monthly-Report-Package.pdf`;
const BRAND_BASE = `${PHOTO_BASE}/brand`;
const LOGO_BLACK = `${BRAND_BASE}/camelot-logo-black.png`;
const LOGO_CREAM = `${BRAND_BASE}/camelot-logo-cream.png`;
const STOCK_BASE = `${PHOTO_BASE}/stock`;
const STOCK = {
  boardMeeting: `${STOCK_BASE}/board-meeting.jpg`,
  rooftopLandscape: `${STOCK_BASE}/rooftop-landscape.jpg`,
  pmSiteVisit: `${STOCK_BASE}/pm-site-visit.jpg`,
  frontEntranceDoorman: `${STOCK_BASE}/front-entrance-doorman.jpg`,
  packageRoom: `${STOCK_BASE}/package-room.jpg`,
  doormanServices: `${STOCK_BASE}/doorman-services.jpg`,
  valetDriveway: `${STOCK_BASE}/valet-driveway.jpg`,
};

// Palette matches the Camelot — A Journal of Considered Ownership brochure
// (camelot-whiteglove) design system: cream paper, ink text, brass/gold
// accent. Names kept for minimal diff even though "NAVY" is now ink-black.
const GOLD = '#9c7c46';
const NAVY = '#16140f';
const IVORY = '#f6f3ec';
const CHARCOAL = '#16140f';
const MUTED = '#6e6858';
const FAINT = '#a39c88';
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
    <p
      className="font-sans text-xs font-semibold uppercase tracking-[0.2em] mb-3"
      style={{ color: GOLD }}
    >
      {children}
    </p>
  );
}

/**
 * Faint monogram watermark for overlaying Camelot's mark on top of
 * photographic or data-heavy sections without competing with content.
 */
function BrandWatermark({ side = 'right', tone = 'dark' }: { side?: 'left' | 'right'; tone?: 'dark' | 'light' }) {
  return (
    <img
      src={tone === 'light' ? LOGO_CREAM : LOGO_BLACK}
      alt=""
      aria-hidden="true"
      className={`pointer-events-none select-none absolute top-1/2 -translate-y-1/2 ${side === 'right' ? '-right-16' : '-left-16'} w-[360px] opacity-[0.04] hidden lg:block`}
    />
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

// ============================================================
// Page
// ============================================================

export default function PitchOakParkDouglaston() {
  const [downloading, setDownloading] = useState<string | null>(null);

  // Load the same Cormorant Garamond (display) + General Sans (body) fonts
  // used by the Camelot — A Journal of Considered Ownership brochure, scoped
  // to this page only (does not touch the app-wide Tailwind font config).
  useEffect(() => {
    const existing = document.getElementById('oak-park-editorial-fonts');
    if (existing) return;
    const link = document.createElement('link');
    link.id = 'oak-park-editorial-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500;1,600&display=swap';
    document.head.appendChild(link);
    const link2 = document.createElement('link');
    link2.rel = 'stylesheet';
    link2.href = 'https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap';
    document.head.appendChild(link2);
  }, []);

  const handleDownloadProposal = useCallback(async () => {
    setDownloading('proposal');
    try {
      const building = oakParkAsBuilding();
      const data = generateProposalData(building, {
        contactName: 'Oak Park Board',
        customPricingPerUnit: OAK_PARK_PRICING.recommendedPerUnit,
        generatedBy: 'Camelot OS Pitch Microsite',
        coverLetterParagraphs: OAK_PARK_COVER_LETTER_PARAGRAPHS,
      });
      const blob = await pdf(<ProposalPDF data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Oak-Park-at-Douglaston__Camelot-Management-Proposal__${data.proposalNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Proposal PDF downloaded');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not generate the proposal PDF');
    } finally {
      setDownloading(null);
    }
  }, []);

  const handleDownloadTransitionPlan = useCallback(async () => {
    setDownloading('transition-plan');
    try {
      const html = generateTransitionPlanHtml({
        clientName: 'Oak Park at Douglaston',
        propertyAddress: OAK_PARK_PROPERTY.fullAddress,
        entities: OAK_PARK_ENTITIES.map((e) => e.legalName),
        phases: OAK_PARK_TRANSITION_PLAN,
        checklistCategories: OAK_PARK_TRANSITION_CHECKLIST,
      });
      const result = await downloadAsPDF(html, 'Oak-Park-at-Douglaston__Camelot-Transition-Plan.pdf');
      toast.success(
        result.method === 'download'
          ? 'Transition Plan downloaded'
          : 'Opened the Transition Plan for printing — use Ctrl/Cmd+P and choose “Save as PDF.”'
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not generate the Transition Plan');
    } finally {
      setDownloading(null);
    }
  }, []);

  const handleDownloadAgreement = useCallback(async (entityKey: PitchEntity['key'], format: 'pdf' | 'docx') => {
    setDownloading(`${entityKey}-${format}`);
    try {
      const input = oakParkAgreementInputFor(entityKey);
      const html = generateAgreement(input);
      const entity = OAK_PARK_ENTITIES.find((e) => e.key === entityKey)!;
      const filenameBase = `Oak-Park-at-Douglaston__${entity.shortLabel.replace(/[^a-zA-Z0-9]+/g, '-')}__Camelot-Condominium-Management-Agreement`;
      if (format === 'pdf') {
        const result = await downloadAsPDF(html, `${filenameBase}.pdf`);
        toast.success(
          result.method === 'download'
            ? `${entity.shortLabel} agreement (PDF) downloaded`
            : `Opened the ${entity.shortLabel} agreement for printing — use Ctrl/Cmd+P and choose “Save as PDF.”`
        );
      } else {
        const blob = await generateAgreementDocxBlob(html);
        await downloadBlob(blob, `${filenameBase}.docx`);
        toast.success(`${entity.shortLabel} agreement (DOCX) downloaded`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && format === 'pdf' ? err.message : 'Could not generate the management agreement');
    } finally {
      setDownloading(null);
    }
  }, []);

  return (
    <div
      id="oak-park-editorial"
      className="fixed inset-0 z-[60] overflow-y-auto font-sans"
      style={{ backgroundColor: IVORY, color: CHARCOAL }}
    >
      <style>{`
        #oak-park-editorial .font-heading {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 500;
        }
        #oak-park-editorial .font-sans {
          font-family: 'General Sans', Inter, 'Helvetica Neue', sans-serif;
        }
        #oak-park-editorial {
          font-family: 'General Sans', Inter, 'Helvetica Neue', sans-serif;
        }
      `}</style>

      {/* ============ MASTHEAD ============ */}
      <div className="flex items-center justify-between gap-4 px-6 md:px-10 py-3 text-[11px] font-sans uppercase tracking-[0.15em] border-b" style={{ borderColor: DIVIDER, color: MUTED }}>
        <img src={LOGO_BLACK} alt="Camelot Realty Group" className="h-4 md:h-5 w-auto shrink-0" />
        <span className="text-right">Private Board Edition &middot; Oak Park at Douglaston &middot; Queens</span>
      </div>

      {/* ============ HERO ============ */}
      <section className="relative min-h-[92vh] flex flex-col">
        <img
          src={PHOTOS.aerial}
          alt="Aerial view of Oak Park at Douglaston"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(22,20,15,0.35) 0%, rgba(22,20,15,0.18) 30%, rgba(22,20,15,0.90) 100%)' }}
        />
        <div className="relative z-10 px-6 md:px-10 pt-10">
          <img src={LOGO_CREAM} alt="Camelot Realty Group" className="h-8 md:h-10 w-auto" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-10 pb-16 md:pb-24 mt-auto w-full">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] mb-4" style={{ color: GOLD }}>
            Prepared exclusively for the Oak Park Boards
          </p>
          <h1 className="font-heading text-4xl md:text-6xl text-white leading-tight mb-6 max-w-3xl">
            Weekly eyes. Three clean books. One accountable team.
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mb-8">
            A management proposal for {OAK_PARK_PROPERTY.name}, {OAK_PARK_PROPERTY.fullAddress}.
          </p>
          <a
            href="#proposal"
            className="inline-flex items-center gap-2 px-6 py-3 font-sans text-sm font-semibold uppercase tracking-wider"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            Review the Proposal
          </a>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 md:px-10">

        {/* ============ COVER LETTER ============ */}
        <section className="relative py-20 md:py-28 border-b overflow-hidden" style={{ borderColor: DIVIDER }}>
          <img
            src={LOGO_BLACK}
            alt=""
            aria-hidden="true"
            className="pointer-events-none select-none absolute -right-16 -bottom-16 w-[420px] opacity-[0.04] hidden md:block"
          />
          <div className="relative z-10 max-w-2xl">
            <SectionLabel>To the Oak Park Boards</SectionLabel>
            <SectionTitle>Thank you for today.</SectionTitle>
            <Rule />
            {OAK_PARK_COVER_LETTER_PARAGRAPHS.map((p, i) => (
              <p key={i} className="mb-5 text-base leading-relaxed last:mb-0" style={{ color: NAVY }}>
                {p}
              </p>
            ))}
            <p className="mt-10 font-heading text-lg" style={{ color: NAVY }}>David A. Goldoff</p>
            <p className="font-sans text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>President, Camelot Realty Group</p>
          </div>
        </section>

        {/* ============ PROPERTY SUMMARY ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Property summary</SectionLabel>
          <SectionTitle>What we're proposing to manage.</SectionTitle>
          <Rule />
          <p className="mb-6 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            The summary below anchors this proposal to the property we walked today, and keeps factual assumptions
            separate from the cover letter above. Anything not yet independently confirmed is marked as such —
            see Open Items, further down — rather than assumed.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ backgroundColor: '#e5decc' }}>
            {[
              { label: 'Property', value: OAK_PARK_PROPERTY.fullAddress },
              { label: 'Block / Lot', value: OAK_PARK_PROPERTY.blockLot },
              { label: 'Asset type', value: 'Gated townhouse-style condominium community' },
              { label: 'Governing entities', value: 'Condominium I, Condominium II, and a Unit Owners Association' },
              { label: 'Total units', value: <FactValue fact={OAK_PARK_PROPERTY.totalUnits} /> },
              { label: 'Buildings', value: <FactValue fact={OAK_PARK_PROPERTY.buildingCount} /> },
              { label: 'Year built', value: <FactValue fact={OAK_PARK_PROPERTY.yearBuilt} /> },
              { label: 'Zoning', value: <FactValue fact={OAK_PARK_PROPERTY.zoning} /> },
            ].map((cell) => (
              <div key={cell.label} className="p-5" style={{ backgroundColor: PAPER }}>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>{cell.label}</p>
                <p className="text-sm leading-snug" style={{ color: NAVY }}>{cell.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ WHAT WE HEARD ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>What we heard</SectionLabel>
          <SectionTitle>Before we proposed anything, we listened.</SectionTitle>
          <Rule />
          <div className="md:float-right md:ml-8 md:w-72 mb-6">
            <img src={STOCK.boardMeeting} alt="Board meeting" className="w-full h-48 object-cover" />
            <p className="text-xs italic mt-2" style={{ color: '#a39c88' }}>Representative image — not the actual Oak Park Board</p>
          </div>
          <p className="mb-8 text-lg leading-relaxed" style={{ color: NAVY }}>
            Board members Judy, Tony, and Juil described specific, recurring gaps in day-to-day management —
            not vague dissatisfaction, but concrete things a well-run community needs and isn't consistently getting.
          </p>
          <ul className="space-y-4">
            {OAK_PARK_PAIN_POINTS.map((point, i) => (
              <li key={i} className="flex gap-4">
                <span className="font-heading text-2xl leading-none" style={{ color: GOLD }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-base leading-relaxed pt-1">{point}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm italic" style={{ color: '#6e6858' }}>
            {OAK_PARK_BOARD_CONTACTS.openItem}
          </p>
        </section>

        {/* ============ THE CAMELOT SOLUTION ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Our commitment</SectionLabel>
          <SectionTitle>A direct answer to each gap above.</SectionTitle>
          <Rule />
          <p className="mb-10 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            Camelot's approach is a boutique, hands-on management model — senior accountability, practical
            communication, and financial discipline, fitted to the actual building rather than a generic
            package. Applied to Oak Park specifically, based on what the Board described and what we saw on
            today's walkthrough, that looks like the six commitments below.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { t: 'Weekly on-site management', d: 'A dedicated property manager on site at least weekly, with a written report after every visit — not an occasional drive-by.' },
              { t: 'Three clean sets of books', d: 'Condominium I, Condominium II, and the UOA each get their own accurate monthly close, reconciled and reported on a fixed schedule.' },
              { t: 'Active arrears management', d: 'An aging report, documented follow-up, and escalation to counsel under Board policy — arrears get worked, not just tracked.' },
              { t: 'A facilities professional, not just a super', d: 'Tim Kelly reviews mechanical systems monthly for the first 60 days, then quarterly, training staff and building real SOPs.' },
              { t: 'Real cost benchmarking', d: 'Vendor contracts get compared against Camelot\u2019s portfolio pricing, with rebids pursued where the savings case is real.' },
              { t: 'A transition that captures everything', d: 'Full ledger, owner data, contracts, notices, and institutional knowledge — captured deliberately, not lost in a handoff.' },
            ].map((item) => (
              <div key={item.t} className="border-l-2 pl-5" style={{ borderColor: GOLD }}>
                <h3 className="font-heading text-xl mb-2" style={{ color: NAVY }}>{item.t}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6e6858' }}>{item.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ TEAM ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Your dedicated team</SectionLabel>
          <SectionTitle>The people who will actually be here.</SectionTitle>
          <Rule />
          <p className="mb-10 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            Camelot assigns a named team so the Board knows exactly who is accountable for management,
            accounting, compliance, and facilities at Oak Park — real people behind the email address, not
            a rotating account number.
          </p>

          {/* Photo cards for the named principals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {OAK_PARK_TEAM.filter((m) => m.photo).map((member) => (
              <div key={member.role} className="text-center">
                <img
                  src={member.photo}
                  alt={member.person.value}
                  className="w-full aspect-square object-cover rounded-full mb-3 border"
                  style={{ borderColor: '#e5decc' }}
                />
                <p className="font-heading text-base" style={{ color: NAVY }}>{member.person.value}</p>
                <p className="font-sans text-[11px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: GOLD }}>{member.role}</p>
                {member.bio && (
                  <p className="text-xs leading-relaxed mt-2" style={{ color: '#6e6858' }}>{member.bio}</p>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-6">
            {OAK_PARK_TEAM.map((member) => (
              <div key={member.role} className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-6 py-4 border-b" style={{ borderColor: '#e5decc' }}>
                <div className="md:w-56 shrink-0">
                  <p className="font-sans text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>{member.role}</p>
                  <p className="font-heading text-lg" style={{ color: NAVY }}>
                    <FactValue fact={member.person} />
                  </p>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#6e6858' }}>{member.commitment}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-10 items-center">
            <img src={STOCK.pmSiteVisit} alt="Property manager site visit" className="w-full h-40 object-cover md:col-span-1" />
            <p className="text-sm leading-relaxed md:col-span-2" style={{ color: '#6e6858' }}>
              Weekly site visits mean someone is actually looking at the mechanical rooms, not just the common areas —
              the same standard Tim Kelly holds across the portfolio.
              <span className="block text-xs italic mt-1" style={{ color: '#a39c88' }}>Representative image — not an actual Oak Park site visit</span>
            </p>
          </div>

          <div className="mt-10 pt-6 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-3" style={{ borderColor: '#e5decc' }}>
            <p className="text-sm leading-relaxed" style={{ color: '#6e6858' }}>{OAK_PARK_MARKETING_NOTE}</p>
            <a
              href={OAK_PARK_ROSTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
              style={{ color: GOLD }}
            >
              View full company roster →
            </a>
          </div>
        </section>

        {/* ============ WEEKLY ON-SITE MANAGEMENT (with amenity photos) ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Weekly on-site management</SectionLabel>
          <SectionTitle>The community, as it actually is today.</SectionTitle>
          <Rule />
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <img src={PHOTOS.entrance} alt="Oak Park at Douglaston entrance sign" className="w-full h-56 object-cover" />
            <img src={PHOTOS.pool} alt="Community pool and pool house" className="w-full h-56 object-cover" />
            <img src={PHOTOS.court} alt="Community sport court" className="w-full h-56 object-cover" />
          </div>
          <p className="text-base leading-relaxed mb-8" style={{ color: NAVY }}>
            {OAK_PARK_PROPERTY.buildingCount.value} buildings across a {OAK_PARK_PROPERTY.lotSqFt.value.toLocaleString()} sq ft gated lot,
            with a pool and pool house, tennis court, a fenced multi-sport court, a shared fitness center, and a spa/hot tub —
            amenities worth actively maintaining, not just listing on a fact sheet.
          </p>
          <div className="grid md:grid-cols-3 gap-4 items-center border-t pt-8" style={{ borderColor: '#e5decc' }}>
            <img src={STOCK.rooftopLandscape} alt="Grounds and landscape maintenance" className="w-full h-40 object-cover" />
            <div className="md:col-span-2">
              <p className="text-sm leading-relaxed" style={{ color: '#6e6858' }}>
                Grounds and landscape care get the same active-maintenance standard we apply everywhere —
                seasonal upkeep, not a call to the super only after a complaint.
              </p>
              <p className="text-xs italic mt-2" style={{ color: '#a39c88' }}>Representative image — not the actual Oak Park grounds crew</p>
            </div>
          </div>
        </section>

        {/* ============ FINANCIAL REPORTING ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Financial reporting</SectionLabel>
          <SectionTitle>One accountable lead, three clean closes.</SectionTitle>
          <Rule />
          <p className="mb-6 text-base leading-relaxed" style={{ color: NAVY }}>
            Each entity — Condominium I, Condominium II, and the UOA — receives its own accrual-basis monthly package:
            executive summary, balance sheet, income/expense vs. budget, general ledger, bank and reserve reconciliations,
            cash receipts, disbursement register, A/R aging with a collection log, reserve activity, and a management
            narrative with an action list. Contractual delivery by the 20th calendar day after month-end; internal target
            the 15th.
          </p>
          <p className="text-xs italic" style={{ color: '#6e6858' }}>
            Sample dashboard figures shown to Boards during onboarding are illustrative only and are never Oak Park's
            actual financial data unless explicitly labeled as such.
          </p>
        </section>

        {/* ============ ACCOUNTING, TECHNOLOGY & SOFTWARE PROVIDERS ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Accounting, technology &amp; software providers</SectionLabel>
          <SectionTitle>The systems behind the management.</SectionTitle>
          <Rule />
          <div className="grid md:grid-cols-2 gap-5 mb-10">
            {OAK_PARK_SOFTWARE_PROVIDERS.map((p) => (
              <div key={p.name} className="p-5 border" style={{ borderColor: '#d9d2c2' }}>
                <div className="h-9 flex items-center mb-3">
                  {p.logo ? (
                    <img src={p.logo} alt={`${p.name} logo`} className="max-h-full max-w-[150px] object-contain" />
                  ) : p.logoIsWordmark ? (
                    <span className="font-heading text-xl tracking-wide" style={{ color: NAVY }}>
                      CAMELOT <span style={{ color: GOLD }}>OS</span>
                    </span>
                  ) : null}
                </div>
                <p className="font-heading text-lg mb-0.5" style={{ color: NAVY }}>{p.name}</p>
                <p className="font-sans text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: GOLD }}>{p.role}</p>
                <p className="text-sm leading-relaxed" style={{ color: '#6e6858' }}>{p.description}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-10 items-center">
            <img src={STOCK.packageRoom} alt="Package handling" className="w-full h-56 object-cover" />
            <div>
              <div className="h-7 flex items-center mb-3">
                <span className="font-heading text-2xl italic tracking-wide lowercase" style={{ color: GOLD }}>select</span>
              </div>
              <p className="font-heading text-lg mb-2" style={{ color: NAVY }}>
                A month of {OAK_PARK_SELECT_PARTNERSHIP.partnerName}, on us.
              </p>
              <p className="text-sm leading-relaxed mb-2" style={{ color: '#6e6858' }}>{OAK_PARK_SELECT_PARTNERSHIP.whatTheyDo}</p>
              <p className="text-sm leading-relaxed mb-2" style={{ color: '#6e6858' }}>{OAK_PARK_SELECT_PARTNERSHIP.offer}</p>
              <p className="text-xs italic" style={{ color: '#6e6858' }}>{OAK_PARK_SELECT_PARTNERSHIP.disclosure}</p>
              <a href={OAK_PARK_SELECT_PARTNERSHIP.partnerUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
                {OAK_PARK_SELECT_PARTNERSHIP.partnerUrl.replace('https://www.', '')} →
              </a>
            </div>
          </div>

          <div className="border-t pt-8" style={{ borderColor: '#e5decc' }}>
            <p className="font-heading text-lg mb-4" style={{ color: NAVY }}>Front-desk equipment &amp; training we’d ask the Board to approve</p>
            <div className="grid md:grid-cols-2 gap-3">
              {OAK_PARK_EQUIPMENT_REQUESTS.map((eq) => (
                <div key={eq.item} className="flex gap-3 py-2 border-b" style={{ borderColor: '#e5decc' }}>
                  <span style={{ color: GOLD }}>—</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: NAVY }}>{eq.item}</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#6e6858' }}>{eq.purpose}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {OAK_PARK_TECH_NOTES.map((n, i) => (
            <p key={i} className="text-sm italic mt-6" style={{ color: '#6e6858' }}>{n}</p>
          ))}
        </section>

        {/* ============ RESIDENT EXPERIENCE ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Resident experience</SectionLabel>
          <SectionTitle>Life inside the community.</SectionTitle>
          <Rule />
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <img src={PHOTOS.gym} alt="Community fitness center" className="w-full h-64 object-cover" />
            <img src={PHOTOS.street} alt="View of Oak Park townhomes" className="w-full h-64 object-cover" />
          </div>
          <p className="text-base leading-relaxed" style={{ color: NAVY }}>
            Concierge Plus gives residents a modern portal for communication, package tracking, and announcements —
            standard within the base management fee, no separate license cost to the community.
          </p>
        </section>

        {/* ============ COST OPTIMIZATION ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Cost optimization</SectionLabel>
          <SectionTitle>Benchmarked, not guessed.</SectionTitle>
          <Rule />
          <p className="mb-4 text-base leading-relaxed" style={{ color: NAVY }}>
            Within the first 90 days, Camelot runs Oak Park's operating expenses through the same cost-cutting
            system we use internally and across other clients: every contract is compared line-by-line against
            what Camelot's {CAMELOT_COMPANY_FACTS.buildings}-building portfolio actually pays for the same
            service, then renegotiated — with Oak Park's existing vendors and, where it makes sense, with vendors
            already under contract with Camelot elsewhere. We show the Board the comparison before recommending
            any change; we don't manufacture savings to justify a fee.
          </p>
          <p className="mb-4 text-base leading-relaxed" style={{ color: NAVY }}>
            The intent is straightforward: the value Camelot adds should be visible in the numbers, not just
            promised. Done well, the savings this process finds are designed to offset the cost of bringing
            Camelot on — so the management fee is not a new expense the community absorbs on top of everything
            else, but one that pays for itself out of what we find.
          </p>
          <p className="text-sm leading-relaxed p-4 border" style={{ borderColor: GOLD, color: '#6e6858' }}>
            An optional shared-savings program is available at 30% of verified first-year realized net hard-dollar
            savings — but only under a separate written agreement with a documented baseline and measurement period.
            It is never assumed or bundled into the base proposal below.
          </p>
        </section>

        {/* ============ REVENUE GROWTH ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Revenue growth</SectionLabel>
          <SectionTitle>A revenue plan, not just a cost plan.</SectionTitle>
          <Rule />
          <p className="mb-10 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            Cutting expenses is only half of the financial picture. Camelot works this in three phases —
            transition, then expense review, then new income — so the community's finances get stronger from
            both directions at once.
          </p>
          <div className="grid md:grid-cols-3 gap-6 mb-14">
            {OAK_PARK_REVENUE_PLAN.map((phase) => (
              <div key={phase.phase} className="border-l-2 pl-5" style={{ borderColor: GOLD }}>
                <p className="font-sans text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>
                  {phase.phase} &middot; {phase.dayRange}
                </p>
                <h3 className="font-heading text-xl mb-2" style={{ color: NAVY }}>{phase.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6e6858' }}>{phase.description}</p>
              </div>
            ))}
          </div>

          <div className="border-t pt-10" style={{ borderColor: '#e5decc' }}>
            <p className="font-heading text-lg mb-3" style={{ color: NAVY }}>Phase 3, in detail: what Domecile can add to the community's income</p>
            <p className="mb-6 text-sm leading-relaxed max-w-3xl" style={{ color: '#6e6858' }}>{OAK_PARK_DOMECILE_REVENUE.intro}</p>
            <div className="grid md:grid-cols-2 gap-5">
              {OAK_PARK_DOMECILE_REVENUE.streams.map((s) => (
                <div key={s.title} className="flex gap-3">
                  <span className="font-heading text-2xl leading-none" style={{ color: GOLD }}>&middot;</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: NAVY }}>{s.title}</p>
                    <p className="text-sm leading-relaxed mt-1" style={{ color: '#6e6858' }}>{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs" style={{ color: '#a39c88' }}>{OAK_PARK_DOMECILE_REVENUE.source}</p>
          </div>
        </section>

        {/* ============ QUEENS PORTFOLIO PRESENCE ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Our presence in Queens</SectionLabel>
          <SectionTitle>We already operate in this borough.</SectionTitle>
          <Rule />
          <p className="mb-6 text-base leading-relaxed" style={{ color: NAVY }}>
            {OAK_PARK_QUEENS_PORTFOLIO_NOTE}
          </p>
          <QueensPresenceMap
            center={OAK_PARK_COORDS}
            centerLabel="Oak Park at Douglaston"
            buildings={OAK_PARK_QUEENS_PORTFOLIO}
            goldHex={GOLD}
            navyHex={NAVY}
          />
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2" style={{ borderColor: NAVY }}>
                  <th className="text-left py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>Managed entity</th>
                  <th className="text-left py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>Address</th>
                  <th className="text-right py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>Units</th>
                  <th className="text-right py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>Distance</th>
                </tr>
              </thead>
              <tbody>
                {OAK_PARK_QUEENS_PORTFOLIO.map((b) => (
                  <tr key={b.entity + b.address} className="border-b" style={{ borderColor: '#e5decc' }}>
                    <td className="py-2 pr-4">{b.entity}</td>
                    <td className="py-2 pr-4" style={{ color: '#6e6858' }}>{b.address}</td>
                    <td className="py-2 text-right" style={{ color: '#6e6858' }}>{b.units}</td>
                    <td className="py-2 text-right whitespace-nowrap" style={{ color: '#6e6858' }}>{b.distanceMiles} mi</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs" style={{ color: '#a39c88' }}>
            Source: Camelot Realty Group managed-buildings roster (internal, Aug 2026). Distances are straight-line,
            geocoded via OpenStreetMap — not drive time.
          </p>
        </section>

        {/* ============ TRANSITION ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Transition</SectionLabel>
          <SectionTitle>A 60–90 day plan, not a name change on an invoice.</SectionTitle>
          <Rule />
          <div className="space-y-8">
            {OAK_PARK_TRANSITION_PLAN.map((phase) => (
              <div key={phase.label}>
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="font-sans text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>{phase.dayRange}</span>
                  <h3 className="font-heading text-xl" style={{ color: NAVY }}>{phase.label}</h3>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {phase.actions.map((a, i) => (
                    <li key={i} className="text-sm leading-relaxed flex gap-2" style={{ color: '#6e6858' }}>
                      <span style={{ color: GOLD }}>—</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ============ ANNUAL OPERATING CALENDAR ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Annual operating calendar</SectionLabel>
          <SectionTitle>The dates that matter, tracked before they become urgent.</SectionTitle>
          <Rule />
          <p className="mb-10 text-base leading-relaxed max-w-3xl" style={{ color: NAVY }}>
            {OAK_PARK_ANNUAL_CALENDAR_INTRO}
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {OAK_PARK_ANNUAL_CALENDAR.map((t) => (
              <div key={t.track} className="p-5 border" style={{ borderColor: '#d9d2c2' }}>
                <p className="font-heading text-lg mb-1" style={{ color: NAVY }}>{t.track}</p>
                <p className="text-sm leading-relaxed mb-3" style={{ color: '#6e6858' }}>{t.description}</p>
                <ul className="space-y-1">
                  {t.examples.map((ex, i) => (
                    <li key={i} className="text-xs leading-relaxed flex gap-2" style={{ color: '#6e6858' }}>
                      <span style={{ color: GOLD }}>—</span> {ex}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ============ MANAGEMENT PROPOSAL ============ */}
        <section id="proposal" className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Management proposal</SectionLabel>
          <SectionTitle>The fee, by entity.</SectionTitle>
          <Rule />
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {OAK_PARK_ENTITIES.map((entity) => (
              <div key={entity.key} className="p-5 border" style={{ borderColor: '#d9d2c2' }}>
                <p className="font-heading text-lg mb-1" style={{ color: NAVY }}>{entity.shortLabel}</p>
                <p className="text-sm mb-3" style={{ color: '#6e6858' }}>
                  <FactValue fact={entity.units} format={(v) => `${v} units`} />
                </p>
                <p className="font-heading text-2xl" style={{ color: GOLD }}>
                  ${entity.monthlyFeePerUnit}<span className="text-sm font-sans">/unit/mo</span>
                </p>
                <p className="text-sm mt-1" style={{ color: '#6e6858' }}>
                  <FactValue fact={entity.monthlyFeeTotal} format={(v) => `${formatCurrency(v as number)}/mo total`} />
                </p>
              </div>
            ))}
          </div>
          <p className="mb-6 text-base leading-relaxed" style={{ color: NAVY }}>
            Recommended community-wide rate: <strong>${OAK_PARK_PRICING.recommendedPerUnit}/unit/month</strong>
            {' '}(range considered: ${OAK_PARK_PRICING.floorPerUnit}–${OAK_PARK_PRICING.ceilingPerUnit}), with a{' '}
            {OAK_PARK_PRICING.escalatorPct}% annual escalator starting after Year {OAK_PARK_PRICING.escalatorStartsAfterYear}.
            One Board meeting per month is included community-wide; each additional separate meeting is
            ${OAK_PARK_PRICING.additionalMeetingFee}.
          </p>

          <div className="mb-10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2" style={{ borderColor: NAVY }}>
                  <th className="text-left py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>Ancillary service (Schedule B)</th>
                  <th className="text-right py-2 font-sans font-semibold uppercase text-xs tracking-wider" style={{ color: NAVY }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {OAK_PARK_ANCILLARY_FEES.map((row) => (
                  <tr key={row.service} className="border-b" style={{ borderColor: '#e5decc' }}>
                    <td className="py-2 pr-4">{row.service}</td>
                    <td className="py-2 text-right whitespace-nowrap" style={{ color: '#6e6858' }}>{row.fee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs mb-6" style={{ color: '#6e6858' }}>
            Owner-paid HOA/common charge (third-party data, from a public MLS listing for a unit in the community) —
            ${OAK_PARK_MARKET_COMP.hoaMonthlyCommonCharge}/month, covering {OAK_PARK_MARKET_COMP.hoaCommonChargeIncludes.join(', ').toLowerCase()}.
            This is separate from, and unrelated to, the Camelot management fee above.
          </p>

          <button
            onClick={handleDownloadProposal}
            disabled={downloading === 'proposal'}
            className="inline-flex items-center gap-2 px-6 py-3 font-sans text-sm font-semibold uppercase tracking-wider disabled:opacity-50"
            style={{ backgroundColor: NAVY, color: 'white' }}
          >
            {downloading === 'proposal' ? 'Generating…' : 'Download Management Proposal (PDF)'}
          </button>
        </section>

        {/* ============ MANAGEMENT AGREEMENT ============ */}
        <section id="agreement" className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Management agreement</SectionLabel>
          <SectionTitle>One agreement per legal entity.</SectionTitle>
          <Rule />
          <p className="mb-8 text-base leading-relaxed" style={{ color: NAVY }}>
            Oak Park operates as three legal entities, so Camelot prepares three parallel Camelot Condominium
            Management Agreements — one each for Condominium I, Condominium II, and the Unit Owners Association —
            built from the same terms and the same working unit counts shown above.
          </p>
          <div className="space-y-4">
            {OAK_PARK_ENTITIES.map((entity) => (
              <div key={entity.key} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-5 border" style={{ borderColor: '#d9d2c2' }}>
                <div>
                  <p className="font-heading text-lg" style={{ color: NAVY }}>{entity.legalName}</p>
                  <p className="text-xs" style={{ color: '#6e6858' }}>
                    <FactValue fact={entity.units} format={(v) => `${v} units (working count)`} />
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleDownloadAgreement(entity.key, 'pdf')}
                    disabled={downloading === `${entity.key}-pdf`}
                    className="px-4 py-2 font-sans text-xs font-semibold uppercase tracking-wider border disabled:opacity-50"
                    style={{ borderColor: NAVY, color: NAVY }}
                  >
                    {downloading === `${entity.key}-pdf` ? '…' : 'PDF'}
                  </button>
                  <button
                    onClick={() => handleDownloadAgreement(entity.key, 'docx')}
                    disabled={downloading === `${entity.key}-docx`}
                    className="px-4 py-2 font-sans text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
                    style={{ backgroundColor: GOLD, color: NAVY }}
                  >
                    {downloading === `${entity.key}-docx` ? '…' : 'Word (.docx)'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs italic" style={{ color: '#6e6858' }}>
            E-signature is not yet wired into this page. These downloads are for Board review; a signature workflow
            (DocuSign, Dropbox Sign, or Adobe Acrobat Sign) can be added once Camelot selects a provider — the
            document itself does not represent electronic acceptance as legally binding until that is in place.
          </p>
        </section>

        {/* ============ SUPPORTING DOCUMENTS ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Supporting documents</SectionLabel>
          <SectionTitle>What the Board can review now — and what stays behind the portal.</SectionTitle>
          <Rule />

          <div className="mb-10">
            <p className="font-heading text-lg mb-1" style={{ color: NAVY }}>Sample MDS monthly report package</p>
            <p className="text-sm leading-relaxed mb-4" style={{ color: '#6e6858' }}>
              An illustrative sample of the monthly board reporting package MDS produces — cash flow, bank
              reconciliations, check register, and paid-invoice images — for a fictional coop (“999 Owner’s Corp”),
              not Oak Park’s actual financials. Flip through it below, or download the full PDF.
            </p>
            <FlipBookViewer
              pageSrc={mdsSamplePageSrc}
              pageCount={MDS_SAMPLE_PAGE_COUNT}
              title="MDS Sample Monthly Report Package"
              goldHex={GOLD}
              navyHex={NAVY}
            />
            <a
              href={MDS_SAMPLE_PDF_URL}
              download
              className="inline-flex items-center gap-2 px-6 py-3 mt-4 font-sans text-sm font-semibold uppercase tracking-wider"
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              Download Sample Report (PDF)
            </a>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-10">
            <div className="p-5 border" style={{ borderColor: '#d9d2c2' }}>
              <p className="font-heading text-lg mb-2" style={{ color: NAVY }}>Transition Plan</p>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#6e6858' }}>
                Camelot’s records-and-files checklist and 60–90 day phasing, ready for the Board to review alongside
                the Management Proposal.
              </p>
              <button
                onClick={handleDownloadTransitionPlan}
                disabled={downloading === 'transition-plan'}
                className="px-5 py-2.5 font-sans text-xs font-semibold uppercase tracking-wider border disabled:opacity-50"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                {downloading === 'transition-plan' ? 'Generating…' : 'Download Transition Plan (PDF)'}
              </button>
            </div>
            <div className="p-5 border" style={{ borderColor: '#d9d2c2' }}>
              <p className="font-heading text-lg mb-2" style={{ color: NAVY }}>References</p>
              <p className="text-sm leading-relaxed" style={{ color: '#6e6858' }}>{OAK_PARK_REFERENCES_NOTE}</p>
            </div>
          </div>

          <p className="text-base leading-relaxed" style={{ color: NAVY }}>
            Actual budgets, insurance certificates, and Oak Park-specific financial packages live in a
            password-protected or tokenized Board portal — never on this public page. Ask David to share access
            once the Boards are ready to review those materials directly.
          </p>
        </section>

        {/* ============ DO-NOT-GUESS / TO BE CONFIRMED ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#d9d2c2' }}>
          <SectionLabel>Open items</SectionLabel>
          <SectionTitle>What still needs to be confirmed.</SectionTitle>
          <Rule />
          <ul className="space-y-3">
            {OAK_PARK_TO_BE_CONFIRMED.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: '#6e6858' }}>
                <span style={{ color: GOLD }}>—</span> {item}
              </li>
            ))}
          </ul>
        </section>

        {/* ============ NEXT STEP ============ */}
        <section className="relative py-24 text-center overflow-hidden">
          <img
            src={LOGO_BLACK}
            alt=""
            aria-hidden="true"
            className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] max-w-none opacity-[0.035]"
          />
          <div className="relative z-10">
          <SectionLabel>Next step</SectionLabel>
          <h2 className="font-heading text-3xl md:text-4xl mb-6" style={{ color: NAVY }}>
            Let's find twenty minutes for the Board.
          </h2>
          <p className="max-w-xl mx-auto mb-8 text-base leading-relaxed" style={{ color: '#6e6858' }}>
            A short call or on-site meet-and-greet is the fastest way to answer questions and refine this proposal
            around Oak Park's actual financials, service needs, and transition timing.
          </p>
          <a
            href={`mailto:dgoldoff@camelot.nyc?subject=${encodeURIComponent('Oak Park at Douglaston — next step')}`}
            className="inline-flex items-center gap-2 px-8 py-4 font-sans text-sm font-semibold uppercase tracking-wider"
            style={{ backgroundColor: NAVY, color: 'white' }}
          >
            Contact David Goldoff
          </a>
          <p className="mt-6 text-xs" style={{ color: '#6e6858' }}>
            {CAMELOT_COMPANY_FACTS.officeAddress} · {CAMELOT_COMPANY_FACTS.officePhone}
          </p>
          <img src={LOGO_BLACK} alt="Camelot Realty Group" className="h-6 w-auto mx-auto mt-10 opacity-80" />
          </div>
        </section>
      </div>
    </div>
  );
}
