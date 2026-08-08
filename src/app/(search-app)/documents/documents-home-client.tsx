"use client";

import type { ReactNode } from "react";

/** Documents home content slot; search chrome and body come from the shared `(search-app)` shell. */
export function DocumentsHomeClient({ children }: { children?: ReactNode }) {
  return <>{children ?? null}</>;
}
