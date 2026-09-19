import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { DifferentialSnapshot } from "@/lib/differential-snapshot";

/** The generated export on disk, read raw: this guard is about what the export writes. */
const rawSnapshot = JSON.parse(readFileSync("data/differentials-snapshot.json", "utf8")) as DifferentialSnapshot;

/**
 * Diagnoses are keyed by `slug` and presentation workflows by `id`, in two separate
 * families of one generated file — and three values appear in both. A collection that
 * flattens the two families into one identifier-keyed structure (an object, a `Map`, a
 * `Set`, or a React list keyed on `id`) therefore silently keeps 229 of the 232 records
 * and shows no sign that three are gone. `src/lib/developer-area/sign-off-queue.ts`
 * already works around exactly this, with namespaced `differential-diagnosis:` and
 * `differential-presentation:` keys and a comment saying why; this file is the guard that
 * stops a fourth collision arriving unnoticed, in that surface or any future one.
 *
 * WHY THE BASELINE IS THREE, AND NOT ZERO. The three below are real records that happen
 * to share a name with a presentation workflow, not duplicates and not an export defect
 * to be deleted. Renaming one changes a URL a clinician may have bookmarked
 * (`/differentials/diagnoses/depression` and `/differentials/presentations/depression`
 * are both live routes), so the naming decision is the owner's and is deliberately not
 * made here.
 *
 * WHERE THE REAL FIX BELONGS. In the exporter, `scripts/import-differentials-export.ts`
 * — the identifiers are minted upstream and this file is only their record. That script
 * cannot run in CI or on a Linux checkout today: its default input path is hardcoded to a
 * Windows temp directory (`DEFAULT_ZIP`, line 8), so regenerating the snapshot needs the
 * owner's machine. Until then this test holds the line: it accepts the three known
 * collisions and fails on a fourth.
 *
 * A FAILURE IS NOT AN INSTRUCTION TO WIDEN THE BASELINE. A new collision means two
 * records that a flattened view will now merge. Namespace the identifiers in the
 * exporter, or decide the rename — adding the name here restores the silent loss this
 * guard exists to surface.
 */
const ACCEPTED_COLLISIONS = ["depression", "substance-intoxication", "substance-withdrawal"] as const;

describe("differential snapshot identifiers", () => {
  const diagnosisSlugs = rawSnapshot.diagnoses.map((record) => record.slug);
  const presentationIds = rawSnapshot.presentations.map((workflow) => workflow.id);

  it("keeps every identifier unique inside its own family", () => {
    expect(new Set(diagnosisSlugs).size).toBe(diagnosisSlugs.length);
    expect(new Set(presentationIds).size).toBe(presentationIds.length);
  });

  it("gains no collision between a diagnosis slug and a presentation id beyond the accepted three", () => {
    const slugs = new Set(diagnosisSlugs);
    const collisions = presentationIds.filter((id) => slugs.has(id)).sort();

    expect(
      collisions,
      "A diagnosis slug and a presentation id now share a value. Anything keying both families " +
        "by identifier will drop one of the two records without reporting it. Namespace the " +
        "identifiers in scripts/import-differentials-export.ts, or rename one record; do not add " +
        "the new value to ACCEPTED_COLLISIONS.",
    ).toEqual([...ACCEPTED_COLLISIONS]);
  });

  it("loses exactly three records to a flattened identifier keying, which is what the guard measures", () => {
    const total = diagnosisSlugs.length + presentationIds.length;
    const flattened = new Set([...diagnosisSlugs, ...presentationIds]);

    expect(total).toBe(232);
    expect(flattened.size).toBe(total - ACCEPTED_COLLISIONS.length);
  });
});
