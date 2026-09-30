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
        "flex bg-inset",
        size === "sm" ? "rounded-[14px] p-[3px]" : size === "lg" ? "rounded-[14px] p-[3px]" : "rounded-[16px] p-1",
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
              size === "sm" ? "rounded-[11px] py-[7px] text-[13px]" : size === "lg" ? "rounded-[11px] py-[11px] text-[15px]" : "rounded-[12px] py-[9px] text-[14px]",
              on ? "bg-seg-on text-seg-on-fg shadow-[0_2px_8px_rgba(0,0,0,.18)]" : "bg-transparent text-seg-off-fg",
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
