import { describe, expect, it } from "vitest";

import {
  applyClinicalReview,
  collectionOf,
  finalizeClinicalReview,
  recordPinState,
  reviewProblems,
  signOffQueue,
} from "../scripts/lib/clinical-record-review-contract.mjs";

import differentialCuratedReview from "../data/differential-curated-review.json";
import formulationConcepts from "../src/data/formulation-concepts.json";
import formulationContent from "../src/data/formulation-content.json";

import { curatedDifferentials } from "@/lib/differential-curated";
import { curatedProvenanceFor, curatedProvenanceLabel } from "@/lib/differential-detail";
import { conceptReviewState, mechanismReviewState } from "@/lib/formulation-review-status";

/**
 * The sign-off kinds added for the Differentials overlays and the Formulation library.
 *
 * Two jobs. First, the enforcement the forms already have: every record signed off on disk
 * must still carry a current content pin, so an edit to signed text turns this file red
 * until the owner signs it again. Second, the round trip: a sign-off written through the
 * flat view lands in the record's native fields exactly where the app reads it, and nowhere
 * else.
 */

const NOW = new Date("2026-09-26T06:00:00.000Z");
const REVIEWED_AT = "2026-09-25T05:00:00.000Z";
const REVIEWER = "Dr Clinical Owner";
const context = { curated: curatedDifferentials, sourceLibrary: formulationContent.sourceLibrary };

type Json = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);

/** The record as the owner would first meet it, whatever has been signed on disk since. */
function asUnsigned(kind: string, document: unknown, id: string) {
  const copy = clone(document) as Record<string, Json[]>;
  const key =
    { differential: "entries", "formulation-mechanism": "mechanisms", "formulation-guide": "guides" }[kind] ??
    "concepts";
  const record = copy[key].find((entry) => (entry.id ?? entry.slug) === id)!;
  expect(record, `${kind} ${id} exists`).toBeTruthy();
  if (kind === "formulation-mechanism") {
    Object.assign(record, { reviewStatus: "clinical_review_required" });
    for (const field of ["reviewedBy", "reviewedAt", "reviewedContentSha256"]) delete record[field];
  } else if (kind === "differential") {
    Object.assign(record, { status: "drafted", reviewedBy: null, reviewedAt: null, reviewedContentSha256: null });
  } else {
    const review = record.review as Json;
    record.review = { status: "clinical_review_required", reviewer: null, preparedAt: review.preparedAt };
  }
  return copy;
}

function sign(kind: string, document: unknown, id: string) {
  const unsigned = asUnsigned(kind, document, id);
  const view = collectionOf(kind, unsigned).find((record: Json) => (record.id ?? record.slug) === id);
  const signed = finalizeClinicalReview(view, kind, {
    reviewedBy: REVIEWER,
    reviewedAt: REVIEWED_AT,
    context,
    now: NOW,
  });
  return { before: unsigned, after: applyClinicalReview(clone(unsigned), kind, signed) };
}

describe("sign-offs on disk", () => {
  it.each([
    ["differential", differentialCuratedReview],
    ["formulation-guide", formulationConcepts],
    ["formulation-concept", formulationConcepts],
    ["formulation-mechanism", formulationContent],
  ])("every %s record is unsigned or carries a current pin", (kind, document) => {
    expect(reviewProblems(collectionOf(kind, document), kind, context)).toEqual([]);
  });

  it("lists exactly the authored differential overlays, and no overlay carries its own attestation", () => {
    const slugs = differentialCuratedReview.entries.map((entry) => entry.slug);
    expect([...slugs].sort()).toEqual(Object.keys(curatedDifferentials).sort());
    for (const entry of Object.values(curatedDifferentials)) expect(entry).not.toHaveProperty("review");
  });

  it("walks the highest-consequence differentials first", () => {
    const unsigned = differentialCuratedReview.entries.map((entry) => ({ ...entry, status: "drafted" }));
    expect(signOffQueue("differential", unsigned, context).slice(0, 2)).toEqual([
      "neuroleptic-malignant-syndrome",
      "serotonin-toxicity",
    ]);
  });
});

describe("Formulation guide and concept sign-off", () => {
  it("writes the sign-off into review, where the page reads it, and nothing else", () => {
    const signed = sign("formulation-guide", formulationConcepts, "guide-08");
    const original = signed.before as unknown as typeof formulationConcepts;
    const next = signed.after as typeof formulationConcepts;
    const before = original.guides.find((guide) => guide.id === "guide-08")!;
    const after = next.guides.find((guide) => guide.id === "guide-08")! as Json & { review: Json };

    expect(after.review).toMatchObject({
      status: "reviewed",
      reviewer: REVIEWER,
      reviewedAt: REVIEWED_AT,
      preparedAt: before.review.preparedAt,
    });
    expect(after.review.reviewedContentSha256).toMatch(/^[a-f0-9]{64}$/);
    const withoutReview = (record: object) =>
      Object.fromEntries(Object.entries(record).filter(([key]) => key !== "review"));
    expect(withoutReview(after)).toEqual(withoutReview(before));
    expect(next.concepts).toEqual(original.concepts);
    expect(next.guides.filter((guide) => guide.id !== "guide-08")).toEqual(
      original.guides.filter((guide) => guide.id !== "guide-08"),
    );
    expect(conceptReviewState(after as never)).toMatchObject({ reviewed: true, detail: `Reviewed by ${REVIEWER}.` });
  });

  it("catches an edit to signed text, including search terms, which reach the public site content", () => {
    const next = sign("formulation-concept", formulationConcepts, "hopelessness").after as typeof formulationConcepts;
    const view = () => collectionOf("formulation-concept", next).find((record: Json) => record.id === "hopelessness");
    expect(recordPinState(view(), "formulation-concept")).toBe("current");

    const edited = clone(next);
    edited.concepts.find((concept) => concept.id === "hopelessness")!.searchTerms.push("despair");
    const editedView = collectionOf("formulation-concept", edited).find((record: Json) => record.id === "hopelessness");
    expect(recordPinState(editedView, "formulation-concept")).toBe("stale");

    next.concepts.find((concept) => concept.id === "hopelessness")!.summary += " Edited.";
    expect(recordPinState(view(), "formulation-concept")).toBe("stale");
    expect(reviewProblems(collectionOf("formulation-concept", next), "formulation-concept", { now: NOW })).toEqual([
      expect.stringContaining("content changed since sign-off"),
    ]);
  });

  it("refuses a native status it does not recognise rather than reading it as signed", () => {
    const document = clone(formulationConcepts);
    document.guides[0].review.status = "approved";
    expect(reviewProblems(collectionOf("formulation-guide", document), "formulation-guide").join("\n")).toMatch(
      /status must be one of drafted, reviewed/,
    );
  });
});

describe("Formulation mechanism sign-off", () => {
  it("advances reviewStatus and names the reviewer without the pre-review wording", () => {
    const next = sign("formulation-mechanism", formulationContent, "avoidance").after as typeof formulationContent;
    const after = next.mechanisms.find((mechanism) => mechanism.id === "avoidance")! as Json;
    expect(after).toMatchObject({ reviewStatus: "reviewed", reviewedBy: REVIEWER, reviewedAt: REVIEWED_AT });

    const state = mechanismReviewState(after as never);
    expect(state.reviewed).toBe(true);
    expect(state.detail).toBe(`Reviewed by ${REVIEWER}.`);
    expect(state.detail).not.toMatch(/pending/);
    expect(
      reviewProblems(collectionOf("formulation-mechanism", next), "formulation-mechanism", { ...context, now: NOW }),
    ).toEqual([]);
  });

  it("pins the source library entries the page lists, so a library edit sends it back for review", () => {
    const next = sign("formulation-mechanism", formulationContent, "avoidance").after as typeof formulationContent;
    const view = collectionOf("formulation-mechanism", next).find((record: Json) => record.id === "avoidance");
    expect(recordPinState(view, "formulation-mechanism", context)).toBe("current");

    const library = clone(formulationContent.sourceLibrary) as Record<string, { url: string }>;
    const firstSource = (view.sources as string[])[0];
    library[firstSource].url = "https://example.org/moved";
    expect(recordPinState(view, "formulation-mechanism", { sourceLibrary: library })).toBe("stale");
  });
});

describe("Differential overlay sign-off", () => {
  it("pins the whole overlay, and an edit to it sends the record back for review", () => {
    const next = sign("differential", differentialCuratedReview, "serotonin-toxicity").after;
    const row = collectionOf("differential", next).find((entry: Json) => entry.slug === "serotonin-toxicity");
    expect(row).toMatchObject({ status: "reviewed", reviewedBy: REVIEWER });
    expect(recordPinState(row, "differential", context)).toBe("current");

    const edited = clone(curatedDifferentials);
    edited["serotonin-toxicity"].doNow = [...(edited["serotonin-toxicity"].doNow ?? []), "An added step"];
    expect(recordPinState(row, "differential", { curated: edited })).toBe("stale");
  });

  it("names the reviewer in place of 'verify before use' once signed", () => {
    const entry = curatedDifferentials["serotonin-toxicity"];
    expect(curatedProvenanceFor(entry)).toBe(curatedProvenanceLabel);
    expect(curatedProvenanceFor({ ...entry, review: { reviewedBy: REVIEWER, reviewedAt: REVIEWED_AT } })).toBe(
      `Locally authored, reviewed by ${REVIEWER} on 25 September 2026`,
    );
    expect(curatedProvenanceFor({ ...entry, review: { reviewedBy: REVIEWER, reviewedAt: "not a date" } })).toBe(
      curatedProvenanceLabel,
    );
  });
});
