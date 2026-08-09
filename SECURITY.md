# Security notes

## Dependency audit exception

The production dependency audit currently reports two high-severity findings for
`image-size`, inherited through `pptxgenjs`. The affected parsers are for ICNS,
JXL, and HEIF images. Camelot OS's pitch-deck generator creates text, shapes,
and charts only; it does not accept or parse images. There is no patched
`image-size` release available as of August 9, 2026.

Do not add user-controlled images to `src/lib/pitch-deck-pptx.ts` while this
exception is open. Replace or upgrade the dependency as soon as a patched
release is available.

The former `xlsx` upload dependency was removed because its published npm
version has unresolved prototype-pollution and denial-of-service advisories.
Spreadsheet imports now use `exceljs` and accept `.xlsx`; legacy `.xls` files
must be saved as `.xlsx` or CSV before upload.
