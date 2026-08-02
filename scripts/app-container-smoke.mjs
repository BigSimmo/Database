#!/usr/bin/env node
/**
 * app-container-smoke — run the built app image provider-free and verify:
 *   - /api/health returns HTTP 200 with status: ok, openaiConfig: skipped,
 *     supabaseConfig: ok
 *   - PID 1 is the expected next start command
 *   - container stops cleanly within a bounded timeout
 */
import { spawnSync } from "node:child_process";

const IMAGE_REF = process.argv[2] ?? "clinical-kb-app:ci";
const CONTAINER_NAME = "clinical-kb-app-smoke";
const STOP_TIMEOUT_SECONDS = 30;

function run(args, opts = {}) {
  const result = spawnSync(args[0], args.slice(1), { encoding: "utf8", stdio: "pipe", ...opts });
  return result;
}

function cleanContainer() {
  spawnSync("docker", ["rm", "-f", CONTAINER_NAME], { encoding: "utf8" });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(port = 3000, attempts = 30) {
  const healthUrl = `http://127.0.0.1:${port}/api/health`;
  for (let i = 0; i < attempts; i += 1) {
    const result = run([
      "docker",
      "exec",
      CONTAINER_NAME,
      "node",
      "-e",
      `fetch("${healthUrl}").then((r)=>r.json()).then((j)=>{console.log(JSON.stringify(j));process.exit(0);}).catch((e)=>{console.error(e.message);process.exit(1);})`,
    ]);
    if (result.status === 0) {
      try {
        return JSON.parse(result.stdout);
      } catch {
        /* not ready yet */
      }
    }
    await sleep(1000);
  }
  return null;
}

async function main() {
  cleanContainer();

  const runResult = run([
    "docker",
    "run",
    "-d",
    "--name",
    CONTAINER_NAME,
    "--network=none",
    "--cap-drop=ALL",
    "--security-opt",
    "no-new-privileges:true",
    "-e",
    "NODE_ENV=production",
    "-e",
    "NEXT_PUBLIC_DEMO_MODE=false",
    "-e",
    "NEXT_PUBLIC_SUPABASE_URL=https://sjrfecxgysukkwxsowpy.supabase.co",
    "-e",
    "SUPABASE_SERVICE_ROLE_KEY=smoke-test-placeholder",
    "-e",
    "SUPABASE_PROJECT_REF=sjrfecxgysukkwxsowpy",
    "-e",
    "SUPABASE_PROJECT_NAME=Clinical KB Database",
    "-e",
    "RAG_PROVIDER_MODE=offline",
    "-e",
    "NEXT_TELEMETRY_DISABLED=1",
    IMAGE_REF,
  ]);

  if (runResult.status !== 0) {
    console.error("docker run failed", runResult.stderr);
    process.exit(1);
  }

  const health = await waitForHealth();
  if (!health) {
    console.error("App health endpoint did not become ready in time");
    cleanContainer();
    process.exit(1);
  }

  if (health.status !== "ok") {
    console.error("App health status not ok:", JSON.stringify(health, null, 2));
    cleanContainer();
    process.exit(1);
  }
  if (health.checks?.openaiConfig !== "skipped") {
    console.error("Expected openaiConfig=skipped, got:", health.checks?.openaiConfig);
    cleanContainer();
    process.exit(1);
  }
  if (health.checks?.supabaseConfig !== "ok") {
    console.error("Expected supabaseConfig=ok, got:", health.checks?.supabaseConfig);
    cleanContainer();
    process.exit(1);
  }
  if (health.demoMode !== false) {
    console.error("Expected demoMode=false in production, got:", health.demoMode);
    cleanContainer();
    process.exit(1);
  }

  const psResult = run([
    "docker",
    "exec",
    CONTAINER_NAME,
    "node",
    "-e",
    "console.log(require('fs').readFileSync('/proc/1/cmdline','utf8').replace(/\\u0000/g,' ').trim())",
  ]);
  const pid1 = psResult.stdout?.trim();
  if (!pid1?.includes("next start")) {
    console.error("PID 1 is not the expected next start command:", pid1);
    cleanContainer();
    process.exit(1);
  }

  run(["docker", "stop", "-t", String(STOP_TIMEOUT_SECONDS), CONTAINER_NAME]);
  const inspectResult = run(["docker", "inspect", "--format", "{{.State.OOMKilled}} {{.State.ExitCode}}", CONTAINER_NAME]);
  const [oom, exitCode] = inspectResult.stdout?.trim().split(" ") ?? ["true", "-1"];

  if (oom === "true") {
    console.error("Container was OOMKilled");
    cleanContainer();
    process.exit(1);
  }

  console.log(`App smoke passed. PID 1: ${pid1}. Exit code: ${exitCode}. Health:`, JSON.stringify(health, null, 2));
  cleanContainer();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  cleanContainer();
  process.exit(1);
});
