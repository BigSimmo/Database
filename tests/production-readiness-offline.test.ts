import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  clinicalAskReadinessFindings,
  isProviderFreeCodexCloud,
  openAIReadinessPolicy,
} from "../scripts/production-readiness";
import { providerEnvironmentKeys } from "../scripts/test-environment.mjs";

describe("production readiness provider policy", () => {
  it("separates Clinical Ask code configuration from approval-gated live evidence", () => {
    const existing = new Set([
      "supabase/migrations/20260822120000_expand_answer_feedback_for_clinical_ask.sql",
      ".local/clinical-ask-evidence/synthetic-evaluation.json",
    ]);
    const findings = clinicalAskReadinessFindings(
      {
        CLINICAL_ASK_ENABLED: "false",
        CLINICAL_ASK_EXTERNAL_SEARCH_ENABLED: "false",
        CLINICAL_ASK_DISABLED_MODES: "",
        OPENAI_TRANSCRIPTION_MODEL: "gpt-4o-mini-transcribe",
      },
      (filePath) => existing.has(filePath),
    );
    expect(findings.filter((finding) => finding.status === "config_present").map((finding) => finding.area)).toEqual([
      "master flag",
      "external flag",
      "emergency denylist",
      "transcription model",
      "migration file",
    ]);
    expect(findings.find((finding) => finding.area === "synthetic evaluation")?.status).toBe("evidence_supplied");
    expect(findings.find((finding) => finding.area === "hosted migration")?.status).toBe("not_verified");
    expect(findings.find((finding) => finding.area === "authority approval")?.status).toBe("not_verified");
    expect(findings.find((finding) => finding.area === "protected staging canary")?.status).toBe("not_verified");
    expect(findings.find((finding) => finding.area === "contractual retention and region")?.status).toBe(
      "not_verified",
    );
    expect(findings.find((finding) => finding.area === "physical iPhone acceptance")?.status).toBe("not_verified");
  });

  it("blocks a seven-mode launch claim with a non-empty emergency denylist or missing explicit configuration", () => {
    const findings = clinicalAskReadinessFindings(
      { CLINICAL_ASK_ENABLED: "true", CLINICAL_ASK_DISABLED_MODES: "therapy-compass" },
      () => false,
    );
    expect(findings.find((finding) => finding.area === "external flag")?.status).toBe("blocked");
    expect(findings.find((finding) => finding.area === "emergency denylist")?.status).toBe("blocked");
    expect(findings.find((finding) => finding.area === "transcription model")?.status).toBe("blocked");
  });
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
    expect(result.stdout).toContain("Clinical Ask not verified — hosted migration");
    expect(result.stdout).toContain("Clinical Ask not verified — physical iPhone acceptance");
  });

  it("documents local presence fill guidance for safety/query-hash/deep-probe gaps", () => {
    const source = readFileSync(new URL("../scripts/production-readiness.ts", import.meta.url), "utf8");
    expect(source).toContain("check:local-presence");
    expect(source).toContain("HEALTH_DEEP_PROBE_SECRET is not set");
    expect(source).toContain("OPENAI_SAFETY_IDENTIFIER_SECRET is not set");
  });
});
