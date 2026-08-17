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

function buildPdfWrapper(html: string): { wrapper: HTMLDivElement; isSlideDeck: boolean } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(ensureHtmlBase(html), 'text/html');
  doc.querySelectorAll('.no-print, .deck-action-bar, .proposal-action-bar').forEach(el => el.remove());

  const wrapper = document.createElement('div');
  const isSlideDeck = Boolean(doc.querySelector('.slide'));
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = isSlideDeck ? '11in' : '8.5in';
  wrapper.style.background = '#fff';
  wrapper.innerHTML = `${doc.head.innerHTML}${doc.body.innerHTML}`;
  document.body.appendChild(wrapper);
  return { wrapper, isSlideDeck };
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
      // The wrapper is captured off-screen via position:fixed + a large
      // negative left offset. html2canvas's default behavior compensates
      // for the page's current scroll position when it clones the DOM,
      // which double-counts against a fixed-position element and shifts
      // the rendered content entirely outside the captured canvas —
      // producing a structurally valid but visually blank PDF whenever the
      // page has been scrolled before Generate is clicked (the normal
      // case, since the button sits below the fold). Pinning scrollX/Y to
      // 0 here neutralizes that compensation.
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
  const { wrapper, isSlideDeck } = buildPdfWrapper(html);
  try {
    await html2pdf().from(wrapper).set(pdfOptions(filename, isSlideDeck)).save();
  } finally {
    wrapper.remove();
  }
}

/**
 * Render an HTML report to a PDF and return it as base64 (no filesystem
 * write) so it can be attached to a real outgoing email via
 * sendCamelotEmail() instead of only ever being saved locally.
 */
export async function generatePdfBase64(html: string, filename: string): Promise<string> {
  const html2pdf = (await import('html2pdf.js')).default;
  const { wrapper, isSlideDeck } = buildPdfWrapper(html);
  try {
    const blob: Blob = await html2pdf().from(wrapper).set(pdfOptions(filename, isSlideDeck)).outputPdf('blob');
    const dataUrl = await blobToDataUrl(blob);
    // Strip the "data:application/pdf;base64," prefix — Resend wants the raw base64 payload.
    const commaIndex = dataUrl.indexOf(',');
    return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  } finally {
    wrapper.remove();
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
