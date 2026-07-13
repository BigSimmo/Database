import { describe, expect, it, vi } from "vitest";
import { fetchRelatedDocumentMetadata } from "../src/lib/document-enrichment";

describe("related-document metadata RPC rollout", () => {
  it.each(["42883", "PGRST202"])("merges owner and public legacy rows for missing code %s", async (missingCode) => {
    const rpc = vi.fn(async (name: string, args: { owner_filter?: string }) => {
      if (name === "get_related_document_metadata_v2") {
        return { data: null, error: { code: missingCode, message: "missing versioned RPC" } };
      }
      return args.owner_filter === "owner-a"
        ? { data: [{ document_id: "owner-doc", labels: [], summary: "Owner" }], error: null }
        : { data: [{ document_id: "public-doc", labels: [], summary: "Public" }], error: null };
    });
    const rows = await fetchRelatedDocumentMetadata({
      supabase: { rpc } as never,
      ownerId: "owner-a",
      accessScope: { ownerId: "owner-a", includePublic: true },
      documentIds: ["owner-doc", "public-doc"],
    });
    expect(rows.map((row) => row.document_id).sort()).toEqual(["owner-doc", "public-doc"]);
  });

  it("does not fallback for permission errors", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "42501", message: "permission denied" } }));
    const emptyQuery = {
      select: () => emptyQuery,
      in: () => emptyQuery,
      is: () => emptyQuery,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    await fetchRelatedDocumentMetadata({
      supabase: { rpc, from: vi.fn(() => emptyQuery) } as never,
      accessScope: { includePublic: true },
      documentIds: ["public-doc"],
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
