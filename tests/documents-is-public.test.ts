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

  it("identifies documents with owner_id === null as public", () => {
    expect(isPublicDocument({ owner_id: null })).toBe(true);
    expect(isPublicDocumentRow({ id: "doc-1", owner_id: null, title: "Public Guideline" })).toBe(true);
    expect(isPublicDocument({ id: "doc-2", owner_id: "user-123", title: "Private Note" })).toBe(false);
  });

  it("identifies explicit public metadata markers", () => {
    expect(isPublicDocument({ public_corpus: true })).toBe(true);
    expect(isPublicDocument({ is_public: true })).toBe(true);
    expect(isPublicDocument({ public: true })).toBe(true);
    expect(isPublicDocument({ visibility: "public" })).toBe(true);
    expect(isPublicDocument({ metadata: { public_corpus: true } })).toBe(true);
    expect(isPublicDocument({ metadata: { is_public: true } })).toBe(true);
    expect(isPublicDocument({ metadata: { visibility: "public" } })).toBe(true);
  });

  it("identifies registry records as public", () => {
    expect(isPublicDocument({ source_kind: "registry_record" })).toBe(true);
    expect(isPublicDocument({ registry_record_kind: "service" })).toBe(true);
    expect(isPublicDocument({ metadata: { source_kind: "registry_record" } })).toBe(true);
  });

  it("honours explicit private flags over default null owner", () => {
    expect(isPublicDocument({ owner_id: null, private: true })).toBe(false);
    expect(isPublicDocument({ owner_id: null, is_private: true })).toBe(false);
    expect(isPublicDocument({ owner_id: null, visibility: "private" })).toBe(false);
    expect(isPublicDocument({ metadata: { private: true } })).toBe(false);
    expect(isPublicDocument({ metadata: { is_private: true } })).toBe(false);
    expect(isPublicDocument({ metadata: { visibility: "private" } })).toBe(false);
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
