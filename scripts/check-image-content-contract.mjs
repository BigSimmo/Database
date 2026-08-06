#!/usr/bin/env node
/**
 * check-image-content-contract — assert the final images meet hardening
 * requirements: non-root user, SIGTERM stop signal, expected OCI labels,
 * expected Cmd, and absence of development/secrets files.
 */
import { spawnSync } from "node:child_process";

const APP_IMAGE = process.argv[2] ?? "clinical-kb-app:ci";
const WORKER_IMAGE = process.argv[3] ?? "clinical-kb-worker:ci";

function run(args) {
  const result = spawnSync(args[0], args.slice(1), { encoding: "utf8", stdio: "pipe" });
  return result;
}

function inspect(image, format) {
  const r = run(["docker", "inspect", "--format", format, image]);
  if (r.status !== 0) throw new Error(`docker inspect failed for ${image}: ${r.stderr}`);
  return r.stdout.trim();
}

function assertImage(image, kind) {
  const user = inspect(image, "{{.Config.User}}");
  if (user !== "node") throw new Error(`${image}: expected User=node, got ${user}`);

  const stopSignal = inspect(image, "{{.Config.StopSignal}}");
  if (stopSignal !== "SIGTERM") throw new Error(`${image}: expected StopSignal=SIGTERM, got ${stopSignal}`);

  const cmd = inspect(image, "{{json .Config.Cmd}}");
  // `docker inspect --format '{{json .Config.Cmd}}'` prints the literal
  // string `null` when Cmd is unset — treat that as missing.
  if (!cmd || cmd === "null") throw new Error(`${image}: missing Cmd`);
  if (kind === "app" && !cmd.includes("next start")) {
    throw new Error(`${image}: expected app Cmd to contain 'next start', got ${cmd}`);
  }
  if (kind === "worker" && !cmd.includes("dist/worker/index.mjs")) {
    throw new Error(`${image}: expected worker Cmd to contain 'dist/worker/index.mjs', got ${cmd}`);
  }

  const sourceLabel = inspect(image, '{{index .Config.Labels "org.opencontainers.image.source"}}');
  if (!sourceLabel) throw new Error(`${image}: missing org.opencontainers.image.source label`);
}

function assertPathAbsent(image, path) {
  const r = run(["docker", "run", "--rm", "--entrypoint", "test", image, "!", "-e", path]);
  if (r.status !== 0) throw new Error(`${image}: unexpected path exists: ${path}`);
}

function assertShellListingClean(image, shellCommand, failureMessage) {
  const r = run(["docker", "run", "--rm", "--entrypoint", "sh", image, "-c", shellCommand]);
  if (r.status !== 0) {
    throw new Error(
      `${image}: docker run failed while checking content (${failureMessage}): ${r.stderr || r.stdout || `exit ${r.status}`}`,
    );
  }
  if (r.stdout?.trim()) throw new Error(`${image}: ${failureMessage}`);
}

function assertWorkerPythonClean(image) {
  // Absolute path so a wrong WORKDIR cannot silently skip the glob.
  assertShellListingClean(
    image,
    "ls /app/worker/python/test_*.py 2>/dev/null || true",
    "worker/python test_*.py files were not removed",
  );
}

function main() {
  assertImage(APP_IMAGE, "app");
  assertImage(WORKER_IMAGE, "worker");

  for (const image of [APP_IMAGE, WORKER_IMAGE]) {
    assertPathAbsent(image, "/app/.env");
    assertPathAbsent(image, "/app/.env.example");
    assertPathAbsent(image, "/app/.env.local");
    assertPathAbsent(image, "/app/tests");
    assertPathAbsent(image, "/app/*.pem"); // glob not supported; checked below
  }

  for (const image of [APP_IMAGE, WORKER_IMAGE]) {
    assertShellListingClean(image, "ls /app/*.pem 2>/dev/null || true", "unexpected .pem files in /app");
  }

  assertWorkerPythonClean(WORKER_IMAGE);

  console.log(`Image content contract passed for ${APP_IMAGE} and ${WORKER_IMAGE}`);
}

main();
