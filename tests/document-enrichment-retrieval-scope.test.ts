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

  it("does not fan out to legacy or table fallbacks after caller cancellation", async () => {
    const controller = new AbortController();
    const reason = new DOMException("metadata lookup cancelled", "AbortError");
    const abortSignal = vi.fn(async (signal: AbortSignal) => {
      controller.abort(reason);
      return { data: null, error: { code: "PGRST202", message: "missing versioned RPC" }, signal };
    });
    const rpc = vi.fn(() => ({ abortSignal }));
    const from = vi.fn();

    await expect(
      fetchRelatedDocumentMetadata({
        supabase: { rpc, from } as never,
        accessScope: { includePublic: true },
        documentIds: ["public-doc"],
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);
    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it("preserves the caller abort reason when a direct-table fallback resolves an abort error envelope", async () => {
    const controller = new AbortController();
    const reason = new DOMException("fallback metadata lookup cancelled", "AbortError");
    const envelopeError = { code: "PGRST000", message: "request aborted" };
    const rpc = vi.fn(async () => ({ data: null, error: { code: "42501", message: "permission denied" } }));
    const from = vi.fn((table: string) => {
      const query = {
        select: () => query,
        in: () => query,
        is: () => query,
        abortSignal: vi.fn(async () => {
          if (table === "document_labels") controller.abort(reason);
          return { data: null, error: envelopeError };
        }),
      };
      return query;
    });

    await expect(
      fetchRelatedDocumentMetadata({
        supabase: { rpc, from } as never,
        accessScope: { includePublic: true },
        documentIds: ["public-doc"],
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);
    expect(from).toHaveBeenCalledTimes(2);
  });

  it.each(["document_labels", "document_summaries"])("propagates %s fallback query errors", async (failedTable) => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "42501", message: "permission denied" } }));
    const fallbackError = Object.assign(new Error(`${failedTable} fallback failed`), { code: "PGRST000" });
    const from = vi.fn((table: string) => {
      const result = table === failedTable ? { data: null, error: fallbackError } : { data: [], error: null };
      const query = {
        select: () => query,
        in: () => query,
        is: () => query,
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    });

    await expect(
      fetchRelatedDocumentMetadata({
        supabase: { rpc, from } as never,
        accessScope: { includePublic: true },
        documentIds: ["public-doc"],
      }),
    ).rejects.toBe(fallbackError);
  });
});
