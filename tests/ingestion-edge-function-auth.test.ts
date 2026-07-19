import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { hasServiceRoleAuthorization } from "../supabase/functions/ingestion-worker/auth";

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
  });
});
