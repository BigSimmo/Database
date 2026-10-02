/**
 * Worker health check endpoint for Railway/container orchestration probes.
 *
 * Validates:
 * - Supabase connectivity
 * - Last successful claim processing timestamp (stale-claim detection)
 * - Python venv availability
 *
 * Used by Railway healthcheck and Kubernetes liveness/readiness probes.
 * Intended to run on http://0.0.0.0:3001/health (see run-loop.ts for binding).
 */

import { createServer } from "node:http";
import { createAdminClient } from "../src/lib/supabase/admin";
import { probeSupabaseHealth } from "../src/lib/supabase/health";
import { safeErrorLogDetails } from "../src/lib/privacy";

interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  checks: {
    supabase: {
      status: "ok" | "error";
      message?: string;
    };
    python_venv: {
      status: "ok" | "error";
      message?: string;
    };
    last_claim_processed?: string;
  };
}

// Global state: track last successful claim processing for staleness detection.
let lastClaimProcessedAt: Date | null = null;
export function recordClaimProcessed() {
  lastClaimProcessedAt = new Date();
}

export function getLastClaimProcessedAt(): Date | null {
  return lastClaimProcessedAt;
}

let cachedPythonStatus: { status: "ok" | "error"; message?: string } | null = null;
let lastPythonCheckAt = 0;
const PYTHON_CHECK_TTL_MS = 5 * 60 * 1000;

async function checkPythonVenvAvailability(): Promise<{ status: "ok" | "error"; message?: string }> {
  const now = Date.now();
  if (cachedPythonStatus && now - lastPythonCheckAt < PYTHON_CHECK_TTL_MS) {
    return cachedPythonStatus;
  }

  try {
    const pythonBin = process.env.WORKER_DOCLING_PYTHON_BIN || "/opt/ocr-venv/bin/python";
    const { execFile } = await import("node:child_process");
    await new Promise<void>((resolve, reject) => {
      execFile(pythonBin, ["--version"], { timeout: 5000 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    cachedPythonStatus = { status: "ok" };
  } catch (error) {
    cachedPythonStatus = {
      status: "error",
      message: `Python unavailable: ${safeErrorLogDetails(error)}`,
    };
  }
  lastPythonCheckAt = now;
  return cachedPythonStatus;
}

async function performHealthCheck(): Promise<HealthResponse> {
  const checks: HealthResponse["checks"] = {
    supabase: { status: "ok" },
    python_venv: { status: "ok" },
  };

  let hasErrors = false;

  // Check 1: Supabase connectivity
  try {
    await probeSupabaseHealth(createAdminClient());
    checks.supabase = { status: "ok" };
  } catch (error) {
    checks.supabase = {
      status: "error",
      message: `Connection failed: ${safeErrorLogDetails(error)}`,
    };
    hasErrors = true;
  }

  // Check 2: Python venv availability (async + cached)
  checks.python_venv = await checkPythonVenvAvailability();
  if (checks.python_venv.status === "error") {
    hasErrors = true;
  }

  // Check 3: Last claim processed (staleness detection)
  if (lastClaimProcessedAt) {
    checks.last_claim_processed = lastClaimProcessedAt.toISOString();
    const staleness = Date.now() - lastClaimProcessedAt.getTime();
    const staleThresholdMs = 5 * 60 * 1000; // 5 minutes

    if (staleness > staleThresholdMs) {
      // Degraded but not failed: worker may be waiting for claims
      return {
        status: "degraded",
        timestamp: new Date().toISOString(),
        checks,
      };
    }
  }

  return {
    status: hasErrors ? "error" : "ok",
    timestamp: new Date().toISOString(),
    checks,
  };
}

export function createHealthCheckServer(port: number = 3001) {
  const server = createServer(async (req, res) => {
    if (req.method !== "GET" || !req.url?.startsWith("/health")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    try {
      const health = await performHealthCheck();
      const statusCode = health.status === "ok" ? 200 : health.status === "degraded" ? 200 : 503;

      res.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });
      res.end(JSON.stringify(health));
    } catch (error) {
      console.error("Health check failed", safeErrorLogDetails(error));
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", error: "Health check exception" }));
    }
  });

  return server;
}

/**
 * Start health check server if WORKER_HEALTH_PORT is configured.
 * Returns the running HTTP server instance, or null if unconfigured.
 */
export function startWorkerHealthServerIfConfigured() {
  const portStr = process.env.WORKER_HEALTH_PORT;
  if (!portStr) return null;
  const port = parseInt(portStr, 10);
  if (isNaN(port) || port <= 0) return null;

  const server = createHealthCheckServer(port);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Worker health check server listening on http://0.0.0.0:${port}/health`);
  });

  return server;
}

// Direct CLI invocation fallback
if (import.meta.main) {
  const server = startWorkerHealthServerIfConfigured();
  if (server) {
    process.on("SIGTERM", () => {
      console.log("SIGTERM received, shutting down health check server");
      server.close();
      process.exit(0);
    });
  }
}
