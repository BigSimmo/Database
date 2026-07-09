import { describe, expect, it } from "vitest";

import { isExpectedR17IndexDef, normalizeIndexDef } from "../scripts/check-july8-live-batch";

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

  it("rejects a same-named index on the wrong columns", () => {
    const definition =
      "CREATE UNIQUE INDEX ingestion_jobs_one_open_per_document_uidx ON public.ingestion_jobs (batch_id)";
    expect(isExpectedR17IndexDef(definition)).toBe(false);
  });
});
