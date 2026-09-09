import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  isProviderFreeCodexCloud,
  openAIReadinessPolicy,
  ragProgrammeReadinessPolicy,
} from "../scripts/production-readiness";
import { providerEnvironmentKeys } from "../scripts/test-environment.mjs";

describe("programme static readiness", () => {
  it("recognizes the implemented producer and renderer while keeping both flags default-off", () => {
    expect(ragProgrammeReadinessPolicy({ RAG_ADAPTIVE_ANSWER_ENABLED: "true" })).toEqual([]);
    expect(
      ragProgrammeReadinessPolicy({ RAG_ADAPTIVE_ANSWER_ENABLED: "true", RAG_ADAPTIVE_ANSWER_RENDER_ENABLED: "true" }),
    ).toEqual([]);
  });
  const canary = {
    RAG_PROGRAMME_MODE: "canary",
    RAG_PROGRAMME_CANARY_BASIS_POINTS: "100",
    RAG_PROGRAMME_ROLLOUT_SALT: "s".repeat(32),
    RAG_TELEMETRY_EXTENDED: "true",
  };
  it("accepts legacy default-off without claiming connected proof", () =>
    expect(ragProgrammeReadinessPolicy({})).toEqual([]));
  it("requires salt telemetry and trusted rollback ownership for canary", () => {
    expect(ragProgrammeReadinessPolicy({ RAG_PROGRAMME_MODE: "canary" })).toEqual(
      expect.arrayContaining([
        "rollout_salt_missing_or_invalid",
        "programme_telemetry_disabled",
        "rollback_ownership_unavailable",
      ]),
    );
    expect(ragProgrammeReadinessPolicy(canary)).toEqual(["rollback_ownership_unavailable"]);
    expect(ragProgrammeReadinessPolicy(canary, { rollbackOwnerBound: true })).toEqual([]);
  });
  it.each(["-1", "10001", "1.2", "garbage"])("rejects malformed percentage %s", (value) =>
    expect(ragProgrammeReadinessPolicy({ ...canary, RAG_PROGRAMME_CANARY_BASIS_POINTS: value })).toContain(
      "canary_percentage_invalid",
    ),
  );
  it("rejects malformed mode and flag controls", () => {
    expect(ragProgrammeReadinessPolicy({ RAG_PROGRAMME_MODE: "candidate" })).toContain("programme_mode_invalid");
    expect(ragProgrammeReadinessPolicy({ RAG_SITE_CONTENT_ENABLED: "yes" })).toContain("component_flag_invalid");
  });
  it("requires the real adaptive producer and contract before enabled readiness", () => {
    expect(ragProgrammeReadinessPolicy({ ...canary, RAG_ADAPTIVE_ANSWER_RENDER_ENABLED: "true" })).toContain(
      "adaptive_render_requires_answer",
    );
    expect(ragProgrammeReadinessPolicy({ ...canary, RAG_ADAPTIVE_ANSWER_ENABLED: "true" })).not.toContain(
      "adaptive_producer_contract_unavailable",
    );
  });
  it("never substitutes configured versions for active site/admin and Australian health", () => {
    const config = {
      ...canary,
      RAG_SITE_CONTENT_ENABLED: "true",
      RAG_AUSTRALIAN_AUGMENTATION_ENABLED: "true",
      SITE_CONTENT_EXPECTED_STATIC_MANIFEST_DIGEST: "a".repeat(64),
    };
    expect(ragProgrammeReadinessPolicy(config, { rollbackOwnerBound: true })).toEqual(
      expect.arrayContaining([
        "site_release_or_administrator_proof_unavailable",
        "australian_policy_or_health_unavailable",
      ]),
    );
    expect(
      ragProgrammeReadinessPolicy(config, {
        rollbackOwnerBound: true,
        siteContent: {
          state: "current",
          staticManifestDigest: "a".repeat(64),
          releaseValid: true,
          administratorAttestationValid: true,
        },
        australian: { sourcePolicyVersion: "policy-v1", healthy: true },
      }),
    ).toEqual([]);
    expect(
      ragProgrammeReadinessPolicy(config, {
        rollbackOwnerBound: true,
        siteContent: {
          state: "current",
          staticManifestDigest: "b".repeat(64),
          releaseValid: true,
          administratorAttestationValid: true,
        },
      }),
    ).toContain("site_release_or_administrator_proof_unavailable");
  });
});

describe("production readiness provider policy", () => {
  it("passes the explicit staging declaration to the shared project guard", () => {
    const source = readFileSync(new URL("../scripts/production-readiness.ts", import.meta.url), "utf8");
    expect(source).toContain("SUPABASE_STAGING_PROJECT_REF: process.env.SUPABASE_STAGING_PROJECT_REF");
    expect(source).toContain("SUPABASE_STAGING_PROJECT_NAME: process.env.SUPABASE_STAGING_PROJECT_NAME");
  });

  it("requires an OpenAI key for auto and openai modes", () => {
    expect(openAIReadinessPolicy("auto")).toEqual({ required: true, ready: false });
    expect(openAIReadinessPolicy("openai")).toEqual({ required: true, ready: false });
    expect(openAIReadinessPolicy("auto", "configured")).toEqual({ required: true, ready: true });
  });

  it("allows a missing OpenAI key only for explicit offline mode", () => {
    expect(openAIReadinessPolicy("offline")).toEqual({ required: false, ready: true });
  });

  it("distinguishes the provider-free Cloud contract from connected live verification", () => {
    expect(
      isProviderFreeCodexCloud({
        CODEX_CLOUD: "1",
        CODEX_CLOUD_ACCESS_PROFILE: "offline",
        RAG_PROVIDER_MODE: "offline",
        NEXT_PUBLIC_DEMO_MODE: "true",
        PLAYWRIGHT_OFFLINE_MODE: "true",
      }),
    ).toBe(true);
    expect(
      isProviderFreeCodexCloud({
        CODEX_CLOUD: "1",
        CODEX_CLOUD_ACCESS_PROFILE: "connected",
        RAG_PROVIDER_MODE: "auto",
        NEXT_PUBLIC_DEMO_MODE: "false",
        PLAYWRIGHT_OFFLINE_MODE: "false",
      }),
    ).toBe(false);
  });

  it("reports the provider capability gap before generic CI readiness", () => {
    const environment = { ...process.env };
    for (const name of providerEnvironmentKeys) delete environment[name];
    Object.assign(environment, {
      CODEX_CLOUD: "1",
      CODEX_CLOUD_ACCESS_PROFILE: "offline",
      RAG_PROVIDER_MODE: "offline",
      NEXT_PUBLIC_DEMO_MODE: "true",
      PLAYWRIGHT_OFFLINE_MODE: "true",
    });
    const result = spawnSync(process.execPath, ["scripts/run-tsx.mjs", "scripts/production-readiness.ts", "--ci"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
      env: environment,
      timeout: 30_000,
    });

    const spawnError = result.error;
    const timedOut = spawnError !== undefined && "code" in spawnError && spawnError.code === "ETIMEDOUT";
    expect(
      spawnError,
      timedOut
        ? "production-readiness --ci timed out after 30s"
        : `production-readiness --ci failed to start: ${spawnError?.message ?? "unknown"}\n${result.stdout}\n${result.stderr}`,
    ).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Provider capability gap:");
    expect(result.stdout).toContain("CLOUD PROVIDER-FREE READY:");
  });

  it("documents local presence fill guidance for safety/query-hash/deep-probe gaps", () => {
    const source = readFileSync(new URL("../scripts/production-readiness.ts", import.meta.url), "utf8");
    expect(source).toContain("check:local-presence");
    expect(source).toContain("HEALTH_DEEP_PROBE_SECRET is not set");
    expect(source).toContain("OPENAI_SAFETY_IDENTIFIER_SECRET is not set");
  });
});
