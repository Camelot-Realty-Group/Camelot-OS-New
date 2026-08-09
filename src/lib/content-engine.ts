export type ContentChannel =
  | 'Blog'
  | 'Facebook'
  | 'LinkedIn'
  | 'Instagram'
  | 'X'
  | 'Email'
  | 'YouTube'
  | 'Short Video';

export type ContentStatus = 'draft' | 'pending_review' | 'approved' | 'scheduled' | 'published' | 'failed' | 'stale';

export type ContentAudience = 'Boards' | 'Developers' | 'Investors' | 'Residents' | 'General';

export type ContentModule = {
  id: string;
  name: string;
  schedule: string;
  objective: string;
  workflow: string[];
  outputs: string[];
  safetyGate: string;
};

export type CtaPlan = {
  contentType: string;
  primary: string;
  secondary: string;
};

export type DatabaseTableSpec = {
  table: string;
  purpose: string;
  fields: string[];
};

export type ContentItem = {
  id: string;
  title: string;
  channel: ContentChannel;
  contentType: string;
  audience: ContentAudience;
  status: ContentStatus;
  scheduledAt: string;
  seoKeyword?: string;
  excerpt: string;
  body: string;
  cta: string;
  safetyFlags: string[];
  platformUrl?: string;
  score: number;
};

export type IntegrationSpec = {
  name: string;
  purpose: string;
  auth: string;
  status: 'ready_for_credentials' | 'planned' | 'manual_first' | 'connected';
};

export type CadenceRow = {
  day: string;
  blog: string;
  facebook: string;
  linkedin: string;
  instagram: string;
  x: string;
  email: string;
  video: string;
};

export const CAMELOT_CONTENT_RULES = {
  company: 'Camelot Property Management',
  website: 'www.camelot.nyc',
  office: '57 West 57th Street, 4th Floor, New York, NY 10019',
  principal: 'David A. Goldoff, President & Founder',
  emails: ['dgoldoff@camelot.nyc', 'info@camelot.nyc'],
  phone: '(212) 206-9939',
  officeExtension: '701',
  forbidden: [
    'David personal cell phone number',
    'specific client financials unless explicitly approved',
    'negative competitor mentions by name',
    'political commentary',
    'guarantees of specific outcomes',
    'legal advice without attorney-consult caveat',
  ],
  required: [
    'Human approval before publishing',
    'Brand-safe content filter before review queue',
    'CTA to info@camelot.nyc or (212) 206-9939',
    'NYC-specific context for NYC topics',
    'Audit trail for approval, scheduling, publishing, and failure events',
  ],
};

export const CAMELOT_BRAND_SYSTEM = {
  colors: [
    { name: 'Primary Gold', hex: '#DBBA2E', usage: 'Accents, CTAs, highlights' },
    { name: 'Secondary Gold', hex: '#C8A84B', usage: 'Buttons and amber tone' },
    { name: 'Tertiary Gold', hex: '#B99425', usage: 'Deep gold accents' },
    { name: 'Deep Navy-Black', hex: '#0D0D1A', usage: 'Headers, footers, dark backgrounds' },
    { name: 'Dark Overlay', hex: '#313437', usage: 'Hero image overlays' },
    { name: 'Background Cream', hex: '#F5F5F0', usage: 'Page backgrounds' },
  ],
  fonts: ['Raleway headlines', 'Open Sans body', 'Cardo editorial serif'],
  positioning:
    'Hybrid proptech plus experienced building agents. Camelot thinks like an owner, operates like an owner, and brings acquisition, finance, value-add operations, brokerage, mortgage, and property management disciplines under one roof.',
};

export const CONTENT_RECIPIENTS = [
  { name: 'David A. Goldoff', role: 'Final approver', email: 'dgoldoff@camelot.nyc', note: 'Approval required before publishing' },
  { name: 'Beth Goldoff', role: 'Co-recipient', email: 'bethgoldoff@me.com', note: 'Prefer links over attachments; 20MB limit' },
  { name: 'Sam Lodge', role: 'Executive Office Manager and Operations', email: 'sam@camelot.nyc', note: 'Manual LinkedIn company page and Facebook posting' },
  { name: 'Valerie Anne Fiume', role: 'Director of Co-ops and Condo Management', email: 'info@camelot.nyc', note: 'Management context and review' },
];

export const CONTENT_MODULES: ContentModule[] = [
  {
    id: 'seo-gbp-engine',
    name: 'SEO and Google Business Profile Content Engine',
    schedule: 'Weekly, Wednesday 9:00 AM ET',
    objective: 'Create long-form SEO articles, GBP posts, X copy, real-image sourcing, charts, WordPress drafts, Google Docs, and approval emails.',
    workflow: [
      'Research 5-8 high-intent non-branded keywords and dedupe against the last 4 weeks',
      'Scan competitor content and identify gaps',
      'Research timely NYC regulatory, market, investment, labor, insurance, and people-first angles',
      'Draft 2,000-3,000 word investigative/editorial article with source attribution',
      'Use subliminal Camelot positioning only; no dedicated How Camelot Handles This section',
      'Source real images first and label AI fallback as illustration',
      'Generate charts when quantitative claims are used',
      'Prepare GBP posts, X posts, SEO HTML, Google Doc, and WordPress draft attempt',
      'Email branded approval package to recipients',
    ],
    outputs: ['Blog article', '3 GBP posts', '2-3 X posts', 'SEO HTML', 'Google Doc', 'WordPress draft', 'Strategy notes'],
    safetyGate: 'No post goes public until David approves by email or manual dashboard action.',
  },
  {
    id: 'linkedin-drafter',
    name: 'LinkedIn Content Drafter',
    schedule: 'Weekly, Friday 9:00 AM ET',
    objective: 'Create David personal-profile posts plus company/Facebook copy for Sam.',
    workflow: [
      'Research 3-5 timely NYC property management topics',
      'Dedupe against the last 28 days',
      'Draft hot take, case study/story, and educational/value posts',
      'Include monthly resident manager/building worker spotlight',
      'Source real images first and generate approval-ready email',
    ],
    outputs: ['3 LinkedIn posts', '1 long-form article outline', 'Sam copy/paste package', 'Strategic cadence notes'],
    safetyGate: 'Approved posts only. Company page and Facebook remain manual-paste unless credentialed backend is enabled.',
  },
  {
    id: 'distribution',
    name: 'Content Distribution Engine',
    schedule: 'Twice weekly, Wednesday and Friday 2:00 PM ET',
    objective: 'Read approvals, publish approved items, send manual-paste packages, and track engagement.',
    workflow: [
      'Scan Gmail approvals from dgoldoff@camelot.nyc',
      'Parse approve all, approved, or specific item numbers',
      'Publish approved LinkedIn personal posts where OAuth is connected',
      'Format X posts for Buffer or dlvr.it copy/paste unless paid API is enabled',
      'Email Facebook and LinkedIn company page package to Sam',
      'Send publish confirmations and collect 30-day engagement metrics',
    ],
    outputs: ['Live post links', 'Manual paste email', 'Publish confirmation', 'Weekly engagement report'],
    safetyGate: 'If no approval exists, the job finishes quietly and publishes nothing.',
  },
  {
    id: 'dashboard',
    name: 'Content Dashboard',
    schedule: 'Daily, 10:00 AM ET',
    objective: 'Show calendar, keyword tracker, inventory, deduplication view, run history, and content gaps.',
    workflow: [
      'Sync SEO and LinkedIn content records',
      'Update Google Sheet dashboard',
      'Calculate content inventory by type',
      'Surface unused keywords and topic gaps',
      'Email summary to recipients',
    ],
    outputs: ['Google Sheet dashboard', 'Summary email', 'Keyword tracker', 'Run history'],
    safetyGate: 'Dashboard can report automatically but cannot publish content.',
  },
  {
    id: 'cold-calling',
    name: 'Cold Calling and Outreach',
    schedule: 'Configurable lead batch runs',
    objective: 'Generate building leads, enrich contacts, tailor scripts, log calls, and create follow-up sequences.',
    workflow: [
      'Pull leads from DOB, HPD violations, building registrations, ACRIS transfers, and manual lists',
      'Enrich board contacts, management company records, unit counts, and lead triggers',
      'Generate scripts tied to the building situation',
      'Log call outcomes and next follow-up',
      'Push qualified leads toward HubSpot/AppFolio workflow when connected',
    ],
    outputs: ['Lead list', 'Contact enrichment', 'Call scripts', 'Follow-up emails', 'CRM log'],
    safetyGate: 'Outreach must be reviewed before sending and must avoid misleading compliance claims.',
  },
  {
    id: 'cta-plans',
    name: 'Call-to-Action Plans',
    schedule: 'Runs inside content generation',
    objective: 'Match CTAs to content type without exposing prohibited phone numbers or overpromising.',
    workflow: [
      'Classify content type',
      'Attach primary and secondary CTA',
      'Verify approved office phone and email only',
      'Check no dedicated hard-sell section was added',
    ],
    outputs: ['CTA block', 'Email footer', 'Meeting link copy', 'Compliance caveat where needed'],
    safetyGate: 'CTA must use approved Camelot office contact only.',
  },
];

export const CTA_PLANS: CtaPlan[] = [
  { contentType: 'Compliance articles: LL97, FISP, LL31', primary: 'Schedule a compliance audit', secondary: 'Email dgoldoff@camelot.nyc' },
  { contentType: 'Crisis or case study', primary: 'Is your building prepared?', secondary: 'Call (212) 206-9939' },
  { contentType: 'Foreign investor content', primary: 'Partner with a local operator', secondary: 'Schedule a Google Meet' },
  { contentType: 'Private equity consolidation', primary: 'Experience owner-operated management', secondary: 'Email info@camelot.nyc' },
  { contentType: 'FARE Act or leasing', primary: 'Talk to Camelot Brokerage Services Corp.', secondary: 'Visit www.camelot.nyc' },
  { contentType: 'Resident manager content', primary: 'Invest in your building team', secondary: 'Learn about Camelot management' },
];

export const DATABASE_TABLES: DatabaseTableSpec[] = [
  { table: 'content', purpose: 'Master content library, source links, SEO fields, images, approval state, publishing state, and positioning notes.', fields: ['content_type', 'title', 'body', 'keywords_targeted', 'source_urls', 'images', 'doc_url', 'wp_draft_url', 'status', 'target_audience'] },
  { table: 'keywords', purpose: 'Persistent keyword tracker and 4-week deduplication guard.', fields: ['keyword', 'intent_level', 'suggested_topic', 'target_audience', 'times_used', 'last_used_at'] },
  { table: 'distributed_posts', purpose: 'Published platform records and live URLs.', fields: ['post_id', 'content_id', 'platform', 'platform_post_id', 'post_url', 'posted_at', 'status', 'error'] },
  { table: 'engagement_metrics', purpose: 'Cross-platform analytics history.', fields: ['post_id', 'platform', 'checked_at', 'impressions', 'clicks', 'likes', 'comments', 'shares'] },
  { table: 'approvals', purpose: 'Approval audit trail.', fields: ['content_id', 'approval_source', 'approved_by', 'approved_at', 'approved_items', 'status'] },
  { table: 'leads', purpose: 'Cold calling and outreach queue.', fields: ['building_address', 'board_contact_name', 'current_management_company', 'lead_source', 'lead_trigger', 'outreach_script', 'status'] },
  { table: 'run_log', purpose: 'Module execution history.', fields: ['module', 'run_date', 'status', 'content_produced', 'posts_published', 'leads_generated', 'credits_consumed'] },
];

export const CONTENT_THEMES = [
  'Compliance and regulatory: LL97, FISP, LL31, LL84, HPD enforcement, RGB votes, FARE Act',
  'Market and economics: insurance rates, building costs, labor, 32BJ, rent trends',
  'Foreign investment: Japanese, Korean, Middle Eastern, European, Singaporean, Canadian capital',
  'Private equity consolidation and rise of independent owner-operators',
  'People and culture: resident managers, building workers, professional development',
  'Crisis management and recovery case studies',
  'Brokerage and leasing through Camelot Brokerage Services Corp.',
  'Technology and proptech: AI automation plus experienced building agents',
];

export const CONTENT_INTEGRATIONS: IntegrationSpec[] = [
  { name: 'WordPress REST API', purpose: 'Publish blog articles to camelot.nyc', auth: 'Application Password', status: 'ready_for_credentials' },
  { name: 'Facebook Graph API', purpose: 'Post to Camelot Business Page', auth: 'Page Access Token', status: 'planned' },
  { name: 'LinkedIn Marketing API', purpose: 'Post to company and David profile', auth: 'OAuth 2.0', status: 'planned' },
  { name: 'Instagram Graph API', purpose: 'Publish photos, reels, and stories', auth: 'Facebook Business Token', status: 'planned' },
  { name: 'X API v2', purpose: 'Publish short market commentary', auth: 'OAuth 2.0', status: 'manual_first' },
  { name: 'Mailchimp Marketing API', purpose: 'Newsletter and drip campaigns', auth: 'API key', status: 'planned' },
  { name: 'YouTube Data API v3', purpose: 'Upload videos and metadata', auth: 'OAuth 2.0', status: 'planned' },
  { name: 'TikTok Content Posting API', purpose: 'Publish short video', auth: 'OAuth 2.0', status: 'planned' },
  { name: 'Google Analytics 4', purpose: 'Pull traffic and conversion analytics', auth: 'Service account', status: 'planned' },
  { name: 'OpenAI API', purpose: 'Generate drafts, repurpose content, and score safety', auth: 'API key', status: 'ready_for_credentials' },
  { name: 'SEMrush / Ahrefs', purpose: 'Keyword research and rank tracking', auth: 'API key', status: 'planned' },
  { name: 'Gmail', purpose: 'Read approval replies and send approval packages', auth: 'Connector / OAuth', status: 'planned' },
  { name: 'Google Sheets', purpose: 'Keyword tracker and content dashboard spreadsheet', auth: 'Connector / OAuth', status: 'planned' },
  { name: 'HubSpot', purpose: 'Cold calling lead handoff and CRM logging', auth: 'API key / OAuth', status: 'planned' },
  { name: 'AppFolio / MDS / SiteCompli', purpose: 'Future operational context for property content and outreach', auth: 'Vendor-specific', status: 'manual_first' },
];

export const CONTENT_CADENCE: CadenceRow[] = [
  { day: 'Monday', blog: 'Publish', facebook: 'Share article', linkedin: 'Thought leadership', instagram: 'Infographic', x: '2 posts', email: '-', video: '-' },
  { day: 'Tuesday', blog: '-', facebook: 'Community post', linkedin: '-', instagram: 'Property photo', x: '1 post', email: '-', video: '-' },
  { day: 'Wednesday', blog: 'Publish', facebook: 'Share article', linkedin: 'Market insight', instagram: 'Reel / Story', x: '2 posts', email: '-', video: 'Upload' },
  { day: 'Thursday', blog: '-', facebook: 'Testimonial', linkedin: 'Team spotlight', instagram: 'Behind scenes', x: '1 post', email: '-', video: '-' },
  { day: 'Friday', blog: 'Publish', facebook: 'Share article', linkedin: 'Industry news', instagram: 'Neighborhood', x: '2 posts', email: 'Monthly', video: '-' },
];

export const CONTENT_LIBRARY: ContentItem[] = [
  {
    id: 'market-pe-consolidation',
    title: 'The Great NYC Property Management Shakeup',
    channel: 'Blog',
    contentType: 'Market Insight',
    audience: 'Boards',
    status: 'pending_review',
    scheduledAt: nextDate(1, 10),
    seoKeyword: 'private equity property management NYC',
    excerpt: 'A board-facing article explaining how consolidation changes service quality, response time, and accountability.',
    body: 'Private equity consolidation is changing the way many NYC buildings experience property management. Camelot can use this piece to explain why direct senior attention, clean reporting, and local accountability matter to boards evaluating their options.',
    cta: 'Email info@camelot.nyc or request a quote at https://www.camelot.nyc/get-a-quote/.',
    safetyFlags: ['No competitor names', 'No personal cell', 'CTA verified'],
    score: 91,
  },
  {
    id: 'newsletter-camelot-report',
    title: 'The Camelot Report: Monthly Board Brief',
    channel: 'Email',
    contentType: 'Newsletter',
    audience: 'Boards',
    status: 'draft',
    scheduledAt: nextDate(4, 9),
    seoKeyword: 'NYC property management newsletter',
    excerpt: 'Monthly email template for boards: market updates, compliance reminders, and Camelot operating notes.',
    body: 'This newsletter gives board members a concise read on local market conditions, compliance deadlines, recent Camelot insights, and one practical management tip they can use immediately.',
    cta: 'Email info@camelot.nyc or request a quote at https://www.camelot.nyc/get-a-quote/.',
    safetyFlags: ['Unsubscribe required before sending', 'No resident data', 'Office phone only'],
    score: 86,
  },
  {
    id: 'linkedin-reserve-funds',
    title: 'What Boards Should Know About Reserve Planning',
    channel: 'LinkedIn',
    contentType: 'Thought Leadership',
    audience: 'Boards',
    status: 'approved',
    scheduledAt: nextDate(2, 14),
    seoKeyword: 'condo reserve planning NYC',
    excerpt: 'A 200-word LinkedIn post about reserve discipline, capital planning, and avoiding emergency assessments.',
    body: 'Reserve planning is not just accounting. It is governance, asset preservation, and resident trust. Camelot can position this post around proactive capital planning and transparent reporting.',
    cta: 'Request a quote at https://www.camelot.nyc/get-a-quote/ or email info@camelot.nyc.',
    safetyFlags: ['Under 3 hashtags', 'No guarantees', 'No legal advice'],
    score: 89,
  },
  {
    id: 'instagram-neighborhood',
    title: 'New York Company for New York Buildings',
    channel: 'Instagram',
    contentType: 'Neighborhood Spotlight',
    audience: 'General',
    status: 'scheduled',
    scheduledAt: nextDate(3, 11),
    excerpt: 'A photo-led post showing Camelot as a local operator with neighborhood familiarity.',
    body: 'Use neighborhood imagery, a concise caption, and a warm Camelot voice to reinforce that Camelot is a local team serving local buildings.',
    cta: 'Request a quote at https://www.camelot.nyc/get-a-quote/ or email info@camelot.nyc.',
    safetyFlags: ['Image rights review required', 'Hashtags limited', 'No personal cell'],
    score: 82,
  },
];

export const CONTENT_ENGINE_PROMPT = `
CamelotOS Marketing and Content Automation Module

Build a modular marketing, editorial, content posting, SEO, distribution, cold calling, and engagement analysis system for Camelot Property Management.

Modules: SEO and GBP Content Engine, LinkedIn Content Drafter, Content Distribution Engine, Content Dashboard, Cold Calling and Outreach, and Call-to-Action Plans.

Channels: WordPress, Google Business Profile, Facebook, LinkedIn, Instagram, X/Buffer, Mailchimp/email, YouTube, TikTok/Reels, Google Docs, Google Sheets, Gmail approvals, HubSpot/AppFolio lead handoff.

Primary audiences: condo boards, co-op boards, landlords, developers, family offices, private equity firms, foreign investors, public adjusters, litigators, construction professionals, engineering professionals, and current/prospective residents.

Content style: NYT investigative/editorial for long-form articles. No dedicated "How Camelot Handles This" section. Use natural Camelot positioning throughout: proptech, experienced agents, compliance expertise, owner-operator thinking, co-investment mindset, and being New Yorkers serving New York buildings.

Image rule: use real source images first with attribution. AI fallback must be labeled "Illustration: Camelot Property Management".

Required CTA: info@camelot.nyc or https://www.camelot.nyc/get-a-quote/. Never include David's personal cell phone number.

Workflow: Generated -> Pending Review -> Approved -> Scheduled -> Published -> Analytics. No auto-publish.
`.trim();

export function buildContentExport(items: ContentItem[] = CONTENT_LIBRARY) {
  return JSON.stringify(
    {
      rules: CAMELOT_CONTENT_RULES,
      brand: CAMELOT_BRAND_SYSTEM,
      recipients: CONTENT_RECIPIENTS,
      modules: CONTENT_MODULES,
      ctaPlans: CTA_PLANS,
      databaseTables: DATABASE_TABLES,
      themes: CONTENT_THEMES,
      cadence: CONTENT_CADENCE,
      integrations: CONTENT_INTEGRATIONS,
      content: items,
    },
    null,
    2
  );
}

function nextDate(daysFromNow: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
