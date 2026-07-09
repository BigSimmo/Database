"use client";

import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";
import type { AppModeId } from "@/lib/app-modes";

<<<<<<< HEAD
export function HomePageClient({
  initialMode,
  children,
}: {
  initialMode: AppModeId;
  children?: ReactNode;
}) {
=======
export function HomePageClient({ initialMode, children }: { initialMode: AppModeId; children?: ReactNode }) {
>>>>>>> origin/main
  return <GlobalSearchShell initialMode={initialMode}>{children ?? null}</GlobalSearchShell>;
}
