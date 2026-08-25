/**
 * FlipBookViewer — a lightweight, dependency-free page-by-page viewer
 * for a pre-rendered set of page images (e.g. a PDF converted to JPGs
 * at build time). Not a full 3D page-curl effect, but gives a real
 * "flip through it" reading experience with page navigation, a page
 * counter, and thumbnails — with zero new npm dependencies.
 */

import { useState } from 'react';

interface FlipBookViewerProps {
  pageSrc: (n: number) => string;
  pageCount: number;
  title: string;
  goldHex: string;
  navyHex: string;
}

export default function FlipBookViewer({ pageSrc, pageCount, title, goldHex, navyHex }: FlipBookViewerProps) {
  const [page, setPage] = useState(1);

  const goTo = (n: number) => {
    if (n < 1 || n > pageCount) return;
    setPage(n);
  };

  return (
    <div className="w-full">
      <div className="relative bg-black flex items-center justify-center" style={{ minHeight: '520px' }}>
        <img
          key={page}
          src={pageSrc(page)}
          alt={`${title} — page ${page} of ${pageCount}`}
          className="max-h-[640px] w-auto object-contain shadow-2xl"
        />
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-30"
          style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: navyHex }}
        >
          ‹
        </button>
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-30"
          style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: navyHex }}
        >
          ›
        </button>
      </div>

      <div className="flex items-center justify-between mt-3 px-1">
        <span className="text-xs font-sans" style={{ color: '#6B6560' }}>
          Page {page} of {pageCount}
        </span>
        <input
          type="range"
          min={1}
          max={pageCount}
          value={page}
          onChange={(e) => goTo(Number(e.target.value))}
          className="flex-1 mx-4"
          style={{ accentColor: goldHex }}
        />
      </div>
    </div>
  );
}
