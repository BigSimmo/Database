import type { PlanState } from "./model";

/** Every plan state, in lifecycle order, as the directory filter offers them. */
export const PATIENTS_DIRECTORY_STATE_ORDER: readonly PlanState[] = Object.freeze([
  "draft",
  "active",
  "paused",
  "completed",
  "withdrawn",
  "cancelled",
]);

export type PatientsDirectoryStateFilter = PlanState | "all";

export type PatientsDirectoryFilter = {
  /** The plan state the URL asks for, already validated; "all" when absent or unrecognised. */
  state: PatientsDirectoryStateFilter;
};

/** Parse only non-identifying state from the URL; patient-name search stays in browser memory. */
export function parsePatientsDirectoryFilter(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
): PatientsDirectoryFilter {
  const rawState = searchParams.state;
  const state: PatientsDirectoryStateFilter =
    typeof rawState === "string" && (PATIENTS_DIRECTORY_STATE_ORDER as readonly string[]).includes(rawState)
      ? (rawState as PlanState)
      : "all";

  return { state };
}
