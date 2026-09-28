"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-[60px] w-full items-center justify-center rounded-[20px] bg-clay text-[18px] font-bold text-white active:scale-[.97]"
    >
      Als PDF speichern / Drucken
    </button>
  );
}
