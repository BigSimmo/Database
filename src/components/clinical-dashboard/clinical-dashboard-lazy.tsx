"use client";

import dynamic from "next/dynamic";

import { AnswerSkeleton } from "@/components/clinical-dashboard/answer-status";

export const DifferentialsHome = dynamic(
  () => import("@/components/clinical-dashboard/differentials-home").then((m) => m.DifferentialsHome),
  { ssr: false },
);
export const FavouritesHub = dynamic(
  () => import("@/components/clinical-dashboard/favourites-hub").then((m) => m.FavouritesHub),
  { ssr: false },
);
export const MedicationPrescribingWorkspace = dynamic(
  () =>
    import("@/components/clinical-dashboard/medication-prescribing-workspace").then(
      (m) => m.MedicationPrescribingWorkspace,
    ),
  { ssr: false },
);
export const DocumentDrawer = dynamic(
  () => import("@/components/clinical-dashboard/document-admin").then((m) => m.DocumentDrawer),
  { ssr: false },
);

// Results surfaces load lazily. Preload the primary answer surface after hydration so a cold
// browser does not finish a fast/cached answer before the result UI chunk is available.
export const loadStagedAnswerResultSurface = () =>
  import("@/components/clinical-dashboard/answer-result-surface").then((m) => m.StagedAnswerResultSurface);
export const StagedAnswerResultSurface = dynamic(loadStagedAnswerResultSurface, {
  ssr: false,
  loading: () => <AnswerSkeleton />,
});
export const RelatedDocumentsPanel = dynamic(
  () => import("@/components/clinical-dashboard/document-results").then((m) => m.RelatedDocumentsPanel),
  { ssr: false },
);
export const DocumentSearchResultsPanel = dynamic(
  () => import("@/components/clinical-dashboard/document-search-results").then((m) => m.DocumentSearchResultsPanel),
  { ssr: false },
);
