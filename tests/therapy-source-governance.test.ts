import { describe, expect, it } from "vitest";

import { therapySourceMetadata } from "@/lib/therapy-source-governance";

describe("therapy source governance", () => {
  const source = { title: "Example guideline", sourceType: "Guideline", reference: "Ref 12" };

  it("keeps imported source currency, designation and extraction quality unknown", () => {
    expect(therapySourceMetadata(source, "needs_review")).toMatchObject({
      source_title: "Example guideline",
      registry_record_subkind: null,
      publisher: null,
      document_status: "unknown",
      clinical_validation_status: "unverified",
      extraction_quality: "unknown",
    });
  });

  it("only maps an explicitly reviewed record to local review", () => {
    expect(therapySourceMetadata(source, "reviewed").clinical_validation_status).toBe("locally_reviewed");
  });
});
