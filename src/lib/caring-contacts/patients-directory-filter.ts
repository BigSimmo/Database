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

/**
 * The parameter that records, in the address, that a saved search term was dropped.
 *
 * Non-identifying by construction: it is a flag, never the term. It exists because the fix for the
 * dropped term is a server REDIRECT, and a redirect has no other way to carry "something was
 * removed" to the screen it lands on. It is itself recognised, which is what stops the redirect
 * target from being unrecognised in its turn and looping forever.
 */
export const PATIENTS_DIRECTORY_SEARCH_NOT_APPLIED_PARAM = "searchNotApplied";

/**
 * The parameter the workspace overlay host owns, duplicated here as a bare string.
 *
 * It has to be duplicated: this module is sealed and may import nothing outside
 * `src/lib/caring-contacts/`, while `WORKSPACE_OVERLAY_PARAM` is exported from a `"use client"`
 * component module. Duplicating a string is only acceptable when something makes the copies
 * diverge loudly, so `tests/caring-contacts-patients-directory.dom.test.tsx` asserts the two are
 * equal. Without that assertion a rename of the overlay parameter would make this route strip
 * every deep-linked overlay out of its own address, silently.
 */
export const PATIENTS_DIRECTORY_OVERLAY_PARAM = "overlay";

/**
 * Every parameter this route understands. ANY other name on the address is dropped.
 *
 * Deliberately an allowlist rather than a `q` denylist. A bookmark can carry `?name=`, `?search=`
 * or `?patient=` just as easily as `?q=`, and a check that names only the parameter this repo
 * happened to ship would under-report every one of them.
 */
export const PATIENTS_DIRECTORY_RECOGNISED_PARAMS: readonly string[] = Object.freeze([
  "state",
  PATIENTS_DIRECTORY_SEARCH_NOT_APPLIED_PARAM,
  PATIENTS_DIRECTORY_OVERLAY_PARAM,
]);

/** What the address says, and what it should be rewritten to. Never carries a dropped VALUE. */
export type PatientsDirectoryAddress = {
  filter: PatientsDirectoryFilter;
  /**
   * True when the address carried at least one parameter this route does not understand. A
   * BOOLEAN, deliberately: not the name, not the value, not a count, not a length. Nothing that
   * narrows what the dropped term was may travel any further than this function.
   */
  droppedUnrecognisedParams: boolean;
  /** True when the address records that a saved search term was dropped on the way here. */
  searchNotApplied: boolean;
  /**
   * The query string this address should have had: recognised parameters only, in a fixed order,
   * `""` when there are none. It is built by NAMING what may be kept rather than by deleting what
   * may not, so a dropped value has no path into it even by accident.
   */
  canonicalQuery: string;
};

/**
 * Read the address, and say what it should be rewritten to.
 *
 * WHY IGNORING THE PARAMETER WAS NOT ENOUGH. Declining to honour `?q=<name>` leaves the name in the
 * address bar, and `overlayUrl()` in `workspace-overlays.tsx` copies EVERY existing parameter into
 * each history entry it pushes -- so an ignored name was re-written into a fresh history entry
 * every time a coordinator opened an overlay. Not reading a value is not the same as removing it,
 * and on this page not reading it actively multiplied it.
 */
export function readPatientsDirectoryAddress(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
): PatientsDirectoryAddress {
  const filter = parsePatientsDirectoryFilter(searchParams);
  const droppedUnrecognisedParams = Object.keys(searchParams).some(
    (key) => !PATIENTS_DIRECTORY_RECOGNISED_PARAMS.includes(key),
  );
  const alreadyFlagged = typeof searchParams[PATIENTS_DIRECTORY_SEARCH_NOT_APPLIED_PARAM] === "string";
  const overlay = searchParams[PATIENTS_DIRECTORY_OVERLAY_PARAM];

  // Built from named recognised values only. `searchParams` is never spread, filtered or copied
  // into this, because a copy is how a value ends up somewhere nobody meant it to be.
  const kept = new URLSearchParams();
  if (filter.state !== "all") kept.set("state", filter.state);
  if (typeof overlay === "string") kept.set(PATIENTS_DIRECTORY_OVERLAY_PARAM, overlay);
  if (droppedUnrecognisedParams || alreadyFlagged) kept.set(PATIENTS_DIRECTORY_SEARCH_NOT_APPLIED_PARAM, "1");

  return {
    filter,
    droppedUnrecognisedParams,
    searchNotApplied: droppedUnrecognisedParams || alreadyFlagged,
    canonicalQuery: kept.toString(),
  };
}
