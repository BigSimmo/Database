import { describe, expect, it } from "vitest";
import { isReviewedTablePromotable, tableReviewMetadata } from "../src/lib/table-review";

describe("table review governance", () => {
  it("promotes only clinically useful reviewed tables", () => {
    expect(isReviewedTablePromotable({})).toBe(true);
    expect(isReviewedTablePromotable(tableReviewMetadata({ reviewClass: "clinical_useful" }))).toBe(true);
    expect(isReviewedTablePromotable(tableReviewMetadata({ reviewClass: "administrative" }))).toBe(false);
    expect(isReviewedTablePromotable(tableReviewMetadata({ reviewClass: "unrelated" }))).toBe(false);
    expect(isReviewedTablePromotable(tableReviewMetadata({ reviewClass: "bad_extraction" }))).toBe(false);
  });

  it("keeps review metadata machine-readable for linked image and fact demotion", () => {
    const metadata = tableReviewMetadata({
      reviewClass: "bad_extraction",
      notes: "OCR split rows incorrectly.",
      confidence: 2,
      reviewerId: "user-1",
    });

    expect(metadata.review_class).toBe("bad_extraction");
    expect(metadata.review_confidence).toBe(1);
    expect(metadata.clinical_use_class).toBe("ambiguous");
    expect(metadata.table_role).toBe("unrelated");
  });
});
