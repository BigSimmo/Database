import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import formulationConcepts from "@/data/formulation-concepts.json";
import formulationContent from "@/data/formulation-content.json";
import { loadSignOffQueue } from "@/lib/developer-area/sign-off-queue";
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
  it("reads the shipped corpus as awaiting review unless the tool signed it off", () => {
    // npm run clinical:review writes reviewStatus "reviewed" with a named reviewer and a
    // content pin (kept current by tests/clinical-signoff-kinds.test.ts); nothing else may.
    for (const mechanism of formulationContent.mechanisms as Array<Record<string, unknown>>) {
      const state = mechanismReviewState(mechanism);
      if (mechanism.reviewStatus === "reviewed") {
        expect(String(mechanism.reviewedBy ?? "").trim()).toBeTruthy();
        expect(mechanism.reviewedContentSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(state.reviewed).toBe(true);
        continue;
      }
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

  it("recognises the repository's own signed-off value", () => {
    const state = mechanismReviewState({ reviewStatus: "reviewed", reviewedBy: "Dr A. Example" });
    expect(state.reviewed).toBe(true);
    expect(state.label).toBe(REVIEWED);
    expect(state.detail).toBe("Reviewed by Dr A. Example.");
  });

  it("does not honour a mechanism sign-off that names no reviewer", () => {
    for (const reviewedBy of [undefined, null, "", "   "]) {
      expect(mechanismReviewState({ reviewStatus: "reviewed", reviewedBy }).reviewed).toBe(false);
    }
  });

  it("fails closed on anything it does not recognise", () => {
    const unrecognised = [
      undefined,
      null,
      "",
      "   ",
      "approved",
      "sign-off complete",
      "reviewed-ish",
      "clinical_review_required",
      "CLINICALLY_REVIEWED_PENDING",
    ];
    for (const reviewStatus of unrecognised) {
      expect(mechanismReviewState({ reviewStatus }).reviewed).toBe(false);
    }
  });
});

describe("conceptReviewState", () => {
  it("reads every shipped concept and guide as awaiting review unless the tool signed it off", () => {
    const records = [...formulationConcepts.concepts, ...formulationConcepts.guides];
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      const state = conceptReviewState(record);
      const review = record.review as Record<string, unknown>;
      if (review.status === "reviewed") {
        expect(review.reviewedContentSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(state.reviewed).toBe(true);
        continue;
      }
      expect(state.reviewed).toBe(false);
      expect(state.label).toBe(AWAITING);
    }
  });

  it("names the reviewer once a record is signed off", () => {
    const state = conceptReviewState({
      review: { status: "reviewed", reviewer: "Dr A. Example", preparedAt: "2026-09-14" },
    });
    expect(state.reviewed).toBe(true);
    expect(state.detail).toContain("Dr A. Example");
  });

  it("does not honour a sign-off with no reviewer named", () => {
    for (const reviewer of [undefined, null, "", "  "]) {
      const state = conceptReviewState({ review: { status: "reviewed", reviewer } });
      expect(state.reviewed).toBe(false);
      expect(state.label).toBe(AWAITING);
    }
  });

  it("survives a record with no review block at all", () => {
    expect(conceptReviewState({}).reviewed).toBe(false);
    expect(conceptReviewState({ review: null }).reviewed).toBe(false);
  });
});

/**
 * The divergence this pins was real, not hypothetical: the module first
 * invented its own vocabulary while the sign-off queue keyed on `"reviewed"`,
 * so a mechanism signed off the established way would have dropped off the
 * pending queue while its own page still read "Awaiting clinical review".
 * Both sides now call one predicate; this proves they still agree.
 */
describe("the sign-off queue and the clinician-facing page agree", () => {
  it("lists exactly the mechanisms whose page says they await review", () => {
    const family = loadSignOffQueue().families.find((entry) => entry.id === "formulation");
    expect(family).toBeDefined();
    const pending = new Set(family!.rows.map((row) => row.id));

    for (const mechanism of formulationContent.mechanisms) {
      const awaiting = !mechanismReviewState(mechanism).reviewed;
      expect(
        pending.has(mechanism.id),
        `${mechanism.id}: queue says pending=${pending.has(mechanism.id)}, page says awaiting=${awaiting}`,
      ).toBe(awaiting);
    }
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
    // The status rail used to assert "no named reviewer" as a literal string,
    // which would have contradicted the badge on a signed-off record.
    expect(source).toContain('["Review", reviewState.label]');
    expect(source).not.toContain("No named reviewer has signed this record off");
  });
});
