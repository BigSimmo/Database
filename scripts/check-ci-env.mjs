import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadLocalEnvFile(fileName) {
  const envPath = path.join(process.cwd(), fileName);
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const [, name, rawValue] = match;
    if (process.env[name] !== undefined) continue;
    process.env[name] = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

function isPlaceholder(value) {
  return /<[^>]+>|^your-|replace-with|placeholder/i.test(value);
}

function readEnv(name) {
  return process.env[name]?.trim() ?? "";
}

function missingEnv(names) {
  return names.filter((name) => {
    const value = readEnv(name);
    return !value || isPlaceholder(value);
  });
}

function validateSupabaseUrl(problems) {
  const value = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (!value || isPlaceholder(value)) return;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") problems.push("NEXT_PUBLIC_SUPABASE_URL must use https.");
  } catch {
    problems.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }
}

loadLocalEnvFile(".env.local");

const requiredPublicEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
const requiredE2EEnv = ["E2E_USER_EMAIL", "E2E_USER_PASSWORD"];
const problems = [];
const missingPublic = missingEnv(requiredPublicEnv);

if (missingPublic.length > 0) {
  problems.push(`Missing required Supabase env: ${missingPublic.join(", ")}`);
}

validateSupabaseUrl(problems);

const hasAnyE2EEnv = requiredE2EEnv.some((name) => Boolean(readEnv(name)));
const e2eEnabled = isTruthy(process.env.E2E_AUTH_ENABLED) || hasAnyE2EEnv;

if (e2eEnabled) {
  const missingE2E = missingEnv(requiredE2EEnv);
  if (missingE2E.length > 0) {
    problems.push(`E2E auth is enabled but missing: ${missingE2E.join(", ")}`);
  }
}

if (problems.length > 0) {
  console.error("CI environment check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  console.error("");
  console.error("Required public-safe browser env:");
  for (const name of requiredPublicEnv) console.error(`- ${name}`);
  console.error("");
  console.error("Optional E2E auth env, stored as CI/local secrets when E2E auth is enabled:");
  for (const name of requiredE2EEnv) console.error(`- ${name}`);
  console.error("");
  console.error("Never use SUPABASE_SERVICE_ROLE_KEY or any service_role key in browser/E2E client setup.");
  process.exit(1);
}

console.log(`CI environment check passed. E2E auth ${e2eEnabled ? "enabled" : "disabled"}; no secret values printed.`);
