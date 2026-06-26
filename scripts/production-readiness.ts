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

async function checkFileForServiceRoleExposure() {
  const envFiles = [".env", ".env.local", ".env.production", ".env.development"];
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

async function main() {
  checkNodeRuntime();
  recordNoAuthProductionCheck();
  await checkFileForServiceRoleExposure();

  if (!(await checkRequiredFile(path.join(process.cwd(), "package-lock.json"), "package-lock.json is required"))) {
    // keep going so we can show all diagnostics
  }
  await checkRequiredFile(
    path.join(process.cwd(), ".env.example"),
    ".env.example is required for documented environment contract.",
  );

  await checkOptionalFile(path.join(process.cwd(), ".env.local"), "Local override file .env.local is present");
  await checkOptionalFile(path.join(process.cwd(), ".env"), "Top-level .env exists");

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
