import type { AppModeId } from "@/lib/app-modes";

/**
 * How the phone mode sheet groups the app's modes.
 *
 * The desktop mode menu renders `appModeDefinitions` as one flat list, but a
 * seventeen-item list is unusable on a phone, so the sheet groups it. That makes
 * this a *second* list of mode ids, and a mode missing from every group here is
 * silently dropped from the sheet — `satisfies readonly AppModeId[]` constrains
 * membership but not exhaustiveness, so nothing in the type system catches it.
 *
 * Sources was added to `appModeDefinitions` without being added here and so was
 * unreachable on phones. `tests/phone-mode-groups.test.ts` is the exhaustiveness
 * check that now fails instead: every mode id must appear in exactly one group.
 */
export const phoneModeGroups = [
  {
    id: "find",
    label: "Find",
    hint: "Answers, sources, services",
    modeIds: ["answer", "documents", "services", "forms", "favourites", "sources"],
  },
  {
    id: "diagnose",
    label: "Diagnose",
    hint: "Criteria, clues, formulation",
    modeIds: ["differentials", "dsm", "specifiers", "formulation"],
  },
  {
    id: "care",
    label: "Care",
    hint: "Medication, calculators, reference, therapy",
    modeIds: ["prescribing", "calculators", "tools", "therapy-compass", "factsheets", "dictionary", "on-call"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  hint: string;
  modeIds: readonly AppModeId[];
}>;
