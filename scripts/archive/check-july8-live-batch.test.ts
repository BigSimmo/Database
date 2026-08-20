import { describe, expect, it } from "vitest";

import {
  isExpectedR17IndexDef,
  isR17IndexUniqueViolation,
  normalizeIndexDef,
  R17_PROBE_STAGE,
} from "./check-july8-live-batch";

describe("check-july8-live-batch R17 index definition probe", () => {
  it("accepts the canonical partial unique index definition", () => {
    const definition = `
      CREATE UNIQUE INDEX ingestion_jobs_one_open_per_document_uidx
      ON public.ingestion_jobs (document_id)
      WHERE status IN ('pending', 'processing')
    `;
    expect(isExpectedR17IndexDef(definition)).toBe(true);
    expect(normalizeIndexDef(definition)).toContain("create unique index");
  });

  it("accepts the ANY(ARRAY) partial unique index definition format", () => {
    const definition = `
      CREATE UNIQUE INDEX ingestion_jobs_one_open_per_document_uidx
      ON public.ingestion_jobs (document_id)
      WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]))
    `;
    expect(isExpectedR17IndexDef(definition)).toBe(true);
  });

  it("rejects a same-named index on the wrong columns", () => {
    const definition =
      "CREATE UNIQUE INDEX ingestion_jobs_one_open_per_document_uidx ON public.ingestion_jobs (batch_id)";
    expect(isExpectedR17IndexDef(definition)).toBe(false);
  });

  it("rejects broader predicates that include failed jobs", () => {
    const definition =
      "CREATE UNIQUE INDEX ingestion_jobs_one_open_per_document_uidx ON public.ingestion_jobs (document_id) WHERE status IN ('pending', 'processing', 'failed')";
    expect(isExpectedR17IndexDef(definition)).toBe(false);
  });

  it("rejects predicates that only include pending", () => {
    const definition =
      "CREATE UNIQUE INDEX ingestion_jobs_one_open_per_document_uidx ON public.ingestion_jobs (document_id) WHERE status IN ('pending')";
    expect(isExpectedR17IndexDef(definition)).toBe(false);
  });
});

describe("isR17IndexUniqueViolation", () => {
  it("accepts unique violations that cite the R17 index", () => {
    expect(
      isR17IndexUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "ingestion_jobs_one_open_per_document_uidx"',
      }),
    ).toBe(true);
  });

  it("rejects unique violations from other constraints (e.g. primary key)", () => {
    expect(
      isR17IndexUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "ingestion_jobs_pkey"',
      }),
    ).toBe(false);
  });
});

describe("R17 probe row tagging", () => {
  it("uses a dedicated stage marker for mark-and-sweep cleanup", () => {
    expect(R17_PROBE_STAGE).toBe("july8-live-batch-probe");
  });
});
