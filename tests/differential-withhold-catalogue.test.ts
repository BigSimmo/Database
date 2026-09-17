import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { curatedDifferentials } from "@/lib/differential-curated";
import { generatedBodyWithheld } from "@/lib/differential-detail";
import { buildDefaultDifferentialRows, loadDifferentialSnapshot } from "@/lib/differential-fixtures";
import { composeDifferentialSearchResults } from "@/lib/differential-search-composition";
import {
  differentialRecords,
  getDifferentialRecord,
  rankDifferentialRecords,
  rankPresentationWorkflows,
  scopeDifferentialRecord,
} from "@/lib/differentials";
import { differentialPresentations } from "@/lib/differentials";
import type { DifferentialRecord, DifferentialSnapshot } from "@/lib/differential-snapshot";

/** The generated export on disk, before the catalogue loader withholds it. */
const rawSnapshot = JSON.parse(readFileSync("data/differentials-snapshot.json", "utf8")) as DifferentialSnapshot;

const LITHIUM = "lithium-physiological-withdrawal-tremor";
/** The akathisia sentence the generated export filed under the lithium record. */
const CONTAMINATED = "Subjective inner restlessness is the key feature";

const withheldSlugs = Object.entries(curatedDifferentials)
  .filter(([, entry]) => generatedBodyWithheld(entry))
  .map(([slug]) => slug);

/**
 * The detail page stopped rendering this text on 2026-09-16, but the record it
 * belonged to still carried it: the one-line summary under a search result, the
 * cross-mode link subtitle and the database row that feeds retrieval all read
 * the same field. Withholding now happens once, where the catalogue is loaded,
 * so there is no surface left that can reach around it.
 */
describe("a withheld generated body never leaves the catalogue", () => {
  it("has at least one withheld record to test against", () => {
    expect(withheldSlugs).toContain(LITHIUM);
  });

  it("strips the contaminated fields from the catalogue record itself", () => {
    const record = getDifferentialRecord(LITHIUM);
    expect(record).toBeTruthy();
    expect(record!.clinicalHinge).toBe("");
    expect(record!.sections).toEqual([]);
    expect(record!.immediateActions).toEqual([]);
    expect(record!.currentPresentation).toEqual([]);
  });

  it("keeps the record itself findable and its authored safety content intact", () => {
    const record = getDifferentialRecord(LITHIUM)!;
    expect(record.title).toBe("Lithium");
    expect(record.safetySnapshot.summary).toMatch(/Lithium toxicity/);
    expect(record.investigations.length).toBeGreaterThan(0);
    expect(record.related.length).toBeGreaterThan(0);
  });

  it("never carries the contaminated sentence on a record that withheld its body", () => {
    // The sentence itself is correct where it belongs. Akathisia and the rest of
    // the extrapyramidal family keep it; only the records that withheld their
    // generated body must be free of it.
    const offenders = differentialRecords
      .filter((record) => withheldSlugs.includes(record.slug))
      .filter((record) => JSON.stringify(record).includes(CONTAMINATED))
      .map((record) => record.slug);
    expect(offenders).toEqual([]);

    // The control: the record it actually describes still has it, so this test
    // cannot pass by the catalogue having lost the sentence everywhere.
    expect(JSON.stringify(getDifferentialRecord("akathisia"))).toContain(CONTAMINATED);
  });

  it("never seeds a withheld record's contaminated text into its database row", () => {
    // These rows are what retrieval reads, so a leak here outlives any fix made
    // in the page layer. Matched on the row's own slug: a presentation row that
    // merely lists lithium as a candidate is a different record and legitimately
    // carries the akathisia text.
    const rows = buildDefaultDifferentialRows("owner-under-test");
    const lithiumRow = rows.find((row) => (row as { slug?: string }).slug === LITHIUM);
    expect(lithiumRow, "the lithium diagnosis row should exist").toBeTruthy();
    expect(JSON.stringify(lithiumRow)).not.toContain(CONTAMINATED);
  });

  it("no longer offers the wrong diagnosis's sentence as this record's summary line", () => {
    // The line under a search result was `record.clinicalHinge`, so searching
    // "lithium" used to return "Lithium — Subjective inner restlessness is the
    // key feature". It now falls through to the record's own subtitle.
    const matches = rankDifferentialRecords(differentialRecords, "lithium tremor", 10);
    const presentations = rankPresentationWorkflows(differentialPresentations(), "lithium tremor", 10);
    const results = composeDifferentialSearchResults(matches, presentations, 10);
    const lithium = results.find((item) => item.id.includes(LITHIUM));

    expect(lithium, "the lithium record should still be findable").toBeTruthy();
    expect(lithium!.subtitle).not.toContain("inner restlessness");
    expect(lithium!.subtitle).toMatch(/postural bilateral tremor/i);
  });

  it("still ranks the record that the contaminated sentence actually belongs to", () => {
    // The withhold must not have cost catalogue search its real match. Note that
    // the lithium record can still surface for this query through its related
    // node's description of akathisia, which is an accurate description of that
    // node and is left alone; what it no longer does is claim the sentence as
    // its own.
    const slugs = rankDifferentialRecords(differentialRecords, "inner restlessness", 5).map(
      (match) => match.record.slug,
    );
    expect(slugs[0]).toBe("akathisia");
  });

  it("leaves every record that is not withheld exactly as the snapshot holds it", () => {
    const snapshot = loadDifferentialSnapshot();
    const untouched = snapshot.diagnoses.filter((record) => !withheldSlugs.includes(record.slug));
    expect(untouched.length).toBe(snapshot.diagnoses.length - withheldSlugs.length);
    for (const record of untouched) {
      expect(record.clinicalHinge, `${record.slug} lost its clinical hinge`).toBeTruthy();
    }
  });
});

/**
 * Codex P1 on PR #2838, and it was right: withholding in the snapshot loader
 * covers the seed path only. In production `site_content` is initialized, so
 * `/api/differentials` returns the LIVE row's `finalRenderPayload` and maps it
 * through `scopeDifferentialRecord` alone — the loader never runs. The live
 * lithium row still holds the contaminated hinge and actions, so catalogue
 * search kept ranking and returning them while every seed-backed test passed.
 *
 * The withhold therefore belongs in the shared canonical-read projection, not
 * only at the loader. That also demotes the pending republish from "the safety
 * fix" to cleanup: the read path is safe whatever the row still contains.
 */
describe("the canonical read projection withholds a contaminated body", () => {
  /** The live row as the database still holds it, straight from the export. */
  function liveRow(slug: string): DifferentialRecord {
    const exported = rawSnapshot.diagnoses.find((record) => record.slug === slug);
    if (!exported) throw new Error(`missing export record: ${slug}`);
    return structuredClone(exported);
  }

  it("strips the body from a live payload that never passed through the loader", () => {
    const row = liveRow(LITHIUM);
    // Proof the fixture is the contaminated row and not an already-clean one.
    expect(row.clinicalHinge).toContain(CONTAMINATED);
    expect(row.sections.length).toBeGreaterThan(0);

    const projected = scopeDifferentialRecord(row);

    expect(projected.clinicalHinge).toBe("");
    expect(projected.sections).toEqual([]);
    expect(projected.immediateActions).toEqual([]);
    expect(projected.currentPresentation).toEqual([]);
    expect(JSON.stringify(projected)).not.toContain(CONTAMINATED);
  });

  it("leaves a live payload for any other record alone", () => {
    const row = liveRow("akathisia");
    const projected = scopeDifferentialRecord(row);

    expect(projected.sections.length).toBeGreaterThan(0);
    expect(projected.immediateActions.length).toBeGreaterThan(0);
  });

  it("agrees with the loader path, so seed and live reads cannot diverge", () => {
    // The failure this guards is subtle: if the two paths withhold in a
    // different order relative to presentation scoping, a seed-backed test
    // passes while production renders something else.
    const viaLive = scopeDifferentialRecord(liveRow(LITHIUM));
    const viaLoader = getDifferentialRecord(LITHIUM);

    expect(viaLive).toEqual(viaLoader);
  });
});
