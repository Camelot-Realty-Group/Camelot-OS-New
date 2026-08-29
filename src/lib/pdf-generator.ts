/**
 * Client-side PDF/HTML/CSV helpers for Camelot OS reports
 */

import { authenticatedApiFetch } from '@/lib/api-auth';

function ensureHtmlBase(html: string): string {
  if (typeof window === 'undefined' || !window.location?.origin) return html;
  if (/<base\s/i.test(html)) return html;
  const baseTag = `<base href="${window.location.origin}/">`;
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`)
    : `${baseTag}${html}`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function embedPortableImages(html: string): Promise<string> {
  if (typeof window === 'undefined' || !window.location?.origin) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(ensureHtmlBase(html), 'text/html');
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>('img[src]'));

  await Promise.all(images.map(async (img) => {
    const src = img.getAttribute('src') || '';
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;

    let absolute: URL;
    try {
      absolute = new URL(src, window.location.origin);
    } catch {
      return;
    }

    // Same-origin assets can be embedded so downloaded HTML opens cleanly offline.
    // Cross-origin listing/map/vendor images are left as absolute URLs because many
    // servers block browser-side fetches without CORS.
    if (absolute.origin !== window.location.origin) {
      img.setAttribute('src', absolute.href);
      return;
    }

    try {
      const response = await fetch(absolute.href);
      if (!response.ok) throw new Error(String(response.status));
      img.setAttribute('src', await blobToDataUrl(await response.blob()));
    } catch {
      img.setAttribute('src', absolute.href);
    }
  }));

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

/** Open HTML in a new tab for preview (no auto-print) */
export function openBrochureForPrint(html: string, filename: string): void {
  const win = window.open('', '_blank');
  if (!win) {
    const fallbackHtml = ensureHtmlBase(html);
    const blob = new Blob([fallbackHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = filename.endsWith('.html')
      ? filename
      : `${filename.replace(/\.(html|pdf)$/i, '')}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  win.document.write(ensureHtmlBase(html));
  win.document.close();
  win.document.title = filename.replace(/\.(html|pdf)$/i, '');
}

/** Download HTML string as an .html file */
export async function downloadAsHTML(html: string, filename: string): Promise<void> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const portableHtml = baseUrl
    ? await embedPortableImages(html
      .replace(/(src|href)=["']\.\/([^"']+)["']/g, `$1="${baseUrl}/$2"`)
      .replace(/(src|href)=["']\/([^"']+)["']/g, `$1="${baseUrl}/$2"`)
      .replace(/srcset=["']([^"']+)["']/g, (_match, value: string) => {
        const rewritten = value
          .split(',')
          .map((entry) => {
            const [url, descriptor] = entry.trim().split(/\s+/, 2);
            const absolute = url.startsWith('/') ? `${baseUrl}${url}` : url.startsWith('./') ? `${baseUrl}/${url.slice(2)}` : url;
            return descriptor ? `${absolute} ${descriptor}` : absolute;
          })
          .join(', ');
        return `srcset="${rewritten}"`;
      })
      .replace(/url\((['"]?)\/([^)'"]+)\1\)/g, `url($1${baseUrl}/$2$1)`)
    )
    : html;
  const blob = new Blob([portableHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Renders the report HTML inside a completely isolated <iframe> document
 * rather than injecting it into the live app's DOM.
 *
 * Why: html2canvas doesn't just capture the target element — to correctly
 * compute stacking context, effective styles, and scroll offsets it clones
 * from document.documentElement down. On this app that means cloning the
 * entire dashboard shell (sidebar, nav, every mounted widget) for every PDF
 * export, regardless of whether the target wrapper is on- or off-screen.
 * That full-tree clone is what was silently failing/hanging and producing a
 * structurally valid but blank ~3KB PDF — confirmed by testing a trivial,
 * fully on-screen div (zero off-screen positioning) which failed identically
 * to the real off-screen wrapper. Giving the report its own iframe document
 * means html2canvas only ever has to clone that small, self-contained
 * document — never the parent app.
 */
function buildPdfFrame(html: string): Promise<{ frame: HTMLIFrameElement; target: HTMLElement; isSlideDeck: boolean }> {
  return new Promise((resolve, reject) => {
    const isSlideDeck = /class=["'][^"']*\bslide\b/.test(html);
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.left = '-10000px';
    frame.style.top = '0';
    frame.style.width = isSlideDeck ? '11in' : '8.5in';
    frame.style.height = '0px';
    frame.style.border = '0';
    frame.setAttribute('aria-hidden', 'true');

    const timeout = setTimeout(() => reject(new Error('PDF render frame timed out loading')), 15000);

    frame.onload = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc || !doc.body) {
          clearTimeout(timeout);
          reject(new Error('PDF render frame failed to load'));
          return;
        }
        doc.querySelectorAll('.no-print, .deck-action-bar, .proposal-action-bar').forEach(el => el.remove());
        // Give the frame real height so html2canvas captures the full
        // document rather than the collapsed 0px shell it started at.
        const fullHeight = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 1);
        frame.style.height = `${fullHeight}px`;
        clearTimeout(timeout);
        resolve({ frame, target: doc.body, isSlideDeck });
      } catch (err) {
        clearTimeout(timeout);
        reject(err as Error);
      }
    };
    frame.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('PDF render frame failed to load'));
    };

    document.body.appendChild(frame);
    frame.srcdoc = ensureHtmlBase(html);
  });
}

function pdfOptions(filename: string, isSlideDeck: boolean, windowWidth: number, windowHeight: number) {
  return ({
    margin: 0,
    filename: filename.endsWith('.pdf') ? filename : `${filename.replace(/\.(html|pdf)$/i, '')}.pdf`,
    image: { type: 'jpeg', quality: 0.72 },
    html2canvas: {
      scale: 1.05,
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 12000,
      removeContainer: true,
      // Use the browser's native SVG <foreignObject> text/layout engine
      // instead of html2canvas's own DOM-walking text renderer. The manual
      // renderer is known to collapse inter-word spaces and vertical
      // margin/padding under certain font-metric/line-height combinations
      // (confirmed here: a report that rendered pixel-perfect when the
      // exact same srcdoc HTML was displayed directly in an iframe came out
      // of html2canvas with every word run together and no section
      // spacing). foreignObjectRendering delegates layout to the browser
      // itself, which is what already renders the source correctly, so it
      // eliminates this whole class of bug. Safe here because the capture
      // target is always our own same-origin, CORS-clean iframe document
      // (see buildPdfFrame) — the one case foreignObjectRendering can't
      // handle reliably (cross-origin/tainted content) never applies.
      foreignObjectRendering: true,
      // Belt-and-suspenders: the target lives in its own isolated iframe
      // document (see buildPdfFrame) rather than being injected into the
      // live app's DOM, so html2canvas never has to clone the full
      // dashboard shell. That iframe document is always freshly created
      // and unscrolled, but pinning scrollX/Y to 0 costs nothing.
      scrollX: 0,
      scrollY: 0,
      // Explicitly pin the capture viewport to the iframe's own
      // contentWindow dimensions. Without this, html2canvas can fall back
      // to measuring against the OUTER page's window in some browser/
      // iframe-timing combinations, which produces a well-formed but
      // empty (~3KB, single stray line-width operator) PDF — no thrown
      // error, no failed network request, just a silently short-circuited
      // capture. This was the actual root cause of the recurring
      // blank-agreement-PDF bug, not the earlier <input>/@import theories.
      windowWidth,
      windowHeight,
    },
    jsPDF: { unit: 'in', format: 'letter', orientation: isSlideDeck ? 'landscape' : 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] },
  }) as any;
}

/**
 * Waits for the iframe's fonts to finish loading, every <img> to finish
 * loading, and two animation-frame ticks to elapse so the browser has
 * actually completed a layout + paint pass before html2canvas measures
 * and rasterizes the document. Setting frame.style.height synchronously
 * inside buildPdfFrame's onload handler does not guarantee the browser
 * has reflowed/painted by the time the very next microtask runs, and
 * html2canvas capturing mid-reflow is the likely source of the silent
 * blank-page failures seen in production (no thrown error, no failed
 * request — just an empty capture).
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      }
    );
  });
}

async function waitForFrameSettledInner(frame: HTMLIFrameElement): Promise<void> {
  const doc = frame.contentDocument;
  if (!doc) return;

  await withTimeout(Promise.resolve((doc as any).fonts?.ready), 4000);

  const images = Array.from(doc.querySelectorAll('img'));
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : withTimeout(
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
          4000
        )
    )
  );

  // Re-measure and re-apply height now that images/fonts have settled —
  // font swaps and image intrinsic sizes can change scrollHeight after
  // the initial measurement in buildPdfFrame.
  const fullHeight = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 1);
  frame.style.height = `${fullHeight}px`;

  // Use the TOP-LEVEL page's requestAnimationFrame, not the off-screen
  // iframe's own contentWindow.requestAnimationFrame. Chromium throttles
  // rAF (and can suspend it near-indefinitely) inside iframes it judges
  // to be non-visible/off-screen — exactly the case here, since the
  // capture iframe is deliberately positioned at left:-10000px. Ticking
  // the outer visible window's rAF still gives the browser a real paint
  // opportunity without risking an effectively-infinite wait.
  const nextFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  await nextFrame();
  await nextFrame();
}

/**
 * Wraps waitForFrameSettledInner in a hard overall timeout so a capture
 * can never hang indefinitely, regardless of which sub-step misbehaves.
 * Falls back to proceeding with best-effort (possibly not fully settled)
 * content rather than hanging the whole download forever.
 */
async function waitForFrameSettled(frame: HTMLIFrameElement): Promise<void> {
  await withTimeout(waitForFrameSettledInner(frame), 6000);
}

class PdfRenderTimeoutError extends Error {
  constructor() {
    super('PDF render timed out');
    this.name = 'PdfRenderTimeoutError';
  }
}

/**
 * Races a promise against a hard deadline and throws a distinguishable
 * error on timeout, instead of leaving the caller (and the user-facing
 * button) hanging forever with no feedback. html2canvas/html2pdf.js has
 * no built-in timeout of its own for the actual capture+encode step, so
 * without this a slow or stuck render (e.g. a very tall multi-page
 * agreement, or a constrained/software-rendering browser context) shows
 * no error at all — just an infinite disabled-button spinner.
 */
function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new PdfRenderTimeoutError()), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// A real one-page letter document with any actual rendered content
// (letterhead, headings, body text) reliably produces a PDF well above
// this size once fonts/images are embedded. The confirmed-broken capture
// mode in this app (html2canvas silently failing to ever create/read a
// canvas inside the isolated render iframe — no thrown error, no failed
// network request, jsPDF proceeding anyway with an empty page) has been
// observed to consistently produce 3–6KB single-page PDFs with a content
// stream containing only a stray line-width/stroke-color pair and zero
// text/image-drawing operators. Treat anything under this floor as an
// unreliable capture rather than trusting size/toast/no-thrown-error as
// proof of real content.
const MIN_VALID_PDF_BYTES = 12000;

export type PdfDownloadResult = { method: 'download' } | { method: 'print-fallback' };

/**
 * Download an HTML report as a PDF using the browser-side html2canvas
 * renderer. If that renderer produces a suspiciously small/likely-blank
 * result (see MIN_VALID_PDF_BYTES) or times out, falls back to opening
 * the real HTML in a new tab via openBrochureForPrint() so the user can
 * still get a correct PDF through the browser's own, fully reliable
 * native print-to-PDF (Ctrl+P / Cmd+P → Save as PDF) instead of silently
 * downloading a blank file. Callers should branch on the returned
 * `method` to show the right confirmation message.
 */
export async function downloadAsPDF(html: string, filename: string): Promise<PdfDownloadResult> {
  const html2pdf = (await import('html2pdf.js')).default;
  const { frame, target, isSlideDeck } = await buildPdfFrame(html);
  let blob: Blob | undefined;
  try {
    await waitForFrameSettled(frame);
    const win = frame.contentWindow!;
    try {
      blob = await raceTimeout(
        html2pdf().from(target).set(pdfOptions(filename, isSlideDeck, win.innerWidth, win.innerHeight)).outputPdf('blob'),
        30000
      );
    } catch {
      blob = undefined;
    }
  } finally {
    frame.remove();
  }

  if (blob && blob.size >= MIN_VALID_PDF_BYTES) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { method: 'download' };
  }

  openBrochureForPrint(html, filename);
  return { method: 'print-fallback' };
}

/**
 * Render an HTML report to a PDF and return it as base64 (no filesystem
 * write) so it can be attached to a real outgoing email via
 * sendCamelotEmail() instead of only ever being saved locally.
 */
export async function generatePdfBase64(html: string, filename: string): Promise<string> {
  const html2pdf = (await import('html2pdf.js')).default;
  const { frame, target, isSlideDeck } = await buildPdfFrame(html);
  try {
    await waitForFrameSettled(frame);
    const win = frame.contentWindow!;
    let blob: Blob;
    try {
      const h2pInstance = html2pdf().from(target).set(pdfOptions(filename, isSlideDeck, win.innerWidth, win.innerHeight));
      blob = await raceTimeout(h2pInstance.outputPdf('blob'), 45000);
    } catch (err) {
      if (err instanceof PdfRenderTimeoutError) {
        throw new Error('PDF generation timed out while preparing the email attachment.');
      }
      throw err;
    }
    if (blob.size < MIN_VALID_PDF_BYTES) {
      throw new Error('PDF render produced an unreliable (likely blank) result — not attaching a broken PDF to the email.');
    }
    const dataUrl = await blobToDataUrl(blob);
    // Strip the "data:application/pdf;base64," prefix — Resend wants the raw base64 payload.
    const commaIndex = dataUrl.indexOf(',');
    return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  } finally {
    frame.remove();
  }
}

/** Open a mail client with a prepared client-facing draft. Attachments still require manual attachment by the user. */
export function openEmailDraft(params: {
  to?: string;
  cc?: string;
  subject: string;
  body: string;
  preferGmail?: boolean;
}): void {
  const to = encodeURIComponent(params.to || '');
  const cc = params.cc ? `&cc=${encodeURIComponent(params.cc)}` : '';
  const subject = encodeURIComponent(params.subject);
  const body = encodeURIComponent(params.body);
  const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${to}${cc}&su=${subject}&body=${body}`;
  const mailtoUrl = `mailto:${to}?subject=${subject}${cc}&body=${body}`;
  window.open(params.preferGmail === false ? mailtoUrl : gmailUrl, '_blank');
}

export interface SendCamelotEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  reportHtml?: string; // full report HTML to render + attach as PDF
  attachmentFilename?: string;
  hubspot?: { contactId?: string; dealId?: string; companyId?: string };
}

export interface SendCamelotEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  hubspot?: { status: string; message?: string; id?: string };
}

/**
 * Actually send an email via Camelot OS's own Resend-backed endpoint
 * (server.js /api/email/send) — a real delivery, not a mailto draft. Every
 * successful send is mirrored into HubSpot as an Email engagement when a
 * contact/deal/company id is supplied, so both systems stay in sync. Falls
 * back to a clear error (not a silent no-op) if RESEND_API_KEY isn't
 * configured yet in Render.
 */
export async function sendCamelotEmail(params: SendCamelotEmailParams): Promise<SendCamelotEmailResult> {
  try {
    const attachmentBase64 = params.reportHtml
      ? await generatePdfBase64(params.reportHtml, params.attachmentFilename || 'Camelot-Report.pdf')
      : undefined;

    const resp = await authenticatedApiFetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        replyTo: params.replyTo,
        attachmentBase64,
        attachmentFilename: params.attachmentFilename || (attachmentBase64 ? 'Camelot-Report.pdf' : undefined),
        hubspot: params.hubspot,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: data?.error || `Send failed (${resp.status})` };
    }
    return { ok: true, id: data.id, hubspot: data.hubspot };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Email send failed — check your connection and try again.' };
  }
}

export interface EmailConfigStatus {
  resendConfigured: boolean;
  resendFromAddress: string;
  hubspotConfigured: boolean;
  webhookConfigured: boolean;
}

/** Check whether real sending is actually wired up yet (RESEND_API_KEY set), so the UI can show an honest state instead of pretending Send will work. */
export async function getEmailConfigStatus(): Promise<EmailConfigStatus | null> {
  try {
    const resp = await fetch('/api/email/config-status');
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/** Download CSV string as a .csv file */
export function triggerCSVDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Copy text to clipboard with fallback */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}
