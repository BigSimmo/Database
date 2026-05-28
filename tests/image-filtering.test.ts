import { describe, expect, it } from "vitest";
import {
  cheapImageSkipReason,
  classifiedImageSkipReason,
  lightweightPerceptualHash,
} from "../src/lib/image-filtering";

describe("smart image filtering", () => {
  it("skips repeated exact image hashes before captioning", () => {
    const seenHashes = new Set(["abc"]);
    expect(
      cheapImageSkipReason({
        bytesLength: 80_000,
        imageHash: "abc",
        seenHashes,
        image: { sourceKind: "embedded", width: 600, height: 400 },
      }),
    ).toBe("duplicate image");
  });

  it("skips likely header or footer logos", () => {
    expect(
      cheapImageSkipReason({
        bytesLength: 20_000,
        imageHash: "def",
        seenHashes: new Set(),
        image: { sourceKind: "embedded", width: 160, height: 60, bbox: [20, 20, 180, 80] },
      }),
    ).toBe("logo/header/footer placement");
  });

  it("keeps relevant clinical classifications searchable", () => {
    expect(
      classifiedImageSkipReason({
        image_type: "clinical_table",
        searchable: true,
        clinical_relevance_score: 0.9,
        skip_reason: null,
      }),
    ).toBeNull();
  });

  it("skips decorative classifications", () => {
    expect(
      classifiedImageSkipReason({
        image_type: "logo_decorative",
        searchable: false,
        clinical_relevance_score: 0,
        skip_reason: null,
      }),
    ).toBe("logo or decorative mark");
  });

  it("builds a stable lightweight perceptual hash key", () => {
    expect(lightweightPerceptualHash("1234567890abcdef", 100, 200)).toBe("1234567890abcdef:100:200");
  });
});
