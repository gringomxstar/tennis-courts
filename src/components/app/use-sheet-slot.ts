"use client";

import { useState } from "react";
import type { SheetSlot } from "@/components/app/booking-sheet";

export function useSheetSlot() {
  const [slot, setSlot] = useState<SheetSlot | null>(null);
  return { slot, open: setSlot, close: () => setSlot(null) };
}
