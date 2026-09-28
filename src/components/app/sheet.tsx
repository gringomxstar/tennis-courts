"use client";

import { Dialog as DialogPrimitive } from "radix-ui";

/** Bottom sheet from the design: dimmer, 36px top radius, grab handle, springy slide-up. */
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
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[47] bg-black/50 duration-[350ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[36px] bg-sheet px-[22px] pb-11 pt-2.5 text-foreground shadow-[0_-20px_60px_rgba(0,0,0,.35)] outline-none duration-[550ms] ease-sheet data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom lg:bottom-auto lg:left-[calc(50%+128px)] lg:right-auto lg:top-1/2 lg:max-h-[85dvh] lg:max-w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[36px] lg:pb-7 lg:pt-7 lg:shadow-[0_30px_80px_rgba(0,0,0,.45)] lg:duration-300 lg:data-[state=closed]:slide-out-to-bottom-0 lg:data-[state=open]:slide-in-from-bottom-0 lg:data-[state=closed]:fade-out-0 lg:data-[state=closed]:zoom-out-95 lg:data-[state=open]:fade-in-0 lg:data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <div aria-hidden className="mx-auto mb-4 h-[5px] w-10 rounded-[3px] bg-border lg:hidden" />
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
