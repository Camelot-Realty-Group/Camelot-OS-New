/**
 * PartnerPitches.tsx — dedicated Partner Pitch Decks page.
 *
 * David (July 31 2026): the decks were buried at the bottom of Report Center
 * and the firm-personalization was invisible. This page gives every audience
 * its own card with the firm/contact inputs IN PLAIN SIGHT — type the firm,
 * hit Generate, deck opens personalized and archives to the library.
 */
import { useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Briefcase, Building2, Calculator, Coffee, FileSearch, Gavel, Landmark } from 'lucide-react';
import {
  PARTNER_AUDIENCES,
  buildPartnerPitchFilename,
  generatePartnerPitchDeck,
  type PartnerAudience,
} from '@/lib/partner-pitch';
import { openBrochureForPrint } from '@/lib/pdf-generator';
import { saveJackieReportRecord, type SavedJackieReport } from '@/lib/jackie-report-library';

const AUDIENCE_ICONS: Record<PartnerAudience, ReactNode> = {
  law: <Gavel size={22} />,
  accounting: <Calculator size={22} />,
  audit: <FileSearch size={22} />,
  brokerage: <Building2 size={22} />,
  receivership: <Landmark size={22} />,
};

export default function PartnerPitches() {
  const [forms, setForms] = useState<Record<string, { firmName: string; contactName: string }>>({});

  const setField = (key: PartnerAudience, field: 'firmName' | 'contactName', value: string) =>
    setForms(prev => {
      const current = prev[key] || { firmName: '', contactName: '' };
      return { ...prev, [key]: { ...current, [field]: value } };
    });

  const generate = (key: PartnerAudience, label: string) => {
    const firm = { firmName: (forms[key]?.firmName || '').trim(), contactName: (forms[key]?.contactName || '').trim() };
    const html = generatePartnerPitchDeck(key, firm);
    const filename = buildPartnerPitchFilename(key, 'pdf', firm);
    openBrochureForPrint(html, filename);
    const record: SavedJackieReport = {
      id: crypto.randomUUID(),
      reportNumber: `PP-${Date.now().toString(36).toUpperCase()}`,
      address: firm.firmName ? `Partner Pitch — ${firm.firmName}` : `Camelot Partner Pitch — ${label}`,
      buildingName: firm.firmName || `Partner Pitch: ${label}`,
      packageType: 'partner_pitch' as SavedJackieReport['packageType'],
      packageLabel: `Partner Pitch — ${label}${firm.firmName ? ` (${firm.firmName})` : ''}`,
      filename,
      html,
      inquiryContact: firm.contactName || undefined,
      focus: [],
      generatedAt: new Date().toISOString(),
    };
    saveJackieReportRecord(record);
    toast.success(`${firm.firmName || label} deck opened — archived to the report library`);
  };

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
          Firm-level decks for the professionals who put management companies in front of boards and landlords.
          Type the firm and contact so the cover, working-together page, and coffee invite speak to them by name —
          or leave blank for the generic version. Every deck includes who Camelot is, the Camelot OS intelligence
          teaser, the coverage map, case studies, the loyalty promise, and the M&amp;A conversation starter.
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
                  value={forms[aud.key]?.firmName || ''}
                  onChange={e => setField(aud.key, 'firmName', e.target.value)}
                  placeholder="Firm / company name (personalizes the deck)"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <input
                  value={forms[aud.key]?.contactName || ''}
                  onChange={e => setField(aud.key, 'contactName', e.target.value)}
                  placeholder="Contact name (optional)"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <button
                onClick={() => generate(aud.key, aud.label)}
                className="mt-4 w-full px-4 py-2.5 bg-[#5B4A1F] text-white rounded-lg hover:bg-[#473916] text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Coffee size={15} /> Generate {forms[aud.key]?.firmName ? `for ${forms[aud.key].firmName}` : 'Deck'}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-6">
          Generated decks archive to the Report Library (Engagement Reports page), log to the database under
          New Business Leads and Pitches, and queue to HubSpot with the firm and contact attached.
        </p>
      </main>
    </div>
  );
}
