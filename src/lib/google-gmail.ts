// Real Gmail draft creation with attachments already in place — no manual
// download-and-attach step. Uses Google Identity Services (GIS) for a
// client-side OAuth token (scope: gmail.compose only — this app can create
// drafts, nothing else, never reads or sends on its own) and the Gmail API
// to create the draft directly with the PDF(s) embedded.
//
// Setup: a Google Cloud OAuth "Web application" client must exist with
// VITE_GOOGLE_GMAIL_CLIENT_ID set to its Client ID (public, safe to ship in
// the bundle — no secret is used or needed for this flow) and this app's
// origin listed under Authorized JavaScript origins. See
// server/doc-templates/README.md sibling docs / chat history for the exact
// Google Cloud Console steps already completed for camelot-os-drive.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';

let gisLoadPromise: Promise<void> | null = null;
let cachedToken: { token: string; expiresAt: number } | null = null;

export function isGmailComposeConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_GMAIL_CLIENT_ID?.trim());
}

function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

/**
 * Gets a gmail.compose-scoped access token, prompting a Google sign-in /
 * consent popup the first time (or whenever the cached token has expired).
 * Must be called from inside a user-gesture handler (a click), since GIS's
 * popup can be blocked otherwise.
 */
export async function getGmailComposeToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_GMAIL_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error('Gmail auto-attach is not configured (VITE_GOOGLE_GMAIL_CLIENT_ID missing).');
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  await loadGis();
  const google = (window as any).google;
  return new Promise((resolve, reject) => {
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GMAIL_SCOPE,
        callback: (resp: any) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          cachedToken = { token: resp.access_token, expiresAt: Date.now() + (resp.expires_in || 3600) * 1000 };
          resolve(resp.access_token);
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || 'Google sign-in was closed or failed'));
        },
      });
      tokenClient.requestAccessToken({ prompt: cachedToken ? '' : 'consent' });
    } catch (e: any) {
      reject(e);
    }
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip the "data:<mime>;base64," prefix
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function toBase64Url(base64Standard: string): string {
  return base64Standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Wraps base64 content at 76 chars/line, the MIME-standard line length.
function wrapBase64(base64: string): string {
  return base64.replace(/(.{76})/g, '$1\r\n');
}

export interface GmailDraftAttachment {
  blob: Blob;
  filename: string;
  mimeType: string;
}

/**
 * Builds an RFC 2822 multipart/mixed MIME message (body + N attachments),
 * base64url-encoded, ready for the Gmail API's drafts.create `raw` field.
 * Kept under the 5MB inline-raw limit for anything this app sends
 * (proposal + engagement report PDFs run well under that). Assembled as a
 * Blob (not a plain JS string) so large base64 attachment payloads never
 * hit a string-length/encoding edge case in the browser.
 */
async function buildRawMimeMessageSafe(params: {
  to: string;
  subject: string;
  bodyText: string;
  attachments: GmailDraftAttachment[];
}): Promise<string> {
  const boundary = `camelot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const head = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    params.bodyText,
    '',
  ].join('\r\n');

  const parts: BlobPart[] = [head];
  for (const att of params.attachments) {
    const base64 = wrapBase64(await blobToBase64(att.blob));
    const partHead = [
      `\r\n--${boundary}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${att.filename}"`,
      '',
      '',
    ].join('\r\n');
    parts.push(partHead, base64);
  }
  parts.push(`\r\n--${boundary}--\r\n`);

  const mimeBlob = new Blob(parts, { type: 'message/rfc822' });
  const mimeBase64 = await blobToBase64(mimeBlob);
  return toBase64Url(mimeBase64);
}

export interface CreateGmailDraftResult {
  draftId: string;
  messageId: string;
  draftUrl: string;
}

/**
 * Creates a real Gmail draft — recipient, subject, body, and attachment(s)
 * all already in place. The user still reviews and clicks Send themselves;
 * this never sends automatically.
 */
export async function createGmailDraftWithAttachments(params: {
  accessToken: string;
  to: string;
  subject: string;
  bodyText: string;
  attachments: GmailDraftAttachment[];
}): Promise<CreateGmailDraftResult> {
  const raw = await buildRawMimeMessageSafe(params);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Gmail API error (${res.status})`);
  }
  const data = await res.json();
  return {
    draftId: data.id,
    messageId: data.message?.id,
    draftUrl: `https://mail.google.com/mail/u/0/#drafts?compose=${data.message?.id || data.id}`,
  };
}
