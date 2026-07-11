#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";

for (const key of [
  "OPENAI_API_KEY",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_PROJECT_NAME",
]) {
  delete process.env[key];
}
process.env.RAG_PROVIDER_MODE = "auto";

const productionRagTests = [
  "tests/eval-retrieval.test.ts",
  "tests/retrieval-selection.test.ts",
  "tests/rag-routing.test.ts",
  "tests/rag-answer-fallback.test.ts",
  "tests/rag-trust.test.ts",
  "tests/rag-injection.test.ts",
];

async function main() {
  const testResult = spawnSync(
    process.execPath,
    ["scripts/run-vitest.mjs", "run", "--reporter=dot", ...productionRagTests],
    { env: process.env, stdio: "inherit" },
  );
  if (testResult.error) throw testResult.error;
  if (testResult.status !== 0) process.exit(testResult.status ?? 1);

  const { runOfflineRagPreflight } = await import("./lib/eval-rag-offline-production");
  await runOfflineRagPreflight();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
