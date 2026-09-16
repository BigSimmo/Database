import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { classifySourceAuthority } from "@/lib/source-authority-registry";

/**
 * The upload payload used to initialise `metadata.jurisdiction` to
 * "Australia/WA" while every other field it could not establish — publisher,
 * version, publication date — was honestly null.
 *
 * Nothing about an upload says where the document was published. A clinician
 * uploading the APA's own PDF produced a record asserting it was Western
 * Australian, which is the one thing a locality-first source policy must not be
 * told incorrectly. The owner sets jurisdiction through the documents bulk
 * metadata route, which resolves it against the authority register.
 */
describe("upload metadata jurisdiction", () => {
  const route = readFileSync("src/app/api/upload/route.ts", "utf8");

  it("does not assert a jurisdiction the upload cannot establish", () => {
    expect(route).not.toContain('jurisdiction: "Australia/WA"');
    expect(route).toMatch(/jurisdiction: null/);
  });

  it("leaves the other unestablished fields null too, as it already did", () => {
    for (const field of ["publisher", "publisher_code", "version", "publication_date", "review_date"]) {
      expect(route).toContain(`${field}: null`);
    }
  });

  /**
   * The reason this change is safe to make without a retrieval evaluation: the
   * default never reached authority classification. A fresh upload has no
   * publisher, so `unrecognized_authority` decides the outcome and the
   * jurisdiction value changes nothing. If this test ever fails, the default has
   * become load-bearing and removing it IS a retrieval change.
   */
  it("classifies an uploaded document identically with and without the default", () => {
    const base = {
      source_title: "Uploaded document",
      publisher_code: null,
      publisher: null,
      version: null,
      publication_date: null,
      review_date: null,
      document_status: "unknown",
      clinical_validation_status: "unverified",
      extraction_quality: "unknown",
      source_kind: "document",
    };
    const withDefault = classifySourceAuthority({ ...base, jurisdiction: "Australia/WA" } as never);
    const withoutDefault = classifySourceAuthority({ ...base, jurisdiction: null } as never);

    expect(withoutDefault.tier).toBe(withDefault.tier);
    expect(withoutDefault.designation).toBe(withDefault.designation);
    expect(withoutDefault.australianAugmentationEligible).toBe(withDefault.australianAugmentationEligible);
    expect(withoutDefault.reasonCodes).toEqual(withDefault.reasonCodes);
    expect(withoutDefault.eligibilityReasons).toEqual(withDefault.eligibilityReasons);
    expect(withoutDefault.australianAugmentationEligible).toBe(false);
  });
});
