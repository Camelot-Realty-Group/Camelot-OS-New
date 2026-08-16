// Static file catalog for the Template Concierge library. These are the
// real branded Camelot documents from the Template Library (Dropbox),
// copied into public/templates/<id>/ so every template — wired to the
// fill-in generator or not — can be viewed, downloaded, printed, or
// emailed straight from the Templates page.
//
// Keep in sync with DOCUMENT_TEMPLATES in document-templates.ts: every id
// there should have an entry here (or the card falls back to "file not
// available yet").

export interface TemplateFileSet {
  /** Blank Word document — always downloadable/editable in Word. */
  docxUrl: string;
  /** Non-fillable PDF, for viewing/printing. */
  pdfUrl: string;
  /** Interactive fillable PDF, when the source library has one. */
  fillablePdfUrl?: string;
}

const files = (id: string, hasFillable = true): TemplateFileSet => ({
  docxUrl: `/templates/${id}/template.docx`,
  pdfUrl: `/templates/${id}/template.pdf`,
  fillablePdfUrl: hasFillable ? `/templates/${id}/template-fillable.pdf` : undefined,
});

export const TEMPLATE_FILES: Record<string, TemplateFileSet> = {
  'condo-coop-management-agreement': files('condo-coop-management-agreement', false),
  'rental-management-agreement': files('rental-management-agreement', false),
  'office-management-agreement': files('office-management-agreement', false),
  'new-construction-rollout-agreement': files('new-construction-rollout-agreement', false),
  'coi-tracking-form': files('coi-tracking-form'),
  'w9-request-cover-sheet': files('w9-request-cover-sheet'),
  'bank-questionnaire-cover-sheet': files('bank-questionnaire-cover-sheet'),
  'rpie-abatement-filing-tracker': files('rpie-abatement-filing-tracker'),
  'sales-package-cover-sheet': files('sales-package-cover-sheet'),
  'rental-package-cover-sheet': files('rental-package-cover-sheet'),
  'unit-alteration-agreement': files('unit-alteration-agreement'),
  'board-meeting-proxy-form': files('board-meeting-proxy-form'),
  'annual-special-meeting-notice': files('annual-special-meeting-notice'),
  'board-meeting-minutes': files('board-meeting-minutes'),
  'monthly-management-report-cover-sheet': files('monthly-management-report-cover-sheet'),
  'purchase-order-form': files('purchase-order-form'),
  'transition-manifest-checklist': files('transition-manifest-checklist'),
  'work-order-request-form': files('work-order-request-form'),
  'amenity-reservation-request-form': files('amenity-reservation-request-form'),
  'capital-project-status-report': files('capital-project-status-report'),
  'vendor-work-authorization': files('vendor-work-authorization'),
};

export function getTemplateFiles(id: string): TemplateFileSet | undefined {
  return TEMPLATE_FILES[id];
}
