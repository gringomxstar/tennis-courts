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
}: {
  options: readonly (readonly [T, ReactNode])[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
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
            onClick={() => onChange(id)}
            className={cn(
              "flex-1 text-center font-semibold transition-all duration-300 ease-spring",
              size === "sm" ? "rounded-[11px] py-[7px] text-[13px]" : size === "lg" ? "rounded-[11px] py-2.5 text-[15px]" : "rounded-[12px] py-[9px] text-[14px]",
              on ? "bg-seg-on text-seg-on-fg shadow-[0_2px_8px_rgba(0,0,0,.18)]" : "bg-transparent text-seg-off-fg"
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
