"use client";

import { useRouter } from "next/navigation";

import { MedicationPrescribingWorkspace } from "@/components/clinical-dashboard/medication-prescribing-workspace";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { appModeHomeHref } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

/**
 * The Medication mode home.
 *
 * Unlike Documents, `/medications` is in `alwaysStandaloneShellPathPrefixes`, so
 * ClinicalDashboard never mounts here — that exclusion keeps the route segment out
 * of the shell's `useSearchParams()` Suspense boundary, which is what stopped the
 * duplicate page-root `data-testid`s under CI load. The page therefore owns its own
 * body, exactly as /tools and /services do.
 *
 * Only the home is rendered: a submitted prescribing search resolves to
 * `/?mode=prescribing&q=…&run=1`, which stays dashboard-owned.
 */
export function MedicationsHomeClient() {
  const router = useRouter();
  const searchCommand = useSearchCommand();
  const query = searchCommand?.query ?? "";

  return (
    <MedicationPrescribingWorkspace
      query={query}
      loading={false}
      realDataReady
      authUnavailable={false}
      apiUnavailable={false}
      setupWarning={null}
      showHome
      desktopComposerSlotId={modeHomeDesktopComposerSlotId}
      onSuggestedSearch={(searchText) => {
        const trimmed = searchText.trim();
        if (!trimmed) return;
        router.push(appModeHomeHref("prescribing", { query: trimmed, run: true }));
      }}
    />
  );
}
