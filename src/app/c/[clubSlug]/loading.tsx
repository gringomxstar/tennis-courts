export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Lädt" className="mx-auto max-w-[640px] px-5 pt-[66px]">
      <div className="h-8 w-40 rounded-[12px] bg-inset animate-pulse" />
      <div className="mt-4 h-[92px] rounded-[22px] bg-inset animate-pulse" />
      <div className="mt-4 h-[92px] rounded-[22px] bg-inset animate-pulse" />
      <div className="mt-4 h-[92px] rounded-[22px] bg-inset animate-pulse" />
    </div>
  );
}
