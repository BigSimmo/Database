import { describe, expect, it } from "vitest";
import {
  assertPublicationApplyConfirmation,
  parsePublicationCommandArgs,
  parsePublicationManifest,
  publicationManifestDigest,
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
});
