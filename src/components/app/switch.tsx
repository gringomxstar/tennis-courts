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
