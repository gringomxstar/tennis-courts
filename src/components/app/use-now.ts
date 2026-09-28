"use client";

import { useSyncExternalStore } from "react";

let now = Date.now();
const subscribe = (cb: () => void) => {
  now = Date.now();
  const id = setInterval(() => {
    now = Date.now();
    cb();
  }, 60_000);
  return () => clearInterval(id);
};

/** Client clock that ticks every minute; 0 during SSR so local-time UI renders only on the client. */
export function useNow() {
  return useSyncExternalStore(subscribe, () => now, () => 0);
}
