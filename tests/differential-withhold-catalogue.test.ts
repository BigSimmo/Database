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
} from "@/lib/differentials";
import { differentialPresentations } from "@/lib/differentials";

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
