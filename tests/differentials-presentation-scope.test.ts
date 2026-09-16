import { describe, expect, it } from "vitest";

import { differentialRecords, differentialPresentations } from "@/lib/differentials";
import type { DifferentialRecord } from "@/lib/differential-snapshot";

/**
 * Presentation-scope guard for the differentials corpus.
 *
 * The export parser derives each diagnosis record from its presentation group.
 * Several fields on that group — the clinical hinge, immediate actions,
 * investigations and mimics — describe the *presentation*, not the individual
 * diagnosis underneath it. Copying them onto the diagnosis record without saying
 * so makes the app state something clinically false about that diagnosis: the
 * acute dystonia record read "Subjective inner restlessness is the key feature",
 * which is the akathisia discriminator, and listed thyroid function tests, which
 * is a tremor workup.
 *
 * `src/lib/dsm.ts` documents the same defect from the DSM sidebar's side and
 * routes around it locally. These tests pin the fix at the corpus level instead:
 * presentation-scope text stays in the corpus, but it is labelled as group
 * context and never presented as the diagnosis's own discriminator.
 */

const records = differentialRecords;
const presentations = differentialPresentations();

function recordsForGroup(groupId: string): DifferentialRecord[] {
  const workflow = presentations.find((presentation) => presentation.id === groupId);
  if (!workflow) return [];
  return workflow.candidates
    .map((candidate) => records.find((record) => record.slug === candidate.slug))
    .filter((record): record is DifferentialRecord => Boolean(record));
}

const siblingGroups = presentations
  .map((presentation) => ({
    id: presentation.id,
    title: presentation.title,
    records: recordsForGroup(presentation.id),
  }))
  .filter((group) => group.records.length > 1);

describe("differentials presentation scope", () => {
  it("has sibling groups to check", () => {
    expect(siblingGroups.length).toBeGreaterThan(20);
  });

  it("never marks text shared by every sibling as diagnosis-scoped", () => {
    const offenders: string[] = [];
    for (const group of siblingGroups) {
      const sectionIds = new Set(group.records.flatMap((record) => record.sections.map((section) => section.id)));
      for (const sectionId of sectionIds) {
        const sections = group.records.map((record) => record.sections.find((section) => section.id === sectionId));
        if (sections.some((section) => !section)) continue;
        const present = sections.filter((section): section is NonNullable<typeof section> => Boolean(section));
        const values = present.map((section) => JSON.stringify([section.summary, section.items]));
        const identical = new Set(values).size === 1;
        const claimsDiagnosisScope = present.some((section) => section.scope !== "presentation");
        if (identical && claimsDiagnosisScope && present[0]!.summary.trim()) {
          offenders.push(`${group.title} :: ${sectionId}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never marks a hinge shared by every sibling as that diagnosis's own hinge", () => {
    const offenders = siblingGroups
      .filter((group) => {
        const hinges = new Set(group.records.map((record) => record.clinicalHinge.trim()).filter(Boolean));
        if (hinges.size !== 1) return false;
        return group.records.some((record) => record.clinicalHingeScope !== "presentation");
      })
      .map((group) => group.title);
    expect(offenders).toEqual([]);
  });

  it("keeps acute dystonia free of the akathisia discriminator", () => {
    const dystonia = records.find((record) => record.slug === "acute-dystonia");
    expect(dystonia).toBeDefined();
    const diagnosisScoped = [
      dystonia!.clinicalHingeScope === "presentation" ? "" : dystonia!.clinicalHinge,
      dystonia!.safetySnapshot.summary,
      ...dystonia!.sections
        .filter((section) => section.scope !== "presentation")
        .flatMap((section) => [section.summary, ...section.items]),
    ]
      .join(" ")
      .toLowerCase();
    expect(diagnosisScoped).not.toContain("inner restlessness");
    expect(diagnosisScoped).not.toContain("thyroid function");
  });

  it("keeps why-it-fits and must-not-miss genuinely diagnosis-scoped", () => {
    for (const group of siblingGroups) {
      for (const sectionId of ["why-it-fits", "must-not-miss"]) {
        const summaries = group.records
          .map((record) => record.sections.find((section) => section.id === sectionId)?.summary?.trim())
          .filter(Boolean);
        if (summaries.length < 2) continue;
        expect(new Set(summaries).size, `${group.title} :: ${sectionId}`).toBeGreaterThan(1);
      }
    }
  });

  it("labels every presentation-scope hinge so a surface cannot present it unqualified", () => {
    // The detail page's headline hinge panel is the most prominent place the
    // text appears. It reads as the diagnosis's own discriminator unless the
    // record says otherwise, so every record carrying a group hinge must be
    // marked. All 201 currently are.
    const unlabelled = records.filter(
      (record) => record.clinicalHinge.trim() && record.clinicalHingeScope === undefined,
    );
    expect(unlabelled.map((record) => record.slug)).toEqual([]);
  });

  it("does not repeat presentation hinge text inside why-it-fits", () => {
    const offenders = records
      .filter((record) => {
        const hinge = record.clinicalHinge.trim();
        if (!hinge || record.clinicalHingeScope !== "presentation") return false;
        const why = record.sections.find((section) => section.id === "why-it-fits");
        return Boolean(why?.items.some((item) => item.trim() === hinge));
      })
      .map((record) => record.slug);
    expect(offenders).toEqual([]);
  });
});
