"use client";

import type { ReactNode } from "react";

import type { AppModeId } from "@/lib/app-modes";

/** Home page content slot; search chrome comes from the shared `(search-app)` layout. */
export function HomePageClient({
  initialMode: _initialMode,
  children,
}: {
  initialMode: AppModeId;
  children?: ReactNode;
}) {
  void _initialMode;
  return <>{children ?? null}</>;
}
