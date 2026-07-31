import { useMemo, useState } from 'react';
import { FileText, Download, Loader2, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  DOCUMENT_TEMPLATES,
  getTemplatesByCategory,
  type DocumentTemplate,
  type TemplateField,
} from '@/lib/document-templates';

// Template Concierge — restyled July 31 2026 per David: editorial-magazine
// treatment (Vogue / GQ / Architectural Digest), ink-on-cream, serif display
// headlines, hairline rules, gold accents. This is the house style for every
// page going forward. The original dark-theme classes rendered white-on-white
// inside the light Layout shell and were unreadable.

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
      const res = await fetch('/api/templates/generate', {
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

export default function Templates() {
  const grouped = useMemo(() => getTemplatesByCategory(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = DOCUMENT_TEMPLATES.find((t) => t.id === activeId) || null;

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Masthead — magazine cover treatment */}
      <div className="bg-white border-b border-[#1a2744]/10 px-8 md:px-14 pt-12 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-px flex-1 bg-[#B8973A]/50" />
            <div className="text-[11px] uppercase tracking-[0.42em] text-[#B8973A] font-bold">Camelot OS &middot; The Document Library</div>
            <div className="h-px flex-1 bg-[#B8973A]/50" />
          </div>
          <h1 className="font-heading text-5xl md:text-6xl italic text-slate-950 text-center leading-[1.05]">
            Template Concierge
          </h1>
          <p className="text-center text-[15px] text-slate-600 mt-5 max-w-2xl mx-auto leading-relaxed">
            Choose a document. Answer a short questionnaire. Receive a finished, branded Camelot Word file —
            ready to print, email, or file. Quietly efficient, impeccably dressed.
          </p>
        </div>
      </div>

      <main className="px-8 md:px-14 py-10 max-w-5xl mx-auto space-y-12">
        {active && <TemplateFillPanel template={active} onClose={() => setActiveId(null)} />}

        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((category) => (
          <section key={category}>
            {/* Section rule — editorial department header */}
            <div className="flex items-baseline gap-4 mb-5">
              <h2 className="font-heading text-2xl italic text-slate-950 whitespace-nowrap">{category}</h2>
              <div className="h-px flex-1 bg-[#1a2744]/15 translate-y-[-4px]" />
              <span className="text-[10px] uppercase tracking-[0.24em] text-slate-400 font-bold">
                {grouped[category].length} {grouped[category].length === 1 ? 'document' : 'documents'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {grouped[category].map((t) => (
                <button
                  key={t.id}
                  onClick={() => t.ready && setActiveId(t.id)}
                  disabled={!t.ready}
                  className={cn(
                    'group flex items-start gap-4 border bg-white p-5 text-left transition-all',
                    t.ready
                      ? 'border-[#1a2744]/15 hover:border-[#B8973A] hover:shadow-[0_10px_30px_rgba(26,39,68,0.08)] cursor-pointer'
                      : 'border-[#1a2744]/10 opacity-55 cursor-not-allowed'
                  )}
                >
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
                      <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">In production</p>
                    )}
                  </div>
                  {t.ready && <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#B8973A] transition-colors self-center" />}
                </button>
              ))}
            </div>
          </section>
        ))}

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
