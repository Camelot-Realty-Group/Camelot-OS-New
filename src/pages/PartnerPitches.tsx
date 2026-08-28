/**
 * PartnerPitches.tsx — dedicated Partner Pitch Decks page.
 *
 * Every audience card carries the full action set (David, July 31 2026):
 * open/print, download PDF, download HTML, email the deck as a PDF
 * attachment to a recipient, and push the firm + activity to HubSpot.
 */
import { useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Briefcase, Building2, Calculator, Download, FileCode, FileSearch, Gavel, Landmark, Link2, Mail, Printer, Users } from 'lucide-react';
import {
  PARTNER_AUDIENCES,
  buildPartnerPitchFilename,
  generatePartnerPitchDeck,
  type PartnerAudience,
  type PartnerFirmInfo,
} from '@/lib/partner-pitch';
import { downloadAsHTML, downloadAsPDF, openBrochureForPrint, sendCamelotEmail } from '@/lib/pdf-generator';
import { saveJackieReportRecord, type SavedJackieReport } from '@/lib/jackie-report-library';
import { trackReportWorkflowEvent, type ReportWorkflowAction } from '@/lib/report-crm-tracking';
import type { Building } from '@/types';

const AUDIENCE_ICONS: Record<PartnerAudience, ReactNode> = {
  law: <Gavel size={22} />,
  accounting: <Calculator size={22} />,
  audit: <FileSearch size={22} />,
  brokerage: <Building2 size={22} />,
  receivership: <Landmark size={22} />,
  neighbor: <Users size={22} />,
};

interface CardForm { firmName: string; contactName: string; recipientEmail: string; }
const emptyForm: CardForm = { firmName: '', contactName: '', recipientEmail: '' };

export default function PartnerPitches() {
  const [forms, setForms] = useState<Record<string, CardForm>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const formFor = (key: PartnerAudience): CardForm => forms[key] || emptyForm;
  const setField = (key: PartnerAudience, field: keyof CardForm, value: string) =>
    setForms(prev => {
      const current = prev[key] || emptyForm;
      return { ...prev, [key]: { ...current, [field]: value } };
    });

  const buildDeck = (key: PartnerAudience) => {
    const f = formFor(key);
    const firm: PartnerFirmInfo = { firmName: f.firmName.trim(), contactName: f.contactName.trim() };
    return {
      firm,
      html: generatePartnerPitchDeck(key, firm),
      pdfName: buildPartnerPitchFilename(key, 'pdf', firm),
      htmlName: buildPartnerPitchFilename(key, 'html', firm),
    };
  };

  const archive = (key: PartnerAudience, label: string, html: string, filename: string, firm: PartnerFirmInfo, note: string) => {
    const record: SavedJackieReport = {
      id: crypto.randomUUID(),
      reportNumber: `PP-${Date.now().toString(36).toUpperCase()}`,
      address: firm.firmName ? `Partner Pitch — ${firm.firmName}` : `Camelot Partner Pitch — ${label}`,
      buildingName: firm.firmName || `Partner Pitch: ${label}`,
      packageType: 'partner_pitch' as SavedJackieReport['packageType'],
      packageLabel: `Partner Pitch — ${label}${firm.firmName ? ` (${firm.firmName})` : ''} · ${note}`,
      filename,
      html,
      inquiryContact: firm.contactName || undefined,
      inquiryEmail: formFor(key).recipientEmail.trim() || undefined,
      focus: [],
      generatedAt: new Date().toISOString(),
    };
    saveJackieReportRecord(record);
  };

  /** Synthetic Building so partner firms flow through the same HubSpot pipeline as property leads. */
  const firmAsBuilding = (key: PartnerAudience, label: string): Building => {
    const f = formFor(key);
    return {
      id: `partner-${key}-${(f.firmName || label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      address: `${f.firmName || label} (professional partner)`,
      name: f.firmName || label,
      type: 'other',
      grade: 'A',
      score: 80,
      score_breakdown: { partner_channel: 80 },
      signals: [`partner_pitch:${key}`],
      contacts: f.contactName || f.recipientEmail ? [{
        name: f.contactName || f.firmName || label,
        role: 'partner_contact',
        email: f.recipientEmail.trim() || undefined,
        company: f.firmName || undefined,
        source: 'partner_pitch_page',
      }] : [],
      enriched_data: { audience: key, channel: 'professional_partner' },
      status: 'active',
      tags: ['partner_pitch', key],
      pipeline_stage: 'contacted',
      violations_count: 0,
      open_violations_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  const trackAction = (key: PartnerAudience, label: string, action: ReportWorkflowAction, filename: string, html: string) => {
    const f = formFor(key);
    void trackReportWorkflowEvent({
      building: firmAsBuilding(key, label),
      packageType: 'partner_pitch',
      packageLabel: `Partner Pitch — ${label}${f.firmName ? ` (${f.firmName})` : ''}`,
      action,
      filename,
      html,
      recipients: f.recipientEmail.trim() ? [f.recipientEmail.trim()] : [],
      metadata: { audience: key, firmName: f.firmName, contactName: f.contactName },
    });
  };

  const run = async (key: PartnerAudience, label: string, kind: 'open' | 'pdf' | 'html' | 'email' | 'hubspot') => {
    const busyKey = `${key}:${kind}`;
    if (busy) return;
    setBusy(busyKey);
    try {
      const { firm, html, pdfName, htmlName } = buildDeck(key);
      const f = formFor(key);
      if (kind === 'open') {
        openBrochureForPrint(html, pdfName);
        archive(key, label, html, pdfName, firm, 'opened');
        trackAction(key, label, 'generated', pdfName, html);
        toast.success(`${firm.firmName || label} deck opened — archived to the library`);
      } else if (kind === 'pdf') {
        await downloadAsPDF(html, pdfName);
        archive(key, label, html, pdfName, firm, 'PDF downloaded');
        trackAction(key, label, 'downloaded', pdfName, html);
        toast.success(`PDF downloading — ${pdfName}`);
      } else if (kind === 'html') {
        await downloadAsHTML(html, htmlName);
        archive(key, label, html, htmlName, firm, 'HTML downloaded');
        trackAction(key, label, 'downloaded', htmlName, html);
        toast.success(`HTML downloading — ${htmlName}`);
      } else if (kind === 'email') {
        const to = f.recipientEmail.trim();
        if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
          toast.error('Enter the recipient’s email on this card first');
          return;
        }
        toast.loading('Rendering PDF and sending…', { id: busyKey });
        const firstName = (f.contactName || '').split(' ')[0];
        const result = await sendCamelotEmail({
          to,
          replyTo: 'dgoldoff@camelot.nyc',
          subject: `Camelot Property Management × ${f.firmName || label}`,
          html: `<p>${firstName ? `Dear ${firstName},` : 'Hello,'}</p>
<p>Thank you for the opportunity to introduce Camelot Property Management. Attached is a short deck on who we are, the portfolio we manage across New York, and the specific ways we work alongside ${f.firmName ? f.firmName : label.toLowerCase()} — including our commitment that when your firm recommends Camelot, your firm stays on with the client.</p>
<p>Thirty minutes over coffee — or a bucket of balls at Chelsea Piers — and we’ll find the two or three ways we can make each other’s work easier this year.</p>
<p>Warm regards,<br><strong>David A. Goldoff</strong><br>President, Camelot Property Management Services Corp.<br>(212) 206-9939 x701 &middot; dgoldoff@camelot.nyc &middot; www.camelot.nyc</p>`,
          reportHtml: html,
          attachmentFilename: pdfName,
        });
        toast.dismiss(busyKey);
        if (!result.ok) {
          toast.error(result.error || 'Send failed — check RESEND_API_KEY in Render');
        } else {
          archive(key, label, html, pdfName, firm, `emailed to ${to}`);
          trackAction(key, label, 'email_sent', pdfName, html);
          toast.success(`Sent to ${to} with ${pdfName} attached`);
        }
      } else if (kind === 'hubspot') {
        toast.loading('Pushing to HubSpot…', { id: busyKey });
        archive(key, label, html, pdfName, firm, 'pushed to HubSpot');
        trackAction(key, label, 'hubspot_push', pdfName, html);
        toast.dismiss(busyKey);
        toast.success(`${f.firmName || label} queued to HubSpot with the deck activity`);
      }
    } catch (e: any) {
      toast.dismiss(busyKey);
      toast.error(e?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const actionBtn = (key: PartnerAudience, label: string, kind: 'open' | 'pdf' | 'html' | 'email' | 'hubspot', icon: ReactNode, text: string, cls: string) => (
    <button
      onClick={() => void run(key, label, kind)}
      disabled={busy !== null}
      className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-bold ${cls} disabled:opacity-50`}
    >
      {icon} {text}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F7F4ED]">
      <div className="bg-white border-b border-slate-200 px-8 py-7">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-camelot-gold/15 text-camelot-gold flex items-center justify-center">
            <Briefcase size={24} />
          </span>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-camelot-gold font-bold">Engagement — Pitches</div>
            <h1 className="font-heading text-3xl text-slate-950">Partner Pitch Decks</h1>
          </div>
        </div>
        <p className="text-slate-600 mt-4 max-w-4xl leading-relaxed">
          Type the firm, the contact, and (for sending) their email. Then: open and print, download as PDF or HTML,
          email the deck as a PDF attachment, or push the firm and activity straight into HubSpot. Every action
          archives to the report library and logs to the database.
        </p>
      </div>

      <main className="px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {PARTNER_AUDIENCES.map(aud => (
            <div key={aud.key} className="bg-white rounded-2xl border border-[#A89035]/40 p-5 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-11 h-11 rounded-xl bg-camelot-gold/10 text-camelot-gold flex items-center justify-center">
                  {AUDIENCE_ICONS[aud.key]}
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-950">{aud.label}</div>
                  <div className="text-[11px] text-slate-500 leading-tight">{aud.description}</div>
                </div>
              </div>
              <div className="space-y-2 mt-3 flex-1">
                <input
                  value={formFor(aud.key).firmName}
                  onChange={e => setField(aud.key, 'firmName', e.target.value)}
                  placeholder="Firm / company name (personalizes the deck)"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <input
                  value={formFor(aud.key).contactName}
                  onChange={e => setField(aud.key, 'contactName', e.target.value)}
                  placeholder="Contact name (optional)"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <input
                  value={formFor(aud.key).recipientEmail}
                  onChange={e => setField(aud.key, 'recipientEmail', e.target.value)}
                  placeholder="Recipient email (for Email + HubSpot)"
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-4">
                {actionBtn(aud.key, aud.label, 'open', <Printer size={13} />, 'Open', 'bg-[#5B4A1F] text-white hover:bg-[#473916] col-span-3')}
                {actionBtn(aud.key, aud.label, 'pdf', <Download size={13} />, 'PDF', 'bg-[#1a2744] text-white hover:bg-[#26375c]')}
                {actionBtn(aud.key, aud.label, 'html', <FileCode size={13} />, 'HTML', 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50')}
                {actionBtn(aud.key, aud.label, 'hubspot', <Link2 size={13} />, 'HubSpot', 'bg-orange-500 text-white hover:bg-orange-600')}
                {actionBtn(aud.key, aud.label, 'email', <Mail size={13} />, 'Email PDF to Recipient', 'bg-emerald-700 text-white hover:bg-emerald-800 col-span-3')}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-6">
          Email sends from the Camelot server (Resend) with the PDF attached and your reply-to set to dgoldoff@camelot.nyc.
          HubSpot pushes create/update the firm with the contact, deck name, sender, date, and a follow-up task.
        </p>
      </main>
    </div>
  );
}
