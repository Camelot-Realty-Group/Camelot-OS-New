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
