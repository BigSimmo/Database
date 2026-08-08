"use client";

import type { ReactNode } from "react";

/** Medication home content slot; search chrome and body come from the shared `(search-app)` shell. */
export function MedicationsHomeClient({ children }: { children?: ReactNode }) {
  return <>{children ?? null}</>;
}
