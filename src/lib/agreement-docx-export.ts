/**
 * Converts the generated agreement HTML (see rental-agreement-v3.ts) into a
 * native, editable .docx file that mirrors the house typography exactly:
 * cover title in HGMaruGothicMPRO/blue, Arial 9pt body, Georgia dark-gold
 * article headings with a border rule, and a running Arial 8pt footer with
 * live Word page numbers.
 *
 * This walks the SAME html string used for the on-screen/print view (via
 * the browser's built-in DOMParser — no extra dependency), so the docx and
 * the HTML/PDF renderings can never drift apart. Only the letterhead and
 * footer are pulled out and rebuilt as a real Word header/footer (so they
 * repeat natively rather than being duplicated per page).
 *
 * NOTE: docx.js types are intentionally treated loosely (`as any` at
 * construction boundaries) — the exact `.d.ts` shape can drift across
 * minor versions and this file cannot be type-checked against a locally
 * installed copy of the package in this environment. Runtime behavior is
 * unaffected; only the TypeScript compile-time guarantees are relaxed here.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  BorderStyle,
  WidthType,
  PageBreak,
  PageNumber,
  TabStopType,
} from 'docx';

const BODY_FONT = 'Arial';
const HEADING_FONT = 'Georgia';
const COVER_FONT = 'HGMaruGothicMPRO';
const DARK_GOLD = '8B6F47';
const GOLD_RULE = 'B8960F';
const TITLE_BLUE = '2F5597';
const NAVY = '1B2A4A';

// Word measures font size in half-points (9pt -> 18).
const pt = (n: number) => Math.round(n * 2);

type Block = Paragraph | Table;

async function dataUriToImage(src: string): Promise<{ data: ArrayBuffer; type: 'png' | 'jpg' | 'gif' | 'bmp' } | null> {
  if (!src || !src.startsWith('data:image/')) return null;
  try {
    const match = /^data:image\/(\w+);base64,/.exec(src);
    const ext = (match?.[1] || 'png').toLowerCase();
    const type = (ext === 'jpeg' ? 'jpg' : ['png', 'jpg', 'gif', 'bmp'].includes(ext) ? ext : 'png') as
      | 'png'
      | 'jpg'
      | 'gif'
      | 'bmp';
    const resp = await fetch(src);
    const data = await resp.arrayBuffer();
    return { data, type };
  } catch {
    return null;
  }
}

// Walks inline children (text nodes, <b>/<strong>, <u>, <i>/<em>, <br>) into
// a flat list of TextRun options — used for every paragraph-level element.
function inlineRunOpts(
  node: Element,
  base: { font?: string; size?: number; color?: string } = {}
): any[] {
  const out: any[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (text.trim().length || /\S/.test(text)) {
        out.push({ text, font: base.font, size: base.size, color: base.color });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === 'br') {
        out.push({ text: '', font: base.font, size: base.size, break: 1 });
        return;
      }
      const nextBase = { ...base };
      const opts: any = {};
      if (tag === 'b' || tag === 'strong') opts.bold = true;
      if (tag === 'u') opts.underline = {};
      if (tag === 'i' || tag === 'em') opts.italics = true;
      inlineRunOpts(el, nextBase).forEach((r) => out.push({ ...r, ...opts }));
    }
  });
  return out;
}

function runsFrom(node: Element, base: { font?: string; size?: number; color?: string } = {}): TextRun[] {
  const opts = inlineRunOpts(node, base);
  if (!opts.length) return [new TextRun({ text: node.textContent || '', font: base.font, size: base.size, color: base.color } as any)];
  return opts.map((o) => new TextRun(o as any));
}

function bodyParagraph(el: Element, opts: { indent?: boolean } = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: opts.indent ? { left: 360 } : undefined,
    spacing: { after: 140 },
    children: runsFrom(el, { font: BODY_FONT, size: pt(9), color: '000000' }),
  } as any);
}

function articleHeading(el: Element): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 280, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD_RULE, space: 4 } },
    children: [
      new TextRun({ text: (el.textContent || '').trim(), bold: true, font: HEADING_FONT, size: pt(12), color: DARK_GOLD, allCaps: true } as any),
    ],
  } as any);
}

function sectionHeading(el: Element): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 140 },
    children: [new TextRun({ text: (el.textContent || '').trim(), bold: true, font: HEADING_FONT, size: pt(11), color: DARK_GOLD } as any)],
  } as any);
}

function navyHeading(text: string, size = 13): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 140 },
    children: [new TextRun({ text, bold: true, font: HEADING_FONT, size: pt(size), color: NAVY } as any)],
  } as any);
}

function feeTable(tableEl: Element): Table {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  const trs = rows.map((tr, i) => {
    const cells = Array.from(tr.children);
    const isHeader = i === 0 && cells[0]?.tagName.toLowerCase() === 'th';
    return new TableRow({
      children: cells.map((cell, ci) => {
        const isAmt = (cell as Element).classList?.contains('fee-amt');
        return new TableCell({
          width: { size: ci === cells.length - 1 ? 32 : 68, type: WidthType.PERCENTAGE },
          shading: isHeader ? { fill: NAVY } : i % 2 === 1 ? { fill: 'F7F4EC' } : undefined,
          children: [
            new Paragraph({
              alignment: ci === cells.length - 1 ? AlignmentType.RIGHT : AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: cell.textContent || '',
                  font: BODY_FONT,
                  size: pt(9),
                  bold: isHeader || isAmt,
                  color: isHeader ? 'FFFFFF' : isAmt ? NAVY : '000000',
                } as any),
              ],
            } as any),
          ],
        } as any);
      }),
    } as any);
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: trs } as any);
}

function signatureBlocks(sigPageEl: Element): Paragraph[] {
  const out: Paragraph[] = [];
  Array.from(sigPageEl.children).forEach((child) => {
    const cls = child.className || '';
    if (cls.includes('sig-head')) {
      out.push(navyHeading((child.textContent || '').trim(), 13));
    } else if (cls.includes('sig-wit')) {
      const p = child.querySelector('p');
      if (p) {
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [new TextRun({ text: p.textContent || '', italics: true, font: BODY_FONT, size: pt(9) } as any)],
          } as any)
        );
      }
    } else if (cls.includes('sig-party')) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 260 },
          children: [new TextRun({ text: (child.textContent || '').trim(), bold: true, font: HEADING_FONT, size: pt(11), color: NAVY } as any)],
        } as any)
      );
    } else if (cls.includes('sig-entity')) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 220 },
          children: runsFrom(child, { font: BODY_FONT, size: pt(9), color: '000000' }),
        } as any)
      );
    } else if (cls.includes('sig-field')) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: runsFrom(child, { font: BODY_FONT, size: pt(9), color: '000000' }),
        } as any)
      );
    } else if (cls.includes('sig-rule')) {
      out.push(
        new Paragraph({
          spacing: { before: 200, after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C9A55C' } },
          children: [],
        } as any)
      );
    }
  });
  return out;
}

function locTextBlocks(locStripEl: Element): Paragraph[] {
  const out: Paragraph[] = [];
  const title = locStripEl.querySelector('.loc-title');
  const p = locStripEl.querySelector('.loc-text p');
  if (title) out.push(navyHeading((title.textContent || '').trim(), 10));
  if (p) out.push(bodyParagraph(p));
  return out;
}

function intelBlocks(intelEl: Element): Paragraph[] {
  const out: Paragraph[] = [];
  const title = intelEl.querySelector('.loc-title');
  if (title) out.push(navyHeading((title.textContent || '').trim(), 10));
  intelEl.querySelectorAll('li').forEach((li) => {
    out.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: [new TextRun({ text: li.textContent || '', font: BODY_FONT, size: pt(9), color: '000000' } as any)],
      } as any)
    );
  });
  return out;
}

async function coverBlocks(coverWrapEl: Element): Promise<Block[]> {
  const out: Block[] = [];
  const addr = coverWrapEl.querySelector('h1.cover-addr');
  const citystate = coverWrapEl.querySelector('h2.cover-citystate');
  const photoImg = coverWrapEl.querySelector('.cover-photo-box img') as HTMLImageElement | null;
  const meta = coverWrapEl.querySelector('p.cover-meta');
  const doctype = coverWrapEl.querySelector('p.cover-doctype');
  const dateprep = coverWrapEl.querySelector('p.cover-dateprep');
  const version = coverWrapEl.querySelector('p.cover-version');

  if (addr) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: addr.textContent || '', font: COVER_FONT, size: pt(18), color: TITLE_BLUE } as any)],
      } as any)
    );
  }
  if (citystate) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 },
        children: [new TextRun({ text: citystate.textContent || '', font: COVER_FONT, size: pt(16), color: TITLE_BLUE } as any)],
      } as any)
    );
  }
  if (photoImg?.src) {
    const img = await dataUriToImage(photoImg.src);
    if (img) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 360 },
          children: [
            new ImageRun({
              type: img.type,
              data: img.data,
              transformation: { width: 432, height: 336 },
            } as any),
          ],
        } as any)
      );
    }
  }
  if (meta) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: runsFrom(meta, { font: BODY_FONT, size: pt(9), color: '000000' }),
      } as any)
    );
  }
  if (doctype) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: doctype.textContent || '', font: BODY_FONT, size: pt(9), color: '000000' } as any)],
      } as any)
    );
  }
  if (dateprep) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 280 },
        children: [new TextRun({ text: (dateprep.textContent || '').replace(/ /g, ' '), font: BODY_FONT, size: pt(9), color: '000000' } as any)],
      } as any)
    );
  }
  if (version) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: version.textContent || '', font: BODY_FONT, size: pt(9), color: '000000' } as any)],
      } as any)
    );
  }
  return out;
}

async function elementToBlocks(el: Element): Promise<Block[]> {
  const tag = el.tagName.toLowerCase();
  const cls = el.className || '';

  if (cls.includes('cover-wrap')) return coverBlocks(el);
  if (cls.includes('sched-title')) return [navyHeading((el.textContent || '').trim(), 13)];
  if (cls.includes('sig-page')) return signatureBlocks(el);
  if (cls.includes('loc-strip')) return locTextBlocks(el);
  if (cls.includes('intel')) return intelBlocks(el);
  if (cls.includes('photo-grid')) return []; // secondary photos: HTML/PDF only
  if (cls.includes('article-block')) {
    const out: Block[] = [];
    for (const gc of Array.from(el.children)) {
      const gtag = gc.tagName.toLowerCase();
      if (gtag === 'h2') out.push(articleHeading(gc));
      else if (gtag === 'h3') out.push(sectionHeading(gc));
      else out.push(...(await elementToBlocks(gc)));
    }
    return out;
  }
  if (tag === 'table') return [feeTable(el)];
  if (tag === 'ul') {
    return Array.from(el.querySelectorAll('li')).map(
      (li) =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: runsFrom(li, { font: BODY_FONT, size: pt(9), color: '000000' }),
        } as any)
    );
  }
  if (tag === 'p') {
    return [bodyParagraph(el, { indent: cls.includes('ind') })];
  }
  if (tag === 'div' || tag === 'h1' || tag === 'h2' || tag === 'h3') {
    const out: Block[] = [];
    for (const c of Array.from(el.children)) out.push(...(await elementToBlocks(c)));
    return out;
  }
  return [];
}

async function pageContentToBlocks(pageContentEl: Element): Promise<Block[]> {
  const out: Block[] = [];
  for (const child of Array.from(pageContentEl.children)) {
    const cls = child.className || '';
    if (cls.includes('letterhead')) continue; // rebuilt once as the Word header
    out.push(...(await elementToBlocks(child)));
  }
  return out;
}

/**
 * Builds a native .docx Blob from the agreement HTML string produced by
 * generateRentalAgreementV3() (or any future generator that reuses the same
 * `.page` / `.page-content` / `.letterhead` / `.pf` markup contract).
 */
export async function generateAgreementDocxBlob(html: string): Promise<Blob> {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const pages = Array.from(parsed.querySelectorAll('.page'));
  if (!pages.length) throw new Error('generateAgreementDocxBlob: no .page elements found in agreement HTML');

  // --- Header (letterhead), built once from the first page's markup ---
  const lh = pages[0].querySelector('.letterhead');
  const logoImg = lh?.querySelector('img') as HTMLImageElement | null;
  const lhName = lh?.querySelector('.lh-name')?.textContent || 'CAMELOT REALTY GROUP';
  const lhServices = lh?.querySelector('.lh-services')?.textContent || '';
  const lhTag = (lh?.querySelector('.lh-tag')?.textContent || '').trim();

  const headerChildren: Paragraph[] = [];
  if (logoImg?.src) {
    const img = await dataUriToImage(logoImg.src);
    if (img) {
      headerChildren.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [new ImageRun({ type: img.type, data: img.data, transformation: { width: 34, height: 34 } } as any)],
        } as any)
      );
    }
  }
  headerChildren.push(
    new Paragraph({ children: [new TextRun({ text: lhName, bold: true, font: HEADING_FONT, size: pt(11), color: NAVY } as any)] } as any)
  );
  if (lhServices) {
    headerChildren.push(
      new Paragraph({ children: [new TextRun({ text: lhServices, font: BODY_FONT, size: pt(6.5), color: '6B675F' } as any)] } as any)
    );
  }
  if (lhTag) {
    headerChildren.push(
      new Paragraph({
        spacing: { after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '8A867E' } },
        children: [new TextRun({ text: lhTag, italics: true, font: HEADING_FONT, size: pt(8), color: 'A9814A' } as any)],
      } as any)
    );
  }

  // --- Footer, Arial 8pt standard black, with live Word page numbers ---
  const pf = pages[0].querySelector('.pf');
  const pfLeft = pf?.querySelector('.pf-left')?.textContent || '';
  const pfCenter = pf?.querySelector('.pf-center')?.textContent || '';

  const footerParagraph = new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: GOLD_RULE } },
    spacing: { before: 120 },
    tabStops: [
      { type: TabStopType.CENTER, position: 4680 },
      { type: TabStopType.RIGHT, position: 9360 },
    ],
    children: [
      new TextRun({ text: pfLeft, font: BODY_FONT, size: pt(8), color: '000000' } as any),
      new TextRun({ text: `\t${pfCenter}\t`, font: BODY_FONT, size: pt(8), color: '000000' } as any),
      new TextRun({ text: 'Page ', font: BODY_FONT, size: pt(8), color: '000000' } as any),
      new TextRun({ children: [PageNumber.CURRENT], font: BODY_FONT, size: pt(8), color: '000000' } as any),
      new TextRun({ text: ' of ', font: BODY_FONT, size: pt(8), color: '000000' } as any),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font: BODY_FONT, size: pt(8), color: '000000' } as any),
    ],
  } as any);

  // --- Body: every page's content, in order, separated by real page breaks ---
  const bodyChildren: Block[] = [];
  for (let i = 0; i < pages.length; i++) {
    const content = pages[i].querySelector('.page-content');
    if (content) bodyChildren.push(...(await pageContentToBlocks(content)));
    if (i < pages.length - 1) bodyChildren.push(new Paragraph({ children: [new PageBreak()] } as any));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // 8.5in x 11in in twips
            margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 }, // 0.75in
          },
        },
        headers: { default: new Header({ children: headerChildren } as any) },
        footers: { default: new Footer({ children: [footerParagraph] } as any) },
        children: bodyChildren as any,
      },
    ],
  } as any);

  return Packer.toBlob(doc);
}

/**
 * Triggers a browser download of a Blob under the given filename, then
 * waits a tick before returning so the browser has a chance to actually
 * start reading the blob off the renderer before any heavy synchronous
 * work (e.g. PDF rendering) resumes and starves it. The object URL is
 * revoked on page unload rather than on a fixed timer — revoking too
 * early can truncate large downloads (seen as 0-byte / stuck files) if
 * the main thread gets busy right after the click.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.addEventListener('unload', () => URL.revokeObjectURL(url), { once: true });
  // Yield to the browser (a few animation frames) so the download actually
  // starts before we resume any CPU-heavy work like PDF rendering.
  await new Promise((resolve) => setTimeout(resolve, 300));
}
