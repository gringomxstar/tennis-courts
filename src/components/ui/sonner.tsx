"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

// Pill toast from the design: inverted colors, top center, no icons.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-center"
      offset={58}
      mobileOffset={58}
      icons={{ success: null, info: null, warning: null, error: null, loading: null }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "mx-auto flex w-fit items-center rounded-full bg-foreground px-5 py-3 text-[15px] font-bold text-background shadow-[0_12px_30px_rgba(0,0,0,.3)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
