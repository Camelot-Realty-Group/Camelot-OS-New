/**
 * welcome-home.ts — data + persistence for the "Welcome Home" feature.
 *
 * "Welcome Home" is Camelot's reusable single-property pitch-microsite
 * pattern (first built for Oak Park at Douglaston, then 382 Lafayette
 * Street). This module tracks:
 *   1. The registry of live Welcome Home microsites already built.
 *   2. New-property intake requests submitted from the dashboard, logged
 *      to Supabase (table: welcome_home_requests) so nothing gets lost
 *      between a referral coming in and a site actually getting built.
 *
 * Grounding: Camelot Realty Group (Camelot Property Management Services
 * Corp.) was founded in 2006 — confirmed via camelot.nyc and prior source
 * review this session. "Welcome Home" itself is a new initiative launched
 * in 2026 by David A. Goldoff; the two dates are not in conflict.
 */
import { supabase, isSupabaseConfigured } from './supabase';

export interface WelcomeHomeSite {
  address: string;
  neighborhood: string;
  route: string;
  launchedLabel: string;
}

/** Registry of Welcome Home microsites already live. Update when a new one ships. */
export const WELCOME_HOME_SITES: WelcomeHomeSite[] = [
  {
    address: '382 Lafayette Street',
    neighborhood: 'NoHo, Manhattan',
    route: '/pitch/382-lafayette-street',
    launchedLabel: 'Live',
  },
  {
    address: 'Oak Park at Douglaston',
    neighborhood: 'Douglaston, Queens',
    route: '/pitch/oak-park-douglaston',
    launchedLabel: 'Live',
  },
];

export type ReferralSource = 'Board referral' | 'Website inquiry' | 'Broker' | 'Attorney / accountant' | 'Other';

export const REFERRAL_SOURCES: ReferralSource[] = [
  'Board referral',
  'Website inquiry',
  'Broker',
  'Attorney / accountant',
  'Other',
];

export type PropertyType = 'Rental' | 'Condo' | 'Co-op' | 'Office';
export const PROPERTY_TYPES: PropertyType[] = ['Rental', 'Condo', 'Co-op', 'Office'];

export interface UploadedFileRef {
  name: string;
  url: string;
  sizeBytes: number;
  contentType: string;
}

export interface WelcomeHomeRequestInput {
  propertyAddress: string;
  block?: string;
  lot?: string;
  websiteReference?: string;
  propertyType?: string;
  contactName?: string;
  referralSource?: string;
  notes?: string;
  recipientName?: string;
  recipientEntity?: string;
  recipientTitle?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  uploadedFiles?: UploadedFileRef[];
}

export interface WelcomeHomeRequestRecord extends WelcomeHomeRequestInput {
  id: string;
  createdAt: string;
  status: string;
}

const LOCAL_KEY = 'camelot_welcome_home_requests_v1';

function readLocal(): WelcomeHomeRequestRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as WelcomeHomeRequestRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(records: WelcomeHomeRequestRecord[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
  } catch {
    // best-effort only
  }
}

/** Submit a new-property intake request. Writes to Supabase when configured, else falls back to local storage. */
export async function submitWelcomeHomeRequest(input: WelcomeHomeRequestInput): Promise<WelcomeHomeRequestRecord> {
  const record: WelcomeHomeRequestRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'requested',
    ...input,
  };

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('welcome_home_requests').insert({
        property_address: input.propertyAddress,
        block: input.block || null,
        lot: input.lot || null,
        website_reference: input.websiteReference || null,
        property_type: input.propertyType || null,
        contact_name: input.contactName || null,
        referral_source: input.referralSource || null,
        notes: input.notes || null,
        recipient_name: input.recipientName || null,
        recipient_entity: input.recipientEntity || null,
        recipient_title: input.recipientTitle || null,
        recipient_phone: input.recipientPhone || null,
        recipient_email: input.recipientEmail || null,
        uploaded_files: input.uploadedFiles || [],
        status: 'requested',
        requested_by: 'Camelot OS dashboard',
        generated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return record;
    } catch (err) {
      console.warn('[welcome-home] Supabase insert failed, falling back to local storage', err);
    }
  }

  const local = readLocal();
  local.unshift(record);
  writeLocal(local.slice(0, 50));
  return record;
}

/** Fetch recent intake requests. Reads from Supabase when configured, else local storage. */
export async function fetchWelcomeHomeRequests(limit = 20): Promise<WelcomeHomeRequestRecord[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('welcome_home_requests')
        .select(
          'id, created_at, property_address, block, lot, website_reference, property_type, contact_name, referral_source, notes, recipient_name, recipient_entity, recipient_title, recipient_phone, recipient_email, uploaded_files, status'
        )
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      if (data) {
        return data.map((row: any) => ({
          id: row.id,
          createdAt: row.created_at,
          propertyAddress: row.property_address,
          block: row.block || undefined,
          lot: row.lot || undefined,
          websiteReference: row.website_reference || undefined,
          propertyType: row.property_type || undefined,
          contactName: row.contact_name || undefined,
          referralSource: row.referral_source || undefined,
          notes: row.notes || undefined,
          recipientName: row.recipient_name || undefined,
          recipientEntity: row.recipient_entity || undefined,
          recipientTitle: row.recipient_title || undefined,
          recipientPhone: row.recipient_phone || undefined,
          recipientEmail: row.recipient_email || undefined,
          uploadedFiles: row.uploaded_files || [],
          status: row.status || 'requested',
        }));
      }
    } catch (err) {
      console.warn('[welcome-home] Supabase fetch failed, falling back to local storage', err);
    }
  }
  return readLocal().slice(0, limit);
}

/** Upload one file to the welcome-home-uploads bucket. Returns its public URL + metadata. */
export async function uploadWelcomeHomeFile(
  propertyAddress: string,
  file: File
): Promise<UploadedFileRef> {
  const safeAddress = propertyAddress.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'unfiled';
  const path = `${safeAddress}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage.from('welcome-home-uploads').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('welcome-home-uploads').getPublicUrl(path);
  return { name: file.name, url: data.publicUrl, sizeBytes: file.size, contentType: file.type };
}

/** Accepted upload extensions for the Welcome Home data dump — PDFs, images, and Office documents. */
export const WELCOME_HOME_UPLOAD_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.gif,.ppt,.pptx,.doc,.docx,.xls,.xlsx';

/**
 * The full Welcome Home content-section outline. This is the durable template
 * spec for what a generated single-property site should contain, distilled
 * from David Goldoff's brief (Sept 2026). Every future Welcome Home build
 * should follow this order.
 */
export const WELCOME_HOME_CONTENT_SECTIONS: { title: string; detail: string }[] = [
  {
    title: 'Masthead & cover',
    detail: 'Welcome Home theme, a photo of the subject property, and the Camelot logo — "managed by Camelot."',
  },
  {
    title: 'Cover letter',
    detail: 'From founder David A. Goldoff, with his signature, name, and title.',
  },
  {
    title: 'Who this site addresses',
    detail: 'Recipient name, ownership entity, title, phone, and email — plus the generation date and version, so every archived copy is dated and traceable.',
  },
  {
    title: 'Mission & history',
    detail: 'Established 2006, started from the Goldoff family’s own real estate in the South Street Seaport. We think and operate from an owner’s perspective.',
  },
  {
    title: 'Areas we serve',
    detail: 'NYC (five boroughs), Southern New Jersey, Southern Westchester, Southern Connecticut, and Southeast Florida — framed as "the Sixth Borough." Map of the five boroughs plus these outer regions.',
  },
  {
    title: 'Core services',
    detail: 'Property Management, Accounting, Compliance, Energy & Insurance Procurement, Administration, Facility Management, Project Management, Brokerage Leasing & Sales, Asset Management, Investment Acquisitions, and Value-Add Development. Camelot is an Owner-Operator real estate service provider.',
  },
  {
    title: 'Subject property summary',
    detail: 'A Camelot OS-generated report on the specific property, followed by how Camelot’s approach saves money and creates new revenue streams.',
  },
  {
    title: 'Why Camelot (value proposition)',
    detail: 'Self-managed and owned — not by private equity — so our interests are aligned with our clients’. Highly curated images paired with the copy, not just text.',
  },
  {
    title: 'Technology & automation',
    detail: 'AI, automation, apps, cloud systems, and the Camelot OS dashboard — timely task management, agent support, fast issue isolation, and a template library (Camelot OS + Dropbox). How this makes us more efficient internally and frees up PM time to spend with clients.',
  },
  {
    title: 'Client resources',
    detail: 'Highlight services, staff, the blog, and free downloadable guides (board governance, first-time-in-NYC, compliance & Local Law resources) pulled from camelot.nyc.',
  },
  {
    title: 'Strategic alliances',
    detail: 'Engineering partner for compliance and Local Law guidance, violation tracking and resolution, capital projects, and budget/reserve forecasting.',
  },
  {
    title: 'Accounting & team',
    detail: 'Licensed CPA and attorney on staff, plus controllers, admins, account managers, property managers, and brokers — all accessible to the client.',
  },
  {
    title: 'Next steps',
    detail: 'Propose a Zoom or in-person meet-and-greet, outline the transition plan, and give a working Calendly link.',
  },
];

/** The reusable build checklist behind every Welcome Home microsite, distilled from the Oak Park and 382 Lafayette builds. */
export const WELCOME_HOME_CHECKLIST: { title: string; detail: string }[] = [
  {
    title: 'Confirm the property',
    detail: 'Full address, unit/building count, year built, architect/style if landmarked, and how the referral came in.',
  },
  {
    title: 'Source real photography',
    detail: 'Exterior + street-level images (StreetEasy, CityRealty, Google Maps) — never a competing broker’s active listing photos of private units.',
  },
  {
    title: 'Write the cover letter',
    detail: 'Signed by David A. Goldoff, grounded in Camelot’s 20-year history managing Lower Manhattan and the surrounding boroughs — no personal or family references.',
  },
  {
    title: 'Build the proximity map',
    detail: 'Real Leaflet map (CDN-loaded, not npm) plotting the subject property, the nearest Camelot-managed buildings, and the 57 West 57th Street office with walking/subway distance.',
  },
  {
    title: 'Add case studies + track record',
    detail: 'Pull 2\u20133 relevant case studies and the full neighboring-portfolio table so the board sees buildings like theirs, near theirs.',
  },
  {
    title: 'Technology & partnerships',
    detail: 'Logos + links for BuildingLink, Concierge Plus, MDS, Meet Select, and Domecile, plus a sample monthly report (flipbook + PDF download).',
  },
  {
    title: 'Team + next step',
    detail: 'Relevant senior team bios and a working Calendly link so the board can book the intro Zoom directly.',
  },
];
