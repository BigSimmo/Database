import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import formulationConcepts from "@/data/formulation-concepts.json";
import formulationContent from "@/data/formulation-content.json";
import { conceptReviewState, mechanismReviewState } from "@/lib/formulation-review-status";

/**
 * Formulation records carried their governance state in data and dropped it
 * before the screen: `reviewStatus` on a mechanism, `review.status` on a
 * concept or guide, none of it rendered. An unsigned record looked exactly
 * like a signed one, which is the failure this file exists to keep closed.
 *
 * Two halves. The unit tests pin the decision — in particular that it fails
 * closed on anything it does not recognise. The wiring tests pin that both
 * reading surfaces still render it, because the original defect was not a
 * wrong decision, it was a correct decision nobody displayed.
 */

const AWAITING = "Awaiting clinical review";
const REVIEWED = "Clinically reviewed";

function componentSource(file: string): string {
  return readFileSync(path.join(process.cwd(), "src/components/formulation", file), "utf8");
}

describe("mechanismReviewState", () => {
  it("reads the shipped corpus as awaiting review", () => {
    for (const mechanism of formulationContent.mechanisms) {
      const state = mechanismReviewState(mechanism);
      expect(state.reviewed).toBe(false);
      expect(state.label).toBe(AWAITING);
      expect(state.detail).toContain("No clinician has signed off");
    }
  });

  it("carries the record's own source wording into the note", () => {
    const state = mechanismReviewState({
      reviewStatus: "clinical_review_required",
      sourceStatus: "Source metadata reviewed 2026-09-14; named clinical confirmation pending",
      sourceConfidence: "Static source metadata recorded; claims ungraded pending clinical review",
    });
    expect(state.detail).toContain("Source metadata reviewed 2026-09-14");
    expect(state.detail).toContain("claims ungraded pending clinical review");
  });

  it("recognises a signed-off status", () => {
    const state = mechanismReviewState({ reviewStatus: "clinically_reviewed" });
    expect(state.reviewed).toBe(true);
    expect(state.label).toBe(REVIEWED);
  });

  it("fails closed on anything it does not recognise", () => {
    const unrecognised = [
      undefined,
      null,
      "",
      "   ",
      "approved",
      "reviewed",
      "sign-off complete",
      "clinical_review_required",
      "CLINICALLY_REVIEWED_PENDING",
    ];
    for (const reviewStatus of unrecognised) {
      expect(mechanismReviewState({ reviewStatus }).reviewed).toBe(false);
    }
  });
});

describe("conceptReviewState", () => {
  it("reads every shipped concept and guide as awaiting review", () => {
    const records = [...formulationConcepts.concepts, ...formulationConcepts.guides];
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      const state = conceptReviewState(record);
      expect(state.reviewed).toBe(false);
      expect(state.label).toBe(AWAITING);
    }
  });

  it("names the reviewer once a record is signed off", () => {
    const state = conceptReviewState({
      review: { status: "clinically_reviewed", reviewer: "Dr A. Example", preparedAt: "2026-09-14" },
    });
    expect(state.reviewed).toBe(true);
    expect(state.detail).toContain("Dr A. Example");
  });

  it("does not honour a sign-off with no reviewer named", () => {
    for (const reviewer of [undefined, null, "", "  "]) {
      const state = conceptReviewState({ review: { status: "clinically_reviewed", reviewer } });
      expect(state.reviewed).toBe(false);
      expect(state.label).toBe(AWAITING);
    }
  });

  it("survives a record with no review block at all", () => {
    expect(conceptReviewState({}).reviewed).toBe(false);
    expect(conceptReviewState({ review: null }).reviewed).toBe(false);
  });
});

describe("the review state reaches both reading surfaces", () => {
  it("renders on the mechanism page", () => {
    const source = componentSource("formulation-mechanism-page.tsx");
    expect(source).toContain("mechanismReviewState(mechanism)");
    expect(source).toContain("<RecordReviewBadge state={reviewState} />");
    expect(source).toContain("<RecordReviewNote state={reviewState} />");
  });

  it("renders on the concept and guide page", () => {
    const source = componentSource("formulation-concept-page.tsx");
    expect(source).toContain("conceptReviewState(record)");
    expect(source).toContain("<RecordReviewBadge state={reviewState} />");
    expect(source).toContain("<RecordReviewNote state={reviewState} />");
  });
});
