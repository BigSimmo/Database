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

/**
 * Parse only non-identifying state from the URL; patient-name search stays in browser memory.
 *
 * The absence of a `q` parameter here is the contract, not an omission. A caseload search matches
 * the patient's NAME, and Ruling [111] does not allow one into a query string -- "a query string is
 * logged by every proxy between here and the browser. Nothing about a patient may travel here." The
 * directory's client island holds the typed text and this function has nowhere to put it, so a
 * stale `?q=` on an old bookmark is ignored rather than honoured.
 *
 * A repeated `?state=a&state=b` arrives as an array and names no single state. Both that and an
 * unrecognised value fall back to "all" rather than throwing: a mistyped URL must widen the list,
 * never fail the render or hide a caseload behind an error page.
 */
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
