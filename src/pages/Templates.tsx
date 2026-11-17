import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  Eye,
  Printer,
  Mail,
  Receipt,
  FileEdit,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { authenticatedApiFetch } from '@/lib/api-auth';
import {
  DOCUMENT_TEMPLATES,
  getTemplatesByCategory,
  type DocumentTemplate,
  type TemplateField,
} from '@/lib/document-templates';
import { getTemplateFiles } from '@/lib/template-library-files';
import { createTemplate, deleteTemplate, fetchTemplates, type MerlinTemplate } from '@/lib/merlin-api';

// Template Concierge — restyled July 31 2026 per David: editorial-magazine
// treatment (Vogue / GQ / Architectural Digest), ink-on-cream, serif display
// headlines, hairline rules, gold accents. This is the house style for every
// page going forward. The original dark-theme classes rendered white-on-white
// inside the light Layout shell and were unreadable.
//
// Aug 16 2026: every template — wired to the fill-in generator or not — now
// carries its real branded file (View / Download Word / Fillable PDF /
// Email / Send to Template Billing), sourced from the Camelot Template
// Library. "Fill Questionnaire & Generate" stays available only for
// templates with a merge-tag master wired server-side.

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
}) {
  const base =
    'w-full rounded-md border border-[#1a2744]/20 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#B8973A] focus:ring-1 focus:ring-[#B8973A]/40 focus:outline-none';
  if (field.type === 'textarea') {
    return (
      <textarea
        className={cn(base, 'min-h-[90px] resize-y')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.label}
      />
    );
  }
  if (field.type === 'select' && field.options) {
    return (
      <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {field.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className={base}
      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.label}
    />
  );
}

function TemplateFillPanel({ template, onClose }: { template: DocumentTemplate; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const missingRequired = template.fields.filter((f) => f.required && !answers[f.key]?.trim());

  const handleGenerate = async () => {
    if (missingRequired.length > 0) {
      toast.error(`Please fill in: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }
    setBusy(true);
    try {
      const res = await authenticatedApiFetch('/api/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id, answers }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generation failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Camelot_${template.id}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Document generated — check your downloads.');
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not generate document');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-none border border-[#1a2744]/15 border-t-2 border-t-[#B8973A] bg-white p-8 space-y-5 shadow-[0_10px_30px_rgba(26,39,68,0.06)]">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-[#B8973A] font-bold mb-2">The Questionnaire</div>
          <h3 className="font-heading text-3xl italic text-slate-950 leading-tight">{template.title}</h3>
        </div>
        <button onClick={onClose} className="text-xs uppercase tracking-[0.18em] text-slate-400 hover:text-slate-900 font-bold mt-2">
          Close
        </button>
      </div>
      <p className="text-[15px] leading-relaxed text-slate-600 max-w-2xl border-l-2 border-[#B8973A]/50 pl-4 italic">
        {template.description}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-1">
        {template.fields.map((field) => (
          <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {field.label}
              {field.required && <span className="text-[#B8973A]"> *</span>}
            </label>
            <FieldInput
              field={field}
              value={answers[field.key] || ''}
              onChange={(v) => setAnswers((a) => ({ ...a, [field.key]: v }))}
            />
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-[#1a2744]/10">
        <button
          onClick={handleGenerate}
          disabled={busy}
          className="inline-flex items-center gap-2 bg-[#1a2744] px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white hover:bg-[#B8973A] transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generate &amp; Download
        </button>
      </div>
    </div>
  );
}

// One outbound email compose can't attach a file — that's a browser security
// restriction, not a bug (see the same pattern/comment in InstantProposal.tsx
// and Agreements.tsx). So Email here downloads the file, copies a short note
// to the clipboard, and opens a mailto: draft the user pastes into and
// attaches the just-downloaded file to.
function emailTemplate(template: DocumentTemplate, fileUrl: string, fileLabel: string) {
  const a = document.createElement('a');
  a.href = fileUrl;
  a.download = '';
  a.click();
  const subject = `Camelot ${template.title}`;
  const body =
    `Hi,\n\nAttached is Camelot's ${template.title} (${fileLabel}) for your reference.\n\n` +
    `Warm regards,\nCamelot Realty Group`;
  navigator.clipboard?.writeText(body).catch(() => {});
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
  toast.success(`${fileLabel} downloading — a draft is opening; attach the file and paste the note (already on your clipboard).`, { duration: 8000 });
}

function templateCopyText(template: DocumentTemplate) {
  const fields = template.fields.map((field) => `- ${field.label}${field.required ? ' (required)' : ''}`).join('\n');
  return [template.title, template.category, template.description, fields && `Fields:\n${fields}`].filter(Boolean).join('\n\n');
}

async function copyText(text: string, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('Clipboard is blocked in this browser.');
  }
}

function TemplateCard({
  t,
  onFill,
  onPreview,
}: {
  t: DocumentTemplate;
  onFill: () => void;
  onPreview: () => void;
}) {
  const navigate = useNavigate();
  const fileSet = getTemplateFiles(t.id);

  const sendToBilling = () => {
    const params = new URLSearchParams({ templateId: t.id, title: t.title, category: t.category });
    navigate(`/template-billing?${params.toString()}`);
  };

  return (
    <div
      className={cn(
        'group flex flex-col gap-3 border bg-white p-5 text-left transition-all',
        'border-[#1a2744]/15 hover:border-[#B8973A] hover:shadow-[0_10px_30px_rgba(26,39,68,0.08)]'
      )}
    >
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center bg-[#1a2744] text-[#F4D26A] group-hover:bg-[#B8973A] group-hover:text-white transition-colors">
          <FileText className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[15px] text-slate-950 leading-snug">{t.title}</span>
            {t.ready ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Clock className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{t.description}</p>
          {!t.ready && (
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">
              Fill-in generator in production — blank template available below
            </p>
          )}
        </div>
      </div>

      {/* File actions — always available for every catalogued template */}
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#1a2744]/10">
        {t.ready && (
          <button
            onClick={onFill}
            className="inline-flex items-center gap-1.5 bg-[#1a2744] text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-[#B8973A] transition-colors"
          >
            <FileEdit className="h-3 w-3" /> Fill &amp; Generate
          </button>
        )}
        <button
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 border border-[#1a2744]/20 text-slate-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
        >
          <Eye className="h-3 w-3" /> Preview
        </button>
        <button
          onClick={() => void copyText(templateCopyText(t), 'Template summary copied')}
          className="inline-flex items-center gap-1.5 border border-[#1a2744]/20 text-slate-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
        {fileSet ? (
          <>
            <a
              href={fileSet.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-[#1a2744]/20 text-slate-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
            >
              <Eye className="h-3 w-3" /> View / Print
            </a>
            <a
              href={fileSet.docxUrl}
              download
              className="inline-flex items-center gap-1.5 border border-[#1a2744]/20 text-slate-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
            >
              <Download className="h-3 w-3" /> Word
            </a>
            {fileSet.fillablePdfUrl && (
              <a
                href={fileSet.fillablePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-[#1a2744]/20 text-slate-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
              >
                <Printer className="h-3 w-3" /> Fillable PDF
              </a>
            )}
            <button
              onClick={() => emailTemplate(t, fileSet.docxUrl, 'Word doc')}
              className="inline-flex items-center gap-1.5 border border-[#1a2744]/20 text-slate-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
            >
              <Mail className="h-3 w-3" /> Email
            </button>
            <button
              onClick={sendToBilling}
              className="inline-flex items-center gap-1.5 border border-[#1a2744]/20 text-slate-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
            >
              <Receipt className="h-3 w-3" /> Bill for This
            </button>
          </>
        ) : (
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold py-1.5">File not uploaded yet</span>
        )}
      </div>
    </div>
  );
}

export default function Templates() {
  const grouped = useMemo(() => getTemplatesByCategory(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<MerlinTemplate[]>([]);
  const [savedWarning, setSavedWarning] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftKind, setDraftKind] = useState<MerlinTemplate['kind']>('letter');
  const [draftBody, setDraftBody] = useState('');
  const active = DOCUMENT_TEMPLATES.find((t) => t.id === activeId) || null;
  const preview = DOCUMENT_TEMPLATES.find((t) => t.id === previewId) || null;
  const needle = query.trim().toLowerCase();

  const loadSaved = () => {
    fetchTemplates()
      .then((data) => {
        setSaved(data.templates || []);
        setSavedWarning(data.warning);
      })
      .catch((error: Error) => setSavedWarning(error.message));
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const saveDraft = async () => {
    if (!draftTitle.trim()) {
      toast.error('A saved template needs a title.');
      return;
    }
    try {
      await createTemplate({
        title: draftTitle.trim(),
        kind: draftKind,
        body: draftBody,
        description: 'Saved from the Template Library.',
        source: 'staff',
      });
      setDraftTitle('');
      setDraftBody('');
      toast.success('Template saved for Merlin.');
      loadSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the template');
    }
  };

  return (
    <div className="min-h-full bg-[#FAF8F5]">
      <div className="bg-[#071018] text-white border-b border-[#e8cc5a]/20 px-8 md:px-14 pt-10 pb-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.42em] text-[#e8cc5a] font-bold text-center">Template library</p>
          <h1 className="font-heading text-5xl md:text-6xl text-white text-center leading-[1.05] mt-3">
            Template Concierge
          </h1>
          <p className="text-center text-[15px] text-slate-300 mt-4 max-w-2xl mx-auto leading-relaxed">
            Browse the Camelot document catalog, preview a summary, and copy it. Checkmarks can still be filled into a branded Word file. Saved copies below are the rows Merlin can read through the API.
          </p>
          <label className="mt-6 block max-w-xl mx-auto text-xs uppercase tracking-[0.18em] text-slate-400">
            Search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Proposals, letters, notices, board reports, emails"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm normal-case tracking-normal text-white placeholder:text-slate-500"
            />
          </label>
        </div>
      </div>

      <main className="px-8 md:px-14 py-10 max-w-5xl mx-auto space-y-12">
        <section className="border border-[#1a2744]/15 bg-white p-5">
          <h2 className="font-heading text-2xl italic text-slate-950">Saved for Merlin</h2>
          <p className="mt-1 text-sm text-slate-600">
            This list starts empty. Nothing here is a sample letter. Add a real template when you want the agent to reuse it.
          </p>
          {savedWarning && <p className="mt-2 text-sm text-amber-800">{savedWarning}</p>}
          {saved.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No saved templates yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200">
              {saved
                .filter((item) => !needle || `${item.title} ${item.kind} ${item.body}`.toLowerCase().includes(needle))
                .map((item) => (
                  <li key={item.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{item.title}</div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.kind.replace('_', ' ')} · {item.category}</p>
                        {item.body && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.body}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void copyText(item.body || item.title, 'Template copied')} className="text-[11px] font-bold uppercase tracking-wider text-[#1a2744]">
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void deleteTemplate(item.id).then(loadSaved).catch((error: Error) => toast.error(error.message));
                          }}
                          className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          )}
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Title" className="rounded-md border border-[#1a2744]/20 px-3 py-2 text-sm" />
            <select value={draftKind} onChange={(event) => setDraftKind(event.target.value as MerlinTemplate['kind'])} className="rounded-md border border-[#1a2744]/20 bg-white px-3 py-2 text-sm text-slate-900">
              {['proposal', 'letter', 'notice', 'board_report', 'email', 'other'].map((kind) => (
                <option key={kind} value={kind}>{kind.replace('_', ' ')}</option>
              ))}
            </select>
            <input value={draftBody} onChange={(event) => setDraftBody(event.target.value)} placeholder="Body to copy later" className="md:col-span-2 rounded-md border border-[#1a2744]/20 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void saveDraft()} className="md:col-span-4 w-fit bg-[#1a2744] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white">
              Save template
            </button>
          </div>
        </section>

        {preview && (
          <section className="rounded-none border border-[#1a2744]/15 border-t-2 border-t-[#B8973A] bg-white p-8 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-[#B8973A] font-bold mb-2">Preview</div>
                <h3 className="font-heading text-3xl italic text-slate-950">{preview.title}</h3>
              </div>
              <button onClick={() => setPreviewId(null)} className="text-xs uppercase tracking-[0.18em] text-slate-400 font-bold">Close</button>
            </div>
            <p className="text-slate-600">{preview.description}</p>
            <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-[#FAF8F5] p-4 border border-[#1a2744]/10">{templateCopyText(preview)}</pre>
            <button type="button" onClick={() => void copyText(templateCopyText(preview), 'Preview copied')} className="inline-flex items-center gap-2 bg-[#1a2744] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white">
              <Copy className="h-3.5 w-3.5" /> Copy summary
            </button>
          </section>
        )}

        {active && <TemplateFillPanel template={active} onClose={() => setActiveId(null)} />}

        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((category) => {
          const items = grouped[category].filter((template) => {
            if (!needle) return true;
            return `${template.title} ${template.category} ${template.description}`.toLowerCase().includes(needle);
          });
          if (items.length === 0) return null;
          return (
          <section key={category}>
            <div className="flex items-baseline gap-4 mb-5">
              <h2 className="font-heading text-2xl italic text-slate-950 whitespace-nowrap">{category}</h2>
              <div className="h-px flex-1 bg-[#1a2744]/15 translate-y-[-4px]" />
              <span className="text-[10px] uppercase tracking-[0.24em] text-slate-400 font-bold">
                {items.length} {items.length === 1 ? 'document' : 'documents'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((t) => (
                <TemplateCard key={t.id} t={t} onFill={() => setActiveId(t.id)} onPreview={() => setPreviewId(t.id)} />
              ))}
            </div>
          </section>
          );
        })}

        <div className="pt-2 pb-8 text-center">
          <div className="h-px w-24 bg-[#B8973A]/50 mx-auto mb-4" />
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400 font-bold">
            Camelot Property Management &middot; New York
          </p>
        </div>
      </main>
    </div>
  );
}
