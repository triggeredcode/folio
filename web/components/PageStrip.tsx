"use client";

import { PageData } from "@/lib/api";

interface PageStripProps {
  pages: PageData[];
  activePage: number | null;
  onPageClick: (pageNumber: number) => void;
  thumbnails?: Map<number, string>;
}

export default function PageStrip({ pages, activePage, onPageClick, thumbnails }: PageStripProps) {
  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center py-3 text-gray-500 text-sm">
        No pages captured yet
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-thin flex-1">
      {pages.map((page) => {
        const thumb = thumbnails?.get(page.page_number);
        const isActive = activePage === page.page_number;

        return (
          <button
            key={page.page_id}
            onClick={() => onPageClick(page.page_number)}
            className={`flex-shrink-0 rounded-lg border-2 transition-all overflow-hidden ${
              isActive
                ? "border-blue-500 ring-2 ring-blue-500/30"
                : "border-gray-700 hover:border-gray-500"
            }`}
            title={page.headings[0]?.text || `Page ${page.page_number}`}
          >
            {thumb ? (
              <div className="w-14 h-18 relative">
                <img
                  src={thumb}
                  alt={`Page ${page.page_number}`}
                  className="w-14 h-18 object-cover"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] text-center py-0.5 font-mono">
                  p{page.page_number}
                </span>
              </div>
            ) : (
              <div className="w-14 h-18 bg-gray-800 flex flex-col items-center justify-center">
                <span className="text-lg">📄</span>
                <span className="text-[10px] text-gray-400 font-mono">
                  p{page.page_number}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
