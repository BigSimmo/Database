import { describe, expect, it } from "vitest";

import {
  assessLocalPresence,
  classifyProjectIdentity,
  FILLABLE_LOCAL_SECRETS,
  lengthBucket,
  mergeFillIntoEnvLocal,
  parseEnvFile,
  REPORT_ONLY_KEYS,
} from "../scripts/check-local-presence.mjs";

describe("check-local-presence", () => {
  it("parses env assignments without exposing values in helpers", () => {
    const parsed = parseEnvFile(
      ["# comment", 'RAG_QUERY_HASH_SECRET="abc"', "OPENAI_API_KEY=xyz", "not valid", ""].join("\n"),
    );
    expect(parsed.RAG_QUERY_HASH_SECRET).toBe("abc");
    expect(parsed.OPENAI_API_KEY).toBe("xyz");
    expect(Object.keys(parsed)).not.toContain("not");
  });

  it("buckets lengths without needing the raw secret in assertions beyond fixtures", () => {
    expect(lengthBucket("")).toBe("missing");
    expect(lengthBucket("short")).toBe("too-short(<8)");
    expect(lengthBucket("0123456789abcdef")).toBe("ok(16-31)");
    expect(lengthBucket("a".repeat(40))).toBe("ok(32-63)");
  });

  it("treats unset Supabase identity as demo-mode OK", () => {
    expect(classifyProjectIdentity({}).status).toBe("unset");
  });

  it("fails closed on stale or mismatched project identity", () => {
    expect(
      classifyProjectIdentity({
        NEXT_PUBLIC_SUPABASE_URL: "https://qjgitjyhxrwxsrydablr.supabase.co",
        SUPABASE_PROJECT_REF: "qjgitjyhxrwxsrydablr",
        SUPABASE_PROJECT_NAME: "Database",
      }).status,
    ).toBe("ambiguous");

    expect(
      classifyProjectIdentity({
        NEXT_PUBLIC_SUPABASE_URL: "https://sjrfecxgysukkwxsowpy.supabase.co",
        SUPABASE_PROJECT_REF: "sjrfecxgysukkwxsowpy",
      }).status,
    ).toBe("ambiguous");
  });

  it("accepts complete production identity", () => {
    const result = classifyProjectIdentity({
      NEXT_PUBLIC_SUPABASE_URL: "https://sjrfecxgysukkwxsowpy.supabase.co",
      SUPABASE_PROJECT_REF: "sjrfecxgysukkwxsowpy",
      SUPABASE_PROJECT_NAME: "Clinical KB Database",
    });
    expect(result.status).toBe("ready");
  });

  it("flags fillable HMAC/probe gaps and never marks provider keys fillable", () => {
    const assessment = assessLocalPresence({});
    expect(assessment.fillable.every((row) => row.status === "gap")).toBe(true);
    expect(FILLABLE_LOCAL_SECRETS.map((s) => s.name)).toEqual(
      expect.arrayContaining(["OPENAI_SAFETY_IDENTIFIER_SECRET", "RAG_QUERY_HASH_SECRET", "HEALTH_DEEP_PROBE_SECRET"]),
    );
    expect(REPORT_ONLY_KEYS).toEqual(expect.arrayContaining(["SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY"]));
    expect(assessment.reportOnly.every((row) => row.fillable === false)).toBe(true);
  });

  it("merges only missing fillable secrets and never prints them via return shape", () => {
    const existing = "RAG_PROVIDER_MODE=offline\n";
    let n = 0;
    const { text, filled } = mergeFillIntoEnvLocal(existing, FILLABLE_LOCAL_SECRETS, {
      generate: () => {
        n += 1;
        return `local-dev-secret-${n}-`.padEnd(64, "x");
      },
    });
    expect(filled).toEqual(["OPENAI_SAFETY_IDENTIFIER_SECRET", "RAG_QUERY_HASH_SECRET", "HEALTH_DEEP_PROBE_SECRET"]);
    expect(text).toContain("RAG_PROVIDER_MODE=offline");
    expect(text).toContain("OPENAI_SAFETY_IDENTIFIER_SECRET=");
    expect(text).toContain("RAG_QUERY_HASH_SECRET=");
    expect(text).toContain("HEALTH_DEEP_PROBE_SECRET=");

    const again = mergeFillIntoEnvLocal(text, FILLABLE_LOCAL_SECRETS, {
      generate: () => "should-not-be-used-because-already-present-pad".padEnd(64, "y"),
    });
    expect(again.filled).toEqual([]);
  });

  it("replaces present-but-too-short assignments instead of duplicating keys", () => {
    const existing = [
      "RAG_PROVIDER_MODE=offline",
      "OPENAI_SAFETY_IDENTIFIER_SECRET=short",
      "RAG_QUERY_HASH_SECRET=also-short",
    ].join("\n");
    const { text, filled } = mergeFillIntoEnvLocal(existing, FILLABLE_LOCAL_SECRETS, {
      generate: () => "regenerated-local-secret-value-".padEnd(64, "z"),
    });
    expect(filled).toEqual(["OPENAI_SAFETY_IDENTIFIER_SECRET", "RAG_QUERY_HASH_SECRET", "HEALTH_DEEP_PROBE_SECRET"]);
    expect(text).toContain("RAG_PROVIDER_MODE=offline");
    expect(text).not.toMatch(/OPENAI_SAFETY_IDENTIFIER_SECRET=short/);
    expect(text).not.toMatch(/RAG_QUERY_HASH_SECRET=also-short/);
    expect([...text.matchAll(/^OPENAI_SAFETY_IDENTIFIER_SECRET=/gm)]).toHaveLength(1);
    expect([...text.matchAll(/^RAG_QUERY_HASH_SECRET=/gm)]).toHaveLength(1);
    expect(parseEnvFile(text).OPENAI_SAFETY_IDENTIFIER_SECRET).toMatch(/^regenerated-local-secret-value-/);
  });
});
