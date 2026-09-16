import { describe, expect, it } from "vitest";

import {
  differentialPresentations,
  differentialRecords,
  getDifferentialDetailContext,
  scopeDifferentialRecord,
} from "@/lib/differentials";
import { buildDiscriminators } from "@/lib/differential-detail";
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

  it("marks every comparison criterion whose answer is identical across the group", () => {
    // Codex P1 on PR #2812: the scope existed but neither comparison layout read
    // it, so acute dystonia's column still showed the akathisia bedside question
    // as a fact about acute dystonia. The renderer keys off criterion.scope, so
    // an unmarked shared criterion silently reintroduces that.
    const offenders: string[] = [];
    for (const presentation of presentations) {
      const candidates = presentation.candidates ?? [];
      if (candidates.length < 2) continue;
      for (const criterion of presentation.criteria ?? []) {
        const values = candidates.map((candidate) => candidate.comparison?.[criterion.id]?.trim()).filter(Boolean);
        const identical = values.length === candidates.length && new Set(values).size === 1;
        if (identical && criterion.scope !== "presentation") {
          offenders.push(`${presentation.title} :: ${criterion.id}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps a group hinge out of the map's tell-them-apart column", () => {
    // Codex P2 on PR #2812: buildDiscriminators used the related record's raw
    // hinge, which is the group's and therefore identical for every sibling — it
    // cannot separate two of them, and printing it asserts it of that diagnosis.
    const dystonia = records.find((record) => record.slug === "acute-dystonia");
    expect(dystonia).toBeDefined();
    const context = getDifferentialDetailContext(dystonia!);
    const rows = buildDiscriminators(dystonia!, {
      knownRelatedSlugs: context.knownRelatedSlugs,
      relatedMapDetails: context.relatedMapDetails,
      curated: null,
    });
    expect(rows.length).toBeGreaterThan(0);
    // Pin the hinge STRING, not a phrase inside it: akathisia's own per-edge note
    // legitimately says "inner restlessness", because that is what akathisia is.
    // What must never appear is the group hinge presented as a discriminator.
    const groupHinges = new Set(
      presentations.map((presentation) => presentation.safetySnapshot?.summary?.trim()).filter(Boolean),
    );
    expect(groupHinges.size).toBeGreaterThan(0);
    for (const row of rows) {
      expect(groupHinges.has(row.favoursRelated.trim()), `${row.slug} favoursRelated`).toBe(false);
      expect(groupHinges.has((row.favoursFocus ?? "").trim()), `${row.slug} favoursFocus`).toBe(false);
    }
  });

  it("scopes a canonical record that was published before scope existed", () => {
    // Codex P1 on PR #2812: canonical payloads were seeded from the deliberately
    // unlabelled snapshot, so a production read returns no scope at all and the
    // UI defaults it to diagnosis-specific. Every canonical reader must relabel.
    const dystonia = records.find((record) => record.slug === "acute-dystonia");
    expect(dystonia).toBeDefined();
    const stripped = {
      ...dystonia!,
      clinicalHingeScope: undefined,
      sections: dystonia!.sections.map((section) => ({ ...section, scope: undefined })),
    };
    const rescoped = scopeDifferentialRecord(stripped);
    expect(rescoped.clinicalHingeScope).toBe("presentation");
    expect(rescoped.sections.find((section) => section.id === "bedside-question")?.scope).toBe("presentation");
    expect(rescoped.sections.find((section) => section.id === "why-it-fits")?.scope).toBe("diagnosis");
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
