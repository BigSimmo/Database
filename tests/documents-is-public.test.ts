import { describe, expect, it } from "vitest";
import { isPublicDocument, isPublicDocumentRow } from "@/lib/documents";

describe("isPublicDocument helper", () => {
  it("handles null, undefined, and non-object inputs safely", () => {
    expect(isPublicDocument(null)).toBe(false);
    expect(isPublicDocument(undefined)).toBe(false);
    expect(isPublicDocument("invalid" as unknown as Record<string, unknown>)).toBe(false);
    expect(isPublicDocument(42 as unknown as Record<string, unknown>)).toBe(false);
    expect(isPublicDocument({})).toBe(false);
  });

  it("requires a null owner and the publication marker together", () => {
    expect(isPublicDocument({ owner_id: null, metadata: { public_corpus: true } })).toBe(true);
    expect(isPublicDocument({ owner_id: null, public_corpus: true })).toBe(true);
    expect(isPublicDocumentRow({ id: "doc-1", owner_id: null, metadata: { public_corpus: true } })).toBe(true);
    expect(isPublicDocument({ id: "doc-2", owner_id: "user-123", metadata: { public_corpus: true } })).toBe(false);
  });

  it("does not treat an orphaned null owner as public", () => {
    expect(isPublicDocument({ owner_id: null })).toBe(false);
    expect(isPublicDocumentRow({ id: "doc-1", owner_id: null, title: "Orphaned after user delete" })).toBe(false);
  });

  it("does not grant public access from legacy metadata aliases", () => {
    expect(isPublicDocument({ public_corpus: true })).toBe(false);
    expect(isPublicDocument({ is_public: true })).toBe(false);
    expect(isPublicDocument({ public: true })).toBe(false);
    expect(isPublicDocument({ visibility: "public" })).toBe(false);
    expect(isPublicDocument({ metadata: { public_corpus: true } })).toBe(false);
    expect(isPublicDocument({ metadata: { is_public: true } })).toBe(false);
    expect(isPublicDocument({ metadata: { visibility: "public" } })).toBe(false);
    expect(isPublicDocument({ owner_id: null, metadata: { is_public: true } })).toBe(false);
    expect(isPublicDocument({ owner_id: null, metadata: { public: true } })).toBe(false);
    expect(isPublicDocument({ owner_id: null, metadata: { visibility: "public" } })).toBe(false);
  });

  it("does not treat registry-shaped metadata as a publication", () => {
    expect(isPublicDocument({ source_kind: "registry_record" })).toBe(false);
    expect(isPublicDocument({ registry_record_kind: "service" })).toBe(false);
    expect(isPublicDocument({ metadata: { source_kind: "registry_record" } })).toBe(false);
    expect(isPublicDocument({ owner_id: null, metadata: { source_kind: "registry_record" } })).toBe(false);
  });

  it("honours explicit private flags over a published public-corpus row", () => {
    expect(isPublicDocument({ owner_id: null, private: true, public_corpus: true })).toBe(false);
    expect(isPublicDocument({ owner_id: null, is_private: true, public_corpus: true })).toBe(false);
    expect(isPublicDocument({ owner_id: null, visibility: "private", public_corpus: true })).toBe(false);
    expect(isPublicDocument({ owner_id: null, metadata: { private: true, public_corpus: true } })).toBe(false);
    expect(isPublicDocument({ owner_id: null, metadata: { is_private: true, public_corpus: true } })).toBe(false);
    expect(isPublicDocument({ owner_id: null, metadata: { visibility: "private", public_corpus: true } })).toBe(false);
  });

  it("respects owned documents without public metadata", () => {
    expect(
      isPublicDocument({
        id: "doc-3",
        owner_id: "user-abc",
        metadata: { extraction_quality: "good" },
      }),
    ).toBe(false);
  });
});
