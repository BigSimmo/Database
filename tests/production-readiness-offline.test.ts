import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isProviderFreeCodexCloud, openAIReadinessPolicy } from "../scripts/production-readiness";
import { providerEnvironmentKeys } from "../scripts/test-environment.mjs";

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

    const spawnError = result.error as NodeJS.ErrnoException | undefined;
    expect(
      spawnError,
      spawnError?.code === "ETIMEDOUT"
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
