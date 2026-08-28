/**
 * ProposalPDF — React-PDF document component.
 *
 * Matches the Camelot "Proposal of Property Management Services" Word
 * master template exactly: navy letter-style layout (not a multi-section
 * scout report), header logo + letterhead + gold tagline on every page,
 * footer with office contact + confidential line, an info table (Date /
 * Version / Prepared For / Addressed To / Recipient Contact), a Notes box,
 * a cover letter, Property Description, Property Snapshot table, Scope of
 * Services (grouped, bulleted), Term/Rate/Fees table, Next Steps, and the
 * Summary of Transitional Procedures / Budget & Staff Review / Meet & Greet
 * closing sections, ending in a signature block.
 */

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import type { ProposalData } from '@/lib/proposal-generator';
import { RENTAL_AGREEMENT_LOGO_B64 } from '@/lib/agreement-brand';
import {
  DAVID_GOLDOFF_SIGNATURE,
  DAVID_GOLDOFF_SIGNATURE_IMAGE,
  DAVID_GOLDOFF_SIGNATURE_LINES,
} from '@/lib/camelot-signature';

// ============================================================
// Color Palette — matches Camelot_Proposal_of_Services_Template.docx
// ============================================================

const NAVY = '#162B5E';
const GOLD = '#A9814A';
const GRAY = '#6B7280';
const DARK_TEXT = '#222222';
const LIGHT_GRAY_BG = '#F7F4EC';
const RULE = '#D9D2C2';

// ============================================================
// Styles
// ============================================================

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: DARK_TEXT,
    paddingTop: 76,
    paddingBottom: 54,
    paddingHorizontal: 54,
    lineHeight: 1.5,
  },

  // Letterhead header, every page
  header: {
    position: 'absolute',
    top: 24,
    left: 54,
    right: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 8,
  },
  headerLogo: { width: 34, height: 34 },
  headerTextWrap: { flex: 1, marginLeft: 10 },
  headerName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: NAVY, letterSpacing: 0.3 },
  headerServices: { fontSize: 6.5, color: GRAY, letterSpacing: 1, marginTop: 2 },
  headerTag: { fontSize: 8, color: GOLD, fontStyle: 'italic', marginTop: 2 },

  // Footer, every page
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 54,
    right: 54,
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingTop: 6,
    alignItems: 'center',
  },
  footerLine: { fontSize: 7, color: GRAY, textAlign: 'center' },

  // Title block
  docTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 2 },
  docSubtitle: { fontSize: 8.5, color: GRAY, marginBottom: 1 },

  sectionHeading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginTop: 16,
    marginBottom: 6,
  },

  // Info table
  infoTable: { marginTop: 14, borderTopWidth: 1, borderTopColor: RULE },
  infoRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingVertical: 4,
  },
  infoLabel: { width: '30%', fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: NAVY },
  infoValue: { width: '70%', fontSize: 8.5, color: DARK_TEXT },

  // Notes box
  notesBox: {
    marginTop: 12,
    backgroundColor: LIGHT_GRAY_BG,
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    padding: 10,
  },
  notesTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 4 },
  notesItem: { fontSize: 8.5, color: DARK_TEXT, marginBottom: 2, lineHeight: 1.4 },

  body: { fontSize: 9.5, color: DARK_TEXT, lineHeight: 1.55, marginBottom: 8, textAlign: 'justify' },

  // Snapshot / Term table
  snapshotTable: { marginTop: 4, marginBottom: 4 },
  snapshotRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingVertical: 5,
  },
  snapshotLabel: { width: '32%', fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY },
  snapshotValue: { width: '68%', fontSize: 9, color: DARK_TEXT },

  // Scope of services
  serviceGroupTitle: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 10, marginBottom: 4 },
  bulletRow: { flexDirection: 'row', marginBottom: 3, paddingLeft: 4 },
  bulletDot: { width: 10, fontSize: 9, color: GOLD },
  bulletText: { flex: 1, fontSize: 9, color: DARK_TEXT, lineHeight: 1.4 },

  numberedRow: { flexDirection: 'row', marginBottom: 6 },
  numberBadge: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: NAVY,
    justifyContent: 'center', alignItems: 'center', marginRight: 8, marginTop: 1,
  },
  numberBadgeText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#fff' },
  numberedTitle: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 1 },
  numberedDesc: { fontSize: 9, color: DARK_TEXT, lineHeight: 1.45 },

  signatureBlock: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 0.75,
    borderTopColor: GOLD,
  },
  signatureImage: { width: 155, height: 44, objectFit: 'contain', marginBottom: 4 },
  signatureLine: { fontSize: 8, color: DARK_TEXT, lineHeight: 1.4 },
  signatureName: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 3 },
});

// ============================================================
// Helpers
// ============================================================

function fmtCurrency(v: number): string {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

function fmtDateLong(iso?: string): string {
  if (!iso) return '[Month Day, Year]';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function versionFromDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return `v${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.1`;
}

function buildPropertyDescription(data: ProposalData): string {
  const label = data.buildingName || data.buildingAddress;
  const typeLabel = (data.buildingType || 'residential').replace(/-/g, ' ');
  const parts: string[] = [];
  parts.push(
    `${label} is a ${typeLabel}${data.units ? ` property comprising ${data.units} units` : ''}${
      data.yearBuilt ? `, built in ${data.yearBuilt}` : ''
    }${data.borough ? ` in ${data.borough}` : ''}${data.neighborhood ? `, ${data.neighborhood}` : ''}.`
  );
  if (data.openViolationsCount > 0) {
    parts.push(
      `The property currently carries ${data.openViolationsCount} open violation${data.openViolationsCount === 1 ? '' : 's'} that will require coordinated resolution during transition.`
    );
  } else if (data.violationsCount === 0) {
    parts.push('The property maintains a clean compliance record, which Camelot intends to preserve.');
  }
  if (data.currentManagement && !/unknown/i.test(data.currentManagement)) {
    parts.push(`The property is currently managed by ${data.currentManagement}.`);
  }
  return parts.join(' ');
}

// ============================================================
// Header / Footer
// ============================================================

function LetterheadHeader() {
  return (
    <View style={s.header} fixed>
      <Image src={RENTAL_AGREEMENT_LOGO_B64} style={s.headerLogo} />
      <View style={s.headerTextWrap}>
        <Text style={s.headerName}>CAMELOT REALTY GROUP</Text>
        <Text style={s.headerServices}>REAL ESTATE · PROPERTY MGMT · BROKERAGE · INVESTMENT SERVICES</Text>
        <Text style={s.headerTag}>New Yorkers Working for New Yorkers   EST. 2006</Text>
      </View>
    </View>
  );
}

function LetterFooter({ addressLabel }: { addressLabel: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerLine}>
        57 West 57th Street, Suite 410, New York, NY 10019 · (212) 206-9939 · info@camelot.nyc · www.camelot.nyc
      </Text>
      <Text
        style={s.footerLine}
        render={({ pageNumber, totalPages }) =>
          `CONFIDENTIAL — PREPARED EXCLUSIVELY FOR ${addressLabel.toUpperCase()} · Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

function DavidSignatureBlock() {
  return (
    <View style={s.signatureBlock}>
      <Image src={DAVID_GOLDOFF_SIGNATURE_IMAGE} style={s.signatureImage} />
      <Text style={s.signatureName}>{DAVID_GOLDOFF_SIGNATURE.name}</Text>
      {DAVID_GOLDOFF_SIGNATURE_LINES.slice(1).map((line, i) =>
        line ? (
          <Text style={s.signatureLine} key={`${line}-${i}`}>
            {line}
          </Text>
        ) : (
          <Text style={s.signatureLine} key={`space-${i}`}> </Text>
        )
      )}
    </View>
  );
}

// ============================================================
// Main Document
// ============================================================

interface ProposalPDFProps {
  data: ProposalData;
}

export default function ProposalPDF({ data }: ProposalPDFProps) {
  const buildingLabel = data.buildingName || data.buildingAddress;
  const version = versionFromDate(data.generatedAt);
  const recipientContact = [data.contactEmail, data.contactPhone].filter(Boolean).join(' / ');
  const propertyDescription = buildPropertyDescription(data);
  const unitMixLabel = `${(data.buildingType || 'Residential').replace(/-/g, ' ')} — ${data.units || 'TBD'} Units`;
  const { pricing } = data;
  const includedPremium = data.premiumServices.filter((p) => p.included);

  const nextSteps = [
    { title: 'Discuss This Proposal Further', desc: 'Schedule a call or meeting to walk through scope, fee, and answer any questions.' },
    { title: 'Finalize Term & Fee', desc: 'Confirm the management term and fee structure that works best for the Board/ownership.' },
    { title: 'Execute Property Management Agreement', desc: 'Once terms are identified, Camelot will issue the formal Agreement for signature.' },
    { title: 'Begin Transition', desc: 'Our transition team takes over from there, outlined below.' },
  ];

  return (
    <Document
      title={`Proposal of Property Management Services — ${data.buildingAddress}`}
      author={data.company.name}
      subject="Proposal of Property Management Services"
    >
      <Page size="LETTER" style={s.page} wrap>
        <LetterheadHeader />
        <LetterFooter addressLabel={data.preparedFor || 'THE ADDRESSEE'} />

        <Text style={s.docTitle}>PROPOSAL OF PROPERTY MANAGEMENT SERVICES</Text>
        <Text style={s.docSubtitle}>PREPARED BY CAMELOT PROPERTY MANAGEMENT SERVICES CORP.</Text>
        <Text style={s.docSubtitle}>{buildingLabel}</Text>
        <Text style={s.docSubtitle}>{data.buildingAddress}{data.borough ? `, ${data.borough}` : ''}</Text>

        {/* Info table */}
        <View style={s.infoTable}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Date</Text>
            <Text style={s.infoValue}>{fmtDateLong(data.generatedAt)}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Version</Text>
            <Text style={s.infoValue}>{version}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Prepared For</Text>
            <Text style={s.infoValue}>{data.preparedFor}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Addressed To</Text>
            <Text style={s.infoValue}>{buildingLabel}</Text>
          </View>
          {recipientContact ? (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Recipient Contact</Text>
              <Text style={s.infoValue}>{recipientContact}</Text>
            </View>
          ) : null}
        </View>

        {/* Notes box, from Key Observations / signals */}
        {data.signals.length > 0 ? (
          <View style={s.notesBox}>
            <Text style={s.notesTitle}>NOTES</Text>
            <Text style={[s.notesItem, { marginBottom: 4 }]}>
              Context gathered from property records and conversations with the client — reference before finalizing this proposal.
            </Text>
            {data.signals.map((sig, i) => (
              <Text style={s.notesItem} key={i}>• {sig}</Text>
            ))}
          </View>
        ) : null}

        {/* Cover letter */}
        <Text style={[s.body, { marginTop: 16 }]}>Re: Property Management Proposal — {buildingLabel}, {data.buildingAddress}</Text>
        <Text style={s.body}>Dear {data.preparedFor},</Text>
        {data.coverLetterParagraphs && data.coverLetterParagraphs.length > 0 ? (
          data.coverLetterParagraphs.map((para, i) => (
            <Text key={i} style={s.body}>{para}</Text>
          ))
        ) : (
          <>
            <Text style={s.body}>
              It was a pleasure connecting with you about the opportunity to manage {buildingLabel}. We are grateful for
              your consideration and the trust you're placing in Camelot — we're confident that our hands-on approach,
              vetted network of contractors and vendors, and responsive team can bring real, measurable value to your
              Board and residents.
            </Text>
            <Text style={s.body}>
              Outlined in this proposal is the scope of services, fee structure, and next steps we recommend for{' '}
              {buildingLabel}. We would welcome the opportunity to discuss this further at your convenience, and we
              look forward to the possibility of working together.
            </Text>
          </>
        )}
        <Text style={[s.body, { fontFamily: 'Helvetica-Bold', marginBottom: 0 }]}>David Goldoff</Text>
        <Text style={s.body}>President{'\n'}Camelot Property Management Services Corp.</Text>

        {/* Property Description */}
        <Text style={s.sectionHeading}>Property Description</Text>
        <Text style={s.body}>{propertyDescription}</Text>

        {/* Property Snapshot */}
        <Text style={s.sectionHeading}>Property Snapshot</Text>
        <View style={s.snapshotTable}>
          <View style={s.snapshotRow}>
            <Text style={s.snapshotLabel}>The Property</Text>
            <Text style={s.snapshotValue}>{data.buildingAddress}</Text>
          </View>
          <View style={s.snapshotRow}>
            <Text style={s.snapshotLabel}>The Client</Text>
            <Text style={s.snapshotValue}>{data.preparedFor}</Text>
          </View>
          <View style={s.snapshotRow}>
            <Text style={s.snapshotLabel}>Unit Mix</Text>
            <Text style={s.snapshotValue}>{unitMixLabel}</Text>
          </View>
          <View style={s.snapshotRow}>
            <Text style={s.snapshotLabel}>Management Of</Text>
            <Text style={s.snapshotValue}>Board Agendas, Common Areas, Building Operations</Text>
          </View>
        </View>

        {/* Scope of Services */}
        <Text style={s.sectionHeading}>Scope of Services</Text>
        <Text style={s.body}>
          If retained, Camelot will assign a dedicated team to {buildingLabel}, including a Property Manager who leads
          day-to-day operations and Board meetings, an account manager and administrative support, and an in-house
          controller and CPA for budget development and financial oversight.
        </Text>
        <Text style={s.serviceGroupTitle}>Property Management Services</Text>
        {data.standardServices.map((svc, i) => (
          <View style={s.bulletRow} key={i}>
            <Text style={s.bulletDot}>•</Text>
            <Text style={s.bulletText}><Text style={{ fontFamily: 'Helvetica-Bold' }}>{svc.name}.</Text> {svc.description}</Text>
          </View>
        ))}
        {includedPremium.length > 0 ? (
          <>
            <Text style={s.serviceGroupTitle}>Additional Services (Recommended)</Text>
            {includedPremium.map((svc, i) => (
              <View style={s.bulletRow} key={i}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}><Text style={{ fontFamily: 'Helvetica-Bold' }}>{svc.name}.</Text> {svc.description}</Text>
              </View>
            ))}
          </>
        ) : null}

        {/* Term, Rate & Fees */}
        <Text style={s.sectionHeading}>Term, Rate &amp; Fees</Text>
        <View style={s.snapshotTable}>
          <View style={s.snapshotRow}>
            <Text style={s.snapshotLabel}>Initial Term</Text>
            <Text style={s.snapshotValue}>24 months, commencing upon execution</Text>
          </View>
          <View style={s.snapshotRow}>
            <Text style={s.snapshotLabel}>Renewal</Text>
            <Text style={s.snapshotValue}>Auto-renews annually unless terminated with 90 days' written notice</Text>
          </View>
          <View style={s.snapshotRow}>
            <Text style={s.snapshotLabel}>Monthly Management Fee</Text>
            <Text style={s.snapshotValue}>{fmtCurrency(pricing.totalMonthly)} per month ({fmtCurrency(pricing.totalPerUnit)} per unit)</Text>
          </View>
          <View style={s.snapshotRow}>
            <Text style={s.snapshotLabel}>Annual Escalation</Text>
            <Text style={s.snapshotValue}>4% annually</Text>
          </View>
          <View style={s.snapshotRow}>
            <Text style={s.snapshotLabel}>Ancillary Fees</Text>
            <Text style={s.snapshotValue}>Per the attached Ancillary Fee Schedule (see below)</Text>
          </View>
        </View>
        <Text style={s.body}>
          The fee above reflects comparable properties we currently manage, factoring in scope, labor, insurance,
          overhead, and profit. Services outside the base scope of this proposal — such as lease renewals,
          sublet/transfer processing, capital project oversight, or tax certiorari coordination — are billed
          according to our standard Ancillary Fee Schedule, provided as an attachment to this proposal.
        </Text>
        <Text style={s.body}>
          The full terms, responsibilities, and conditions of our engagement are set forth in Camelot's standard
          Property Management Agreement, which we will issue once the term and fee above are confirmed.
        </Text>

        {/* Ancillary Fee Schedule */}
        <Text style={s.sectionHeading}>Ancillary Fee Schedule</Text>
        <Text style={[s.serviceGroupTitle, { marginTop: 0 }]}>Association / Building-Level Fees</Text>
        {data.associationAncillaryFees.slice(0, 8).map((item) => (
          <View style={s.snapshotRow} key={item.service}>
            <Text style={s.snapshotLabel}>{item.service}</Text>
            <Text style={s.snapshotValue}>{item.fee}</Text>
          </View>
        ))}
        <Text style={s.serviceGroupTitle}>Individual / Applicant / Unit-Level Fees</Text>
        {data.individualAncillaryFees.slice(0, 8).map((item) => (
          <View style={s.snapshotRow} key={item.service}>
            <Text style={s.snapshotLabel}>{item.service}</Text>
            <Text style={s.snapshotValue}>{item.fee}</Text>
          </View>
        ))}

        {/* Next Steps */}
        <Text style={s.sectionHeading}>Next Steps</Text>
        {nextSteps.map((step, i) => (
          <View style={s.numberedRow} key={step.title}>
            <View style={s.numberBadge}>
              <Text style={s.numberBadgeText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.numberedTitle}>{step.title}</Text>
              <Text style={s.numberedDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}

        {/* Transitional procedures */}
        <Text style={s.sectionHeading}>Summary of Transitional Procedures</Text>
        <Text style={s.body}>
          Camelot understands that a change in management can feel disruptive if it isn't handled carefully. Our
          transition team works closely with the outgoing management company, ownership, and building staff to make
          the handoff as seamless as possible — most transitions take 45–60 days. Upon being retained, we contact
          the outgoing manager directly, request all building files and financial records, and set target dates for
          payroll, billing, and any time-sensitive operational items so nothing falls through the cracks.
        </Text>

        <Text style={s.sectionHeading}>Budget, Facility &amp; Staff Review</Text>
        <Text style={s.body}>
          In parallel with the transition, we conduct a full review of the building's finances, staff, and current
          vendor relationships against comparable properties in our portfolio. We meet with building staff to
          understand what's working and what isn't, and we deliver a written report to the Board within the first
          30 days, along with recommendations for cost savings or operational improvements.
        </Text>

        <Text style={s.sectionHeading}>Meet &amp; Greet with Owners/Board</Text>
        <Text style={s.body}>
          Within the first 30–60 days, we like to introduce the Camelot team to residents and the Board, in person
          or over Zoom. This gives owners a chance to put a face to the team managing their building, raise any
          concerns directly, and update their contact information on file.
        </Text>

        <Text style={s.body}>Thank you again for your consideration.</Text>

        <DavidSignatureBlock />
      </Page>
    </Document>
  );
}
