import { beforeEach, describe, expect, it, vi } from "vitest";

const documentId = "11111111-1111-4111-8111-111111111111";
const selectedCoverId = "22222222-2222-4222-8222-222222222222";
const stagedCoverId = "33333333-3333-4333-8333-333333333333";
const committedCoverId = "66666666-6666-4666-8666-666666666666";
const committedGeneration = "44444444-4444-4444-8444-444444444444";
const stagedGeneration = "55555555-5555-4555-8555-555555555555";

type QueryCall = {
  table: string;
  selected?: string;
  limit?: number;
  filters: Array<{ column: string; value: unknown }>;
};
type QueryResult = { data: unknown; error: { message: string } | null };
type QueryResolver = (call: QueryCall) => QueryResult;

class QueryBuilder {
  constructor(
    private readonly call: QueryCall,
    private readonly resolve: QueryResolver,
  ) {}

  select(selected: string) {
    this.call.selected = selected;
    return this;
  }

  eq(column: string, value: unknown) {
    this.call.filters.push({ column, value });
    return this;
  }

  abortSignal(signal: AbortSignal) {
    void signal;
    return this;
  }

  limit(value: number) {
    this.call.limit = value;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve(this.call)).then(onfulfilled, onrejected);
  }

  maybeSingle() {
    return Promise.resolve(this.resolve(this.call));
  }
}

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  isDemoMode: vi.fn(),
  rateLimit: vi.fn(),
  withOwnerReadScope: vi.fn(),
  fetchDocumentCoverImageIds: vi.fn(),
}));

vi.mock("@/lib/api-rate-limit", () => ({
  rateLimitJsonResponse: () => Response.json({ error: "limited" }, { status: 429 }),
}));
vi.mock("@/lib/demo-data", () => ({ demoImages: [] }));
vi.mock("@/lib/document-enrichment", () => ({ fetchDocumentCoverImageIds: mocks.fetchDocumentCoverImageIds }));
vi.mock("@/lib/env", () => ({ isDemoMode: mocks.isDemoMode }));
vi.mock("@/lib/http", () => ({
  jsonError: () => Response.json({ error: "internal" }, { status: 500 }),
  PublicApiError: class PublicApiError extends Error {},
  publicErrorResponse: (error: string, status: number) => Response.json({ error }, { status }),
}));
vi.mock("@/lib/public-api-access", () => ({
  enforceDocumentReadRateLimit: mocks.rateLimit,
  withOwnerReadScope: mocks.withOwnerReadScope,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  unauthorizedResponse: () => Response.json({ error: "unauthorized" }, { status: 401 }),
}));

import { GET } from "@/app/api/documents/[id]/cover/route";

function request() {
  return new Request(`http://localhost/api/documents/${documentId}/cover`);
}

function routeParams() {
  return { params: Promise.resolve({ id: documentId }) };
}

function setRouteData(resolve: QueryResolver) {
  const calls: QueryCall[] = [];
  mocks.createAdminClient.mockReturnValue({
    from: vi.fn((table: string) => {
      const call: QueryCall = { table, filters: [] };
      calls.push(call);
      return new QueryBuilder(call, resolve);
    }),
  });
  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isDemoMode.mockReturnValue(false);
  mocks.rateLimit.mockResolvedValue({
    access: { ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    rateLimit: { limited: false },
  });
  mocks.withOwnerReadScope.mockImplementation((query: unknown) => query);
  mocks.fetchDocumentCoverImageIds.mockResolvedValue(new Map([[documentId, stagedCoverId]]));
});

describe("GET /api/documents/[id]/cover", () => {
  it("selects the committed cover from legacy candidates instead of handing off a stale row", async () => {
    const calls = setRouteData((call) => {
      if (call.table === "documents") {
        return {
          data: { id: documentId, metadata: { index_generation_id: committedGeneration } },
          error: null,
        };
      }
      if (call.table === "document_images") {
        return {
          data: [
            {
              id: stagedCoverId,
              document_id: documentId,
              source_kind: "cover_page",
              metadata: { index_generation_id: stagedGeneration },
            },
            {
              id: committedCoverId,
              document_id: documentId,
              source_kind: "cover_page",
              metadata: { index_generation_id: committedGeneration },
            },
            {
              id: selectedCoverId,
              document_id: "99999999-9999-4999-8999-999999999999",
              source_kind: "cover_page",
              metadata: { index_generation_id: committedGeneration },
            },
            {
              id: "77777777-7777-4777-8777-777777777777",
              document_id: documentId,
              source_kind: "figure",
              metadata: { index_generation_id: committedGeneration },
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const response = await GET(request(), routeParams());

    await expect(response.json()).resolves.toEqual({ coverImageId: committedCoverId });
    expect(calls.find((call) => call.table === "document_images")).toMatchObject({
      selected: "id,document_id,source_kind,metadata",
      limit: 65,
      filters: expect.arrayContaining([
        { column: "document_id", value: documentId },
        { column: "source_kind", value: "cover_page" },
      ]),
    });
    expect(mocks.fetchDocumentCoverImageIds).not.toHaveBeenCalled();
  });

  it("returns null for a legacy document when no committed cover candidate exists", async () => {
    setRouteData((call) => {
      if (call.table === "documents") {
        return {
          data: { id: documentId, metadata: { index_generation_id: committedGeneration } },
          error: null,
        };
      }
      if (call.table === "document_images") {
        return {
          data: [
            {
              id: stagedCoverId,
              document_id: documentId,
              source_kind: "cover_page",
              metadata: { index_generation_id: stagedGeneration },
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const response = await GET(request(), routeParams());

    await expect(response.json()).resolves.toEqual({ coverImageId: null });
  });

  it("fails closed when the bounded legacy query returns its 65-row overflow sentinel", async () => {
    setRouteData((call) => {
      if (call.table === "documents") {
        return {
          data: { id: documentId, metadata: { index_generation_id: committedGeneration } },
          error: null,
        };
      }
      if (call.table === "document_images") {
        return {
          data: Array.from({ length: 65 }, (_, index) => ({
            id: `88888888-8888-4888-8888-${index.toString(16).padStart(12, "0")}`,
            document_id: documentId,
            source_kind: "cover_page",
            metadata: { index_generation_id: committedGeneration },
          })),
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const response = await GET(request(), routeParams());

    await expect(response.json()).resolves.toEqual({ coverImageId: null });
    expect(mocks.fetchDocumentCoverImageIds).not.toHaveBeenCalled();
  });

  it("fails closed when two legacy candidates belong to the committed generation", async () => {
    setRouteData((call) => {
      if (call.table === "documents") {
        return {
          data: { id: documentId, metadata: { index_generation_id: committedGeneration } },
          error: null,
        };
      }
      if (call.table === "document_images") {
        return {
          data: [
            {
              id: committedCoverId,
              document_id: documentId,
              source_kind: "cover_page",
              metadata: { index_generation_id: committedGeneration },
            },
            {
              id: selectedCoverId,
              document_id: documentId,
              source_kind: "cover_page",
              metadata: { index_generation_id: committedGeneration },
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const response = await GET(request(), routeParams());

    await expect(response.json()).resolves.toEqual({ coverImageId: null });
    expect(mocks.fetchDocumentCoverImageIds).not.toHaveBeenCalled();
  });

  it("returns only the selected cover after validating its document, kind, and committed generation", async () => {
    const calls = setRouteData((call) => {
      if (call.table === "documents") {
        return {
          data: {
            id: documentId,
            metadata: { index_generation_id: committedGeneration, cover_image_id: selectedCoverId },
          },
          error: null,
        };
      }
      if (call.table === "document_images") {
        return { data: { id: selectedCoverId, metadata: { index_generation_id: committedGeneration } }, error: null };
      }
      return { data: null, error: null };
    });

    const response = await GET(request(), routeParams());

    await expect(response.json()).resolves.toEqual({ coverImageId: selectedCoverId });
    expect(calls.find((call) => call.table === "document_images")).toMatchObject({
      selected: "id,metadata",
      filters: expect.arrayContaining([
        { column: "id", value: selectedCoverId },
        { column: "document_id", value: documentId },
        { column: "source_kind", value: "cover_page" },
      ]),
    });
    expect(mocks.fetchDocumentCoverImageIds).not.toHaveBeenCalled();
  });

  it("fails closed when the selected pointer is no longer committed", async () => {
    setRouteData((call) => {
      if (call.table === "documents") {
        return {
          data: {
            id: documentId,
            metadata: { index_generation_id: committedGeneration, cover_image_id: selectedCoverId },
          },
          error: null,
        };
      }
      if (call.table === "document_images") {
        return { data: { id: selectedCoverId, metadata: { index_generation_id: stagedGeneration } }, error: null };
      }
      return { data: null, error: null };
    });

    const response = await GET(request(), routeParams());

    await expect(response.json()).resolves.toEqual({ coverImageId: null });
    expect(mocks.fetchDocumentCoverImageIds).not.toHaveBeenCalled();
  });
});
