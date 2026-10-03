import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminRenewalsPage } from "@/components/admin/admin-renewals-page";
import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";

export const metadata: Metadata = {
  title: "Renewals | Admin | PsychSift",
  // The same two halves the On Call page's description carried: what it is, and what it is not.
  description:
    "A checklist of the statewide requirements — registration, checks, health, training — with your own recorded dates, soonest first, plus your personal renewals. Your own recorded dates, never a check with the issuing body.",
};

export default function AdminRenewalsRoute() {
  // The page reads `?show=`, `?item=` and `?record=` through `useSearchParams`,
  // which needs a Suspense boundary in the App Router. Its fallback is the
  // same skeleton as Admin's route loading, so a direct load that suspends on
  // the search params is never a blank page before (or without) hydration.
  return (
    <Suspense fallback={<ModeHomeRouteLoading />}>
      <AdminRenewalsPage />
    </Suspense>
  );
}
