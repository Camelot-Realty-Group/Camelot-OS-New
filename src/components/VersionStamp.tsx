import { APP_VERSION_LABEL } from '@/lib/app-version';

/**
 * Tiny build-version chip in the bottom-right corner. Distinguishes prod from
 * local and gives David an at-a-glance answer to "is this the new build?".
 */
export default function VersionStamp() {
  return (
    <div
      className="pointer-events-none fixed top-3 right-3 z-30 hidden select-none rounded-full border border-white/10 bg-[#071018]/80 px-2.5 py-1 text-[10px] font-mono tracking-wide text-slate-400 sm:block"
      title={`Camelot OS ${APP_VERSION_LABEL}`}
    >
      {APP_VERSION_LABEL}
    </div>
  );
}
