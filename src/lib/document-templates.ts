// Registry of Camelot document templates for the in-app Template Concierge.
// Each entry describes the fields a user must answer; the bot asks for
// these one at a time (or via a form), then POSTs the answers to
// /api/templates/generate to receive a filled Word document.
//
// `ready: true` means a merge-tag master .docx exists under
// server/doc-templates/ and generation is fully wired. Templates with
// `ready: false` are catalogued but not yet connected to a generator —
// see server/doc-templates/README (to be added) for how to add one.

export type TemplateFieldType = 'text' | 'date' | 'textarea' | 'select' | 'number';

export interface TemplateField {
  key: string; // must match the {tag} in the master .docx
  label: string;
  type: TemplateFieldType;
  options?: string[]; // for type: 'select'
  required?: boolean;
}

export type TemplateCategory =
  | 'Property Management Agreements'
  | 'Admin & Compliance'
  | 'Leasing & Sales'
  | 'Board & Governance'
  | 'Reports & Financials'
  | 'Project & Property Management';

export interface DocumentTemplate {
  id: string; // used as the generation key and master filename stem
  title: string;
  category: TemplateCategory;
  description: string;
  fields: TemplateField[];
  ready: boolean;
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  // ---------------- Property Management Agreements ----------------
  {
    id: 'condo-coop-management-agreement',
    title: 'Condo/Co-op Management Agreement',
    category: 'Property Management Agreements',
    description: 'Full management agreement for condominium and cooperative buildings, with Schedule A fee sheet and insurance exhibit.',
    fields: [],
    ready: false,
  },
  {
    id: 'rental-management-agreement',
    title: 'Rental Management Agreement',
    category: 'Property Management Agreements',
    description: 'Management agreement for rental (non-condo/co-op) residential and commercial buildings.',
    fields: [],
    ready: false,
  },
  {
    id: 'office-management-agreement',
    title: 'Office/Commercial Building Management Agreement',
    category: 'Property Management Agreements',
    description: 'Management agreement for commercial office and mixed office/retail properties.',
    fields: [],
    ready: false,
  },
  {
    id: 'new-construction-rollout-agreement',
    title: 'New Construction Condo Rollout Agreement',
    category: 'Property Management Agreements',
    description: 'Sponsor management agreement for new-construction condominiums, pre-closing through Board assignment.',
    fields: [],
    ready: false,
  },

  // ---------------- Admin & Compliance ----------------
  {
    id: 'coi-tracking-form',
    title: 'Certificate of Insurance (COI) Tracking Form',
    category: 'Admin & Compliance',
    description: 'Track vendor/contractor COIs before work begins at a managed property.',
    fields: [
      { key: 'vendor_name', label: 'Vendor / Contractor Name', type: 'text', required: true },
      { key: 'type_of_work', label: 'Type of Work', type: 'text', required: true },
      { key: 'property', label: 'Property / Building', type: 'text', required: true },
      { key: 'coi_received_date', label: 'COI Received Date', type: 'date' },
      { key: 'policy_expiration_date', label: 'Policy Expiration Date', type: 'date' },
      { key: 'gl_limits', label: "General Liability Limits", type: 'text' },
      { key: 'additional_insured', label: 'Camelot Listed as Additional Insured', type: 'select', options: ['Y', 'N'] },
      { key: 'workers_comp', label: "Workers' Compensation on File", type: 'select', options: ['Y', 'N'] },
      { key: 'auto_liability', label: 'Auto Liability on File', type: 'select', options: ['Y', 'N'] },
    ],
    ready: false,
  },
  {
    id: 'w9-request-cover-sheet',
    title: 'W-9 Request Cover Sheet',
    category: 'Admin & Compliance',
    description: 'Request and track a completed IRS Form W-9 from a vendor before payment or 1099 filing.',
    fields: [
      { key: 'vendor_name', label: 'Vendor / Payee Name', type: 'text', required: true },
      { key: 'requested_by', label: 'Requested By', type: 'text' },
      { key: 'date_requested', label: 'Date Requested', type: 'date' },
      { key: 'date_received', label: 'Date Received', type: 'date' },
      { key: 'tin_on_file', label: 'TIN / EIN on File', type: 'select', options: ['Y', 'N'] },
    ],
    ready: false,
  },
  {
    id: 'bank-questionnaire-cover-sheet',
    title: 'Bank/Lender Questionnaire Cover Sheet',
    category: 'Admin & Compliance',
    description: 'Track lender questionnaires for a unit sale, refinance, or mortgage. $200 processing fee applies.',
    fields: [
      { key: 'lender_name', label: 'Lender / Bank Name', type: 'text', required: true },
      { key: 'loan_officer', label: 'Loan Officer Contact', type: 'text' },
      { key: 'borrower', label: 'Borrower / Unit Owner', type: 'text', required: true },
      { key: 'property_unit', label: 'Property / Unit #', type: 'text', required: true },
      { key: 'date_received', label: 'Date Received', type: 'date' },
      { key: 'date_completed', label: 'Date Completed', type: 'date' },
    ],
    ready: false,
  },
  {
    id: 'rpie-abatement-filing-tracker',
    title: 'RPIE / Tax Abatement Filing Tracker',
    category: 'Admin & Compliance',
    description: 'Track annual RPIE, RPIE-Exempt, and Co-op/Condo Tax Abatement filings.',
    fields: [
      { key: 'property', label: 'Property', type: 'text', required: true },
      { key: 'filing_type', label: 'Filing Type', type: 'select', options: ['RPIE', 'RPIE-Exempt', 'Co-op/Condo Abatement', 'Other'] },
      { key: 'filing_year', label: 'Filing Year', type: 'text' },
      { key: 'due_date', label: 'Due Date', type: 'date' },
      { key: 'filed_date', label: 'Filed Date', type: 'date' },
    ],
    ready: false,
  },

  // ---------------- Leasing & Sales ----------------
  {
    id: 'sales-package-cover-sheet',
    title: 'Sales Package Cover Sheet',
    category: 'Leasing & Sales',
    description: 'Cover sheet for a condo/co-op purchaser board package.',
    fields: [
      { key: 'applicant_name', label: 'Applicant Name(s)', type: 'text', required: true },
      { key: 'unit_number', label: 'Unit #', type: 'text', required: true },
      { key: 'purchase_price', label: 'Purchase Price', type: 'text' },
      { key: 'board_interview_date', label: 'Board Interview Date', type: 'date' },
    ],
    ready: false,
  },
  {
    id: 'rental-package-cover-sheet',
    title: 'Rental Package Cover Sheet',
    category: 'Leasing & Sales',
    description: 'Cover sheet for a condo/co-op rental applicant package.',
    fields: [
      { key: 'applicant_name', label: 'Applicant Name(s)', type: 'text', required: true },
      { key: 'unit_number', label: 'Unit #', type: 'text', required: true },
      { key: 'lease_term', label: 'Lease Term', type: 'text' },
      { key: 'monthly_rent', label: 'Monthly Rent', type: 'text' },
    ],
    ready: false,
  },
  {
    id: 'unit-alteration-agreement',
    title: 'Unit Alteration Agreement',
    category: 'Leasing & Sales',
    description: 'Short-form agreement for a Unit Holder undertaking a renovation or alteration.',
    fields: [
      { key: 'unit_owner_name', label: 'Unit Owner Name', type: 'text', required: true },
      { key: 'unit_number', label: 'Unit #', type: 'text', required: true },
      { key: 'property_address', label: 'Property Address', type: 'text', required: true },
      { key: 'contractor_name', label: 'Contractor Name', type: 'text' },
      { key: 'estimated_start_date', label: 'Estimated Start Date', type: 'date' },
      { key: 'estimated_completion_date', label: 'Estimated Completion Date', type: 'date' },
    ],
    ready: false,
  },

  // ---------------- Board & Governance ----------------
  {
    id: 'board-meeting-proxy-form',
    title: 'Board Meeting Proxy Form',
    category: 'Board & Governance',
    description: 'Proxy appointment for a Board/shareholder meeting.',
    fields: [
      { key: 'owner_name', label: 'Unit Owner / Shareholder Name', type: 'text', required: true },
      { key: 'unit_number', label: 'Unit #', type: 'text', required: true },
      { key: 'property_address', label: 'Property Address', type: 'text', required: true },
      { key: 'proxy_holder_name', label: 'Proxy Holder Name', type: 'text', required: true },
      { key: 'meeting_type', label: 'Meeting Type', type: 'select', options: ['Annual', 'Special'] },
      { key: 'meeting_date', label: 'Meeting Date', type: 'date' },
    ],
    ready: false,
  },
  {
    id: 'annual-special-meeting-notice',
    title: 'Annual/Special Meeting Notice',
    category: 'Board & Governance',
    description: 'Notice of an annual or special meeting, distributed to Unit Owners/Shareholders.',
    fields: [
      { key: 'meeting_type', label: 'Meeting Type', type: 'select', options: ['Annual', 'Special'] },
      { key: 'meeting_date', label: 'Date', type: 'date', required: true },
      { key: 'meeting_time', label: 'Time', type: 'text' },
      { key: 'location', label: 'Location / Virtual Link', type: 'text' },
      { key: 'agenda', label: 'Agenda Items', type: 'textarea' },
    ],
    ready: false,
  },
  {
    id: 'board-meeting-minutes',
    title: 'Board Meeting Minutes Template',
    category: 'Board & Governance',
    description: 'Minutes template for a Board meeting.',
    fields: [
      { key: 'meeting_date', label: 'Meeting Date', type: 'date', required: true },
      { key: 'call_to_order_time', label: 'Call to Order Time', type: 'text' },
      { key: 'members_present', label: 'Board Members Present', type: 'textarea' },
      { key: 'members_absent', label: 'Board Members Absent', type: 'text' },
      { key: 'discussion_summary', label: 'Discussion Summary', type: 'textarea' },
      { key: 'adjournment_time', label: 'Adjournment Time', type: 'text' },
    ],
    ready: false,
  },

  // ---------------- Reports & Financials ----------------
  {
    id: 'monthly-management-report-cover-sheet',
    title: 'Monthly Management Report Cover Sheet',
    category: 'Reports & Financials',
    description: 'Cover sheet for the monthly financial package.',
    fields: [
      { key: 'property', label: 'Property', type: 'text', required: true },
      { key: 'reporting_month', label: 'Reporting Month', type: 'text', required: true },
      { key: 'financial_highlights', label: 'Financial Highlights', type: 'textarea' },
      { key: 'occupancy_arrears_summary', label: 'Occupancy / Arrears Summary', type: 'textarea' },
    ],
    ready: false,
  },
  {
    id: 'purchase-order-form',
    title: 'Purchase Order Form',
    category: 'Reports & Financials',
    description: 'Purchase order for goods/services on behalf of a managed property.',
    fields: [
      { key: 'po_number', label: 'PO #', type: 'text', required: true },
      { key: 'vendor', label: 'Vendor', type: 'text', required: true },
      { key: 'property', label: 'Property', type: 'text', required: true },
      { key: 'description', label: 'Description of Goods / Services', type: 'textarea' },
      { key: 'total_amount', label: 'Total Amount', type: 'text' },
    ],
    ready: false,
  },
  {
    id: 'transition-manifest-checklist',
    title: 'Management Transition Manifest Checklist',
    category: 'Reports & Financials',
    description: 'Checklist for onboarding a new property or transitioning management from a prior agent.',
    fields: [
      { key: 'property', label: 'Property', type: 'text', required: true },
      { key: 'prior_agent', label: 'Prior Managing Agent', type: 'text' },
      { key: 'transition_date', label: 'Transition Date', type: 'date' },
    ],
    ready: false,
  },

  // ---------------- Project & Property Management ----------------
  {
    id: 'work-order-request-form',
    title: 'Work Order Request Form',
    category: 'Project & Property Management',
    description: 'Resident/board work order request routed to the property management office.',
    fields: [
      { key: 'date_of_request', label: 'Date of Request', type: 'date', required: true },
      { key: 'property_building', label: 'Property / Building', type: 'text', required: true },
      { key: 'unit_location', label: 'Unit / Location', type: 'text', required: true },
      { key: 'requested_by', label: 'Requested By', type: 'text', required: true },
      { key: 'contact_phone', label: 'Contact Phone', type: 'text' },
      { key: 'contact_email', label: 'Contact Email', type: 'text' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['Routine', 'Urgent', 'Emergency'], required: true },
      { key: 'category', label: 'Category', type: 'select', options: ['Plumbing', 'Electrical', 'HVAC', 'General', 'Other'] },
      { key: 'description', label: 'Description of Work Needed', type: 'textarea', required: true },
      { key: 'access_notes', label: 'Access Instructions', type: 'textarea' },
    ],
    ready: true,
  },
  {
    id: 'amenity-reservation-request-form',
    title: 'Amenity & Common Area Reservation Request',
    category: 'Project & Property Management',
    description: 'Resident request to reserve an amenity or common area.',
    fields: [
      { key: 'date_of_request', label: 'Date of Request', type: 'date', required: true },
      { key: 'building_property', label: 'Building / Property', type: 'text', required: true },
      { key: 'unit_number', label: 'Unit #', type: 'text', required: true },
      { key: 'resident_name', label: 'Resident Name', type: 'text', required: true },
      { key: 'amenity_requested', label: 'Amenity Requested', type: 'select', options: ['Roof Deck', 'Party Room', 'Gym', 'Bike Room', 'Storage', 'Guest Suite', 'Other'] },
      { key: 'requested_dates', label: 'Requested Date(s)', type: 'text' },
      { key: 'requested_times', label: 'Requested Time(s)', type: 'text' },
      { key: 'number_of_guests', label: 'Number of Guests', type: 'number' },
    ],
    ready: false,
  },
  {
    id: 'capital-project-status-report',
    title: 'Capital Project Status Report',
    category: 'Project & Property Management',
    description: 'Monthly status report for an active capital project, for Board distribution.',
    fields: [
      { key: 'project_name', label: 'Project Name', type: 'text', required: true },
      { key: 'property', label: 'Property', type: 'text', required: true },
      { key: 'start_date', label: 'Start Date', type: 'date' },
      { key: 'target_completion_date', label: 'Target Completion Date', type: 'date' },
      { key: 'approved_budget', label: 'Approved Budget', type: 'text' },
      { key: 'amount_spent', label: 'Amount Spent to Date', type: 'text' },
      { key: 'percent_complete', label: '% Complete', type: 'text' },
      { key: 'issues_risks', label: 'Issues / Risks', type: 'textarea' },
    ],
    ready: false,
  },
  {
    id: 'vendor-work-authorization',
    title: 'Vendor / Contractor Work Authorization',
    category: 'Project & Property Management',
    description: 'Authorization for a vendor/contractor to begin work at a managed property.',
    fields: [
      { key: 'vendor_name', label: 'Vendor / Contractor Name', type: 'text', required: true },
      { key: 'property', label: 'Property', type: 'text', required: true },
      { key: 'scope_of_work', label: 'Scope of Work', type: 'textarea', required: true },
      { key: 'estimated_cost', label: 'Estimated Cost', type: 'text' },
      { key: 'coi_on_file', label: 'COI on File', type: 'select', options: ['Y', 'N'] },
    ],
    ready: false,
  },
];

export function getTemplateById(id: string): DocumentTemplate | undefined {
  return DOCUMENT_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(): Record<TemplateCategory, DocumentTemplate[]> {
  const grouped = {} as Record<TemplateCategory, DocumentTemplate[]>;
  for (const t of DOCUMENT_TEMPLATES) {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  }
  return grouped;
}
