import { describe, expect, it } from "vitest";

import { isRegistryProjectionDocument } from "../scripts/classify-documents";

describe("classify-documents registry guard", () => {
  it.each([
    { file_name: "service.registry.json", source_path: null, metadata: {} },
    { file_name: "service.json", source_path: "registry://service/example", metadata: {} },
    { file_name: "service.json", source_path: null, metadata: { source_kind: "registry_record" } },
  ])("keeps registry projections out of the generic classifier", (document) => {
    expect(isRegistryProjectionDocument(document)).toBe(true);
  });

  it("continues to classify physical documents", () => {
    expect(
      isRegistryProjectionDocument({
        file_name: "clinical-guideline.pdf",
        source_path: "clinical-guideline.pdf",
        metadata: { source_kind: "uploaded_document" },
      }),
    ).toBe(false);
  });
});
