import { cn } from "@/lib/utils";

/** Visual 52x32 switch from the design. Put it inside the row's <button>, which carries aria-pressed. */
export function SwitchKnob({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block h-8 w-[52px] shrink-0 rounded-full transition-[background] duration-300",
        on ? "bg-clay" : "bg-track-off"
      )}
    >
      <span
        className="absolute top-[3px] h-[26px] w-[26px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.3)] transition-[left] duration-[350ms] ease-spring"
        style={{ left: on ? 23 : 3 }}
      />
    </span>
  );
}

/** Slider with labels on both sides and a brand-colored knob (Liste/Raster, Spieler/Admin). */
export function LabeledSwitch({ left, right, label, on, onChange }: { left: string; right: string; label: string; on: boolean; onChange: (on: boolean) => void }) {
  const side = (active: boolean) => cn("text-[14px] font-semibold transition-colors duration-300", active ? "text-foreground" : "text-muted-foreground");
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="flex shrink-0 items-center gap-2">
      <span className={side(!on)}>{left}</span>
      <span aria-hidden className="relative block h-8 w-[56px] rounded-full bg-inset shadow-[inset_0_0_0_1px_var(--border)]">
        <span
          className="absolute top-[3px] h-[26px] w-[26px] rounded-full bg-clay shadow-[0_2px_6px_rgba(0,0,0,.25)] transition-[left] duration-[350ms] ease-spring"
          style={{ left: on ? 27 : 3 }}
        />
      </span>
      <span className={side(on)}>{right}</span>
    </button>
  );
}
