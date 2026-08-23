"use client";

import { ClinicalDashboard } from "@/components/ClinicalDashboard";
import { SettingsStateProvider } from "@/components/clinical-dashboard/SettingsStateProvider";
import type { AppModeId } from "@/lib/app-modes";

/** Root-only dashboard body; shared search chrome comes from the `(search-app)` layout. */
export function HomePageClient({
  initialMode,
  initialQuery,
  focusSearch,
  autoRunSearch,
}: {
  initialMode: AppModeId;
  initialQuery: string;
  focusSearch: boolean;
  autoRunSearch: boolean;
}) {
  return (
    <SettingsStateProvider>
      <ClinicalDashboard
        initialSearchMode={initialMode}
        initialQuery={initialQuery}
        focusSearch={focusSearch}
        autoRunSearch={autoRunSearch}
      />
    </SettingsStateProvider>
  );
}
