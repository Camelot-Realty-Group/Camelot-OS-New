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

function pdfOptions(filename: string, isSlideDeck: boolean) {
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
      // Belt-and-suspenders: the real fix for the blank-PDF bug is that the
      // target now lives in its own isolated iframe document (see
      // buildPdfFrame) rather than being injected into the live app's DOM,
      // so html2canvas never has to clone the full dashboard shell. That
      // iframe document is always freshly created and unscrolled, but
      // pinning scrollX/Y to 0 costs nothing and guards against any future
      // regression back toward capturing an element that isn't at (0,0).
      scrollX: 0,
      scrollY: 0,
    },
    jsPDF: { unit: 'in', format: 'letter', orientation: isSlideDeck ? 'landscape' : 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] },
  }) as any;
}

/** Download an HTML report as a PDF using the browser-side renderer. */
export async function downloadAsPDF(html: string, filename: string): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const { frame, target, isSlideDeck } = await buildPdfFrame(html);
  try {
    await html2pdf().from(target).set(pdfOptions(filename, isSlideDeck)).save();
  } finally {
    frame.remove();
  }
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
    const blob: Blob = await html2pdf().from(target).set(pdfOptions(filename, isSlideDeck)).outputPdf('blob');
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
