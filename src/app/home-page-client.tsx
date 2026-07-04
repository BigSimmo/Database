"use client";

import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";
import type { AppModeId } from "@/lib/app-modes";

export function HomePageClient({
  initialMode,
  children,
}: {
  initialMode: AppModeId;
  children?: ReactNode;
}) {
  return <GlobalSearchShell initialMode={initialMode}>{children ?? null}</GlobalSearchShell>;
}
