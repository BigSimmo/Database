import type { AppModeId } from "@/lib/app-modes";

/**
 * How the phone mode sheet groups the app's modes.
 *
 * The desktop mode menu renders `appModeDefinitions` as one flat list, but an
 * nineteen-item list is unusable on a phone, so the sheet groups it. That makes
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
    modeIds: ["answer", "documents", "services", "favourites", "sources"],
  },
  // Psychiatry is a mode of its own (a dashboard at `/psychiatry`) that
  // gathers these sections. It leads the group, and the sections stay listed
  // under it so each keeps its own search. It replaced the "Diagnose" group,
  // and took Forms from Find and Therapy from Care.
  {
    id: "psychiatry",
    label: "Psychiatry",
    hint: "Diagnosis, formulation, therapy, forms",
    modeIds: ["psychiatry", "dsm", "differentials", "specifiers", "formulation", "therapy-compass", "forms"],
  },
  {
    id: "care",
    label: "Care",
    hint: "Medication, calculators, reference",
    modeIds: ["prescribing", "calculators", "tools", "factsheets", "dictionary"],
  },
  // The groups above are the Clinical area. On Call and CPD are areas of their
  // own rather than the tail of "Care", so the urgent screen is not buried at
  // the bottom of the clinical list. A My Work area joins them once it has a
  // home page of its own.
  {
    id: "on-call",
    label: "On Call",
    hint: "Who to ring, right now",
    modeIds: ["on-call"],
  },
  {
    id: "cpd",
    label: "CPD",
    hint: "Learning and evidence",
    modeIds: ["cme"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  hint: string;
  modeIds: readonly AppModeId[];
}>;
