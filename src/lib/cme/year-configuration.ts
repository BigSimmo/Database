import { cmeYearConfirmSchema } from "@/lib/cme/schemas";
import type { CmeRequirementSet } from "@/lib/cme/types";

/** A persisted scalar-only year is not a complete owner-confirmed programme. */
export function cmeYearConfigurationState(set: CmeRequirementSet | null): "ready" | "unconfigured" | "unavailable" {
  if (!set) return "unconfigured";
  const confirmation = cmeYearConfirmSchema.safeParse(set);
  if (confirmation.success) return "ready";
  // Missing requirements/provenance are repairable without discarding history.
  // Unknown requirement shapes or other corrupted data must not invite replacement.
  return confirmation.error.issues.every((issue) => {
    const field = issue.path[0];
    return (
      field === "confirmedOn" ||
      field === "confirmedSource" ||
      (field === "requirements" &&
        issue.path.length === 1 &&
        Array.isArray(set.requirements) &&
        set.requirements.length === 0)
    );
  })
    ? "unconfigured"
    : "unavailable";
}
