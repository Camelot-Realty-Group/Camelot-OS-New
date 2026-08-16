import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileDown,
  FileText,
  Filter,
  Mail,
  Plus,
  Printer,
  Receipt,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBuildings } from '@/hooks/useBuildings';
import {
  TEMPLATE_RATE_SHEET,
  createBillableTaskEvent,
  createTemplateInvoiceDraft,
  formatBillingMode,
  type BillableTaskEvent,
  type TemplateCategory,
  type TemplateInvoiceDraft,
} from '@/lib/template-billing';
import { cn } from '@/lib/utils';
import { openEmailDraft, openBrochureForPrint, downloadAsPDF } from '@/lib/pdf-generator';
import { CAMELOT_LOGO_B64 } from '@/lib/camelot-brand-assets';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Building } from '@/types';

const INVOICE_LIBRARY_KEY = 'camelot_template_invoice_library_v1';
const TASK_QUEUE_KEY = 'camelot_billable_task_queue_v1';

const categoryLabels: Record<TemplateCategory | 'all', string> = {
  all: 'All Templates',
  leasing: 'Leasing',
  board_packages: 'Board Packages',
  operations: 'Operations',
  compliance: 'Compliance',
  accounting: 'Accounting',
  sales: 'Sales',
  resident: 'Resident',
  internal: 'Internal',
};

function loadInvoices(): TemplateInvoiceDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INVOICE_LIBRARY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveInvoices(invoices: TemplateInvoiceDraft[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(INVOICE_LIBRARY_KEY, JSON.stringify(invoices.slice(0, 100)));
}

function loadTaskQueue(): BillableTaskEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TASK_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTaskQueue(tasks: BillableTaskEvent[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TASK_QUEUE_KEY, JSON.stringify(tasks.slice(0, 250)));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

// Branded, printable invoice HTML — used for both "Print" (opens in a new
// tab for the browser's native print dialog) and "Download PDF" (rendered
// off-screen and rasterized to a PDF blob), so there's a real leave-behind
// document alongside the email draft.
function buildInvoiceHtml(draft: TemplateInvoiceDraft): string {
  const rows = draft.lines
    .map(
      (line) => `
      <tr>
        <td class="desc">${line.description}${line.notes ? `<div class="notes">${line.notes}</div>` : ''}</td>
        <td class="party">${line.billingParty.replace('_', ' ')}</td>
        <td class="qty">${line.quantity}</td>
        <td class="amt">${formatMoney(line.amount)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: Calibri, Arial, sans-serif; margin: 0; padding: 36px; color: #1a1a1a; }
    .brand { display:flex; align-items:center; gap:12px; margin-bottom: 18px; }
    .brand img { height: 38px; }
    .brand .name { font-size: 20px; font-weight: 700; color: #162B5E; }
    .brand .tag { font-size: 11px; color: #666; }
    h1 { font-size: 22px; color: #162B5E; margin: 18px 0 4px; }
    .meta { font-size: 12px; color: #444; margin: 2px 0; }
    .meta strong { color: #162B5E; }
    table { width: 100%; border-collapse: collapse; margin-top: 22px; font-size: 12px; }
    th { text-align: left; background: #162B5E; color: #fff; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    td { padding: 10px; border-bottom: 1px solid #E5E1D8; vertical-align: top; }
    td.amt, th.amt { text-align: right; white-space: nowrap; }
    td.notes, .notes { font-size: 10.5px; color: #777; margin-top: 2px; }
    .party { text-transform: capitalize; color: #555; }
    .total-row td { border-bottom: none; padding-top: 16px; font-weight: 700; font-size: 15px; color: #162B5E; }
    .note { margin-top: 24px; background: #F8F3E3; border: 1px solid #C5A55A55; border-radius: 6px; padding: 12px 14px; font-size: 11px; color: #5B4A1F; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #E5E1D8; font-size: 10px; color: #999; }
  </style></head><body>
    <div class="brand">
      <img src="${CAMELOT_LOGO_B64}" />
      <div><div class="name">CAMELOT REALTY GROUP</div><div class="tag">Real Estate · Property Management · Brokerage · Investment Services</div></div>
    </div>
    <h1>Invoice ${draft.invoiceNumber}</h1>
    <p class="meta"><strong>Property:</strong> ${draft.buildingAddress}${draft.buildingName ? ` (${draft.buildingName})` : ''}</p>
    ${draft.recipientName ? `<p class="meta"><strong>Bill To:</strong> ${draft.recipientName}${draft.recipientEmail ? ` — ${draft.recipientEmail}` : ''}</p>` : ''}
    <p class="meta"><strong>Date:</strong> ${new Date(draft.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} &nbsp;·&nbsp; <strong>Status:</strong> ${draft.status.replace('_', ' ')}</p>
    <table>
      <thead><tr><th>Description</th><th>Billed To</th><th>Qty</th><th class="amt">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total-row"><td colspan="3">Total Due</td><td class="amt">${formatMoney(draft.subtotal)}</td></tr></tfoot>
    </table>
    <p class="note">${draft.approvalNote}</p>
    <div class="footer">Camelot Realty Group · 57 West 57th Street, Suite 410, New York, NY 10019 · (212) 206-9939 · info@camelot.nyc · www.camelot.nyc</div>
  </body></html>`;
}

// Fire-and-forget archive to the real camelot_template_invoices /
// camelot_template_invoice_lines tables — same pattern used elsewhere in
// the app (saveProposalToLibrary, trackReportWorkflowEvent): never blocks
// the UI, and silently no-ops if Supabase isn't configured or the session
// isn't authenticated.
async function syncInvoiceToSupabase(draft: TemplateInvoiceDraft) {
  if (!isSupabaseConfigured()) return;
  try {
    const { data, error } = await supabase
      .from('camelot_template_invoices')
      .upsert(
        {
          building_address: draft.buildingAddress,
          building_name: draft.buildingName || null,
          invoice_number: draft.invoiceNumber,
          recipient_name: draft.recipientName || null,
          recipient_email: draft.recipientEmail || null,
          recipient_phone: draft.recipientPhone || null,
          status: draft.status,
          subtotal: draft.subtotal,
          total_amount: draft.subtotal,
          notes: draft.approvalNote,
          created_by: draft.createdBy,
        },
        { onConflict: 'invoice_number' }
      )
      .select('id')
      .single();
    if (error || !data) {
      console.error('Invoice Supabase sync failed:', error);
      return;
    }
    await supabase.from('camelot_template_invoice_lines').delete().eq('invoice_id', data.id);
    if (draft.lines.length) {
      await supabase.from('camelot_template_invoice_lines').insert(
        draft.lines.map((line) => ({
          invoice_id: data.id,
          template_rate_id: line.rateId,
          description: line.description,
          billing_party: line.billingParty,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          amount: line.amount,
          notes: line.notes || null,
        }))
      );
    }
  } catch (e) {
    console.error('Invoice Supabase sync error:', e);
  }
}

export default function TemplateBilling() {
  const { buildings } = useBuildings();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedRateIds, setSelectedRateIds] = useState<string[]>([
    'alteration-agreement',
    'move-in-out',
  ]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [draft, setDraft] = useState<TemplateInvoiceDraft | null>(null);
  const [invoiceLibrary, setInvoiceLibrary] = useState<TemplateInvoiceDraft[]>(() => loadInvoices());
  const [taskQueue, setTaskQueue] = useState<BillableTaskEvent[]>(() => loadTaskQueue());
  const [incomingTemplate, setIncomingTemplate] = useState<{ title: string; category: string } | null>(null);

  // Arriving from Templates.tsx's "Bill for This" link (?templateId=&title=&category=)
  // — try to find a matching rate-sheet line item and pre-select it,
  // otherwise just filter the table to the incoming title so it's one click away.
  useEffect(() => {
    const title = searchParams.get('title');
    const cat = searchParams.get('category');
    if (!title) return;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const target = norm(title);
    const matched = TEMPLATE_RATE_SHEET.find(
      (rate) => norm(rate.templateName) === target || norm(rate.templateName).includes(target) || target.includes(norm(rate.templateName))
    );
    if (matched) {
      setSelectedRateIds((current) => (current.includes(matched.id) ? current : [...current, matched.id]));
      setQuery('');
      toast.success(`Added "${matched.templateName}" to the invoice from Template Concierge.`);
    } else {
      setQuery(title);
      toast(`No rate-sheet line item found for "${title}" yet — search results filtered to it below.`, { icon: '🔍' });
    }
    setIncomingTemplate({ title, category: cat || '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId);

  const filteredRates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATE_RATE_SHEET.filter((rate) => {
      if (category !== 'all' && rate.category !== category) return false;
      if (!q) return true;
      return [
        rate.templateName,
        rate.description,
        rate.billingParty,
        rate.jurisdiction,
        rate.revenueNote,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [category, query]);

  const selectedRates = TEMPLATE_RATE_SHEET.filter((rate) => selectedRateIds.includes(rate.id));
  const projectedRevenue = selectedRates.reduce((sum, rate) => {
    if (rate.billingMode === 'included') return sum;
    return sum + rate.baseAmount;
  }, 0);

  const toggleRate = (id: string) => {
    setSelectedRateIds((current) =>
      current.includes(id) ? current.filter((rateId) => rateId !== id) : [...current, id]
    );
  };

  const handleCreateInvoice = () => {
    if (!selectedRateIds.length) {
      toast.error('Select at least one template or fee item first.');
      return;
    }

    const invoice = createTemplateInvoiceDraft({
      building: selectedBuilding as Partial<Building> | undefined,
      recipientName,
      recipientEmail,
      selectedRateIds,
      generatedBy: 'Camelot OS Template Desk',
    });

    setDraft(invoice);
    const next = [invoice, ...invoiceLibrary.filter((item) => item.id !== invoice.id)];
    setInvoiceLibrary(next);
    saveInvoices(next);
    void syncInvoiceToSupabase(invoice);
    toast.success('Invoice draft created for review.');
  };

  const handleQueueTasks = () => {
    if (!selectedRateIds.length) {
      toast.error('Select at least one billable template first.');
      return;
    }

    const nextTasks = selectedRateIds.map((rateId) =>
      createBillableTaskEvent({
        sourceBot: 'template_desk',
        rateId,
        building: selectedBuilding as Partial<Building> | undefined,
        requestedByName: recipientName || undefined,
        requestedByEmail: recipientEmail || undefined,
        payerName: recipientName || undefined,
        payerEmail: recipientEmail || undefined,
        managerOwner: 'Account Manager',
      })
    );

    const next = [...nextTasks, ...taskQueue];
    setTaskQueue(next);
    saveTaskQueue(next);
    toast.success(`${nextTasks.length} task${nextTasks.length === 1 ? '' : 's'} added to billing queue.`);
  };

  const updateTaskStatus = (taskId: string, status: BillableTaskEvent['status']) => {
    const next = taskQueue.map((task) =>
      task.id === taskId ? { ...task, status, updatedAt: new Date().toISOString() } : task
    );
    setTaskQueue(next);
    saveTaskQueue(next);
  };

  const invoiceTask = (task: BillableTaskEvent) => {
    if (!task.rateId) {
      toast.error('This task has no rate code yet.');
      return;
    }

    const invoice = createTemplateInvoiceDraft({
      building: {
        id: task.buildingId,
        address: task.buildingAddress,
        name: task.buildingName,
      },
      recipientName: task.payerName,
      recipientEmail: task.payerEmail,
      selectedRateIds: [task.rateId],
      generatedBy: 'Camelot OS Billing Queue',
      customAmounts: { [task.rateId]: task.amount },
    });

    setDraft(invoice);
    const nextInvoices = [invoice, ...invoiceLibrary.filter((item) => item.id !== invoice.id)];
    setInvoiceLibrary(nextInvoices);
    saveInvoices(nextInvoices);
    void syncInvoiceToSupabase(invoice);
    updateTaskStatus(task.id, 'invoiced');
    toast.success('Invoice draft created from queued task.');
  };

  const updateDraftStatus = (status: TemplateInvoiceDraft['status']) => {
    if (!draft) return;
    const nextDraft = { ...draft, status, updatedAt: new Date().toISOString() };
    setDraft(nextDraft);
    const next = [nextDraft, ...invoiceLibrary.filter((item) => item.id !== draft.id)];
    setInvoiceLibrary(next);
    saveInvoices(next);
    void syncInvoiceToSupabase(nextDraft);
    toast.success(`Invoice marked ${status.replace('_', ' ')}.`);
  };

  const handleQueueHubSpotSync = () => {
    if (!draft) return;
    const nextDraft: TemplateInvoiceDraft = { ...draft, hubspotSyncStatus: 'queued', updatedAt: new Date().toISOString() };
    setDraft(nextDraft);
    const next = [nextDraft, ...invoiceLibrary.filter((item) => item.id !== draft.id)];
    setInvoiceLibrary(next);
    saveInvoices(next);
    void syncInvoiceToSupabase(nextDraft);
    toast.success('Queued for HubSpot sync — will push automatically once the sync worker runs.');
  };

  const handleDownloadInvoicePdf = async () => {
    if (!draft) return;
    try {
      await downloadAsPDF(buildInvoiceHtml(draft), `Camelot-Invoice-${draft.invoiceNumber}.pdf`);
      toast.success('Invoice PDF downloaded.');
    } catch (e) {
      console.error(e);
      toast.error('Could not generate the invoice PDF.');
    }
  };

  const handlePrintInvoice = () => {
    if (!draft) return;
    openBrochureForPrint(buildInvoiceHtml(draft), `Camelot-Invoice-${draft.invoiceNumber}.pdf`);
  };

  const emailSubject = draft ? `Camelot Invoice ${draft.invoiceNumber} - ${draft.buildingAddress}` : '';
  const emailBody = draft
    ? `Hello${draft.recipientName ? ` ${draft.recipientName}` : ''},\n\n` +
      `Please find below the Camelot invoice for ${draft.buildingAddress}.\n\n` +
      `Invoice: ${draft.invoiceNumber}\n` +
      `${(draft.lines || []).map((l: any) => `- ${l.description}: ${formatMoney(l.amount)}`).join('\n')}\n` +
      `Total: ${formatMoney(draft.subtotal)}\n\n` +
      `Please contact Camelot with any questions.\n\n` +
      `Main: (212) 206-9939\nwww.camelot.nyc`
    : '';

  const handleEmailInvoice = () => {
    if (!draft) return;
    openEmailDraft({
      to: draft.recipientEmail || '',
      cc: 'info@camelot.nyc',
      subject: emailSubject,
      body: emailBody,
    });
    if (!draft.recipientEmail) {
      toast('No recipient email on this invoice — add one in the Recipient Email field, or type it into the draft.', { icon: '✉️', duration: 8000 });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6EF] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-camelot-gold">
                <Receipt size={16} />
                Camelot Template Desk
              </p>
              <h1 className="font-heading text-3xl font-semibold text-slate-950">
                Rate Sheets, Invoices & Payment Tracking
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Turn repeatable property-management forms into controlled templates with fee codes,
                invoice drafts, approval status, HubSpot handoff, and payment tracking.
              </p>
              {incomingTemplate && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#F7F1DE] px-3 py-1.5 text-xs font-semibold text-camelot-gold">
                  <Receipt size={13} /> Arrived from Template Concierge: {incomingTemplate.title}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-slate-200 bg-[#FBFAF6] p-3">
                <p className="text-2xl font-bold text-slate-950">{TEMPLATE_RATE_SHEET.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Fee Items</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-[#FBFAF6] p-3">
                <p className="text-2xl font-bold text-camelot-gold">{formatMoney(projectedRevenue)}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Selected</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-[#FBFAF6] p-3">
                <p className="text-2xl font-bold text-emerald-700">{invoiceLibrary.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Drafts</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search forms, fee items, compliance packets..."
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-camelot-gold"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as TemplateCategory | 'all')}
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-8 text-sm outline-none focus:border-camelot-gold md:w-56"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#314456] text-xs uppercase tracking-wider text-white">
                  <tr>
                    <th className="px-4 py-3">Use</th>
                    <th className="px-4 py-3">Template / Service</th>
                    <th className="px-4 py-3">Bill To</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.map((rate) => {
                    const selected = selectedRateIds.includes(rate.id);
                    return (
                      <tr key={rate.id} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleRate(rate.id)}
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                              selected
                                ? 'border-camelot-gold bg-camelot-gold text-white'
                                : 'border-slate-200 bg-white text-slate-400 hover:border-camelot-gold'
                            )}
                            aria-label={selected ? 'Remove fee item' : 'Add fee item'}
                          >
                            {selected ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-950">{rate.templateName}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{rate.description}</div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="rounded-full bg-[#F7F1DE] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-camelot-gold">
                              {categoryLabels[rate.category]}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              {rate.jurisdiction}
                            </span>
                            {rate.approvalRequired && (
                              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                                Approval
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-700">{rate.billingParty}</td>
                        <td className="px-4 py-3 text-slate-700">{formatBillingMode(rate.billingMode)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-950">
                          {rate.billingMode === 'included'
                            ? 'Track only'
                            : rate.billingMode === 'hourly'
                              ? `${formatMoney(rate.baseAmount)}/hr`
                              : rate.billingMode === 'quote_required'
                                ? `From ${formatMoney(rate.baseAmount)}`
                                : formatMoney(rate.baseAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 font-heading text-xl font-semibold text-slate-950">
                <ClipboardList size={20} className="text-camelot-gold" />
                Create Invoice Draft
              </h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Property
                  </span>
                  <select
                    value={selectedBuildingId}
                    onChange={(event) => setSelectedBuildingId(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-camelot-gold"
                  >
                    <option value="">Manual / no property selected</option>
                    {buildings.slice(0, 250).map((building) => (
                      <option key={building.id} value={building.id}>
                        {building.name ? `${building.name} - ${building.address}` : building.address}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Recipient Name
                  </span>
                  <input
                    value={recipientName}
                    onChange={(event) => setRecipientName(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-camelot-gold"
                    placeholder="Board, shareholder, owner, resident, vendor"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Recipient Email
                  </span>
                  <input
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-camelot-gold"
                    placeholder="name@example.com"
                  />
                </label>
                <button
                  onClick={handleCreateInvoice}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#314456] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#263747]"
                >
                  <Receipt size={17} />
                  Draft Invoice
                </button>
                <button
                  onClick={handleQueueTasks}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-camelot-gold bg-[#F7F1DE] px-4 py-3 text-sm font-semibold text-camelot-gold transition-colors hover:bg-[#EFE4C2]"
                >
                  <ClipboardList size={17} />
                  Add to Billable Task Queue
                </button>
              </div>
            </div>

            {draft && (
              <div className="rounded-xl border border-camelot-gold bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-camelot-gold">
                      Invoice Preview
                    </p>
                    <h3 className="mt-1 font-heading text-xl font-semibold text-slate-950">
                      {draft.invoiceNumber}
                    </h3>
                    <p className="text-sm text-slate-500">{draft.buildingAddress}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold capitalize text-amber-700">
                    {draft.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-3">
                  {draft.lines.map((line) => (
                    <div key={line.rateId} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{line.description}</p>
                          <p className="mt-1 text-xs text-slate-500">{line.notes}</p>
                        </div>
                        <p className="font-semibold text-slate-950">{formatMoney(line.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                  <span className="text-sm font-semibold text-slate-600">Subtotal</span>
                  <span className="text-2xl font-bold text-slate-950">{formatMoney(draft.subtotal)}</span>
                </div>
                <p className="mt-3 rounded-lg bg-[#F7F1DE] p-3 text-xs leading-5 text-slate-700">
                  {draft.approvalNote}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateDraftStatus('approved')}
                    className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
                  >
                    <ShieldCheck size={16} />
                    Approve
                  </button>
                  <button
                    onClick={() => updateDraftStatus('paid')}
                    className="flex items-center justify-center gap-2 rounded-lg border border-camelot-gold bg-[#F7F1DE] px-3 py-2 text-sm font-semibold text-camelot-gold"
                  >
                    <CreditCard size={16} />
                    Mark Paid
                  </button>
                  <button
                    onClick={handleEmailInvoice}
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Mail size={16} />
                    Email
                  </button>
                  <button
                    onClick={handlePrintInvoice}
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Printer size={16} />
                    Print
                  </button>
                  <button
                    onClick={handleDownloadInvoicePdf}
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <FileDown size={16} />
                    Download PDF
                  </button>
                  <button
                    onClick={() => {
                      updateDraftStatus('sent');
                      handleQueueHubSpotSync();
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    <Send size={16} />
                    Queue Sync
                  </button>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-400">
                  QuickBooks and Google Drive archiving aren't connected yet — this invoice is saved to Camelot OS
                  and queued for HubSpot. Once QuickBooks/Drive credentials are added, this same button will push there too.
                </p>
              </div>
            )}
          </aside>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-heading text-xl font-semibold text-slate-950">
                <ClipboardList size={20} className="text-camelot-gold" />
                Billable Task Queue
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                AI-completed work lands here first. A manager confirms payer, fee authority, and scope before invoicing.
              </p>
            </div>
            <div className="text-sm font-semibold text-camelot-gold">
              {formatMoney(taskQueue.filter((task) => task.billable && task.status !== 'waived').reduce((sum, task) => sum + task.amount, 0))}
            </div>
          </div>

          {taskQueue.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {taskQueue.slice(0, 12).map((task) => (
                <div key={task.id} className="rounded-lg border border-slate-200 bg-[#FBFAF6] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">{task.taskType}</p>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {task.sourceBot}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{task.buildingAddress}</p>
                      <p className="mt-2 text-sm text-slate-700">{task.description}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Payer: <strong className="capitalize text-slate-700">{task.payerRole.replace('_', ' ')}</strong>
                        {task.payerName ? ` - ${task.payerName}` : ''}
                        {task.payerEmail ? ` (${task.payerEmail})` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{task.reviewReason}</p>
                    </div>
                    <p className="whitespace-nowrap text-lg font-bold text-camelot-gold">{formatMoney(task.amount)}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => updateTaskStatus(task.id, 'approved')}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => invoiceTask(task)}
                      className="rounded-lg border border-camelot-gold bg-white px-3 py-2 text-xs font-semibold text-camelot-gold"
                    >
                      Create Invoice
                    </button>
                    <button
                      onClick={() => updateTaskStatus(task.id, 'waived')}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                    >
                      Waive
                    </button>
                    <button
                      onClick={() => updateTaskStatus(task.id, 'rejected')}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No billable tasks yet. Add selected forms to the queue from the invoice panel above.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-heading text-xl font-semibold text-slate-950">
              <FileText size={20} className="text-camelot-gold" />
              Recent Invoice Drafts
            </h2>
            <div className="flex items-center gap-2 text-sm font-semibold text-camelot-gold">
              <DollarSign size={16} />
              {formatMoney(invoiceLibrary.reduce((sum, invoice) => sum + invoice.subtotal, 0))}
            </div>
          </div>
          {invoiceLibrary.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {invoiceLibrary.slice(0, 9).map((invoice) => (
                <button
                  key={invoice.id}
                  onClick={() => setDraft(invoice)}
                  className="rounded-lg border border-slate-200 bg-[#FBFAF6] p-4 text-left transition hover:border-camelot-gold"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{invoice.invoiceNumber}</p>
                      <p className="mt-1 text-xs text-slate-500">{invoice.buildingAddress}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {invoice.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-3 text-xl font-bold text-camelot-gold">{formatMoney(invoice.subtotal)}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No invoice drafts yet. Select a few billable templates above and create the first draft.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
