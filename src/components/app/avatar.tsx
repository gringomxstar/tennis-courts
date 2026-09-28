import { cn } from "@/lib/utils";

export function Avatar({ ini, className }: { ini: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-acc text-[14px] font-bold",
        className
      )}
    >
      {ini}
    </div>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />;
}

export function Chevron({ className }: { className?: string }) {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={cn("text-muted-foreground", className)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function Spinner() {
  return <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/35 border-t-white" />;
}
