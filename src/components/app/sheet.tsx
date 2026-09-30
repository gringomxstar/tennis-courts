"use client";

import { useSyncExternalStore } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

const WIDE = "(min-width: 1100px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * v3 overlay: bottom sheet on the phone, centered dialog from 640, from 1100 a right-hand card panel
 * that leaves the page usable (tapping another calendar cell just swaps the content).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={!wide}>
      <DialogPrimitive.Portal>
        {!wide && (
          <DialogPrimitive.Overlay className="fixed inset-0 z-[47] bg-[rgba(20,33,61,.42)] duration-[350ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        )}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => wide && e.preventDefault()}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-[30px] bg-card px-5 pb-[max(26px,env(safe-area-inset-bottom))] pt-2 text-ink shadow-[0_-20px_50px_-20px_rgba(20,33,61,.5)] outline-none duration-[550ms] ease-sheet data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom min-[640px]:bottom-auto min-[640px]:left-1/2 min-[640px]:top-1/2 min-[640px]:max-h-[90dvh] min-[640px]:w-[440px] min-[640px]:-translate-x-1/2 min-[640px]:-translate-y-1/2 min-[640px]:rounded-[24px] min-[640px]:px-6 min-[640px]:py-[22px] min-[640px]:duration-300 min-[640px]:data-[state=closed]:slide-out-to-bottom-0 min-[640px]:data-[state=open]:slide-in-from-bottom-0 min-[640px]:data-[state=closed]:fade-out-0 min-[640px]:data-[state=closed]:zoom-out-95 min-[640px]:data-[state=open]:fade-in-0 min-[640px]:data-[state=open]:zoom-in-95 min-[1100px]:bottom-4 min-[1100px]:left-auto min-[1100px]:right-4 min-[1100px]:top-[74px] min-[1100px]:max-h-none min-[1100px]:w-[360px] min-[1100px]:translate-x-0 min-[1100px]:translate-y-0 min-[1100px]:px-[22px] min-[1100px]:py-5 min-[1100px]:shadow-[var(--sh-lg)] min-[1100px]:data-[state=closed]:zoom-out-100 min-[1100px]:data-[state=open]:zoom-in-100 min-[1100px]:data-[state=open]:slide-in-from-right-8"
        >
          <div aria-hidden className="mx-auto mb-3 h-[5px] w-10 flex-none rounded-[3px] bg-[#d8dedb] min-[640px]:hidden" />
          <div className="mb-3 flex items-center justify-between gap-3">
            <DialogPrimitive.Title className="text-[13px] font-semibold text-ink-3">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Schliessen" className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-bg text-[18px] text-ink-2">
              ×
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
