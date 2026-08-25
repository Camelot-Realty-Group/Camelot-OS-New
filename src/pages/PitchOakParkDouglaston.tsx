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

import { useCallback, useState, type ReactNode } from 'react';
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
import ProposalPDF from '@/components/ProposalPDF';
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

const GOLD = '#C9A55C';
const NAVY = '#1B2A4A';
const IVORY = '#F8F5EF';
const CHARCOAL = '#2A2621';

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

  const handleDownloadProposal = useCallback(async () => {
    setDownloading('proposal');
    try {
      const building = oakParkAsBuilding();
      const data = generateProposalData(building, {
        contactName: 'Oak Park Board',
        customPricingPerUnit: OAK_PARK_PRICING.recommendedPerUnit,
        generatedBy: 'Camelot OS Pitch Microsite',
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
      toast.error('Could not generate the proposal PDF');
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
        await downloadAsPDF(html, `${filenameBase}.pdf`);
      } else {
        const blob = await generateAgreementDocxBlob(html);
        await downloadBlob(blob, `${filenameBase}.docx`);
      }
      toast.success(`${entity.shortLabel} agreement (${format.toUpperCase()}) downloaded`);
    } catch (err) {
      console.error(err);
      toast.error('Could not generate the management agreement');
    } finally {
      setDownloading(null);
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto font-sans"
      style={{ backgroundColor: IVORY, color: CHARCOAL }}
    >
      {/* ============ HERO ============ */}
      <section className="relative min-h-[92vh] flex items-end">
        <img
          src={PHOTOS.aerial}
          alt="Aerial view of Oak Park at Douglaston"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(27,42,74,0.15) 0%, rgba(20,18,15,0.88) 100%)' }}
        />
        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-10 pb-16 md:pb-24 w-full">
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

        {/* ============ WHAT WE HEARD ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
          <SectionLabel>What we heard</SectionLabel>
          <SectionTitle>Before we proposed anything, we listened.</SectionTitle>
          <Rule />
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
          <p className="mt-8 text-sm italic" style={{ color: '#6B6560' }}>
            {OAK_PARK_BOARD_CONTACTS.openItem}
          </p>
        </section>

        {/* ============ THE CAMELOT SOLUTION ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
          <SectionLabel>The Camelot solution</SectionLabel>
          <SectionTitle>A direct answer to each gap above.</SectionTitle>
          <Rule />
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
                <p className="text-sm leading-relaxed" style={{ color: '#4a4640' }}>{item.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ TEAM ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
          <SectionLabel>Your dedicated team</SectionLabel>
          <SectionTitle>The people who will actually be here.</SectionTitle>
          <Rule />
          <div className="space-y-6">
            {OAK_PARK_TEAM.map((member) => (
              <div key={member.role} className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-6 py-4 border-b" style={{ borderColor: '#EDE8DE' }}>
                <div className="md:w-56 shrink-0">
                  <p className="font-sans text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>{member.role}</p>
                  <p className="font-heading text-lg" style={{ color: NAVY }}>
                    <FactValue fact={member.person} />
                  </p>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#4a4640' }}>{member.commitment}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ WEEKLY ON-SITE MANAGEMENT (with amenity photos) ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
          <SectionLabel>Weekly on-site management</SectionLabel>
          <SectionTitle>The community, as it actually is today.</SectionTitle>
          <Rule />
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <img src={PHOTOS.entrance} alt="Oak Park at Douglaston entrance sign" className="w-full h-56 object-cover" />
            <img src={PHOTOS.pool} alt="Community pool and pool house" className="w-full h-56 object-cover" />
            <img src={PHOTOS.court} alt="Community sport court" className="w-full h-56 object-cover" />
          </div>
          <p className="text-base leading-relaxed" style={{ color: NAVY }}>
            {OAK_PARK_PROPERTY.buildingCount.value} buildings across a {OAK_PARK_PROPERTY.lotSqFt.value.toLocaleString()} sq ft gated lot,
            with a pool and pool house, tennis court, a fenced multi-sport court, a shared fitness center, and a spa/hot tub —
            amenities worth actively maintaining, not just listing on a fact sheet.
          </p>
        </section>

        {/* ============ FINANCIAL REPORTING ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
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
          <p className="text-xs italic" style={{ color: '#6B6560' }}>
            Sample dashboard figures shown to Boards during onboarding are illustrative only and are never Oak Park's
            actual financial data unless explicitly labeled as such.
          </p>
        </section>

        {/* ============ CAMELOT OS ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
          <SectionLabel>Camelot OS</SectionLabel>
          <SectionTitle>The technology behind the management.</SectionTitle>
          <Rule />
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {OAK_PARK_TECH_STACK.map((t) => (
              <div key={t.name} className="p-5 border" style={{ borderColor: '#DDD8D0' }}>
                <p className="font-heading text-lg mb-1" style={{ color: NAVY }}>{t.name}</p>
                <p className="text-sm" style={{ color: '#4a4640' }}>{t.role}</p>
              </div>
            ))}
          </div>
          {OAK_PARK_TECH_NOTES.map((n, i) => (
            <p key={i} className="text-sm italic mb-2" style={{ color: '#6B6560' }}>{n}</p>
          ))}
        </section>

        {/* ============ RESIDENT EXPERIENCE ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
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
        <section className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
          <SectionLabel>Cost optimization</SectionLabel>
          <SectionTitle>Benchmarked, not guessed.</SectionTitle>
          <Rule />
          <p className="mb-4 text-base leading-relaxed" style={{ color: NAVY }}>
            Vendor contracts are benchmarked against Camelot's {CAMELOT_COMPANY_FACTS.buildings}-building portfolio.
            Where a credible savings case exists, we rebid — we don't manufacture savings to justify a fee.
          </p>
          <p className="text-sm leading-relaxed p-4 border" style={{ borderColor: GOLD, color: '#4a4640' }}>
            An optional shared-savings program is available at 30% of verified first-year realized net hard-dollar
            savings — but only under a separate written agreement with a documented baseline and measurement period.
            It is never assumed or bundled into the base proposal below.
          </p>
        </section>

        {/* ============ TRANSITION ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
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
                    <li key={i} className="text-sm leading-relaxed flex gap-2" style={{ color: '#4a4640' }}>
                      <span style={{ color: GOLD }}>—</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ============ MANAGEMENT PROPOSAL ============ */}
        <section id="proposal" className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
          <SectionLabel>Management proposal</SectionLabel>
          <SectionTitle>The fee, by entity.</SectionTitle>
          <Rule />
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {OAK_PARK_ENTITIES.map((entity) => (
              <div key={entity.key} className="p-5 border" style={{ borderColor: '#DDD8D0' }}>
                <p className="font-heading text-lg mb-1" style={{ color: NAVY }}>{entity.shortLabel}</p>
                <p className="text-sm mb-3" style={{ color: '#6B6560' }}>
                  <FactValue fact={entity.units} format={(v) => `${v} units`} />
                </p>
                <p className="font-heading text-2xl" style={{ color: GOLD }}>
                  ${entity.monthlyFeePerUnit}<span className="text-sm font-sans">/unit/mo</span>
                </p>
                <p className="text-sm mt-1" style={{ color: '#4a4640' }}>
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
                  <tr key={row.service} className="border-b" style={{ borderColor: '#EDE8DE' }}>
                    <td className="py-2 pr-4">{row.service}</td>
                    <td className="py-2 text-right whitespace-nowrap" style={{ color: '#4a4640' }}>{row.fee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs mb-6" style={{ color: '#6B6560' }}>
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
        <section id="agreement" className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
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
              <div key={entity.key} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-5 border" style={{ borderColor: '#DDD8D0' }}>
                <div>
                  <p className="font-heading text-lg" style={{ color: NAVY }}>{entity.legalName}</p>
                  <p className="text-xs" style={{ color: '#6B6560' }}>
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
          <p className="mt-6 text-xs italic" style={{ color: '#6B6560' }}>
            E-signature is not yet wired into this page. These downloads are for Board review; a signature workflow
            (DocuSign, Dropbox Sign, or Adobe Acrobat Sign) can be added once Camelot selects a provider — the
            document itself does not represent electronic acceptance as legally binding until that is in place.
          </p>
        </section>

        {/* ============ SUPPORTING DOCUMENTS ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
          <SectionLabel>Supporting documents</SectionLabel>
          <SectionTitle>Board-confidential materials.</SectionTitle>
          <Rule />
          <p className="text-base leading-relaxed" style={{ color: NAVY }}>
            Budgets, sample financial packages, insurance certificates, and reference letters live in a
            password-protected or tokenized Board portal — never on this public page. Ask David to share access
            once the Boards are ready to review those materials directly.
          </p>
        </section>

        {/* ============ DO-NOT-GUESS / TO BE CONFIRMED ============ */}
        <section className="py-20 border-b" style={{ borderColor: '#DDD8D0' }}>
          <SectionLabel>Open items</SectionLabel>
          <SectionTitle>What still needs to be confirmed.</SectionTitle>
          <Rule />
          <ul className="space-y-3">
            {OAK_PARK_TO_BE_CONFIRMED.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: '#4a4640' }}>
                <span style={{ color: GOLD }}>—</span> {item}
              </li>
            ))}
          </ul>
        </section>

        {/* ============ NEXT STEP ============ */}
        <section className="py-24 text-center">
          <SectionLabel>Next step</SectionLabel>
          <h2 className="font-heading text-3xl md:text-4xl mb-6" style={{ color: NAVY }}>
            Let's find twenty minutes for the Board.
          </h2>
          <p className="max-w-xl mx-auto mb-8 text-base leading-relaxed" style={{ color: '#4a4640' }}>
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
          <p className="mt-6 text-xs" style={{ color: '#6B6560' }}>
            {CAMELOT_COMPANY_FACTS.officeAddress} · {CAMELOT_COMPANY_FACTS.officePhone}
          </p>
        </section>
      </div>
    </div>
  );
}
