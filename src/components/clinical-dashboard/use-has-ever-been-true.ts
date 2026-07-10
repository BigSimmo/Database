"use client";

import { useState } from "react";

// Latches to true the first time `value` is true. Used to defer mounting a
// lazy-loaded dialog until its first open (so its chunk never downloads for
// users who never open it) while keeping it mounted afterwards, preserving
// dialog-local state across close/reopen exactly like the previous
// always-mounted behavior.
export function useHasEverBeenTrue(value: boolean) {
  const [everTrue, setEverTrue] = useState(value);
  // Render-time state adjustment (not an effect) so the first open mounts in
  // the same render pass; the guard makes it settle immediately.
  if (value && !everTrue) setEverTrue(true);
  return everTrue || value;
}
