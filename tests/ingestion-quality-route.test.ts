import { afterEach, describe, expect, it, vi } from "vitest";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const documentId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";

function chainResult(data: unknown[] | null, error: { message: string } | null = null) {
  const result = { data, error };
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function clientWithTables(tables: Record<string, unknown[]>) {
  return {
    from: vi.fn((table: string) => chainResult(tables[table] ?? [])),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("/api/ingestion/quality", () => {
  it("classifies failed jobs and extraction issues into review items", async () => {
    const client = clientWithTables({
      documents: [
        {
          id: documentId,
          title: "Clozapine guideline",
          file_name: "clozapine.pdf",
          status: "indexed",
          page_count: 3,
          chunk_count: 1,
          image_count: 2,
          error_message: null,
          metadata: {
            extraction_quality: "partial",
            clinical_validation_status: "unverified",
            document_status: "current",
          },
          updated_at: "2026-06-25T00:00:00.000Z",
        },
      ],
      document_index_quality: [
        {
          document_id: documentId,
          quality_score: 0.42,
          extraction_quality: "poor",
          metrics: { average_page_text_chars: 20, table_extraction_coverage: 0 },
          issues: ["low extracted text volume", "low table row extraction coverage"],
          updated_at: "2026-06-25T00:01:00.000Z",
        },
      ],
      ingestion_jobs: [
        {
          id: jobId,
          document_id: documentId,
          status: "failed",
          stage: "ocr",
          error_message: "OCR failed on page 2.",
          updated_at: "2026-06-25T00:02:00.000Z",
        },
      ],
      ingestion_job_stages: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          document_id: documentId,
          job_id: jobId,
          stage_name: "ocr",
          stage_status: "failed",
          error_message: "OCR failed on page 2.",
          metadata: {},
          artifact_counts: {},
          started_at: "2026-06-25T00:02:00.000Z",
          finished_at: "2026-06-25T00:03:00.000Z",
        },
      ],
      document_pages: [
        { document_id: documentId, page_number: 2, text: "", ocr_used: false, metadata: { needsOcr: true } },
      ],
      document_images: [
        { document_id: documentId, page_number: 2, source_kind: "table_crop", searchable: true, metadata: {} },
      ],
    });
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    }));
    const { GET } = await import("../src/app/api/ingestion/quality/route");

    const response = await GET(new Request("http://localhost/api/ingestion/quality"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items.map((item: { type: string }) => item.type)).toEqual(
      expect.arrayContaining([
        "failed_job",
        "failed_ocr",
        "image_only_pages",
        "missing_tables",
        "low_extraction_confidence",
        "manual_review",
      ]),
    );
    expect(payload.items[0]).toMatchObject({
      type: "failed_job",
      documentId,
      jobId,
      severity: "danger",
    });
    expect(client.from).toHaveBeenCalledWith("documents");
    expect(client.from).toHaveBeenCalledWith("document_index_quality");
  });

  it("returns an empty demo payload without querying Supabase", async () => {
    const client = clientWithTables({});
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => true }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    }));
    const { GET } = await import("../src/app/api/ingestion/quality/route");

    const response = await GET(new Request("http://localhost/api/ingestion/quality"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ items: [], demoMode: true });
    expect(client.from).not.toHaveBeenCalled();
  });
});
