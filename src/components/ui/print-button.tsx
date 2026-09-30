"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn btn-pri h-[54px] w-full text-[16px]"
    >
      PDF laden
    </button>
  );
}
