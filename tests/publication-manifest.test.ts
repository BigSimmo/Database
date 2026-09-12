import { describe, expect, it } from "vitest";
import {
  assertAustralianPublicActivationMetadata,
  assertPublicationApplyConfirmation,
  parsePublicationCommandArgs,
  parsePublicationManifest,
  parsePublicationManifestV2,
  publicationManifestDigest,
  publicationManifestV2ExpectedStateDigest,
} from "@/lib/publication-manifest";

const manifest = {
  version: 1,
  approvingOperatorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  reason: "Reviewed for public corpus publication.",
  evidenceReferences: ["ticket:CLIN-42"],
  documents: [
    {
      documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      expectedOwnerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      expectedStateDigest: "d".repeat(64),
      decision: "approved",
    },
  ],
};

const manifestV2 = {
  version: 2,
  sourcePolicyVersion: "australian-source-policy-v1",
  approvingOperatorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  reason: "Reviewed against the governed Australian source policy.",
  evidenceReferences: ["ticket:CLIN-84"],
  documents: [
    {
      documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      expectedOwnerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      expectedStateDigest: "d".repeat(64),
      expectedIndexGenerationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      sourceCatalogueKey: "wa-health",
      decision: "approved",
    },
  ],
};

const australianActivationMetadata = {
  source_kind: "document",
  publisher: "WA Health",
  publisher_code: "WAHEALTH",
  jurisdiction: "Australia/WA",
  corpus_scope: "australian_public",
  source_role: "service_policy",
  content_mode: "indexed_content",
  source_catalogue_key: "wa-health",
  source_policy_version: "australian-source-policy-v1",
  licence_policy: "public_index_permitted",
  document_status: "current",
  clinical_validation_status: "approved",
  extraction_quality: "good",
  change_state: "unchanged",
};

describe("publication manifests", () => {
  it("requires an explicit manifest and defaults to dry-run", () => {
    expect(parsePublicationCommandArgs(["--manifest", "publication.json"])).toEqual({
      manifestPath: "publication.json",
      apply: false,
      expectedCount: undefined,
      confirmSha256: undefined,
    });
    expect(() => parsePublicationCommandArgs([])).toThrow(/--manifest/);
  });

  it("requires count and SHA confirmation before apply", () => {
    expect(() => parsePublicationCommandArgs(["--manifest", "publication.json", "--apply"])).toThrow(
      /--expected-count/,
    );
    const raw = JSON.stringify(manifest);
    const digest = publicationManifestDigest(raw);
    const parsed = parsePublicationManifest(raw);
    expect(() =>
      assertPublicationApplyConfirmation({
        manifest: parsed,
        digest,
        expectedCount: 2,
        confirmSha256: digest,
      }),
    ).toThrow(/count/);
    expect(() =>
      assertPublicationApplyConfirmation({
        manifest: parsed,
        digest,
        expectedCount: 1,
        confirmSha256: "0".repeat(64),
      }),
    ).toThrow(/SHA-256/);
  });

  it("rejects missing evidence, duplicate documents, and accepts each explicit decision", () => {
    expect(() => parsePublicationManifest(JSON.stringify({ ...manifest, evidenceReferences: [] }))).toThrow();
    expect(() =>
      parsePublicationManifest(
        JSON.stringify({ ...manifest, documents: [manifest.documents[0], manifest.documents[0]] }),
      ),
    ).toThrow(/unique/);
    for (const decision of ["approved", "keep_private", "quarantine"] as const) {
      expect(
        parsePublicationManifest(JSON.stringify({ ...manifest, documents: [{ ...manifest.documents[0], decision }] }))
          .documents[0].decision,
      ).toBe(decision);
    }
  });

  it("requires a canonical reviewed-state digest for every decision", () => {
    const withoutDigest = {
      documentId: manifest.documents[0].documentId,
      expectedOwnerId: manifest.documents[0].expectedOwnerId,
      decision: manifest.documents[0].decision,
    };
    expect(() => parsePublicationManifest(JSON.stringify({ ...manifest, documents: [withoutDigest] }))).toThrow(
      /expectedStateDigest/,
    );
    expect(() =>
      parsePublicationManifest(
        JSON.stringify({ ...manifest, documents: [{ ...manifest.documents[0], expectedStateDigest: "ABC" }] }),
      ),
    ).toThrow(/expectedStateDigest/);
  });

  it("parses a governed Australian manifest v2 without changing v1 parsing", () => {
    expect(parsePublicationManifestV2(manifestV2)).toEqual(manifestV2);
    expect(parsePublicationManifest(JSON.stringify(manifest)).version).toBe(1);
  });

  it("binds the v2 batch confirmation digest to every reviewed document state independent of row order", () => {
    const secondDocument = {
      ...manifestV2.documents[0],
      documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      expectedStateDigest: "e".repeat(64),
      expectedIndexGenerationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    };
    const forward = parsePublicationManifestV2({
      ...manifestV2,
      documents: [manifestV2.documents[0], secondDocument],
    });
    const reverse = parsePublicationManifestV2({ ...manifestV2, documents: [...forward.documents].reverse() });
    expect(publicationManifestV2ExpectedStateDigest(forward)).toBe(publicationManifestV2ExpectedStateDigest(reverse));
    expect(
      publicationManifestV2ExpectedStateDigest({
        ...forward,
        documents: [{ ...forward.documents[0], expectedStateDigest: "f".repeat(64) }, forward.documents[1]],
      }),
    ).not.toBe(publicationManifestV2ExpectedStateDigest(forward));
  });

  it("requires the exact Australian source policy, generation, digest, and unique documents", () => {
    expect(() =>
      parsePublicationManifestV2({ ...manifestV2, sourcePolicyVersion: "australian-source-policy-v0" }),
    ).toThrow(/sourcePolicyVersion/);
    expect(() =>
      parsePublicationManifestV2({
        ...manifestV2,
        documents: [{ ...manifestV2.documents[0], expectedIndexGenerationId: undefined }],
      }),
    ).toThrow(/expectedIndexGenerationId/);
    expect(() =>
      parsePublicationManifestV2({
        ...manifestV2,
        documents: [{ ...manifestV2.documents[0], expectedStateDigest: "ABC" }],
      }),
    ).toThrow(/expectedStateDigest/);
    expect(() =>
      parsePublicationManifestV2({
        ...manifestV2,
        documents: [manifestV2.documents[0], manifestV2.documents[0]],
      }),
    ).toThrow(/unique/);
    expect(() => parsePublicationManifestV2({ ...manifestV2, evidenceReferences: ["x".repeat(501)] })).toThrow(
      /evidenceReferences/,
    );
  });

  it.each(["missing-source", "etg-complete", "australian-medicines-handbook", "nps-medicinewise"])(
    "rejects approval for non-activatable catalogue source %s",
    (sourceCatalogueKey) => {
      expect(() =>
        parsePublicationManifestV2({
          ...manifestV2,
          documents: [{ ...manifestV2.documents[0], sourceCatalogueKey }],
        }),
      ).toThrow(/sourceCatalogueKey/);
    },
  );

  it("preserves non-activation decisions for recognised non-indexed catalogue sources", () => {
    for (const sourceCatalogueKey of ["etg-complete", "australian-medicines-handbook", "nps-medicinewise"]) {
      expect(
        parsePublicationManifestV2({
          ...manifestV2,
          documents: [{ ...manifestV2.documents[0], sourceCatalogueKey, decision: "quarantine" }],
        }).documents[0].decision,
      ).toBe("quarantine");
    }
  });

  it("accepts exact normalized catalogue identity and role metadata for activation", () => {
    expect(assertAustralianPublicActivationMetadata(australianActivationMetadata, "wa-health")).toMatchObject({
      source_kind: "document",
      source_catalogue_key: "wa-health",
      publisher_code: "WAHEALTH",
      source_role: "service_policy",
      change_state: "unchanged",
    });
  });

  it.each([
    ["registry record", { source_kind: "registry_record" }, "wa-health"],
    ["publisher mismatch", { publisher: "Therapeutic Goods Administration" }, "wa-health"],
    ["jurisdiction mismatch", { jurisdiction: "Australia/NSW" }, "wa-health"],
    [
      "catalogue role mismatch",
      {
        source_catalogue_key: "wa-legislation",
        publisher: "Western Australian Legislation",
        publisher_code: "WALEG",
        source_role: "clinical_guideline",
      },
      "wa-legislation",
    ],
    ["non-canonical new change state", { change_state: "new" }, "wa-health"],
  ])("rejects %s metadata before publication approval insertion", (_label, overrides, expectedCatalogueKey) => {
    expect(() =>
      assertAustralianPublicActivationMetadata({ ...australianActivationMetadata, ...overrides }, expectedCatalogueKey),
    ).toThrow(/activation metadata/i);
  });
});
