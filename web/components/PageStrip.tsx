"use client";

import { PageData } from "@/lib/api";

interface PageStripProps {
  pages: PageData[];
  activePage: number | null;
  onPageClick: (pageNumber: number) => void;
  thumbnails?: Map<number, string>;
}

export default function PageStrip({ pages, activePage, onPageClick, thumbnails }: PageStripProps) {
  if (pages.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto py-2 px-1 flex-1"
      style={{ scrollbarWidth: "none" }}>
      {pages.map((page) => {
        const thumb = thumbnails?.get(page.page_number);
        const isActive = activePage === page.page_number;

        return (
          <button
            key={page.page_id}
            onClick={() => onPageClick(page.page_number)}
            className="flex-shrink-0 rounded-lg overflow-hidden transition-all duration-150"
            style={{
              border: isActive ? "2px solid var(--accent)" : "2px solid var(--border)",
              boxShadow: isActive ? "0 0 0 3px var(--accent-soft)" : "none",
              transform: isActive ? "scale(1.05)" : "scale(1)",
            }}
            title={page.headings[0]?.text || `Page ${page.page_number}`}
          >
            {thumb ? (
              <div className="relative w-14 h-[72px]">
                <img
                  src={thumb}
                  alt={`Page ${page.page_number}`}
                  className="w-14 h-[72px] object-cover"
                />
                <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center py-0.5 font-medium"
                  style={{ background: "rgba(0,0,0,0.75)", color: "var(--text-primary)" }}>
                  {page.page_number}
                </span>
              </div>
            ) : (
              <div className="w-14 h-[72px] flex flex-col items-center justify-center gap-0.5"
                style={{ background: "var(--bg-surface)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.5"
                  style={{ color: "var(--text-muted)" }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                  {page.page_number}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
