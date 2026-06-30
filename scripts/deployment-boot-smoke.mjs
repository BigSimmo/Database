import { accessSync, constants, createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { appName, localProjectId } from "./local-server-utils.mjs";

function parsePositiveInt(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined) return fallback;
  const parsed = Number(rawValue);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  throw new Error(`Invalid ${name}: ${rawValue}`);
}

const projectRoot = process.cwd();
const port = parsePositiveInt("DEPLOY_SMOKE_PORT", 4200);
const baseUrl = `http://127.0.0.1:${port}`;
const expectedProjectId = localProjectId(projectRoot);
const startupBufferMs = parsePositiveInt("DEPLOY_SMOKE_STARTUP_DELAY_MS", 1000);
const smokeTimeoutMs = parsePositiveInt("DEPLOY_SMOKE_TIMEOUT_MS", 60000);
const pollDelayMs = parsePositiveInt("DEPLOY_SMOKE_POLL_DELAY_MS", 1000);
const logRoot = mkdtempSync(resolve(tmpdir(), "clinical-kb-deploy-smoke-"));
const logPath = resolve(logRoot, "deploy-smoke.log");
const nextBin = resolve(projectRoot, "node_modules", "next", "dist", "bin", "next");

if (!existsSync(nextBin)) {
  throw new Error(`Next.js binary not found at: ${nextBin}`);
}

function appendLog(stream, chunk) {
  if (chunk) stream.write(chunk);
}

function dumpLogTail() {
  try {
    accessSync(logPath, constants.F_OK);
    const content = readFileSync(logPath, "utf8");
    const lines = content.split(/\r?\n/);
    console.error("--- deployment smoke log (tail) ---");
    console.error(lines.slice(Math.max(0, lines.length - 80)).join("\n"));
  } catch {
    // no log available
  }
}

function formatFailureMessage(error) {
  return error instanceof Error ? error.message : `Deployment boot smoke failed: ${String(error)}`;
}

async function stopServer(child, logStream) {
  logStream.end();
  await once(logStream, "finish").catch(() => {});

  if (child.exitCode !== null) return;

  child.kill("SIGTERM");
  const terminated = await Promise.race([
    once(child, "exit").then(() => true).catch(() => true),
    delay(5000).then(() => false),
  ]);
  if (!terminated && child.exitCode === null) {
    child.kill("SIGKILL");
    await once(child, "exit").catch(() => {});
  }
}

async function bootSmoke() {
  const logStream = createWriteStream(logPath, { flags: "a", encoding: "utf8" });
  let spawnError = null;
  const child = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        PORT: String(port),
        NEXT_PUBLIC_SUPABASE_URL:
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://sjrfecxgysukkwxsowpy.supabase.co",
        // instrumentation.ts register() requires these in production mode; provide
        // placeholder values so the boot-smoke can verify server identity without
        // needing real secrets. Routes that actually use Supabase/OpenAI will still
        // fail with real errors, but /api/local-project-id does not.
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-ci-service-role",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "placeholder-ci-openai",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  child.once("error", (error) => {
    spawnError = error;
  });

  appendLog(logStream, `\n${new Date().toISOString()} Starting deployment smoke: next start ${baseUrl}\n`);
  child.stdout.on("data", (chunk) => appendLog(logStream, chunk));
  child.stderr.on("data", (chunk) => appendLog(logStream, chunk));

  const deadline = Date.now() + smokeTimeoutMs;
  let attempt = 1;
  let lastError = null;

  try {
    if (startupBufferMs > 0) {
      await delay(startupBufferMs);
    }

    while (Date.now() < deadline) {
      if (spawnError) {
        throw new Error(`Failed to start Next server: ${spawnError.message ?? String(spawnError)}`);
      }

      if (child.exitCode !== null) {
        throw new Error(`Next server exited before readiness check (code ${child.exitCode}).`);
      }

      try {
        const response = await fetch(`${baseUrl}/api/local-project-id`, {
          headers: { "user-agent": "deployment-boot-smoke" },
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
          throw new Error(`Unexpected status: ${response.status}`);
        }

        const payload = await response.json();
        if (payload.appName !== appName) {
          throw new Error(`Unexpected app identity: appName=${String(payload.appName)} (expected ${appName}).`);
        }
        if (payload.projectId !== expectedProjectId) {
          throw new Error(`Wrong local project ID: ${String(payload.projectId)} (expected ${expectedProjectId}).`);
        }
        if (payload.localServer?.currentPort && payload.localServer.currentPort !== port) {
          throw new Error(
            `Server started on unexpected port: ${String(payload.localServer.currentPort)} (expected ${port}).`,
          );
        }
        if (!payload.localServer?.safeLocalOrigin) {
          throw new Error("local-server identity guard rejected this origin.");
        }

        console.log(`[deployment-boot-smoke] PASS on attempt ${attempt}: ${baseUrl}`);
        return;
      } catch (error) {
        lastError = error;
        attempt += 1;
        await delay(pollDelayMs);
      }
    }

    throw lastError ?? new Error("Deployment boot smoke timed out.");
  } finally {
    await stopServer(child, logStream);
  }
}

function cleanupLogRoot() {
  try {
    rmSync(logRoot, { force: true, recursive: true });
  } catch {
    // best-effort cleanup
  }
}

try {
  await bootSmoke();
  cleanupLogRoot();
  process.exit(0);
} catch (error) {
  console.error(formatFailureMessage(error));
  dumpLogTail(); // log still exists here — cleanup happens after the dump
  cleanupLogRoot();
  process.exit(1);
}
