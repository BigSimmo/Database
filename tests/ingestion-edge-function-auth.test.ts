import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { hasServiceRoleAuthorization } from "../supabase/functions/ingestion-worker/auth";
import {
  INGESTION_WORKER_RETIRED,
  retiredIngestionWorkerResponse,
} from "../supabase/functions/ingestion-worker/retirement";
import { sourceFrom } from "./helpers/source-contract";

const root = process.cwd();
const source = readFileSync(join(root, "supabase/functions/ingestion-worker/index.ts"), "utf8");
const config = readFileSync(join(root, "supabase/config.toml"), "utf8");

function tokenForRole(role: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.signature`;
}

describe("ingestion-worker Edge Function authorization", () => {
  it("accepts only a gateway-verified service-role JWT", () => {
    expect(hasServiceRoleAuthorization(`Bearer ${tokenForRole("service_role")}`)).toBe(true);
    expect(hasServiceRoleAuthorization(`Bearer ${tokenForRole("authenticated")}`)).toBe(false);
    expect(hasServiceRoleAuthorization(`Bearer ${tokenForRole("anon")}`)).toBe(false);
    expect(hasServiceRoleAuthorization("Bearer malformed")).toBe(false);
    expect(hasServiceRoleAuthorization(null)).toBe(false);
  });

  it("keeps gateway verification enabled and rejects state-changing GET requests", () => {
    expect(config).toContain("[functions.ingestion-worker]\nverify_jwt = true");
    expect(source).toContain('if (req.method !== "POST")');
    expect(source).toContain('hasServiceRoleAuthorization(req.headers.get("authorization"))');
    expect(source.indexOf("hasServiceRoleAuthorization")).toBeLessThan(source.indexOf("public.claim_ingestion_jobs"));
    expect(source).toContain("complete_ingestion_job(");
    expect(source).toContain("fail_or_retry_ingestion_job(");
    expect(source).toContain("${workerId}");
    expect(source).toContain('reason === "lease_lost"');
    expect(source).toContain("lease_lost:");
    expect(source).toContain("sql.begin");
    expect(source).toContain("complete_ingestion_job did not confirm success");
  });
});

describe("ingestion-worker Edge Function retirement guard (L24)", () => {
  it("refuses every request with 410 before it can claim a job", async () => {
    expect(INGESTION_WORKER_RETIRED).toBe(true);

    const response = retiredIngestionWorkerResponse();
    expect(response.status).toBe(410);
    const body = (await response.json()) as { ok?: boolean; error?: string; code?: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe("ingestion_worker_retired");
    expect(body.error).toMatch(/container worker/i);
  });

  it("cannot stamp a never-extracted document as indexed, because the guard runs first", () => {
    // This function performs no extraction: it reads existing chunks, builds a
    // heuristic summary, and embeds with a 384-dimension model that cannot be
    // inserted into vector(1536). Every claimed job therefore lands in the catch,
    // where fail_or_retry_ingestion_job is called with a hardcoded "indexed"
    // document status. The only safe place for the guard is ahead of the claim,
    // so the ordering is asserted inside the request handler itself.
    const handler = sourceFrom(source, "Deno.serve(async (req: Request) => {", {
      label: "ingestion-worker request handler",
    });
    expect(handler).toContain("INGESTION_WORKER_RETIRED");

    const guardIndex = handler.indexOf("return retiredIngestionWorkerResponse();");
    expect(guardIndex).toBeGreaterThan(-1);
    for (const queueTouch of ["public.claim_ingestion_jobs", "processJob(job, workerId)", "failOrRetryIngestionJob("]) {
      const touchIndex = handler.indexOf(queueTouch);
      expect(touchIndex).toBeGreaterThan(-1);
      expect(guardIndex).toBeLessThan(touchIndex);
    }

    // The hardcoded `indexed` status is still in the file (removing it is a
    // migration-shaped change this package does not ship), so the guard is the
    // only thing standing between a claimed job and that stamp.
    expect(source).toContain("fail_or_retry_ingestion_job(");
  });
});
