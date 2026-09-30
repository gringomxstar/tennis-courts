import { cn } from "@/lib/utils";

/** Visual 50x30 switch (v3 .sw). Put it inside the row's <button>, which carries aria-pressed. */
export function SwitchKnob({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block h-[30px] w-[50px] shrink-0 rounded-full transition-[background] duration-300",
        on ? "bg-brand-deep" : "bg-track-off"
      )}
    >
      <span
        className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.2)] transition-[left] duration-[350ms] ease-spring"
        style={{ left: on ? 23 : 3 }}
      />
    </span>
  );
}

/** Slider with labels on both sides and a brand-colored knob (Liste/Raster, Spieler/Admin). */
export function LabeledSwitch({ left, right, label, on, onChange }: { left: string; right: string; label: string; on: boolean; onChange: (on: boolean) => void }) {
  const side = (active: boolean) => cn("text-[14px] font-semibold transition-colors duration-300", active ? "text-ink" : "text-ink-3");
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="flex shrink-0 items-center gap-2">
      <span className={side(!on)}>{left}</span>
      <span aria-hidden className="relative block h-[30px] w-[50px] rounded-full bg-card shadow-card">
        <span
          className="absolute top-[3px] h-6 w-6 rounded-full bg-brand-deep shadow-[0_2px_6px_rgba(0,0,0,.2)] transition-[left] duration-[350ms] ease-spring"
          style={{ left: on ? 23 : 3 }}
        />
      </span>
      <span className={side(on)}>{right}</span>
    </button>
  );
}
