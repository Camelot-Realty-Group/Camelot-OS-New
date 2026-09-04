/**
 * WelcomeHome.tsx — "Welcome Home: An Introduction to Camelot Property Management"
 *
 * A permanent dashboard feature (sidebar button: "Intro to Camelot") that
 * turns the one-property pitch-microsite pattern proven on Oak Park at
 * Douglaston and 382 Lafayette Street into a repeatable template: a
 * registry of live sites, a new-property intake form that logs straight
 * to Supabase, and the build checklist so the next one goes together the
 * same way every time.
 */
import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Home, ExternalLink, Send, CheckCircle2, Clock, Paperclip, X } from 'lucide-react';
import {
  WELCOME_HOME_SITES,
  WELCOME_HOME_CHECKLIST,
  WELCOME_HOME_CONTENT_SECTIONS,
  WELCOME_HOME_UPLOAD_ACCEPT,
  REFERRAL_SOURCES,
  PROPERTY_TYPES,
  submitWelcomeHomeRequest,
  fetchWelcomeHomeRequests,
  uploadWelcomeHomeFile,
  type WelcomeHomeRequestRecord,
  type UploadedFileRef,
} from '@/lib/welcome-home';

export default function WelcomeHome() {
  const [address, setAddress] = useState('');
  const [block, setBlock] = useState('');
  const [lot, setLot] = useState('');
  const [websiteReference, setWebsiteReference] = useState('');
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0]);
  const [contactName, setContactName] = useState('');
  const [referralSource, setReferralSource] = useState(REFERRAL_SOURCES[0]);
  const [notes, setNotes] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEntity, setRecipientEntity] = useState('');
  const [recipientTitle, setRecipientTitle] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<WelcomeHomeRequestRecord[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const loadRequests = async () => {
    setLoadingRequests(true);
    const rows = await fetchWelcomeHomeRequests(20);
    setRequests(rows);
    setLoadingRequests(false);
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const ref = await uploadWelcomeHomeFile(address.trim() || 'unfiled', file);
        setUploadedFiles((prev) => [...prev, ref]);
      }
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`);
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeFile = (url: string) => setUploadedFiles((prev) => prev.filter((f) => f.url !== url));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      toast.error('Enter the property address first');
      return;
    }
    setSubmitting(true);
    try {
      await submitWelcomeHomeRequest({
        propertyAddress: address.trim(),
        block: block.trim() || undefined,
        lot: lot.trim() || undefined,
        websiteReference: websiteReference.trim() || undefined,
        propertyType,
        contactName: contactName.trim() || undefined,
        referralSource,
        notes: notes.trim() || undefined,
        recipientName: recipientName.trim() || undefined,
        recipientEntity: recipientEntity.trim() || undefined,
        recipientTitle: recipientTitle.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
        recipientEmail: recipientEmail.trim() || undefined,
        uploadedFiles,
      });
      toast.success(`${address.trim()} added to the Welcome Home queue`);
      setAddress('');
      setBlock('');
      setLot('');
      setWebsiteReference('');
      setPropertyType(PROPERTY_TYPES[0]);
      setContactName('');
      setNotes('');
      setReferralSource(REFERRAL_SOURCES[0]);
      setRecipientName('');
      setRecipientEntity('');
      setRecipientTitle('');
      setRecipientPhone('');
      setRecipientEmail('');
      setUploadedFiles([]);
      await loadRequests();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4ED]">
      <div className="bg-white border-b border-slate-200 px-8 py-7">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-camelot-gold/15 text-camelot-gold flex items-center justify-center">
            <Home size={24} />
          </span>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-camelot-gold font-bold">
              Engagement — Welcome Home
            </div>
            <h1 className="font-heading text-3xl text-slate-950">Welcome Home</h1>
          </div>
        </div>
        <p className="text-slate-600 mt-4 max-w-4xl leading-relaxed">
          An introduction to Camelot Property Management — a single-property micro-website built for one board,
          one referral, or one inbound inquiry at a time. Established 2026 by David A. Goldoff as a standing
          template on Camelot OS, refined on Oak Park at Douglaston and 382 Lafayette Street: a cover letter,
          the property’s own facts, Camelot’s twenty-year track record nearby, and a clear next step.
        </p>
      </div>

      <main className="px-8 py-8 space-y-8 max-w-6xl">
        {/* Live sites registry */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Live Welcome Home sites</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {WELCOME_HOME_SITES.map((site) => (
              <Link
                key={site.route}
                to={site.route}
                className="bg-white rounded-2xl border border-[#A89035]/40 p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="text-sm font-bold text-slate-950">{site.address}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{site.neighborhood}</div>
                  <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 size={13} /> {site.launchedLabel}
                  </span>
                </div>
                <ExternalLink size={18} className="text-camelot-gold" />
              </Link>
            ))}
          </div>
        </section>

        {/* Intake form */}
        <section className="bg-white rounded-2xl border border-[#A89035]/40 p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-1">Queue a new property</h2>
          <p className="text-xs text-slate-500 mb-4">
            Logs the request to the Welcome Home queue so a microsite can be built next — this does not build the
            site automatically.
          </p>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Property address *"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 md:col-span-2"
            />
            <input
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              placeholder="Block (optional)"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <input
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              placeholder="Lot (optional)"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <input
              value={websiteReference}
              onChange={(e) => setWebsiteReference(e.target.value)}
              placeholder="Website reference (listing, StreetEasy, etc. — optional)"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <div className="md:col-span-2 h-px bg-slate-100 my-1" />
            <div className="md:col-span-2 text-xs font-bold uppercase tracking-wide text-slate-400">Who this site addresses</div>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Recipient name"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <input
              value={recipientEntity}
              onChange={(e) => setRecipientEntity(e.target.value)}
              placeholder="Ownership entity"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <input
              value={recipientTitle}
              onChange={(e) => setRecipientTitle(e.target.value)}
              placeholder="Title"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <input
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="Phone"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Board / referring contact (if different, optional)"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />

            <div className="md:col-span-2 h-px bg-slate-100 my-1" />
            <select
              value={referralSource}
              onChange={(e) => setReferralSource(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {REFERRAL_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
            <label className="flex items-center justify-center gap-2 border border-dashed rounded-lg px-3 py-2 text-sm text-slate-500 cursor-pointer hover:bg-slate-50">
              <Paperclip size={14} />
              {uploading ? 'Uploading…' : 'Attach files (PDF, images, Office)'}
              <input
                type="file"
                multiple
                accept={WELCOME_HOME_UPLOAD_ACCEPT}
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {uploadedFiles.length > 0 && (
              <div className="md:col-span-2 flex flex-wrap gap-2">
                {uploadedFiles.map((f) => (
                  <span
                    key={f.url}
                    className="inline-flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1 text-xs text-slate-700"
                  >
                    {f.name}
                    <button type="button" onClick={() => removeFile(f.url)} className="text-slate-400 hover:text-slate-700">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 md:col-span-2"
            />
            <button
              type="submit"
              disabled={submitting || uploading}
              className="md:col-span-2 flex items-center justify-center gap-2 bg-[#1a2744] text-white rounded-lg px-4 py-2.5 text-sm font-bold hover:bg-[#26375c] disabled:opacity-50"
            >
              <Send size={15} /> {submitting ? 'Saving…' : 'Add to Welcome Home queue'}
            </button>
          </form>
        </section>

        {/* Recent requests */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Recent requests</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingRequests ? (
              <div className="p-5 text-sm text-slate-500">Loading…</div>
            ) : requests.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No requests queued yet — the form above adds the first one.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">Property</th>
                    <th className="px-4 py-2">Contact</th>
                    <th className="px-4 py-2">Referral</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-semibold text-slate-900">{r.propertyAddress}</td>
                      <td className="px-4 py-2 text-slate-600">{r.contactName || '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{r.referralSource || '—'}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                          <Clock size={12} /> {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500 text-xs">
                        {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Build checklist */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">The Welcome Home build checklist</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {WELCOME_HOME_CHECKLIST.map((item, i) => (
              <div key={item.title} className="flex gap-4 px-5 py-4">
                <span className="w-7 h-7 rounded-full bg-camelot-gold/15 text-camelot-gold text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-900">{item.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Full content-section outline */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">The Welcome Home content outline</h2>
          <p className="text-xs text-slate-500 mb-3">
            The full section-by-section spec every generated site should follow, in order.
          </p>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {WELCOME_HOME_CONTENT_SECTIONS.map((item, i) => (
              <div key={item.title} className="flex gap-4 px-5 py-4">
                <span className="w-7 h-7 rounded-full bg-[#1a2744]/10 text-[#1a2744] text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-900">{item.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
