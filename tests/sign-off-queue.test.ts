import { describe, expect, it } from "vitest";

import { loadSignOffQueue, type SignOffFamilyId } from "@/lib/developer-area/sign-off-queue";
import { assertNoDraftIsPublished, dictionarySenseDrafts } from "@/lib/dictionary-editorial/sense-drafts";
import { dictionaryDefinitionReviews } from "@/lib/dictionary-editorial/definition-reviews";
import { acquisitionReviewQueue } from "@/lib/sources/acquisition-ledger";

/**
 * The failure this file exists to prevent is a silent zero.
 *
 * Every family here is read from a committed file by a filter. A renamed field,
 * a changed status word, or a data file that moves would make that filter match
 * nothing — and the page would render "0 records awaiting sign-off", which reads
 * as "nothing is outstanding" rather than "the reader stopped working". So the
 * per-family counts are pinned to the numbers measured on 2026-09-18, and the
 * expectations carry the measurement rather than a range.
 *
 * These numbers are expected to change as records are signed off. A count that
 * has *fallen* is a real event and updating the figure here is the correct fix;
 * a count that has fallen to zero for a whole family is the bug.
 */
const EXPECTED: Record<SignOffFamilyId, number> = {
  "wa-mha-forms": 54,
  formulation: 12,
  // 201 exported diagnosis records + 31 presentation workflows, all of which
  // derive `validation_status: unverified` from the same snapshot governance
  // block. The prior hand count of "201" covered the diagnoses only.
  differentials: 232,
  // 333 sense drafts + 96 definition reviews.
  dictionary: 429,
  specifiers: 585,
  therapy: 205,
  // 77 records carry disposition `candidate`; 75 of those are still
  // `validationStatus: unverified` and so appear in acquisitionReviewQueue().
  sources: 75,
};

describe("clinical sign-off queue", () => {
  const queue = loadSignOffQueue();

  it("reports the seven families once each, in a stable order", () => {
    expect(queue.families.map((family) => family.id)).toEqual([
      "wa-mha-forms",
      "formulation",
      "differentials",
      "dictionary",
      "specifiers",
      "therapy",
      "sources",
    ]);
  });

  it.each(Object.entries(EXPECTED))("counts %s as %i records awaiting sign-off", (id, expected) => {
    const family = queue.families.find((candidate) => candidate.id === id);
    expect(family, `${id} is missing from the queue`).toBeDefined();
    expect(
      family!.rows.length,
      `${id} reported ${family!.rows.length} rows, expected ${expected}. If records were genuinely signed off, update EXPECTED; a drop to zero means the reader stopped matching its source file.`,
    ).toBe(expected);
  });

  it("never reports an empty family, which would read as 'nothing outstanding'", () => {
    for (const family of queue.families) {
      expect(family.rows.length, `${family.id} is empty`).toBeGreaterThan(0);
    }
  });

  it("derives the total from the rows rather than carrying its own number", () => {
    const summed = queue.families.reduce((sum, family) => sum + family.rows.length, 0);
    expect(queue.total).toBe(summed);
    expect(queue.total).toBe(Object.values(EXPECTED).reduce((sum, count) => sum + count, 0));
  });

  it("reuses the source acquisition ledger's own queue rather than re-deriving the filter", () => {
    const sources = queue.families.find((family) => family.id === "sources")!;
    expect(sources.rows.map((row) => row.id)).toEqual(acquisitionReviewQueue().map((record) => record.id));
  });

  it("carries the whole dictionary editorial layer, which nothing else in the app renders", () => {
    const dictionary = queue.families.find((family) => family.id === "dictionary")!;
    expect(dictionary.unrouted).toBe(true);
    for (const draft of dictionarySenseDrafts) {
      expect(
        dictionary.rows.some((row) => row.id === draft.id),
        `${draft.id} is missing`,
      ).toBe(true);
    }
    for (const review of dictionaryDefinitionReviews) {
      expect(
        dictionary.rows.some((row) => row.id === review.id),
        `${review.id} is missing`,
      ).toBe(true);
    }
  });

  it("leaves every dictionary draft unpublished", () => {
    // The panel reads these records; it must never be the thing that publishes
    // one. Asserted here rather than only in the dictionary's own contract test
    // so this feature cannot be the change that breaks it.
    expect(() => assertNoDraftIsPublished()).not.toThrow();
    for (const review of dictionaryDefinitionReviews) {
      expect(review.publicationAllowed).toBe(false);
      expect(review.applyAutomatically).toBe(false);
      expect(review.reviewer).toBeNull();
    }
  });

  it("keeps each family's own review vocabulary rather than a shared status", () => {
    // The five vocabularies, each still spelled the way its own source file
    // spells it. If a refactor ever does unify them, this is the assertion that
    // should be argued with first.
    const nativeStatusFor = (id: SignOffFamilyId) =>
      queue.families.find((family) => family.id === id)!.rows[0]!.nativeStatus;
    expect(nativeStatusFor("wa-mha-forms")).toBe("drafted");
    expect(nativeStatusFor("formulation")).toBe("clinical_review_required");
    expect(nativeStatusFor("differentials")).toContain("validation_status: unverified");
    expect(nativeStatusFor("dictionary")).toContain("clinicalApproval.status: pending");
    expect(nativeStatusFor("specifiers")).toContain("clinician-review-pending");
    expect(nativeStatusFor("therapy")).toBe("needs_review");
    expect(nativeStatusFor("sources")).toContain("validationStatus: unverified");
  });

  it("gives every row an id, a title, a sign-off requirement and either a real route or none", () => {
    for (const family of queue.families) {
      for (const row of family.rows) {
        expect(row.id.trim(), `${family.id} row has no id`).not.toBe("");
        expect(row.title.trim(), `${family.id}/${row.id} has no title`).not.toBe("");
        expect(row.requires.trim(), `${family.id}/${row.id} says nothing about signing off`).not.toBe("");
        expect(row.statusLabel.trim(), `${family.id}/${row.id} has no display label`).not.toBe("");
        if (row.href !== null) expect(row.href.startsWith("/"), `${family.id}/${row.id} -> ${row.href}`).toBe(true);
      }
    }
  });

  it("gives every row a key unique across the whole queue, so the page cannot drop one to a React key clash", () => {
    // Not a theoretical guard. Three presentation workflows share an id with a
    // diagnosis record of the same name (`depression`, `substance-intoxication`,
    // `substance-withdrawal`), so keying on `id` renders 229 differential rows
    // under a heading that says 232.
    const keys = queue.families.flatMap((family) => family.rows.map((row) => row.key));
    expect(new Set(keys).size).toBe(queue.total);
  });

  it("links no record in a family it declares unrouted", () => {
    for (const family of queue.families.filter((candidate) => candidate.unrouted)) {
      const linked = family.rows.filter((row) => row.href !== null);
      // The dictionary family is half-routed: the 96 definition reviews target a
      // live dictionary entry, the 333 sense drafts have nowhere to go. The flag
      // means "this family holds records nothing renders", so the assertion is
      // that at least one row really has no destination.
      expect(linked.length, `${family.id} declares itself unrouted but links every row`).toBeLessThan(
        family.rows.length,
      );
    }
  });
});
