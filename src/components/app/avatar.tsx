import { cn } from "@/lib/utils";

/** v3 .av.a1–a6 gradients; the initials pick one so a person keeps their color. */
const GRAD = [
  "linear-gradient(135deg,#f6b26b,#e0653a)",
  "linear-gradient(135deg,#7fd0b8,#147a68)",
  "linear-gradient(135deg,#9db4ff,#3a7bd5)",
  "linear-gradient(135deg,#c9b1ff,#7c5cff)",
  "linear-gradient(135deg,#ffb3a7,#c9432f)",
  "linear-gradient(135deg,#ffd57a,#f0a33a)",
];
export const avatarBg = (ini: string) => GRAD[[...ini].reduce((n, c) => n + c.charCodeAt(0), 0) % GRAD.length];

export function Avatar({ ini, className }: { ini: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white", className)}
      style={{ background: avatarBg(ini) }}
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
