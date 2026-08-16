# Template Concierge — master document templates

Each file here is a branded Camelot Word document (built with the same
header/footer/color styling as the standalone template library) with
`{merge_tag}` placeholders instead of blank fillable boxes.

## How it's wired

1. **Field schema** — `src/lib/document-templates.ts` lists every template
   in the library, with `fields: [{ key, label, type, ... }]` describing
   what to ask the user. `key` must exactly match the `{key}` tag used in
   the corresponding master `.docx`.
2. **Master docx** — lives in this folder as `<template-id>.docx`, and is
   registered in `server.js` under `READY_TEMPLATE_FILES`.
3. **Generation** — `POST /api/templates/generate` with
   `{ templateId, answers }` loads the master, injects `answers` via
   `docxtemplater`, and streams back a filled `.docx`.
4. **UI** — `src/pages/Templates.tsx` ("Template Concierge" in the
   sidebar under Excalibur — Agreements) lists every template by
   category. Templates with a master file wired are clickable and open
   a fill-in form; everything else shows a "Coming soon" badge.

## Currently wired

- `work-order-request.docx` → `work-order-request-form`
- `coi-tracking-form.docx` → `coi-tracking-form`
- `w9-request-cover-sheet.docx` → `w9-request-cover-sheet`
- `bank-questionnaire-cover-sheet.docx` → `bank-questionnaire-cover-sheet`
- `rpie-abatement-filing-tracker.docx` → `rpie-abatement-filing-tracker`
- `sales-package-cover-sheet.docx` → `sales-package-cover-sheet`
- `rental-package-cover-sheet.docx` → `rental-package-cover-sheet`
- `unit-alteration-agreement.docx` → `unit-alteration-agreement`
- `board-meeting-proxy-form.docx` → `board-meeting-proxy-form`
- `annual-special-meeting-notice.docx` → `annual-special-meeting-notice`
- `board-meeting-minutes.docx` → `board-meeting-minutes`
- `monthly-management-report-cover-sheet.docx` → `monthly-management-report-cover-sheet`
- `purchase-order-form.docx` → `purchase-order-form`
- `amenity-reservation-request-form.docx` → `amenity-reservation-request-form`
- `capital-project-status-report.docx` → `capital-project-status-report`
- `vendor-work-authorization.docx` → `vendor-work-authorization`

Not yet wired (need a merge-tag master + field schema): the 4 full Property
Management Agreement variants (condo/co-op, rental, office/commercial, new
construction — these are long-form contracts, not cover sheets, and need the
same care as `Camelot_Residential_Property_Management_Agreement_v2.docx`),
and `transition-manifest-checklist` (its schema doesn't map onto its source
doc's repeating checklist table yet).

## Adding a new template

1. Take the existing branded `.docx` for that template (from the
   `Camelot Template Library` folder in Dropbox, or regenerate via the
   `camelot_brand.py` pipeline).
2. Replace each blank fillable cell with a `{merge_tag}` matching a
   `field.key` you add to `document-templates.ts`.
3. Save it here as `<template-id>.docx`.
4. Add a line to `READY_TEMPLATE_FILES` in `server.js`.
5. Flip `ready: true` on that template's entry in `document-templates.ts`.

That's the whole loop — no other code changes needed per template.
