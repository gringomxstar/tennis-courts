"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Zwei-Tap-Bestätigung: erster Tap fragt nach, zweiter löst aus; nach 3 s oder beim Wegtippen zurück. */
export function ConfirmButton({
  onConfirm,
  confirm,
  className,
  armedClassName = "!bg-bad !text-white",
  children,
  ...rest
}: Omit<ComponentProps<"button">, "onClick"> & { onConfirm: () => void; confirm: string; armedClassName?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      {...rest}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      onBlur={() => setArmed(false)}
      className={cn(className, armed && armedClassName)}
    >
      {armed ? confirm : children}
    </button>
  );
}
