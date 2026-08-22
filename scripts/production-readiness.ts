import { access, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { constants } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";

import { checkSupabaseProjectConfig } from "@/lib/supabase/project";
import { checkNodeRuntime as checkStrictNodeRuntime } from "./check-runtime";

loadEnvConfig(process.cwd());

const isCiMode = process.argv.includes("--ci");

export function isProviderFreeCodexCloud(environment: Record<string, string | undefined> = process.env) {
  return (
    environment.CODEX_CLOUD === "1" &&
    (environment.CODEX_CLOUD_ACCESS_PROFILE ?? "offline") === "offline" &&
    environment.RAG_PROVIDER_MODE === "offline" &&
    environment.NEXT_PUBLIC_DEMO_MODE === "true" &&
    environment.PLAYWRIGHT_OFFLINE_MODE === "true"
  );
}

const providerFreeCodexCloud = isProviderFreeCodexCloud();
let providerCapabilityGap = false;

type Result = {
  failures: string[];
  warnings: string[];
  passes: string[];
};

function isMissingEnvError(message: string) {
  return message.startsWith("Missing server environment variables") || message.startsWith("Missing OPENAI_API_KEY.");
}

function recordIssue(message: string, options: { downgradeToWarningInCi?: boolean } = {}) {
  if (isCiMode && options.downgradeToWarningInCi) {
    result.warnings.push(`${message} (CI)`);
    return;
  }
  result.failures.push(message);
}

function recordProviderGap(message: string) {
  providerCapabilityGap = true;
  result.warnings.push(`Provider capability gap: ${message}`);
}

const result: Result = {
  failures: [],
  warnings: [],
  passes: [],
};

function placeholderLooksLikeExample(value: string) {
  return /replace-with|your-|example|-example-|\{\w+\}|xxxx|todo|placeholder/i.test(value);
}

export function openAIReadinessPolicy(providerMode: "auto" | "openai" | "offline", apiKey?: string) {
  if (providerMode === "offline") return { required: false, ready: true } as const;
  return { required: true, ready: Boolean(apiKey) } as const;
}

export type ClinicalAskReadinessStatus = "config_present" | "evidence_supplied" | "blocked" | "not_verified";
export type ClinicalAskReadinessFinding = {
  area: string;
  status: ClinicalAskReadinessStatus;
  message: string;
};

export function clinicalAskReadinessFindings(
  environment: Record<string, string | undefined>,
  fileExists: (filePath: string) => boolean = existsSync,
): ClinicalAskReadinessFinding[] {
  const enabled = environment.CLINICAL_ASK_ENABLED;
  const external = environment.CLINICAL_ASK_EXTERNAL_SEARCH_ENABLED;
  const disabledModes = environment.CLINICAL_ASK_DISABLED_MODES;
  const transcriptionModel = environment.OPENAI_TRANSCRIPTION_MODEL?.trim();
  const launchRequested = enabled === "true";
  const configured = (area: string, condition: boolean, message: string): ClinicalAskReadinessFinding => ({
    area,
    status: condition ? "config_present" : "blocked",
    message,
  });
  const evidence = (area: string, artifact: string, message: string): ClinicalAskReadinessFinding => {
    return {
      area,
      status: fileExists(artifact) ? "evidence_supplied" : "not_verified",
      message: `${message} (${artifact})`,
    };
  };

  return [
    configured("master flag", enabled === "true" || enabled === "false", "CLINICAL_ASK_ENABLED must be explicit."),
    configured(
      "external flag",
      external === "true" || external === "false",
      "CLINICAL_ASK_EXTERNAL_SEARCH_ENABLED must be explicit.",
    ),
    configured(
      "emergency denylist",
      disabledModes !== undefined && (!launchRequested || disabledModes.trim() === ""),
      "CLINICAL_ASK_DISABLED_MODES must be explicit and empty for a seven-mode launch claim.",
    ),
    configured("transcription model", Boolean(transcriptionModel), "OPENAI_TRANSCRIPTION_MODEL must be explicit."),
    configured(
      "migration file",
      fileExists("supabase/migrations/20260822120000_expand_answer_feedback_for_clinical_ask.sql"),
      "The Clinical Ask feedback migration file must be present.",
    ),
    evidence(
      "hosted migration",
      ".local/clinical-ask-evidence/hosted-migration.json",
      "Hosted feedback-migration state is not verified by repository presence.",
    ),
    evidence(
      "authority approval",
      ".local/clinical-ask-evidence/authority-approval.json",
      "Authority-registry approval is not verified by code presence.",
    ),
    evidence(
      "synthetic evaluation",
      ".local/clinical-ask-evidence/synthetic-evaluation.json",
      "A synthetic seven-mode clinical evaluation artefact is required.",
    ),
    evidence(
      "protected staging canary",
      ".local/clinical-ask-evidence/protected-staging-canary.json",
      "A protected-staging live canary artefact is required.",
    ),
    evidence(
      "contractual retention and region",
      ".local/clinical-ask-evidence/contractual-basis.json",
      "Provider retention, region, and contractual basis are not verified by application configuration.",
    ),
    evidence(
      "physical iPhone acceptance",
      ".local/clinical-ask-evidence/physical-iphone-acceptance.json",
      "Physical iPhone Safari and installed-PWA microphone acceptance is required; Chromium emulation is insufficient.",
    ),
  ];
}

function recordClinicalAskReadiness() {
  const findings = clinicalAskReadinessFindings(process.env);
  const launchRequested = process.env.CLINICAL_ASK_ENABLED === "true";
  for (const finding of findings) {
    const line = `Clinical Ask ${finding.status.replace("_", " ")} — ${finding.area}: ${finding.message}`;
    if (finding.status === "config_present" || finding.status === "evidence_supplied") result.passes.push(line);
    else if (finding.status === "blocked" && !isCiMode && !providerFreeCodexCloud) result.failures.push(line);
    else if (launchRequested) result.failures.push(line);
    else result.warnings.push(line);
  }
}

async function checkRequiredFile(filePath: string, message: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    result.failures.push(message);
    return false;
  }
}

async function checkOptionalFile(filePath: string, message: string) {
  try {
    await access(filePath, constants.F_OK);
    result.passes.push(message);
    return true;
  } catch {
    result.warnings.push(`${message} (missing)`);
    return false;
  }
}

async function hasFile(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function checkNodeRuntime() {
  const runtime = checkStrictNodeRuntime(process.versions.node);
  if (runtime.ok) {
    result.passes.push(runtime.message);
    return;
  }
  if (runtime.message.includes("newer than the release target")) {
    result.warnings.push(`${runtime.message} Run npm run check:runtime before release.`);
    return;
  }
  result.failures.push(runtime.message);
}

function recordNoAuthProductionCheck() {
  if (
    (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
    (process.env.NEXT_PUBLIC_LOCAL_NO_AUTH === "true" || process.env.LOCAL_NO_AUTH === "true")
  ) {
    result.failures.push("Local no-auth mode is enabled in production-like environment variables.");
  }
}

function recordDemoModeProductionCheck() {
  if (
    (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  ) {
    result.failures.push("Demo mode (NEXT_PUBLIC_DEMO_MODE=true) is enabled in a production-like environment.");
  }
}

function recordRawQueryPersistenceProductionCheck() {
  if (
    (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
    process.env.RAG_PERSIST_RAW_QUERY_TEXT === "true"
  ) {
    result.failures.push("RAG_PERSIST_RAW_QUERY_TEXT=true is not allowed in a production-like environment.");
  }
}

function recordAnswerPersistenceProductionCheck() {
  if (
    (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
    process.env.RAG_PERSIST_ANSWER_TEXT === "true"
  ) {
    result.failures.push("RAG_PERSIST_ANSWER_TEXT=true is not allowed in a production-like environment.");
  }
}

async function checkFileForServiceRoleExposure() {
  const envFiles = [".env", ".env.production", ".env.development"];
  for (const fileName of envFiles) {
    const filePath = path.join(process.cwd(), fileName);
    try {
      const content = await readFile(filePath, "utf8");
      const hasPlainServiceRole = /NEXT_PUBLIC_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(content);
      if (!hasPlainServiceRole) {
        continue;
      }
      result.warnings.push(
        `${fileName} contains a service-role key marker. Keep these files out of source control and verify only server-side usage.`,
      );
    } catch {
      // file is optional in this repo shape
    }
  }
}

// PIA-2: the query-hash HMAC guard only redacts logged clinical queries if it is
// actually invoked at boot. Assert the fail-closed call is still wired into the
// startup path (src/instrumentation.ts) so a refactor can't silently drop it and let
// production start writing unsalted, dictionary-reversible SHA-256 hashes. The
// behavioural proof lives in tests/instrumentation.test.ts; this is a check-time
// signal that the guard is active in every environment, including CI where the
// secret-presence check below is intentionally quiet. The regex matches the call
// form (`requireQueryHashSecret(`), not the bare import destructuring.
async function checkQueryHashGuardWiring() {
  const instrumentationPath = path.join(process.cwd(), "src", "instrumentation.ts");
  let source: string;
  try {
    source = await readFile(instrumentationPath, "utf8");
  } catch {
    result.failures.push(
      "Cannot read src/instrumentation.ts to verify the RAG_QUERY_HASH_SECRET boot guard is active.",
    );
    return;
  }
  if (/\brequireQueryHashSecret\s*\(/.test(source)) {
    result.passes.push(
      "Boot guard invokes requireQueryHashSecret(); the query-hash HMAC fails closed in production (PIA-2).",
    );
  } else {
    result.failures.push(
      "src/instrumentation.ts no longer invokes requireQueryHashSecret(); the query-hash HMAC boot guard (PIA-2) is not active.",
    );
  }
}

async function main() {
  checkNodeRuntime();
  recordNoAuthProductionCheck();
  recordDemoModeProductionCheck();
  recordRawQueryPersistenceProductionCheck();
  recordAnswerPersistenceProductionCheck();
  await checkFileForServiceRoleExposure();
  await checkQueryHashGuardWiring();
  recordClinicalAskReadiness();

  if (!(await checkRequiredFile(path.join(process.cwd(), "package-lock.json"), "package-lock.json is required"))) {
    // keep going so we can show all diagnostics
  }
  await checkRequiredFile(
    path.join(process.cwd(), ".env.example"),
    ".env.example is required for documented environment contract.",
  );

  const hasEnvLocal = await hasFile(path.join(process.cwd(), ".env.local"));
  const hasEnv = await hasFile(path.join(process.cwd(), ".env"));
  await checkOptionalFile(path.join(process.cwd(), ".env.local"), "Local override file .env.local is present");
  if (!hasEnvLocal && !hasEnv) {
    result.warnings.push("Neither .env nor .env.local exists for local overrides.");
  } else if (hasEnv) {
    result.passes.push("Top-level .env exists");
  }

  let envModule: typeof import("@/lib/env") | null = null;
  try {
    envModule = await import("@/lib/env");
  } catch (error) {
    result.failures.push(
      `Environment schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (envModule) {
    try {
      envModule.requireServerEnv();
      result.passes.push("Server env includes required Supabase project values.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isMissingEnvError(message)) {
        if (providerFreeCodexCloud) {
          recordProviderGap(
            `Supabase server credentials are intentionally unavailable in the offline Cloud agent profile (${message}).`,
          );
        } else {
          recordIssue(`Missing server env config: ${message}`, { downgradeToWarningInCi: true });
        }
      } else {
        result.failures.push(`Missing server env config: ${message}`);
      }
    }

    const openAIReadiness = openAIReadinessPolicy(envModule.env.RAG_PROVIDER_MODE, envModule.env.OPENAI_API_KEY);
    if (!openAIReadiness.required) {
      result.passes.push("OpenAI API key is not required because RAG_PROVIDER_MODE is explicitly offline.");
    } else {
      try {
        envModule.requireOpenAIEnv();
        result.passes.push("OpenAI API key is configured.");
        if (placeholderLooksLikeExample(envModule.env.OPENAI_API_KEY ?? "")) {
          result.failures.push("OPENAI_API_KEY still looks like a placeholder.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isMissingEnvError(message)) {
          recordIssue(`OpenAI configuration issue: ${message}`, { downgradeToWarningInCi: true });
        } else {
          result.failures.push(`OpenAI configuration issue: ${message}`);
        }
      }
    }

    if (envModule.env.OPENAI_API_KEY && !envModule.env.OPENAI_SAFETY_IDENTIFIER_SECRET) {
      result.warnings.push(
        "OPENAI_SAFETY_IDENTIFIER_SECRET is not set; authenticated Responses requests omit the privacy-preserving safety identifier. For local/dev, run npm run check:local-presence -- --fill.",
      );
    } else if (envModule.env.OPENAI_SAFETY_IDENTIFIER_SECRET) {
      result.passes.push("OpenAI safety identifiers use a deployment-secret HMAC; raw owner IDs are not sent.");
    } else if (!isCiMode) {
      result.warnings.push(
        "OPENAI_SAFETY_IDENTIFIER_SECRET is not set (optional until OpenAI is enabled). Local fill: npm run check:local-presence -- --fill.",
      );
    }

    // Exercise the real boot guard so this check tracks its behaviour instead of
    // re-encoding the env rule (mirrors requireServerEnv/requireOpenAIEnv above). A
    // present secret passes in any environment; a missing one fails closed only in a
    // production-like environment (dev/CI keep the legacy digest for stored-row joins).
    try {
      envModule.requireQueryHashSecret();
      result.passes.push(
        "RAG_QUERY_HASH_SECRET is set; logged clinical-query hashes are keyed HMAC pseudonyms (PIA-2).",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
      if (productionLike) {
        result.failures.push(`Query-hash secret issue: ${message}`);
      } else if (!isCiMode) {
        result.warnings.push(
          `RAG_QUERY_HASH_SECRET is not set for local/dev (${message}). Fill a distinct local value with npm run check:local-presence -- --fill.`,
        );
      }
    }

    if (envModule.env.HEALTH_DEEP_PROBE_SECRET) {
      result.passes.push("HEALTH_DEEP_PROBE_SECRET is set for authorized deep health probes.");
    } else if (!isCiMode) {
      result.warnings.push(
        "HEALTH_DEEP_PROBE_SECRET is not set; /api/health?deep=1 stays shallow. Local fill: npm run check:local-presence -- --fill.",
      );
    }

    if (placeholderLooksLikeExample(envModule.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "")) {
      result.warnings.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY looks like a placeholder.");
    }
    if (placeholderLooksLikeExample(envModule.env.SUPABASE_SERVICE_ROLE_KEY ?? "")) {
      result.failures.push("SUPABASE_SERVICE_ROLE_KEY looks like a placeholder.");
    }
  }

  const supabaseCheck = checkSupabaseProjectConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
    SUPABASE_PROJECT_NAME: process.env.SUPABASE_PROJECT_NAME,
    SUPABASE_STAGING_PROJECT_REF: process.env.SUPABASE_STAGING_PROJECT_REF,
    SUPABASE_STAGING_PROJECT_NAME: process.env.SUPABASE_STAGING_PROJECT_NAME,
  });
  if (supabaseCheck.status === "ready") {
    result.passes.push(`Supabase project config points to ${supabaseCheck.expected.name}.`);
  } else if (supabaseCheck.status === "warning") {
    if (supabaseCheck.warnings.length) {
      result.warnings.push(...supabaseCheck.warnings);
    }
    result.passes.push("Supabase URL is correct.");
  } else if (supabaseCheck.status === "missing" && providerFreeCodexCloud) {
    recordProviderGap(
      "Supabase project connectivity is unavailable because NEXT_PUBLIC_SUPABASE_URL and agent-phase credentials are intentionally absent. Run this provider check locally/operator-side or in an explicitly provisioned connected Cloud profile.",
    );
  } else if (supabaseCheck.status === "missing" && isCiMode) {
    result.warnings.push("NEXT_PUBLIC_SUPABASE_URL is not set in this environment (CI).");
  } else {
    result.failures.push(...supabaseCheck.problems);
  }

  console.log("[Production Readiness]");
  console.log(`Project: ${supabaseCheck.expected.name} (${supabaseCheck.expected.ref})`);
  if (supabaseCheck.observed.configuredName) {
    console.log(`Configured name: ${supabaseCheck.observed.configuredName}`);
  }
  console.log(`Configured ref: ${supabaseCheck.observed.configuredRef ?? "not set"}`);
  console.log("");

  if (result.passes.length > 0) {
    console.log(`PASS (${result.passes.length}):`);
    for (const item of result.passes) console.log(`  - ${item}`);
  }
  if (result.warnings.length > 0) {
    console.log(`WARN (${result.warnings.length}):`);
    for (const item of result.warnings) console.log(`  - ${item}`);
  }
  if (result.failures.length > 0) {
    console.log(`FAIL (${result.failures.length}):`);
    for (const item of result.failures) console.log(`  - ${item}`);
    process.exitCode = 1;
  } else if (providerFreeCodexCloud && providerCapabilityGap) {
    console.log(
      "CLOUD PROVIDER-FREE READY: local production safeguards passed; authenticated provider readiness is capability-blocked by the offline agent profile.",
    );
  } else {
    console.log("READY: no blocking production-readiness failures.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    result.failures.push(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
