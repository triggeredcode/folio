"use client";

export default function NotInBookBanner() {
  return (
    <div className="mx-3 my-2 p-3 rounded-xl bg-amber-900/30 border border-amber-700/50">
      <p className="text-sm text-amber-200 font-medium mb-1">Not in your book</p>
      <p className="text-xs text-amber-300/80">
        I only answer from the pages you&apos;ve captured. Add the relevant page, or ask
        something covered in the book.
      </p>
    </div>
  );
}
