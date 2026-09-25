"use client";

import { useRouter } from "next/navigation";

import { CmeSetupPage } from "@/components/cme/cme-setup-page";
import type { CmeRequirementSet } from "@/lib/cme/types";

export function CmeSetupRoute({
  year,
  set,
  demoMode,
}: {
  readonly year: number;
  readonly set: CmeRequirementSet | null;
  readonly demoMode: boolean;
}) {
  const router = useRouter();
  return (
    <CmeSetupPage
      year={year}
      set={set}
      demoMode={demoMode}
      onConfirm={async (requirementSet) => {
        if (demoMode)
          throw new Error("Demo mode is read-only. Sign in to confirm requirements for your private record.");
        const response = await fetch("/api/cme/year", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requirementSet),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: unknown; message?: unknown } | null;
          const message =
            typeof payload?.message === "string"
              ? payload.message
              : typeof payload?.error === "string"
                ? payload.error
                : `Could not confirm requirements (${response.status}).`;
          throw new Error(message);
        }
        router.refresh();
      }}
    />
  );
}
