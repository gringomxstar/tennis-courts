"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
  size = "md",
  label,
  muted = [],
}: {
  options: readonly (readonly [T, ReactNode])[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
  /** looks unavailable but stays tappable (the caller explains why) */
  muted?: readonly T[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        // v3 .seg: pill track in --bg, the chosen segment is a white card
        "flex rounded-full bg-bg p-1",
        className
      )}
    >
      {options.map(([id, text]) => {
        const on = id === value;
        return (
          <button
            key={String(id)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={muted.includes(id) || undefined}
            onClick={() => onChange(id)}
            className={cn(
              "flex-1 text-center font-semibold transition-all duration-300 ease-spring",
              "rounded-full",
              size === "sm" ? "py-1.5 text-[13px]" : size === "lg" ? "py-2.5 text-[14.5px]" : "py-2 text-[13.5px]",
              on ? "bg-card text-ink shadow-card" : "bg-transparent text-ink-2",
              muted.includes(id) && !on && "opacity-50"
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
