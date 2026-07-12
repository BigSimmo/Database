import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { checkSupabaseProjectConfig } from "@/lib/supabase/project";
import { checkNodeRuntime as checkStrictNodeRuntime } from "./check-runtime";

loadEnvConfig(process.cwd());

const isCiMode = process.argv.includes("--ci");

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

const result: Result = {
  failures: [],
  warnings: [],
  passes: [],
};

function placeholderLooksLikeExample(value: string) {
  return /replace-with|your-|example|-example-|\{\w+\}|xxxx|todo|placeholder/i.test(value);
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
        recordIssue(`Missing server env config: ${message}`, { downgradeToWarningInCi: true });
      } else {
        result.failures.push(`Missing server env config: ${message}`);
      }
    }

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
      }
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
  });
  if (supabaseCheck.status === "ready") {
    result.passes.push("Supabase project config points to Clinical KB Database.");
  } else if (supabaseCheck.status === "warning") {
    if (supabaseCheck.warnings.length) {
      result.warnings.push(...supabaseCheck.warnings);
    }
    result.passes.push("Supabase URL is correct.");
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
  } else {
    console.log("READY: no blocking production-readiness failures.");
  }
}

main().catch((error) => {
  result.failures.push(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
