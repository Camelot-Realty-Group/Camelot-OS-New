/**
 * ProposalPDF — React-PDF document component
 * Professional property management proposal for Camelot.
 */

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { ProposalData } from '@/lib/proposal-generator';
import {
  DAVID_GOLDOFF_SIGNATURE,
  DAVID_GOLDOFF_SIGNATURE_IMAGE,
  DAVID_GOLDOFF_SIGNATURE_LINES,
} from '@/lib/camelot-signature';

// ============================================================
// Color Palette
// ============================================================

const NAVY = '#0f1629';
const GOLD = '#C5A55A';
const GOLD_LIGHT = '#D4BA78';
const WHITE = '#FFFFFF';
const LIGHT_GRAY = '#F5F5F5';
const MEDIUM_GRAY = '#888888';
const DARK_TEXT = '#1a1a2e';
const CAMELOT_GOLD_LOGO = '/images/camelot-gold-logo.png';

// ============================================================
// Styles
// ============================================================

const s = StyleSheet.create({
  // Global
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK_TEXT,
    paddingTop: 72,
    paddingBottom: 60,
    paddingHorizontal: 50,
  },
  pageHeader: {
    position: 'absolute',
    top: 18,
    left: 50,
    right: 50,
    height: 38,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
    paddingBottom: 8,
  },
  headerLogo: {
    width: 86,
    height: 38,
    objectFit: 'contain',
  },
  headerContact: {
    fontSize: 7.5,
    color: MEDIUM_GRAY,
    textAlign: 'right',
    lineHeight: 1.35,
  },

  // Cover page
  coverPage: {
    fontFamily: 'Helvetica',
    backgroundColor: WHITE,
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 54,
    paddingHorizontal: 54,
    paddingBottom: 50,
  },
  coverTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 52,
  },
  coverLogo: {
    width: 140,
    height: 64,
    objectFit: 'contain',
  },
  coverContact: {
    fontSize: 8.5,
    color: DARK_TEXT,
    textAlign: 'right',
    lineHeight: 1.45,
  },
  coverTitle: {
    fontSize: 29,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginBottom: 10,
  },
  coverSubtitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: GOLD,
    marginBottom: 8,
  },
  coverDivider: {
    width: 120,
    height: 2,
    backgroundColor: GOLD,
    marginVertical: 24,
  },
  coverAddress: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: DARK_TEXT,
    marginBottom: 6,
  },
  coverMeta: {
    fontSize: 10,
    color: MEDIUM_GRAY,
    marginBottom: 4,
  },
  coverFacts: {
    flexDirection: 'row',
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: GOLD,
    borderBottomWidth: 1,
    borderBottomColor: GOLD,
    paddingVertical: 14,
  },
  coverFact: {
    width: '25%',
  },
  coverFactValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: GOLD,
  },
  coverFactLabel: {
    fontSize: 7.5,
    color: MEDIUM_GRAY,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 40,
    left: 50,
    right: 50,
    textAlign: 'center',
  },
  coverFooterText: {
    fontSize: 8,
    color: MEDIUM_GRAY,
    textAlign: 'center',
  },

  // Section headers
  sectionHeader: {
    backgroundColor: NAVY,
    color: WHITE,
    padding: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
  },
  sectionSubtitle: {
    fontSize: 9,
    color: GOLD_LIGHT,
    marginTop: 2,
  },

  // Sub-section headers
  subHeader: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    borderBottomWidth: 1,
    borderBottomColor: GOLD,
    paddingBottom: 4,
    marginBottom: 8,
    marginTop: 14,
  },

  // Body text
  body: {
    fontSize: 10,
    lineHeight: 1.6,
    color: DARK_TEXT,
    marginBottom: 8,
  },
  bodySmall: {
    fontSize: 9,
    color: MEDIUM_GRAY,
    lineHeight: 1.5,
  },

  // Key-value row
  kvRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e5e5',
  },
  kvLabel: {
    width: '40%',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  kvValue: {
    width: '60%',
    fontSize: 10,
    color: DARK_TEXT,
  },

  // Tables
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 2,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e5e5',
  },
  tableRowAlt: {
    backgroundColor: LIGHT_GRAY,
  },
  tableCell: {
    fontSize: 9,
    color: DARK_TEXT,
  },

  // Highlight box
  highlight: {
    backgroundColor: '#FDF8ED',
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 4,
    padding: 12,
    marginVertical: 10,
  },
  highlightTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginBottom: 4,
  },
  highlightValue: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: GOLD,
  },

  // Advantages grid
  advantageItem: {
    marginBottom: 10,
  },
  advantageTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginBottom: 2,
  },
  advantageDesc: {
    fontSize: 9,
    color: DARK_TEXT,
    lineHeight: 1.5,
  },

  // Bullet
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 14,
    fontSize: 10,
    color: GOLD,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: DARK_TEXT,
    lineHeight: 1.5,
  },

  // Page footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 50,
    right: 50,
    flexDirection: 'column',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#ddd',
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: MEDIUM_GRAY,
    textAlign: 'center',
    lineHeight: 1.35,
  },
  footerContact: {
    fontSize: 7,
    color: MEDIUM_GRAY,
    textAlign: 'center',
    lineHeight: 1.35,
    marginTop: 1,
  },

  // Two-column
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  col50: {
    width: '48%',
  },

  // Pricing summary columns
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e5e5',
  },
  pricingLabel: {
    fontSize: 10,
    color: DARK_TEXT,
  },
  pricingValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  pricingTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: NAVY,
  },
  pricingTotalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  pricingTotalValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: GOLD,
  },
  signatureBlock: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 0.75,
    borderTopColor: GOLD,
  },
  signatureImage: {
    width: 175,
    height: 50,
    objectFit: 'contain',
    marginBottom: 4,
  },
  signatureLine: {
    fontSize: 8.5,
    color: DARK_TEXT,
    lineHeight: 1.4,
  },
  signatureName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginTop: 4,
  },
});

// ============================================================
// Helpers
// ============================================================

function fmtCurrency(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function fmtDate(iso?: string): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function sectionEnabled(data: ProposalData, id: string): boolean {
  return data.sections.find((sec) => sec.id === id)?.enabled ?? true;
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

function PageHeader({ data }: { data: ProposalData }) {
  return (
    <View style={s.pageHeader} fixed>
      <Image src={CAMELOT_GOLD_LOGO} style={s.headerLogo} />
      <Text style={s.headerContact}>
        {data.company.address}
        {'\n'}
        {data.company.phone} | {data.company.website}
        {'\n'}
        Proposal #{data.proposalNumber}
      </Text>
    </View>
  );
}

// ============================================================
// Page Footer
// ============================================================

function PageFooter({ data, pageNum }: { data: ProposalData; pageNum: number }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Confidential — Prepared for {data.buildingAddress}</Text>
      <Text style={s.footerText}>{data.company.name} · Page {pageNum}</Text>
      <Text style={s.footerContact}>Main: (212) 206-9939  ·  www.camelot.nyc  ·  Licensed Broker ID #10491200104</Text>
    </View>
  );
}

// ============================================================
// Cover Page
// ============================================================

function CoverPage({ data }: { data: ProposalData }) {
  const buildingLabel = data.buildingName || data.buildingAddress;
  return (
    <Page size="LETTER" style={s.coverPage}>
      <View style={s.coverTop}>
        <Image src={CAMELOT_GOLD_LOGO} style={s.coverLogo} />
        <Text style={s.coverContact}>
          {data.company.address}
          {'\n'}
          {data.company.phone}
          {'\n'}
          {data.company.website}
        </Text>
      </View>
      <Text style={s.coverTitle}>Proposal of Property Management Services</Text>
      <Text style={s.coverSubtitle}>{buildingLabel}</Text>
      <Text style={s.coverAddress}>{data.buildingAddress}</Text>
      <View style={s.coverDivider} />
      <Text style={s.coverMeta}>Prepared for {data.preparedFor}</Text>
      <Text style={s.coverMeta}>{fmtDate(data.generatedAt)}</Text>
      <Text style={s.coverMeta}>Proposal #{data.proposalNumber}</Text>
      <View style={s.coverFacts}>
        <View style={s.coverFact}>
          <Text style={s.coverFactValue}>{data.units || 'TBD'}</Text>
          <Text style={s.coverFactLabel}>Units</Text>
        </View>
        <View style={s.coverFact}>
          <Text style={s.coverFactValue}>{data.stories || 'TBD'}</Text>
          <Text style={s.coverFactLabel}>Stories</Text>
        </View>
        <View style={s.coverFact}>
          <Text style={s.coverFactValue}>{data.yearBuilt || 'TBD'}</Text>
          <Text style={s.coverFactLabel}>Year Built</Text>
        </View>
        <View style={s.coverFact}>
          <Text style={s.coverFactValue}>{data.buildingType.replace('-', ' ')}</Text>
          <Text style={s.coverFactLabel}>Property Type</Text>
        </View>
      </View>
      <Text style={s.coverMeta}>
        {data.borough ? `${data.borough}` : 'Borough to be confirmed'}
        {data.neighborhood ? ` | ${data.neighborhood}` : ''}
      </Text>
      <Text style={s.coverMeta}>
        Generated by {data.generatedBy}
        {data.sentTo ? ` | Recipient: ${data.sentTo}` : ''}
      </Text>
      <View style={s.coverFooter}>
        <Text style={s.coverFooterText}>
          {data.company.name} | {data.company.address}
        </Text>
        <Text style={s.coverFooterText}>
          {data.company.phone} | {data.company.website}
        </Text>
      </View>
    </Page>
  );
}

// ============================================================
// Executive Summary Page
// ============================================================

function CoverLetterPage({ data }: { data: ProposalData }) {
  const buildingLabel = data.buildingName || data.buildingAddress;
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader data={data} />
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Executive Cover Letter</Text>
        <Text style={s.sectionSubtitle}>Prepared for {data.preparedFor}</Text>
      </View>

      <Text style={s.body}>Dear {data.preparedFor},</Text>
      {data.coverLetterParagraphs && data.coverLetterParagraphs.length > 0 ? (
        data.coverLetterParagraphs.map((para, i) => (
          <Text key={i} style={s.body}>{para}</Text>
        ))
      ) : (
        <>
          <Text style={s.body}>
            Thank you for considering Camelot Property Management for {buildingLabel}. This
            proposal is intended to outline our management scope, recommended Intelligence
            package, transition process, fee structure, and Schedule A / ancillary fee menu.
          </Text>
          <Text style={s.body}>
            Our role is to give the property a practical operating partner: clean accounting,
            responsive maintenance coordination, disciplined vendor oversight, compliance
            tracking, board reporting, and a transition process that reduces confusion rather
            than creating more of it.
          </Text>
          <Text style={s.body}>
            We would welcome the opportunity to review the latest financials, budget,
            insurance summary, vendor list, and current management materials so the final
            management agreement can be priced around actual service needs and not guesswork.
          </Text>
        </>
      )}

      <DavidSignatureBlock />
      <PageFooter data={data} pageNum={2} />
    </Page>
  );
}

function ExecutiveSummaryPage({ data }: { data: ProposalData }) {
  const buildingLabel = data.buildingName || data.buildingAddress;
  const violationMsg =
    data.openViolationsCount > 0
      ? `With ${data.openViolationsCount} open HPD violations currently on record (${data.violationsCount} total), ${buildingLabel} faces regulatory pressure that requires experienced management to resolve efficiently.`
      : `${buildingLabel} maintains a clean violation record — and with Camelot's proactive compliance approach, we'll keep it that way.`;

  const energyMsg =
    data.energyStarScore != null && data.energyStarScore < 50
      ? `The building's Energy Star score of ${data.energyStarScore} signals potential Local Law 97 compliance risk. Our energy team can develop a carbon reduction strategy to avoid significant penalties beginning in 2024.`
      : data.energyStarScore != null
        ? `With an Energy Star score of ${data.energyStarScore}, the building is reasonably positioned for LL97 compliance, but ongoing monitoring is essential.`
        : '';

  const hasExplicitSelfManaged = /self[-\s]?managed/i.test(data.currentManagement || '');
  const hasVerifiedManagement = !!data.currentManagement && data.currentManagement !== 'Unknown' && !hasExplicitSelfManaged;
  const mgmtMsg =
    hasExplicitSelfManaged
      ? `Currently self-managed, ${buildingLabel} would benefit from professional oversight that brings institutional-grade systems while preserving the personal attention boards expect.`
      : hasVerifiedManagement
        ? `As the building evaluates management options, Camelot offers a seamless onboarding process refined over 42+ building transitions.`
        : `Jackie has not verified the current managing agent yet. Before any board-facing release, Camelot should confirm management through HPD MDR, ACRIS, DOB, PropertyShark, board materials, or the building website.`;

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader data={data} />
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Executive Summary</Text>
        <Text style={s.sectionSubtitle}>Why {buildingLabel} Deserves Camelot</Text>
      </View>

      <Text style={s.body}>
        Camelot Property Management is pleased to present this proposal for the management of{' '}
        {buildingLabel}, a {data.units}-unit {data.buildingType.replace('-', ' ')} property
        {data.borough ? ` in ${data.borough}` : ''}
        {data.yearBuilt ? `, built in ${data.yearBuilt}` : ''}.
      </Text>

      <Text style={s.body}>{violationMsg}</Text>

      {energyMsg ? <Text style={s.body}>{energyMsg}</Text> : null}

      <Text style={s.body}>{mgmtMsg}</Text>

      <Text style={s.body}>
        Our approach combines hands-on property oversight with cutting-edge technology,
        delivering the responsiveness of a boutique firm with the systems and scale of a
        full-service management company. We manage over {data.company.portfolio.buildings}{' '}
        buildings and {data.company.portfolio.sqft} sq ft — and every client receives direct
        principal-level attention.
      </Text>

      {data.signals.length > 0 && (
        <>
          <Text style={s.subHeader}>Key Observations</Text>
          {data.signals.map((signal, i) => (
            <View style={s.bulletRow} key={i}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>{signal}</Text>
            </View>
          ))}
        </>
      )}

      <PageFooter data={data} pageNum={3} />
    </Page>
  );
}

// ============================================================
// Building Analysis Page
// ============================================================

function BuildingAnalysisPage({ data }: { data: ProposalData }) {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader data={data} />
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Building Analysis</Text>
        <Text style={s.sectionSubtitle}>
          Data-Driven Assessment of {data.buildingName || data.buildingAddress}
        </Text>
      </View>

      {/* Property Overview */}
      <Text style={s.subHeader}>Property Overview</Text>
      <View>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Address</Text>
          <Text style={s.kvValue}>{data.buildingAddress}</Text>
        </View>
        {data.buildingName && (
          <View style={s.kvRow}>
            <Text style={s.kvLabel}>Building Name</Text>
            <Text style={s.kvValue}>{data.buildingName}</Text>
          </View>
        )}
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Type</Text>
          <Text style={s.kvValue}>{data.buildingType.replace('-', ' ')}</Text>
        </View>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Units</Text>
          <Text style={s.kvValue}>{data.units}</Text>
        </View>
        {data.yearBuilt && (
          <View style={s.kvRow}>
            <Text style={s.kvLabel}>Year Built</Text>
            <Text style={s.kvValue}>{data.yearBuilt}</Text>
          </View>
        )}
        {data.stories && (
          <View style={s.kvRow}>
            <Text style={s.kvLabel}>Stories</Text>
            <Text style={s.kvValue}>{data.stories}</Text>
          </View>
        )}
        {data.borough && (
          <View style={s.kvRow}>
            <Text style={s.kvLabel}>Borough / Neighborhood</Text>
            <Text style={s.kvValue}>
              {data.borough}
              {data.neighborhood ? ` — ${data.neighborhood}` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Violations Summary */}
      <Text style={s.subHeader}>HPD Violations</Text>
      <View style={s.row}>
        <View style={s.col50}>
          <View style={s.kvRow}>
            <Text style={s.kvLabel}>Total Violations</Text>
            <Text style={s.kvValue}>{data.violationsCount}</Text>
          </View>
          <View style={s.kvRow}>
            <Text style={s.kvLabel}>Open Violations</Text>
            <Text style={s.kvValue}>{data.openViolationsCount}</Text>
          </View>
        </View>
        <View style={s.col50}>
          {data.lastViolationDate && (
            <View style={s.kvRow}>
              <Text style={s.kvLabel}>Last Violation</Text>
              <Text style={s.kvValue}>{fmtDate(data.lastViolationDate)}</Text>
            </View>
          )}
          <View style={s.kvRow}>
            <Text style={s.kvLabel}>Scout Grade</Text>
            <Text style={s.kvValue}>
              {data.grade} (Score: {data.score}/100)
            </Text>
          </View>
        </View>
      </View>

      {/* Energy Compliance */}
      {(data.energyStarScore != null || data.siteEUI != null) && (
        <>
          <Text style={s.subHeader}>Energy & LL97 Compliance</Text>
          <View>
            {data.energyStarScore != null && (
              <View style={s.kvRow}>
                <Text style={s.kvLabel}>Energy Star Score</Text>
                <Text style={s.kvValue}>
                  {data.energyStarScore}/100
                  {data.energyStarScore < 50 ? ' — Below median, LL97 risk' : ''}
                </Text>
              </View>
            )}
            {data.siteEUI != null && (
              <View style={s.kvRow}>
                <Text style={s.kvLabel}>Site EUI</Text>
                <Text style={s.kvValue}>{data.siteEUI} kBtu/ft²</Text>
              </View>
            )}
            {data.ghgEmissions != null && (
              <View style={s.kvRow}>
                <Text style={s.kvLabel}>GHG Emissions</Text>
                <Text style={s.kvValue}>{data.ghgEmissions} metric tons CO₂e</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Ownership / Valuation */}
      {(data.dofOwner || data.marketValue) && (
        <>
          <Text style={s.subHeader}>Ownership & Valuation</Text>
          <View>
            {data.dofOwner && (
              <View style={s.kvRow}>
                <Text style={s.kvLabel}>DOF Owner</Text>
                <Text style={s.kvValue}>{data.dofOwner}</Text>
              </View>
            )}
            {data.marketValue && (
              <View style={s.kvRow}>
                <Text style={s.kvLabel}>Market Value</Text>
                <Text style={s.kvValue}>{fmtCurrency(data.marketValue)}</Text>
              </View>
            )}
            {data.assessedValue && (
              <View style={s.kvRow}>
                <Text style={s.kvLabel}>Assessed Value</Text>
                <Text style={s.kvValue}>{fmtCurrency(data.assessedValue)}</Text>
              </View>
            )}
          </View>
        </>
      )}

      {data.currentManagement && (
        <>
          <Text style={s.subHeader}>Current Management</Text>
          <Text style={s.body}>{data.currentManagement}</Text>
        </>
      )}

      <PageFooter data={data} pageNum={4} />
    </Page>
  );
}

// ============================================================
// Services & Pricing Page
// ============================================================

function ServicesPricingPage({ data }: { data: ProposalData }) {
  const { pricing } = data;

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader data={data} />
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Services & Pricing</Text>
        <Text style={s.sectionSubtitle}>Comprehensive Management for {data.units} Units</Text>
      </View>

      {/* Standard Services Table */}
      <Text style={s.subHeader}>Standard Services (Included)</Text>
      <View style={s.tableHeader}>
        <Text style={{ ...s.tableHeaderCell, width: '35%' }}>Service</Text>
        <Text style={{ ...s.tableHeaderCell, width: '65%' }}>Description</Text>
      </View>
      {data.standardServices.map((svc, i) => (
        <View style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} key={i}>
          <Text style={{ ...s.tableCell, width: '35%', fontFamily: 'Helvetica-Bold' }}>
            {svc.name}
          </Text>
          <Text style={{ ...s.tableCell, width: '65%' }}>{svc.description}</Text>
        </View>
      ))}

      {/* Premium Services */}
      <Text style={{ ...s.subHeader, marginTop: 18 }}>Premium Services</Text>
      <View style={s.tableHeader}>
        <Text style={{ ...s.tableHeaderCell, width: '35%' }}>Service</Text>
        <Text style={{ ...s.tableHeaderCell, width: '50%' }}>Description</Text>
        <Text style={{ ...s.tableHeaderCell, width: '15%', textAlign: 'center' }}>Included</Text>
      </View>
      {data.premiumServices.map((svc, i) => (
        <View style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} key={i}>
          <Text style={{ ...s.tableCell, width: '35%', fontFamily: 'Helvetica-Bold' }}>
            {svc.name}
          </Text>
          <Text style={{ ...s.tableCell, width: '50%' }}>{svc.description}</Text>
          <Text style={{ ...s.tableCell, width: '15%', textAlign: 'center' }}>
            {svc.included ? '✓' : '—'}
          </Text>
        </View>
      ))}

      {/* Pricing Breakdown */}
      <View style={{ ...s.highlight, marginTop: 18 }}>
        <Text style={s.highlightTitle}>Recommended Management Package</Text>
        <Text style={{ ...s.body, fontFamily: 'Helvetica-Bold', color: NAVY }}>
          {pricing.packageName}
        </Text>
        <View style={s.pricingRow}>
          <Text style={s.pricingLabel}>
            Base Management ({pricing.baseRateLabel})
          </Text>
          <Text style={s.pricingValue}>{fmtCurrency(pricing.baseRate)}/unit/mo</Text>
        </View>
        {pricing.rentStabilizedSurcharge > 0 && (
          <View style={s.pricingRow}>
            <Text style={s.pricingLabel}>Rent Stabilization Admin</Text>
            <Text style={s.pricingValue}>
              +{fmtCurrency(pricing.rentStabilizedSurcharge)}/unit/mo
            </Text>
          </View>
        )}
        {pricing.ll97Surcharge > 0 && (
          <View style={s.pricingRow}>
            <Text style={s.pricingLabel}>LL97 Compliance Services</Text>
            <Text style={s.pricingValue}>+{fmtCurrency(pricing.ll97Surcharge)}/unit/mo</Text>
          </View>
        )}
        <View style={s.pricingRow}>
          <Text style={s.pricingLabel}>
            Total Per Unit ({data.units} units)
          </Text>
          <Text style={s.pricingValue}>{fmtCurrency(pricing.totalPerUnit)}/unit/mo</Text>
        </View>
        <View style={s.pricingRow}>
          <Text style={s.pricingLabel}>Monthly Total</Text>
          <Text style={{ ...s.pricingValue, textDecoration: 'underline' }}>
            {fmtCurrency(pricing.totalMonthly)}
          </Text>
        </View>
        <View style={s.pricingTotal}>
          <Text style={s.pricingTotalLabel}>Annual Total</Text>
          <Text style={{ ...s.pricingTotalValue, textDecoration: 'underline' }}>
            {fmtCurrency(pricing.totalAnnual)}
          </Text>
        </View>
      </View>

      <Text style={s.bodySmall}>
        The Intelligence package is the recommended starting point because today's market
        requires automation, clean reporting, board minutes, banking visibility, compliance
        tracking, and resident communication support. Classic or Premier service can be
        discussed if the board wants a lighter or deeper scope. Schedule A / ancillary fees are
        outlined on the next page and tailored by property type in the final management
        agreement. Final rates may be adjusted after document review and on-site assessment.
      </Text>

      <PageFooter data={data} pageNum={5} />
    </Page>
  );
}

// ============================================================
// Schedule A / Ancillary Fees Page
// ============================================================

function AncillaryFeesPage({ data }: { data: ProposalData }) {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader data={data} />
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Schedule A / Ancillary Fees</Text>
        <Text style={s.sectionSubtitle}>
          Association-level and individual/unit-level charges for final agreement review
        </Text>
      </View>

      <Text style={s.body}>
        The base management fee covers recurring monthly management. Schedule A keeps other
        work transparent by separating building-level expenses from charges usually paid by an
        applicant, shareholder, unit owner, tenant, or requesting party.
      </Text>

      <Text style={s.subHeader}>Association / Building-Level Fees</Text>
      <View style={s.tableHeader}>
        <Text style={{ ...s.tableHeaderCell, width: '34%' }}>Service</Text>
        <Text style={{ ...s.tableHeaderCell, width: '18%' }}>Fee</Text>
        <Text style={{ ...s.tableHeaderCell, width: '48%' }}>Notes</Text>
      </View>
      {data.associationAncillaryFees.slice(0, 10).map((item, i) => (
        <View style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} key={item.service}>
          <Text style={{ ...s.tableCell, width: '34%', fontFamily: 'Helvetica-Bold' }}>
            {item.service}
          </Text>
          <Text style={{ ...s.tableCell, width: '18%', fontFamily: 'Helvetica-Bold', color: NAVY }}>
            {item.fee}
          </Text>
          <Text style={{ ...s.tableCell, width: '48%' }}>{item.notes}</Text>
        </View>
      ))}

      <Text style={{ ...s.subHeader, marginTop: 16 }}>
        Individual / Applicant / Unit-Level Fees
      </Text>
      <View style={s.tableHeader}>
        <Text style={{ ...s.tableHeaderCell, width: '34%' }}>Service</Text>
        <Text style={{ ...s.tableHeaderCell, width: '18%' }}>Fee</Text>
        <Text style={{ ...s.tableHeaderCell, width: '48%' }}>Notes</Text>
      </View>
      {data.individualAncillaryFees.slice(0, 8).map((item, i) => (
        <View style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} key={item.service}>
          <Text style={{ ...s.tableCell, width: '34%', fontFamily: 'Helvetica-Bold' }}>
            {item.service}
          </Text>
          <Text style={{ ...s.tableCell, width: '18%', fontFamily: 'Helvetica-Bold', color: NAVY }}>
            {item.fee}
          </Text>
          <Text style={{ ...s.tableCell, width: '48%' }}>{item.notes}</Text>
        </View>
      ))}

      <Text style={{ ...s.bodySmall, marginTop: 10 }}>
        Advisory review by Camelot's accounting, legal, engineering, brokerage, banking, or
        compliance partners is distinct from a formal engagement. Any formal professional service,
        filing, tax return, legal matter, engineering scope, refinancing assignment, or capital
        project is separately approved before work begins.
      </Text>

      <PageFooter data={data} pageNum={6} />
    </Page>
  );
}

// ============================================================
// Why Camelot Page
// ============================================================

function WhyCamelotPage({ data }: { data: ProposalData }) {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader data={data} />
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Why Camelot</Text>
        <Text style={s.sectionSubtitle}>
          Trusted by {data.company.portfolio.buildings} Buildings Across NYC
        </Text>
      </View>

      <Text style={s.body}>
        Camelot Property Management combines institutional-grade systems with the personalized
        service of a boutique firm. Here's what sets us apart:
      </Text>

      {data.advantages.map((adv, i) => (
        <View style={s.advantageItem} key={i}>
          <Text style={s.advantageTitle}>
            {i + 1}. {adv.title}
          </Text>
          <Text style={s.advantageDesc}>{adv.description}</Text>
        </View>
      ))}

      <View style={{ ...s.highlight, marginTop: 10 }}>
        <Text style={s.highlightTitle}>By the Numbers</Text>
        <View style={s.row}>
          <View style={s.col50}>
            <View style={s.bulletRow}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>
                {data.company.portfolio.buildings} buildings under management
              </Text>
            </View>
            <View style={s.bulletRow}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>
                {data.company.portfolio.sqft} sq ft managed
              </Text>
            </View>
            <View style={s.bulletRow}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>All five boroughs covered</Text>
            </View>
          </View>
          <View style={s.col50}>
            <View style={s.bulletRow}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>98% board renewal rate</Text>
            </View>
            <View style={s.bulletRow}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>Average 15% operating cost reduction</Text>
            </View>
            <View style={s.bulletRow}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>24/7 emergency response</Text>
            </View>
          </View>
        </View>
      </View>

      <PageFooter data={data} pageNum={7} />
    </Page>
  );
}

// ============================================================
// Next Steps & Contact Page
// ============================================================

function TransitionPlanPage({ data }: { data: ProposalData }) {
  const steps = [
    ['Days 1-5', 'Document intake and control', 'Collect governing documents, owner records, arrears, vendor files, insurance, mortgage statements, prior reports, compliance files, and bank setup needs.'],
    ['Days 6-10', 'Financial baseline', 'Review cash position, recurring payables, budget, arrears, mortgage obligations, tax exposure, insurance cost, and operating pressure points.'],
    ['Days 11-15', 'Building walkthrough', 'Inspect common areas and building systems where accessible, review staffing/superintendent coverage, vendor quality, emergency protocols, and open repair priorities.'],
    ['Days 16-20', 'Board communication setup', 'Set monthly reporting cadence, AP approval flow, maintenance request workflow, resident/shareholder communication channel, and board meeting rhythm.'],
    ['Days 21-30', 'Transition findings', 'Deliver a first-month transition memo with compliance calendar, staffing recommendation, vendor recommendations, budget flags, and 60/90-day priorities.'],
  ];

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader data={data} />
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Transition & Implementation</Text>
        <Text style={s.sectionSubtitle}>First 30 days, then 90-day stabilization</Text>
      </View>
      <Text style={s.body}>
        Camelot treats transition as a controlled operating handoff. Within the first 30
        days, our objective is to take control of records, finances, vendors, reporting,
        resident communication, and time-sensitive compliance items without overwhelming the
        board or the building.
      </Text>
      {steps.map(([range, title, desc]) => (
        <View style={s.bulletRow} key={range}>
          <Text style={s.bulletDot}>-</Text>
          <Text style={s.bulletText}>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: NAVY }}>{range}: {title}. </Text>
            {desc}
          </Text>
        </View>
      ))}
      <Text style={s.subHeader}>Meet & Greet</Text>
      <Text style={s.body}>
        During the first 30 days, Camelot recommends a board and resident/shareholder meet
        and greet, either on-site or over Zoom. Accounting, compliance, administration, and
        the property management team can join so the community can put a face to the email.
      </Text>
      <Text style={s.subHeader}>90-Day Stabilization</Text>
      <Text style={s.body}>
        The 90-day period focuses on vendor review, insurance review, budget review,
        compliance calendar, staffing recommendation, arrears review, and refinancing or
        lender coordination where applicable.
      </Text>
      <PageFooter data={data} pageNum={8} />
    </Page>
  );
}

function NextStepsPage({ data }: { data: ProposalData }) {
  const steps = [
    {
      step: '1',
      title: 'Introductory Meeting',
      desc: 'We schedule a call or in-person meeting to discuss your building\'s needs, concerns, and goals.',
    },
    {
      step: '2',
      title: 'Property Walkthrough',
      desc: 'Our team conducts a comprehensive on-site inspection, reviewing physical conditions, systems, staffing, and vendor contracts.',
    },
    {
      step: '3',
      title: 'Detailed Proposal',
      desc: 'Based on our assessment, we present a customized management plan with finalized pricing and transition timeline.',
    },
    {
      step: '4',
      title: 'Board Presentation',
      desc: 'We present our proposal to the full board, answering questions and addressing any concerns.',
    },
    {
      step: '5',
      title: 'Seamless Transition',
      desc: 'Our dedicated onboarding team manages the transition — typically completed within 30–45 days with zero disruption to residents.',
    },
  ];

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader data={data} />
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Next Steps</Text>
        <Text style={s.sectionSubtitle}>Getting Started with Camelot</Text>
      </View>

      {steps.map((item) => (
        <View style={{ flexDirection: 'row', marginBottom: 12 }} key={item.step}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: GOLD,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
              marginTop: 2,
            }}
          >
            <Text
              style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: NAVY, textAlign: 'center' }}
            >
              {item.step}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 2 }}>
              {item.title}
            </Text>
            <Text style={s.body}>{item.desc}</Text>
          </View>
        </View>
      ))}

      {/* Contact Information */}
      <View style={{ ...s.highlight, marginTop: 16 }}>
        <Text style={s.highlightTitle}>Contact Us</Text>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Company</Text>
          <Text style={s.kvValue}>{data.company.name}</Text>
        </View>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Address</Text>
          <Text style={s.kvValue}>{data.company.address}</Text>
        </View>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Phone</Text>
          <Text style={s.kvValue}>{data.company.phone}</Text>
        </View>
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Website</Text>
          <Text style={s.kvValue}>{data.company.website}</Text>
        </View>
      </View>

      {/* License Info */}
      <View style={{ marginTop: 16 }}>
        <Text style={s.bodySmall}>Licensed Entities:</Text>
        {data.company.licenses.map((lic, i) => (
          <Text style={s.bodySmall} key={i}>
            {lic.entity} — {lic.number}
          </Text>
        ))}
      </View>

      <Text style={{ ...s.bodySmall, marginTop: 12, textAlign: 'center' }}>
        This proposal is confidential and intended solely for the recipient. Pricing is
        subject to on-site assessment. Valid for 60 days from date of issue. Internal reference:
        {` ${data.proposalNumber}`} generated {fmtDate(data.generatedAt)} by {data.generatedBy}.
      </Text>

      <DavidSignatureBlock />

      <PageFooter data={data} pageNum={9} />
    </Page>
  );
}

// ============================================================
// Main Document
// ============================================================

interface ProposalPDFProps {
  data: ProposalData;
}

export default function ProposalPDF({ data }: ProposalPDFProps) {
  return (
    <Document
      title={`Camelot Proposal — ${data.buildingAddress}`}
      author={data.company.name}
      subject="Property Management Proposal"
    >
      <CoverPage data={data} />
      <CoverLetterPage data={data} />
      {sectionEnabled(data, 'executive_summary') && <ExecutiveSummaryPage data={data} />}
      {sectionEnabled(data, 'building_analysis') && <BuildingAnalysisPage data={data} />}
      {sectionEnabled(data, 'pricing') && <ServicesPricingPage data={data} />}
      {sectionEnabled(data, 'ancillary_fees') && <AncillaryFeesPage data={data} />}
      {sectionEnabled(data, 'why_camelot') && <WhyCamelotPage data={data} />}
      <TransitionPlanPage data={data} />
      {sectionEnabled(data, 'next_steps') && <NextStepsPage data={data} />}
    </Document>
  );
}
